-- Run with: npm run db:test  (needs the local stack from npm run db:start)
begin;
select plan(30);

-- Two players and two boards with known answers, created as the admin.
insert into auth.users (id, aud, role, email) values
  ('00000000-0000-0000-0000-00000000000a', 'authenticated', 'authenticated', 'alex@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'authenticated', 'authenticated', 'blake@test.local');
insert into public.profiles (id, display_name) values
  ('00000000-0000-0000-0000-00000000000a', 'Alex');
insert into public.matches (id, answer, hard_mode, created_by) values
  ('00000000-0000-0000-0000-0000000000f1', 'crane', false, '00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-0000000000f2', 'crane', true, '00000000-0000-0000-0000-00000000000a');
insert into public.match_players (match_id, user_id) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-00000000000a');

-- ---- scoring matches src/gameLogic.js
select is(public.score_guess('crane', 'crane'), array['correct','correct','correct','correct','correct'], 'all correct');
select is(public.score_guess('nacre', 'crane'), array['almost','almost','almost','almost','correct'], 'wrong spots are almost');
select is(public.score_guess('eerie', 'theme'), array['almost','error','error','error','correct'], 'extra copies are errors');
select is(public.score_guess('label', 'hotel'), array['error','error','error','correct','correct'], 'exact matches take priority');
select is(public.score_guess('geese', 'those'), array['error','error','error','correct','correct'], 'one answer letter marks one copy');
select ok((select count(*) from public.words) > 5000, 'word list is loaded');

-- ---- act as Blake (signed in, no display name yet)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);

select throws_ok($$ select * from public.matches $$, '42501', null, 'players cannot read matches (or answers) directly');
select throws_ok($$ select * from public.guesses $$, '42501', null, 'players cannot read guesses directly');
select throws_ok($$ select public.score_guess('crane', 'crane') $$, '42501', null, 'helper functions are not callable');
select throws_ok($$ select public.join_match('00000000-0000-0000-0000-0000000000f1') $$, 'P0001', 'Choose a display name first', 'a display name is needed to join');
select throws_ok($$ select public.set_display_name('x') $$, 'P0001', null, 'too-short names are rejected');
select throws_ok($$ select public.set_display_name('nazi99') $$, 'P0001', 'Please choose a different name', 'blocked names are rejected');
select is(public.set_display_name('  Blake   B '), 'Blake B', 'names are trimmed and saved');

select is(public.get_match('00000000-0000-0000-0000-0000000000f1') ->> 'joined', 'false', 'not joined before joining');
select is(public.get_match('00000000-0000-0000-0000-0000000000f1') -> 'answer', 'null'::jsonb, 'no answer before playing');
select lives_ok($$ select public.join_match('00000000-0000-0000-0000-0000000000f1') $$, 'joins a board');
select lives_ok($$ select public.join_match('00000000-0000-0000-0000-0000000000f1') $$, 'joining twice is harmless');

select throws_ok($$ select public.submit_guess('00000000-0000-0000-0000-0000000000f1', 'zzzzz') $$, 'P0001', 'Not in word list', 'invalid words are rejected');
select is(
  public.submit_guess('00000000-0000-0000-0000-0000000000f1', 'ABOUT'),
  '{"result":["almost","error","error","error","error"],"finished":false,"solved":false,"match_over":false,"answer":null}'::jsonb,
  'a guess returns only colors'
);
select is(public.get_match('00000000-0000-0000-0000-0000000000f1') -> 'answer', 'null'::jsonb, 'still no answer mid-round');
select is(
  (select jsonb_agg(p -> 'rows') from jsonb_array_elements(public.get_match('00000000-0000-0000-0000-0000000000f1') -> 'players') p
   where not (p ->> 'is_me')::boolean),
  '[null]'::jsonb,
  'other players'' guesses stay hidden mid-round'
);
select is(jsonb_array_length(public.get_match('00000000-0000-0000-0000-0000000000f1') -> 'my_rows'), 1, 'my own rows come back for resuming');

select is(
  public.submit_guess('00000000-0000-0000-0000-0000000000f1', 'crane') ->> 'answer',
  'crane',
  'solving returns the answer'
);
select throws_ok($$ select public.submit_guess('00000000-0000-0000-0000-0000000000f1', 'about') $$, 'P0001', 'You''ve already finished this board', 'no guesses after finishing');
select is(public.get_match('00000000-0000-0000-0000-0000000000f1') ->> 'answer', 'crane', 'the answer shows once finished');
select is(
  public.get_match('00000000-0000-0000-0000-0000000000f1') -> 'players' -> 0 ->> 'name',
  'Blake B',
  'the solver is ranked above a player still playing'
);

-- ---- act as Alex on the hard-mode board
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select lives_ok($$ select public.submit_guess('00000000-0000-0000-0000-0000000000f2', 'trace') $$, 'hard mode: first guess is free');
select throws_ok($$ select public.submit_guess('00000000-0000-0000-0000-0000000000f2', 'about') $$, 'P0001', '2nd letter must be R', 'hard mode: greens must stay');
select throws_ok($$ select public.submit_guess('00000000-0000-0000-0000-0000000000f2', 'grade') $$, 'P0001', 'Guess must contain C', 'hard mode: yellows must be used');

-- ---- creating a board picks an answer on the server
select ok(public.create_match(false) is not null, 'create_match returns a board id');

select * from finish();
rollback;
