// Format a number as Indian Rupees
export const inr = (amount) => {
  const num = Number(amount) || 0;
  return '₹' + num.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

// Mask account number: show only last 4 digits
export const maskAccount = (acn, show = false) => {
  if (!acn) return '—';
  if (show) return acn;
  return '•••• •••• ' + acn.slice(-4);
};

// Format a date/datetime string to readable Indian format
export const fmtDate = (dt) => {
  if (!dt) return '—';
  const d = new Date(dt);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const fmtDateTime = (dt) => {
  if (!dt) return '—';
  const d = new Date(dt);
  return d.toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
};

// Map transaction type to display info
export const txnMeta = (type) => {
  const map = {
    DEPOSIT:      { label: 'Deposit',      dir: 'in',      icon: '↙' },
    WITHDRAWAL:   { label: 'Withdrawal',   dir: 'out',     icon: '↗' },
    TRANSFER_IN:  { label: 'Transfer In',  dir: 'in',      icon: '↙' },
    TRANSFER_OUT: { label: 'Transfer Out', dir: 'out',     icon: '↗' },
    TRANSFER_DEBIT:  { label: 'Transfer Out', dir: 'out',  icon: '↗' },
    TRANSFER_CREDIT: { label: 'Transfer In',  dir: 'in',   icon: '↙' },
    EMI_PAYMENT:     { label: 'EMI Payment',     dir: 'out',     icon: '📋' },
    LOAN_EMI:        { label: 'Loan EMI',        dir: 'out',     icon: '💳' },
    OVERDUE_PENALTY: { label: 'Penalty',         dir: 'out',     icon: '⚠️' },
    FD_DEPOSIT:      { label: 'FD Deposit',      dir: 'neutral', icon: '🏦' },
    INTEREST_CREDIT: { label: 'Interest',        dir: 'in',      icon: '💰' },
  };
  return map[type] || { label: type, dir: 'neutral', icon: '•' };
};

// Map loan/account status to badge class
export const statusBadge = (status) => {
  const map = {
    ACTIVE: 'badge-green', APPROVED: 'badge-green', VERIFIED: 'badge-green', PAID: 'badge-green', SUCCESS: 'badge-green',
    APPLIED: 'badge-amber', PENDING: 'badge-amber',
    REJECTED: 'badge-red', FROZEN: 'badge-red', FAILED: 'badge-red',
    CLOSED: 'badge-gray', CANCELLED: 'badge-gray', PREMATURELY_CLOSED: 'badge-gray',
  };
  return map[status] || 'badge-gray';
};

// Trigger file download from a Blob
export const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
