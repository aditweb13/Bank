import { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import {
  getDashboard, getCustomers, getCustomer, createCustomer, updateCustomer, deleteCustomer,
  getAllAccounts, getCustomerAccounts, openAccount, adminDeposit, adminWithdraw, getAllLoans,
  sanctionLoan, updateLoanDecision, getAuditLogs, getCustomerLoans,
  getOverdueLoans, triggerOverdueJob, getLoanSchedule, getLoanSummary,
  updateAccountStatus, getPendingDepositCount
} from '../services/api';
import { inr, fmtDate, fmtDateTime, statusBadge } from '../utils/format';
import Modal, { ConfirmModal } from '../components/Modal';
import Skeleton, { SkeletonCard } from '../components/Skeleton';
import AdminApprovalsView from '../components/AdminApprovalsView';
import AdminTransfersView from '../components/AdminTransfersView';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';

const SIDEBAR_ITEMS = [
  { key: 'dashboard', label: 'Dashboard',         icon: '📊' },
  { key: 'approvals', label: 'Deposit Approvals', icon: '✅' },
  { key: 'transfers', label: 'All Transfers',     icon: '💸' },
  { key: 'customers', label: 'Customers',         icon: '👥' },
  { key: 'accounts',  label: 'Accounts',          icon: '🏦' },
  { key: 'loans',     label: 'Loans',             icon: '💳' },
  { key: 'overdue',   label: 'Overdue Report',    icon: '⚠️' },
  { key: 'audit',     label: 'Audit Logs',        icon: '🔍' },
];

export default function AdminApp({ onLogout }) {
  const [view, setView]             = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { theme, toggle }           = useTheme();
  const username = localStorage.getItem('amc_username') || 'admin';

  return (
    <div className="app-shell">
      {/* Sidebar Overlay (mobile) */}
      <div
        className={`sidebar-overlay ${sidebarOpen ? '' : 'hidden'}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">A</div>
          <div>
            <div className="sidebar-logo-text">AMC Bank</div>
            <div className="sidebar-logo-sub">Admin Portal</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section-label">Navigation</div>
          {SIDEBAR_ITEMS.map(item => (
            <button
              key={item.key}
              className={`nav-item ${view === item.key ? 'active' : ''}`}
              onClick={() => { setView(item.key); setSidebarOpen(false); }}
            >
              <span className="nav-item-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 8 }}>
            Signed in as <strong>{username}</strong>
          </div>
          <button className="btn btn-secondary btn-full btn-sm" onClick={onLogout}>
            🚪 Sign Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="main-content">
        {/* Topbar */}
        <div className="topbar">
          <div className="topbar-left">
            <button className="hamburger" onClick={() => setSidebarOpen(o => !o)}>☰</button>
            <span className="topbar-title">
              {SIDEBAR_ITEMS.find(i => i.key === view)?.label || 'Dashboard'}
            </span>
          </div>
          <div className="topbar-right">
            <button className="theme-btn" onClick={toggle} title="Toggle theme">
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', fontWeight: 600 }}>
              👤 {username}
            </div>
          </div>
        </div>

        <div className="page-content animate-slide-up">
          {view === 'dashboard' && <AdminDashboard onNavigate={setView} />}
          {view === 'approvals' && <AdminApprovalsView />}
          {view === 'transfers' && <AdminTransfersView />}
          {view === 'customers' && <CustomersView />}
          {view === 'accounts'  && <AccountsView />}
          {view === 'loans'     && <LoansView />}
          {view === 'overdue'   && <OverdueView />}
          {view === 'audit'     && <AuditView />}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   ADMIN DASHBOARD
   ============================================================ */
function AdminDashboard({ onNavigate }) {
  const [stats, setStats]  = useState(null);
  const [loans, setLoans]  = useState([]);
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getDashboard(), getAllLoans(), getPendingDepositCount()]).then(([s, l, p]) => {
      setStats(s);
      setLoans(l);
      setPendingApprovals(p?.pendingCount ?? 0);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <><SkeletonCard count={4} /><Skeleton rows={8} /></>;

  const loanStatuses = ['APPLIED', 'ACTIVE', 'APPROVED', 'REJECTED', 'CLOSED'];
  const pieData = loanStatuses.map(s => ({
    name: s,
    value: loans.filter(l => l.status === s).length
  })).filter(d => d.value > 0);

  const COLORS = ['#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#6b7280'];

  const totalLoanValue = loans
    .filter(l => l.status === 'ACTIVE')
    .reduce((sum, l) => sum + Number(l.principal || 0), 0);

  return (
    <>
      <div className="section-header">
        <div>
          <div className="section-title">Admin Dashboard</div>
          <div className="section-subtitle">Real-time banking operations overview</div>
        </div>
      </div>

      <div className="kpi-grid mb-6">
        <div style={{ cursor: 'pointer' }} onClick={() => onNavigate && onNavigate('approvals')} title="Click to view Deposit Approvals">
          <KPICard icon="📥" iconClass="amber" label="Pending Deposit Approvals" value={pendingApprovals} />
        </div>
        <KPICard icon="👥" iconClass="blue"   label="Total Customers" value={stats?.customers ?? 0} />
        <KPICard icon="🏦" iconClass="green"  label="Active Accounts" value={stats?.activeAccounts ?? 0} />
        <KPICard icon="💳" iconClass="amber"  label="Active Loans"    value={stats?.activeLoans ?? 0} />
        <KPICard icon="💰" iconClass="purple" label="Loan Portfolio"  value={inr(totalLoanValue)} />
        <KPICard icon="📋" iconClass="cyan"   label="Pending Applications"
          value={loans.filter(l => l.status === 'APPLIED').length} />
      </div>

      <div className="grid-2 mb-6">
        {/* Loan Portfolio Pie */}
        <div className="chart-container">
          <div className="chart-title">Loan Status Distribution</div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Legend />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Recent Loans Bar */}
        <div className="chart-container">
          <div className="chart-title">Loan Types</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={['HOME', 'CAR', 'PERSONAL'].map(type => ({
              type,
              count: loans.filter(l => l.type === type).length,
              value: loans.filter(l => l.type === type).reduce((s, l) => s + Number(l.principal || 0), 0)
            }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="type" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
              <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
              <Tooltip
                contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8 }}
                labelStyle={{ color: 'var(--text-primary)' }}
              />
              <Bar dataKey="count" fill="var(--brand-500)" radius={[4,4,0,0]} name="Count" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Pending Applications */}
      {loans.filter(l => l.status === 'APPLIED').length > 0 && (
        <div className="card">
          <div className="section-header" style={{ marginBottom: 12 }}>
            <div className="section-title" style={{ fontSize: 'var(--text-base)' }}>
              ⚠️ Pending Loan Applications
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr>
                <th>Customer</th><th>Type</th><th>Principal</th><th>Rate</th><th>Tenure</th><th>EMI</th>
              </tr></thead>
              <tbody>
                {loans.filter(l => l.status === 'APPLIED').map(l => (
                  <tr key={l.id}>
                    <td className="font-semibold">{l.customerName || `Customer #${l.customerId}`}</td>
                    <td><span className="badge badge-blue">{l.type}</span></td>
                    <td className="font-semibold">{inr(l.principal)}</td>
                    <td>{l.interestRate}%</td>
                    <td>{l.tenureMonths} mo</td>
                    <td>{inr(l.emi)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

function KPICard({ icon, iconClass, label, value }) {
  return (
    <div className="kpi-card">
      <div className={`kpi-icon ${iconClass}`}>{icon}</div>
      <div>
        <div className="kpi-value">{value}</div>
        <div className="kpi-label">{label}</div>
      </div>
    </div>
  );
}

/* ============================================================
   CUSTOMERS VIEW
   ============================================================ */
function CustomersView() {
  const toast = useToast();
  const [customers, setCustomers] = useState([]);
  const [search, setSearch]       = useState('');
  const [loading, setLoading]     = useState(true);
  const [modal, setModal]         = useState(null); // 'add' | 'edit' | 'view' | 'delete'
  const [selected, setSelected]   = useState(null);
  const [form, setForm]           = useState({ name:'', email:'', city:'', panNumber:'', phoneNumber:'', initialPassword:'' });
  const [saving, setSaving]       = useState(false);

  const load = async (q = search) => {
    setLoading(true);
    try {
      const data = await getCustomers(q);
      setCustomers(Array.isArray(data) ? data : (data.content || []));
    } catch { toast.error('Error', 'Failed to load customers'); }
    finally { setLoading(false); }
  };

  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => { load(); }, []);

  const openAdd  = () => { setForm({ name:'', email:'', city:'', panNumber:'', phoneNumber:'', initialPassword:'' }); setSelected(null); setFieldErrors({}); setModal('add'); };
  const openEdit = c  => { setForm({ name:c.name, email:c.email, city:c.city||'', panNumber:c.panNumber, phoneNumber:c.phoneNumber||'', initialPassword:'' }); setSelected(c); setFieldErrors({}); setModal('edit'); };
  const openView = c  => { setSelected(c); setModal('view'); };
  const openDel  = c  => { setSelected(c); setModal('delete'); };
  const closeModal = () => setModal(null);

  const handleSave = async e => {
    e.preventDefault();
    setSaving(true);
    setFieldErrors({});
    try {
      if (modal === 'add') {
        await createCustomer(form);
        toast.success('Customer Created', `${form.name} added with login credentials`);
      } else {
        await updateCustomer(selected.id, form);
        toast.success('Customer Updated', `${form.name} updated`);
      }
      closeModal();
      load();
    } catch (err) {
      const errData = err.response?.data;
      if (err.response?.status === 400 && (errData?.validationErrors || errData?.fieldErrors)) {
        // backend returns validationErrors from Spring @Valid; support legacy fieldErrors key too
        setFieldErrors(errData.validationErrors || errData.fieldErrors);
        toast.error('Validation Error', 'Please correct the highlighted fields');
      } else {
        toast.error('Save Failed', errData?.message || err.message);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      await deleteCustomer(selected.id);
      toast.success('Deleted', `${selected.name} removed`);
      closeModal();
      load();
    } catch (err) {
      toast.error('Delete Failed', err.response?.data?.message || err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="section-header">
        <div>
          <div className="section-title">Customers</div>
          <div className="section-subtitle">Manage customer accounts and logins</div>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Customer</button>
      </div>

      <div className="card mb-4" style={{ padding: '12px 16px' }}>
        <div className="flex gap-3">
          <input className="form-input" placeholder="Search by name, city or email…"
            value={search} onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && load()} style={{ flex:1 }} />
          <button className="btn btn-primary btn-sm" onClick={() => load()}>Search</button>
          <button className="btn btn-secondary btn-sm" onClick={() => { setSearch(''); load(''); }}>Clear</button>
        </div>
      </div>

      <div className="table-wrap">
        {loading ? <Skeleton rows={6} /> : (
          <table>
            <thead><tr>
              <th>ID</th><th>Name</th><th>Email / Login</th><th>City</th><th>PAN</th><th>KYC</th><th>Actions</th>
            </tr></thead>
            <tbody>
              {customers.map(c => (
                <tr key={c.id}>
                  <td className="text-muted text-xs">#{c.id}</td>
                  <td className="font-semibold">{c.name}</td>
                  <td className="text-secondary text-sm">{c.email}</td>
                  <td className="text-secondary">{c.city || '—'}</td>
                  <td className="monospace">{c.panNumber}</td>
                  <td><span className={`badge ${statusBadge(c.kycStatus)}`}>{c.kycStatus || 'PENDING'}</span></td>
                  <td>
                    <div className="flex gap-2">
                      <button className="btn btn-secondary btn-sm" onClick={() => openView(c)}>View</button>
                      <button className="btn btn-secondary btn-sm" onClick={() => openEdit(c)}>Edit</button>
                      <button className="btn btn-danger btn-sm" onClick={() => openDel(c)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {customers.length === 0 && (
                <tr><td colSpan={7} className="table-empty">No customers found</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Add / Edit Modal */}
      {(modal === 'add' || modal === 'edit') && (
        <Modal title={modal === 'add' ? 'Add New Customer' : 'Edit Customer'} onClose={closeModal} size="modal-lg">
          <form onSubmit={handleSave}>
            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input className={`form-input ${fieldErrors.name ? 'input-error' : ''}`} value={form.name} onChange={e => setForm({...form, name:e.target.value})} required />
                {fieldErrors.name && <div className="text-danger text-xs mt-1">{fieldErrors.name}</div>}
              </div>
              <div className="form-group">
                <label className="form-label">Email (Login ID) *</label>
                <input className={`form-input ${fieldErrors.email ? 'input-error' : ''}`} type="email" value={form.email} onChange={e => setForm({...form, email:e.target.value})} required />
                {fieldErrors.email && <div className="text-danger text-xs mt-1">{fieldErrors.email}</div>}
              </div>
              <div className="form-group">
                <label className="form-label">City</label>
                <input className={`form-input ${fieldErrors.city ? 'input-error' : ''}`} value={form.city} onChange={e => setForm({...form, city:e.target.value})} />
                {fieldErrors.city && <div className="text-danger text-xs mt-1">{fieldErrors.city}</div>}
              </div>
              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <input className={`form-input ${fieldErrors.phoneNumber ? 'input-error' : ''}`} value={form.phoneNumber} onChange={e => setForm({...form, phoneNumber:e.target.value})} />
                {fieldErrors.phoneNumber && <div className="text-danger text-xs mt-1">{fieldErrors.phoneNumber}</div>}
              </div>
              <div className="form-group">
                <label className="form-label">PAN Number *</label>
                <input className={`form-input ${fieldErrors.panNumber ? 'input-error' : ''}`} value={form.panNumber} onChange={e => setForm({...form, panNumber:e.target.value.toUpperCase()})} required />
                {fieldErrors.panNumber && <div className="text-danger text-xs mt-1">{fieldErrors.panNumber}</div>}
              </div>
              {modal === 'add' && (
                <div className="form-group">
                  <label className="form-label">Initial Password *</label>
                  <input className={`form-input ${fieldErrors.initialPassword ? 'input-error' : ''}`} type="password" minLength={6} value={form.initialPassword}
                    onChange={e => setForm({...form, initialPassword:e.target.value})} required />
                  {fieldErrors.initialPassword ? (
                    <div className="text-danger text-xs mt-1">{fieldErrors.initialPassword}</div>
                  ) : (
                    <div className="form-hint">Minimum 6 characters. Give this to the customer.</div>
                  )}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? '⏳ Saving…' : modal === 'add' ? 'Create Customer' : 'Save Changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* View Modal */}
      {modal === 'view' && selected && (
        <CustomerDetailModal customer={selected} onClose={closeModal} />
      )}

      {/* Delete Confirm */}
      {modal === 'delete' && selected && (
        <ConfirmModal
          title="Delete Customer"
          message={`Are you sure you want to delete ${selected.name}? This action cannot be undone. Customer must have no accounts or loans.`}
          confirmLabel="Delete"
          danger
          onConfirm={handleDelete}
          onClose={closeModal}
          loading={saving}
        />
      )}
    </>
  );
}

function CustomerDetailModal({ customer, onClose }) {
  const toast = useToast();
  const [accounts, setAccounts] = useState([]);
  const [loans, setLoans]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [accForm, setAccForm]   = useState({ type: 'SAVINGS', balance: 0 });
  const [loanForm, setLoanForm] = useState({ type: 'HOME', principal: 10000, interestRate: 8, tenureMonths: 12 });
  const [saving, setSaving]     = useState(false);
  const [tab, setTab]           = useState('accounts');

  useEffect(() => {
    Promise.all([
      getCustomerAccounts(customer.id),
      getCustomerLoans(customer.id)
    ]).then(([a, l]) => { setAccounts(a); setLoans(l); setLoading(false); });
  }, [customer.id]);

  const handleOpenAccount = async e => {
    e.preventDefault();
    setSaving(true);
    try {
      await openAccount(customer.id, { ...accForm, balance: Number(accForm.balance) });
      toast.success('Account Opened', `${accForm.type} account created`);
      const a = await getCustomerAccounts(customer.id);
      setAccounts(a);
    } catch (err) {
      toast.error('Error', err.response?.data?.message || err.message);
    } finally { setSaving(false); }
  };

  const handleSanctionLoan = async e => {
    e.preventDefault();
    setSaving(true);
    try {
      await sanctionLoan(customer.id, {
        ...loanForm,
        principal: Number(loanForm.principal),
        interestRate: Number(loanForm.interestRate),
        tenureMonths: Number(loanForm.tenureMonths)
      });
      toast.success('Loan Sanctioned', `${loanForm.type} loan created`);
      const l = await getCustomerLoans(customer.id);
      setLoans(l);
    } catch (err) {
      toast.error('Error', err.response?.data?.message || err.message);
    } finally { setSaving(false); }
  };

  const handleMoney = async (accountId, op) => {
    const amount = window.prompt(`Enter amount to ${op}:`);
    if (!amount) return;
    try {
      if (op === 'deposit') await adminDeposit(accountId, amount);
      else await adminWithdraw(accountId, amount);
      toast.success('Success', `${op} completed`);
      const a = await getCustomerAccounts(customer.id);
      setAccounts(a);
    } catch (err) {
      toast.error('Error', err.response?.data?.message || err.message);
    }
  };

  return (
    <Modal title={`${customer.name} — Details`} onClose={onClose} size="modal-xl">
      {/* Customer info */}
      <div className="card card-sm mb-4" style={{ background: 'var(--bg-input)' }}>
        <div className="flex gap-4 flex-wrap">
          <div><div className="text-xs text-muted">Email</div><div className="font-semibold text-sm">{customer.email}</div></div>
          <div><div className="text-xs text-muted">City</div><div className="font-semibold text-sm">{customer.city || '—'}</div></div>
          <div><div className="text-xs text-muted">PAN</div><div className="font-semibold text-sm monospace">{customer.panNumber}</div></div>
          <div><div className="text-xs text-muted">KYC</div><span className={`badge ${statusBadge(customer.kycStatus)}`}>{customer.kycStatus}</span></div>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        {['accounts','loans','open-account','sanction-loan'].map(t => (
          <button key={t} className={`btn btn-sm ${tab === t ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab(t)}>
            {t === 'accounts' ? '🏦 Accounts' : t === 'loans' ? '💳 Loans' : t === 'open-account' ? '+ Open Account' : '+ Sanction Loan'}
          </button>
        ))}
      </div>

      {loading ? <Skeleton /> : <>
        {tab === 'accounts' && (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Account No.</th><th>Type</th><th>Balance</th><th>Min Balance</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {accounts.map(a => (
                  <tr key={a.id}>
                    <td className="monospace text-sm">{a.accountNumber}</td>
                    <td><span className="badge badge-blue">{a.type}</span></td>
                    <td className="font-semibold">{inr(a.balance)}</td>
                    <td className="text-secondary text-sm">{inr(a.minimumBalance)}</td>
                    <td><span className={`badge ${statusBadge(a.status)}`}>{a.status}</span></td>
                    <td>
                      <div className="flex gap-2">
                        <button className="btn btn-success btn-sm" onClick={() => handleMoney(a.id, 'deposit')}>Deposit</button>
                        <button className="btn btn-secondary btn-sm" onClick={() => handleMoney(a.id, 'withdraw')}>Withdraw</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {accounts.length === 0 && <tr><td colSpan={6} className="table-empty">No accounts</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'loans' && (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Type</th><th>Principal</th><th>Rate</th><th>Months</th><th>EMI</th><th>Status</th></tr></thead>
              <tbody>
                {loans.map(l => (
                  <tr key={l.id}>
                    <td><span className="badge badge-purple">{l.type}</span></td>
                    <td className="font-semibold">{inr(l.principal)}</td>
                    <td>{l.interestRate}%</td>
                    <td>{l.tenureMonths} mo</td>
                    <td className="font-semibold">{inr(l.emi)}</td>
                    <td><span className={`badge ${statusBadge(l.status)}`}>{l.status}</span></td>
                  </tr>
                ))}
                {loans.length === 0 && <tr><td colSpan={6} className="table-empty">No loans</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'open-account' && (
          <form onSubmit={handleOpenAccount}>
            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Account Type</label>
                <select className="form-select" value={accForm.type} onChange={e => setAccForm({...accForm, type:e.target.value})}>
                  <option>SAVINGS</option><option>CURRENT</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Opening Balance (₹)</label>
                <input className="form-input" type="number" min="0" value={accForm.balance}
                  onChange={e => setAccForm({...accForm, balance:e.target.value})} />
              </div>
            </div>
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? '⏳ Creating…' : '🏦 Open Account'}
            </button>
          </form>
        )}

        {tab === 'sanction-loan' && (
          <form onSubmit={handleSanctionLoan}>
            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Loan Type</label>
                <select className="form-select" value={loanForm.type} onChange={e => setLoanForm({...loanForm, type:e.target.value})}>
                  <option>HOME</option><option>CAR</option><option>PERSONAL</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Principal (₹)</label>
                <input className="form-input" type="number" min="10000" value={loanForm.principal}
                  onChange={e => setLoanForm({...loanForm, principal:e.target.value})} required />
              </div>
              <div className="form-group">
                <label className="form-label">Interest Rate (% p.a.)</label>
                <input className="form-input" type="number" step="0.1" min="0.1" max="50" value={loanForm.interestRate}
                  onChange={e => setLoanForm({...loanForm, interestRate:e.target.value})} required />
              </div>
              <div className="form-group">
                <label className="form-label">Tenure (Months)</label>
                <input className="form-input" type="number" min="1" max="480" value={loanForm.tenureMonths}
                  onChange={e => setLoanForm({...loanForm, tenureMonths:e.target.value})} required />
              </div>
            </div>
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? '⏳ Sanctioning…' : '💳 Sanction Loan'}
            </button>
          </form>
        )}
      </>}
    </Modal>
  );
}

/* ============================================================
   ACCOUNTS VIEW (Admin)
   ============================================================ */
function AccountsView() {
  const [accounts, setAccounts]         = useState([]);
  const [loading, setLoading]           = useState(false);
  const [search, setSearch]             = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortBy, setSortBy]             = useState('date_desc');
  const [page, setPage]                 = useState(0);
  const [pageSize, setPageSize]         = useState(10);
  const [totalPages, setTotalPages]     = useState(1);
  const [totalElements, setTotalElements] = useState(0);
  const [viewCustomer, setViewCustomer] = useState(null);
  const [loadingCust, setLoadingCust]   = useState(false);
  const toast = useToast();

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const data = await getAllAccounts(search, statusFilter === 'ALL' ? '' : statusFilter, page, pageSize);
      let list = data.content || [];
      
      // Client-side sorting enhancement
      list = [...list].sort((a, b) => {
        if (sortBy === 'balance_desc') return Number(b.balance || 0) - Number(a.balance || 0);
        if (sortBy === 'balance_asc')  return Number(a.balance || 0) - Number(b.balance || 0);
        if (sortBy === 'acc_asc')      return (a.accountNumber || '').localeCompare(b.accountNumber || '');
        // default date_desc
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      });

      setAccounts(list);
      setTotalPages(data.totalPages || 1);
      setTotalElements(data.totalElements || list.length);
    } catch (err) {
      toast.error('Failed to load accounts', err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, [search, statusFilter, sortBy, page, pageSize]);

  const handleStatusChange = async (accountId, status) => {
    try {
      await updateAccountStatus(accountId, status);
      toast.success('Status Updated', `Account status updated to ${status}`);
      fetchAccounts();
    } catch (err) {
      toast.error('Error', err.response?.data?.message || err.message);
    }
  };

  const handleCustomerClick = async (customerId) => {
    if (!customerId) return;
    setLoadingCust(true);
    try {
      const cust = await getCustomer(customerId);
      setViewCustomer(cust);
    } catch (err) {
      toast.error('Error', 'Failed to fetch customer profile');
    } finally {
      setLoadingCust(false);
    }
  };

  const orphanedAccounts = accounts.filter(a => !a.customerId || String(a.customerName).includes('Unassigned'));
  const totalBalance = accounts.reduce((s, a) => s + Number(a.balance || 0), 0);

  return (
    <>
      <div className="section-header">
        <div>
          <div className="section-title">Accounts Management</div>
          <div className="section-subtitle">Monitor all bank accounts, view customer ownership, freeze, close or reactivate</div>
        </div>
        <div className="flex gap-2 items-center">
          <span className="badge badge-blue">{totalElements} Total Accounts</span>
        </div>
      </div>

      {orphanedAccounts.length > 0 && (
        <div className="card mb-4" style={{ borderColor: 'var(--amber-500, #f59e0b)', background: 'rgba(245, 158, 11, 0.08)' }}>
          <div className="flex gap-3 items-center">
            <span style={{ fontSize: '1.5rem' }}>⚠️</span>
            <div>
              <div className="font-bold" style={{ color: 'var(--amber-600, #d97706)' }}>
                Data Integrity Notice: {orphanedAccounts.length} Account(s) Missing Customer Link
              </div>
              <div className="text-sm text-secondary">
                Account ID(s): {orphanedAccounts.map(a => `${a.accountNumber} (ID: ${a.id})`).join(', ')}.
                Safe proposed fix: Reassign the account's customer reference to a valid verified customer ID via database migration. Do not delete accounts as ledger balances and transaction audit trails must remain intact.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="card mb-4" style={{ padding: '16px' }}>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-center">
          <div>
            <label className="form-label text-xs mb-1">Search Accounts</label>
            <input
              type="text"
              className="form-input"
              placeholder="Account no, customer, email..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0); }}
            />
          </div>
          <div>
            <label className="form-label text-xs mb-1">Status Filter</label>
            <select
              className="form-select"
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value); setPage(0); }}
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="FROZEN">Frozen</option>
              <option value="CLOSED">Closed</option>
            </select>
          </div>
          <div>
            <label className="form-label text-xs mb-1">Sort By</label>
            <select
              className="form-select"
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
            >
              <option value="date_desc">Newest Opened</option>
              <option value="balance_desc">Highest Balance</option>
              <option value="balance_asc">Lowest Balance</option>
              <option value="acc_asc">Account Number (A-Z)</option>
            </select>
          </div>
          <div className="text-right">
            <span className="text-muted text-xs block">Visible Balance Sum</span>
            <span className="font-bold text-lg text-primary">{inr(totalBalance)}</span>
          </div>
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="table-wrap hidden md:block">
        {loading ? <Skeleton rows={5} /> : (
          <table>
            <thead>
              <tr>
                <th>Account No.</th>
                <th>Customer Name</th>
                <th>Type</th>
                <th>Balance</th>
                <th>Min Balance</th>
                <th>Opened Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map(a => (
                <tr key={a.id}>
                  <td className="monospace font-semibold text-sm">
                    {a.accountNumber}
                    <div className="text-xs text-muted">ID: #{a.id}</div>
                  </td>
                  <td>
                    {a.customerId ? (
                      <div>
                        <button
                          type="button"
                          className="btn-link font-semibold text-primary"
                          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', textDecoration: 'underline' }}
                          onClick={() => handleCustomerClick(a.customerId)}
                          title="Click to view customer details"
                        >
                          👤 {a.customerName}
                        </button>
                        <div className="text-xs text-muted">{a.customerEmail}</div>
                        {a.customerPhone && <div className="text-xs text-secondary">{a.customerPhone}</div>}
                      </div>
                    ) : (
                      <span className="badge badge-warning">⚠️ {a.customerName || 'Unassigned'}</span>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${a.type === 'SAVINGS' ? 'badge-blue' : a.type === 'CURRENT' ? 'badge-purple' : 'badge-green'}`}>
                      {a.type}
                    </span>
                  </td>
                  <td className="font-bold text-base">{inr(a.balance)}</td>
                  <td className="text-secondary text-sm">{inr(a.minimumBalance || 0)}</td>
                  <td className="text-sm text-secondary">{fmtDate(a.createdAt)}</td>
                  <td><span className={`badge ${statusBadge(a.status)}`}>{a.status}</span></td>
                  <td>
                    <div className="flex gap-1">
                      {a.status !== 'ACTIVE' && (
                        <button className="btn btn-success btn-xs" onClick={() => handleStatusChange(a.id, 'ACTIVE')}>Activate</button>
                      )}
                      {a.status !== 'FROZEN' && (
                        <button className="btn btn-secondary btn-xs" onClick={() => handleStatusChange(a.id, 'FROZEN')}>Freeze</button>
                      )}
                      {a.status !== 'CLOSED' && (
                        <button className="btn btn-danger btn-xs" onClick={() => handleStatusChange(a.id, 'CLOSED')}>Close</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {accounts.length === 0 && (
                <tr>
                  <td colSpan={8} className="table-empty py-8 text-center text-muted">
                    <div className="text-2xl mb-2">🔍</div>
                    <div className="font-semibold">No accounts found</div>
                    <div className="text-xs">Try adjusting your search query or status filter.</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden flex flex-col gap-3">
        {loading ? <SkeletonCard count={3} /> : accounts.map(a => (
          <div key={a.id} className="card p-4">
            <div className="flex justify-between items-start mb-2">
              <div>
                <span className="monospace font-bold text-sm">{a.accountNumber}</span>
                <span className="badge badge-blue ml-2 text-xs">{a.type}</span>
              </div>
              <span className={`badge ${statusBadge(a.status)}`}>{a.status}</span>
            </div>
            
            <div className="my-2 border-t pt-2" style={{ borderColor: 'var(--border)' }}>
              <div className="text-xs text-muted">Account Holder</div>
              {a.customerId ? (
                <button
                  type="button"
                  className="font-semibold text-primary text-sm text-left"
                  style={{ background: 'none', border: 'none', padding: 0, textDecoration: 'underline' }}
                  onClick={() => handleCustomerClick(a.customerId)}
                >
                  👤 {a.customerName}
                </button>
              ) : (
                <span className="text-xs text-warning">⚠️ {a.customerName}</span>
              )}
              <div className="text-xs text-secondary">{a.customerEmail}</div>
            </div>

            <div className="flex justify-between items-center my-2">
              <div>
                <span className="text-xs text-muted block">Balance</span>
                <span className="font-bold text-base">{inr(a.balance)}</span>
              </div>
              <div className="text-right">
                <span className="text-xs text-muted block">Opened</span>
                <span className="text-xs text-secondary">{fmtDate(a.createdAt)}</span>
              </div>
            </div>

            <div className="flex gap-2 mt-3 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
              {a.status !== 'ACTIVE' && (
                <button className="btn btn-success btn-sm flex-1" onClick={() => handleStatusChange(a.id, 'ACTIVE')}>Activate</button>
              )}
              {a.status !== 'FROZEN' && (
                <button className="btn btn-secondary btn-sm flex-1" onClick={() => handleStatusChange(a.id, 'FROZEN')}>Freeze</button>
              )}
              {a.status !== 'CLOSED' && (
                <button className="btn btn-danger btn-sm flex-1" onClick={() => handleStatusChange(a.id, 'CLOSED')}>Close</button>
              )}
            </div>
          </div>
        ))}
        {!loading && accounts.length === 0 && (
          <div className="card p-6 text-center text-muted">
            <div className="text-2xl mb-1">🔍</div>
            <div>No accounts found</div>
          </div>
        )}
      </div>

      {/* Pagination Bar */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center mt-4 px-2">
          <div className="text-xs text-muted">
            Page {page + 1} of {totalPages} ({totalElements} total)
          </div>
          <div className="flex gap-2">
            <button
              className="btn btn-secondary btn-sm"
              disabled={page === 0}
              onClick={() => setPage(p => Math.max(0, p - 1))}
            >
              ← Previous
            </button>
            <button
              className="btn btn-secondary btn-sm"
              disabled={page >= totalPages - 1}
              onClick={() => setPage(p => p + 1)}
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* Customer Detail Modal when customer name is clicked */}
      {viewCustomer && (
        <CustomerDetailModal
          customer={viewCustomer}
          onClose={() => setViewCustomer(null)}
        />
      )}
    </>
  );
}

/* ============================================================
   LOANS VIEW (Admin)
   ============================================================ */
function LoansView() {
  const [loans, setLoans]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState('ALL');
  const [selLoan, setSelLoan] = useState(null);
  const [schedule, setSchedule] = useState([]);
  const [summary, setSummary]   = useState(null);
  const [schedLoading, setSchedLoading] = useState(false);
  const toast = useToast();

  const load = () => getAllLoans().then(l => { setLoans(l); setLoading(false); });
  useEffect(() => { load(); }, []);

  const handleDecision = async (loanId, decision) => {
    const remarks = decision === 'REJECTED'
      ? window.prompt('Enter rejection remarks:') || ''
      : 'Approved by admin';
    try {
      await updateLoanDecision(loanId, decision, remarks);
      toast.success('Decision Recorded', `Loan ${decision.toLowerCase()}`);
      load();
    } catch (err) {
      toast.error('Error', err.response?.data?.message || err.message);
    }
  };

  const openSchedule = async (loan) => {
    setSelLoan(loan);
    setSchedule([]);
    setSummary(null);
    setSchedLoading(true);
    try {
      const [sum, sched] = await Promise.all([
        getLoanSummary(loan.id),
        getLoanSchedule(loan.id)
      ]);
      setSummary(sum);
      setSchedule(sched || []);
    } catch (err) {
      toast.error('Error', err.response?.data?.message || 'Failed to load schedule');
    } finally {
      setSchedLoading(false);
    }
  };

  const filters = ['ALL', 'APPLIED', 'ACTIVE', 'REJECTED', 'CLOSED'];
  const displayed = filter === 'ALL' ? loans : loans.filter(l => l.status === filter);

  return (
    <>
      <div className="section-header">
        <div>
          <div className="section-title">Loans Management</div>
          <div className="section-subtitle">Review applications, approve or reject, view amortization schedules</div>
        </div>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        {filters.map(f => (
          <button key={f} className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter(f)}>
            {f} {f !== 'ALL' && <span style={{ marginLeft: 4 }}>({loans.filter(l => l.status === f).length})</span>}
          </button>
        ))}
      </div>

      <div className="table-wrap">
        {loading ? <Skeleton /> : (
          <table>
            <thead><tr>
              <th>Loan ID</th><th>Customer</th><th>Type</th><th>Principal</th><th>Rate</th><th>Tenure</th><th>EMI</th><th>Status</th><th>Actions</th>
            </tr></thead>
            <tbody>
              {displayed.map(l => (
                <tr key={l.id}>
                  <td className="monospace text-xs text-muted">#{l.id}</td>
                  <td className="font-semibold">{l.customerName || `#${l.customerId}`}</td>
                  <td><span className="badge badge-purple">{l.type}</span></td>
                  <td className="font-semibold">{inr(l.principal)}</td>
                  <td>{l.interestRate}%</td>
                  <td>{l.tenureMonths} mo</td>
                  <td>{inr(l.emi)}</td>
                  <td><span className={`badge ${statusBadge(l.status)}`}>{l.status}</span></td>
                  <td>
                    <div className="flex gap-2 flex-wrap">
                      {l.status === 'APPLIED' && (
                        <>
                          <button className="btn btn-success btn-sm" onClick={() => handleDecision(l.id, 'APPROVED')}>Approve</button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDecision(l.id, 'REJECTED')}>Reject</button>
                        </>
                      )}
                      {(l.status === 'ACTIVE' || l.status === 'CLOSED') && (
                        <button className="btn btn-secondary btn-sm" onClick={() => openSchedule(l)}>📋 Schedule</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {displayed.length === 0 && <tr><td colSpan={9} className="table-empty">No loans found</td></tr>}
            </tbody>
          </table>
        )}
      </div>

      {/* Admin Loan Schedule Modal */}
      {selLoan && (
        <Modal
          title={`Loan #${selLoan.id} — ${selLoan.customerName || ''} ${selLoan.type} Loan Schedule`}
          onClose={() => { setSelLoan(null); setSummary(null); setSchedule([]); }}
          size="modal-xl"
        >
          {schedLoading ? <Skeleton rows={8} /> : (
            <div>
              {summary && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
                  <div className="card card-sm">
                    <div className="text-xs text-muted">Outstanding</div>
                    <div className="text-xl font-extrabold text-brand">{inr(summary.outstandingPrincipal)}</div>
                    <div className="text-xs text-secondary">of {inr(summary.principal)}</div>
                  </div>
                  <div className="card card-sm">
                    <div className="text-xs text-muted">Monthly EMI</div>
                    <div className="text-xl font-extrabold">{inr(summary.emi)}</div>
                  </div>
                  <div className="card card-sm">
                    <div className="text-xs text-muted">Progress</div>
                    <div className="text-xl font-extrabold">{summary.repaymentProgressPercent}%</div>
                    <div className="text-xs text-secondary">{summary.paidInstallmentsCount} / {summary.paidInstallmentsCount + summary.remainingInstallmentsCount} paid</div>
                  </div>
                  <div className="card card-sm">
                    <div className="text-xs text-muted">Overdue</div>
                    <div className="text-xl font-extrabold" style={{ color: summary.overdueAmount > 0 ? 'var(--danger)' : 'var(--text-primary)' }}>
                      {summary.overdueAmount > 0 ? inr(summary.overdueAmount) : '✓ None'}
                    </div>
                  </div>
                </div>
              )}

              <div className="text-sm font-bold text-brand mb-2">Full Amortization Schedule</div>
              <div className="table-wrap" style={{ maxHeight: 400, overflowY: 'auto' }}>
                <table>
                  <thead><tr>
                    <th>#</th><th>Due Date</th><th>Opening Bal</th><th>EMI</th><th>Principal</th><th>Interest</th><th>Closing Bal</th><th>Penalty</th><th>Paid</th><th>Status</th>
                  </tr></thead>
                  <tbody>
                    {schedule.map(s => (
                      <tr key={s.installmentNo} style={{ background: s.status === 'OVERDUE' ? 'rgba(239,68,68,.05)' : '' }}>
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
                        <td><span className={`badge ${statusBadge(s.status)}`}>{s.status}</span></td>
                      </tr>
                    ))}
                    {schedule.length === 0 && <tr><td colSpan={10} className="table-empty">No schedule data</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}

/* ============================================================
   OVERDUE LOANS REPORT (Admin)
   ============================================================ */
function OverdueView() {
  const [overdues, setOverdues]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [triggering, setTriggering] = useState(false);
  const toast = useToast();

  const load = () => {
    setLoading(true);
    getOverdueLoans().then(d => { setOverdues(d || []); setLoading(false); }).catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleTrigger = async () => {
    setTriggering(true);
    try {
      await triggerOverdueJob();
      toast.success('Job Triggered', 'Overdue assessment & auto-debit cycle completed');
      load();
    } catch (err) {
      toast.error('Error', err.response?.data?.message || err.message);
    } finally {
      setTriggering(false);
    }
  };

  const totalOverdue = overdues.reduce((s, o) => s + Number(o.totalOverdueAmount || 0), 0);

  return (
    <>
      <div className="section-header">
        <div>
          <div className="section-title">⚠️ Overdue Loans Report</div>
          <div className="section-subtitle">Delinquent accounts with Days Past Due (DPD) analysis</div>
        </div>
        <button className="btn btn-danger btn-sm" onClick={handleTrigger} disabled={triggering}>
          {triggering ? '⏳ Processing…' : '🔄 Run Overdue Job'}
        </button>
      </div>

      {overdues.length > 0 && (
        <div className="kpi-grid mb-6">
          <div className="kpi-card">
            <div className="kpi-icon red">⚠️</div>
            <div>
              <div className="kpi-value">{overdues.length}</div>
              <div className="kpi-label">Delinquent Loans</div>
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon red">💰</div>
            <div>
              <div className="kpi-value">{inr(totalOverdue)}</div>
              <div className="kpi-label">Total Overdue Amount</div>
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon amber">📋</div>
            <div>
              <div className="kpi-value">{overdues.reduce((s, o) => s + (o.overdueInstallmentsCount || 0), 0)}</div>
              <div className="kpi-label">Overdue Installments</div>
            </div>
          </div>
        </div>
      )}

      <div className="table-wrap">
        {loading ? <Skeleton rows={6} /> : (
          <table>
            <thead><tr>
              <th>Loan ID</th><th>Customer</th><th>Loan Type</th><th>Principal</th>
              <th>Outstanding</th><th>Overdue EMIs</th><th>Total Overdue</th><th>Max DPD</th>
            </tr></thead>
            <tbody>
              {overdues.map(o => (
                <tr key={o.loanId} style={{ background: o.maxDaysPastDue > 90 ? 'rgba(239,68,68,.06)' : '' }}>
                  <td className="monospace text-xs text-muted">#{o.loanId}</td>
                  <td>
                    <div className="font-semibold">{o.customerName}</div>
                    <div className="text-xs text-muted">{o.customerEmail}</div>
                  </td>
                  <td><span className="badge badge-purple">{o.loanType}</span></td>
                  <td className="font-semibold">{inr(o.principal)}</td>
                  <td className="font-semibold text-brand">{inr(o.outstandingPrincipal)}</td>
                  <td className="text-center">
                    <span className="badge badge-red">{o.overdueInstallmentsCount}</span>
                  </td>
                  <td className="font-bold text-danger">{inr(o.totalOverdueAmount)}</td>
                  <td>
                    <span
                      className={`badge ${o.maxDaysPastDue > 90 ? 'badge-red' : o.maxDaysPastDue > 30 ? 'badge-amber' : 'badge-gray'}`}
                      title="Days Past Due"
                    >
                      {o.maxDaysPastDue} DPD
                    </span>
                  </td>
                </tr>
              ))}
              {overdues.length === 0 && (
                <tr><td colSpan={8} className="table-empty">✅ No overdue loans — all accounts are current!</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

/* ============================================================
   AUDIT LOGS VIEW
   ============================================================ */
function AuditView() {
  const [logs, setLogs]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage]   = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const load = (p = page) => {
    setLoading(true);
    getAuditLogs(p, 15).then(data => {
      const list = Array.isArray(data) ? data : (data.content || []);
      setLogs(list);
      setTotalPages(data.totalPages || 1);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, [page]);

  const actionColor = action => {
    if (action?.includes('LOGIN')) return 'badge-blue';
    if (action?.includes('DELETE') || action?.includes('REJECT')) return 'badge-red';
    if (action?.includes('CREATE') || action?.includes('OPEN') || action?.includes('APPROVE')) return 'badge-green';
    if (action?.includes('TRANSFER') || action?.includes('DEPOSIT') || action?.includes('WITHDRAW')) return 'badge-amber';
    return 'badge-gray';
  };

  return (
    <>
      <div className="section-header">
        <div>
          <div className="section-title">Audit Logs</div>
          <div className="section-subtitle">Security trail of all sensitive actions</div>
        </div>
      </div>

      <div className="table-wrap">
        {loading ? <Skeleton rows={8} /> : (
          <table>
            <thead><tr>
              <th>Timestamp</th><th>Username</th><th>Role</th><th>Action</th><th>Resource</th><th>Details</th>
            </tr></thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id}>
                  <td className="text-xs text-muted" style={{ whiteSpace: 'nowrap' }}>{fmtDateTime(log.timestamp)}</td>
                  <td className="font-semibold text-sm">{log.username}</td>
                  <td><span className={`badge ${log.role === 'ROLE_ADMIN' ? 'badge-purple' : 'badge-blue'}`}>
                    {log.role?.replace('ROLE_', '') || '—'}
                  </span></td>
                  <td><span className={`badge ${actionColor(log.action)}`}>{log.action}</span></td>
                  <td className="text-sm text-secondary">{log.resource || '—'}</td>
                  <td className="text-xs text-muted">{log.details || '—'}</td>
                </tr>
              ))}
              {logs.length === 0 && <tr><td colSpan={6} className="table-empty">No audit logs</td></tr>}
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
