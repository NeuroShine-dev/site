-- BlindAid Database Schema
-- Run this in Supabase SQL editor after creating your project

-- Enable necessary extensions
create extension if not exists "uuid-ossp";
create extension if not exists "postgis"; -- For geofencing

-- ─── Profiles ────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id               uuid primary key default uuid_generate_v4(),
  auth_user_id     uuid references auth.users(id) on delete cascade,
  name             text not null,
  role             text not null default 'blind_user' check (role in ('blind_user', 'guardian')),
  language         text not null default 'en' check (language in ('en', 'es', 'hi')),
  speech_speed     text not null default 'normal' check (speech_speed in ('slow', 'normal', 'fast')),
  speech_gender    text not null default 'female' check (speech_gender in ('male', 'female')),
  device_tier      int  not null default 1 check (device_tier in (1, 2, 3)),
  onboarding_complete boolean not null default false,
  emergency_contacts  jsonb not null default '[]'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view and update their own profile"
  on public.profiles for all
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

-- ─── Location Broadcasts ─────────────────────────────────────────────────────
create table if not exists public.location_broadcasts (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  latitude   float8 not null,
  longitude  float8 not null,
  updated_at timestamptz not null default now()
);

alter table public.location_broadcasts enable row level security;

create policy "Owner can write location"
  on public.location_broadcasts for all
  using (user_id in (select id from public.profiles where auth_user_id = auth.uid()));

create policy "Guardians can read linked user location"
  on public.location_broadcasts for select
  using (
    user_id in (
      select blind_user_id from public.guardian_links
      where guardian_id in (
        select id from public.profiles where auth_user_id = auth.uid()
      )
      and status = 'active'
    )
  );

-- ─── Emergency Events ─────────────────────────────────────────────────────────
create table if not exists public.emergency_events (
  id             uuid primary key default uuid_generate_v4(),
  user_id        uuid references public.profiles(id) on delete cascade,
  triggered_at   timestamptz not null default now(),
  trigger        text not null,
  latitude       float8,
  longitude      float8,
  resolved_at    timestamptz,
  resolved_by    text check (resolved_by in ('user', 'guardian'))
);

alter table public.emergency_events enable row level security;

create policy "Users and guardians can access emergency events"
  on public.emergency_events for all
  using (
    user_id in (select id from public.profiles where auth_user_id = auth.uid())
    or
    user_id in (
      select blind_user_id from public.guardian_links
      where guardian_id in (
        select id from public.profiles where auth_user_id = auth.uid()
      )
    )
  );

-- ─── Guardian Links ───────────────────────────────────────────────────────────
create table if not exists public.guardian_links (
  id              uuid primary key default uuid_generate_v4(),
  blind_user_id   uuid not null references public.profiles(id) on delete cascade,
  guardian_id     uuid references public.profiles(id) on delete cascade,
  guardian_phone  text,
  status          text not null default 'pending' check (status in ('pending', 'active', 'revoked')),
  created_at      timestamptz not null default now()
);

alter table public.guardian_links enable row level security;

create policy "Blind users manage their guardian links"
  on public.guardian_links for all
  using (
    blind_user_id in (select id from public.profiles where auth_user_id = auth.uid())
    or
    guardian_id in (select id from public.profiles where auth_user_id = auth.uid())
  );

-- ─── Safe Zones ───────────────────────────────────────────────────────────────
create table if not exists public.safe_zones (
  id             uuid primary key default uuid_generate_v4(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  name           text not null,
  latitude       float8 not null,
  longitude      float8 not null,
  radius_meters  int not null default 100,
  created_at     timestamptz not null default now()
);

alter table public.safe_zones enable row level security;

create policy "Users and their guardians can access safe zones"
  on public.safe_zones for all
  using (
    user_id in (select id from public.profiles where auth_user_id = auth.uid())
    or
    user_id in (
      select blind_user_id from public.guardian_links
      where guardian_id in (
        select id from public.profiles where auth_user_id = auth.uid()
      )
    )
  );

-- ─── Guardian Messages ────────────────────────────────────────────────────────
create table if not exists public.guardian_messages (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  sender_id  uuid references public.profiles(id),
  message    text not null,
  sent_at    timestamptz not null default now(),
  read_at    timestamptz
);

alter table public.guardian_messages enable row level security;

create policy "Guardian can insert messages for linked users"
  on public.guardian_messages for insert
  with check (
    user_id in (
      select blind_user_id from public.guardian_links
      where guardian_id in (
        select id from public.profiles where auth_user_id = auth.uid()
      )
      and status = 'active'
    )
  );

create policy "Users can read messages sent to them"
  on public.guardian_messages for select
  using (
    user_id in (select id from public.profiles where auth_user_id = auth.uid())
  );

-- Enable realtime on key tables
alter publication supabase_realtime add table public.location_broadcasts;
alter publication supabase_realtime add table public.emergency_events;
alter publication supabase_realtime add table public.guardian_messages;
