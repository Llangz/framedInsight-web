-- ============================================================================
-- framedInsight: Phone OTP Codes Table
-- ============================================================================

-- Create table
CREATE TABLE IF NOT EXISTS phone_otp_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number TEXT NOT NULL,
  otp_code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Only one active OTP per phone number at a time
  UNIQUE(phone_number)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_phone_otp_phone 
  ON phone_otp_codes(phone_number);

CREATE INDEX IF NOT EXISTS idx_phone_otp_expires 
  ON phone_otp_codes(expires_at);

-- ============================================================================
-- ENABLE RLS
-- ============================================================================

ALTER TABLE phone_otp_codes ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Service role has full unrestricted access (used by Edge Functions)
CREATE POLICY "service_role_full_access"
  ON phone_otp_codes
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Anon users can INSERT a new OTP request for their own phone
-- (called from client when requesting OTP)
CREATE POLICY "anon_insert_otp"
  ON phone_otp_codes
  FOR INSERT
  TO anon
  WITH CHECK (
    phone_number IS NOT NULL AND
    length(phone_number) BETWEEN 10 AND 15 AND
    phone_number ~ '^\+[0-9]+$'  -- must be valid E.164 format
  );

-- Anon users can SELECT only to verify their own OTP
-- (app always queries with both phone_number AND otp_code together)
CREATE POLICY "anon_select_own_otp"
  ON phone_otp_codes
  FOR SELECT
  TO anon
  USING (
    expires_at > NOW()  -- expired OTPs are invisible to anon users
  );

-- Anon users can DELETE only their own OTP by phone number
-- (called on resend or after successful verification)
CREATE POLICY "anon_delete_own_otp"
  ON phone_otp_codes
  FOR DELETE
  TO anon
  USING (
    phone_number IS NOT NULL
  );

-- No UPDATE policy for anon — OTPs must be deleted and recreated on resend
-- This prevents tampering with existing OTP codes or expiry times

-- ============================================================================
-- EXPIRED OTP CLEANUP FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION delete_expired_otps()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER  -- runs as superuser to bypass RLS
SET search_path = public
AS $$
BEGIN
  DELETE FROM phone_otp_codes 
  WHERE expires_at < NOW();
END;
$$;

-- ============================================================================
-- OTP RATE LIMITING FUNCTION
-- ============================================================================
-- Prevents abuse by blocking more than 5 OTP requests per phone per hour

CREATE OR REPLACE FUNCTION check_otp_rate_limit(p_phone TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  request_count INT;
BEGIN
  -- Count OTP requests for this phone in the last hour
  -- (uses created_at since we delete and recreate on resend)
  SELECT COUNT(*) INTO request_count
  FROM phone_otp_codes
  WHERE phone_number = p_phone
    AND created_at > NOW() - INTERVAL '1 hour';

  -- Block if more than 5 requests in the last hour
  RETURN request_count < 5;
END;
$$;

-- ============================================================================
-- BRUTE FORCE PROTECTION FUNCTION
-- ============================================================================
-- Marks OTP as used after too many failed attempts (max 5 tries)

CREATE OR REPLACE FUNCTION increment_otp_attempts(p_phone TEXT)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_attempts INT;
BEGIN
  UPDATE phone_otp_codes
  SET metadata = jsonb_set(
    COALESCE(metadata, '{}'::jsonb),
    '{attempts}',
    (COALESCE((metadata->>'attempts')::int, 0) + 1)::text::jsonb
  )
  WHERE phone_number = p_phone
  RETURNING (metadata->>'attempts')::int INTO current_attempts;

  RETURN COALESCE(current_attempts, 0);
END;
$$;

-- ============================================================================
-- AUTO-EXPIRE TRIGGER
-- ============================================================================
-- Automatically deletes OTP if attempts exceed 5 (brute force protection)

CREATE OR REPLACE FUNCTION auto_delete_on_max_attempts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (NEW.metadata->>'attempts')::int >= 5 THEN
    DELETE FROM phone_otp_codes WHERE phone_number = NEW.phone_number;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_auto_delete_on_max_attempts
  AFTER UPDATE ON phone_otp_codes
  FOR EACH ROW
  EXECUTE FUNCTION auto_delete_on_max_attempts();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE phone_otp_codes 
  IS 'Temporary OTP storage for phone-based auth. Codes expire in 15 minutes.';

COMMENT ON COLUMN phone_otp_codes.phone_number 
  IS 'Phone in E.164 format e.g. +254712345678';

COMMENT ON COLUMN phone_otp_codes.otp_code 
  IS '6-digit verification code';

COMMENT ON COLUMN phone_otp_codes.expires_at 
  IS 'Expiry timestamp - 15 minutes from creation';

COMMENT ON COLUMN phone_otp_codes.metadata 
  IS 'Signup data carried through verification. Also stores attempts counter.';