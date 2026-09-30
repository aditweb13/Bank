-- V3__loan_installments_and_repayment.sql
-- Complete EMI Schedule, Installments, and Repayment Management

CREATE TABLE IF NOT EXISTS loan_installments (
    id BIGSERIAL PRIMARY KEY,
    loan_id BIGINT NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
    installment_no INT NOT NULL,
    due_date DATE NOT NULL,
    opening_balance NUMERIC(15,2) NOT NULL,
    emi_amount NUMERIC(15,2) NOT NULL,
    principal_component NUMERIC(15,2) NOT NULL,
    interest_component NUMERIC(15,2) NOT NULL,
    closing_balance NUMERIC(15,2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    paid_amount NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    paid_date TIMESTAMP NULL,
    penalty_amount NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT uq_loan_installment UNIQUE (loan_id, installment_no)
);

CREATE INDEX IF NOT EXISTS idx_loan_installments_loan ON loan_installments(loan_id);
CREATE INDEX IF NOT EXISTS idx_loan_installments_status_due ON loan_installments(status, due_date);

-- Enhance loans table
ALTER TABLE loans ADD COLUMN IF NOT EXISTS outstanding_principal NUMERIC(15,2);
ALTER TABLE loans ADD COLUMN IF NOT EXISTS version BIGINT DEFAULT 0;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS auto_debit BOOLEAN DEFAULT FALSE;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS auto_debit_account_id BIGINT REFERENCES accounts(id);
ALTER TABLE loans ADD COLUMN IF NOT EXISTS foreclosure_date TIMESTAMP;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS foreclosure_amount NUMERIC(15,2);

-- Backfill outstanding_principal for existing loans
UPDATE loans SET outstanding_principal = principal WHERE outstanding_principal IS NULL;
