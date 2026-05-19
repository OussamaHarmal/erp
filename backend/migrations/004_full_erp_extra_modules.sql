-- Full ERP upgrade: audit, notifications, Sage history, document versioning, invoice Sage state.
-- Safe to run multiple times on PostgreSQL.

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY,
  actor_id UUID NULL REFERENCES users(id),
  action VARCHAR(120) NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id UUID NULL,
  description TEXT NULL,
  meta JSON NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS ix_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS ix_audit_logs_entity_type ON audit_logs(entity_type);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY,
  user_id UUID NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(40) DEFAULT 'SYSTEM',
  title VARCHAR(180) NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS ix_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS ix_notifications_created_at ON notifications(created_at);

CREATE TABLE IF NOT EXISTS sage_export_batches (
  id UUID PRIMARY KEY,
  exported_by UUID NULL REFERENCES users(id),
  period_start TIMESTAMP NULL,
  period_end TIMESTAMP NULL,
  invoice_count INTEGER DEFAULT 0,
  total_amount DOUBLE PRECISION DEFAULT 0,
  filename VARCHAR(255) NOT NULL,
  export_type VARCHAR(30) DEFAULT 'txt',
  status VARCHAR(30) DEFAULT 'generated',
  errors JSON NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_sage_export_batches_created_at ON sage_export_batches(created_at);

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_method VARCHAR(40) NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS amount_paid DOUBLE PRECISION DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS remaining_amount DOUBLE PRECISION DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS exported_to_sage BOOLEAN DEFAULT FALSE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sage_exported_at TIMESTAMP NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sage_export_batch_id UUID NULL;
CREATE INDEX IF NOT EXISTS ix_invoices_exported_to_sage ON invoices(exported_to_sage);
CREATE INDEX IF NOT EXISTS ix_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS ix_invoices_due_date ON invoices(due_date);

ALTER TABLE contracts ADD COLUMN IF NOT EXISTS signed_at TIMESTAMP NULL;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS renewal_parent_id UUID NULL;
CREATE INDEX IF NOT EXISTS ix_contracts_status ON contracts(status);
CREATE INDEX IF NOT EXISTS ix_contracts_end_date ON contracts(end_date);

ALTER TABLE documents ADD COLUMN IF NOT EXISTS category VARCHAR(80) DEFAULT 'general';
ALTER TABLE documents ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS ix_documents_owner_id ON documents(owner_id);
CREATE INDEX IF NOT EXISTS ix_documents_category ON documents(category);
