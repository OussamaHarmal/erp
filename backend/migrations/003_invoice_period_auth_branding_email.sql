-- 003 - Invoice period fields + email/Sage upgrade
-- Run once on an existing PostgreSQL database.

ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS service_start_date TIMESTAMP NULL,
ADD COLUMN IF NOT EXISTS service_end_date TIMESTAMP NULL,
ADD COLUMN IF NOT EXISTS duration_months BIGINT NULL;

-- Backfill invoices linked to contracts so old records can display a period.
UPDATE invoices i
SET service_start_date = c.start_date,
    service_end_date = c.end_date,
    duration_months = c.duration_months
FROM contracts c
WHERE i.contract_id = c.id
  AND i.service_start_date IS NULL;
