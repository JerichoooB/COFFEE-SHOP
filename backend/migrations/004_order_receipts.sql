CREATE TABLE order_receipts (
 order_id UUID PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
 recipient_email VARCHAR(254) NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sending','sent','failed')),
 attempt_count INTEGER NOT NULL DEFAULT 0 CHECK(attempt_count>=0),
 provider_message_id TEXT,
 last_error_code TEXT,
 sent_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX order_receipts_pending_idx ON order_receipts(status,updated_at);
-- Receipts are queued for new orders only. Historical orders are not emailed unexpectedly.
