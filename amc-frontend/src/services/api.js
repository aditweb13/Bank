import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

// Attach Bearer token to every request
api.interceptors.request.use(config => {
  const token = localStorage.getItem('amc_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-logout on 401
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.clear();
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;

// ---- Auth ----
export const login = (username, password) =>
  api.post('/login', { username, password }).then(r => r.data);

export const getMe = () => api.get('/auth/me').then(r => r.data);

// ---- Dashboard ----
export const getDashboard = () => api.get('/dashboard').then(r => r.data);

// ---- Customers (admin) ----
export const getCustomers = (search = '', page, size) =>
  api.get('/customers', { params: { search, page, size } }).then(r => r.data);

export const getCustomer = id => api.get(`/customers/${id}`).then(r => r.data);

export const createCustomer = data => api.post('/customers', data).then(r => r.data);

export const updateCustomer = (id, data) => api.put(`/customers/${id}`, data).then(r => r.data);

export const deleteCustomer = id => api.delete(`/customers/${id}`);

// ---- Accounts (admin) ----
export const getAllAccounts = (search = '', status = '', page = 0, size = 10) =>
  api.get('/accounts', { params: { search, status, page, size } }).then(r => r.data);

export const getCustomerAccounts = customerId =>
  api.get(`/customers/${customerId}/accounts`).then(r => r.data);

export const openAccount = (customerId, data) =>
  api.post(`/customers/${customerId}/accounts`, data).then(r => r.data);

export const adminDeposit = (accountId, amount) =>
  api.post(`/accounts/${accountId}/deposit`, null, { params: { amount } }).then(r => r.data);

export const adminWithdraw = (accountId, amount) =>
  api.post(`/accounts/${accountId}/withdraw`, null, { params: { amount } }).then(r => r.data);

export const updateAccountStatus = (accountId, status) =>
  api.put(`/accounts/${accountId}/status`, null, { params: { status } }).then(r => r.data);

// ---- Loans (admin) ----
export const getAllLoans = () => api.get('/loans').then(r => r.data);

export const getCustomerLoans = customerId =>
  api.get(`/customers/${customerId}/loans`).then(r => r.data);

export const sanctionLoan = (customerId, data) =>
  api.post(`/customers/${customerId}/loans`, data).then(r => r.data);

export const updateLoanDecision = (loanId, decision, remarks = '') =>
  api.put(`/loans/${loanId}/decision`, null, { params: { decision, remarks } }).then(r => r.data);

// ---- Audit ----
export const getAuditLogs = (page = 0, size = 10) =>
  api.get('/audit-logs', { params: { page, size } }).then(r => r.data);

// ---- Customer Self-Service ----
export const getMyProfile    = () => api.get('/customer/me').then(r => r.data);
export const getMyAccounts   = () => api.get('/customer/accounts').then(r => r.data);
export const getMyLoans      = () => api.get('/customer/me/loans').then(r => r.data);
export const getMyBeneficiaries = () => api.get('/customer/me/beneficiaries').then(r => r.data);
export const getMyFDs        = () => api.get('/customer/fixed-deposits').then(r => r.data);
export const getMyNotifications = () => api.get('/customer/me/notifications').then(r => r.data);

export const getMyTransactions = (page = 0, size = 10) =>
  api.get('/customer/me/transactions', { params: { page, size } }).then(r => r.data);

export const depositMyAccount = (accountId, amount) =>
  api.post(`/customer/me/accounts/${accountId}/deposit`, null, { params: { amount } }).then(r => r.data);

export const withdrawMyAccount = (accountId, amount) =>
  api.post(`/customer/me/accounts/${accountId}/withdraw`, null, { params: { amount } }).then(r => r.data);

export const transferFunds = data =>
  api.post('/customer/me/transfer', data).then(r => r.data);

export const applyForLoan = data =>
  api.post('/customer/me/loans/apply', data).then(r => r.data);

export const getLoanSchedule = loanId =>
  api.get(`/loans/${loanId}/schedule`).then(r => r.data);

export const addBeneficiary = data =>
  api.post('/customer/me/beneficiaries', data).then(r => r.data);

export const deleteBeneficiary = id =>
  api.delete(`/customer/me/beneficiaries/${id}`);

export const createFixedDeposit = (sourceAccountId, amount, tenureMonths) =>
  api.post('/customer/fixed-deposits', {
    sourceAccountId: Number(sourceAccountId),
    amount: Number(amount),
    tenureMonths: Number(tenureMonths)
  }).then(r => r.data);

export const closeFixedDeposit = id =>
  api.post(`/customer/fixed-deposits/${id}/close`).then(r => r.data);

export const getAllFixedDepositsAdmin = () =>
  api.get('/fixed-deposits').then(r => r.data);

export const downloadCSV = () =>
  api.get('/customer/me/transactions/csv', { responseType: 'blob' }).then(r => r.data);

export const downloadPDF = () =>
  api.get('/customer/me/transactions/pdf', { responseType: 'blob' }).then(r => r.data);

// ---- Loans & Repayment System ----
export const previewEmi = (principal, interestRate, tenureMonths) =>
  api.post('/loans/emi-preview', { principal, interestRate, tenureMonths }).then(r => r.data);

export const getLoanSummary = loanId =>
  api.get(`/loans/${loanId}/summary`).then(r => r.data);

export const repayLoan = (loanId, sourceAccountId, amount) =>
  api.post(`/customer/loans/${loanId}/repay`, { sourceAccountId, amount }).then(r => r.data);

export const prepayLoan = (loanId, sourceAccountId, prepaymentAmount, mode) =>
  api.post(`/customer/loans/${loanId}/prepay`, { sourceAccountId, prepaymentAmount, mode }).then(r => r.data);

export const getForeclosureQuote = loanId =>
  api.get(`/customer/loans/${loanId}/foreclosure-quote`).then(r => r.data);

export const forecloseLoan = (loanId, sourceAccountId) =>
  api.post(`/customer/loans/${loanId}/foreclose`, { sourceAccountId, confirmation: true }).then(r => r.data);

export const downloadLoanScheduleCsv = loanId =>
  api.get(`/customer/loans/${loanId}/schedule/csv`, { responseType: 'blob' }).then(r => r.data);

export const toggleAutoDebit = (loanId, enable, accountId) =>
  api.put(`/customer/loans/${loanId}/auto-debit`, null, { params: { enable, accountId } }).then(r => r.data);

export const getOverdueLoans = () =>
  api.get('/loans/overdue').then(r => r.data);

export const triggerOverdueJob = () =>
  api.post('/loans/process-overdue').then(r => r.data);

// ---- Part A: Funds Transfer ----
export const executeTransfer = (fromAccountId, toAccountNumber, amount, remarks, idempotencyKey) =>
  api.post('/customer/transfers', { fromAccountId, toAccountNumber, amount, remarks, idempotencyKey }).then(r => r.data);

export const getCustomerTransfers = (page = 0, size = 10, accountId, status) =>
  api.get('/customer/transfers', { params: { page, size, accountId, status } }).then(r => r.data);

export const getTransferDetails = id =>
  api.get(`/customer/transfers/${id}`).then(r => r.data);

export const getAllTransfers = (page = 0, size = 10) =>
  api.get('/transfers', { params: { page, size } }).then(r => r.data);

export const lookupAccount = accountNumber =>
  api.get(`/accounts/lookup/${accountNumber}`).then(r => r.data);

// ---- Part B: Deposit Requests (Maker-Checker) ----
export const createDepositRequest = (accountId, amount, mode, paymentReference, remarks) =>
  api.post('/customer/deposit-requests', { accountId, amount, mode, paymentReference, remarks }).then(r => r.data);

export const getCustomerDepositRequests = (page = 0, size = 10, status) =>
  api.get('/customer/deposit-requests', { params: { page, size, status } }).then(r => r.data);

export const cancelDepositRequest = id =>
  api.post(`/customer/deposit-requests/${id}/cancel`).then(r => r.data);

export const getAdminDepositRequests = (page = 0, size = 10, status, search) =>
  api.get('/deposit-requests', { params: { page, size, status, search } }).then(r => r.data);

export const getDepositRequestById = id =>
  api.get(`/deposit-requests/${id}`).then(r => r.data);

export const approveDepositRequest = (id, reviewRemarks) =>
  api.post(`/deposit-requests/${id}/approve`, null, { params: { reviewRemarks } }).then(r => r.data);

export const rejectDepositRequest = (id, reason) =>
  api.post(`/deposit-requests/${id}/reject`, { reason }).then(r => r.data);

export const getPendingDepositCount = () =>
  api.get('/deposit-requests/pending-count').then(r => r.data);

export const reconcileAccount = accountId =>
  api.get(`/admin/reconcile/${accountId}`).then(r => r.data);

