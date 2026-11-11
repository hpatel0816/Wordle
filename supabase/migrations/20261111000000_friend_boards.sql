-- Friend boards: everyone with a link plays the same hidden word at their
-- own pace, then sees a shared scoreboard.
--
-- Security model: players never touch these tables directly. Row-level
-- security is on with no policies, table privileges are revoked, and the
-- app calls the security-definer functions at the bottom of this file.
-- The answer is only ever returned to a player whose round is over.

-- ---------------------------------------------------------------- tables

create table public.words (
  word text primary key check (word ~ '^[a-z]{5}$'),
  is_answer boolean not null default false
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now()
);

-- Substrings that can't appear in display names.
create table public.blocked_name_parts (
  part text primary key
);

insert into public.blocked_name_parts (part) values
  ('fuck'), ('shit'), ('cunt'), ('nigg'), ('fagg'), ('faggot'), ('bitch'),
  ('whore'), ('slut'), ('rapist'), ('nazi'), ('hitler'), ('porn'), ('kike'),
  ('retard');

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'board' check (kind in ('board')),
  answer text not null references public.words (word),
  hard_mode boolean not null default false,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  ends_at timestamptz not null default now() + interval '7 days'
);

create index matches_created_by_idx on public.matches (created_by, created_at);

create table public.match_players (
  match_id uuid not null references public.matches (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  started_at timestamptz, -- first guess
  finished_at timestamptz,
  solved boolean not null default false,
  guesses_used int not null default 0 check (guesses_used between 0 and 6),
  primary key (match_id, user_id)
);

create table public.guesses (
  match_id uuid not null,
  user_id uuid not null,
  row_index int not null check (row_index between 0 and 5),
  word text not null,
  result text[] not null,
  created_at timestamptz not null default now(),
  primary key (match_id, user_id, row_index),
  foreign key (match_id, user_id) references public.match_players (match_id, user_id) on delete cascade
);

alter table public.words enable row level security;
alter table public.profiles enable row level security;
alter table public.blocked_name_parts enable row level security;
alter table public.matches enable row level security;
alter table public.match_players enable row level security;
alter table public.guesses enable row level security;

revoke all on all tables in schema public from anon, authenticated;

-- --------------------------------------------------------------- helpers

-- Same rules as scoreGuess() in src/gameLogic.js: exact matches first,
-- then "almost" while unmatched copies of the letter remain.
create function public.score_guess(guess text, answer text)
returns text[]
language plpgsql
immutable
set search_path = ''
as $$
declare
  result text[] := array_fill('error'::text, array[5]);
  remaining int[] := array_fill(0, array[26]);
  i int;
  code int;
begin
  for i in 1..5 loop
    if substr(guess, i, 1) = substr(answer, i, 1) then
      result[i] := 'correct';
    else
      code := ascii(substr(answer, i, 1)) - 96;
      remaining[code] := remaining[code] + 1;
    end if;
  end loop;

  for i in 1..5 loop
    code := ascii(substr(guess, i, 1)) - 96;
    if result[i] <> 'correct' and remaining[code] > 0 then
      result[i] := 'almost';
      remaining[code] := remaining[code] - 1;
    end if;
  end loop;

  return result;
end;
$$;

-- Same rules as getHardModeError() in src/gameLogic.js. Returns a message
-- for the first broken rule, or null.
create function public.hard_mode_error(p_match uuid, p_user uuid, guess text)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  ordinals text[] := array['1st', '2nd', '3rd', '4th', '5th'];
  required jsonb := '{}';
  counts jsonb;
  prev record;
  letter text;
  need int;
  i int;
begin
  for prev in
    select g.word, g.result from public.guesses g
    where g.match_id = p_match and g.user_id = p_user
    order by g.row_index
  loop
    counts := '{}';
    for i in 1..5 loop
      letter := substr(prev.word, i, 1);
      if prev.result[i] = 'correct' and substr(guess, i, 1) <> letter then
        return ordinals[i] || ' letter must be ' || upper(letter);
      end if;
      if prev.result[i] <> 'error' then
        counts := jsonb_set(counts, array[letter], to_jsonb(coalesce((counts ->> letter)::int, 0) + 1));
      end if;
    end loop;
    for letter in select jsonb_object_keys(counts) loop
      required := jsonb_set(required, array[letter],
        to_jsonb(greatest(coalesce((required ->> letter)::int, 0), (counts ->> letter)::int)));
    end loop;
  end loop;

  for letter, need in select key, value::int from jsonb_each_text(required) loop
    if length(guess) - length(replace(guess, letter, '')) < need then
      return case
        when need > 1 then 'Guess must contain ' || need || ' ' || upper(letter) || 's'
        else 'Guess must contain ' || upper(letter)
      end;
    end if;
  end loop;

  return null;
end;
$$;

create function public.require_user()
returns uuid
language plpgsql
stable
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in to play online';
  end if;
  return auth.uid();
end;
$$;

-- ------------------------------------------------------------- functions

create function public.get_my_profile()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('display_name', p.display_name)
  from public.profiles p
  where p.id = auth.uid();
$$;

create function public.set_display_name(p_name text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_user();
  clean text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
begin
  if char_length(clean) not between 2 and 16 or clean !~ '^[A-Za-z0-9 _.-]+$' then
    raise exception 'Names are 2 to 16 letters, numbers, spaces, or _ . -';
  end if;
  if exists (
    select 1 from public.blocked_name_parts b
    where lower(replace(clean, ' ', '')) like '%' || b.part || '%'
  ) then
    raise exception 'Please choose a different name';
  end if;

  insert into public.profiles (id, display_name) values (uid, clean)
  on conflict (id) do update set display_name = excluded.display_name;
  return clean;
end;
$$;

create function public.create_match(p_hard_mode boolean default false)
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
    raise exception 'You''ve made a lot of boards. Try again in a while.';
  end if;

  select w.word into picked from public.words w where w.is_answer order by random() limit 1;

  insert into public.matches (answer, hard_mode, created_by)
  values (picked, coalesce(p_hard_mode, false), uid)
  returning id into new_id;

  insert into public.match_players (match_id, user_id) values (new_id, uid);
  return new_id;
end;
$$;

create function public.join_match(p_match uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_user();
  m public.matches;
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
  if m.ends_at <= now() then
    raise exception 'This board has closed';
  end if;
  if (select count(*) from public.match_players where match_id = p_match) >= 50 then
    raise exception 'This board is full';
  end if;
  insert into public.match_players (match_id, user_id) values (p_match, uid);
end;
$$;

create function public.submit_guess(p_match uuid, p_guess text)
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
begin
  select * into m from public.matches where id = p_match;
  if not found then
    raise exception 'Board not found';
  end if;

  -- Lock the player's row so two quick submits can't use the same row.
  select * into me from public.match_players
  where match_id = p_match and user_id = uid
  for update;
  if not found then
    raise exception 'Join the board first';
  end if;
  if me.finished_at is not null then
    raise exception 'You''ve already finished this board';
  end if;
  if m.ends_at <= now() then
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

  return jsonb_build_object(
    'result', to_jsonb(scored),
    'finished', done,
    'solved', is_solved,
    'answer', case when done then m.answer end
  );
end;
$$;

-- Everything the caller may see about a board. Other players' guesses and
-- the answer are included only once the caller has finished (or the board
-- has closed); before that, only names and how each player did.
create function public.get_match(p_match uuid)
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
  closed boolean;
  reveal boolean;
begin
  select * into m from public.matches where id = p_match;
  if not found then
    raise exception 'Board not found';
  end if;

  select * into me from public.match_players where match_id = p_match and user_id = uid;
  joined := found;
  closed := m.ends_at <= now();
  reveal := closed or (joined and me.finished_at is not null);

  return jsonb_build_object(
    'id', m.id,
    'hard_mode', m.hard_mode,
    'ends_at', m.ends_at,
    'closed', closed,
    'creator', (select p.display_name from public.profiles p where p.id = m.created_by),
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
          'finished', mp.finished_at is not null,
          'solved', mp.solved,
          'guesses_used', mp.guesses_used,
          'seconds', extract(epoch from mp.finished_at - mp.started_at)::int,
          'rows', case when reveal then coalesce((
            select jsonb_agg(jsonb_build_object('word', g.word, 'result', to_jsonb(g.result)) order by g.row_index)
            from public.guesses g where g.match_id = mp.match_id and g.user_id = mp.user_id
          ), '[]'::jsonb) end
        )
        order by mp.finished_at is null, mp.solved desc, mp.guesses_used, mp.finished_at - mp.started_at)
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
  public.join_match(uuid),
  public.submit_guess(uuid, text),
  public.get_match(uuid)
to authenticated;
