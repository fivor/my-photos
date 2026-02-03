-- Login Attempts for Rate Limiting
CREATE TABLE IF NOT EXISTS login_attempts (
    ip TEXT PRIMARY KEY,
    attempts INTEGER DEFAULT 0,
    last_attempt INTEGER,
    blocked_until INTEGER
);

-- Verification Codes for Password Reset
CREATE TABLE IF NOT EXISTS verification_codes (
    email TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    expires_at INTEGER NOT NULL
);

-- Admin Profile (Optional, but useful if we want to move away from Env vars for password)
-- We can store admin_email in `config` table, but password needs to be secure.
-- We will store password hash in `config` as `admin_password_hash` if we want, or use a separate table.
-- Let's stick to `config` table for `admin_email`.
-- For password, we will look for `admin_password` key in `config`. If present, use it. If not, use Env.
