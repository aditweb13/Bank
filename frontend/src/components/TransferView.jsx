import { useState, useEffect, useRef } from 'react';
import { useToast } from '../context/ToastContext';
import {
  getMyAccounts, getMyBeneficiaries, executeTransfer, getCustomerTransfers, lookupAccount
} from '../services/api';
import { inr, maskAccount, fmtDateTime, statusBadge } from '../utils/format';
import Modal from './Modal';
import Skeleton from './Skeleton';

export default function TransferView({ onTransferSuccess }) {
  const toast = useToast();

  const [tab, setTab] = useState('new'); // 'new' | 'history'
  const [accounts, setAccounts] = useState([]);
  const [beneficiaries, setBeneficiaries] = useState([]);

  // Transfer Mode: 'external' (other person) | 'self' (own account)
  const [transferMode, setTransferMode] = useState('external');

  // Form State
  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountNumber, setToAccountNumber] = useState('');
  const [toSelfAccountId, setToSelfAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [remarks, setRemarks] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState('');

  // Payee Lookup State (external only)
  const [payeeLoading, setPayeeLoading] = useState(false);
  const [payeeInfo, setPayeeInfo] = useState(null);
  const [payeeError, setPayeeError] = useState('');

  // Confirmation & Processing State
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [transferResult, setTransferResult] = useState(null);

  // History State
  const [transfers, setTransfers] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPage, setHistoryPage] = useState(0);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [selectedAccountFilter, setSelectedAccountFilter] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('');
  const [viewReceiptTransfer, setViewReceiptTransfer] = useState(null);

  // Derived: the self-destination account object
  // selfDestAccount: compare as strings
  const selfDestAccount = accounts.find(a => String(a.id) === String(toSelfAccountId));
  // Effective destination account number used for submission
  const effectiveToAccountNumber = transferMode === 'self'
    ? (selfDestAccount?.accountNumber || '')
    : toAccountNumber.trim();

  // Initialize idempotency key and accounts
  const resetForm = () => {
    setIdempotencyKey(crypto.randomUUID ? crypto.randomUUID() : 'IDEM-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9));
    setToAccountNumber('');
    setToSelfAccountId('');
    setAmount('');
    setRemarks('');
    setPayeeInfo(null);
    setPayeeError('');
    setTransferResult(null);
    setShowConfirmModal(false);
  };

  const switchMode = (mode) => {
    setTransferMode(mode);
    setToAccountNumber('');
    setPayeeInfo(null);
    setPayeeError('');
    setAmount('');
    setRemarks('');
    setTransferResult(null);

    if (mode === 'self' && accounts.length > 0) {
      // Ensure FROM is selected (use current or first account)
      const currentFrom = fromAccountId || String(accounts[0].id);
      if (!fromAccountId) setFromAccountId(currentFrom);
      // Auto-select first OTHER account as TO
      const others = accounts.filter(a => String(a.id) !== currentFrom);
      setToSelfAccountId(others.length > 0 ? String(others[0].id) : '');
    } else {
      setToSelfAccountId('');
    }
  };

  // Separate loading / error state for the accounts fetch
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [accountsError, setAccountsError] = useState(null);

  const loadAccounts = () => {
    setAccountsLoading(true);
    setAccountsError(null);

    // Load accounts (critical) and beneficiaries (optional) independently
    getMyAccounts()
      .then(accs => {
        const aList = Array.isArray(accs) ? accs : [];
        setAccounts(aList);
        setAccountsLoading(false);
        if (aList.length > 0) {
          const firstId = String(aList[0].id);
          if (!fromAccountId) setFromAccountId(firstId);
          if (transferMode === 'self') {
            const fromIdStr = fromAccountId || firstId;
            const others = aList.filter(a => String(a.id) !== fromIdStr);
            setToSelfAccountId(prev => prev || (others.length > 0 ? String(others[0].id) : ''));
          }
        }
      })
      .catch(err => {
        setAccountsLoading(false);
        const status = err?.response?.status;
        if (status === 401) {
          setAccountsError('401');
          setTimeout(() => { window.location.href = '/login'; }, 2000);
        } else if (status === 403) {
          setAccountsError('403');
        } else if (status === 404) {
          setAccountsError('404');
        } else if (status >= 500) {
          setAccountsError('500');
        } else {
          setAccountsError('network');
        }
      });

    // Beneficiaries are optional — a 404 or 500 should not block the transfer form
    getMyBeneficiaries()
      .then(bens => setBeneficiaries(Array.isArray(bens) ? bens : []))
      .catch(() => setBeneficiaries([])); // silent fail — saved beneficiaries are optional
  };

  useEffect(() => {
    loadAccounts();
    setIdempotencyKey(crypto.randomUUID ? crypto.randomUUID() : 'IDEM-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9));
  }, []);

  // When FROM account changes in self mode, keep TO pointing to a valid different account
  useEffect(() => {
    if (transferMode !== 'self' || accounts.length === 0) return;
    const fromIdStr = String(fromAccountId);
    // If TO is same as FROM or unset, auto-pick the first other account
    if (!toSelfAccountId || String(toSelfAccountId) === fromIdStr) {
      const others = accounts.filter(a => String(a.id) !== fromIdStr);
      setToSelfAccountId(others.length > 0 ? String(others[0].id) : '');
    }
  }, [fromAccountId, transferMode, accounts]);

  // Fetch transfer history
  const loadHistory = (page = 0) => {
    setHistoryLoading(true);
    getCustomerTransfers(
      page,
      10,
      selectedAccountFilter ? Number(selectedAccountFilter) : null,
      selectedStatusFilter || null
    )
      .then(res => {
        const list = Array.isArray(res) ? res : (res.content || []);
        setTransfers(list);
        setHistoryTotalPages(res.totalPages || 1);
        setHistoryPage(res.pageNumber || page);
      })
      .catch(err => {
        toast.error('Error', 'Failed to load transfer history');
      })
      .finally(() => setHistoryLoading(false));
  };

  useEffect(() => {
    if (tab === 'history') {
      loadHistory(historyPage);
    }
  }, [tab, historyPage, selectedAccountFilter, selectedStatusFilter]);

  // Debounced Payee Lookup
  const lookupTimer = useRef(null);
  useEffect(() => {
    const cleanAcct = toAccountNumber.trim();
    if (!cleanAcct) {
      setPayeeInfo(null);
      setPayeeError('');
      return;
    }

    if (cleanAcct.length < 8) {
      setPayeeInfo(null);
      setPayeeError('Account number must be at least 10 characters');
      return;
    }

    setPayeeLoading(true);
    setPayeeError('');
    setPayeeInfo(null);

    if (lookupTimer.current) clearTimeout(lookupTimer.current);

    lookupTimer.current = setTimeout(() => {
      lookupAccount(cleanAcct)
        .then(data => {
          setPayeeInfo(data);
          setPayeeError('');
        })
        .catch(err => {
          setPayeeInfo(null);
          setPayeeError(err.response?.data?.message || 'Payee account not found or inactive');
        })
        .finally(() => setPayeeLoading(false));
    }, 450);

    return () => clearTimeout(lookupTimer.current);
  }, [toAccountNumber]);

  // selectedSourceAccount: compare as strings to avoid type mismatch
  const selectedSourceAccount = accounts.find(a => String(a.id) === String(fromAccountId));

  const handleBeneficiarySelect = e => {
    const benId = e.target.value;
    if (!benId) return;
    const b = beneficiaries.find(x => x.id === Number(benId));
    if (b) {
      setToAccountNumber(b.accountNumber);
      setRemarks(`Transfer to ${b.beneficiaryName}`);
    }
  };

  // Validate and open review modal
  const handleReview = e => {
    e.preventDefault();

    if (!selectedSourceAccount) {
      toast.error('Validation Error', 'Please select a source account');
      return;
    }

    if (selectedSourceAccount.status !== 'ACTIVE') {
      toast.error('Validation Error', `Source account is ${selectedSourceAccount.status}`);
      return;
    }

    // Self-transfer: ensure destination is selected and different
    if (transferMode === 'self') {
      if (!selfDestAccount) {
        toast.error('Validation Error', 'Please select a destination account');
        return;
      }
      if (selfDestAccount.id === selectedSourceAccount.id) {
        toast.error('Validation Error', 'Source and destination accounts cannot be the same');
        return;
      }
      if (selfDestAccount.status !== 'ACTIVE') {
        toast.error('Validation Error', `Destination account is ${selfDestAccount.status}`);
        return;
      }
    } else {
      // External transfer: destination entered manually
      if (selectedSourceAccount.accountNumber === toAccountNumber.trim()) {
        toast.error('Validation Error', 'Source and destination accounts cannot be the same');
        return;
      }
      if (payeeError) {
        toast.error('Invalid Payee', payeeError);
        return;
      }
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error('Validation Error', 'Please enter a valid amount greater than ₹0');
      return;
    }

    if (numAmount > 50000) {
      toast.error('Limit Exceeded', 'Maximum per-transaction limit is ₹50,000.00');
      return;
    }

    const minBal = selectedSourceAccount.minimumBalance || 0;
    if (selectedSourceAccount.balance - numAmount < minBal) {
      toast.error(
        'Insufficient Balance',
        `Account must retain a minimum balance of ${inr(minBal)}. Available for transfer: ${inr(Math.max(0, selectedSourceAccount.balance - minBal))}`
      );
      return;
    }

    setShowConfirmModal(true);
  };

  // Execute transfer with idempotency key
  const handleConfirmTransfer = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const res = await executeTransfer(
        Number(fromAccountId),
        effectiveToAccountNumber,
        parseFloat(amount),
        remarks.trim() || (transferMode === 'self' ? 'Own Account Transfer' : 'Funds Transfer'),
        idempotencyKey
      );

      setTransferResult(res);
      setShowConfirmModal(false);
      toast.success('Transfer Executed', `Ref: ${res.referenceNo}`);

      // Refresh balances in parent / local
      loadAccounts();
      if (onTransferSuccess) onTransferSuccess();
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message || 'Transfer failed';
      toast.error('Transfer Failed', errorMsg);
      setShowConfirmModal(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const printReceipt = () => {
    window.print();
  };

  return (
    <div>
      <div className="section-header">
        <div>
          <div className="section-title">Funds Transfer</div>
          <div className="section-subtitle">
            Send money externally or move funds between your own accounts
          </div>
        </div>
        <div className="flex gap-2">
          <button
            className={`btn btn-sm ${tab === 'new' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setTab('new')}
          >
            💸 New Transfer
          </button>
          <button
            className={`btn btn-sm ${tab === 'history' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setTab('history')}
          >
            📜 Transfer History
          </button>
        </div>
      </div>

      {tab === 'new' && (
        <>
          {transferResult ? (
            /* ────────────────── RESULT SCREEN & RECEIPT ────────────────── */
            <div className="card" style={{ maxWidth: 640, margin: '0 auto', padding: '36px 28px' }}>
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <div style={{ fontSize: 52, marginBottom: 8 }}>✅</div>
                <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 800, color: 'var(--success)' }}>
                  Transfer Successful!
                </h2>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                  Your transaction has been processed and credited to the recipient's account.
                </div>
              </div>

              <div
                id="transfer-receipt"
                style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  padding: 20,
                  marginBottom: 24
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed var(--border)', paddingBottom: 12, marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Reference No</div>
                    <div className="monospace" style={{ fontWeight: 800, fontSize: 15, color: 'var(--brand-500)' }}>
                      {transferResult.referenceNo}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Date & Time</div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{fmtDateTime(transferResult.createdAt)}</div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Debited From</div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>
                      {transferResult.fromAccountNumber || selectedSourceAccount?.accountNumber}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      {selectedSourceAccount?.type || 'Savings'} Account
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Credited To (Payee)</div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--success)' }}>
                      {transferResult.toAccountHolderNameMasked || payeeInfo?.maskedHolderName || 'Verified Payee'}
                    </div>
                    <div className="monospace" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                      {transferResult.toAccountNumberMasked || maskAccount(toAccountNumber)}
                    </div>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Amount Transferred</div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--text-primary)' }}>
                      {inr(transferResult.amount)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span className="badge badge-green" style={{ fontSize: 12, padding: '4px 10px' }}>
                      ✓ SUCCESS
                    </span>
                    {transferResult.remarks && (
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                        Remarks: {transferResult.remarks}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 justify-center">
                <button className="btn btn-secondary" onClick={printReceipt}>
                  🖨️ Print Receipt
                </button>
                <button className="btn btn-primary" onClick={resetForm}>
                  ➕ Make Another Transfer
                </button>
              </div>
            </div>
          ) : accountsLoading ? (
            <div className="card" style={{ padding: 40, textAlign: 'center' }}>
              <div style={{
                width: 40, height: 40, border: '3px solid var(--border)',
                borderTopColor: 'var(--brand)', borderRadius: '50%',
                animation: 'spin 1s linear infinite', margin: '0 auto 16px'
              }} />
              <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Loading account information...</div>
            </div>
          ) : accountsError ? (
            <div className="card" style={{ padding: 40, textAlign: 'center', borderColor: 'var(--danger)' }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
              <h3 style={{ margin: '0 0 8px 0', color: 'var(--danger)' }}>
                {accountsError === '401' ? 'Session Expired (401)' : 
                 accountsError === '403' ? 'Access Denied (403)' : 
                 accountsError === '404' ? 'Customer Profile Not Found (404)' :
                 accountsError === '500' ? 'Internal Server Error (500)' :
                 'Network Connection Error'}
              </h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: 24, maxWidth: 500, margin: '0 auto 24px' }}>
                {accountsError === '401' ? 'Your session has expired. Redirecting to login...' : 
                 accountsError === '403' ? 'You do not have permission to view these accounts. Please ensure you are logged in with a Customer account.' : 
                 accountsError === '404' ? 'We could not find an active customer profile associated with your user account.' :
                 accountsError === '500' ? 'The banking server encountered an internal error. Please try again shortly.' :
                 'Unable to connect to the banking server. Please check your network connection and retry.'}
              </p>
              <div className="flex gap-2 justify-center">
                {accountsError === '401' ? (
                  <button className="btn btn-primary" onClick={() => { window.location.href = '/login'; }}>
                    Go to Login
                  </button>
                ) : (
                  <button className="btn btn-primary" onClick={loadAccounts}>
                    🔄 Retry
                  </button>
                )}
              </div>
            </div>
          ) : accounts.length === 0 ? (
            <div className="card" style={{ padding: 40, textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>🏦</div>
              <h3 style={{ margin: '0 0 8px 0' }}>You have no active accounts</h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>
                You do not have any active bank accounts available for fund transfers.
              </p>
              <button className="btn btn-secondary" onClick={loadAccounts}>
                🔄 Refresh Accounts
              </button>
            </div>
          ) : (
            /* ────────────────── TRANSFER FORM ────────────────── */
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 560px) minmax(0, 360px)', gap: 24, alignItems: 'start' }}>
              <div className="card">
                {/* ── Transfer Mode Toggle ── */}
                <div style={{
                  display: 'flex', gap: 0, borderRadius: 'var(--radius)', border: '1px solid var(--border)',
                  overflow: 'hidden', marginBottom: 20, background: 'var(--bg-secondary)'
                }}>
                  <button
                    type="button"
                    style={{
                      flex: 1, padding: '9px 12px', fontSize: 13, fontWeight: 600, border: 'none',
                      borderRight: '1px solid var(--border)', cursor: 'pointer', transition: 'all 0.15s',
                      background: transferMode === 'external' ? 'var(--brand-500)' : 'transparent',
                      color: transferMode === 'external' ? '#fff' : 'var(--text-secondary)'
                    }}
                    onClick={() => switchMode('external')}
                  >
                    🌐 External Transfer
                  </button>
                  <button
                    type="button"
                    style={{
                      flex: 1, padding: '9px 12px', fontSize: 13, fontWeight: 600, border: 'none',
                      cursor: 'pointer', transition: 'all 0.15s',
                      background: transferMode === 'self' ? 'var(--brand-500)' : 'transparent',
                      color: transferMode === 'self' ? '#fff' : 'var(--text-secondary)'
                    }}
                    onClick={() => switchMode('self')}
                  >
                    🔄 Own Account Transfer
                  </button>
                </div>

                {/* Self-Transfer Info Banner */}
                {transferMode === 'self' && (
                  <div style={{
                    background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)',
                    borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: 18,
                    fontSize: 12.5, color: 'var(--brand-500)', fontWeight: 500, lineHeight: 1.6
                  }}>
                    🔄 <strong>Own Account Transfer:</strong> Move funds between your own accounts instantly.
                    No payee verification required. Both accounts update atomically.
                  </div>
                )}

                <form onSubmit={handleReview}>
                  {/* Source Account */}
                  <div className="form-group">
                    <label className="form-label">Debit Account (From) *</label>
                    <select
                      className="form-select"
                      value={fromAccountId}
                      onChange={e => {
                        setFromAccountId(e.target.value);
                        // If self mode and destination is same, clear it
                        if (transferMode === 'self' && toSelfAccountId === e.target.value) {
                          setToSelfAccountId('');
                        }
                      }}
                      required
                    >
                      {accounts.map(a => (
                        <option key={a.id} value={String(a.id)}>
                          {a.type} — {a.accountNumber} ({inr(a.balance)})
                        </option>
                      ))}
                    </select>
                    {selectedSourceAccount && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 6, color: 'var(--text-secondary)' }}>
                        <span>
                          Available Balance: <strong style={{ color: 'var(--success)' }}>{inr(selectedSourceAccount.balance)}</strong>
                        </span>
                        <span>
                          Min Balance: <strong>{inr(selectedSourceAccount.minimumBalance || 0)}</strong>
                        </span>
                      </div>
                    )}
                  </div>

                  {/* ── Self-Transfer: Destination is own account dropdown ── */}
                  {transferMode === 'self' ? (
                    <div className="form-group">
                      <label className="form-label">Credit Account (To) *</label>
                      <select
                        className="form-select"
                        value={toSelfAccountId}
                        onChange={e => setToSelfAccountId(e.target.value)}
                        required
                      >
                      <option value="">— Select destination account —</option>
                        {accounts
                          .filter(a => String(a.id) !== String(fromAccountId))
                          .map(a => (
                            <option key={a.id} value={String(a.id)}>
                              {a.type} — {a.accountNumber} ({inr(a.balance)})
                            </option>
                          ))
                        }
                      </select>
                      {selfDestAccount && (
                        <div style={{ fontSize: 12, marginTop: 6, color: 'var(--text-secondary)' }}>
                          Current Balance: <strong style={{ color: 'var(--success)' }}>{inr(selfDestAccount.balance)}</strong>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* ── External Transfer: Saved Beneficiaries + manual account input ── */
                    <>
                      {beneficiaries.length > 0 && (
                        <div className="form-group">
                          <label className="form-label">Saved Beneficiaries</label>
                          <select className="form-select" onChange={handleBeneficiarySelect} defaultValue="">
                            <option value="">— Select a saved beneficiary (optional) —</option>
                            {beneficiaries.map(b => (
                              <option key={b.id} value={b.id}>
                                {b.beneficiaryName} ({b.accountNumber})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Destination Account Number input */}
                      <div className="form-group">
                        <label className="form-label">Destination Account Number (To) *</label>
                        <input
                          className={`form-input ${payeeInfo ? 'border-success' : payeeError ? 'border-danger' : ''}`}
                          type="text"
                          placeholder="e.g. AC1002003002"
                          value={toAccountNumber}
                          onChange={e => setToAccountNumber(e.target.value)}
                          required
                        />

                        {/* Payee Verification Feedback */}
                        <div style={{ marginTop: 6, minHeight: 22 }}>
                          {payeeLoading && (
                            <span style={{ fontSize: 12, color: 'var(--brand-500)' }}>
                              🔍 Verifying destination account…
                            </span>
                          )}
                          {payeeInfo && (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', padding: '3px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600 }}>
                              <span>✓ Verified Payee:</span>
                              <span style={{ color: 'var(--text-primary)' }}>{payeeInfo.maskedHolderName}</span>
                              <span className="monospace" style={{ fontSize: 11, color: 'var(--text-muted)' }}>({payeeInfo.maskedAccountNumber})</span>
                            </div>
                          )}
                          {payeeError && !payeeLoading && (
                            <span style={{ fontSize: 12, color: 'var(--danger)', fontWeight: 500 }}>
                              ⚠️ {payeeError}
                            </span>
                          )}
                        </div>
                      </div>
                    </>
                  )}

                  {/* Amount */}
                  <div className="form-group">
                    <label className="form-label">Transfer Amount (₹) *</label>
                    <input
                      className="form-input"
                      type="number"
                      step="0.01"
                      min="1.00"
                      max="50000.00"
                      placeholder="0.00 (Max ₹50,000 per transaction)"
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      required
                    />
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                      Per-transaction limit: ₹50,000.00 • Daily limit: ₹2,00,000.00
                    </div>
                  </div>

                  {/* Remarks */}
                  <div className="form-group">
                    <label className="form-label">Remarks / Purpose (Optional)</label>
                    <input
                      className="form-input"
                      type="text"
                      maxLength="255"
                      placeholder={transferMode === 'self' ? 'e.g. Moving savings, Emergency fund rebalance' : 'e.g. Rent, Vendor payment, Family support'}
                      value={remarks}
                      onChange={e => setRemarks(e.target.value)}
                    />
                  </div>

                  <div style={{ paddingTop: 8 }}>
                    <button
                      type="submit"
                      className="btn btn-primary btn-full"
                      disabled={
                        transferMode === 'external'
                          ? (payeeLoading || !toAccountNumber || !amount)
                          : (!toSelfAccountId || !amount)
                      }
                    >
                      {transferMode === 'self' ? '🔄 Review Self Transfer →' : 'Review & Confirm Transfer →'}
                    </button>
                  </div>
                </form>
              </div>

              {/* Informational Guidelines Card */}
              <div className="card" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>
                  🛡️ Security & Transfer Rules
                </h3>
                <ul style={{ fontSize: 13, color: 'var(--text-secondary)', paddingLeft: 18, lineHeight: 1.7, margin: 0 }}>
                  <li><strong>Payee Protection:</strong> Destination accounts are verified in real time before debit.</li>
                  <li><strong>Double-Spend Guard:</strong> Pessimistic lock prevents race conditions and accidental duplicate transfers.</li>
                  <li><strong>Idempotent Safe Retries:</strong> Network retries will not debit your account twice.</li>
                  <li><strong>Limits:</strong> Single transaction limit is <strong>₹50,000</strong>. Daily cumulative limit is <strong>₹2,00,000</strong>.</li>
                  <li><strong>Atomic Guarantee:</strong> Both accounts update together or roll back completely.</li>
                </ul>
              </div>
            </div>
          )}
        </>
      )}

      {/* ────────────────── REVIEW & CONFIRM MODAL ────────────────── */}
      {showConfirmModal && selectedSourceAccount && (
        <Modal title="Confirm Funds Transfer" onClose={() => !isSubmitting && setShowConfirmModal(false)}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ textAlign: 'center', padding: '12px 0 20px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Transfer Amount</div>
              <div style={{ fontSize: 32, fontWeight: 900, color: 'var(--brand-500)', marginTop: 4 }}>
                {inr(amount)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--success)', marginTop: 2 }}>
                ✓ Zero Bank Transfer Fee
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, padding: '16px 0', borderBottom: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Debit From</div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{selectedSourceAccount.accountNumber}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{selectedSourceAccount.type}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Credit To</div>
                {transferMode === 'self' && selfDestAccount ? (
                  <>
                    <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--brand-500)' }}>
                      🔄 Your Own Account
                    </div>
                    <div className="monospace" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      {selfDestAccount.accountNumber}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{selfDestAccount.type}</div>
                  </>
                ) : (
                  <>
                    <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--success)' }}>
                      {payeeInfo?.maskedHolderName || 'Verified Payee'}
                    </div>
                    <div className="monospace" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      {payeeInfo?.maskedAccountNumber || maskAccount(toAccountNumber)}
                    </div>
                  </>
                )}
              </div>
            </div>

            <div style={{ padding: '12px 0', fontSize: 13, color: 'var(--text-secondary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span>Balance after debit:</span>
                <strong style={{ color: 'var(--text-primary)' }}>
                  {inr(selectedSourceAccount.balance - parseFloat(amount))}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Remarks:</span>
                <span>{remarks || 'Funds Transfer'}</span>
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowConfirmModal(false)}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleConfirmTransfer}
              disabled={isSubmitting}
            >
              {isSubmitting ? '⏳ Processing Transfer…' : 'Authorize & Send Money'}
            </button>
          </div>
        </Modal>
      )}

      {/* ────────────────── TRANSFER HISTORY TAB ────────────────── */}
      {tab === 'history' && (
        <>
          <div className="card" style={{ marginBottom: 16, padding: '14px 18px' }}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Filter by Account</label>
                <select
                  className="form-select form-select-sm"
                  value={selectedAccountFilter}
                  onChange={e => { setSelectedAccountFilter(e.target.value); setHistoryPage(0); }}
                >
                  <option value="">All Accounts</option>
                  {accounts.map(a => (
                    <option key={a.id} value={String(a.id)}>{a.type} — {a.accountNumber}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Filter by Status</label>
                <select
                  className="form-select form-select-sm"
                  value={selectedStatusFilter}
                  onChange={e => { setSelectedStatusFilter(e.target.value); setHistoryPage(0); }}
                >
                  <option value="">All Statuses</option>
                  <option value="SUCCESS">SUCCESS</option>
                  <option value="FAILED">FAILED</option>
                </select>
              </div>

              <div style={{ marginLeft: 'auto', alignSelf: 'flex-end' }}>
                <button className="btn btn-secondary btn-sm" onClick={() => loadHistory(0)}>
                  🔄 Refresh
                </button>
              </div>
            </div>
          </div>

          <div className="table-wrap">
            {historyLoading ? (
              <Skeleton rows={6} />
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Date & Time</th>
                    <th>Reference No</th>
                    <th>Sender / From</th>
                    <th>Recipient / To</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Receipt</th>
                  </tr>
                </thead>
                <tbody>
                  {transfers.map(t => (
                    <tr key={t.id}>
                      <td className="text-xs text-muted">{fmtDateTime(t.createdAt)}</td>
                      <td className="monospace text-sm font-semibold">{t.referenceNo}</td>
                      <td className="text-sm">
                        {t.fromAccountNumber ? maskAccount(t.fromAccountNumber) : '—'}
                      </td>
                      <td className="text-sm">
                        <div style={{ fontWeight: 600 }}>{t.toAccountHolderNameMasked || 'Payee'}</div>
                        <div className="monospace text-xs text-muted">{t.toAccountNumberMasked}</div>
                      </td>
                      <td className="font-bold text-sm">{inr(t.amount)}</td>
                      <td>
                        <span className={`badge ${statusBadge(t.status)}`}>
                          {t.status}
                        </span>
                      </td>
                      <td>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => setViewReceiptTransfer(t)}
                          title="View Receipt"
                        >
                          📄 Receipt
                        </button>
                      </td>
                    </tr>
                  ))}
                  {transfers.length === 0 && (
                    <tr>
                      <td colSpan={7} className="table-empty">
                        No transfer records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>

          <div className="pagination">
            <button
              className="page-btn"
              onClick={() => setHistoryPage(p => Math.max(0, p - 1))}
              disabled={historyPage === 0}
            >
              ← Prev
            </button>
            <span className="text-sm text-secondary">
              Page {historyPage + 1} of {historyTotalPages}
            </span>
            <button
              className="page-btn"
              onClick={() => setHistoryPage(p => p + 1)}
              disabled={historyPage >= historyTotalPages - 1}
            >
              Next →
            </button>
          </div>
        </>
      )}

      {/* ────────────────── RECEIPT POPUP MODAL ────────────────── */}
      {viewReceiptTransfer && (
        <Modal title="Transfer Receipt" onClose={() => setViewReceiptTransfer(null)}>
          <div style={{ background: 'var(--bg-secondary)', padding: 18, borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed var(--border)', paddingBottom: 10, marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Reference ID</div>
                <div className="monospace" style={{ fontWeight: 800, color: 'var(--brand-500)' }}>
                  {viewReceiptTransfer.referenceNo}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Timestamp</div>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{fmtDateTime(viewReceiptTransfer.createdAt)}</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>From Account</div>
                <div className="monospace" style={{ fontWeight: 600, fontSize: 13 }}>
                  {viewReceiptTransfer.fromAccountNumber || '—'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>To Account (Payee)</div>
                <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--success)' }}>
                  {viewReceiptTransfer.toAccountHolderNameMasked}
                </div>
                <div className="monospace text-xs text-muted">
                  {viewReceiptTransfer.toAccountNumberMasked}
                </div>
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Amount</div>
                <div style={{ fontSize: 22, fontWeight: 900 }}>{inr(viewReceiptTransfer.amount)}</div>
              </div>
              <span className={`badge ${statusBadge(viewReceiptTransfer.status)}`}>
                {viewReceiptTransfer.status}
              </span>
            </div>

            {viewReceiptTransfer.remarks && (
              <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)' }}>
                Remarks: {viewReceiptTransfer.remarks}
              </div>
            )}
          </div>

          <div className="modal-footer" style={{ marginTop: 16 }}>
            <button className="btn btn-secondary" onClick={() => window.print()}>
              🖨️ Print
            </button>
            <button className="btn btn-primary" onClick={() => setViewReceiptTransfer(null)}>
              Close
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
