-- ============================================================
-- EduHub PH — Initial PostgreSQL Schema
-- Plain PostgreSQL — no external dependencies
--
-- Run once after setup:
--   psql -U postgres -d eduhub -f db/migrations/001_initial.sql
-- ============================================================

-- ─── USERS ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ─── PASSWORD RESET TOKENS ────────────────────────────────────

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  token      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  used       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── PROFILES ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS profiles (
  id                 UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  first_name         TEXT NOT NULL DEFAULT '',
  last_name          TEXT NOT NULL DEFAULT '',
  middle_name        TEXT,
  has_no_middle_name BOOLEAN DEFAULT FALSE,
  mobile_number      TEXT,
  role               TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','superadmin')),
  is_active          BOOLEAN DEFAULT TRUE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── CATEGORIES ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS categories (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  slug        TEXT UNIQUE NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('resource','opportunity')),
  description TEXT,
  is_active   BOOLEAN DEFAULT TRUE,
  sort_order  INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── SUBJECTS ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS subjects (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  slug        TEXT UNIQUE NOT NULL,
  description TEXT,
  is_active   BOOLEAN DEFAULT TRUE,
  sort_order  INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── TAGS ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tags (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  slug       TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── POSTS ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS posts (
  id               SERIAL PRIMARY KEY,
  title            TEXT NOT NULL,
  slug             TEXT UNIQUE NOT NULL,
  excerpt          TEXT,
  content          TEXT,
  cover_image      TEXT,
  category_id      INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  subject_id       INTEGER REFERENCES subjects(id)   ON DELETE SET NULL,
  author_id        UUID    REFERENCES users(id)       ON DELETE SET NULL,
  type             TEXT NOT NULL CHECK (type IN ('resource','opportunity')),
  status           TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  is_featured      BOOLEAN DEFAULT FALSE,
  published_at     TIMESTAMPTZ,
  meta_title       TEXT,
  meta_description TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_posts_type   ON posts(type);
CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);
CREATE INDEX IF NOT EXISTS idx_posts_slug   ON posts(slug);

-- ─── POST TAGS ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS post_tags (
  post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
  tag_id  INTEGER REFERENCES tags(id)  ON DELETE CASCADE,
  PRIMARY KEY (post_id, tag_id)
);

-- ─── SAVED POSTS ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS saved_posts (
  id         SERIAL PRIMARY KEY,
  user_id    UUID    NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  post_id    INTEGER NOT NULL REFERENCES posts(id)  ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, post_id)
);

-- ─── FEEDBACK ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS feedback (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL,
  subject    TEXT NOT NULL,
  message    TEXT NOT NULL,
  status     TEXT DEFAULT 'unread' CHECK (status IN ('unread','read','archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── STATIC PAGES ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS static_pages (
  id               SERIAL PRIMARY KEY,
  title            TEXT NOT NULL,
  slug             TEXT UNIQUE NOT NULL,
  content          TEXT,
  meta_title       TEXT,
  meta_description TEXT,
  is_published     BOOLEAN DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── ACTIVITY LOGS ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS activity_logs (
  id         SERIAL PRIMARY KEY,
  user_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  user_name  TEXT,
  action     TEXT NOT NULL,
  module     TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── SITE SETTINGS ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS site_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── SEED DATA ───────────────────────────────────────────────

INSERT INTO static_pages (title, slug, content, is_published) VALUES
  ('Privacy Policy', 'privacy',
   E'EduHub PH Privacy Policy\n\nLast updated: 2024\n\n1. Information We Collect\nWe collect information you provide directly to us, such as your name, email address, and usage data when you use our platform.\n\n2. How We Use Your Information\nWe use the information to provide, maintain, and improve our services, send you updates, and communicate with you.\n\n3. Information Sharing\nWe do not sell or share your personal information with third parties except as required by law.\n\n4. Data Security\nWe implement reasonable security measures to protect your information.\n\n5. Contact\nFor privacy concerns, contact us at privacy@eduhubph.tech',
   true),
  ('Terms of Service', 'terms',
   E'EduHub PH Terms of Service\n\nLast updated: 2024\n\n1. Acceptance of Terms\nBy using EduHub PH, you agree to these terms of service.\n\n2. Use of Service\nYou may use EduHub PH for lawful educational purposes only.\n\n3. User Content\nYou retain ownership of content you submit. By submitting, you grant us a license to display it on our platform.\n\n4. Intellectual Property\nEduHub PH content and features are owned by EduHub PH and protected by copyright laws.\n\n5. Termination\nWe reserve the right to terminate accounts that violate these terms.\n\n6. Contact\nFor questions, contact us at legal@eduhubph.tech',
   true)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO site_settings (key, value) VALUES
  ('site_name',         'EduHub PH'),
  ('site_tagline',      'Your go-to resource hub for Filipino students'),
  ('contact_email',     'hello@eduhubph.tech'),
  ('facebook_url',      ''),
  ('twitter_url',       ''),
  ('instagram_url',     ''),
  ('buy_me_coffee_url', 'https://buymeacoffee.com/raidev'),
  ('maintenance_mode',  'false')
ON CONFLICT (key) DO NOTHING;

INSERT INTO categories (name, slug, type, is_active, sort_order) VALUES
  ('Reviewers',           'reviewer',            'resource',    true, 1),
  ('Modules',             'module',              'resource',    true, 2),
  ('Study Guides',        'study-guide',         'resource',    true, 3),
  ('Scholarships',        'scholarship',         'opportunity', true, 1),
  ('Scholarship Guides',  'scholarship-guide',   'opportunity', true, 2),
  ('College Application', 'college-application', 'opportunity', true, 3),
  ('Announcements',       'announcement',        'opportunity', true, 4)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO subjects (name, slug, is_active, sort_order) VALUES
  ('Mathematics', 'math',    true, 1),
  ('Science',     'science', true, 2),
  ('English',     'english', true, 3),
  ('Filipino',    'filipino',true, 4),
  ('History',     'history', true, 5),
  ('General',     'general', true, 6)
ON CONFLICT (slug) DO NOTHING;
