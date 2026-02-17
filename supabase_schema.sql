
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

-- 3. Student Results Table (History of attempts)
create table if not exists public.student_results (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  student_id uuid references public.profiles(id) not null,
  exercise_title text not null,
  exercise_type text not null,
  score int not null,
  max_score int not null,
  details jsonb -- Stores the detailed Q&A for the attempt
);

-- Enable Security
alter table public.student_results enable row level security;

-- Policies for Results
drop policy if exists "Everyone view results" on public.student_results;
create policy "Everyone view results" 
  on public.student_results for select 
  using ( true );

drop policy if exists "Students insert results" on public.student_results;
create policy "Students insert results" 
  on public.student_results for insert 
  with check ( auth.uid() = student_id );

-- 4. Storage Bucket for Audio (Speaking Tasks)
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
