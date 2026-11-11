-- Ranked play: a matchmaking queue pairs players with similar ratings for a
-- 1-on-1 duel (no lobby, 3-second countdown, 3 minutes, never hard mode).
-- Ratings use Elo (K = 32, everyone starts at 1000). A win scores 1, a loss
-- 0, and a duel nobody solves is a draw.
--
-- Queue entries are refreshed by each poll (find_match, every ~2 seconds);
-- only players seen in the last 6 seconds are matched, so someone who
-- closed the tab is never picked.

alter table public.profiles
  add column rating int not null default 1000,
  add column ranked_played int not null default 0,
  add column ranked_wins int not null default 0;

alter table public.matches
  add column ranked boolean not null default false,
  add column rated boolean not null default false;

alter table public.match_players
  add column rating_change int;

create table public.matchmaking_queue (
  user_id uuid primary key references auth.users (id) on delete cascade,
  rating int not null,
  joined_at timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  match_id uuid references public.matches (id) on delete set null
);

alter table public.matchmaking_queue enable row level security;
revoke all on public.matchmaking_queue from anon, authenticated;

-- Apply Elo to a finished ranked duel, once.
create function public.rate_match(p_match uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  m public.matches;
  a record;
  b record;
  score_a numeric;
  expected_a numeric;
  change_a int;
begin
  select * into m from public.matches where id = p_match for update;
  if not found or not m.ranked or m.rated or not public.match_over(m) then
    return;
  end if;

  select mp.user_id, p.rating into a
  from public.match_players mp join public.profiles p on p.id = mp.user_id
  where mp.match_id = p_match order by mp.joined_at, mp.user_id limit 1;
  select mp.user_id, p.rating into b
  from public.match_players mp join public.profiles p on p.id = mp.user_id
  where mp.match_id = p_match order by mp.joined_at, mp.user_id offset 1 limit 1;

  if b.user_id is not null then
    score_a := case
      when m.winner_id = a.user_id then 1
      when m.winner_id = b.user_id then 0
      else 0.5
    end;
    expected_a := 1 / (1 + power(10, (b.rating - a.rating) / 400.0));
    change_a := round(32 * (score_a - expected_a));

    update public.profiles set
      rating = greatest(100, rating + change_a),
      ranked_played = ranked_played + 1,
      ranked_wins = ranked_wins + (score_a = 1)::int
    where id = a.user_id;
    update public.profiles set
      rating = greatest(100, rating - change_a),
      ranked_played = ranked_played + 1,
      ranked_wins = ranked_wins + (score_a = 0)::int
    where id = b.user_id;

    update public.match_players set rating_change = change_a where match_id = p_match and user_id = a.user_id;
    update public.match_players set rating_change = -change_a where match_id = p_match and user_id = b.user_id;
  end if;

  update public.matches set rated = true, status = 'finished' where id = p_match;
end;
$$;

-- Join (or stay in) the queue, and get paired when possible.
-- Returns { status: "waiting", waited } or { status: "matched", match_id }.
create function public.find_match()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_user();
  my_rating int;
  mine public.matchmaking_queue;
  opponent public.matchmaking_queue;
  picked text;
  new_id uuid;
begin
  select rating into my_rating from public.profiles where id = uid;
  if not found then
    raise exception 'Choose a display name first';
  end if;

  -- Locking our own row also stops anyone else pairing with us meanwhile.
  select * into mine from public.matchmaking_queue where user_id = uid for update;
  if found and mine.match_id is not null then
    delete from public.matchmaking_queue where user_id = uid;
    return jsonb_build_object('status', 'matched', 'match_id', mine.match_id);
  end if;

  select * into opponent from public.matchmaking_queue
  where user_id <> uid and match_id is null and last_seen > now() - interval '6 seconds'
  order by abs(rating - my_rating), joined_at
  limit 1
  for update skip locked;

  if found then
    select w.word into picked from public.words w where w.is_answer order by random() limit 1;
    insert into public.matches (kind, ranked, status, answer, hard_mode, created_by, starts_at, ends_at)
    values ('duel', true, 'active', picked, false, uid,
            now() + interval '3 seconds', now() + interval '3 seconds' + interval '3 minutes')
    returning id into new_id;
    insert into public.match_players (match_id, user_id, joined_at) values
      (new_id, opponent.user_id, opponent.joined_at),
      (new_id, uid, now());
    update public.matchmaking_queue set match_id = new_id where user_id = opponent.user_id;
    delete from public.matchmaking_queue where user_id = uid;
    perform public.ping_match(new_id);
    return jsonb_build_object('status', 'matched', 'match_id', new_id);
  end if;

  insert into public.matchmaking_queue (user_id, rating) values (uid, my_rating)
  on conflict (user_id) do update set last_seen = now(), rating = excluded.rating
  returning * into mine;
  return jsonb_build_object('status', 'waiting', 'waited', extract(epoch from now() - mine.joined_at)::int);
end;
$$;

create function public.leave_queue()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.matchmaking_queue where user_id = auth.uid() and match_id is null;
$$;

create or replace function public.get_my_profile()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'display_name', p.display_name,
    'rating', p.rating,
    'ranked_played', p.ranked_played,
    'ranked_wins', p.ranked_wins
  )
  from public.profiles p
  where p.id = auth.uid();
$$;

-- Top 20 ranked players, plus the caller's own rank.
create function public.get_leaderboard()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'top', coalesce((
      select jsonb_agg(jsonb_build_object(
          'rank', t.rank, 'name', t.display_name, 'rating', t.rating,
          'played', t.ranked_played, 'wins', t.ranked_wins, 'is_me', t.id = auth.uid()
        ) order by t.rank)
      from (
        select p.*, rank() over (order by p.rating desc) as rank
        from public.profiles p where p.ranked_played > 0
        order by p.rating desc limit 20
      ) t
    ), '[]'::jsonb),
    'me', (
      select jsonb_build_object(
        'rating', p.rating, 'played', p.ranked_played, 'wins', p.ranked_wins,
        'rank', case when p.ranked_played > 0 then (
          select count(*) + 1 from public.profiles o where o.ranked_played > 0 and o.rating > p.rating
        ) end
      )
      from public.profiles p where p.id = auth.uid()
    )
  );
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
    if over and m.ranked then
      perform public.rate_match(p_match);
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

create or replace function public.get_match(p_match uuid)
returns jsonb
language plpgsql
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

  -- A ranked duel that ran out of time is rated the first time anyone looks.
  if m.ranked and not m.rated and public.match_over(m) then
    perform public.rate_match(p_match);
    select * into m from public.matches where id = p_match;
  end if;

  select * into me from public.match_players where match_id = p_match and user_id = uid;
  joined := found;
  over := public.match_over(m);
  reveal := over or (joined and me.finished_at is not null);
  live_colors := m.kind = 'duel' and joined;

  return jsonb_build_object(
    'id', m.id,
    'kind', m.kind,
    'ranked', m.ranked,
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
          'rating', case when m.ranked then pr.rating end,
          'rating_change', mp.rating_change,
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
  public.get_match(uuid),
  public.find_match(),
  public.leave_queue(),
  public.get_leaderboard()
to authenticated;
