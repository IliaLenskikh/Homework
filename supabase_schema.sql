
-- Profiles table (extends auth.users)
create table if not exists profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  full_name text,
  email text,
  teacher_email text,
  role text check (role in ('student', 'teacher')),
  completed_stories text[]
);

-- Enable RLS
alter table profiles enable row level security;

-- Policies for profiles
create policy "Public profiles are viewable by everyone" 
  on profiles for select 
  using ( true );

create policy "Users can insert their own profile" 
  on profiles for insert 
  with check ( auth.uid() = id );

create policy "Users can update own profile" 
  on profiles for update 
  using ( auth.uid() = id );

-- Homework Assignments Table
create table if not exists homework_assignments (
  id uuid default gen_random_uuid() primary key,
  teacher_id uuid references auth.users(id) not null,
  student_id uuid references auth.users(id) not null,
  exercise_title text not null,
  exercise_type text not null,
  due_date timestamp with time zone not null,
  status text check (status in ('pending', 'completed', 'overdue')) default 'pending',
  instructions text,
  created_at timestamp with time zone default now(),
  completed_at timestamp with time zone,
  score int,
  max_score int
);

-- Enable Row Level Security (RLS) for Homework
alter table homework_assignments enable row level security;

-- Policies for Homework
create policy "Teachers can view/insert their assigned homework"
  on homework_assignments for all
  using (auth.uid() = teacher_id);

create policy "Students can view/update their own homework"
  on homework_assignments for all
  using (auth.uid() = student_id);
