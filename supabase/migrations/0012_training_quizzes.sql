-- =============================================================================
-- 0012_training_quizzes.sql
-- Onboarding/training completions and quizzes. A quiz can "block the floor":
-- an employee isn't cleared to be scheduled until they pass it
-- (profiles.is_floor_cleared, set by the app when required quizzes pass).
-- =============================================================================

create table public.quizzes (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  description    text,
  pass_threshold smallint not null default 80,   -- percent
  blocks_floor   boolean not null default false, -- must pass before working the floor
  is_active      boolean not null default true,
  created_at     timestamptz not null default now()
);

create table public.quiz_questions (
  id           uuid primary key default gen_random_uuid(),
  quiz_id      uuid not null references public.quizzes(id) on delete cascade,
  prompt       text not null,
  options      jsonb not null,        -- ["opt a", "opt b", "opt c"]
  correct_index smallint not null,     -- index into options (never exposed to takers)
  sort_order   integer not null default 0
);
create index quiz_questions_quiz_idx on public.quiz_questions(quiz_id, sort_order);

create table public.quiz_attempts (
  id         uuid primary key default gen_random_uuid(),
  quiz_id    uuid not null references public.quizzes(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  score      smallint not null,       -- percent
  passed     boolean not null,
  taken_at   timestamptz not null default now()
);
create index quiz_attempts_profile_idx on public.quiz_attempts(profile_id, quiz_id);

-- Completions of any training resource (module / handbook).
create table public.training_completions (
  profile_id   uuid not null references public.profiles(id) on delete cascade,
  resource_id  uuid not null references public.resources(id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (profile_id, resource_id)
);

-- Public view for taking a quiz: prompt + options, WITHOUT the correct answer.
create or replace view public.quiz_questions_public as
  select id, quiz_id, prompt, options, sort_order from public.quiz_questions;
grant select on public.quiz_questions_public to authenticated;

-- ===========================================================================
-- Row-Level Security
-- ===========================================================================
alter table public.quizzes             enable row level security;
alter table public.quiz_questions      enable row level security;
alter table public.quiz_attempts       enable row level security;
alter table public.training_completions enable row level security;

-- quizzes: everyone can see the quiz list; only super admin manages.
create policy "quizzes: read all" on public.quizzes
  for select using (auth.uid() is not null);
create policy "quizzes: admin write" on public.quizzes
  for all using (public.is_super_admin()) with check (public.is_super_admin());

-- questions with answers: managers/admins only (grading is server-side; takers
-- use quiz_questions_public which omits correct_index).
create policy "questions: managers read" on public.quiz_questions
  for select using (public.is_manager_or_admin());
create policy "questions: admin write" on public.quiz_questions
  for all using (public.is_super_admin()) with check (public.is_super_admin());

-- attempts: an employee records/reads their own; managers read in scope.
create policy "attempts: own + managers read" on public.quiz_attempts
  for select using (
    profile_id = auth.uid()
    or public.is_super_admin()
    or (public.is_manager_or_admin() and public.shares_location(profile_id))
  );
create policy "attempts: own insert" on public.quiz_attempts
  for insert with check (profile_id = auth.uid());

-- completions: own + managers read; own insert.
create policy "completions: own + managers read" on public.training_completions
  for select using (
    profile_id = auth.uid()
    or public.is_super_admin()
    or (public.is_manager_or_admin() and public.shares_location(profile_id))
  );
create policy "completions: own insert" on public.training_completions
  for insert with check (profile_id = auth.uid());
