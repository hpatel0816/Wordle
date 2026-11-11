-- Run with: npm run db:test
begin;
select plan(22);

insert into auth.users (id, aud, role, email) values
  ('00000000-0000-0000-0000-00000000000a', 'authenticated', 'authenticated', 'host@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'authenticated', 'authenticated', 'guest@test.local'),
  ('00000000-0000-0000-0000-00000000000c', 'authenticated', 'authenticated', 'late@test.local');
insert into public.profiles (id, display_name) values
  ('00000000-0000-0000-0000-00000000000a', 'Host'),
  ('00000000-0000-0000-0000-00000000000b', 'Guest'),
  ('00000000-0000-0000-0000-00000000000c', 'Late');

-- A duel lobby with a known answer, hosted by Host.
insert into public.matches (id, kind, status, answer, created_by, ends_at) values
  ('00000000-0000-0000-0000-0000000000d1', 'duel', 'lobby', 'crane', '00000000-0000-0000-0000-00000000000a', now() + interval '1 hour');
insert into public.match_players (match_id, user_id) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-00000000000a');

set local role authenticated;

-- ---- Host: can't start alone
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select ok(public.create_duel(false) is not null, 'create_duel returns an id');
select throws_ok($$ select public.start_duel('00000000-0000-0000-0000-0000000000d1') $$, 'P0001', 'Wait for someone to join first', 'a duel needs two players');
select throws_ok($$ select public.submit_guess('00000000-0000-0000-0000-0000000000d1', 'about') $$, 'P0001', 'The duel hasn''t started yet', 'no guesses in the lobby');

-- ---- Guest joins; only the host can start
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select lives_ok($$ select public.join_match('00000000-0000-0000-0000-0000000000d1') $$, 'a friend joins the lobby');
select is(public.get_match('00000000-0000-0000-0000-0000000000d1') ->> 'status', 'lobby', 'status is lobby');
select is(public.get_match('00000000-0000-0000-0000-0000000000d1') ->> 'is_host', 'false', 'the guest is not the host');
select throws_ok($$ select public.start_duel('00000000-0000-0000-0000-0000000000d1') $$, 'P0001', 'Only the host can start the duel', 'guests cannot start');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select lives_ok($$ select public.start_duel('00000000-0000-0000-0000-0000000000d1') $$, 'the host starts the duel');
select is(public.get_match('00000000-0000-0000-0000-0000000000d1') ->> 'status', 'active', 'status is active');
select throws_ok($$ select public.submit_guess('00000000-0000-0000-0000-0000000000d1', 'about') $$, 'P0001', 'Wait for the countdown', 'no guesses during the countdown');

-- ---- Latecomers can't join a running duel
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select throws_ok($$ select public.join_match('00000000-0000-0000-0000-0000000000d1') $$, 'P0001', 'This duel has already started', 'no joining after the start');

-- Skip the countdown (as the admin) so guesses are allowed.
reset role;
update public.matches set starts_at = now() - interval '1 second' where id = '00000000-0000-0000-0000-0000000000d1';
set local role authenticated;

-- ---- Guest guesses; Host sees colors live but not letters
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is(
  public.submit_guess('00000000-0000-0000-0000-0000000000d1', 'about') - 'result',
  '{"finished":false,"solved":false,"match_over":false,"answer":null}'::jsonb,
  'a duel guess returns colors only'
);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select is(
  (select p -> 'rows' from jsonb_array_elements(public.get_match('00000000-0000-0000-0000-0000000000d1') -> 'players') p where p ->> 'name' = 'Guest'),
  '[{"word": null, "result": ["almost", "error", "error", "error", "error"]}]'::jsonb,
  'opponents see colors live, without letters'
);
select is(public.get_match('00000000-0000-0000-0000-0000000000d1') -> 'answer', 'null'::jsonb, 'no answer mid-duel');

-- ---- Host solves first: the duel ends for everyone
select is(
  public.submit_guess('00000000-0000-0000-0000-0000000000d1', 'crane') - 'result',
  '{"finished":true,"solved":true,"match_over":true,"answer":"crane"}'::jsonb,
  'the first solve wins and ends the duel'
);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select throws_ok($$ select public.submit_guess('00000000-0000-0000-0000-0000000000d1', 'crane') $$, 'P0001', 'The duel is over', 'nobody can guess after the win');
select is(public.get_match('00000000-0000-0000-0000-0000000000d1') ->> 'winner', 'Host', 'the winner is named');
select is(public.get_match('00000000-0000-0000-0000-0000000000d1') ->> 'answer', 'crane', 'everyone sees the answer once it ends');
select is(public.get_match('00000000-0000-0000-0000-0000000000d1') -> 'players' -> 0 ->> 'name', 'Host', 'the winner is listed first');
select is(
  (select p -> 'rows' -> 0 ->> 'word' from jsonb_array_elements(public.get_match('00000000-0000-0000-0000-0000000000d1') -> 'players') p where p ->> 'name' = 'Host'),
  'crane',
  'words are revealed after the duel'
);

-- ---- Time limit
reset role;
insert into public.matches (id, kind, status, answer, created_by, starts_at, ends_at) values
  ('00000000-0000-0000-0000-0000000000d2', 'duel', 'active', 'crane', '00000000-0000-0000-0000-00000000000a', now() - interval '6 minutes', now() - interval '1 minute');
insert into public.match_players (match_id, user_id) values
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-00000000000a');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select throws_ok($$ select public.submit_guess('00000000-0000-0000-0000-0000000000d2', 'crane') $$, 'P0001', 'The duel is over', 'no guesses after time runs out');
select is(public.get_match('00000000-0000-0000-0000-0000000000d2') ->> 'status', 'finished', 'a timed-out duel reads as finished');

select * from finish();
rollback;
