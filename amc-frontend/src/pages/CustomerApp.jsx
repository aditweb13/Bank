import { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import {
  getMyProfile, getMyAccounts, getMyLoans, getMyTransactions,
  getMyBeneficiaries, getMyFDs, getMyNotifications,
  withdrawMyAccount, applyForLoan, getLoanSchedule, addBeneficiary, deleteBeneficiary,
  createFixedDeposit, closeFixedDeposit, downloadCSV, downloadPDF,
  previewEmi, getLoanSummary, repayLoan, prepayLoan, getForeclosureQuote,
  forecloseLoan, downloadLoanScheduleCsv, toggleAutoDebit,
  createDepositRequest, getCustomerDepositRequests
} from '../services/api';
import {
  inr, maskAccount, fmtDate, fmtDateTime, txnMeta, statusBadge, downloadBlob
} from '../utils/format';
import Modal, { ConfirmModal } from '../components/Modal';
import Skeleton, { SkeletonCard } from '../components/Skeleton';
import TransferView from '../components/TransferView';
import CustomerDepositRequestsView from '../components/CustomerDepositRequestsView';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';

const SIDEBAR_ITEMS = [
  { key: 'dashboard',        label: 'Dashboard',           icon: '📊' },
  { key: 'accounts',         label: 'My Accounts',         icon: '🏦' },
  { key: 'transactions',     label: 'Transactions',        icon: '📋' },
  { key: 'transfer',         label: 'Fund Transfer',       icon: '💸' },
  { key: 'deposit-requests', label: 'Deposit Requests',    icon: '📥' },
  { key: 'loans',            label: 'Loans & EMI',         icon: '💳' },
  { key: 'beneficiaries',    label: 'Beneficiaries',       icon: '👤' },
  { key: 'fixed-deposits',   label: 'Fixed Deposits',      icon: '🏛️' },
  { key: 'notifications',    label: 'Notifications',       icon: '🔔' },
  { key: 'profile',          label: 'My Profile',          icon: '⚙️' },
];

export default function CustomerApp({ onLogout }) {
  const [view, setView]             = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { theme, toggle }           = useTheme();
  const [notifCount, setNotifCount] = useState(0);
  const customerName = localStorage.getItem('amc_customer_name') || 'Customer';

  useEffect(() => {
    getMyNotifications().then(n => {
      const list = Array.isArray(n) ? n : (n.content || []);
      setNotifCount(list.filter(x => !x.read).length);
    }).catch(() => {});
  }, []);

  const handleNavClick = key => {
    setView(key);
    setSidebarOpen(false);
    if (key === 'notifications') setNotifCount(0);
  };

  return (
    <div className="app-shell">
      <div
        className={`sidebar-overlay ${sidebarOpen ? '' : 'hidden'}`}
        onClick={() => setSidebarOpen(false)}
      />

      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">A</div>
          <div>
            <div className="sidebar-logo-text">ARBC Bank</div>
            <div className="sidebar-logo-sub">Customer Portal</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section-label">Menu</div>
          {SIDEBAR_ITEMS.map(item => (
            <button
              key={item.key}
              className={`nav-item ${view === item.key ? 'active' : ''}`}
              onClick={() => handleNavClick(item.key)}
            >
              <span className="nav-item-icon">{item.icon}</span>
              {item.label}
              {item.key === 'notifications' && notifCount > 0 && (
                <span style={{ marginLeft: 'auto', background: 'var(--danger)', color: '#fff', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 999 }}>
                  {notifCount}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 8 }}>
            Welcome, <strong>{customerName}</strong>
          </div>
          <button className="btn btn-secondary btn-full btn-sm" onClick={onLogout}>
            🚪 Sign Out
          </button>
        </div>
      </aside>

      <div className="main-content">
        <div className="topbar">
          <div className="topbar-left">
            <button className="hamburger" onClick={() => setSidebarOpen(o => !o)}>☰</button>
            <span className="topbar-title">
              {SIDEBAR_ITEMS.find(i => i.key === view)?.label || 'Dashboard'}
            </span>
          </div>
          <div className="topbar-right">
            <button
              className="btn btn-ghost btn-sm"
              style={{ position: 'relative' }}
              onClick={() => handleNavClick('notifications')}
            >
              🔔
              {notifCount > 0 && (
                <span className="notif-count">{notifCount}</span>
              )}
            </button>
            <button className="theme-btn" onClick={toggle} title="Toggle theme">
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', fontWeight: 600 }}>
              👤 {customerName}
            </div>
          </div>
        </div>

        <div className="page-content animate-slide-up">
          {view === 'dashboard'        && <CustomerDashboard onNavigate={setView} />}
          {view === 'accounts'         && <AccountsView onNavigate={setView} />}
          {view === 'transactions'     && <TransactionsView />}
          {view === 'transfer'         && <TransferView onTransferSuccess={() => {}} />}
          {view === 'deposit-requests' && <CustomerDepositRequestsView />}
          {view === 'loans'            && <LoansView />}
          {view === 'beneficiaries'    && <BeneficiariesView />}
          {view === 'fixed-deposits'   && <FixedDepositsView />}
          {view === 'notifications'    && <NotificationsView />}
          {view === 'profile'          && <ProfileView />}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   CUSTOMER DASHBOARD
   ============================================================ */
function CustomerDashboard({ onNavigate }) {
  const toast = useToast();
  const [accounts, setAccounts] = useState([]);
  const [loans, setLoans]       = useState([]);
  const [txns, setTxns]         = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    Promise.all([getMyAccounts(), getMyLoans(), getMyTransactions(0, 8)]).then(([a, l, t]) => {
      setAccounts(a || []);
      setLoans(l || []);
      const list = Array.isArray(t) ? t : (t.content || []);
      setTxns(list);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <><SkeletonCard count={3} /><Skeleton rows={6} /></>;

  const totalBalance = accounts.reduce((s, a) => s + Number(a.balance || 0), 0);
  const activeLoans  = loans.filter(l => l.status === 'ACTIVE');
  const totalEmi     = activeLoans.reduce((s, l) => s + Number(l.emi || 0), 0);

  // Build a mini area chart from txn amounts (last 8)
  const chartData = txns.slice(0, 8).reverse().map((t, i) => ({
    name: `T${i + 1}`,
    amount: Math.abs(Number(t.amount || 0)),
  }));

  return (
    <>
      <div className="section-header">
        <div>
          <div className="section-title">
            Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 17 ? 'Afternoon' : 'Evening'},
            {' '}{localStorage.getItem('amc_customer_name') || 'there'} 👋
          </div>
          <div className="section-subtitle">Here's your financial overview</div>
        </div>
      </div>

      {/* KPIs */}
      <div className="kpi-grid mb-6">
        <div className="kpi-card">
          <div className="kpi-icon green">💰</div>
          <div>
            <div className="kpi-value">{inr(totalBalance)}</div>
            <div className="kpi-label">Total Balance</div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon blue">🏦</div>
          <div>
            <div className="kpi-value">{accounts.length}</div>
            <div className="kpi-label">Active Accounts</div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon amber">💳</div>
          <div>
            <div className="kpi-value">{activeLoans.length}</div>
            <div className="kpi-label">Active Loans</div>
          </div>
        </div>
        {totalEmi > 0 && (
          <div className="kpi-card">
            <div className="kpi-icon red">📋</div>
            <div>
              <div className="kpi-value">{inr(totalEmi)}</div>
              <div className="kpi-label">Monthly EMI</div>
            </div>
          </div>
        )}
      </div>

      {/* Account Cards */}
      {accounts.length > 0 && (
        <div className="mb-6">
          <div className="section-header" style={{ marginBottom: 12 }}>
            <div className="section-title" style={{ fontSize: 'var(--text-base)' }}>My Accounts</div>
            <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('accounts')}>View All →</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
            {accounts.map(a => (
              <div
                key={a.id}
                className={`account-card ${a.type === 'SAVINGS' ? 'savings' : 'current'}`}
                onClick={() => onNavigate('accounts')}
              >
                <div className="flex justify-between items-center">
                  <span className="account-card-type">{a.type}</span>
                  <span className="account-card-status">{a.status}</span>
                </div>
                <div>
                  <div className="account-card-label">Balance</div>
                  <div className="account-card-balance">{inr(a.balance)}</div>
                  <div className="account-card-number">{maskAccount(a.accountNumber)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid-2 mb-6">
        {/* Quick Actions */}
        <div className="card">
          <div className="section-title" style={{ fontSize: 'var(--text-base)', marginBottom: 16 }}>Quick Actions</div>
          <div className="quick-actions">
            {[
              { icon: '💸', label: 'Fund Transfer', view: 'transfer' },
              { icon: '📋', label: 'Transactions', view: 'transactions' },
              { icon: '💳', label: 'Apply Loan', view: 'loans' },
              { icon: '🏛️', label: 'Fixed Deposit', view: 'fixed-deposits' },
            ].map(a => (
              <button key={a.view} className="quick-action" onClick={() => onNavigate(a.view)}>
                <div className="quick-action-icon kpi-icon blue">{a.icon}</div>
                <div className="quick-action-label">{a.label}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Mini Chart */}
        {chartData.length > 0 && (
          <div className="chart-container">
            <div className="chart-title">Recent Transaction Activity</div>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="tGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--brand-500)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--brand-500)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" hide />
                <YAxis hide />
                <Tooltip
                  contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8 }}
                  formatter={v => [inr(v), 'Amount']}
                />
                <Area type="monotone" dataKey="amount" stroke="var(--brand-500)" strokeWidth={2} fill="url(#tGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Recent Transactions */}
      {txns.length > 0 && (
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <div className="section-title" style={{ fontSize: 'var(--text-base)' }}>Recent Transactions</div>
            <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('transactions')}>View All →</button>
          </div>
          <div>
            {txns.slice(0, 5).map(t => {
              const meta = txnMeta(t.type);
              return (
                <div key={t.id} className="flex items-center gap-3" style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                  <div className={`txn-type-icon ${meta.dir}`}>{meta.icon}</div>
                  <div className="flex-1">
                    <div className="font-semibold text-sm">{meta.label}</div>
                    <div className="text-xs text-muted">{t.description || t.reference || '—'}</div>
                  </div>
                  <div className="text-right">
                    <div className={`font-bold text-sm ${meta.dir === 'in' ? 'text-success' : meta.dir === 'out' ? 'text-danger' : ''}`}>
                      {meta.dir === 'in' ? '+' : meta.dir === 'out' ? '-' : ''}{inr(t.amount)}
                    </div>
                    <div className="text-xs text-muted">{fmtDate(t.createdAt)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

/* ============================================================
   ACCOUNTS VIEW
   ============================================================ */
function AccountsView({ onNavigate }) {
  const toast = useToast();
  const [accounts, setAccounts]         = useState([]);
  const [pendingDeposits, setPendingDeposits] = useState(0);
  const [loading, setLoading]           = useState(true);
  const [modal, setModal]               = useState(null); // 'deposit' | 'withdraw'
  const [selAcc, setSelAcc]             = useState(null);
  const [amount, setAmount]             = useState('');
  const [depMode, setDepMode]           = useState('ONLINE');
  const [paymentRef, setPaymentRef]     = useState('');
  const [remarks, setRemarks]           = useState('');
  const [saving, setSaving]             = useState(false);
  const [showFull, setShowFull]         = useState({});

  const load = () => {
    Promise.all([
      getMyAccounts(),
      getCustomerDepositRequests(0, 100, 'PENDING')
    ]).then(([a, depRes]) => {
      setAccounts(a || []);
      const pList = Array.isArray(depRes) ? depRes : (depRes?.content || []);
      const pSum = pList.reduce((sum, r) => sum + Number(r.amount || 0), 0);
      setPendingDeposits(pSum);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleMoney = async e => {
    e.preventDefault();
    setSaving(true);
    try {
      if (modal === 'deposit') {
        const numAmount = parseFloat(amount);
        if (numAmount < 100) {
          toast.error('Validation Error', 'Minimum deposit is ₹100.00');
          setSaving(false);
          return;
        }
        const res = await createDepositRequest(
          selAcc.id,
          numAmount,
          depMode,
          paymentRef.trim(),
          remarks.trim()
        );
        toast.success(
          'Deposit Request Submitted',
          `Deposit of ${inr(numAmount)} queued for bank approval. Ref: ${res.referenceNo}`
        );
      } else {
        await withdrawMyAccount(selAcc.id, amount);
        toast.success('Success', `Withdrawn ${inr(amount)}`);
      }
      setModal(null);
      setAmount('');
      setPaymentRef('');
      setRemarks('');
      load();
    } catch (err) {
      toast.error('Transaction Failed', err.response?.data?.message || err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleShow = id => setShowFull(prev => ({ ...prev, [id]: !prev[id] }));

  return (
    <>
      <div className="section-header">
        <div>
          <div className="section-title">My Accounts</div>
          <div className="section-subtitle">Manage your bank accounts and deposits</div>
        </div>
      </div>

      {pendingDeposits > 0 && (
        <div
          className="card"
          style={{
            background: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            marginBottom: 20,
            padding: '14px 18px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 22 }}>⏳</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--amber-700, #b45309)' }}>
                Pending Deposits: {inr(pendingDeposits)} (Awaiting Bank Approval)
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                Under bank policy, deposits require admin verification. Pending deposits are <strong>never</strong> added to your available balance until approved.
              </div>
            </div>
          </div>
          {onNavigate && (
            <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('deposit-requests')}>
              View Queue →
            </button>
          )}
        </div>
      )}

      {loading ? <SkeletonCard count={2} /> : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16, marginBottom: 24 }}>
            {accounts.map(a => (
              <div
                key={a.id}
                className={`account-card ${a.type === 'SAVINGS' ? 'savings' : 'current'}`}
              >
                <div className="flex justify-between items-center">
                  <span className="account-card-type">{a.type}</span>
                  <span className="account-card-status">{a.status}</span>
                </div>
                <div>
                  <div className="account-card-label">Available Balance</div>
                  <div className="account-card-balance">{inr(a.balance)}</div>
                  <div className="flex items-center gap-2">
                    <div className="account-card-number">{maskAccount(a.accountNumber, showFull[a.id])}</div>
                    <button
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.7)', fontSize: 12 }}
                      onClick={() => toggleShow(a.id)}
                    >
                      {showFull[a.id] ? '🙈' : '👁️'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="table-wrap">
            <table>
              <thead><tr>
                <th>Account No.</th><th>Type</th><th>Available Balance</th><th>Min Balance</th><th>Daily Limit</th><th>Status</th><th>Actions</th>
              </tr></thead>
              <tbody>
                {accounts.map(a => (
                  <tr key={a.id}>
                    <td className="monospace text-sm">{a.accountNumber}</td>
                    <td><span className="badge badge-blue">{a.type}</span></td>
                    <td className="font-bold">{inr(a.balance)}</td>
                    <td className="text-secondary">{inr(a.minimumBalance)}</td>
                    <td className="text-secondary">{inr(a.dailyTransferLimit)}</td>
                    <td><span className={`badge ${statusBadge(a.status)}`}>{a.status}</span></td>
                    <td>
                      <div className="flex gap-2">
                        <button className="btn btn-success btn-sm" onClick={() => { setSelAcc(a); setModal('deposit'); }}>
                          📥 Request Deposit
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={() => { setSelAcc(a); setModal('withdraw'); }}>
                          Withdraw
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {accounts.length === 0 && <tr><td colSpan={7} className="table-empty">No accounts found</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {(modal === 'deposit' || modal === 'withdraw') && selAcc && (
        <Modal
          title={modal === 'deposit' ? '📥 Request Deposit (Requires Bank Approval)' : '💸 Withdraw Funds'}
          onClose={() => setModal(null)}
        >
          {modal === 'deposit' && (
            <div
              style={{
                background: 'rgba(59, 130, 246, 0.08)',
                border: '1px solid rgba(59, 130, 246, 0.25)',
                borderRadius: 'var(--radius)',
                padding: '10px 14px',
                fontSize: 12,
                color: 'var(--brand-600, #2563eb)',
                marginBottom: 14
              }}
            >
              ℹ️ <strong>Maker-Checker Policy:</strong> Funds will NOT be credited directly. Your deposit request will be submitted to the bank admin verification queue and credited after approval.
            </div>
          )}

          <form onSubmit={handleMoney}>
            <div className="form-group">
              <label className="form-label">Account</label>
              <input className="form-input" readOnly value={`${selAcc.type} — ${selAcc.accountNumber}`} />
            </div>
            <div className="form-group">
              <label className="form-label">Current Available Balance</label>
              <input className="form-input" readOnly value={inr(selAcc.balance)} />
            </div>
            <div className="form-group">
              <label className="form-label">Amount (₹) *</label>
              <input
                className="form-input"
                type="number"
                min={modal === 'deposit' ? '100' : '1'}
                step="0.01"
                placeholder={modal === 'deposit' ? 'Min ₹100.00' : '0.00'}
                value={amount}
                onChange={e => setAmount(e.target.value)}
                required
                autoFocus
              />
            </div>

            {modal === 'deposit' && (
              <>
                <div className="form-group">
                  <label className="form-label">Deposit Mode *</label>
                  <select
                    className="form-select"
                    value={depMode}
                    onChange={e => setDepMode(e.target.value)}
                    required
                  >
                    <option value="ONLINE">ONLINE / UPI / NetBanking</option>
                    <option value="CHEQUE">Cheque Deposit</option>
                    <option value="NEFT">NEFT / RTGS Wire</option>
                    <option value="CASH">Branch Cash Deposit</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Payment Reference / UTR / Cheque Number</label>
                  <input
                    className="form-input"
                    type="text"
                    placeholder="e.g. UPI-992144, CHQ-002194"
                    value={paymentRef}
                    onChange={e => setPaymentRef(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Remarks</label>
                  <input
                    className="form-input"
                    type="text"
                    placeholder="e.g. Salary savings, Business funds"
                    value={remarks}
                    onChange={e => setRemarks(e.target.value)}
                  />
                </div>
              </>
            )}

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setModal(null)} disabled={saving}>
                Cancel
              </button>
              <button
                type="submit"
                className={`btn ${modal === 'deposit' ? 'btn-primary' : 'btn-danger'}`}
                disabled={saving}
              >
                {saving ? '⏳ Submitting…' : modal === 'deposit' ? 'Submit Deposit Request' : 'Confirm Withdrawal'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

/* ============================================================
   TRANSACTIONS VIEW
   ============================================================ */
function TransactionsView() {
  const toast = useToast();
  const [txns, setTxns]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage]     = useState(0);
  const [totalPages, setTP] = useState(1);
  const [exporting, setEx]  = useState('');

  const load = (p = 0) => {
    setLoading(true);
    getMyTransactions(p, 10).then(data => {
      const list = Array.isArray(data) ? data : (data.content || []);
      setTxns(list);
      setTP(data.totalPages || 1);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { load(page); }, [page]);

  const handleExport = async type => {
    setEx(type);
    try {
      if (type === 'csv') {
        const blob = await downloadCSV();
        downloadBlob(blob, 'amc-transactions.csv');
        toast.success('Downloaded', 'CSV export complete');
      } else {
        const blob = await downloadPDF();
        downloadBlob(blob, 'amc-transactions.pdf');
        toast.success('Downloaded', 'PDF statement complete');
      }
    } catch {
      toast.error('Export Failed', 'Could not generate export');
    } finally {
      setEx('');
    }
  };

  return (
    <>
      <div className="section-header">
        <div>
          <div className="section-title">Transaction History</div>
          <div className="section-subtitle">Full record of all debits and credits</div>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary btn-sm" onClick={() => handleExport('csv')} disabled={exporting === 'csv'}>
            {exporting === 'csv' ? '⏳' : '📥'} CSV
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => handleExport('pdf')} disabled={exporting === 'pdf'}>
            {exporting === 'pdf' ? '⏳' : '📄'} PDF
          </button>
        </div>
      </div>

      <div className="table-wrap">
        {loading ? <Skeleton rows={8} /> : (
          <table>
            <thead><tr>
              <th>Date</th><th>Type</th><th>Description</th><th>Amount</th><th>Balance After</th>
            </tr></thead>
            <tbody>
              {txns.map(t => {
                const meta = txnMeta(t.type);
                return (
                  <tr key={t.id}>
                    <td className="text-xs text-muted">{fmtDateTime(t.createdAt)}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className={`txn-type-icon ${meta.dir}`}>{meta.icon}</div>
                        <span className="text-sm">{meta.label}</span>
                      </div>
                    </td>
                    <td className="text-secondary text-sm">{t.description || t.reference || '—'}</td>
                    <td className={`font-bold ${meta.dir === 'in' ? 'text-success' : meta.dir === 'out' ? 'text-danger' : ''}`}>
                      {meta.dir === 'in' ? '+' : meta.dir === 'out' ? '-' : ''}{inr(t.amount)}
                    </td>
                    <td className="text-secondary text-sm">{t.balanceAfter != null ? inr(t.balanceAfter) : '—'}</td>
                  </tr>
                );
              })}
              {txns.length === 0 && <tr><td colSpan={5} className="table-empty">No transactions found</td></tr>}
            </tbody>
          </table>
        )}
      </div>

      <div className="pagination">
        <button className="page-btn" onClick={() => setPage(p => p - 1)} disabled={page === 0}>← Prev</button>
        <span className="text-sm text-secondary">Page {page + 1} of {totalPages}</span>
        <button className="page-btn" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages - 1}>Next →</button>
      </div>
    </>
  );
}

// TransferView is imported from ../components/TransferView

/* ============================================================
   LOANS VIEW
   ============================================================ */
function LoansView() {
  const toast = useToast();
  const [loans, setLoans]         = useState([]);
  const [accounts, setAccounts]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [modal, setModal]         = useState(null); // 'apply' | 'schedule' | 'repay' | 'prepay' | 'foreclose'
  const [selLoan, setSelLoan]     = useState(null);
  const [summary, setSummary]     = useState(null);
  const [schedule, setSchedule]   = useState([]);
  const [saving, setSaving]       = useState(false);

  // Apply Form + Interactive Calculator
  const [form, setForm]           = useState({ type: 'HOME', principal: 500000, interestRate: 8.5, tenureMonths: 60 });
  const [preview, setPreview]     = useState(null);

  // Repay Form
  const [repayForm, setRepayForm] = useState({ sourceAccountId: '', amount: '' });

  // Prepay Form
  const [prepayForm, setPrepayForm] = useState({ sourceAccountId: '', prepaymentAmount: '', mode: 'REDUCE_TENURE' });

  // Foreclose Form & Quote
  const [forecloseQuote, setForecloseQuote] = useState(null);
  const [forecloseForm, setForecloseForm]   = useState({ sourceAccountId: '', confirmation: false });

  const loadData = () => {
    Promise.all([getMyLoans(), getMyAccounts()])
      .then(([l, a]) => {
        setLoans(l || []);
        const activeAccs = (a || []).filter(acc => acc.status === 'ACTIVE');
        setAccounts(activeAccs);
        if (activeAccs.length > 0) {
          setRepayForm(f => ({ ...f, sourceAccountId: String(activeAccs[0].id) }));
          setPrepayForm(f => ({ ...f, sourceAccountId: String(activeAccs[0].id) }));
          setForecloseForm(f => ({ ...f, sourceAccountId: String(activeAccs[0].id) }));
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []);

  // Fetch live EMI preview whenever calculator sliders change
  useEffect(() => {
    const p = Number(form.principal);
    const r = Number(form.interestRate);
    const n = Number(form.tenureMonths);
    if (p >= 10000 && r >= 0.1 && n >= 1) {
      previewEmi(p, r, n)
        .then(res => setPreview(res))
        .catch(() => {});
    }
  }, [form.principal, form.interestRate, form.tenureMonths]);

  const openLoanDetails = async (loan) => {
    setSelLoan(loan);
    setModal('schedule');
    try {
      const [sum, sched] = await Promise.all([
        getLoanSummary(loan.id),
        getLoanSchedule(loan.id)
      ]);
      setSummary(sum);
      setSchedule(sched || []);
    } catch {
      toast.error('Load Error', 'Failed to fetch loan schedule');
    }
  };

  const handleApply = async e => {
    e.preventDefault();
    setSaving(true);
    try {
      await applyForLoan({
        type: form.type,
        principal: Number(form.principal),
        interestRate: Number(form.interestRate),
        tenureMonths: Number(form.tenureMonths)
      });
      toast.success('Application Submitted', 'Your loan application is now pending committee review');
      setModal(null);
      loadData();
    } catch (err) {
      toast.error('Application Failed', err.response?.data?.message || err.message);
    } finally {
      setSaving(false);
    }
  };

  const openRepayModal = () => {
    if (!summary || !summary.nextDueAmount) {
      toast.info('No Due Amount', 'This loan has no pending installments');
      return;
    }
    setRepayForm(f => ({
      ...f,
      amount: String(summary.nextDueAmount)
    }));
    setModal('repay');
  };

  const handleRepay = async e => {
    e.preventDefault();
    setSaving(true);
    try {
      await repayLoan(selLoan.id, Number(repayForm.sourceAccountId), repayForm.amount ? Number(repayForm.amount) : null);
      toast.success('Payment Successful', `EMI installment paid successfully`);
      setModal('schedule');
      // Refresh current loan details
      const [sum, sched] = await Promise.all([
        getLoanSummary(selLoan.id),
        getLoanSchedule(selLoan.id)
      ]);
      setSummary(sum);
      setSchedule(sched || []);
      loadData();
    } catch (err) {
      toast.error('Repayment Failed', err.response?.data?.message || err.message);
    } finally {
      setSaving(false);
    }
  };

  const openPrepayModal = () => {
    setPrepayForm(f => ({ ...f, prepaymentAmount: '50000', mode: 'REDUCE_TENURE' }));
    setModal('prepay');
  };

  const handlePrepay = async e => {
    e.preventDefault();
    setSaving(true);
    try {
      await prepayLoan(selLoan.id, Number(prepayForm.sourceAccountId), Number(prepayForm.prepaymentAmount), prepayForm.mode);
      toast.success('Prepayment Processed', `Part prepayment applied with mode ${prepayForm.mode}`);
      setModal('schedule');
      const [sum, sched] = await Promise.all([
        getLoanSummary(selLoan.id),
        getLoanSchedule(selLoan.id)
      ]);
      setSummary(sum);
      setSchedule(sched || []);
      loadData();
    } catch (err) {
      toast.error('Prepayment Failed', err.response?.data?.message || err.message);
    } finally {
      setSaving(false);
    }
  };

  const openForecloseModal = async () => {
    setSaving(true);
    try {
      const quote = await getForeclosureQuote(selLoan.id);
      setForecloseQuote(quote);
      setForecloseForm(f => ({ ...f, confirmation: false }));
      setModal('foreclose');
    } catch (err) {
      toast.error('Quote Error', err.response?.data?.message || 'Could not fetch foreclosure quote');
    } finally {
      setSaving(false);
    }
  };

  const handleForeclose = async e => {
    e.preventDefault();
    setSaving(true);
    try {
      await forecloseLoan(selLoan.id, Number(forecloseForm.sourceAccountId));
      toast.success('Loan Closed', 'Loan has been fully foreclosed and settled');
      setModal(null);
      loadData();
    } catch (err) {
      toast.error('Foreclosure Failed', err.response?.data?.message || err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadCsv = async () => {
    try {
      const blob = await downloadLoanScheduleCsv(selLoan.id);
      downloadBlob(blob, `AMC_Loan_Schedule_${selLoan.id}.csv`);
      toast.success('Downloaded', 'Schedule CSV saved to downloads');
    } catch {
      toast.error('Download Failed', 'Could not export schedule CSV');
    }
  };

  const handleAutoDebitToggle = async () => {
    if (!selLoan) return;
    const newStatus = !(summary && summary.autoDebit);
    const accId = accounts.length > 0 ? accounts[0].id : null;
    try {
      await toggleAutoDebit(selLoan.id, newStatus, accId);
      toast.success('Auto-Debit Updated', newStatus ? 'Auto-debit on due date enabled' : 'Auto-debit disabled');
      const sum = await getLoanSummary(selLoan.id);
      setSummary(sum);
    } catch (err) {
      toast.error('Update Failed', err.response?.data?.message || err.message);
    }
  };

  const activeLoans = loans.filter(l => l.status === 'ACTIVE');

  return (
    <>
      <div className="section-header">
        <div>
          <div className="section-title">Loans & Repayment</div>
          <div className="section-subtitle">Manage amortization schedules, EMI payments, and loan settlement</div>
        </div>
        <button className="btn btn-primary" onClick={() => setModal('apply')}>+ Apply for Loan</button>
      </div>

      {loading ? <Skeleton /> : (
        <>
          {/* Active loan summary cards */}
          {activeLoans.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16, marginBottom: 24 }}>
              {activeLoans.map(l => {
                const emiAmt = l.emi || 0;
                return (
                  <div key={l.id} className="card card-hover" style={{ cursor: 'pointer', border: '1px solid var(--border)' }} onClick={() => openLoanDetails(l)}>
                    <div className="flex justify-between items-center mb-3">
                      <span className="badge badge-green">ACTIVE</span>
                      <span className="badge badge-purple">{l.type} LOAN</span>
                    </div>

                    <div className="text-sm text-secondary">Outstanding Principal</div>
                    <div className="text-3xl font-extrabold mb-2" style={{ color: 'var(--brand)' }}>
                      {inr(l.outstandingPrincipal || l.principal)}
                    </div>

                    <div className="flex justify-between text-xs text-muted mb-2">
                      <span>Initial: {inr(l.principal)}</span>
                      <span>@ {l.interestRate}% p.a.</span>
                    </div>

                    <div style={{ background: 'var(--bg-input)', padding: '10px 14px', borderRadius: 'var(--radius)', marginTop: 8 }}>
                      <div className="flex justify-between text-sm">
                        <span className="text-secondary">Monthly EMI</span>
                        <strong className="text-brand">{inr(emiAmt)}</strong>
                      </div>
                      <div className="flex justify-between text-xs text-muted mt-1">
                        <span>Tenure</span>
                        <span>{l.tenureMonths} Months</span>
                      </div>
                    </div>

                    <button className="btn btn-secondary btn-full btn-sm mt-3" onClick={(e) => { e.stopPropagation(); openLoanDetails(l); }}>
                      View Schedule & Repay ➔
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* All loans table */}
          <div className="card">
            <div className="text-base font-bold mb-3">All Loans Portfolio</div>
            <div className="table-wrap">
              <table>
                <thead><tr>
                  <th>Loan ID</th><th>Type</th><th>Principal</th><th>Outstanding</th><th>Rate</th><th>Tenure</th><th>EMI</th><th>Status</th><th>Actions</th>
                </tr></thead>
                <tbody>
                  {loans.map(l => (
                    <tr key={l.id}>
                      <td className="monospace text-sm">#{l.id}</td>
                      <td><span className="badge badge-purple">{l.type}</span></td>
                      <td className="font-semibold">{inr(l.principal)}</td>
                      <td className="font-semibold text-brand">{inr(l.outstandingPrincipal || l.principal)}</td>
                      <td>{l.interestRate}%</td>
                      <td>{l.tenureMonths} mo</td>
                      <td className="font-semibold">{inr(l.emi)}</td>
                      <td><span className={`badge ${statusBadge(l.status)}`}>{l.status}</span></td>
                      <td>
                        {l.status === 'ACTIVE' && (
                          <button className="btn btn-secondary btn-sm" onClick={() => openLoanDetails(l)}>
                            Schedule & Repay
                          </button>
                        )}
                        {l.status === 'APPLIED' && <span className="text-xs text-muted">Awaiting Underwriting</span>}
                        {l.status === 'CLOSED' && (
                          <button className="btn btn-ghost btn-sm" onClick={() => openLoanDetails(l)}>
                            View Statement
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {loans.length === 0 && <tr><td colSpan={9} className="table-empty">No loans found</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ============================================================
          APPLY FOR LOAN MODAL (WITH INTERACTIVE EMI CALCULATOR)
          ============================================================ */}
      {modal === 'apply' && (
        <Modal title="Loan Application & Interactive Calculator" onClose={() => setModal(null)} size="modal-xl">
          <form onSubmit={handleApply}>
            <div className="form-grid-2">
              <div>
                <div className="text-sm font-bold text-brand mb-3">1. Loan Parameters</div>
                <div className="form-group">
                  <label className="form-label">Loan Type</label>
                  <select className="form-select" value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
                    <option value="HOME">🏠 Home Loan</option>
                    <option value="CAR">🚗 Auto Loan</option>
                    <option value="PERSONAL">👤 Personal Loan</option>
                  </select>
                </div>

                <div className="form-group">
                  <div className="flex justify-between">
                    <label className="form-label">Principal Amount (₹)</label>
                    <span className="text-xs font-bold text-brand">{inr(form.principal)}</span>
                  </div>
                  <input
                    type="range" min="10000" max="5000000" step="10000"
                    value={form.principal}
                    onChange={e => setForm({...form, principal: Number(e.target.value)})}
                    style={{ width: '100%', marginBottom: 6 }}
                  />
                  <input
                    className="form-input" type="number" min="10000" max="10000000"
                    value={form.principal}
                    onChange={e => setForm({...form, principal: Number(e.target.value)})}
                    required
                  />
                </div>

                <div className="form-group">
                  <div className="flex justify-between">
                    <label className="form-label">Interest Rate (% p.a.)</label>
                    <span className="text-xs font-bold text-brand">{form.interestRate}%</span>
                  </div>
                  <input
                    type="range" min="1" max="25" step="0.25"
                    value={form.interestRate}
                    onChange={e => setForm({...form, interestRate: Number(e.target.value)})}
                    style={{ width: '100%', marginBottom: 6 }}
                  />
                  <input
                    className="form-input" type="number" step="0.1" min="0.1" max="50"
                    value={form.interestRate}
                    onChange={e => setForm({...form, interestRate: Number(e.target.value)})}
                    required
                  />
                </div>

                <div className="form-group">
                  <div className="flex justify-between">
                    <label className="form-label">Tenure (Months)</label>
                    <span className="text-xs font-bold text-brand">{form.tenureMonths} Months ({Math.round(form.tenureMonths / 12 * 10) / 10} Yrs)</span>
                  </div>
                  <input
                    type="range" min="6" max="240" step="6"
                    value={form.tenureMonths}
                    onChange={e => setForm({...form, tenureMonths: Number(e.target.value)})}
                    style={{ width: '100%', marginBottom: 6 }}
                  />
                  <input
                    className="form-input" type="number" min="1" max="480"
                    value={form.tenureMonths}
                    onChange={e => setForm({...form, tenureMonths: Number(e.target.value)})}
                    required
                  />
                </div>
              </div>

              {/* Calculator Live Output & Doughnut Chart */}
              <div>
                <div className="text-sm font-bold text-brand mb-3">2. Amortization Breakdown</div>
                {preview ? (
                  <div className="card" style={{ background: 'var(--bg-input)', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, textAlign: 'center', marginBottom: 16 }}>
                      <div style={{ background: 'var(--bg-card)', padding: '12px 8px', borderRadius: 'var(--radius)' }}>
                        <div className="text-xs text-muted">Monthly EMI</div>
                        <div className="text-lg font-extrabold text-brand">{inr(preview.emi)}</div>
                      </div>
                      <div style={{ background: 'var(--bg-card)', padding: '12px 8px', borderRadius: 'var(--radius)' }}>
                        <div className="text-xs text-muted">Total Interest</div>
                        <div className="text-lg font-extrabold text-warning">{inr(preview.totalInterest)}</div>
                      </div>
                      <div style={{ background: 'var(--bg-card)', padding: '12px 8px', borderRadius: 'var(--radius)' }}>
                        <div className="text-xs text-muted">Total Payable</div>
                        <div className="text-lg font-extrabold">{inr(preview.totalPayable)}</div>
                      </div>
                    </div>

                    <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <ResponsiveContainer width="100%" height={160}>
                        <PieChart>
                          <Pie
                            data={[
                              { name: 'Principal', value: Number(form.principal) },
                              { name: 'Total Interest', value: Number(preview.totalInterest) }
                            ]}
                            cx="50%" cy="50%"
                            innerRadius={45} outerRadius={65}
                            paddingAngle={4}
                            dataKey="value"
                          >
                            <Cell fill="#3b82f6" />
                            <Cell fill="#f59e0b" />
                          </Pie>
                          <Tooltip formatter={val => inr(val)} />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="text-xs text-secondary mt-3" style={{ lineHeight: 1.6 }}>
                      • Eligibility check requires account balance $\ge$ 10% of principal.<br />
                      • First installment due 30 days post disbursal.
                    </div>
                  </div>
                ) : <Skeleton />}
              </div>
            </div>

            <div className="modal-footer mt-4">
              <button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary btn-lg" disabled={saving}>
                {saving ? '⏳ Submitting…' : '✉️ Submit Application'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ============================================================
          LOAN SCHEDULE & REPAYMENT DETAIL MODAL
          ============================================================ */}
      {modal === 'schedule' && selLoan && (
        <Modal title={`Loan #${selLoan.id} — ${selLoan.type} Loan Management`} onClose={() => { setModal(null); setSelLoan(null); setSummary(null); setSchedule([]); }} size="modal-xl">
          {summary ? (
            <div>
              {/* Summary KPIs */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
                <div className="card card-sm">
                  <div className="text-xs text-muted">Outstanding Principal</div>
                  <div className="text-xl font-extrabold text-brand">{inr(summary.outstandingPrincipal)}</div>
                  <div className="text-xs text-secondary">Initial: {inr(summary.principal)}</div>
                </div>

                <div className="card card-sm">
                  <div className="text-xs text-muted">Next Due EMI</div>
                  <div className="text-xl font-extrabold" style={{ color: summary.overdueAmount > 0 ? 'var(--danger)' : 'var(--text-primary)' }}>
                    {summary.nextDueAmount > 0 ? inr(summary.nextDueAmount) : 'Settled'}
                  </div>
                  <div className="text-xs text-muted">
                    {summary.nextDueDate ? `Due on ${fmtDate(summary.nextDueDate)}` : 'No pending dues'}
                  </div>
                </div>

                <div className="card card-sm">
                  <div className="text-xs text-muted">Total Interest Paid</div>
                  <div className="text-xl font-extrabold text-warning">{inr(summary.totalInterestPaid)}</div>
                  <div className="text-xs text-muted">Penalty Paid: {inr(summary.totalPenaltyPaid)}</div>
                </div>

                <div className="card card-sm">
                  <div className="text-xs text-muted">Repayment Progress</div>
                  <div className="text-xl font-extrabold">{summary.repaymentProgressPercent}%</div>
                  <div className="text-xs text-secondary">{summary.paidInstallmentsCount} of {summary.paidInstallmentsCount + summary.remainingInstallmentsCount} EMIs</div>
                </div>
              </div>

              {/* Overdue Warning Alert */}
              {summary.overdueAmount > 0 && (
                <div className="card card-sm mb-4" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.4)' }}>
                  <div className="flex justify-between items-center">
                    <div>
                      <strong className="text-danger">⚠️ Overdue Notice:</strong> Total overdue of <strong>{inr(summary.overdueAmount)}</strong> requires immediate attention. A 2% monthly late fee is active.
                    </div>
                    <button className="btn btn-danger btn-sm" onClick={openRepayModal}>Pay Overdue Now</button>
                  </div>
                </div>
              )}

              {/* Action Toolbar */}
              <div className="flex justify-between items-center gap-3 flex-wrap mb-4" style={{ background: 'var(--bg-input)', padding: '10px 14px', borderRadius: 'var(--radius)' }}>
                <div className="flex gap-2 flex-wrap">
                  {selLoan.status === 'ACTIVE' && (
                    <>
                      <button className="btn btn-primary btn-sm" onClick={openRepayModal}>
                        💳 Pay Next EMI
                      </button>
                      <button className="btn btn-secondary btn-sm" onClick={openPrepayModal}>
                        ⚡ Part Prepay
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={openForecloseModal}>
                        🔒 Foreclose Loan
                      </button>
                    </>
                  )}
                  <button className="btn btn-ghost btn-sm" onClick={handleDownloadCsv}>
                    📥 Download CSV Schedule
                  </button>
                </div>

                {selLoan.status === 'ACTIVE' && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-secondary">Auto-Debit:</span>
                    <button
                      className={`btn btn-sm ${summary.autoDebit ? 'btn-success' : 'btn-secondary'}`}
                      onClick={handleAutoDebitToggle}
                    >
                      {summary.autoDebit ? '✓ Enabled' : 'Disabled'}
                    </button>
                  </div>
                )}
              </div>

              {/* Amortization Table */}
              <div className="text-sm font-bold text-brand mb-2">Amortization Schedule</div>
              <div className="table-wrap" style={{ maxHeight: 380, overflowY: 'auto' }}>
                <table>
                  <thead><tr>
                    <th>#</th><th>Due Date</th><th>Opening Bal</th><th>EMI</th><th>Principal</th><th>Interest</th><th>Closing Bal</th><th>Penalty</th><th>Paid</th><th>Status</th>
                  </tr></thead>
                  <tbody>
                    {schedule.length === 0 && <tr><td colSpan={10} className="table-empty">Loading schedule…</td></tr>}
                    {schedule.map(s => (
                      <tr key={s.installmentNo} style={{ background: s.status === 'OVERDUE' ? 'rgba(239, 68, 68, 0.05)' : '' }}>
                        <td className="monospace font-bold">#{s.installmentNo}</td>
                        <td className="text-sm">{fmtDate(s.dueDate)}</td>
                        <td className="text-sm text-secondary">{inr(s.openingBalance)}</td>
                        <td className="font-semibold">{inr(s.emiAmount)}</td>
                        <td className="text-brand text-sm">{inr(s.principalComponent)}</td>
                        <td className="text-warning text-sm">{inr(s.interestComponent)}</td>
                        <td className="text-sm">{inr(s.closingBalance)}</td>
                        <td className="text-sm" style={{ color: s.penaltyAmount > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                          {s.penaltyAmount > 0 ? `+${inr(s.penaltyAmount)}` : '—'}
                        </td>
                        <td className="text-sm">{s.paidAmount > 0 ? inr(s.paidAmount) : '—'}</td>
                        <td>
                          <span className={`badge ${statusBadge(s.status)}`}>{s.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : <Skeleton />}
        </Modal>
      )}

      {/* ============================================================
          PAY NEXT EMI MODAL
          ============================================================ */}
      {modal === 'repay' && summary && (
        <Modal title={`Pay EMI — ${selLoan.type} Loan`} onClose={() => setModal('schedule')}>
          <form onSubmit={handleRepay}>
            <div className="card mb-4" style={{ background: 'var(--bg-input)' }}>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-secondary">Next Installment</span>
                <strong>#{summary.nextInstallmentNo}</strong>
              </div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-secondary">Due Date</span>
                <span>{fmtDate(summary.nextDueDate)}</span>
              </div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-secondary">Outstanding Due Amount</span>
                <strong className="text-xl text-brand">{inr(summary.nextDueAmount)}</strong>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Pay from Account *</label>
              <select
                className="form-select"
                value={repayForm.sourceAccountId}
                onChange={e => setRepayForm({...repayForm, sourceAccountId: e.target.value})}
                required
              >
                {accounts.map(a => (
                  <option key={a.id} value={String(a.id)}>
                    {a.type} — {a.accountNumber} ({inr(a.balance)})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Amount (₹) *</label>
              <input
                className="form-input"
                type="number" step="0.01" min="1"
                value={repayForm.amount}
                onChange={e => setRepayForm({...repayForm, amount: e.target.value})}
                required
              />
              <div className="form-hint">Enter exact total due ({inr(summary.nextDueAmount)}) or partial payment</div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setModal('schedule')}>Back</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? '⏳ Processing Payment…' : `Confirm & Pay ${inr(repayForm.amount || summary.nextDueAmount)}`}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ============================================================
          PART PREPAYMENT MODAL
          ============================================================ */}
      {modal === 'prepay' && summary && (
        <Modal title={`Part Prepayment — ${selLoan.type} Loan`} onClose={() => setModal('schedule')}>
          <form onSubmit={handlePrepay}>
            <div className="card mb-4" style={{ background: 'var(--bg-input)' }}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-secondary">Current Outstanding</span>
                <strong className="text-brand">{inr(summary.outstandingPrincipal)}</strong>
              </div>
              <div className="text-xs text-muted">
                Prepayment reduces principal directly and regenerates your future amortization schedule.
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Debit Source Account *</label>
              <select
                className="form-select"
                value={prepayForm.sourceAccountId}
                onChange={e => setPrepayForm({...prepayForm, sourceAccountId: e.target.value})}
                required
              >
                {accounts.map(a => (
                  <option key={a.id} value={String(a.id)}>
                    {a.type} — {a.accountNumber} ({inr(a.balance)})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Prepayment Amount (₹) *</label>
              <input
                className="form-input"
                type="number" step="1000" min="1000"
                value={prepayForm.prepaymentAmount}
                onChange={e => setPrepayForm({...prepayForm, prepaymentAmount: e.target.value})}
                required
                placeholder="Minimum ₹1,000"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Prepayment Benefit Mode *</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label style={{ border: prepayForm.mode === 'REDUCE_TENURE' ? '2px solid var(--brand)' : '1px solid var(--border)', padding: '10px', borderRadius: 'var(--radius)', cursor: 'pointer' }}>
                  <input
                    type="radio" name="mode" value="REDUCE_TENURE"
                    checked={prepayForm.mode === 'REDUCE_TENURE'}
                    onChange={() => setPrepayForm({...prepayForm, mode: 'REDUCE_TENURE'})}
                  />
                  <div className="font-bold text-xs mt-1">Reduce Tenure</div>
                  <div className="text-xs text-muted">Keep EMI same, pay off earlier</div>
                </label>

                <label style={{ border: prepayForm.mode === 'REDUCE_EMI' ? '2px solid var(--brand)' : '1px solid var(--border)', padding: '10px', borderRadius: 'var(--radius)', cursor: 'pointer' }}>
                  <input
                    type="radio" name="mode" value="REDUCE_EMI"
                    checked={prepayForm.mode === 'REDUCE_EMI'}
                    onChange={() => setPrepayForm({...prepayForm, mode: 'REDUCE_EMI'})}
                  />
                  <div className="font-bold text-xs mt-1">Reduce Monthly EMI</div>
                  <div className="text-xs text-muted">Keep duration, lower EMI burden</div>
                </label>
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setModal('schedule')}>Back</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? '⏳ Processing…' : `Confirm Prepayment (${inr(prepayForm.prepaymentAmount || 0)})`}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ============================================================
          LOAN FORECLOSURE MODAL
          ============================================================ */}
      {modal === 'foreclose' && forecloseQuote && (
        <Modal title={`Full Loan Foreclosure Settlement`} onClose={() => setModal('schedule')}>
          <form onSubmit={handleForeclose}>
            <div className="card mb-4" style={{ background: 'var(--bg-input)' }}>
              <div className="text-sm font-bold text-brand mb-2">Foreclosure Settlement Quote</div>
              <div className="flex justify-between text-sm py-1 border-b">
                <span className="text-secondary">Outstanding Principal</span>
                <span>{inr(forecloseQuote.outstandingPrincipal)}</span>
              </div>
              <div className="flex justify-between text-sm py-1 border-b">
                <span className="text-secondary">Accrued Interest</span>
                <span>{inr(forecloseQuote.accruedInterest)}</span>
              </div>
              <div className="flex justify-between text-sm py-1 border-b">
                <span className="text-secondary">Foreclosure Fee ({forecloseQuote.foreclosureFeeRate}%)</span>
                <span>{inr(forecloseQuote.foreclosureFee)}</span>
              </div>
              {forecloseQuote.pendingPenalties > 0 && (
                <div className="flex justify-between text-sm py-1 border-b text-danger">
                  <span>Overdue Late Fees</span>
                  <span>+{inr(forecloseQuote.pendingPenalties)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-extrabold pt-2 text-brand">
                <span>Total Settlement Amount</span>
                <span>{inr(forecloseQuote.totalForeclosureAmount)}</span>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Settlement Source Account *</label>
              <select
                className="form-select"
                value={forecloseForm.sourceAccountId}
                onChange={e => setForecloseForm({...forecloseForm, sourceAccountId: e.target.value})}
                required
              >
                {accounts.map(a => (
                  <option key={a.id} value={String(a.id)}>
                    {a.type} — {a.accountNumber} ({inr(a.balance)})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={forecloseForm.confirmation}
                  onChange={e => setForecloseForm({...forecloseForm, confirmation: e.target.checked})}
                  required
                />
                <span className="text-xs">
                  I confirm full settlement of <strong>{inr(forecloseQuote.totalForeclosureAmount)}</strong> and request immediate loan closure.
                </span>
              </label>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setModal('schedule')}>Back</button>
              <button type="submit" className="btn btn-danger" disabled={saving || !forecloseForm.confirmation}>
                {saving ? '⏳ Closing Loan…' : `Pay ${inr(forecloseQuote.totalForeclosureAmount)} & Close Loan`}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

/* ============================================================
   BENEFICIARIES VIEW
   ============================================================ */
function BeneficiariesView() {
  const toast = useToast();
  const [beneficiaries, setBeneficiaries] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [modal, setModal]       = useState(null);
  const [form, setForm]         = useState({ name:'', accountNumber:'', bankName:'ARBC Bank', ifscCode:'' });
  const [saving, setSaving]     = useState(false);
  const [delId, setDelId]       = useState(null);

  const load = () => getMyBeneficiaries().then(b => { setBeneficiaries(b || []); setLoading(false); });
  useEffect(() => { load(); }, []);

  const handleAdd = async e => {
    e.preventDefault();
    setSaving(true);
    try {
      await addBeneficiary(form);
      toast.success('Beneficiary Added', `${form.name} saved`);
      setModal(null);
      load();
    } catch (err) {
      toast.error('Error', err.response?.data?.message || err.message);
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      await deleteBeneficiary(delId);
      toast.success('Removed', 'Beneficiary deleted');
      setDelId(null);
      load();
    } catch (err) {
      toast.error('Error', err.response?.data?.message || err.message);
    } finally { setSaving(false); }
  };

  return (
    <>
      <div className="section-header">
        <div>
          <div className="section-title">Beneficiaries</div>
          <div className="section-subtitle">Saved recipients for quick fund transfers</div>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm({ name:'', accountNumber:'', bankName:'ARBC Bank', ifscCode:'' }); setModal('add'); }}>
          + Add Beneficiary
        </button>
      </div>

      {loading ? <Skeleton /> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
          {beneficiaries.map(b => (
            <div key={b.id} className="card card-sm">
              <div className="flex justify-between items-start mb-3">
                <div style={{ width: 40, height: 40, borderRadius: 'var(--radius)', background: 'var(--bg-active)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                  👤
                </div>
                <button className="btn btn-danger btn-sm" onClick={() => setDelId(b.id)}>Remove</button>
              </div>
              <div className="font-semibold">{b.name}</div>
              <div className="text-xs text-muted monospace mt-1">{b.accountNumber}</div>
              <div className="text-xs text-secondary mt-1">{b.bankName}</div>
            </div>
          ))}
          {beneficiaries.length === 0 && (
            <div className="text-center text-muted text-sm" style={{ gridColumn: '1/-1', padding: '40px' }}>
              No saved beneficiaries. Add one to transfer funds quickly.
            </div>
          )}
        </div>
      )}

      {modal === 'add' && (
        <Modal title="Add Beneficiary" onClose={() => setModal(null)}>
          <form onSubmit={handleAdd}>
            <div className="form-group">
              <label className="form-label">Name *</label>
              <input className="form-input" value={form.name} onChange={e => setForm({...form, name:e.target.value})} required />
            </div>
            <div className="form-group">
              <label className="form-label">Account Number *</label>
              <input className="form-input" value={form.accountNumber} onChange={e => setForm({...form, accountNumber:e.target.value})} required />
            </div>
            <div className="form-group">
              <label className="form-label">Bank Name</label>
              <input className="form-input" value={form.bankName} onChange={e => setForm({...form, bankName:e.target.value})} />
            </div>
            <div className="form-group">
              <label className="form-label">IFSC Code</label>
              <input className="form-input" value={form.ifscCode} onChange={e => setForm({...form, ifscCode:e.target.value.toUpperCase()})} placeholder="AMC0000001" />
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? '⏳ Saving…' : 'Add Beneficiary'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {delId && (
        <ConfirmModal
          title="Remove Beneficiary"
          message="Are you sure you want to remove this beneficiary?"
          confirmLabel="Remove"
          danger
          onConfirm={handleDelete}
          onClose={() => setDelId(null)}
          loading={saving}
        />
      )}
    </>
  );
}

/* ============================================================
   FIXED DEPOSITS VIEW
   ============================================================ */
function FixedDepositsView() {
  const toast = useToast();
  const [fds, setFDs]             = useState([]);
  const [accounts, setAccounts]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [modal, setModal]         = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [closingFd, setClosingFd] = useState(null);
  const [closingLoading, setClosingLoading] = useState(false);
  const [form, setForm]           = useState({ sourceAccountId: '', amount: '', tenureMonths: '12' });
  const [saving, setSaving]       = useState(false);

  const load = () => Promise.all([getMyFDs(), getMyAccounts()]).then(([f, a]) => {
    setFDs(f || []);
    const activeAccs = (a || []).filter(acc => acc.status === 'ACTIVE');
    setAccounts(activeAccs);
    if (activeAccs.length) setForm(x => ({ ...x, sourceAccountId: x.sourceAccountId || String(activeAccs[0].id) }));
    setLoading(false);
  }).catch(err => {
    toast.error('Failed to load fixed deposits', err.message);
    setLoading(false);
  });

  useEffect(() => { load(); }, []);

  const rates = { 3: 5.0, 6: 5.5, 12: 6.5, 24: 7.0, 36: 7.5, 60: 8.0 };
  const rate = rates[Number(form.tenureMonths)] || 6.5;

  // Quarterly Compounding: A = P * (1 + (r / 400))^(4 * t)
  const calcMaturity = (p, r, m) => {
    const principal = Number(p || 0);
    if (principal <= 0) return 0;
    const rateVal = Number(r) / 100.0;
    const n = 4.0;
    const t = Number(m) / 12.0;
    const maturity = principal * Math.pow(1.0 + (rateVal / n), n * t);
    return Math.round(maturity * 100) / 100;
  };

  const maturityAmt = form.amount ? calcMaturity(form.amount, rate, form.tenureMonths) : 0;
  const interestEarned = maturityAmt > 0 ? (maturityAmt - Number(form.amount)).toFixed(2) : 0;

  const selectedSourceAcc = accounts.find(a => String(a.id) === String(form.sourceAccountId));

  const handleOpenClick = e => {
    e.preventDefault();
    if (!form.amount || Number(form.amount) < 5000) {
      toast.error('Invalid Amount', 'Minimum Fixed Deposit amount is ₹5,000');
      return;
    }
    if (selectedSourceAcc) {
      const minBal = selectedSourceAcc.minimumBalance || 0;
      if (selectedSourceAcc.balance - Number(form.amount) < minBal) {
        toast.error('Insufficient Balance', `Maintaining minimum balance of ${inr(minBal)} is required.`);
        return;
      }
    }
    setConfirmOpen(true);
  };

  const handleConfirmCreate = async () => {
    setSaving(true);
    try {
      await createFixedDeposit(form.sourceAccountId, Number(form.amount), Number(form.tenureMonths));
      toast.success('FD Created Successfully', `Fixed deposit of ${inr(form.amount)} opened.`);
      setConfirmOpen(false);
      setModal(false);
      setForm(prev => ({ ...prev, amount: '' }));
      load();
    } catch (err) {
      toast.error('FD Creation Failed', err.response?.data?.message || err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCloseFd = async () => {
    if (!closingFd) return;
    setClosingLoading(true);
    try {
      const res = await closeFixedDeposit(closingFd.id);
      const payoutMsg = res.prematurePayout ? `Payout of ${inr(res.prematurePayout)} credited.` : 'Proceeds credited to source account.';
      toast.success('FD Closed Prematurely', payoutMsg);
      setClosingFd(null);
      load();
    } catch (err) {
      toast.error('Closure Failed', err.response?.data?.message || err.message);
    } finally {
      setClosingLoading(false);
    }
  };

  // Premature payout estimate: 1.0% interest rate penalty
  const estimatePrematurePayout = (fd) => {
    if (!fd) return 0;
    const p = Number(fd.principalAmount || fd.amount || 0);
    const start = new Date(fd.startDate);
    const now = new Date();
    const daysElapsed = Math.max(1, Math.floor((now - start) / (1000 * 60 * 60 * 24)));
    if (daysElapsed < 7) return p;
    const penaltyRate = Math.max(0.5, (fd.interestRate || 6.5) - 1.0);
    const yearsElapsed = daysElapsed / 365.25;
    return Math.round(p * Math.pow(1.0 + (penaltyRate / 400.0), 4.0 * yearsElapsed) * 100) / 100;
  };

  return (
    <>
      <div className="section-header">
        <div>
          <div className="section-title">Fixed Deposits</div>
          <div className="section-subtitle">Guaranteed high-yield returns with quarterly compounding interest</div>
        </div>
        <button className="btn btn-primary" onClick={() => setModal(true)}>+ Open New FD</button>
      </div>

      {/* Rate Card */}
      <div className="card mb-6" style={{ background: 'linear-gradient(135deg, var(--brand-900), var(--brand-700))', color: 'white', border: 'none' }}>
        <div className="text-sm font-semibold mb-3" style={{ opacity: .8 }}>Current ARBC Bank FD Interest Slabs (Quarterly Compounding)</div>
        <div className="flex gap-4 flex-wrap">
          {Object.entries(rates).map(([months, r]) => (
            <div key={months} style={{ textAlign: 'center', minWidth: 80 }}>
              <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 800 }}>{r}%</div>
              <div style={{ fontSize: 'var(--text-xs)', opacity: .75 }}>{months} months</div>
            </div>
          ))}
        </div>
      </div>

      {loading ? <Skeleton rows={4} /> : (
        <>
          {/* Desktop Table View */}
          <div className="table-wrap hidden md:block">
            <table>
              <thead>
                <tr>
                  <th>FD Number</th>
                  <th>Principal</th>
                  <th>Rate</th>
                  <th>Tenure</th>
                  <th>Start Date</th>
                  <th>Maturity Date</th>
                  <th>Maturity Amount</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {fds.map(fd => {
                  const num = fd.depositNumber || fd.fdNumber || `FD${fd.id}`;
                  const principal = fd.principalAmount || fd.amount;
                  return (
                    <tr key={fd.id}>
                      <td className="monospace font-semibold text-sm">{num}</td>
                      <td className="font-bold text-base">{inr(principal)}</td>
                      <td><span className="badge badge-blue">{fd.interestRate}% p.a.</span></td>
                      <td>{fd.tenureMonths} mo</td>
                      <td className="text-sm text-secondary">{fmtDate(fd.startDate)}</td>
                      <td className="text-sm text-secondary">{fmtDate(fd.maturityDate)}</td>
                      <td className="font-bold text-success text-base">{inr(fd.maturityAmount)}</td>
                      <td>
                        <span className={`badge ${statusBadge(fd.status)}`}>
                          {fd.status}
                        </span>
                      </td>
                      <td>
                        {fd.status === 'ACTIVE' ? (
                          <button
                            className="btn btn-secondary btn-xs"
                            onClick={() => setClosingFd(fd)}
                            title="Close FD before maturity"
                          >
                            Close FD
                          </button>
                        ) : (
                          <span className="text-xs text-muted">Completed</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {fds.length === 0 && (
                  <tr>
                    <td colSpan={9} className="table-empty py-8 text-center text-muted">
                      <div className="text-3xl mb-2">🏛️</div>
                      <div className="font-semibold">No Fixed Deposits found</div>
                      <div className="text-xs">Start building safe, guaranteed wealth by opening your first FD today.</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden flex flex-col gap-3">
            {fds.map(fd => {
              const num = fd.depositNumber || fd.fdNumber || `FD${fd.id}`;
              const principal = fd.principalAmount || fd.amount;
              return (
                <div key={fd.id} className="card p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="monospace font-bold text-sm">{num}</div>
                      <div className="text-xs text-muted">{fd.tenureMonths} Months @ {fd.interestRate}% p.a.</div>
                    </div>
                    <span className={`badge ${statusBadge(fd.status)}`}>{fd.status}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 my-3 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                    <div>
                      <span className="text-xs text-muted block">Principal</span>
                      <span className="font-bold">{inr(principal)}</span>
                    </div>
                    <div>
                      <span className="text-xs text-muted block">Maturity Amount</span>
                      <span className="font-bold text-success">{inr(fd.maturityAmount)}</span>
                    </div>
                    <div>
                      <span className="text-xs text-muted block">Opened</span>
                      <span className="text-xs text-secondary">{fmtDate(fd.startDate)}</span>
                    </div>
                    <div>
                      <span className="text-xs text-muted block">Maturity Date</span>
                      <span className="text-xs text-secondary">{fmtDate(fd.maturityDate)}</span>
                    </div>
                  </div>

                  {fd.status === 'ACTIVE' && (
                    <button
                      className="btn btn-secondary btn-sm w-full mt-2"
                      onClick={() => setClosingFd(fd)}
                    >
                      Close FD
                    </button>
                  )}
                </div>
              );
            })}
            {fds.length === 0 && (
              <div className="card p-6 text-center text-muted">
                <div className="text-3xl mb-2">🏛️</div>
                <div>No Fixed Deposits found</div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Open FD Modal */}
      {modal && !confirmOpen && (
        <Modal title="Open Fixed Deposit" onClose={() => setModal(false)}>
          <form onSubmit={handleOpenClick}>
            <div className="form-group">
              <label className="form-label">Source Account</label>
              <select
                className="form-select"
                value={form.sourceAccountId}
                onChange={e => setForm({...form, sourceAccountId: e.target.value})}
                required
              >
                {accounts.map(a => (
                  <option key={a.id} value={String(a.id)}>
                    {a.type} — {a.maskedAccountNumber || a.accountNumber} (Available: {inr(a.balance)})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Deposit Amount (₹) *</label>
              <input
                className="form-input"
                type="number"
                min="5000"
                step="500"
                value={form.amount}
                onChange={e => setForm({...form, amount: e.target.value})}
                required
                placeholder="Minimum ₹5,000"
              />
              <span className="text-xs text-muted mt-1 block">Minimum deposit is ₹5,000.</span>
            </div>

            <div className="form-group">
              <label className="form-label">Tenure (Months)</label>
              <select
                className="form-select"
                value={form.tenureMonths}
                onChange={e => setForm({...form, tenureMonths: e.target.value})}
              >
                {Object.keys(rates).map(m => (
                  <option key={m} value={m}>{m} months ({rates[m]}% p.a. quarterly compounded)</option>
                ))}
              </select>
            </div>

            {maturityAmt > 0 && (
              <div className="card card-sm mt-4" style={{ background: 'var(--bg-active)', border: '1px solid rgba(16,185,129,.3)' }}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-muted">Maturity Amount (Quarterly Compounding):</span>
                  <span className="text-xl font-extrabold text-success">{inr(maturityAmt)}</span>
                </div>
                <div className="text-xs text-muted flex justify-between">
                  <span>Interest Earned:</span>
                  <span className="font-semibold text-primary">{inr(interestEarned)}</span>
                </div>
              </div>
            )}

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Continue to Review →</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Open FD Confirmation Step */}
      {confirmOpen && (
        <Modal title="Confirm Fixed Deposit Opening" onClose={() => setConfirmOpen(false)}>
          <div className="p-2">
            <p className="text-sm text-secondary mb-4">
              Please review your Fixed Deposit details before confirming. The principal amount will be immediately debited from your selected account.
            </p>

            <div className="card p-3 mb-4" style={{ background: 'var(--bg-secondary)' }}>
              <div className="flex justify-between py-1 border-b" style={{ borderColor: 'var(--border)' }}>
                <span className="text-sm text-muted">Source Account:</span>
                <span className="text-sm font-semibold">{selectedSourceAcc ? `${selectedSourceAcc.type} (${selectedSourceAcc.maskedAccountNumber || selectedSourceAcc.accountNumber})` : 'N/A'}</span>
              </div>
              <div className="flex justify-between py-1 border-b" style={{ borderColor: 'var(--border)' }}>
                <span className="text-sm text-muted">Principal Amount:</span>
                <span className="text-sm font-bold">{inr(form.amount)}</span>
              </div>
              <div className="flex justify-between py-1 border-b" style={{ borderColor: 'var(--border)' }}>
                <span className="text-sm text-muted">Interest Rate:</span>
                <span className="text-sm font-semibold">{rate}% p.a.</span>
              </div>
              <div className="flex justify-between py-1 border-b" style={{ borderColor: 'var(--border)' }}>
                <span className="text-sm text-muted">Tenure:</span>
                <span className="text-sm font-semibold">{form.tenureMonths} Months</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-sm text-muted">Estimated Maturity Payout:</span>
                <span className="text-sm font-bold text-success">{inr(maturityAmt)}</span>
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setConfirmOpen(false)}>← Back</button>
              <button type="button" className="btn btn-success" onClick={handleConfirmCreate} disabled={saving}>
                {saving ? '⏳ Debiting & Opening…' : '🏛️ Confirm & Open FD'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Premature Close Confirmation Modal */}
      {closingFd && (
        <Modal title="Premature Fixed Deposit Closure" onClose={() => setClosingFd(null)}>
          <div className="p-2">
            <p className="text-sm text-secondary mb-3">
              Are you sure you want to close FD <strong className="monospace">{closingFd.depositNumber || closingFd.fdNumber}</strong> prematurely?
            </p>

            <div className="card p-3 mb-4" style={{ borderColor: 'var(--danger)', background: 'rgba(239, 68, 68, 0.04)' }}>
              <div className="text-xs text-danger font-semibold mb-2">⚠️ Premature Closure Penalty Terms</div>
              <div className="text-xs text-secondary mb-2">
                A 1.0% interest rate penalty applies to premature withdrawals. If closed within 7 days of opening, zero interest is payable.
              </div>
              <div className="flex justify-between py-1 border-t" style={{ borderColor: 'var(--border)' }}>
                <span className="text-sm text-muted">Original Principal:</span>
                <span className="text-sm font-bold">{inr(closingFd.principalAmount || closingFd.amount)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-sm text-muted">Estimated Closure Payout:</span>
                <span className="text-sm font-extrabold text-success">{inr(estimatePrematurePayout(closingFd))}</span>
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setClosingFd(null)}>Cancel</button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleCloseFd}
                disabled={closingLoading}
              >
                {closingLoading ? '⏳ Processing Closure…' : 'Confirm Premature Closure'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

/* ============================================================
   NOTIFICATIONS VIEW
   ============================================================ */
function NotificationsView() {
  const [notifs, setNotifs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMyNotifications().then(n => {
      const list = Array.isArray(n) ? n : (n.content || []);
      setNotifs(list);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const iconMap = { CREDIT: '💰', DEBIT: '💸', LOAN: '💳', SYSTEM: '🔔', ALERT: '⚠️' };

  return (
    <>
      <div className="section-header">
        <div>
          <div className="section-title">Notifications</div>
          <div className="section-subtitle">Your banking alerts and messages</div>
        </div>
      </div>

      {loading ? <Skeleton rows={6} /> : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {notifs.map((n, i) => (
            <div key={n.id}
              style={{
                padding: '16px 20px',
                borderBottom: i < notifs.length - 1 ? '1px solid var(--border)' : 'none',
                background: n.read ? 'transparent' : 'var(--bg-active)',
                display: 'flex', alignItems: 'flex-start', gap: 16
              }}
            >
              <div style={{ fontSize: 22 }}>{iconMap[n.type] || '🔔'}</div>
              <div className="flex-1">
                <div className="font-semibold text-sm">{n.title || n.message}</div>
                {n.title && <div className="text-xs text-secondary mt-1">{n.message}</div>}
                <div className="text-xs text-muted mt-2">{fmtDateTime(n.createdAt)}</div>
              </div>
              {!n.read && <div className="badge badge-blue">New</div>}
            </div>
          ))}
          {notifs.length === 0 && (
            <div className="table-empty" style={{ padding: '48px 24px' }}>🔔 No notifications</div>
          )}
        </div>
      )}
    </>
  );
}

/* ============================================================
   PROFILE VIEW
   ============================================================ */
function ProfileView() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMyProfile().then(p => { setProfile(p); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <Skeleton rows={8} />;

  const p = profile || {};

  return (
    <>
      <div className="section-header">
        <div>
          <div className="section-title">My Profile</div>
          <div className="section-subtitle">Your personal and KYC information</div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="text-base font-bold mb-4">Personal Information</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '12px 24px', alignItems: 'center' }}>
            {[
              ['Full Name', p.name],
              ['Email', p.email],
              ['City', p.city || '—'],
              ['Phone', p.phoneNumber || '—'],
            ].map(([label, value]) => (
              <>
                <div key={label + 'l'} className="text-xs text-muted font-semibold">{label}</div>
                <div key={label + 'v'} className="text-sm font-semibold">{value}</div>
              </>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="text-base font-bold mb-4">KYC & Verification</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '12px 24px', alignItems: 'center' }}>
            {[
              ['PAN Number', p.panNumber],
              ['Aadhaar', p.aadhaarNumber ? '•••••••••' + String(p.aadhaarNumber).slice(-4) : '—'],
              ['KYC Status', null],
            ].map(([label, value]) => (
              <>
                <div key={label + 'l'} className="text-xs text-muted font-semibold">{label}</div>
                <div key={label + 'v'} className="text-sm font-semibold">
                  {value === null
                    ? <span className={`badge ${statusBadge(p.kycStatus)}`}>{p.kycStatus || 'PENDING'}</span>
                    : value
                  }
                </div>
              </>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="text-base font-bold mb-4">Account Security</div>
          <div className="text-sm text-secondary" style={{ lineHeight: 1.9 }}>
            <div>🔐 Login ID: <strong>{p.email}</strong></div>
            <div>🛡️ Password: ••••••••</div>
            <div>📱 MFA: Not configured</div>
          </div>
          <button className="btn btn-secondary btn-sm mt-4" disabled style={{ cursor: 'not-allowed' }}>
            Change Password (Coming Soon)
          </button>
        </div>
      </div>
    </>
  );
}
