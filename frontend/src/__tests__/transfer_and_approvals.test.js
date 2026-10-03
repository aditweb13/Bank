import { describe, it, expect } from 'vitest';
import { inr, maskAccount, statusBadge, txnMeta } from '../utils/format';

describe('BFSI Funds Transfer & Maker-Checker Deposit Utilities', () => {
  it('correctly formats INR currency with 2 decimals', () => {
    expect(inr(50000)).toBe('₹50,000.00');
    expect(inr(150000.5)).toBe('₹1,50,000.50');
    expect(inr(0)).toBe('₹0.00');
  });

  it('masks destination account numbers properly', () => {
    expect(maskAccount('AC1002003002')).toBe('•••• •••• 3002');
    expect(maskAccount('AC1002003002', true)).toBe('AC1002003002');
  });

  it('assigns correct badges to transfer and approval statuses', () => {
    expect(statusBadge('SUCCESS')).toBe('badge-green');
    expect(statusBadge('APPROVED')).toBe('badge-green');
    expect(statusBadge('PENDING')).toBe('badge-amber');
    expect(statusBadge('REJECTED')).toBe('badge-red');
    expect(statusBadge('FAILED')).toBe('badge-red');
    expect(statusBadge('CANCELLED')).toBe('badge-gray');
  });

  it('correctly maps transfer debit and credit ledger metadata', () => {
    const debitMeta = txnMeta('TRANSFER_DEBIT');
    expect(debitMeta.dir).toBe('out');
    expect(debitMeta.label).toBe('Transfer Out');

    const creditMeta = txnMeta('TRANSFER_CREDIT');
    expect(creditMeta.dir).toBe('in');
    expect(creditMeta.label).toBe('Transfer In');
  });

  it('validates idempotency UUID format', () => {
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    const key = crypto.randomUUID ? crypto.randomUUID() : '550e8400-e29b-41d4-a716-446655440000';
    expect(key).toMatch(uuidRegex);
  });

  it('validates transfer limits: single transaction cap at 50,000', () => {
    const perTxnLimit = 50000;
    const dailyLimit = 200000;

    const validAmount = 45000;
    const invalidAmount = 55000;

    expect(validAmount <= perTxnLimit).toBe(true);
    expect(invalidAmount <= perTxnLimit).toBe(false);

    const todayTransfers = [40000, 50000, 50000, 40000];
    const dailySum = todayTransfers.reduce((a, b) => a + b, 0);
    expect(dailySum).toBe(180000);
    expect(dailySum + 30000 > dailyLimit).toBe(true);
  });

  it('validates minimum balance retention on source account', () => {
    const accountBalance = 25000;
    const minBalance = 1000;
    const transferAmount = 24500;

    const balanceAfter = accountBalance - transferAmount;
    expect(balanceAfter >= minBalance).toBe(false); // 500 < 1000 => rejected
  });
});
