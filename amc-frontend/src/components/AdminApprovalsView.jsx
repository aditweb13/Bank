import { useState, useEffect } from 'react';
import { useToast } from '../context/ToastContext';
import {
  getAdminDepositRequests, approveDepositRequest, rejectDepositRequest, reconcileAccount
} from '../services/api';
import { inr, fmtDateTime, statusBadge } from '../utils/format';
import Modal, { ConfirmModal } from './Modal';
import Skeleton from './Skeleton';

export default function AdminApprovalsView() {
  const toast = useToast();

  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'history' | 'reconcile'
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Modals
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [approvingItem, setApprovingItem] = useState(null);
  const [approvalRemarks, setApprovalRemarks] = useState('');
  const [rejectingItem, setRejectingItem] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [processing, setProcessing] = useState(false);

  // Reconciliation Tool
  const [reconcileAccountId, setReconcileAccountId] = useState('');
  const [reconcileResult, setReconcileResult] = useState(null);
  const [reconcileLoading, setReconcileLoading] = useState(false);

  const loadRequests = () => {
    setLoading(true);
    const statusQuery = activeTab === 'pending' ? 'PENDING' : null;
    getAdminDepositRequests(page, 20, statusQuery, search)
      .then(res => {
        let list = Array.isArray(res) ? res : (res.content || []);
        if (activeTab === 'history') {
          // Exclude pending from history tab
          list = list.filter(r => r.status !== 'PENDING');
        }
        setRequests(list);
        setTotalPages(res.totalPages || 1);
      })
      .catch(err => {
        toast.error('Error', 'Failed to load deposit requests');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadRequests();
  }, [activeTab, page]);

  const handleSearch = e => {
    e.preventDefault();
    setPage(0);
    loadRequests();
  };

  const handleApprove = async () => {
    if (!approvingItem) return;
    setProcessing(true);
    try {
      const res = await approveDepositRequest(approvingItem.id, approvalRemarks);
      toast.success('Deposit Approved', `Credited ${inr(approvingItem.amount)} to account. Ref: ${res.referenceNo}`);
      setApprovingItem(null);
      setApprovalRemarks('');
      loadRequests();
    } catch (err) {
      toast.error('Approval Failed', err.response?.data?.message || err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!rejectingItem) return;
    if (!rejectReason.trim()) {
      toast.error('Validation Error', 'Rejection reason is mandatory');
      return;
    }

    setProcessing(true);
    try {
      const res = await rejectDepositRequest(rejectingItem.id, rejectReason.trim());
      toast.info('Deposit Rejected', `Request ${res.referenceNo} rejected.`);
      setRejectingItem(null);
      setRejectReason('');
      loadRequests();
    } catch (err) {
      toast.error('Rejection Failed', err.response?.data?.message || err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleReconcile = async e => {
    e.preventDefault();
    if (!reconcileAccountId) return;
    setReconcileLoading(true);
    try {
      const res = await reconcileAccount(reconcileAccountId);
      setReconcileResult(res);
      if (res.reconciled) {
        toast.success('Reconciled', 'Account balance perfectly matches ledger entries.');
      } else {
        toast.warning('Discrepancy', res.message);
      }
    } catch (err) {
      toast.error('Reconciliation Failed', err.response?.data?.message || err.message);
    } finally {
      setReconcileLoading(false);
    }
  };

  return (
    <div>
      <div className="section-header">
        <div>
          <div className="section-title">Deposit Approvals & Maker-Checker Queue</div>
          <div className="section-subtitle">
            Review, verify payment instruments, and approve or reject customer deposit requests.
          </div>
        </div>
        <div className="flex gap-2">
          <button
            className={`btn btn-sm ${activeTab === 'pending' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { setActiveTab('pending'); setPage(0); }}
          >
            ⏳ Pending Queue
          </button>
          <button
            className={`btn btn-sm ${activeTab === 'history' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { setActiveTab('history'); setPage(0); }}
          >
            📜 Approval History
          </button>
          <button
            className={`btn btn-sm ${activeTab === 'reconcile' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('reconcile')}
          >
            ⚖️ Ledger Reconciliation
          </button>
        </div>
      </div>

      {activeTab !== 'reconcile' && (
        <>
          {/* Search bar */}
          <div className="card" style={{ marginBottom: 16, padding: '14px 18px' }}>
            <form onSubmit={handleSearch} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <input
                className="form-input form-input-sm"
                placeholder="Search by Ref No, Customer Name, or Account No..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ maxWidth: 380 }}
              />
              <button type="submit" className="btn btn-secondary btn-sm">
                🔍 Filter
              </button>
              {search && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => { setSearch(''); setPage(0); }}
                >
                  Clear
                </button>
              )}
              <div style={{ marginLeft: 'auto' }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={loadRequests}>
                  🔄 Refresh
                </button>
              </div>
            </form>
          </div>

          {/* Table */}
          <div className="table-wrap">
            {loading ? (
              <Skeleton rows={8} />
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Ref No</th>
                    <th>Customer</th>
                    <th>Account</th>
                    <th>Mode</th>
                    <th>Amount</th>
                    <th>Instrument Ref</th>
                    <th>Requested At</th>
                    {activeTab === 'history' && <th>Reviewed By & At</th>}
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map(r => (
                    <tr key={r.id}>
                      <td className="monospace text-sm font-semibold">{r.referenceNo}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{r.customerNameMasked}</div>
                        <div className="text-xs text-muted">ID: #{r.customerId}</div>
                      </td>
                      <td className="text-sm monospace">{r.accountNumberMasked}</td>
                      <td>
                        <span className="badge badge-blue">{r.mode}</span>
                      </td>
                      <td>
                        <div className="font-bold text-sm">{inr(r.amount)}</div>
                        {r.largeDeposit && (
                          <span className="badge badge-amber" style={{ fontSize: 10, marginTop: 3 }}>
                            ⚠️ High Value
                          </span>
                        )}
                      </td>
                      <td className="monospace text-xs text-muted">{r.paymentReference || '—'}</td>
                      <td className="text-xs text-muted">{fmtDateTime(r.requestedAt)}</td>
                      {activeTab === 'history' && (
                        <td className="text-xs">
                          <div><strong>{r.reviewedBy || 'Admin'}</strong></div>
                          <div className="text-muted">{fmtDateTime(r.reviewedAt)}</div>
                        </td>
                      )}
                      <td>
                        <span className={`badge ${statusBadge(r.status)}`}>
                          {r.status}
                        </span>
                      </td>
                      <td>
                        <div className="flex gap-2">
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => setSelectedDetail(r)}
                            title="Inspect Details"
                          >
                            👁️
                          </button>
                          {r.status === 'PENDING' && (
                            <>
                              <button
                                className="btn btn-success btn-sm"
                                onClick={() => setApprovingItem(r)}
                              >
                                Approve
                              </button>
                              <button
                                className="btn btn-danger btn-sm"
                                onClick={() => setRejectingItem(r)}
                              >
                                Reject
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {requests.length === 0 && (
                    <tr>
                      <td colSpan={activeTab === 'history' ? 10 : 9} className="table-empty">
                        No {activeTab} deposit requests found.
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
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              ← Prev
            </button>
            <span className="text-sm text-secondary">
              Page {page + 1} of {totalPages}
            </span>
            <button
              className="page-btn"
              onClick={() => setPage(p => p + 1)}
              disabled={page >= totalPages - 1}
            >
              Next →
            </button>
          </div>
        </>
      )}

      {/* ────────────────── RECONCILIATION TAB ────────────────── */}
      {activeTab === 'reconcile' && (
        <div style={{ maxWidth: 680 }}>
          <div className="card">
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
              ⚖️ Account Ledger Reconciliation
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 18 }}>
              Verify that the account balance strictly equals the net algebraic sum of all credits minus debits from the transaction ledger.
            </p>

            <form onSubmit={handleReconcile} style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
              <input
                className="form-input"
                type="number"
                placeholder="Enter Account ID (e.g. 1)"
                value={reconcileAccountId}
                onChange={e => setReconcileAccountId(e.target.value)}
                required
              />
              <button type="submit" className="btn btn-primary" disabled={reconcileLoading}>
                {reconcileLoading ? '⏳ Reconciling…' : 'Run Audit Check'}
              </button>
            </form>

            {reconcileResult && (
              <div
                style={{
                  background: reconcileResult.reconciled ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                  border: `1px solid ${reconcileResult.reconciled ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                  borderRadius: 'var(--radius)',
                  padding: 18
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontWeight: 800, fontSize: 15 }}>
                    Account {reconcileResult.accountNumber}
                  </span>
                  <span className={`badge ${reconcileResult.reconciled ? 'badge-green' : 'badge-red'}`} style={{ fontSize: 12 }}>
                    {reconcileResult.reconciled ? '✓ BALANCES RECONCILED' : '⚠️ DISCREPANCY DETECTED'}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13, marginBottom: 14 }}>
                  <div>
                    <div style={{ color: 'var(--text-muted)' }}>Account Table Balance</div>
                    <div style={{ fontWeight: 700, fontSize: 18 }}>{inr(reconcileResult.accountBalance)}</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-muted)' }}>Calculated Ledger Sum</div>
                    <div style={{ fontWeight: 700, fontSize: 18 }}>{inr(reconcileResult.calculatedLedgerBalance)}</div>
                  </div>
                </div>

                <div style={{ fontSize: 13, color: 'var(--text-secondary)', borderTop: '1px dashed var(--border)', paddingTop: 10 }}>
                  <div>Total Ledger Entries Audited: <strong>{reconcileResult.totalLedgerEntries}</strong></div>
                  <div>Difference: <strong>{inr(reconcileResult.difference)}</strong></div>
                  <div style={{ marginTop: 6, fontWeight: 600, color: reconcileResult.reconciled ? 'var(--success)' : 'var(--danger)' }}>
                    {reconcileResult.message}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ────────────────── DETAIL MODAL ────────────────── */}
      {selectedDetail && (
        <Modal title="Deposit Request Details" onClose={() => setSelectedDetail(null)}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Reference No</div>
              <div className="monospace font-bold">{selectedDetail.referenceNo}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Status</div>
              <span className={`badge ${statusBadge(selectedDetail.status)}`}>{selectedDetail.status}</span>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Customer</div>
              <div style={{ fontWeight: 600 }}>{selectedDetail.customerNameMasked}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Target Account</div>
              <div className="monospace font-semibold">{selectedDetail.accountNumberMasked}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Deposit Amount</div>
              <div style={{ fontSize: 20, fontWeight: 800 }}>{inr(selectedDetail.amount)}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Mode & Reference</div>
              <div>{selectedDetail.mode} • {selectedDetail.paymentReference || 'No Ref'}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Customer Remarks</div>
              <div>{selectedDetail.remarks || 'None'}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Requested At</div>
              <div>{fmtDateTime(selectedDetail.requestedAt)}</div>
            </div>
          </div>

          {selectedDetail.reviewedBy && (
            <div style={{ background: 'var(--bg-secondary)', padding: 12, borderRadius: 6, fontSize: 13, marginBottom: 18 }}>
              <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>Reviewer Audit</div>
              <div>Reviewed by <strong>{selectedDetail.reviewedBy}</strong> on {fmtDateTime(selectedDetail.reviewedAt)}</div>
              {selectedDetail.reviewRemarks && (
                <div style={{ marginTop: 4 }}>Remarks: {selectedDetail.reviewRemarks}</div>
              )}
            </div>
          )}

          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={() => setSelectedDetail(null)}>Close</button>
          </div>
        </Modal>
      )}

      {/* ────────────────── APPROVE CONFIRMATION MODAL ────────────────── */}
      {approvingItem && (
        <Modal title="Approve Deposit Request" onClose={() => !processing && setApprovingItem(null)}>
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 14, marginBottom: 12 }}>
              Are you sure you want to approve deposit of <strong>{inr(approvingItem.amount)}</strong> into account <strong>{approvingItem.accountNumberMasked}</strong>?
            </p>
            <div className="form-group">
              <label className="form-label">Review Remarks / Verification Note (Optional)</label>
              <input
                className="form-input"
                placeholder="e.g. UTR verified in bank statement"
                value={approvalRemarks}
                onChange={e => setApprovalRemarks(e.target.value)}
              />
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={() => setApprovingItem(null)} disabled={processing}>
              Cancel
            </button>
            <button className="btn btn-success" onClick={handleApprove} disabled={processing}>
              {processing ? '⏳ Crediting Account…' : 'Confirm & Credit Funds'}
            </button>
          </div>
        </Modal>
      )}

      {/* ────────────────── REJECT CONFIRMATION MODAL ────────────────── */}
      {rejectingItem && (
        <Modal title="Reject Deposit Request" onClose={() => !processing && setRejectingItem(null)}>
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 14, color: 'var(--danger)', marginBottom: 12 }}>
              Rejecting request for <strong>{inr(rejectingItem.amount)}</strong>. The account balance will NOT be credited.
            </p>
            <div className="form-group">
              <label className="form-label">Mandatory Rejection Reason *</label>
              <textarea
                className="form-input"
                rows="3"
                placeholder="Please state reason (e.g. Cheque signature mismatch, Invalid UTR, KYC discrepancy)"
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={() => setRejectingItem(null)} disabled={processing}>
              Cancel
            </button>
            <button className="btn btn-danger" onClick={handleReject} disabled={processing || !rejectReason.trim()}>
              {processing ? '⏳ Rejecting…' : 'Confirm Rejection'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
