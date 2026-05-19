-- Smart CMS contract request workflow migration
-- Run this on an existing PostgreSQL database before restarting the backend.

ALTER TABLE client_profiles
    ADD COLUMN IF NOT EXISTS company_ice VARCHAR(100),
    ADD COLUMN IF NOT EXISTS company_rc VARCHAR(100),
    ADD COLUMN IF NOT EXISTS company_address TEXT,
    ADD COLUMN IF NOT EXISTS company_activity VARCHAR(200),
    ADD COLUMN IF NOT EXISTS company_email VARCHAR(255),
    ADD COLUMN IF NOT EXISTS company_phone VARCHAR(50);

ALTER TABLE contracts
    ADD COLUMN IF NOT EXISTS contract_type VARCHAR(100),
    ADD COLUMN IF NOT EXISTS duration_months BIGINT,
    ADD COLUMN IF NOT EXISTS price DOUBLE PRECISION NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS pdf_path VARCHAR(500),
    ADD COLUMN IF NOT EXISTS word_path VARCHAR(500);

UPDATE contracts
SET price = value
WHERE price = 0 AND value IS NOT NULL;
