-- VishKill Database Schema
-- Run this in your Supabase SQL editor

-- Users table (extends Supabase auth.users)
create table if not exists public.users (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  created_at timestamptz not null default now()
);

-- Calls table
create table if not exists public.calls (
  id           uuid primary key default gen_random_uuid(),
  phone_number text not null,
  user_id      uuid references public.users(id) on delete set null,
  start_time   timestamptz not null default now(),
  end_time     timestamptz,
  risk_score   integer not null default 0 check (risk_score >= 0 and risk_score <= 100),
  status       text not null default 'safe' check (status in ('safe', 'suspicious', 'scam')),
  created_at   timestamptz not null default now()
);

-- Call transcripts table
create table if not exists public.call_transcripts (
  id        uuid primary key default gen_random_uuid(),
  call_id   uuid not null references public.calls(id) on delete cascade,
  text      text not null,
  translated_text text,
  detected_language text not null default 'unknown' check (detected_language in ('english', 'telugu', 'unknown')),
  timestamp timestamptz not null default now(),
  emotion   text not null default 'neutral' check (emotion in ('neutral', 'urgency', 'fear', 'pressure', 'aggression'))
);

-- Scam reports table
create table if not exists public.scam_reports (
  id            uuid primary key default gen_random_uuid(),
  phone_number  text not null unique,
  report_count  integer not null default 1,
  last_reported timestamptz not null default now()
);

-- Trusted contacts table
create table if not exists public.trusted_contacts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id) on delete cascade,
  phone_number text not null,
  name         text not null,
  created_at   timestamptz not null default now(),
  unique (user_id, phone_number)
);

-- Indexes
create index if not exists idx_calls_phone      on public.calls(phone_number);
create index if not exists idx_calls_status     on public.calls(status);
create index if not exists idx_transcripts_call on public.call_transcripts(call_id);

-- Row Level Security (RLS)
alter table public.calls            enable row level security;
alter table public.call_transcripts enable row level security;
alter table public.scam_reports     enable row level security;
alter table public.trusted_contacts enable row level security;

-- Public read policies for demo
create policy "Allow anon read calls"   on public.calls            for select using (true);
create policy "Allow anon insert calls" on public.calls            for insert with check (true);
create policy "Allow anon update calls" on public.calls            for update using (true);

create policy "Allow anon read transcripts"   on public.call_transcripts for select using (true);
create policy "Allow anon insert transcripts" on public.call_transcripts for insert with check (true);

create policy "Allow anon read reports"   on public.scam_reports for select using (true);
create policy "Allow anon insert reports" on public.scam_reports for insert with check (true);
create policy "Allow anon update reports" on public.scam_reports for update using (true);
