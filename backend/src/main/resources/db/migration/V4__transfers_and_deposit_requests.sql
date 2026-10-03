-- V4__transfers_and_deposit_requests.sql
-- Fund Transfers with idempotency + Deposit Request (maker-checker) tables

-- ─────────────────────────────────────────────
-- 1. TRANSFERS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transfers (
    id                BIGSERIAL PRIMARY KEY,
    idempotency_key   VARCHAR(36)    NOT NULL,
    reference_no      VARCHAR(30)    NOT NULL UNIQUE,
    from_account_id   BIGINT         NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    to_account_id     BIGINT         NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    amount            NUMERIC(15,2)  NOT NULL,
    remarks           VARCHAR(255),
    status            VARCHAR(20)    NOT NULL DEFAULT 'SUCCESS',   -- SUCCESS | FAILED
    failure_reason    TEXT,
    created_at        TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    version           BIGINT         NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_transfers_idempotency
    ON transfers(idempotency_key);

CREATE INDEX IF NOT EXISTS idx_transfers_from_account
    ON transfers(from_account_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_transfers_to_account
    ON transfers(to_account_id, created_at DESC);

-- ─────────────────────────────────────────────
-- 2. DEPOSIT REQUESTS (maker-checker)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS deposit_requests (
    id                  BIGSERIAL PRIMARY KEY,
    reference_no        VARCHAR(30)    NOT NULL UNIQUE,
    account_id          BIGINT         NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    customer_id         BIGINT         NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    amount              NUMERIC(15,2)  NOT NULL,
    mode                VARCHAR(20)    NOT NULL DEFAULT 'CASH',  -- CASH | CHEQUE | ONLINE | NEFT | RTGS
    payment_reference   VARCHAR(100),
    remarks             VARCHAR(255),
    status              VARCHAR(20)    NOT NULL DEFAULT 'PENDING', -- PENDING | APPROVED | REJECTED | CANCELLED
    requested_by_admin  VARCHAR(100),   -- NULL = customer request; non-null = admin created it
    requested_at        TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_by         VARCHAR(100),
    reviewed_at         TIMESTAMP,
    review_remarks      TEXT,
    flagged_large       BOOLEAN        NOT NULL DEFAULT FALSE,
    version             BIGINT         NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_deposit_requests_account
    ON deposit_requests(account_id);

CREATE INDEX IF NOT EXISTS idx_deposit_requests_customer
    ON deposit_requests(customer_id);

CREATE INDEX IF NOT EXISTS idx_deposit_requests_status
    ON deposit_requests(status, requested_at DESC);

-- ─────────────────────────────────────────────
-- 3. LEDGER INTEGRITY FOR LINKED TRANSFERS
-- Drop reference_id uniqueness so debit & credit legs share the same reference_no
-- ─────────────────────────────────────────────
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_reference_id_key;
CREATE INDEX IF NOT EXISTS idx_transactions_reference_id ON transactions(reference_id);
