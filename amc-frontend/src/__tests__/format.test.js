import { describe, it, expect } from 'vitest';
import { inr, maskAccount, fmtDate, txnMeta, statusBadge } from '../utils/format';

describe('Banking Format Utilities', () => {
  it('formats currency in Indian Rupees with symbol and decimals', () => {
    const formatted = inr(125000.5);
    expect(formatted).toContain('₹');
    expect(formatted).toContain('1,25,000.50');
  });

  it('formats zero or invalid currency gracefully', () => {
    expect(inr(0)).toContain('0.00');
    expect(inr(null)).toContain('0.00');
    expect(inr(undefined)).toContain('0.00');
  });

  it('masks account number when show is false and reveals when true', () => {
    const acc = 'AC1002003001';
    expect(maskAccount(acc, false)).toBe('•••• •••• 3001');
    expect(maskAccount(acc, true)).toBe('AC1002003001');
    expect(maskAccount(null)).toBe('—');
  });

  it('correctly maps transaction metadata', () => {
    const depositMeta = txnMeta('DEPOSIT');
    expect(depositMeta.label).toBe('Deposit');
    expect(depositMeta.dir).toBe('in');

    const transferOutMeta = txnMeta('TRANSFER_OUT');
    expect(transferOutMeta.label).toBe('Transfer Out');
    expect(transferOutMeta.dir).toBe('out');
  });

  it('assigns appropriate status badges according to BFSI guidelines', () => {
    expect(statusBadge('ACTIVE')).toBe('badge-green');
    expect(statusBadge('APPROVED')).toBe('badge-green');
    expect(statusBadge('PENDING')).toBe('badge-amber');
    expect(statusBadge('REJECTED')).toBe('badge-red');
    expect(statusBadge('FROZEN')).toBe('badge-red');
    expect(statusBadge('CLOSED')).toBe('badge-gray');
  });
});
