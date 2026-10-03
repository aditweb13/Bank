import { useState, useEffect } from 'react';
import { useToast } from '../context/ToastContext';
import { getAllTransfers } from '../services/api';
import { inr, maskAccount, fmtDateTime, statusBadge } from '../utils/format';
import Modal from './Modal';
import Skeleton from './Skeleton';

export default function AdminTransfersView() {
  const toast = useToast();
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState(null);

  const loadData = () => {
    setLoading(true);
    getAllTransfers(page, 20)
      .then(res => {
        let list = Array.isArray(res) ? res : (res.content || []);
        if (search.trim()) {
          const s = search.toLowerCase();
          list = list.filter(t =>
            (t.referenceNo && t.referenceNo.toLowerCase().includes(s)) ||
            (t.fromAccountNumber && t.fromAccountNumber.toLowerCase().includes(s)) ||
            (t.toAccountNumberMasked && t.toAccountNumberMasked.toLowerCase().includes(s)) ||
            (t.toAccountHolderNameMasked && t.toAccountHolderNameMasked.toLowerCase().includes(s))
          );
        }
        setTransfers(list);
        setTotalPages(res.totalPages || 1);
      })
      .catch(err => {
        toast.error('Error', 'Failed to load transfer logs');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, [page]);

  const handleSearch = e => {
    e.preventDefault();
    setPage(0);
    loadData();
  };

  return (
    <div>
      <div className="section-header">
        <div>
          <div className="section-title">All Bank Transfers</div>
          <div className="section-subtitle">
            Audited ledger of all customer funds transfers executed across ARBC Bank.
          </div>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={loadData}>
          🔄 Refresh
        </button>
      </div>

      <div className="card" style={{ marginBottom: 16, padding: '14px 18px' }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <input
            className="form-input form-input-sm"
            placeholder="Search by Reference No, Account No, or Payee..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ maxWidth: 360 }}
          />
          <button type="submit" className="btn btn-secondary btn-sm">
            🔍 Search
          </button>
          {search && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => { setSearch(''); setPage(0); loadData(); }}
            >
              Clear
            </button>
          )}
        </form>
      </div>

      <div className="table-wrap">
        {loading ? (
          <Skeleton rows={8} />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Reference No</th>
                <th>Sender (From)</th>
                <th>Payee (To)</th>
                <th>Amount</th>
                <th>Remarks</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {transfers.map(t => (
                <tr key={t.id}>
                  <td className="text-xs text-muted">{fmtDateTime(t.createdAt)}</td>
                  <td className="monospace text-sm font-semibold">{t.referenceNo}</td>
                  <td className="monospace text-sm">
                    {t.fromAccountNumber || '—'}
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{t.toAccountHolderNameMasked || 'Payee'}</div>
                    <div className="monospace text-xs text-muted">{t.toAccountNumberMasked}</div>
                  </td>
                  <td className="font-bold text-sm">{inr(t.amount)}</td>
                  <td className="text-secondary text-sm">{t.remarks || 'Funds Transfer'}</td>
                  <td>
                    <span className={`badge ${statusBadge(t.status)}`}>
                      {t.status}
                    </span>
                  </td>
                  <td>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => setSelectedReceipt(t)}
                    >
                      📄 Receipt
                    </button>
                  </td>
                </tr>
              ))}
              {transfers.length === 0 && (
                <tr>
                  <td colSpan={8} className="table-empty">
                    No transfers found.
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

      {selectedReceipt && (
        <Modal title="Transfer Audit Record" onClose={() => setSelectedReceipt(null)}>
          <div style={{ background: 'var(--bg-secondary)', padding: 18, borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed var(--border)', paddingBottom: 10, marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Reference Number</div>
                <div className="monospace font-bold" style={{ color: 'var(--brand-500)', fontSize: 15 }}>
                  {selectedReceipt.referenceNo}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Timestamp</div>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{fmtDateTime(selectedReceipt.createdAt)}</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Source Account</div>
                <div className="monospace font-semibold">{selectedReceipt.fromAccountNumber}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Destination Payee</div>
                <div style={{ fontWeight: 600, color: 'var(--success)' }}>{selectedReceipt.toAccountHolderNameMasked}</div>
                <div className="monospace text-xs text-muted">{selectedReceipt.toAccountNumberMasked}</div>
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Transfer Amount</div>
                <div style={{ fontSize: 22, fontWeight: 900 }}>{inr(selectedReceipt.amount)}</div>
              </div>
              <span className={`badge ${statusBadge(selectedReceipt.status)}`}>
                {selectedReceipt.status}
              </span>
            </div>

            {selectedReceipt.idempotencyKey && (
              <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-muted)', borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                Idempotency Key: <span className="monospace">{selectedReceipt.idempotencyKey}</span>
              </div>
            )}
          </div>

          <div className="modal-footer" style={{ marginTop: 14 }}>
            <button className="btn btn-secondary" onClick={() => window.print()}>
              🖨️ Print
            </button>
            <button className="btn btn-primary" onClick={() => setSelectedReceipt(null)}>
              Close
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
