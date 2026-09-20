-- Roar East Africa Supabase-native schema
-- Uses Supabase Auth for accounts and Row Level Security for data protection.

-- Customer profiles mirror auth.users
CREATE TABLE IF NOT EXISTS public.roar_customers (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email text NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    role text NOT NULL DEFAULT 'customer' CHECK (role IN ('customer','admin')),
    created_at timestamptz NOT NULL DEFAULT now()
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
CREATE INDEX IF NOT EXISTS roar_leads_created_idx ON public.roar_leads(created_at DESC);

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
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Function to auto-create a customer profile when Supabase Auth signs a user up
CREATE OR REPLACE FUNCTION public.handle_new_roar_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.roar_customers (id, email, first_name, last_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
        'customer'
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_roar_user();

-- Public promotion status RPC
CREATE OR REPLACE FUNCTION public.roar_promotion_status()
RETURNS json AS $$
DECLARE
    claimed_count integer;
BEGIN
    SELECT COUNT(*)::int INTO claimed_count FROM public.roar_launch_claims;
    RETURN json_build_object(
        'total', 5,
        'claimed', claimed_count,
        'remaining', GREATEST(0, 5 - claimed_count),
        'discountPercent', 10
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.roar_promotion_status() TO anon;
GRANT EXECUTE ON FUNCTION public.roar_promotion_status() TO authenticated;

-- Enable RLS
ALTER TABLE public.roar_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roar_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roar_launch_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roar_quiz_results ENABLE ROW LEVEL SECURITY;

-- Drop any old policies before recreating
DROP POLICY IF EXISTS roar_customers_own ON public.roar_customers;
DROP POLICY IF EXISTS roar_customers_admin ON public.roar_customers;
DROP POLICY IF EXISTS roar_leads_insert_own ON public.roar_leads;
DROP POLICY IF EXISTS roar_leads_select_own ON public.roar_leads;
DROP POLICY IF EXISTS roar_leads_admin_all ON public.roar_leads;
DROP POLICY IF EXISTS roar_leads_admin_update ON public.roar_leads;
DROP POLICY IF EXISTS roar_quiz_public_insert ON public.roar_quiz_results;
DROP POLICY IF EXISTS roar_quiz_admin_select ON public.roar_quiz_results;
DROP POLICY IF EXISTS roar_claims_admin_select ON public.roar_launch_claims;

-- Helper: is the current user a Roar admin?
CREATE OR REPLACE FUNCTION public.is_roar_admin()
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.roar_customers
        WHERE id = auth.uid() AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.is_roar_admin() TO authenticated;

-- Policies
CREATE POLICY roar_customers_own ON public.roar_customers
    FOR SELECT TO authenticated
    USING (id = auth.uid());

CREATE POLICY roar_customers_admin ON public.roar_customers
    FOR ALL TO authenticated
    USING (public.is_roar_admin())
    WITH CHECK (public.is_roar_admin());

CREATE POLICY roar_leads_insert_own ON public.roar_leads
    FOR INSERT TO authenticated
    WITH CHECK (customer_id = auth.uid());

CREATE POLICY roar_leads_select_own ON public.roar_leads
    FOR SELECT TO authenticated
    USING (customer_id = auth.uid() OR public.is_roar_admin());

CREATE POLICY roar_leads_admin_update ON public.roar_leads
    FOR UPDATE TO authenticated
    USING (public.is_roar_admin())
    WITH CHECK (public.is_roar_admin());

CREATE POLICY roar_quiz_public_insert ON public.roar_quiz_results
    FOR INSERT TO anon, authenticated
    WITH CHECK (true);

CREATE POLICY roar_quiz_admin_select ON public.roar_quiz_results
    FOR SELECT TO authenticated
    USING (public.is_roar_admin());

CREATE POLICY roar_claims_admin_select ON public.roar_launch_claims
    FOR SELECT TO authenticated
    USING (public.is_roar_admin());

-- Allow the Supabase service role / triggers full access is implicit for service role.
