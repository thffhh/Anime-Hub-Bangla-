
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Migration tracking
CREATE TABLE IF NOT EXISTS public.schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Existing user profile: additive changes only
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspended_reason TEXT;

-- Anime catalogue improvements
ALTER TABLE public.anime
  ADD COLUMN IF NOT EXISTS content_type TEXT NOT NULL DEFAULT 'LICENSED',
  ADD COLUMN IF NOT EXISTS dub_language TEXT NOT NULL DEFAULT 'Bangla',
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS seo_title TEXT,
  ADD COLUMN IF NOT EXISTS seo_description TEXT;

-- Episode improvements
ALTER TABLE public.episodes
  ADD COLUMN IF NOT EXISTS subtitle_url TEXT,
  ADD COLUMN IF NOT EXISTS dub_language TEXT NOT NULL DEFAULT 'Bangla',
  ADD COLUMN IF NOT EXISTS content_notes TEXT;

-- Membership improvements
ALTER TABLE public.memberships
  ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS provider_subscription_id TEXT;

-- Existing manual payment queue: add gateway tracking fields
ALTER TABLE public.payment_submissions
  ADD COLUMN IF NOT EXISTS provider_order_id TEXT,
  ADD COLUMN IF NOT EXISTS provider_transaction_id TEXT,
  ADD COLUMN IF NOT EXISTS gateway_status TEXT,
  ADD COLUMN IF NOT EXISTS verified_amount_bdt NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS currency CHAR(3) NOT NULL DEFAULT 'BDT',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS payment_provider_order_uidx
  ON public.payment_submissions(provider_order_id)
  WHERE provider_order_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS payment_provider_transaction_uidx
  ON public.payment_submissions(provider_transaction_id)
  WHERE provider_transaction_id IS NOT NULL;

-- Premium plan configuration
CREATE TABLE IF NOT EXISTS public.premium_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  price_bdt NUMERIC(12,2) NOT NULL CHECK (price_bdt >= 0),
  duration_days INTEGER NOT NULL CHECK (duration_days > 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.premium_plans
  (code, name, description, price_bdt, duration_days, features)
VALUES
  ('MONTHLY', 'Monthly Premium', 'Monthly premium membership', 0, 30,
   '["Premium episodes","Ad-free experience"]'::jsonb),
  ('YEARLY', 'Yearly Premium', 'Yearly premium membership', 0, 365,
   '["Premium episodes","Ad-free experience"]'::jsonb)
ON CONFLICT (code) DO NOTHING;

-- Studio profiles
CREATE TABLE IF NOT EXISTS public.studios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  logo_url TEXT,
  website_url TEXT,
  owner_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.studios
  ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS public.studio_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id UUID NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  member_role TEXT NOT NULL DEFAULT 'MEMBER',
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(studio_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.studio_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  studio_name TEXT NOT NULL,
  description TEXT,
  portfolio_url TEXT,
  contact_email TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING',
  reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Collaboration projects
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id UUID REFERENCES public.studios(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  description TEXT,
  project_type TEXT NOT NULL DEFAULT 'DUBBING',
  status TEXT NOT NULL DEFAULT 'PLANNING',
  visibility TEXT NOT NULL DEFAULT 'PRIVATE',
  deadline TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  member_role TEXT NOT NULL DEFAULT 'MEMBER',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.project_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role_applied TEXT NOT NULL,
  message TEXT,
  portfolio_url TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING',
  reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id, role_applied)
);

CREATE TABLE IF NOT EXISTS public.project_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'TODO',
  priority TEXT NOT NULL DEFAULT 'NORMAL',
  due_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.project_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  asset_name TEXT NOT NULL,
  asset_url TEXT NOT NULL,
  asset_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Payment gateway transaction records
CREATE TABLE IF NOT EXISTS public.payment_gateway_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  membership_id UUID REFERENCES public.memberships(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  merchant_order_id TEXT NOT NULL UNIQUE,
  provider_transaction_id TEXT,
  amount_bdt NUMERIC(12,2) NOT NULL CHECK (amount_bdt > 0),
  currency CHAR(3) NOT NULL DEFAULT 'BDT',
  status TEXT NOT NULL DEFAULT 'INITIATED',
  verification_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS gateway_provider_transaction_uidx
  ON public.payment_gateway_transactions(provider, provider_transaction_id)
  WHERE provider_transaction_id IS NOT NULL;

-- Webhook idempotency: prevents processing the same event twice
CREATE TABLE IF NOT EXISTS public.payment_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  event_id TEXT NOT NULL,
  event_type TEXT,
  processing_status TEXT NOT NULL DEFAULT 'RECEIVED',
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  UNIQUE(provider, event_id)
);

-- Payment history / invoices
CREATE TABLE IF NOT EXISTS public.subscription_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  membership_id UUID REFERENCES public.memberships(id) ON DELETE SET NULL,
  transaction_id UUID REFERENCES public.payment_gateway_transactions(id) ON DELETE SET NULL,
  invoice_number TEXT NOT NULL UNIQUE,
  amount_bdt NUMERIC(12,2) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'BDT',
  status TEXT NOT NULL DEFAULT 'PENDING',
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ad placements and delivery events
CREATE TABLE IF NOT EXISTS public.ad_placements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  placement_key TEXT NOT NULL UNIQUE,
  description TEXT,
  provider TEXT NOT NULL DEFAULT 'CUSTOM',
  ad_code TEXT,
  target_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT false,
  allowed_pages JSONB NOT NULL DEFAULT '[]'::jsonb,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ad_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  placement_id UUID REFERENCES public.ad_placements(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  visitor_hash TEXT,
  page_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Notification preferences
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  email_enabled BOOLEAN NOT NULL DEFAULT true,
  in_app_enabled BOOLEAN NOT NULL DEFAULT true,
  release_alerts BOOLEAN NOT NULL DEFAULT true,
  payment_alerts BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Audit trail
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS studio_members_user_idx
  ON public.studio_members(user_id);

CREATE INDEX IF NOT EXISTS studio_applications_status_idx
  ON public.studio_applications(status, created_at DESC);

CREATE INDEX IF NOT EXISTS projects_created_idx
  ON public.projects(created_at DESC);

CREATE INDEX IF NOT EXISTS project_members_user_idx
  ON public.project_members(user_id);

CREATE INDEX IF NOT EXISTS project_applications_status_idx
  ON public.project_applications(status, created_at DESC);

CREATE INDEX IF NOT EXISTS project_tasks_project_idx
  ON public.project_tasks(project_id, status);

CREATE INDEX IF NOT EXISTS gateway_transactions_user_idx
  ON public.payment_gateway_transactions(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS webhook_events_status_idx
  ON public.payment_webhook_events(processing_status, received_at DESC);

CREATE INDEX IF NOT EXISTS ad_events_created_idx
  ON public.ad_events(created_at DESC);

CREATE INDEX IF NOT EXISTS audit_logs_created_idx
  ON public.audit_logs(created_at DESC);

-- Mark migration applied
INSERT INTO public.schema_migrations(version)
VALUES ('002_platform_expansion')
ON CONFLICT (version) DO NOTHING;

COMMIT;
