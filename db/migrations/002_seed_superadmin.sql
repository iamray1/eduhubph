-- ============================================================
-- EduHub PH — Seed Superadmin Account
--
-- Creates the initial superadmin user so the app is usable
-- immediately after a fresh deploy.
--
-- Password: Admin17  (bcrypt, salt rounds 12)
-- Email:    iamraymondbautista17@gmail.com
--
-- Run AFTER 001_initial.sql:
--   psql -U postgres -d eduhub -f db/migrations/002_seed_superadmin.sql
-- ============================================================

DO $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Only insert if the account doesn't exist yet
  IF NOT EXISTS (
    SELECT 1 FROM users WHERE email = 'iamraymondbautista17@gmail.com'
  ) THEN

    INSERT INTO users (email, password_hash, is_active)
    VALUES (
      'iamraymondbautista17@gmail.com',
      '$2b$12$Wf46z9ep0Uhd627zEWA3EuNZq3vWc.keVsYNymOK7OxUVMaJO8i0W',
      true
    )
    RETURNING id INTO v_user_id;

    INSERT INTO profiles (id, first_name, last_name, role, is_active)
    VALUES (
      v_user_id,
      'Raymond',
      'Bautista',
      'superadmin',
      true
    );

    RAISE NOTICE 'Superadmin created: iamraymondbautista17@gmail.com (id: %)', v_user_id;
  ELSE
    RAISE NOTICE 'Superadmin already exists — skipping.';
  END IF;
END;
$$;
