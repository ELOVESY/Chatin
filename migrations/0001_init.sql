-- Run this in Supabase SQL editor
create extension if not exists pgcrypto;

create table if not exists public.users (
  username text primary key,
  created_at timestamp with time zone default now()
);

create table if not exists public.contacts (
  owner_username text references public.users(username) on delete cascade,
  contact_username text references public.users(username) on delete cascade,
  created_at timestamp with time zone default now(),
  primary key (owner_username, contact_username)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_username text not null references public.users(username) on delete cascade,
  receiver_username text not null references public.users(username) on delete cascade,
  content text not null check (char_length(content) > 0),
  created_at timestamp with time zone default now()
);

create index if not exists messages_receiver_created_at_idx on public.messages (receiver_username, created_at desc);
create index if not exists messages_pair_created_at_idx on public.messages (sender_username, receiver_username, created_at desc);


