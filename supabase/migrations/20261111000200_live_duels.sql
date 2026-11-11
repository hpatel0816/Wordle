-- Live duels: a host opens a lobby, friends join with the link, the host
-- starts a short countdown, and everyone races on the same word. The first
-- player to solve it wins and the duel ends for everyone; otherwise it ends
-- when everyone is out of guesses or the time limit runs out.
--
-- Opponents see each other's colors live (never letters). The server pings
-- the channel "match:<id>" whenever something changes; the payload carries
-- no game data, and clients re-fetch get_match, which applies the rules.

alter table public.matches drop constraint matches_kind_check;
alter table public.matches add constraint matches_kind_check check (kind in ('board', 'duel'));

-- Boards are always 'open'. Duels go lobby -> active -> finished.
alter table public.matches
  add column status text not null default 'open'
    check (status in ('open', 'lobby', 'active', 'finished')),
  add column starts_at timestamptz,
  add column winner_id uuid references auth.users (id) on delete set null;

-- ------------------------------------------------------------- helpers

-- True once nobody can guess any more.
create function public.match_over(m public.matches)
returns boolean
language sql
stable
set search_path = ''
as $$
  select case m.kind
    when 'duel' then m.status = 'finished' or (m.status = 'active' and now() >= m.ends_at)
    else m.ends_at <= now()
  end;
$$;

-- Tell everyone watching the match to refresh. Never blocks the game.
create function public.ping_match(p_match uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.send(jsonb_build_object('at', now()), 'changed', 'match:' || p_match, false);
exception when others then
  null;
end;
$$;

-- ----------------------------------------------------------- functions

create function public.create_duel(p_hard_mode boolean default false)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_user();
  new_id uuid;
  picked text;
begin
  if not exists (select 1 from public.profiles where id = uid) then
    raise exception 'Choose a display name first';
  end if;
  if (select count(*) from public.matches
      where created_by = uid and created_at > now() - interval '1 hour') >= 20 then
    raise exception 'You''ve started a lot of games. Try again in a while.';
  end if;

  select w.word into picked from public.words w where w.is_answer order by random() limit 1;

  -- A lobby that never starts expires after an hour.
  insert into public.matches (kind, status, answer, hard_mode, created_by, ends_at)
  values ('duel', 'lobby', picked, coalesce(p_hard_mode, false), uid, now() + interval '1 hour')
  returning id into new_id;

  insert into public.match_players (match_id, user_id) values (new_id, uid);
  return new_id;
end;
$$;

create or replace function public.join_match(p_match uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_user();
  m public.matches;
  cap int;
begin
  if not exists (select 1 from public.profiles where id = uid) then
    raise exception 'Choose a display name first';
  end if;
  select * into m from public.matches where id = p_match;
  if not found then
    raise exception 'Board not found';
  end if;
  if exists (select 1 from public.match_players where match_id = p_match and user_id = uid) then
    return;
  end if;

  if m.kind = 'duel' then
    if m.status <> 'lobby' or m.ends_at <= now() then
      raise exception 'This duel has already started';
    end if;
    cap := 8;
  else
    if m.ends_at <= now() then
      raise exception 'This board has closed';
    end if;
    cap := 50;
  end if;

  if (select count(*) from public.match_players where match_id = p_match) >= cap then
    raise exception 'This game is full';
  end if;
  insert into public.match_players (match_id, user_id) values (p_match, uid);
  perform public.ping_match(p_match);
end;
$$;

create function public.start_duel(p_match uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_user();
  m public.matches;
begin
  select * into m from public.matches where id = p_match for update;
  if not found or m.kind <> 'duel' then
    raise exception 'Duel not found';
  end if;
  if m.created_by <> uid then
    raise exception 'Only the host can start the duel';
  end if;
  if m.status <> 'lobby' then
    raise exception 'The duel has already started';
  end if;
  if (select count(*) from public.match_players where match_id = p_match) < 2 then
    raise exception 'Wait for someone to join first';
  end if;

  -- A 3-second countdown, then 5 minutes to play.
  update public.matches set
    status = 'active',
    starts_at = now() + interval '3 seconds',
    ends_at = now() + interval '3 seconds' + interval '5 minutes'
  where id = p_match;
  perform public.ping_match(p_match);
end;
$$;

create or replace function public.submit_guess(p_match uuid, p_guess text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_user();
  m public.matches;
  me public.match_players;
  guess text := lower(coalesce(p_guess, ''));
  problem text;
  scored text[];
  is_solved boolean;
  done boolean;
  over boolean := false;
begin
  -- Lock the match row so two players can't both win a duel.
  select * into m from public.matches where id = p_match for update;
  if not found then
    raise exception 'Board not found';
  end if;

  select * into me from public.match_players
  where match_id = p_match and user_id = uid
  for update;
  if not found then
    raise exception 'Join the board first';
  end if;
  if me.finished_at is not null then
    raise exception 'You''ve already finished this board';
  end if;

  if m.kind = 'duel' then
    if m.status = 'lobby' then
      raise exception 'The duel hasn''t started yet';
    end if;
    if public.match_over(m) then
      raise exception 'The duel is over';
    end if;
    if now() < m.starts_at then
      raise exception 'Wait for the countdown';
    end if;
  elsif m.ends_at <= now() then
    raise exception 'This board has closed';
  end if;

  if guess !~ '^[a-z]{5}$' or not exists (select 1 from public.words where word = guess) then
    raise exception 'Not in word list';
  end if;
  if m.hard_mode then
    problem := public.hard_mode_error(p_match, uid, guess);
    if problem is not null then
      raise exception '%', problem;
    end if;
  end if;

  scored := public.score_guess(guess, m.answer);
  is_solved := guess = m.answer;
  done := is_solved or me.guesses_used + 1 >= 6;

  insert into public.guesses (match_id, user_id, row_index, word, result)
  values (p_match, uid, me.guesses_used, guess, scored);

  update public.match_players set
    guesses_used = me.guesses_used + 1,
    started_at = coalesce(me.started_at, now()),
    solved = is_solved,
    finished_at = case when done then now() end
  where match_id = p_match and user_id = uid;

  if m.kind = 'duel' then
    -- The first solve wins and ends the duel; so does everyone running out.
    if is_solved then
      update public.matches set status = 'finished', winner_id = uid where id = p_match;
      over := true;
    elsif not exists (
      select 1 from public.match_players where match_id = p_match and finished_at is null
    ) then
      update public.matches set status = 'finished' where id = p_match;
      over := true;
    end if;
    perform public.ping_match(p_match);
  end if;

  return jsonb_build_object(
    'result', to_jsonb(scored),
    'finished', done,
    'solved', is_solved,
    'match_over', over,
    'answer', case when done or over then m.answer end
  );
end;
$$;

-- What the caller may see. The answer and everyone's words appear once the
-- caller has finished or the game is over. In a duel, other players'
-- colors (not letters) are visible live.
create or replace function public.get_match(p_match uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_user();
  m public.matches;
  me public.match_players;
  joined boolean;
  over boolean;
  reveal boolean;
  live_colors boolean;
begin
  select * into m from public.matches where id = p_match;
  if not found then
    raise exception 'Board not found';
  end if;

  select * into me from public.match_players where match_id = p_match and user_id = uid;
  joined := found;
  over := public.match_over(m);
  reveal := over or (joined and me.finished_at is not null);
  live_colors := m.kind = 'duel' and joined;

  return jsonb_build_object(
    'id', m.id,
    'kind', m.kind,
    'status', case when m.kind = 'duel' and over then 'finished' else m.status end,
    'hard_mode', m.hard_mode,
    'starts_at', m.starts_at,
    'ends_at', m.ends_at,
    'server_now', now(),
    'closed', over,
    'creator', (select p.display_name from public.profiles p where p.id = m.created_by),
    'is_host', m.created_by = uid,
    'winner', (select p.display_name from public.profiles p where p.id = m.winner_id),
    'joined', joined,
    'answer', case when reveal then m.answer end,
    'my_rows', coalesce((
      select jsonb_agg(jsonb_build_object('word', g.word, 'result', to_jsonb(g.result)) order by g.row_index)
      from public.guesses g where g.match_id = p_match and g.user_id = uid
    ), '[]'::jsonb),
    'players', coalesce((
      select jsonb_agg(jsonb_build_object(
          'name', pr.display_name,
          'is_me', mp.user_id = uid,
          'is_host', mp.user_id = m.created_by,
          'is_winner', mp.user_id is not distinct from m.winner_id,
          'finished', mp.finished_at is not null,
          'solved', mp.solved,
          'guesses_used', mp.guesses_used,
          'seconds', extract(epoch from mp.finished_at - coalesce(m.starts_at, mp.started_at))::int,
          'rows', case
            when reveal or mp.user_id = uid then coalesce((
              select jsonb_agg(jsonb_build_object('word', g.word, 'result', to_jsonb(g.result)) order by g.row_index)
              from public.guesses g where g.match_id = mp.match_id and g.user_id = mp.user_id
            ), '[]'::jsonb)
            when live_colors then coalesce((
              select jsonb_agg(jsonb_build_object('word', null, 'result', to_jsonb(g.result)) order by g.row_index)
              from public.guesses g where g.match_id = mp.match_id and g.user_id = mp.user_id
            ), '[]'::jsonb)
          end
        )
        order by mp.user_id is not distinct from m.winner_id desc,
          mp.finished_at is null, mp.solved desc, mp.guesses_used,
          mp.finished_at - coalesce(m.starts_at, mp.started_at), mp.joined_at)
      from public.match_players mp
      join public.profiles pr on pr.id = mp.user_id
      where mp.match_id = p_match
    ), '[]'::jsonb)
  );
end;
$$;

-- ------------------------------------------------------------ privileges

revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function
  public.get_my_profile(),
  public.set_display_name(text),
  public.create_match(boolean),
  public.create_duel(boolean),
  public.join_match(uuid),
  public.start_duel(uuid),
  public.submit_guess(uuid, text),
  public.get_match(uuid)
to authenticated;
