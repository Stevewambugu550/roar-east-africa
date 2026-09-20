-- Roar East Africa backend schema for Supabase
-- This migration creates the isolated tables used by the Roar API.

-- Customers / admin accounts
CREATE TABLE IF NOT EXISTS public.roar_customers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text NOT NULL UNIQUE,
    password_hash text NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    role text NOT NULL DEFAULT 'customer' CHECK (role IN ('customer','admin')),
    email_verified boolean NOT NULL DEFAULT false,
    verification_token_hash text,
    verification_expires_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Safari inquiries / leads
CREATE TABLE IF NOT EXISTS public.roar_leads (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id uuid REFERENCES public.roar_customers(id) ON DELETE SET NULL,
    client_name text NOT NULL CHECK (char_length(client_name) BETWEEN 1 AND 150),
    client_email text NOT NULL CHECK (char_length(client_email) BETWEEN 3 AND 254),
    target_dates text CHECK (char_length(target_dates) <= 200),
    total_guests integer NOT NULL DEFAULT 1 CHECK (total_guests BETWEEN 1 AND 30),
    tier_preference text CHECK (char_length(tier_preference) <= 150),
    primary_objective text CHECK (char_length(primary_objective) <= 200),
    notes text CHECK (char_length(notes) <= 3000),
    terms_accepted boolean NOT NULL DEFAULT false,
    marketing_consent boolean NOT NULL DEFAULT false,
    status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','reviewing','contacted','proposal_sent','won','lost')),
    estimated_value numeric(12,2),
    launch_offer_claimed boolean NOT NULL DEFAULT false,
    launch_offer_percent integer,
    source text NOT NULL DEFAULT 'website',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS roar_leads_customer_idx ON public.roar_leads(customer_id);

-- First-five launch offer claims
CREATE TABLE IF NOT EXISTS public.roar_launch_claims (
    id bigserial PRIMARY KEY,
    lead_id uuid NOT NULL UNIQUE REFERENCES public.roar_leads(id) ON DELETE CASCADE,
    customer_id uuid NOT NULL REFERENCES public.roar_customers(id) ON DELETE CASCADE,
    discount_percent integer NOT NULL DEFAULT 10 CHECK (discount_percent = 10),
    claimed_at timestamptz NOT NULL DEFAULT now()
);

-- Anonymous quiz analytics
CREATE TABLE IF NOT EXISTS public.roar_quiz_results (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    traveler_persona text CHECK (char_length(traveler_persona) <= 80),
    selected_transit text CHECK (char_length(selected_transit) <= 80),
    selected_lodging text CHECK (char_length(selected_lodging) <= 80),
    selected_finale text CHECK (char_length(selected_finale) <= 80),
    selected_travelers text CHECK (char_length(selected_travelers) <= 80),
    selected_season text CHECK (char_length(selected_season) <= 80),
    matched_offer text CHECK (char_length(matched_offer) <= 80),
    source_ip inet,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS; the Edge Function uses the service-role key, so policies are optional.
ALTER TABLE public.roar_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roar_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roar_launch_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roar_quiz_results ENABLE ROW LEVEL SECURITY;
