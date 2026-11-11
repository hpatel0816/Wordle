-- Run with: npm run db:test
begin;
select plan(19);

insert into auth.users (id, aud, role, email) values
  ('00000000-0000-0000-0000-00000000000a', 'authenticated', 'authenticated', 'ana@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'authenticated', 'authenticated', 'ben@test.local'),
  ('00000000-0000-0000-0000-00000000000c', 'authenticated', 'authenticated', 'cy@test.local');
insert into public.profiles (id, display_name) values
  ('00000000-0000-0000-0000-00000000000a', 'Ana'),
  ('00000000-0000-0000-0000-00000000000b', 'Ben'),
  ('00000000-0000-0000-0000-00000000000c', 'Cy');

set local role authenticated;

-- ---- Ana queues alone and waits
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select is(public.find_match() ->> 'status', 'waiting', 'the first player waits');
select throws_ok($$ select * from public.matchmaking_queue $$, '42501', null, 'players cannot read the queue');

-- ---- Ben queues and is paired with Ana
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
create temp table found_match as select public.find_match() as r;
select is((select r ->> 'status' from found_match), 'matched', 'the second player is paired');

-- ---- Ana's next poll finds the same match
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select is(public.find_match() ->> 'match_id', (select r ->> 'match_id' from found_match), 'the waiting player gets the same match');

reset role;
select is((select count(*)::int from public.matchmaking_queue), 0, 'both left the queue');
select is(
  (select row(kind, ranked, status, hard_mode)::text from public.matches where id = (select (r ->> 'match_id')::uuid from found_match)),
  '(duel,t,active,f)',
  'a ranked match is an active duel without hard mode'
);
-- Known answer, countdown skipped.
update public.matches set answer = 'crane', starts_at = now() - interval '1 second'
where id = (select (r ->> 'match_id')::uuid from found_match);
set local role authenticated;

select is(
  public.get_match((select (r ->> 'match_id')::uuid from found_match)) ->> 'ranked',
  'true',
  'get_match marks it ranked'
);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select throws_ok(
  format($$ select public.join_match(%L) $$, (select r ->> 'match_id' from found_match)),
  'P0001', 'This duel has already started', 'a third player cannot join a ranked match'
);

-- ---- Ana wins: Elo moves 16 points between equal ratings
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select is(
  public.submit_guess((select (r ->> 'match_id')::uuid from found_match), 'crane') ->> 'match_over',
  'true',
  'solving ends the ranked match'
);
select is(public.get_my_profile() ->> 'rating', '1016', 'the winner gains 16');
select is(public.get_my_profile() ->> 'ranked_wins', '1', 'the win is counted');
select is(
  (select p ->> 'rating_change' from jsonb_array_elements(public.get_match((select (r ->> 'match_id')::uuid from found_match)) -> 'players') p where p ->> 'name' = 'Ana'),
  '16',
  'the rating change is shown in the match'
);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is(public.get_my_profile() ->> 'rating', '984', 'the loser drops 16');
select is(public.get_my_profile() ->> 'ranked_played', '1', 'the loss is counted as played');

-- Looking again never rates twice.
select lives_ok(format($$ select public.get_match(%L) $$, (select r ->> 'match_id' from found_match)), 'reading again is harmless');
select is(public.get_my_profile() ->> 'rating', '984', 'ratings change only once');

-- ---- Leaderboard
select is(public.get_leaderboard() -> 'top' -> 0 ->> 'name', 'Ana', 'the leaderboard is ordered by rating');
select is(public.get_leaderboard() -> 'me' ->> 'rank', '2', 'my rank is included');

-- ---- A stale queue entry is never matched
reset role;
insert into public.matchmaking_queue (user_id, rating, last_seen)
values ('00000000-0000-0000-0000-00000000000a', 1016, now() - interval '1 minute');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select is(public.find_match() ->> 'status', 'waiting', 'players who stopped polling are skipped');

select * from finish();
rollback;
