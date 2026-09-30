import { useState, useEffect } from 'react';
import { useToast } from '../context/ToastContext';
import {
  getMyAccounts, createDepositRequest, getCustomerDepositRequests, cancelDepositRequest
} from '../services/api';
import { inr, maskAccount, fmtDateTime, statusBadge } from '../utils/format';
import Modal, { ConfirmModal } from './Modal';
import Skeleton from './Skeleton';

export default function CustomerDepositRequestsView({ onRequestSubmitted }) {
  const toast = useToast();

  const [accounts, setAccounts] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [cancellingRequest, setCancellingRequest] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState('UPI');
  const [paymentReference, setPaymentReference] = useState('');
  const [remarks, setRemarks] = useState('');

  const loadData = () => {
    setLoading(true);
    Promise.all([
      getMyAccounts(),
      getCustomerDepositRequests(0, 50, statusFilter === 'ALL' ? null : statusFilter)
    ])
      .then(([accs, depRes]) => {
        const aList = accs || [];
        setAccounts(aList);
        if (aList.length > 0 && !selectedAccountId) {
          setSelectedAccountId(String(aList[0].id));
        }

        const list = Array.isArray(depRes) ? depRes : (depRes.content || []);
        setRequests(list);
      })
      .catch(err => {
        toast.error('Error', 'Failed to load deposit requests');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const totalPendingAmount = requests
    .filter(r => r.status === 'PENDING')
    .reduce((sum, r) => sum + Number(r.amount || 0), 0);

  const handleSubmitRequest = async e => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount < 100) {
      toast.error('Invalid Amount', 'Minimum deposit amount is ₹100.00');
      return;
    }
    if (numAmount > 10000000) {
      toast.error('Invalid Amount', 'Maximum deposit amount is ₹1,00,00,000.00');
      return;
    }

    setSubmitting(true);
    try {
      const res = await createDepositRequest(
        Number(selectedAccountId),
        numAmount,
        mode,
        paymentReference.trim(),
        remarks.trim()
      );
      toast.success('Request Submitted', `Deposit of ${inr(numAmount)} queued for bank approval. Ref: ${res.referenceNo}`);
      setShowRequestModal(false);
      setAmount('');
      setPaymentReference('');
      setRemarks('');
      loadData();
      if (onRequestSubmitted) onRequestSubmitted();
    } catch (err) {
      toast.error('Submission Failed', err.response?.data?.message || err.message || 'Error creating request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelRequest = async () => {
    if (!cancellingRequest) return;
    try {
      await cancelDepositRequest(cancellingRequest.id);
      toast.info('Request Cancelled', `Deposit request ${cancellingRequest.referenceNo} cancelled.`);
      setCancellingRequest(null);
      loadData();
    } catch (err) {
      toast.error('Cancellation Failed', err.response?.data?.message || err.message);
    }
  };

  return (
    <div>
      <div className="section-header">
        <div>
          <div className="section-title">Deposit Requests (Maker-Checker)</div>
          <div className="section-subtitle">
            All deposits undergo verified bank admin approval before balance is credited.
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowRequestModal(true)}>
          ➕ Request Deposit
        </button>
      </div>

      {/* ────────────────── PENDING DEPOSITS KPI BANNER ────────────────── */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08), rgba(245, 158, 11, 0.02))',
          border: '1px solid rgba(245, 158, 11, 0.25)',
          marginBottom: 24,
          padding: '18px 24px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--amber-700, #b45309)', fontWeight: 600 }}>
              <span>⏳ Separate Pending Deposits</span>
              <span className="badge badge-amber">{requests.filter(r => r.status === 'PENDING').length} Pending</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--text-primary)', marginTop: 4 }}>
              {inr(totalPendingAmount)}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
              * Pending deposits are awaiting bank verification and are <strong>NEVER</strong> added to your available balance until approved.
            </div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={loadData}>
            🔄 Refresh Status
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['ALL', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'].map(st => (
          <button
            key={st}
            className={`btn btn-sm ${statusFilter === st ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setStatusFilter(st)}
          >
            {st}
          </button>
        ))}
      </div>

      {/* Requests Table */}
      <div className="table-wrap">
        {loading ? (
          <Skeleton rows={6} />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Reference No</th>
                <th>Account</th>
                <th>Mode</th>
                <th>Amount</th>
                <th>Payment Ref</th>
                <th>Requested At</th>
                <th>Status</th>
                <th>Remarks / Review Details</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.map(r => (
                <tr key={r.id}>
                  <td className="monospace text-sm font-semibold">{r.referenceNo}</td>
                  <td className="text-sm">
                    {r.accountNumberMasked || '••••'}
                  </td>
                  <td>
                    <span className="badge badge-blue">{r.mode}</span>
                  </td>
                  <td className="font-bold text-sm">{inr(r.amount)}</td>
                  <td className="monospace text-xs text-muted">
                    {r.paymentReference || '—'}
                  </td>
                  <td className="text-xs text-muted">{fmtDateTime(r.requestedAt)}</td>
                  <td>
                    <span className={`badge ${statusBadge(r.status)}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="text-sm">
                    {r.status === 'REJECTED' && (
                      <span style={{ color: 'var(--danger)', fontWeight: 600 }}>
                        Reason: {r.reviewRemarks || 'Rejected by Admin'}
                      </span>
                    )}
                    {r.status === 'APPROVED' && (
                      <span style={{ color: 'var(--success)' }}>
                        ✓ {r.reviewRemarks || 'Approved'} {r.reviewedBy ? `by ${r.reviewedBy}` : ''}
                      </span>
                    )}
                    {r.status === 'PENDING' && (
                      <span style={{ color: 'var(--text-muted)' }}>
                        {r.remarks || 'Awaiting Admin Verification'}
                      </span>
                    )}
                    {r.status === 'CANCELLED' && (
                      <span style={{ color: 'var(--text-muted)' }}>
                        Cancelled by you
                      </span>
                    )}
                  </td>
                  <td>
                    {r.status === 'PENDING' ? (
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ color: 'var(--danger)' }}
                        onClick={() => setCancellingRequest(r)}
                      >
                        Cancel
                      </button>
                    ) : (
                      <span className="text-muted text-xs">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {requests.length === 0 && (
                <tr>
                  <td colSpan={9} className="table-empty">
                    No deposit requests found in this view.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* ────────────────── REQUEST DEPOSIT MODAL ────────────────── */}
      {showRequestModal && (
        <Modal title="📥 Submit Deposit Request" onClose={() => !submitting && setShowRequestModal(false)}>
          <div
            style={{
              background: 'rgba(59, 130, 246, 0.08)',
              border: '1px solid rgba(59, 130, 246, 0.25)',
              borderRadius: 'var(--radius)',
              padding: '12px 16px',
              fontSize: 13,
              color: 'var(--brand-600, #2563eb)',
              marginBottom: 18
            }}
          >
            ℹ️ <strong>Maker-Checker Policy:</strong> Funds will NOT be credited immediately. Your request will be reviewed and verified by bank administration before reaching your account balance.
          </div>

          <form onSubmit={handleSubmitRequest}>
            <div className="form-group">
              <label className="form-label">Deposit Target Account *</label>
              <select
                className="form-select"
                value={selectedAccountId}
                onChange={e => setSelectedAccountId(e.target.value)}
                required
              >
                {accounts.map(a => (
                  <option key={a.id} value={String(a.id)}>
                    {a.type} — {a.accountNumber} (Available: {inr(a.balance)})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Deposit Amount (₹) *</label>
              <input
                className="form-input"
                type="number"
                min="100.00"
                max="10000000.00"
                step="0.01"
                placeholder="Minimum ₹100.00"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                required
              />
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                Min: ₹100.00 • Max: ₹1,00,00,000.00 per request
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Payment Mode *</label>
              <select
                className="form-select"
                value={mode}
                onChange={e => setMode(e.target.value)}
                required
              >
                <option value="ONLINE">ONLINE / UPI / NetBanking</option>
                <option value="CHEQUE">Cheque Deposit</option>
                <option value="NEFT">NEFT / RTGS Wire</option>
                <option value="CASH">Branch Cash Deposit</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Payment Reference Number / UTR / Cheque No.</label>
              <input
                className="form-input"
                type="text"
                placeholder="e.g. UPI-9281928, CHQ-892188, UTR-HDFC9982"
                value={paymentReference}
                onChange={e => setPaymentReference(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Remarks</label>
              <input
                className="form-input"
                type="text"
                placeholder="e.g. Salary bonus deposit, Savings replenishment"
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
              />
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowRequestModal(false)}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting || !amount}
              >
                {submitting ? '⏳ Submitting Request…' : 'Submit for Bank Approval'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ────────────────── CANCEL CONFIRMATION MODAL ────────────────── */}
      {cancellingRequest && (
        <ConfirmModal
          title="Cancel Deposit Request"
          message={`Are you sure you want to cancel the pending deposit request for ${inr(cancellingRequest.amount)} (Ref: ${cancellingRequest.referenceNo})?`}
          confirmLabel="Yes, Cancel Request"
          danger={true}
          onConfirm={handleCancelRequest}
          onCancel={() => setCancellingRequest(null)}
        />
      )}
    </div>
  );
}
