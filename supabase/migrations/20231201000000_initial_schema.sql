-- Create tables
create table if not exists document_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists document_templates (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references document_categories(id),
  name text not null,
  template_file_url text,
  field_definitions jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists document_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  template_id uuid references document_templates(id),
  status text default 'pending',
  original_file_url text,
  extracted_data jsonb,
  ocr_text text,
  validation_errors jsonb,
  delivery_timeline text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists profiles (
  id uuid references auth.users(id) primary key,
  full_name text,
  avatar_url text,
  updated_at timestamp with time zone
);

create table if not exists user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  role text not null check (role in ('admin', 'moderator', 'user')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table document_categories enable row level security;
alter table document_templates enable row level security;
alter table document_requests enable row level security;
alter table profiles enable row level security;
alter table user_roles enable row level security;
