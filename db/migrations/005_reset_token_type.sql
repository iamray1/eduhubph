-- Distinguish registration setup links from forgot-password reset links.
-- 'registration' = sent after account creation (24hr window to set password)
-- 'reset'        = sent from forgot-password flow (1hr window)
ALTER TABLE password_reset_tokens
  ADD COLUMN IF NOT EXISTS type VARCHAR(20) NOT NULL DEFAULT 'reset';
