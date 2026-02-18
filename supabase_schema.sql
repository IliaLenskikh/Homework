
-- 1. Profiles Table (Public User Data)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  email text,
  full_name text,
  teacher_email text,
  role text check (role in ('student', 'teacher')),
  completed_stories text[],
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Security
alter table public.profiles enable row level security;

-- Policies for Profiles
drop policy if exists "Public profiles are viewable by everyone" on public.profiles;
create policy "Public profiles are viewable by everyone" 
  on public.profiles for select 
  using ( true );

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile" 
  on public.profiles for insert 
  with check ( auth.uid() = id );

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" 
  on public.profiles for update 
  using ( auth.uid() = id );

-- 2. Homework Assignments Table
create table if not exists public.homework_assignments (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  teacher_id uuid references public.profiles(id) not null,
  student_id uuid references public.profiles(id) not null,
  exercise_title text not null,
  exercise_type text not null,
  due_date timestamp with time zone,
  status text default 'pending' check (status in ('pending', 'completed', 'overdue')),
  instructions text,
  score int,
  max_score int,
  completed_at timestamp with time zone
);

-- Enable Security
alter table public.homework_assignments enable row level security;

-- Policies for Homework
drop policy if exists "Teachers view assigned homework" on public.homework_assignments;
create policy "Teachers view assigned homework" 
  on public.homework_assignments for select 
  using ( auth.uid() = teacher_id );

drop policy if exists "Students view own homework" on public.homework_assignments;
create policy "Students view own homework" 
  on public.homework_assignments for select 
  using ( auth.uid() = student_id );

drop policy if exists "Teachers insert homework" on public.homework_assignments;
create policy "Teachers insert homework" 
  on public.homework_assignments for insert 
  with check ( auth.uid() = teacher_id );

drop policy if exists "Students update own homework" on public.homework_assignments;
create policy "Students update own homework" 
  on public.homework_assignments for update 
  using ( auth.uid() = student_id );

drop policy if exists "Teachers update homework" on public.homework_assignments;
create policy "Teachers update homework" 
  on public.homework_assignments for update 
  using ( auth.uid() = teacher_id );

-- 3. Student Results Table (History of attempts)
create table if not exists public.student_results (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  student_id uuid references public.profiles(id) not null,
  exercise_title text not null,
  exercise_type text not null,
  score int,
  max_score int,
  details jsonb -- Stores the detailed Q&A for the attempt
);

-- Enable Security
alter table public.student_results enable row level security;

-- Policies for Results
drop policy if exists "View Results Policy" on public.student_results;
create policy "View Results Policy" 
  on public.student_results for select 
  using ( 
    -- Student sees their own
    auth.uid() = student_id 
    OR 
    -- Teacher sees their students' results (based on profile linkage)
    exists (
      select 1 from public.profiles student_prof
      where student_prof.id = student_results.student_id
      and student_prof.teacher_email = (select email from public.profiles where id = auth.uid())
    )
  );

drop policy if exists "Students insert results" on public.student_results;
create policy "Students insert results" 
  on public.student_results for insert 
  with check ( auth.uid() = student_id );

-- 4. Teacher Feedback Table (NEW)
create table if not exists public.teacher_feedback (
  id uuid default gen_random_uuid() primary key,
  attempt_id uuid references public.student_results(id) on delete cascade not null,
  teacher_id uuid references public.profiles(id) not null,
  feedback_text text,
  audio_score int,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.teacher_feedback enable row level security;

drop policy if exists "Feedback Access Policy" on public.teacher_feedback;
create policy "Feedback Access Policy"
  on public.teacher_feedback for all
  using (
    -- Teachers can manage their own feedback
    auth.uid() = teacher_id
    OR
    -- Students can view feedback on their attempts
    exists (
      select 1 from public.student_results sr
      where sr.id = teacher_feedback.attempt_id
      and sr.student_id = auth.uid()
    )
  );

-- 5. Storage Bucket for Audio (Speaking Tasks)
insert into storage.buckets (id, name, public) 
values ('audio-responses', 'audio-responses', true)
on conflict (id) do nothing;

-- Storage Policies
drop policy if exists "Public Access to Audio" on storage.objects;
create policy "Public Access to Audio" 
  on storage.objects for select 
  using ( bucket_id = 'audio-responses' );

drop policy if exists "Authenticated Users Upload Audio" on storage.objects;
create policy "Authenticated Users Upload Audio" 
  on storage.objects for insert 
  with check ( bucket_id = 'audio-responses' and auth.role() = 'authenticated' );

-- 6. Live Classroom Sessions
create table if not exists public.live_classroom_sessions (
  id uuid default gen_random_uuid() primary key,
  teacher_id uuid references public.profiles(id) not null,
  session_code text unique not null,
  title text not null,
  status text check (status in ('waiting', 'active', 'ended')) default 'waiting',
  current_exercise_title text,
  current_exercise_type text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  started_at timestamp with time zone,
  ended_at timestamp with time zone
);

alter table public.live_classroom_sessions enable row level security;

-- Policies for Sessions
drop policy if exists "Teachers can manage their sessions" on public.live_classroom_sessions;
create policy "Teachers can manage their sessions"
  on public.live_classroom_sessions
  for all
  using ( auth.uid() = teacher_id );

drop policy if exists "Students can view active sessions" on public.live_classroom_sessions;
create policy "Students can view active sessions"
  on public.live_classroom_sessions
  for select
  using ( status IN ('waiting', 'active') );

-- 7. Session Participants
create table if not exists public.session_participants (
  id uuid default gen_random_uuid() primary key,
  session_id uuid references public.live_classroom_sessions(id) on delete cascade not null,
  student_id uuid references public.profiles(id) not null,
  joined_at timestamp with time zone default timezone('utc'::text, now()) not null,
  status text check (status in ('connected', 'disconnected')) default 'connected'
);

alter table public.session_participants enable row level security;

-- Policies for Participants
drop policy if exists "Participants viewable by everyone in session" on public.session_participants;
create policy "Participants viewable by everyone in session"
  on public.session_participants
  for select
  using ( true );

drop policy if exists "Students can join sessions" on public.session_participants;
create policy "Students can join sessions"
  on public.session_participants
  for insert
  with check ( auth.uid() = student_id );
