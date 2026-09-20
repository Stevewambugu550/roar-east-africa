create table if not exists public.roar_customers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  first_name text not null,
  last_name text not null,
  role text not null default 'customer' check (role in ('customer','admin')),
  email_verified boolean not null default false,
  verification_token_hash text,
  verification_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.roar_leads (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.roar_customers(id) on delete set null,
  client_name text not null check (char_length(client_name) between 1 and 150),
  client_email text not null check (char_length(client_email) between 3 and 254),
  target_dates text check (char_length(target_dates) <= 200),
  total_guests integer not null default 1 check (total_guests between 1 and 30),
  tier_preference text check (char_length(tier_preference) <= 150),
  primary_objective text check (char_length(primary_objective) <= 200),
  notes text check (char_length(notes) <= 3000),
  terms_accepted boolean not null default false,
  marketing_consent boolean not null default false,
  status text not null default 'new' check (status in ('new','reviewing','contacted','proposal_sent','won','lost')),
  estimated_value numeric(12,2),
  source text not null default 'website',
  launch_offer_claimed boolean not null default false,
  launch_offer_percent integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.roar_launch_claims (
  id bigserial primary key,
  lead_id uuid not null unique references public.roar_leads(id) on delete cascade,
  customer_id uuid not null references public.roar_customers(id) on delete cascade,
  discount_percent integer not null default 10 check (discount_percent = 10),
  claimed_at timestamptz not null default now()
);

create index if not exists roar_leads_created_at_idx on public.roar_leads (created_at desc);
create index if not exists roar_leads_status_idx on public.roar_leads (status);
create index if not exists roar_leads_customer_idx on public.roar_leads (customer_id);

alter table public.roar_customers enable row level security;
alter table public.roar_leads enable row level security;
alter table public.roar_launch_claims enable row level security;
revoke all on table public.roar_customers from anon, authenticated;
revoke all on table public.roar_leads from anon, authenticated;
revoke all on table public.roar_launch_claims from anon, authenticated;
