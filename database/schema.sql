-- Anime Hub Bangla PostgreSQL starter schema
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'USER' CHECK (role IN
   ('SUPER_ADMIN','ADMIN','CONTENT_MANAGER','ADVERTISEMENT_MANAGER','COLLABORATION_MANAGER','MODERATOR','ANALYST','USER')),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','SUSPENDED','PENDING')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS anime (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  original_title TEXT,
  synopsis TEXT,
  poster_url TEXT,
  banner_url TEXT,
  release_year INTEGER,
  status TEXT NOT NULL DEFAULT 'UPCOMING' CHECK (status IN ('ONGOING','COMPLETED','UPCOMING','HIATUS')),
  content_type TEXT NOT NULL DEFAULT 'LICENSED' CHECK (content_type IN ('LICENSED','ORIGINAL','PARTNER')),
  genres TEXT[] NOT NULL DEFAULT '{}',
  published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS episodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anime_id UUID NOT NULL REFERENCES anime(id) ON DELETE CASCADE,
  episode_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  synopsis TEXT,
  runtime_seconds INTEGER,
  thumbnail_url TEXT,
  video_provider TEXT,
  provider_video_id TEXT,
  published BOOLEAN NOT NULL DEFAULT false,
  release_at TIMESTAMPTZ,
  UNIQUE(anime_id, episode_number)
);

CREATE TABLE IF NOT EXISTS studios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  logo_url TEXT,
  website_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS episode_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id UUID NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  studio_id UUID REFERENCES studios(id) ON DELETE SET NULL,
  credit_role TEXT NOT NULL,
  person_name TEXT
);

CREATE TABLE IF NOT EXISTS watch_progress (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  episode_id UUID NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  position_seconds INTEGER NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id, episode_id)
);

CREATE TABLE IF NOT EXISTS ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  anime_id UUID NOT NULL REFERENCES anime(id) ON DELETE CASCADE,
  score SMALLINT NOT NULL CHECK(score BETWEEN 1 AND 10),
  review TEXT,
  spoiler BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, anime_id)
);

CREATE TABLE IF NOT EXISTS ad_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  name TEXT NOT NULL,
  placement TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS revenue_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL CHECK(source IN ('ADSTERRA','SPONSOR','PREMIUM','OTHER')),
  external_reference TEXT,
  amount NUMERIC(12,2) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'BDT',
  status TEXT NOT NULL DEFAULT 'PENDING',
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS anime_published_idx ON anime(published, created_at DESC);
CREATE INDEX IF NOT EXISTS episodes_anime_idx ON episodes(anime_id, episode_number);
CREATE INDEX IF NOT EXISTS audit_logs_created_idx ON audit_logs(created_at DESC);


-- User library and premium membership
CREATE TABLE IF NOT EXISTS favorites (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  anime_id UUID NOT NULL REFERENCES anime(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id, anime_id)
);
CREATE TABLE IF NOT EXISTS memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL CHECK(plan IN ('FREE','MONTHLY','YEARLY')),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','ACTIVE','EXPIRED','CANCELLED','FAILED')) ,
  payment_method TEXT CHECK(payment_method IN ('BKASH','NAGAD','ROCKET','SSLCOMMERZ')) ,
  payment_reference TEXT,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS watch_progress_user_updated_idx ON watch_progress(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS memberships_user_created_idx ON memberships(user_id, created_at DESC);


-- Manual payment verification queue. Never trust client-side payment success.
CREATE TABLE IF NOT EXISTS payment_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  membership_id UUID NOT NULL REFERENCES memberships(id) ON DELETE CASCADE,
  plan TEXT NOT NULL CHECK(plan IN ('MONTHLY','YEARLY')),
  payment_method TEXT NOT NULL CHECK(payment_method IN ('BKASH','NAGAD','ROCKET','SSLCOMMERZ')),
  transaction_reference TEXT NOT NULL,
  amount_bdt NUMERIC(12,2) NOT NULL CHECK(amount_bdt > 0),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','APPROVED','REJECTED')),
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  admin_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(payment_method, transaction_reference)
);
CREATE INDEX IF NOT EXISTS payment_submissions_status_idx ON payment_submissions(status, created_at DESC);

-- Revenue, ad reporting and sponsor CRM. Adsterra numbers are imported from its real dashboard/CSV.
ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS ad_code TEXT;
ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS target_url TEXT;
ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS notes TEXT;
CREATE TABLE IF NOT EXISTS ad_metrics_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL CHECK(provider IN ('ADSTERRA','CUSTOM')),
  metric_date DATE NOT NULL,
  placement TEXT NOT NULL DEFAULT 'default',
  impressions BIGINT NOT NULL DEFAULT 0 CHECK(impressions >= 0),
  clicks BIGINT NOT NULL DEFAULT 0 CHECK(clicks >= 0),
  revenue NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK(revenue >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(provider,metric_date,placement)
);
CREATE TABLE IF NOT EXISTS sponsors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  package_name TEXT,
  amount_bdt NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'LEAD' CHECK(status IN ('LEAD','CONTACTED','NEGOTIATION','ACTIVE','COMPLETED','LOST')),
  starts_at DATE,
  ends_at DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS playback_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  anime_id UUID REFERENCES anime(id) ON DELETE SET NULL,
  episode_id UUID REFERENCES episodes(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK(event_type IN ('PLAY','PROGRESS','COMPLETE')),
  watched_seconds INTEGER NOT NULL DEFAULT 0 CHECK(watched_seconds >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ad_metrics_date_idx ON ad_metrics_daily(metric_date DESC);
CREATE INDEX IF NOT EXISTS sponsors_status_idx ON sponsors(status,created_at DESC);
CREATE INDEX IF NOT EXISTS playback_events_created_idx ON playback_events(created_at DESC);


-- Staff, moderation, reviews and user notifications
ALTER TABLE episodes ADD COLUMN IF NOT EXISTS is_premium BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  anime_id UUID NOT NULL REFERENCES anime(id) ON DELETE CASCADE,
  episode_id UUID REFERENCES episodes(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK(char_length(body) BETWEEN 2 AND 2000),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','PUBLISHED','HIDDEN','REMOVED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS comments_anime_status_idx ON comments(anime_id,status,created_at DESC);
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  href TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications(user_id,created_at DESC);
CREATE TABLE IF NOT EXISTS content_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK(char_length(reason) BETWEEN 3 AND 500),
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','RESOLVED','DISMISSED')),
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS content_reports_status_idx ON content_reports(status,created_at DESC);

-- Homepage configuration (also available as additive migration 003).
CREATE TABLE IF NOT EXISTS public.site_settings (
  setting_key TEXT PRIMARY KEY,
  setting_value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.cms_homepage_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_key TEXT NOT NULL UNIQUE,
  title TEXT,
  subtitle TEXT,
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.cms_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link_url TEXT,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Additive tables for the public partner directory and admin audit history.
BEGIN;
CREATE TABLE IF NOT EXISTS public.collaboration_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'OTHER',
  logo_url TEXT,
  cover_url TEXT,
  website_url TEXT,
  facebook_url TEXT,
  youtube_url TEXT,
  instagram_url TEXT,
  other_links JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  is_featured BOOLEAN NOT NULL DEFAULT false,
  is_published BOOLEAN NOT NULL DEFAULT false,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- partner_id is deliberately not a foreign key: delete events must retain the ID.
CREATE TABLE IF NOT EXISTS public.collaboration_partner_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL,
  actor_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMIT;
