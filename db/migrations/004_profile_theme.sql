-- Add theme preference to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS theme VARCHAR(20) NOT NULL DEFAULT 'classic';
