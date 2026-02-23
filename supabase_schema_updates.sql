-- OPTIMIZATION & SECURITY UPDATES

-- 0. CLEANUP DUPLICATES (Critical Fix for 23505 Error)
-- Remove duplicate participants before adding the unique constraint.
-- Keeps the most recent entry (based on joined_at) and removes others.
DELETE FROM public.session_participants
WHERE id IN (
  SELECT id
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (partition BY session_id, student_id ORDER BY joined_at DESC) as rnum
    FROM public.session_participants
  ) t
  WHERE t.rnum > 1
);

-- 1. Add unique constraint to prevent duplicate participants in a session
alter table public.session_participants 
add constraint session_participants_unique_student 
unique (session_id, student_id);

-- 2. Add indexes for performance
create index if not exists profiles_teacher_email_idx on public.profiles(teacher_email);

create index if not exists homework_teacher_id_idx on public.homework_assignments(teacher_id);
create index if not exists homework_student_id_idx on public.homework_assignments(student_id);
create index if not exists homework_status_idx on public.homework_assignments(status);

create index if not exists results_student_id_idx on public.student_results(student_id);

create index if not exists feedback_attempt_id_idx on public.teacher_feedback(attempt_id);
create index if not exists feedback_teacher_id_idx on public.teacher_feedback(teacher_id);

create index if not exists sessions_teacher_id_idx on public.live_classroom_sessions(teacher_id);
create index if not exists sessions_code_idx on public.live_classroom_sessions(session_code);

create index if not exists participants_session_id_idx on public.session_participants(session_id);
create index if not exists participants_student_id_idx on public.session_participants(student_id);

-- 3. Advanced Indexes (GIN)
create index if not exists profiles_completed_stories_idx on public.profiles using gin (completed_stories);
create index if not exists results_details_idx on public.student_results using gin (details);

-- 4. Tighten Security on Profiles
drop policy if exists "Public profiles are viewable by everyone" on public.profiles;
create policy "Authenticated profiles view" 
  on public.profiles for select 
  using ( auth.role() = 'authenticated' );

-- 5. Add Cascade Deletes (Split into separate statements for safety)
alter table public.homework_assignments
drop constraint if exists homework_assignments_student_id_fkey;

alter table public.homework_assignments
add constraint homework_assignments_student_id_fkey
  foreign key (student_id)
  references public.profiles(id)
  on delete cascade;

alter table public.homework_assignments
drop constraint if exists homework_assignments_teacher_id_fkey;

alter table public.homework_assignments
add constraint homework_assignments_teacher_id_fkey
  foreign key (teacher_id)
  references public.profiles(id)
  on delete cascade;
