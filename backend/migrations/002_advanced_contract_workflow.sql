-- Advanced contract workflow migration
-- Run after 001_contract_request_workflow.sql if your database already exists.

-- SQLAlchemy usually stores Enum member names in PostgreSQL, so add uppercase labels.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'contractstatus') THEN
        ALTER TYPE contractstatus ADD VALUE IF NOT EXISTS 'PENDING';
        ALTER TYPE contractstatus ADD VALUE IF NOT EXISTS 'APPROVED';
        ALTER TYPE contractstatus ADD VALUE IF NOT EXISTS 'REJECTED';
    END IF;
END $$;

ALTER TABLE contracts
    ADD COLUMN IF NOT EXISTS approved_by UUID NULL REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP NULL,
    ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP NULL;

UPDATE contracts
SET status = 'PENDING', submitted_at = COALESCE(submitted_at, created_at)
WHERE status = 'DRAFT'
  AND (description ILIKE '%demande%' OR title ILIKE '%demande%');
