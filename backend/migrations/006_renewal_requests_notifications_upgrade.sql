-- Renewal requests workflow + notifications lifecycle improvements.
-- Safe to run multiple times on PostgreSQL.

CREATE TABLE IF NOT EXISTS renewal_requests (
  id UUID PRIMARY KEY,
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_renewal_requests_contract_id ON renewal_requests(contract_id);
CREATE INDEX IF NOT EXISTS ix_renewal_requests_client_id ON renewal_requests(client_id);
CREATE INDEX IF NOT EXISTS ix_renewal_requests_status ON renewal_requests(status);

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS source_key VARCHAR(200) NULL;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS action_url VARCHAR(500) NULL;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

CREATE INDEX IF NOT EXISTS ix_notifications_source_key ON notifications(source_key);
CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_user_type_source
  ON notifications(user_id, type, source_key)
  WHERE source_key IS NOT NULL;
