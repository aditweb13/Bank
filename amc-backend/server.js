const http = require('http');
const url = require('url');
const crypto = require('crypto');

const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET || 'AMC-Bank-Classroom-JWT-Secret-Key-2026-Change-In-Production';

function hashPassword(pwd) {
  return crypto.createHmac('sha256', 'amc_salt').update(pwd).digest('hex');
}

let users = [
  {
    id: 1,
    username: 'admin',
    passwordHash: hashPassword('admin123'),
    role: 'ROLE_ADMIN',
    customerId: null
  }
];

let customers = [];
let accounts = [];
let loans = [];
let loanInstallments = [];
let transactions = [];
let beneficiaries = [];
let fixedDeposits = [];
let notifications = [];
let auditLogs = [];
let transfers = [];
let depositRequests = [];

let nextCustomerId = 1;
let nextAccountId = 1;
let nextLoanId = 1;
let nextInstallmentId = 1;
let nextUserId = 2;
let nextTxnId = 1;
let nextBenId = 1;
let nextFdId = 1;
let nextAuditId = 1;
let nextTransferId = 1;
let nextDepositRequestId = 1;

function maskAcct(acct) {
  if (!acct || acct.length < 4) return acct || '';
  return 'â€¢â€¢â€¢â€¢' + acct.substring(acct.length - 4);
}

function maskName(name) {
  if (!name) return 'Unknown';
  return name.trim().split(/\s+/).map(p => p.length <= 1 ? p : p[0] + '*'.repeat(Math.max(1, p.length - 1))).join(' ');
}

function calculateEmi(principal, annualRate, tenureMonths) {
  if (!principal || tenureMonths <= 0) return 0;
  if (annualRate === 0) return Math.round((principal / tenureMonths) * 100) / 100;
  const r = annualRate / 1200;
  const factor = Math.pow(1 + r, tenureMonths);
  const emi = (principal * r * factor) / (factor - 1);
  return Math.round(emi * 100) / 100;
}

function generateSchedule(loan, startDate) {
  // Clear any existing installments for this loan
  loanInstallments = loanInstallments.filter(i => i.loanId !== loan.id);

  const p = loan.principal;
  const r = loan.interestRate / 1200;
  const n = loan.tenureMonths;
  const emi = loan.emi;

  let opening = p;
  const start = startDate ? new Date(startDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  for (let i = 1; i <= n; i++) {
    const dueDate = new Date(start);
    dueDate.setMonth(dueDate.getMonth() + (i - 1));

    let interestComp = r === 0 ? 0 : Math.round(opening * r * 100) / 100;
    let principalComp;
    let closing;
    let currentEmi = emi;

    if (i === n) {
      principalComp = opening;
      closing = 0;
      currentEmi = Math.round((principalComp + interestComp) * 100) / 100;
    } else {
      principalComp = Math.round((emi - interestComp) * 100) / 100;
      if (principalComp > opening) principalComp = opening;
      closing = Math.round((opening - principalComp) * 100) / 100;
    }

    loanInstallments.push({
      id: nextInstallmentId++,
      loanId: loan.id,
      installmentNo: i,
      dueDate: dueDate.toISOString().split('T')[0],
      openingBalance: opening,
      emiAmount: currentEmi,
      principalComponent: principalComp,
      interestComponent: interestComp,
      closingBalance: closing,
      status: 'PENDING',
      paidAmount: 0,
      paidDate: null,
      penaltyAmount: 0
    });

    opening = closing;
  }
}

function seedDemoData() {
  const demoCust = {
    id: nextCustomerId++,
    name: 'Khushi Sharma',
    email: 'Khushi@example.com',
    phoneNumber: '+919876543210',
    city: 'Mumbai',
    panNumber: 'ABCDE1234F',
    address: '123 Marine Drive, Mumbai',
    kycStatus: 'VERIFIED',
    createdAt: new Date().toISOString()
  };
  customers.push(demoCust);

  users.push({
    id: nextUserId++,
    username: demoCust.email,
    passwordHash: hashPassword('customer123'),
    role: 'ROLE_CUSTOMER',
    customerId: demoCust.id
  });

  const acc1 = {
    id: nextAccountId++,
    accountNumber: 'AC1002003001',
    type: 'SAVINGS',
    balance: 150000.00,
    minimumBalance: 1000.00,
    dailyTransferLimit: 100000.00,
    status: 'ACTIVE',
    customerId: demoCust.id,
    createdAt: new Date().toISOString()
  };
  accounts.push(acc1);

  transactions.push({
    id: nextTxnId++,
    referenceId: 'TXN1000000001',
    account: acc1,
    targetAccount: null,
    transactionType: 'DEPOSIT',
    amount: 150000.00,
    balanceAfter: 150000.00,
    description: 'Initial Account Opening Deposit',
    timestamp: new Date().toISOString()
  });

  const principal = 200000;
  const rate = 8.5;
  const tenure = 36;
  const emi = calculateEmi(principal, rate, tenure);

  const demoLoan = {
    id: nextLoanId++,
    type: 'HOME',
    principal: principal,
    outstandingPrincipal: 200000,
    interestRate: rate,
    tenureMonths: tenure,
    emi: emi,
    status: 'ACTIVE',
    remarks: 'Pre-approved home loan',
    customerId: demoCust.id,
    autoDebit: false,
    autoDebitAccountId: null,
    appliedAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
    approvedAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
    disbursedAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
  };
  loans.push(demoLoan);

  // Generate schedule starting 2 months ago
  const firstDueDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
  generateSchedule(demoLoan, firstDueDate);

  // Mark installment 1 as PAID 60 days ago
  const inst1 = loanInstallments.find(i => i.loanId === demoLoan.id && i.installmentNo === 1);
  if (inst1) {
    inst1.status = 'PAID';
    inst1.paidAmount = inst1.emiAmount;
    inst1.paidDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    demoLoan.outstandingPrincipal -= inst1.principalComponent;
  }

  // Mark installment 2 as PAID 30 days ago
  const inst2 = loanInstallments.find(i => i.loanId === demoLoan.id && i.installmentNo === 2);
  if (inst2) {
    inst2.status = 'PAID';
    inst2.paidAmount = inst2.emiAmount;
    inst2.paidDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    demoLoan.outstandingPrincipal -= inst2.principalComponent;
  }

  // Mark installment 3 as OVERDUE with 2% late fee
  const inst3 = loanInstallments.find(i => i.loanId === demoLoan.id && i.installmentNo === 3);
  if (inst3) {
    inst3.status = 'OVERDUE';
    inst3.dueDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    inst3.penaltyAmount = Math.round(inst3.emiAmount * 0.02 * 100) / 100;
  }

  demoLoan.outstandingPrincipal = Math.round(demoLoan.outstandingPrincipal * 100) / 100;

  beneficiaries.push({
    id: nextBenId++,
    customerId: demoCust.id,
    accountNumber: 'AC1002003002',
    beneficiaryName: 'Priya Patel',
    bankName: 'AMC Bank',
    ifscCode: 'AMCB0001234',
    status: 'VERIFIED',
    createdAt: new Date().toISOString()
  });

  notifications.push({
    id: 1,
    recipient: demoCust.email,
    title: 'Welcome to AMC Bank',
    message: 'Your savings account and loan portal are ready to use.',
    type: 'ACCOUNT',
    read: false,
    createdAt: new Date().toISOString()
  });

  notifications.push({
    id: 2,
    recipient: demoCust.email,
    title: 'EMI Overdue Notice',
    message: 'Installment #3 for Home Loan is overdue by 5 days. Late fee of â‚¹' + (inst3 ? inst3.penaltyAmount : 126) + ' has been applied.',
    type: 'LOAN',
    read: false,
    createdAt: new Date().toISOString()
  });

  // Second account for demo customer (Salary Account)
  const acc2 = {
    id: nextAccountId++,
    accountNumber: 'AC1002003003',
    type: 'SALARY',
    balance: 45000.00,
    minimumBalance: 0.00,
    dailyTransferLimit: 100000.00,
    status: 'ACTIVE',
    customerId: demoCust.id,
    createdAt: new Date().toISOString()
  };
  accounts.push(acc2);

  // Second customer for payee transfers (Priya Patel)
  const priyaCust = {
    id: nextCustomerId++,
    name: 'Priya Patel',
    email: 'priya@example.com',
    phone: '9876543220',
    pan: 'ABCDE5678F',
    address: '456 Bandra West, Mumbai',
    kycStatus: 'VERIFIED',
    createdAt: new Date().toISOString()
  };
  customers.push(priyaCust);

  const priyaAcc = {
    id: nextAccountId++,
    accountNumber: 'AC1002003002',
    type: 'SAVINGS',
    balance: 75000.00,
    minimumBalance: 1000.00,
    dailyTransferLimit: 100000.00,
    status: 'ACTIVE',
    customerId: priyaCust.id,
    createdAt: new Date().toISOString()
  };
  accounts.push(priyaAcc);

  // Seed sample pending deposit request for maker-checker demo
  depositRequests.push({
    id: nextDepositRequestId++,
    referenceNo: 'DEP' + Date.now().toString().slice(-8) + '1001',
    accountId: acc1.id,
    accountNumberMasked: maskAcct(acc1.accountNumber),
    customerId: demoCust.id,
    customerNameMasked: maskName(demoCust.name),
    amount: 25000.00,
    mode: 'CHEQUE',
    paymentReference: 'CHQ-889124',
    remarks: 'Quarterly bonus cheque deposit',
    status: 'PENDING',
    requestedByAdmin: null,
    requestedAt: new Date(Date.now() - 3600000).toISOString(),
    reviewedBy: null,
    reviewedAt: null,
    reviewRemarks: null,
    largeDeposit: false
  });
}

seedDemoData();

function parseJwt(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

function createToken(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

function authenticate(req) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.substring(7);
  return parseJwt(token);
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
  });
  res.end(JSON.stringify(data));
}

function sendError(res, statusCode, message) {
  sendJson(res, statusCode, {
    message,
    status: statusCode,
    timestamp: new Date().toISOString()
  });
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
  });
}

function logAudit(username, role, action, resource, details) {
  auditLogs.unshift({
    id: nextAuditId++,
    username: username || 'SYSTEM',
    role: role || 'SYSTEM',
    action,
    resource: resource || '',
    details: details || '',
    timestamp: new Date().toISOString()
  });
}

const server = http.createServer(async (req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
    });
    return res.end();
  }

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const query = parsedUrl.query;

  try {
    // ----------------- PUBLIC ENDPOINTS -----------------
    if (pathname === '/api/login' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const username = (body.username || '').trim().toLowerCase();
      const pwd = body.password || '';

      const user = users.find(u => u.username.toLowerCase() === username);
      if (!user || user.passwordHash !== hashPassword(pwd)) {
        return sendError(res, 401, 'Invalid username or password');
      }

      const cust = customers.find(c => c.id === user.customerId);
      const token = createToken({
        sub: user.username,
        role: user.role,
        customerId: user.customerId,
        customerName: cust ? cust.name : null,
        exp: Math.floor(Date.now() / 1000) + 3600
      });

      logAudit(user.username, user.role, 'LOGIN', 'Auth', 'User logged in successfully');

      return sendJson(res, 200, {
        token,
        username: user.username,
        role: user.role,
        customerId: user.customerId,
        customerName: cust ? cust.name : null
      });
    }

    if (pathname === '/api/loans/emi-preview' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const principal = parseFloat(body.principal || 0);
      const interestRate = parseFloat(body.interestRate || 0);
      const tenureMonths = parseInt(body.tenureMonths || 0, 10);

      if (principal < 10000) return sendError(res, 400, 'Principal must be at least â‚¹10,000');
      if (interestRate < 0 || interestRate > 50) return sendError(res, 400, 'Interest rate must be between 0% and 50%');
      if (tenureMonths < 1 || tenureMonths > 480) return sendError(res, 400, 'Tenure must be between 1 and 480 months');

      const emi = calculateEmi(principal, interestRate, tenureMonths);
      const r = interestRate / 1200;
      let opening = principal;
      let totalInterest = 0;
      const schedule = [];
      const firstDue = new Date();
      firstDue.setMonth(firstDue.getMonth() + 1);

      for (let i = 1; i <= tenureMonths; i++) {
        const dueDate = new Date(firstDue);
        dueDate.setMonth(dueDate.getMonth() + (i - 1));

        let interestComp = interestRate === 0 ? 0 : Math.round(opening * r * 100) / 100;
        let principalComp;
        let closing;
        let currentEmi = emi;

        if (i === tenureMonths) {
          principalComp = opening;
          closing = 0;
          currentEmi = Math.round((principalComp + interestComp) * 100) / 100;
        } else {
          principalComp = Math.round((emi - interestComp) * 100) / 100;
          if (principalComp > opening) principalComp = opening;
          closing = Math.round((opening - principalComp) * 100) / 100;
        }

        totalInterest += interestComp;
        schedule.push({
          installmentNo: i,
          dueDate: dueDate.toISOString().split('T')[0],
          openingBalance: opening,
          emiAmount: currentEmi,
          principalComponent: principalComp,
          interestComponent: interestComp,
          closingBalance: closing,
          status: 'PENDING',
          paidAmount: 0,
          penaltyAmount: 0,
          totalDue: currentEmi
        });

        opening = closing;
      }

      totalInterest = Math.round(totalInterest * 100) / 100;
      const totalPayable = Math.round((principal + totalInterest) * 100) / 100;

      return sendJson(res, 200, {
        emi,
        totalInterest,
        totalPayable,
        schedule
      });
    }

    // ----------------- AUTHENTICATED ENDPOINTS -----------------
    const authUser = authenticate(req);
    if (!authUser) {
      return sendError(res, 401, 'Unauthorized - please login again');
    }

    if (pathname === '/api/auth/me') {
      return sendJson(res, 200, {
        username: authUser.sub,
        role: authUser.role,
        customerId: authUser.customerId,
        customerName: authUser.customerName
      });
    }

    // ----------------- CUSTOMER SELF-SERVICE -----------------
    const customer = customers.find(c => c.id === authUser.customerId) || (authUser.role === 'ROLE_CUSTOMER' ? customers[0] : null);

    if ((pathname === '/api/customer/accounts' || pathname === '/api/customer/me/accounts') && req.method === 'GET') {
      if (!customer) return sendJson(res, 200, []);
      const myActive = accounts
        .filter(a => a.customerId === customer.id && a.status === 'ACTIVE')
        .map(a => {
          const num = a.accountNumber;
          const masked = num && num.length > 4 ? '•••• ' + num.slice(-4) : num;
          return {
            id: a.id,
            accountNumber: a.accountNumber,
            maskedAccountNumber: masked,
            type: a.type,
            balance: a.balance,
            minimumBalance: a.minimumBalance,
            dailyTransferLimit: a.dailyTransferLimit,
            status: a.status
          };
        });
      return sendJson(res, 200, myActive);
    }

    if (pathname === '/api/customer/me/loans' && req.method === 'GET') {
      return sendJson(res, 200, customer ? loans.filter(l => l.customerId === customer.id) : []);
    }

    if (pathname === '/api/customer/me/loans/apply' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const principal = parseFloat(body.principal || 0);
      const rate = parseFloat(body.interestRate || 8.5);
      const tenure = parseInt(body.tenureMonths || 36, 10);

      if (principal < 10000) return sendError(res, 400, 'Principal must be at least â‚¹10,000');
      const activeLoansCount = loans.filter(l => l.customerId === customer.id && l.status === 'ACTIVE').length;
      if (activeLoansCount >= 3) return sendError(res, 400, 'Maximum 3 active loans allowed');

      const totalBalance = accounts
        .filter(a => a.customerId === customer.id && a.status === 'ACTIVE')
        .reduce((sum, a) => sum + a.balance, 0);

      if (totalBalance < principal * 0.10) {
        return sendError(res, 400, `Active balance must be at least 10% of loan principal (Required: â‚¹${principal * 0.10})`);
      }

      const emi = calculateEmi(principal, rate, tenure);

      const newLoan = {
        id: nextLoanId++,
        type: body.type || 'PERSONAL',
        principal,
        outstandingPrincipal: principal,
        interestRate: rate,
        tenureMonths: tenure,
        emi,
        status: 'APPLIED',
        remarks: 'Customer online application',
        customerId: customer.id,
        autoDebit: false,
        autoDebitAccountId: null,
        appliedAt: new Date().toISOString()
      };
      loans.push(newLoan);

      // Generate preliminary schedule
      generateSchedule(newLoan, new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));

      logAudit(authUser.sub, 'ROLE_CUSTOMER', 'APPLY_LOAN', `Loan #${newLoan.id}`, `Applied for ${newLoan.type} loan â‚¹${principal}`);
      return sendJson(res, 201, newLoan);
    }

    // Schedule GET
    const schedMatch = pathname.match(/^\/api\/(customer\/)?loans\/(\d+)\/schedule$/);
    if (schedMatch && req.method === 'GET') {
      const loanId = parseInt(schedMatch[2], 10);
      const targetLoan = loans.find(l => l.id === loanId);
      if (!targetLoan) return sendError(res, 404, 'Loan not found');

      if (authUser.role !== 'ROLE_ADMIN' && targetLoan.customerId !== customer.id) {
        return sendError(res, 403, 'Access denied');
      }

      let items = loanInstallments.filter(i => i.loanId === loanId);
      if (items.length === 0) {
        generateSchedule(targetLoan, new Date());
        items = loanInstallments.filter(i => i.loanId === loanId);
      }

      return sendJson(res, 200, items);
    }

    // Schedule CSV download
    const csvMatch = pathname.match(/^\/api\/(customer\/)?loans\/(\d+)\/schedule\/csv$/);
    if (csvMatch && req.method === 'GET') {
      const loanId = parseInt(csvMatch[2], 10);
      const items = loanInstallments.filter(i => i.loanId === loanId);

      let csv = 'Installment No,Due Date,Opening Balance (INR),EMI Amount (INR),Principal Component (INR),Interest Component (INR),Closing Balance (INR),Status,Paid Amount (INR),Penalty (INR),Paid Date\n';
      items.forEach(it => {
        csv += `${it.installmentNo},${it.dueDate},${it.openingBalance},${it.emiAmount},${it.principalComponent},${it.interestComponent},${it.closingBalance},${it.status},${it.paidAmount},${it.penaltyAmount},${it.paidDate || ''}\n`;
      });

      res.writeHead(200, {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename=loan_schedule_${loanId}.csv`,
        'Access-Control-Allow-Origin': '*'
      });
      return res.end(csv);
    }

    // Summary GET
    const summaryMatch = pathname.match(/^\/api\/(customer\/)?loans\/(\d+)\/summary$/);
    if (summaryMatch && req.method === 'GET') {
      const loanId = parseInt(summaryMatch[2], 10);
      const targetLoan = loans.find(l => l.id === loanId);
      if (!targetLoan) return sendError(res, 404, 'Loan not found');

      if (authUser.role !== 'ROLE_ADMIN' && targetLoan.customerId !== customer.id) {
        return sendError(res, 403, 'Access denied');
      }

      const schedule = loanInstallments.filter(i => i.loanId === loanId);
      let paidCount = 0;
      let totalInterestPaid = 0;
      let totalPenaltyPaid = 0;
      let overdueAmount = 0;
      let nextInstallment = null;

      schedule.forEach(inst => {
        if (inst.status === 'PAID') {
          paidCount++;
          totalInterestPaid += inst.interestComponent;
          totalPenaltyPaid += inst.penaltyAmount;
        } else if (inst.status === 'OVERDUE') {
          const pending = inst.emiAmount - inst.paidAmount + inst.penaltyAmount;
          overdueAmount += pending;
          if (!nextInstallment) nextInstallment = inst;
        } else if (inst.status === 'PARTIALLY_PAID' || inst.status === 'PENDING') {
          if (!nextInstallment) nextInstallment = inst;
        }
      });

      const totalItems = schedule.length || 1;
      const progress = Math.round((paidCount / totalItems) * 1000) / 10;

      return sendJson(res, 200, {
        loanId: targetLoan.id,
        loanType: targetLoan.type,
        principal: targetLoan.principal,
        outstandingPrincipal: targetLoan.outstandingPrincipal,
        interestRate: targetLoan.interestRate,
        tenureMonths: targetLoan.tenureMonths,
        emi: targetLoan.emi,
        status: targetLoan.status,
        paidInstallmentsCount: paidCount,
        remainingInstallmentsCount: schedule.length - paidCount,
        repaymentProgressPercent: progress,
        totalInterestPaid: Math.round(totalInterestPaid * 100) / 100,
        totalPenaltyPaid: Math.round(totalPenaltyPaid * 100) / 100,
        overdueAmount: Math.round(overdueAmount * 100) / 100,
        nextInstallmentNo: nextInstallment ? nextInstallment.installmentNo : null,
        nextDueDate: nextInstallment ? nextInstallment.dueDate : null,
        nextDueAmount: nextInstallment ? Math.round((nextInstallment.emiAmount - nextInstallment.paidAmount + nextInstallment.penaltyAmount) * 100) / 100 : 0,
        autoDebit: targetLoan.autoDebit,
        autoDebitAccountId: targetLoan.autoDebitAccountId
      });
    }

    // Repay POST
    const repayMatch = pathname.match(/^\/api\/customer\/loans\/(\d+)\/repay$/);
    if (repayMatch && req.method === 'POST') {
      const loanId = parseInt(repayMatch[1], 10);
      const targetLoan = loans.find(l => l.id === loanId);
      if (!targetLoan) return sendError(res, 404, 'Loan not found');
      if (targetLoan.status !== 'ACTIVE') return sendError(res, 400, 'Loan is not ACTIVE');

      const body = await parseJsonBody(req);
      const srcAcc = accounts.find(a => a.id === body.sourceAccountId && a.customerId === customer.id);
      if (!srcAcc) return sendError(res, 400, 'Source account not found or not owned by you');
      if (srcAcc.status !== 'ACTIVE') return sendError(res, 400, 'Source account is not active');

      // Find next pending or overdue installment
      const installment = loanInstallments.find(i => i.loanId === loanId && (i.status === 'OVERDUE' || i.status === 'PARTIALLY_PAID' || i.status === 'PENDING'));
      if (!installment) return sendError(res, 400, 'No pending installment found for this loan');

      const totalDue = Math.round((installment.emiAmount - installment.paidAmount + installment.penaltyAmount) * 100) / 100;
      const paymentAmount = body.amount ? Math.min(parseFloat(body.amount), totalDue) : totalDue;

      if (paymentAmount <= 0) return sendError(res, 400, 'Payment amount must be greater than zero');
      if (srcAcc.balance < paymentAmount) {
        return sendError(res, 400, `Insufficient account balance. Available: â‚¹${srcAcc.balance}, Required: â‚¹${paymentAmount}`);
      }

      // Debit account
      srcAcc.balance = Math.round((srcAcc.balance - paymentAmount) * 100) / 100;

      // Update installment
      installment.paidAmount = Math.round((installment.paidAmount + paymentAmount) * 100) / 100;
      installment.paidDate = new Date().toISOString();
      if (installment.paidAmount >= installment.emiAmount + installment.penaltyAmount) {
        installment.status = 'PAID';
      } else {
        installment.status = 'PARTIALLY_PAID';
      }

      // Reduce loan outstanding balance
      targetLoan.outstandingPrincipal = Math.max(0, Math.round((targetLoan.outstandingPrincipal - installment.principalComponent) * 100) / 100);

      // Check if all installments are paid
      const pendingCount = loanInstallments.filter(i => i.loanId === loanId && (i.status === 'PENDING' || i.status === 'OVERDUE' || i.status === 'PARTIALLY_PAID')).length;
      if (pendingCount === 0) {
        targetLoan.status = 'CLOSED';
        targetLoan.outstandingPrincipal = 0;
      }

      // Record transaction
      const refId = 'TXN' + Math.random().toString(36).substring(2, 12).toUpperCase();
      transactions.unshift({
        id: nextTxnId++,
        referenceId: refId,
        account: srcAcc,
        targetAccount: null,
        transactionType: 'LOAN_EMI',
        amount: paymentAmount,
        balanceAfter: srcAcc.balance,
        description: `EMI Payment - Installment #${installment.installmentNo} (${targetLoan.type} Loan)`,
        timestamp: new Date().toISOString()
      });

      logAudit(authUser.sub, 'ROLE_CUSTOMER', 'LOAN_REPAYMENT', `Loan #${loanId} Inst #${installment.installmentNo}`, `Paid â‚¹${paymentAmount}`);
      return sendJson(res, 200, installment);
    }

    // Prepay POST
    const prepayMatch = pathname.match(/^\/api\/customer\/loans\/(\d+)\/prepay$/);
    if (prepayMatch && req.method === 'POST') {
      const loanId = parseInt(prepayMatch[1], 10);
      const targetLoan = loans.find(l => l.id === loanId);
      if (!targetLoan || targetLoan.status !== 'ACTIVE') return sendError(res, 400, 'Active loan not found');

      const body = await parseJsonBody(req);
      const prepayAmt = parseFloat(body.prepaymentAmount || 0);
      if (prepayAmt < 1000) return sendError(res, 400, 'Minimum prepayment is â‚¹1,000');

      const srcAcc = accounts.find(a => a.id === body.sourceAccountId && a.customerId === customer.id);
      if (!srcAcc || srcAcc.balance < prepayAmt) return sendError(res, 400, 'Insufficient balance in source account');

      srcAcc.balance = Math.round((srcAcc.balance - prepayAmt) * 100) / 100;
      targetLoan.outstandingPrincipal = Math.max(0, Math.round((targetLoan.outstandingPrincipal - prepayAmt) * 100) / 100);

      if (targetLoan.outstandingPrincipal === 0) {
        targetLoan.status = 'CLOSED';
        loanInstallments.filter(i => i.loanId === loanId && i.status !== 'PAID').forEach(i => (i.status = 'PAID'));
      } else {
        // Regenerate future installments
        const unpaid = loanInstallments.filter(i => i.loanId === loanId && i.status !== 'PAID');
        if (unpaid.length > 0) {
          const firstUnpaidNo = unpaid[0].installmentNo;
          const nextDueDate = unpaid[0].dueDate;

          // Remove old future installments
          loanInstallments = loanInstallments.filter(i => !(i.loanId === loanId && i.installmentNo >= firstUnpaidNo));

          const mode = body.mode || 'REDUCE_TENURE';
          let newTenure = unpaid.length;
          let newEmi = targetLoan.emi;

          if (mode === 'REDUCE_EMI') {
            newEmi = calculateEmi(targetLoan.outstandingPrincipal, targetLoan.interestRate, newTenure);
            targetLoan.emi = newEmi;
          } else {
            const r = targetLoan.interestRate / 1200;
            const p = targetLoan.outstandingPrincipal;
            if (newEmi <= p * r) {
              newTenure = unpaid.length;
            } else {
              const months = Math.log(newEmi / (newEmi - p * r)) / Math.log(1 + r);
              newTenure = Math.max(1, Math.ceil(months));
            }
          }

          let opening = targetLoan.outstandingPrincipal;
          const r = targetLoan.interestRate / 1200;
          for (let i = 1; i <= newTenure; i++) {
            const d = new Date(nextDueDate);
            d.setMonth(d.getMonth() + (i - 1));

            const interestComp = Math.round(opening * r * 100) / 100;
            let principalComp;
            let closing;
            let currentEmi = newEmi;

            if (i === newTenure) {
              principalComp = opening;
              closing = 0;
              currentEmi = Math.round((principalComp + interestComp) * 100) / 100;
            } else {
              principalComp = Math.round((newEmi - interestComp) * 100) / 100;
              closing = Math.round((opening - principalComp) * 100) / 100;
            }

            loanInstallments.push({
              id: nextInstallmentId++,
              loanId: targetLoan.id,
              installmentNo: firstUnpaidNo + i - 1,
              dueDate: d.toISOString().split('T')[0],
              openingBalance: opening,
              emiAmount: currentEmi,
              principalComponent: principalComp,
              interestComponent: interestComp,
              closingBalance: closing,
              status: 'PENDING',
              paidAmount: 0,
              paidDate: null,
              penaltyAmount: 0
            });
            opening = closing;
          }
        }
      }

      transactions.unshift({
        id: nextTxnId++,
        referenceId: 'TXN' + Math.random().toString(36).substring(2, 12).toUpperCase(),
        account: srcAcc,
        targetAccount: null,
        transactionType: 'LOAN_EMI',
        amount: prepayAmt,
        balanceAfter: srcAcc.balance,
        description: `Part Prepayment (${body.mode}) for ${targetLoan.type} Loan`,
        timestamp: new Date().toISOString()
      });

      logAudit(authUser.sub, 'ROLE_CUSTOMER', 'LOAN_PREPAYMENT', `Loan #${loanId}`, `Prepaid â‚¹${prepayAmt}`);
      return sendJson(res, 200, { message: 'Prepayment successful', outstandingPrincipal: targetLoan.outstandingPrincipal });
    }

    // Foreclosure quote GET
    const fcQuoteMatch = pathname.match(/^\/api\/customer\/loans\/(\d+)\/foreclosure-quote$/);
    if (fcQuoteMatch && req.method === 'GET') {
      const loanId = parseInt(fcQuoteMatch[1], 10);
      const targetLoan = loans.find(l => l.id === loanId);
      if (!targetLoan || targetLoan.status !== 'ACTIVE') return sendError(res, 400, 'Active loan not found');

      const outstanding = targetLoan.outstandingPrincipal;
      const accrued = Math.round((outstanding * (targetLoan.interestRate / 1200)) * 100) / 100;
      const fee = Math.round(outstanding * 0.02 * 100) / 100; // 2% foreclosure charge

      const unpaids = loanInstallments.filter(i => i.loanId === loanId && i.status !== 'PAID');
      const penalties = unpaids.reduce((sum, i) => sum + i.penaltyAmount, 0);

      const total = Math.round((outstanding + accrued + fee + penalties) * 100) / 100;

      return sendJson(res, 200, {
        loanId,
        asOfDate: new Date().toISOString().split('T')[0],
        outstandingPrincipal: outstanding,
        accruedInterest: accrued,
        foreclosureFeeRate: 2.0,
        foreclosureFee: fee,
        pendingPenalties: penalties,
        totalForeclosureAmount: total
      });
    }

    // Foreclosure execute POST
    const fcMatch = pathname.match(/^\/api\/customer\/loans\/(\d+)\/foreclose$/);
    if (fcMatch && req.method === 'POST') {
      const loanId = parseInt(fcMatch[1], 10);
      const targetLoan = loans.find(l => l.id === loanId);
      if (!targetLoan || targetLoan.status !== 'ACTIVE') return sendError(res, 400, 'Active loan not found');

      const body = await parseJsonBody(req);
      if (!body.confirmation) return sendError(res, 400, 'Foreclosure confirmation is required');

      const outstanding = targetLoan.outstandingPrincipal;
      const accrued = Math.round((outstanding * (targetLoan.interestRate / 1200)) * 100) / 100;
      const fee = Math.round(outstanding * 0.02 * 100) / 100;
      const unpaids = loanInstallments.filter(i => i.loanId === loanId && i.status !== 'PAID');
      const penalties = unpaids.reduce((sum, i) => sum + i.penaltyAmount, 0);
      const total = Math.round((outstanding + accrued + fee + penalties) * 100) / 100;

      const srcAcc = accounts.find(a => a.id === body.sourceAccountId && a.customerId === customer.id);
      if (!srcAcc || srcAcc.balance < total) return sendError(res, 400, `Insufficient account balance. Required: â‚¹${total}`);

      srcAcc.balance = Math.round((srcAcc.balance - total) * 100) / 100;
      targetLoan.status = 'CLOSED';
      targetLoan.outstandingPrincipal = 0;
      targetLoan.foreclosureDate = new Date().toISOString();
      targetLoan.foreclosureAmount = total;

      unpaids.forEach(u => {
        u.status = 'PAID';
        u.paidAmount = u.emiAmount;
        u.paidDate = new Date().toISOString();
      });

      transactions.unshift({
        id: nextTxnId++,
        referenceId: 'TXN' + Math.random().toString(36).substring(2, 12).toUpperCase(),
        account: srcAcc,
        targetAccount: null,
        transactionType: 'LOAN_EMI',
        amount: total,
        balanceAfter: srcAcc.balance,
        description: `Full Foreclosure Payoff for ${targetLoan.type} Loan (#${loanId})`,
        timestamp: new Date().toISOString()
      });

      logAudit(authUser.sub, 'ROLE_CUSTOMER', 'LOAN_FORECLOSURE', `Loan #${loanId}`, `Foreclosed with payment â‚¹${total}`);
      return sendJson(res, 200, { message: 'Loan foreclosed successfully', totalAmount: total });
    }

    // Auto-debit toggle PUT
    const autoDebitMatch = pathname.match(/^\/api\/customer\/loans\/(\d+)\/auto-debit$/);
    if (autoDebitMatch && req.method === 'PUT') {
      const loanId = parseInt(autoDebitMatch[1], 10);
      const targetLoan = loans.find(l => l.id === loanId && l.customerId === customer.id);
      if (!targetLoan) return sendError(res, 404, 'Loan not found');

      const enable = query.enable === 'true';
      targetLoan.autoDebit = enable;
      targetLoan.autoDebitAccountId = enable ? parseInt(query.accountId, 10) : null;
      return sendJson(res, 200, targetLoan);
    }

    // ----------------- ADMIN LOANS & OVERDUE -----------------
    if (pathname === '/api/loans/overdue' && req.method === 'GET') {
      const today = new Date();
      const overdueLoans = [];

      loans.filter(l => l.status === 'ACTIVE').forEach(l => {
        const overdues = loanInstallments.filter(i => i.loanId === l.id && i.status === 'OVERDUE');
        if (overdues.length > 0) {
          const cust = customers.find(c => c.id === l.customerId);
          let totalOverdue = 0;
          let maxDpd = 0;

          overdues.forEach(o => {
            const due = o.emiAmount - o.paidAmount + o.penaltyAmount;
            totalOverdue += due;
            const diffDays = Math.max(1, Math.round((today - new Date(o.dueDate)) / (1000 * 60 * 60 * 24)));
            if (diffDays > maxDpd) maxDpd = diffDays;
          });

          overdueLoans.push({
            loanId: l.id,
            customerId: l.customerId,
            customerName: cust ? cust.name : 'Unknown',
            customerEmail: cust ? cust.email : '',
            loanType: l.type,
            principal: l.principal,
            outstandingPrincipal: l.outstandingPrincipal,
            overdueInstallmentsCount: overdues.length,
            totalOverdueAmount: Math.round(totalOverdue * 100) / 100,
            maxDaysPastDue: maxDpd
          });
        }
      });

      overdueLoans.sort((a, b) => b.maxDaysPastDue - a.maxDaysPastDue);
      return sendJson(res, 200, overdueLoans);
    }

    if (pathname === '/api/loans/process-overdue' && req.method === 'POST') {
      const today = new Date();
      let count = 0;
      loanInstallments.forEach(item => {
        if (new Date(item.dueDate) < today && item.status === 'PENDING') {
          item.status = 'OVERDUE';
          if (item.penaltyAmount === 0) {
            item.penaltyAmount = Math.round(item.emiAmount * 0.02 * 100) / 100;
          }
          count++;
        }
      });
      return sendJson(res, 200, { message: `Overdue cycle processed. Updated ${count} installments.` });
    }

    // Existing core endpoints
    if (pathname === '/api/customer/me' && req.method === 'GET') {
      return sendJson(res, 200, customer);
    }

    if (pathname === '/api/customer/me/notifications' && req.method === 'GET') {
      return sendJson(res, 200, notifications.filter(n => n.recipient === customer.email));
    }

    if (pathname === '/api/customer/me/beneficiaries' && req.method === 'GET') {
      return sendJson(res, 200, beneficiaries.filter(b => b.customerId === customer.id));
    }

    // ---- Fixed Deposits ----
    const getFdRate = (months) => {
      if (months < 6) return 5.0;
      if (months < 12) return 5.5;
      if (months < 24) return 6.5;
      if (months < 36) return 7.0;
      if (months < 60) return 7.5;
      return 8.0;
    };

    const calcFdMaturity = (principal, rate, months) => {
      const p = Number(principal);
      const r = rate / 100.0;
      const n = 4.0; // quarterly
      const t = months / 12.0;
      const mat = p * Math.pow(1.0 + (r / n), n * t);
      return Math.round(mat * 100) / 100;
    };

    if ((pathname === '/api/customer/fixed-deposits' || pathname === '/api/customer/me/fixed-deposits') && req.method === 'GET') {
      const list = fixedDeposits
        .filter(f => f.customerId === customer.id)
        .map(f => {
          const acc = accounts.find(a => a.id === f.sourceAccountId);
          return {
            ...f,
            customerName: customer.name,
            sourceAccountNumber: acc ? acc.accountNumber : 'N/A'
          };
        });
      return sendJson(res, 200, list);
    }

    if ((pathname === '/api/customer/fixed-deposits' || pathname === '/api/customer/me/fixed-deposits') && req.method === 'POST') {
      let body = {};
      try { body = await parseJsonBody(req); } catch (_) {}
      const sourceAccountId = parseInt(body.sourceAccountId || query.sourceAccountId, 10);
      const amount = parseFloat(body.amount || query.amount || 0);
      const tenureMonths = parseInt(body.tenureMonths || query.tenureMonths || 12, 10);

      if (!sourceAccountId) return sendError(res, 400, 'Source account is required');
      if (isNaN(amount) || amount <= 0) return sendError(res, 400, 'Amount must be greater than zero');
      if (amount < 5000) return sendError(res, 400, 'Minimum Fixed Deposit opening amount is ₹5,000');
      if (tenureMonths < 1 || tenureMonths > 120) return sendError(res, 400, 'Tenure must be between 1 and 120 months (10 years)');

      const sourceAcc = accounts.find(a => a.id === sourceAccountId && a.customerId === customer.id);
      if (!sourceAcc) return sendError(res, 400, 'Source account not found or not owned by you');
      if (sourceAcc.status !== 'ACTIVE') return sendError(res, 400, `Source account is not ACTIVE (${sourceAcc.status})`);

      const minBal = sourceAcc.minimumBalance || 0;
      if (sourceAcc.balance - amount < minBal) {
        return sendError(res, 400, `Insufficient funds: balance after opening FD must maintain the minimum balance of ₹${minBal}`);
      }

      // Debit source account
      sourceAcc.balance -= amount;

      const rate = getFdRate(tenureMonths);
      const maturityAmt = calcFdMaturity(amount, rate, tenureMonths);
      const fdId = fixedDeposits.length + 1;
      const fdNum = 'FD' + Date.now().toString().slice(-8) + Math.floor(Math.random() * 90 + 10);
      const startDate = new Date().toISOString().split('T')[0];
      const matDateObj = new Date();
      matDateObj.setMonth(matDateObj.getMonth() + tenureMonths);
      const maturityDate = matDateObj.toISOString().split('T')[0];

      transactions.push({
        id: transactions.length + 1,
        referenceId: 'TXN' + Date.now(),
        accountId: sourceAcc.id,
        transactionType: 'FD_OPEN',
        amount: amount,
        balanceAfter: sourceAcc.balance,
        description: `Fixed Deposit Created: ${fdNum} (${tenureMonths} mos @ ${rate}%)`,
        timestamp: new Date().toISOString()
      });

      const newFd = {
        id: fdId,
        depositNumber: fdNum,
        customerId: customer.id,
        customerName: customer.name,
        sourceAccountId: sourceAcc.id,
        sourceAccountNumber: sourceAcc.accountNumber,
        principalAmount: amount,
        interestRate: rate,
        tenureMonths: tenureMonths,
        maturityAmount: maturityAmt,
        startDate: startDate,
        maturityDate: maturityDate,
        status: 'ACTIVE',
        createdAt: new Date().toISOString()
      };
      fixedDeposits.push(newFd);

      auditLogs.push({
        id: auditLogs.length + 1,
        action: 'OPEN_FIXED_DEPOSIT',
        performedBy: authUser.username,
        details: `Opened FD ${fdNum} for ₹${amount}`,
        timestamp: new Date().toISOString()
      });

      return sendJson(res, 201, newFd);
    }

    const fdDetailMatch = pathname.match(/^\/api\/customer\/(?:me\/)?fixed-deposits\/(\d+)$/);
    if (fdDetailMatch && req.method === 'GET') {
      const fdId = parseInt(fdDetailMatch[1], 10);
      const targetFd = fixedDeposits.find(f => f.id === fdId && f.customerId === customer.id);
      if (!targetFd) return sendError(res, 404, 'Fixed deposit not found');
      return sendJson(res, 200, targetFd);
    }

    const fdCloseMatch = pathname.match(/^\/api\/customer\/(?:me\/)?fixed-deposits\/(\d+)\/close$/);
    if (fdCloseMatch && req.method === 'POST') {
      const fdId = parseInt(fdCloseMatch[1], 10);
      const targetFd = fixedDeposits.find(f => f.id === fdId && f.customerId === customer.id);
      if (!targetFd) return sendError(res, 404, 'Fixed deposit not found');
      if (targetFd.status !== 'ACTIVE') return sendError(res, 400, `Fixed deposit cannot be closed (status: ${targetFd.status})`);

      // Penalty: 1% less than original rate
      const penaltyRate = Math.max(0.5, targetFd.interestRate - 1.0);
      const start = new Date(targetFd.startDate);
      const now = new Date();
      const daysElapsed = Math.max(1, Math.floor((now - start) / (1000 * 60 * 60 * 24)));

      let payout = targetFd.principalAmount;
      if (daysElapsed >= 7) {
        const yearsElapsed = daysElapsed / 365.25;
        payout = Math.round(targetFd.principalAmount * Math.pow(1.0 + (penaltyRate / 100.0 / 4.0), 4.0 * yearsElapsed) * 100) / 100;
      }

      let sourceAcc = accounts.find(a => a.id === targetFd.sourceAccountId && a.status === 'ACTIVE');
      if (!sourceAcc) {
        sourceAcc = accounts.find(a => a.customerId === customer.id && a.status === 'ACTIVE');
      }
      if (sourceAcc) {
        sourceAcc.balance += payout;
        transactions.push({
          id: transactions.length + 1,
          referenceId: 'TXN' + Date.now(),
          accountId: sourceAcc.id,
          transactionType: 'FD_CLOSE',
          amount: payout,
          balanceAfter: sourceAcc.balance,
          description: `Premature FD Closure: ${targetFd.depositNumber} (Principal: ₹${targetFd.principalAmount}, Payout: ₹${payout})`,
          timestamp: new Date().toISOString()
        });
      }

      targetFd.status = 'PREMATURELY_CLOSED';
      targetFd.prematurePayout = payout;

      auditLogs.push({
        id: auditLogs.length + 1,
        action: 'CLOSE_FIXED_DEPOSIT',
        performedBy: authUser.username,
        details: `Closed FD ${targetFd.depositNumber} with payout of ₹${payout}`,
        timestamp: new Date().toISOString()
      });

      return sendJson(res, 200, targetFd);
    }

    if (pathname === '/api/fixed-deposits' && req.method === 'GET') {
      const all = fixedDeposits.map(f => {
        const c = customers.find(cust => cust.id === f.customerId);
        const acc = accounts.find(a => a.id === f.sourceAccountId);
        return {
          ...f,
          customerName: c ? c.name : 'Unknown',
          sourceAccountNumber: acc ? acc.accountNumber : 'N/A'
        };
      });
      return sendJson(res, 200, all);
    }

    if (pathname === '/api/dashboard' && req.method === 'GET') {
      const totalDep = accounts.reduce((sum, a) => sum + a.balance, 0);
      return sendJson(res, 200, {
        totalDeposits: totalDep,
        customers: customers.length,
        totalCustomers: customers.length,
        activeAccounts: accounts.filter(a => a.status === 'ACTIVE').length,
        activeLoans: loans.filter(l => l.status === 'ACTIVE').length,
        overdueLoans: loanInstallments.filter(i => i.status === 'OVERDUE').length
      });
    }

    if (pathname === '/api/audit-logs' && req.method === 'GET') {
      const page = parseInt(query.page || 0, 10);
      const size = parseInt(query.size || 10, 10);
      const start = page * size;
      const paged = auditLogs.slice(start, start + size);
      return sendJson(res, 200, {
        content: paged,
        pageNumber: page,
        pageSize: size,
        totalElements: auditLogs.length,
        totalPages: Math.ceil(auditLogs.length / size) || 1,
        last: start + size >= auditLogs.length
      });
    }

    if (pathname === '/api/customers' && req.method === 'GET') {
      const search = (query.search || '').trim().toLowerCase();
      let filtered = customers;
      if (search) {
        filtered = customers.filter(c =>
          (c.name && c.name.toLowerCase().includes(search)) ||
          (c.city && c.city.toLowerCase().includes(search)) ||
          (c.email && c.email.toLowerCase().includes(search))
        );
      }
      return sendJson(res, 200, filtered);
    }

    if (pathname === '/api/customers' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const { name, email, city, panNumber, phoneNumber, initialPassword } = body;
      if (!name || !name.trim()) return sendError(res, 400, 'Name is required');
      if (!email || !email.includes('@')) return sendError(res, 400, 'Valid email is required');
      if (!panNumber || panNumber.trim().length !== 10) return sendError(res, 400, 'PAN must be 10 characters');
      if (!initialPassword || initialPassword.length < 6) return sendError(res, 400, 'Password must be at least 6 characters');

      const normalizedEmail = email.trim().toLowerCase();
      const normalizedPan = panNumber.trim().toUpperCase();

      if (customers.find(c => c.email.toLowerCase() === normalizedEmail)) {
        return sendError(res, 409, 'Email already registered: ' + normalizedEmail);
      }
      if (customers.find(c => c.panNumber && c.panNumber.toUpperCase() === normalizedPan)) {
        return sendError(res, 409, 'PAN already registered: ' + normalizedPan);
      }
      if (users.find(u => u.username.toLowerCase() === normalizedEmail)) {
        return sendError(res, 409, 'A login already exists for email: ' + normalizedEmail);
      }

      const newCust = {
        id: nextCustomerId++,
        name: name.trim(),
        email: normalizedEmail,
        phoneNumber: phoneNumber || null,
        city: city ? city.trim() : null,
        panNumber: normalizedPan,
        address: body.address || null,
        kycStatus: body.kycStatus || 'PENDING',
        createdAt: new Date().toISOString()
      };
      customers.push(newCust);

      users.push({
        id: nextUserId++,
        username: normalizedEmail,
        passwordHash: hashPassword(initialPassword),
        role: 'ROLE_CUSTOMER',
        customerId: newCust.id
      });

      logAudit('admin', 'ROLE_ADMIN', 'CREATE_CUSTOMER', 'Customer ID: ' + newCust.id, 'Created customer ' + newCust.name);
      return sendJson(res, 201, newCust);
    }

    // GET /api/customers/:id
    const custByIdMatch = pathname.match(/^\/api\/customers\/(\d+)$/);
    if (custByIdMatch && req.method === 'GET') {
      const cId = parseInt(custByIdMatch[1], 10);
      const found = customers.find(c => c.id === cId);
      if (!found) return sendError(res, 404, 'Customer not found with ID: ' + cId);
      return sendJson(res, 200, found);
    }

    // PUT /api/customers/:id
    if (custByIdMatch && req.method === 'PUT') {
      const cId = parseInt(custByIdMatch[1], 10);
      const cust = customers.find(c => c.id === cId);
      if (!cust) return sendError(res, 404, 'Customer not found with ID: ' + cId);

      const body = await parseJsonBody(req);
      const newEmail = (body.email || cust.email).trim().toLowerCase();
      const newPan = (body.panNumber || cust.panNumber).trim().toUpperCase();

      if (newEmail !== cust.email.toLowerCase() && customers.find(c => c.id !== cId && c.email.toLowerCase() === newEmail)) {
        return sendError(res, 409, 'Email already registered: ' + newEmail);
      }
      if (newPan !== (cust.panNumber || '').toUpperCase() && customers.find(c => c.id !== cId && c.panNumber && c.panNumber.toUpperCase() === newPan)) {
        return sendError(res, 409, 'PAN already registered: ' + newPan);
      }

      cust.name = (body.name || cust.name).trim();
      cust.email = newEmail;
      cust.panNumber = newPan;
      cust.city = body.city !== undefined ? body.city.trim() : cust.city;
      cust.phoneNumber = body.phoneNumber !== undefined ? body.phoneNumber : cust.phoneNumber;
      cust.address = body.address !== undefined ? body.address : cust.address;
      cust.kycStatus = body.kycStatus || cust.kycStatus;

      // Update user login username if email changed
      const userLogin = users.find(u => u.customerId === cId);
      if (userLogin && userLogin.username.toLowerCase() !== newEmail) {
        userLogin.username = newEmail;
      }

      logAudit('admin', 'ROLE_ADMIN', 'UPDATE_CUSTOMER', 'Customer ID: ' + cId, 'Updated customer details');
      return sendJson(res, 200, cust);
    }

    // DELETE /api/customers/:id
    if (custByIdMatch && req.method === 'DELETE') {
      const cId = parseInt(custByIdMatch[1], 10);
      const idx = customers.findIndex(c => c.id === cId);
      if (idx === -1) return sendError(res, 404, 'Customer not found');

      const hasAccounts = accounts.some(a => a.customerId === cId);
      const hasLoans = loans.some(l => l.customerId === cId);
      if (hasAccounts || hasLoans) {
        return sendError(res, 400, 'Customer cannot be deleted while active accounts or loans exist');
      }

      customers.splice(idx, 1);
      const uIdx = users.findIndex(u => u.customerId === cId);
      if (uIdx !== -1) users.splice(uIdx, 1);

      logAudit('admin', 'ROLE_ADMIN', 'DELETE_CUSTOMER', 'Customer ID: ' + cId, 'Deleted customer');
      return sendJson(res, 204, {});
    }

    // GET /api/customers/:id/accounts
    const custAccsMatch = pathname.match(/^\/api\/customers\/(\d+)\/accounts$/);
    if (custAccsMatch && req.method === 'GET') {
      const cId = parseInt(custAccsMatch[1], 10);
      if (!customers.find(c => c.id === cId)) return sendError(res, 404, 'Customer not found');
      return sendJson(res, 200, accounts.filter(a => a.customerId === cId));
    }

    // POST /api/customers/:id/accounts (admin opens account)
    if (custAccsMatch && req.method === 'POST') {
      const cId = parseInt(custAccsMatch[1], 10);
      if (!customers.find(c => c.id === cId)) return sendError(res, 404, 'Customer not found');
      const body = await parseJsonBody(req);
      const type = (body.type || 'SAVINGS').toUpperCase();
      if (!['SAVINGS', 'CURRENT'].includes(type)) return sendError(res, 400, 'Account type must be SAVINGS or CURRENT');
      const openingBalance = parseFloat(body.balance || 0);
      if (openingBalance < 0) return sendError(res, 400, 'Opening balance cannot be negative');

      const acctNo = 'AC' + Math.random().toString(36).substring(2, 12).toUpperCase();
      const minBal = type === 'SAVINGS' ? 1000 : 5000;
      const dailyLimit = type === 'SAVINGS' ? 100000 : 500000;

      const newAcc = {
        id: nextAccountId++,
        accountNumber: acctNo,
        type: type,
        balance: openingBalance,
        minimumBalance: minBal,
        dailyTransferLimit: dailyLimit,
        status: 'ACTIVE',
        customerId: cId,
        createdAt: new Date().toISOString()
      };
      accounts.push(newAcc);

      if (openingBalance > 0) {
        transactions.push({
          id: nextTxnId++,
          referenceId: 'TXN' + Date.now(),
          account: newAcc,
          targetAccount: null,
          transactionType: 'DEPOSIT',
          amount: openingBalance,
          balanceAfter: openingBalance,
          description: 'Account Opening Deposit',
          timestamp: new Date().toISOString()
        });
      }
      logAudit('admin', 'ROLE_ADMIN', 'OPEN_ACCOUNT', 'Account: ' + acctNo, 'Opened ' + type + ' account for customer ' + cId);
      return sendJson(res, 201, newAcc);
    }

    // PUT /api/accounts/:id/status
    const accStatusMatch = pathname.match(/^\/api\/accounts\/(\d+)\/status$/);
    if (accStatusMatch && req.method === 'PUT') {
      const aId = parseInt(accStatusMatch[1], 10);
      const acc = accounts.find(a => a.id === aId);
      if (!acc) return sendError(res, 404, 'Account not found');
      const newStatus = (query.status || '').toUpperCase();
      if (!['ACTIVE', 'FROZEN', 'CLOSED'].includes(newStatus)) return sendError(res, 400, 'Status must be ACTIVE, FROZEN or CLOSED');
      acc.status = newStatus;
      logAudit('admin', 'ROLE_ADMIN', 'UPDATE_ACCOUNT_STATUS', 'Account: ' + acc.accountNumber, 'Status set to ' + newStatus);
      return sendJson(res, 200, acc);
    }

    // POST /api/accounts/:id/deposit (admin)
    const accDepositMatch = pathname.match(/^\/api\/accounts\/(\d+)\/deposit$/);
    if (accDepositMatch && req.method === 'POST') {
      const aId = parseInt(accDepositMatch[1], 10);
      const acc = accounts.find(a => a.id === aId);
      if (!acc) return sendError(res, 404, 'Account not found');
      const amount = parseFloat(query.amount);
      if (isNaN(amount) || amount <= 0) return sendError(res, 400, 'Amount must be greater than zero');
      if (acc.status !== 'ACTIVE') return sendError(res, 400, 'Account is not ACTIVE');

      acc.balance = Math.round((acc.balance + amount) * 100) / 100;
      transactions.unshift({
        id: nextTxnId++,
        referenceId: 'TXN' + Date.now(),
        account: acc,
        targetAccount: null,
        transactionType: 'DEPOSIT',
        amount: amount,
        balanceAfter: acc.balance,
        description: 'Admin Cash Deposit',
        timestamp: new Date().toISOString()
      });
      logAudit('admin', 'ROLE_ADMIN', 'ADMIN_DEPOSIT', 'Account: ' + acc.accountNumber, 'Deposited ₹' + amount);
      return sendJson(res, 200, acc);
    }

    // POST /api/accounts/:id/withdraw (admin)
    const accWithdrawMatch = pathname.match(/^\/api\/accounts\/(\d+)\/withdraw$/);
    if (accWithdrawMatch && req.method === 'POST') {
      const aId = parseInt(accWithdrawMatch[1], 10);
      const acc = accounts.find(a => a.id === aId);
      if (!acc) return sendError(res, 404, 'Account not found');
      const amount = parseFloat(query.amount);
      if (isNaN(amount) || amount <= 0) return sendError(res, 400, 'Amount must be greater than zero');
      if (acc.status !== 'ACTIVE') return sendError(res, 400, 'Account is not ACTIVE');
      const minBal = acc.minimumBalance || 0;
      if (acc.balance - amount < minBal) return sendError(res, 400, `Withdrawal would violate minimum balance of ₹${minBal}. Available: ₹${acc.balance - minBal}`);

      acc.balance = Math.round((acc.balance - amount) * 100) / 100;
      transactions.unshift({
        id: nextTxnId++,
        referenceId: 'TXN' + Date.now(),
        account: acc,
        targetAccount: null,
        transactionType: 'WITHDRAWAL',
        amount: amount,
        balanceAfter: acc.balance,
        description: 'Admin Cash Withdrawal',
        timestamp: new Date().toISOString()
      });
      logAudit('admin', 'ROLE_ADMIN', 'ADMIN_WITHDRAWAL', 'Account: ' + acc.accountNumber, 'Withdrew ₹' + amount);
      return sendJson(res, 200, acc);
    }

    // GET /api/customers/:id/loans
    const custLoansMatch = pathname.match(/^\/api\/customers\/(\d+)\/loans$/);
    if (custLoansMatch && req.method === 'GET') {
      const cId = parseInt(custLoansMatch[1], 10);
      return sendJson(res, 200, loans.filter(l => l.customerId === cId));
    }

    if (pathname === '/api/accounts' && req.method === 'GET') {
      const search = (query.search || '').trim().toLowerCase();
      const statusFilter = (query.status || '').trim().toUpperCase();
      let filtered = accounts.map(a => {
        const c = customers.find(cust => cust.id === a.customerId);
        return {
          ...a,
          customerId: a.customerId || null,
          customerName: c ? c.name : (a.customerId ? `Unknown (ID: ${a.customerId})` : 'Unassigned / Orphaned'),
          customerEmail: c ? c.email : 'N/A',
          customerPhone: c ? c.phoneNumber : null
        };
      });
      
      if (statusFilter && statusFilter !== 'ALL') {
        filtered = filtered.filter(a => a.status === statusFilter);
      }

      if (search) {
        filtered = filtered.filter(a =>
          (a.accountNumber && a.accountNumber.toLowerCase().includes(search)) ||
          (a.customerName && a.customerName.toLowerCase().includes(search)) ||
          (a.customerEmail && a.customerEmail.toLowerCase().includes(search))
        );
      }
      const page = parseInt(query.page || 0, 10);
      const size = parseInt(query.size || 10, 10);
      const start = page * size;
      const paged = filtered.slice(start, start + size);
      return sendJson(res, 200, {
        content: paged,
        pageNumber: page,
        pageSize: size,
        totalElements: filtered.length,
        totalPages: Math.ceil(filtered.length / size) || 1,
        last: (start + size) >= filtered.length
      });
    }

    if (pathname === '/api/loans' && req.method === 'GET') {
      const result = loans.map(l => {
        const c = customers.find(cust => cust.id === l.customerId);
        return { ...l, customerName: c ? c.name : null };
      });
      return sendJson(res, 200, result);
    }

    const loanDecisionMatch = pathname.match(/^\/api\/loans\/(\d+)\/decision$/);
    if (loanDecisionMatch && req.method === 'PUT') {
      const lId = parseInt(loanDecisionMatch[1], 10);
      const targetLoan = loans.find(l => l.id === lId);
      if (!targetLoan) return sendError(res, 400, 'Loan not found');
      const decision = query.decision;
      if (decision === 'APPROVED') {
        targetLoan.status = 'ACTIVE';
        targetLoan.approvedAt = new Date().toISOString();
        targetLoan.disbursedAt = new Date().toISOString();
        const custAccs = accounts.filter(a => a.customerId === targetLoan.customerId);
        if (custAccs.length > 0) {
          custAccs[0].balance += targetLoan.principal;
        }
        generateSchedule(targetLoan, new Date());
      } else {
        targetLoan.status = 'REJECTED';
      }
      targetLoan.remarks = query.remarks || '';
      return sendJson(res, 200, targetLoan);
    }

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // PART A: FUNDS TRANSFER ENDPOINTS
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    // Account Lookup for safe Payee Verification
    const lookupMatch = pathname.match(/^\/api\/accounts\/lookup\/([A-Za-z0-9]+)$/);
    if (lookupMatch && req.method === 'GET') {
      const acctNo = lookupMatch[1];
      const targetAcc = accounts.find(a => a.accountNumber.toUpperCase() === acctNo.toUpperCase());
      if (!targetAcc) return sendError(res, 404, 'Destination account not found');
      if (targetAcc.status !== 'ACTIVE') return sendError(res, 400, `Destination account is ${targetAcc.status}`);

      const targetCust = customers.find(c => c.id === targetAcc.customerId);
      return sendJson(res, 200, {
        accountNumber: targetAcc.accountNumber,
        maskedAccountNumber: maskAcct(targetAcc.accountNumber),
        maskedHolderName: maskName(targetCust ? targetCust.name : 'Account Holder')
      });
    }

    // Customer Transfer Execution
    if (pathname === '/api/customer/transfers' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const { fromAccountId, toAccountNumber, remarks, idempotencyKey } = body;
      const amount = parseFloat(body.amount);

      // Idempotency check: if key already used, return original result without duplicate transfer
      if (idempotencyKey) {
        const existing = transfers.find(t => t.idempotencyKey === idempotencyKey);
        if (existing) {
          return sendJson(res, 200, existing);
        }
      }

      if (isNaN(amount) || amount <= 0) return sendError(res, 400, 'Transfer amount must be greater than zero');
      if (amount > 50000) return sendError(res, 400, 'Transfer amount exceeds per-transaction limit of â‚¹50,000.00');

      const src = accounts.find(a => a.id === fromAccountId && a.customerId === customer.id);
      if (!src) return sendError(res, 403, 'Unauthorized: source account does not belong to you');
      if (src.status !== 'ACTIVE') return sendError(res, 400, `Source account is ${src.status}`);

      const tgt = accounts.find(a => a.accountNumber === toAccountNumber);
      if (!tgt) return sendError(res, 404, 'Destination account number not found');
      if (tgt.status !== 'ACTIVE') return sendError(res, 400, `Destination account is ${tgt.status}`);
      if (src.id === tgt.id) return sendError(res, 400, 'Source and destination cannot be the same account');

      // Daily limit check (max 200,000 per day)
      const todayTransfers = transfers.filter(t => t.fromAccountId === src.id && t.status === 'SUCCESS');
      const dailySum = todayTransfers.reduce((sum, t) => sum + t.amount, 0);
      if (dailySum + amount > 200000) {
        return sendError(res, 400, `Daily transfer limit of â‚¹2,00,000.00 exceeded. Already transferred today: â‚¹${dailySum.toFixed(2)}`);
      }

      // Minimum balance check
      const minBal = src.minimumBalance || 0;
      if (src.balance - amount < minBal) {
        return sendError(res, 400, `Insufficient funds. Transfer would violate the minimum balance of â‚¹${minBal.toFixed(2)}. Available: â‚¹${src.balance.toFixed(2)}`);
      }

      // Balance mutation
      src.balance = Math.round((src.balance - amount) * 100) / 100;
      tgt.balance = Math.round((tgt.balance + amount) * 100) / 100;

      const refNo = 'TRF' + Date.now().toString().slice(-8) + Math.floor(1000 + Math.random() * 9000);
      const cleanRemarks = remarks && remarks.trim() ? remarks.trim() : 'Funds Transfer';

      // TWO ledger entries linked by the SAME reference ID
      const debitTxn = {
        id: nextTxnId++,
        referenceId: refNo,
        account: src,
        targetAccount: tgt,
        transactionType: 'TRANSFER_DEBIT',
        amount: amount,
        balanceAfter: src.balance,
        description: `Transfer to ${maskAcct(tgt.accountNumber)} - ${cleanRemarks}`,
        timestamp: new Date().toISOString()
      };
      transactions.unshift(debitTxn);

      const creditTxn = {
        id: nextTxnId++,
        referenceId: refNo,
        account: tgt,
        targetAccount: src,
        transactionType: 'TRANSFER_CREDIT',
        amount: amount,
        balanceAfter: tgt.balance,
        description: `Transfer from ${maskAcct(src.accountNumber)} - ${cleanRemarks}`,
        timestamp: new Date().toISOString()
      };
      transactions.unshift(creditTxn);

      const targetCust = customers.find(c => c.id === tgt.customerId);
      const transferRecord = {
        id: nextTransferId++,
        referenceNo: refNo,
        idempotencyKey: idempotencyKey || 'IDEM-' + Date.now(),
        fromAccountId: src.id,
        fromAccountNumber: src.accountNumber,
        toAccountId: tgt.id,
        toAccountNumberMasked: maskAcct(tgt.accountNumber),
        toAccountHolderNameMasked: maskName(targetCust ? targetCust.name : 'Account Holder'),
        amount: amount,
        remarks: remarks || '',
        status: 'SUCCESS',
        createdAt: new Date().toISOString()
      };
      transfers.unshift(transferRecord);

      logAudit(authUser.sub, 'ROLE_CUSTOMER', 'FUND_TRANSFER', refNo, `Transferred â‚¹${amount} to ${maskAcct(tgt.accountNumber)}`);

      notifications.unshift({
        id: notifications.length + 1,
        recipient: customer.email,
        title: 'Fund Transfer Successful',
        message: `Transferred â‚¹${amount} to account ${maskAcct(tgt.accountNumber)}. Ref: ${refNo}`,
        type: 'TRANSACTION',
        read: false,
        createdAt: new Date().toISOString()
      });

      if (targetCust && targetCust.email !== customer.email) {
        notifications.unshift({
          id: notifications.length + 1,
          recipient: targetCust.email,
          title: 'Funds Received',
          message: `Received â‚¹${amount} in account ${maskAcct(tgt.accountNumber)} from ${maskName(customer.name)}. Ref: ${refNo}`,
          type: 'TRANSACTION',
          read: false,
          createdAt: new Date().toISOString()
        });
      }

      return sendJson(res, 201, transferRecord);
    }

    // Customer Transfer History
    if (pathname === '/api/customer/transfers' && req.method === 'GET') {
      const myCustAccIds = accounts.filter(a => a.customerId === customer.id).map(a => a.id);
      let list = transfers.filter(t => myCustAccIds.includes(t.fromAccountId) || myCustAccIds.includes(t.toAccountId));
      if (query.accountId) {
        const accId = parseInt(query.accountId, 10);
        list = list.filter(t => t.fromAccountId === accId || t.toAccountId === accId);
      }
      if (query.status) {
        list = list.filter(t => t.status === query.status);
      }
      return sendJson(res, 200, {
        content: list,
        pageNumber: 0,
        pageSize: list.length || 10,
        totalElements: list.length,
        totalPages: 1,
        last: true
      });
    }

    // Customer Transfer Receipt Details
    const transferDetailMatch = pathname.match(/^\/api\/customer\/transfers\/(\d+)$/);
    if (transferDetailMatch && req.method === 'GET') {
      const trId = parseInt(transferDetailMatch[1], 10);
      const tr = transfers.find(t => t.id === trId);
      if (!tr) return sendError(res, 404, 'Transfer not found');
      return sendJson(res, 200, tr);
    }

    // Admin: All Transfers
    if (pathname === '/api/transfers' && req.method === 'GET') {
      return sendJson(res, 200, {
        content: transfers,
        pageNumber: 0,
        pageSize: transfers.length || 10,
        totalElements: transfers.length,
        totalPages: 1,
        last: true
      });
    }

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // PART B: DEPOSIT REQUESTS (MAKER-CHECKER) ENDPOINTS
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    // Customer: Create Deposit Request
    if (pathname === '/api/customer/deposit-requests' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const { accountId, mode, paymentReference, remarks } = body;
      const amount = parseFloat(body.amount);

      if (isNaN(amount) || amount <= 0) return sendError(res, 400, 'Deposit amount must be greater than zero');
      if (amount < 100) return sendError(res, 400, 'Deposit amount is below minimum allowed deposit of â‚¹100.00');
      if (amount > 10000000) return sendError(res, 400, 'Deposit amount exceeds maximum allowed deposit of â‚¹1,00,00,000.00');

      const acc = accounts.find(a => a.id === accountId && a.customerId === customer.id);
      if (!acc) return sendError(res, 403, 'Unauthorized: account does not belong to you');
      if (acc.status !== 'ACTIVE') return sendError(res, 400, `Account is ${acc.status}`);

      const refNo = 'DEP' + Date.now().toString().slice(-8) + Math.floor(1000 + Math.random() * 9000);
      const dr = {
        id: nextDepositRequestId++,
        referenceNo: refNo,
        accountId: acc.id,
        accountNumberMasked: maskAcct(acc.accountNumber),
        customerId: customer.id,
        customerNameMasked: maskName(customer.name),
        amount: amount,
        mode: (mode || 'CASH').toUpperCase(),
        paymentReference: paymentReference || null,
        remarks: remarks || '',
        status: 'PENDING',
        requestedByAdmin: null,
        requestedAt: new Date().toISOString(),
        reviewedBy: null,
        reviewedAt: null,
        reviewRemarks: null,
        largeDeposit: amount >= 1000000
      };
      depositRequests.unshift(dr);

      logAudit(authUser.sub, 'ROLE_CUSTOMER', 'CREATE_DEPOSIT_REQUEST', refNo, `Deposit request â‚¹${amount} submitted`);

      notifications.unshift({
        id: notifications.length + 1,
        recipient: customer.email,
        title: 'Deposit Request Submitted',
        message: `Your deposit request of â‚¹${amount} (${dr.mode}) is pending bank admin approval. Ref: ${refNo}`,
        type: 'TRANSACTION',
        read: false,
        createdAt: new Date().toISOString()
      });

      return sendJson(res, 201, dr);
    }

    // Customer: List Own Deposit Requests
    if (pathname === '/api/customer/deposit-requests' && req.method === 'GET') {
      let list = depositRequests.filter(d => d.customerId === customer.id);
      if (query.status && query.status !== 'ALL') {
        list = list.filter(d => d.status.toUpperCase() === query.status.toUpperCase());
      }
      return sendJson(res, 200, {
        content: list,
        pageNumber: 0,
        pageSize: list.length || 10,
        totalElements: list.length,
        totalPages: 1,
        last: true
      });
    }

    // Customer: Cancel Deposit Request
    const cancelDepMatch = pathname.match(/^\/api\/customer\/deposit-requests\/(\d+)\/cancel$/);
    if (cancelDepMatch && req.method === 'POST') {
      const drId = parseInt(cancelDepMatch[1], 10);
      const dr = depositRequests.find(d => d.id === drId && d.customerId === customer.id);
      if (!dr) return sendError(res, 404, 'Deposit request not found');
      if (dr.status !== 'PENDING') return sendError(res, 400, `Only PENDING requests can be cancelled. Current: ${dr.status}`);

      dr.status = 'CANCELLED';
      dr.reviewRemarks = 'Cancelled by customer';
      dr.reviewedAt = new Date().toISOString();

      logAudit(authUser.sub, 'ROLE_CUSTOMER', 'CANCEL_DEPOSIT_REQUEST', dr.referenceNo, `Cancelled deposit request of â‚¹${dr.amount}`);
      return sendJson(res, 200, dr);
    }

    // Admin: Deposit Requests List
    if (pathname === '/api/deposit-requests' && req.method === 'GET') {
      let list = [...depositRequests];
      if (query.status && query.status !== 'ALL') {
        list = list.filter(d => d.status.toUpperCase() === query.status.toUpperCase());
      }
      if (query.search) {
        const s = query.search.toLowerCase();
        list = list.filter(d =>
          (d.referenceNo && d.referenceNo.toLowerCase().includes(s)) ||
          (d.customerNameMasked && d.customerNameMasked.toLowerCase().includes(s)) ||
          (d.accountNumberMasked && d.accountNumberMasked.toLowerCase().includes(s))
        );
      }
      return sendJson(res, 200, {
        content: list,
        pageNumber: 0,
        pageSize: list.length || 10,
        totalElements: list.length,
        totalPages: 1,
        last: true
      });
    }

    // Admin: Pending Count KPI
    if (pathname === '/api/deposit-requests/pending-count' && req.method === 'GET') {
      const pendingCount = depositRequests.filter(d => d.status === 'PENDING').length;
      return sendJson(res, 200, { pendingCount });
    }

    // Admin: Deposit Request by ID
    const depDetailMatch = pathname.match(/^\/api\/deposit-requests\/(\d+)$/);
    if (depDetailMatch && req.method === 'GET') {
      const drId = parseInt(depDetailMatch[1], 10);
      const dr = depositRequests.find(d => d.id === drId);
      if (!dr) return sendError(res, 404, 'Deposit request not found');
      return sendJson(res, 200, dr);
    }

    // Admin Checker: Approve Deposit Request
    const depApproveMatch = pathname.match(/^\/api\/deposit-requests\/(\d+)\/approve$/);
    if (depApproveMatch && req.method === 'POST') {
      const drId = parseInt(depApproveMatch[1], 10);
      const dr = depositRequests.find(d => d.id === drId);
      if (!dr) return sendError(res, 404, 'Deposit request not found');
      if (dr.status !== 'PENDING') return sendError(res, 400, `Request has already been processed (${dr.status})`);

      // Separation of duties check: maker admin cannot approve their own deposit request
      if (dr.requestedByAdmin && dr.requestedByAdmin.toLowerCase() === authUser.sub.toLowerCase()) {
        return sendError(res, 403, 'Separation of duties violation: Maker cannot be Checker');
      }

      const acc = accounts.find(a => a.id === dr.accountId);
      if (!acc) return sendError(res, 404, 'Linked account not found');
      if (acc.status !== 'ACTIVE') return sendError(res, 400, `Cannot credit: account is ${acc.status}`);

      // Credit balance
      acc.balance = Math.round((acc.balance + dr.amount) * 100) / 100;

      // DEPOSIT Ledger entry
      const txn = {
        id: nextTxnId++,
        referenceId: dr.referenceNo,
        account: acc,
        targetAccount: null,
        transactionType: 'DEPOSIT',
        amount: dr.amount,
        balanceAfter: acc.balance,
        description: `Deposit Approved: ${dr.mode} Ref: ${dr.paymentReference || dr.referenceNo}`,
        timestamp: new Date().toISOString()
      };
      transactions.unshift(txn);

      dr.status = 'APPROVED';
      dr.reviewedBy = authUser.sub;
      dr.reviewedAt = new Date().toISOString();
      dr.reviewRemarks = query.reviewRemarks || 'Approved by Bank Admin';

      logAudit(authUser.sub, 'ROLE_ADMIN', 'APPROVE_DEPOSIT', dr.referenceNo, `Approved â‚¹${dr.amount} deposit for ${acc.accountNumber}`);

      const drCust = customers.find(c => c.id === dr.customerId);
      if (drCust) {
        notifications.unshift({
          id: notifications.length + 1,
          recipient: drCust.email,
          title: 'Deposit Approved & Credited',
          message: `Your deposit of â‚¹${dr.amount} has been approved and credited to ${maskAcct(acc.accountNumber)}. Balance: â‚¹${acc.balance}`,
          type: 'TRANSACTION',
          read: false,
          createdAt: new Date().toISOString()
        });
      }

      return sendJson(res, 200, dr);
    }

    // Admin Checker: Reject Deposit Request
    const depRejectMatch = pathname.match(/^\/api\/deposit-requests\/(\d+)\/reject$/);
    if (depRejectMatch && req.method === 'POST') {
      const drId = parseInt(depRejectMatch[1], 10);
      const dr = depositRequests.find(d => d.id === drId);
      if (!dr) return sendError(res, 404, 'Deposit request not found');
      if (dr.status !== 'PENDING') return sendError(res, 400, `Request has already been processed (${dr.status})`);

      const body = await parseJsonBody(req);
      if (!body.reason || !body.reason.trim()) {
        return sendError(res, 400, 'Rejection reason is mandatory');
      }

      dr.status = 'REJECTED';
      dr.reviewedBy = authUser.sub;
      dr.reviewedAt = new Date().toISOString();
      dr.reviewRemarks = body.reason.trim();

      logAudit(authUser.sub, 'ROLE_ADMIN', 'REJECT_DEPOSIT', dr.referenceNo, `Rejected â‚¹${dr.amount} deposit. Reason: ${body.reason}`);

      const drCust = customers.find(c => c.id === dr.customerId);
      if (drCust) {
        notifications.unshift({
          id: notifications.length + 1,
          recipient: drCust.email,
          title: 'Deposit Request Rejected',
          message: `Your deposit request of â‚¹${dr.amount} was rejected. Reason: ${body.reason}`,
          type: 'TRANSACTION',
          read: false,
          createdAt: new Date().toISOString()
        });
      }

      return sendJson(res, 200, dr);
    }

    // Admin: Ledger Reconciliation Check
    const reconcileMatch = pathname.match(/^\/api\/admin\/reconcile\/(\d+)$/);
    if (reconcileMatch && req.method === 'GET') {
      const accId = parseInt(reconcileMatch[1], 10);
      const acc = accounts.find(a => a.id === accId);
      if (!acc) return sendError(res, 404, 'Account not found');

      const accTxns = transactions.filter(t => t.account && t.account.id === acc.id);
      let calculatedBalance = 0;
      for (const t of accTxns) {
        const type = t.transactionType.toUpperCase();
        if (['DEPOSIT', 'TRANSFER_CREDIT', 'TRANSFER_IN', 'INTEREST_CREDIT'].includes(type)) {
          calculatedBalance += t.amount;
        } else if (['WITHDRAWAL', 'TRANSFER_DEBIT', 'TRANSFER_OUT', 'EMI_PAYMENT', 'FD_DEPOSIT', 'RD_DEPOSIT'].includes(type)) {
          calculatedBalance -= t.amount;
        }
      }
      calculatedBalance = Math.round(calculatedBalance * 100) / 100;
      const diff = Math.round(Math.abs(acc.balance - calculatedBalance) * 100) / 100;
      const reconciled = diff < 0.01;

      return sendJson(res, 200, {
        accountId: acc.id,
        accountNumber: acc.accountNumber,
        accountBalance: acc.balance,
        calculatedLedgerBalance: calculatedBalance,
        difference: diff,
        reconciled: reconciled,
        totalLedgerEntries: accTxns.length,
        message: reconciled
          ? 'Account balance perfectly reconciles with ledger entries.'
          : `Discrepancy detected: balance differs from net ledger entries by â‚¹${diff}`
      });
    }

    // Customer: Transactions
    if (pathname === '/api/customer/me/transactions' && req.method === 'GET') {
      const myTxns = transactions.filter(t => t.account && t.account.customerId === customer.id);
      return sendJson(res, 200, {
        content: myTxns,
        pageNumber: 0,
        pageSize: myTxns.length,
        totalElements: myTxns.length,
        totalPages: 1,
        last: true
      });
    }

    // Direct deposit endpoint disabled per maker-checker requirement
    const depositMatch = pathname.match(/^\/api\/customer\/me\/accounts\/(\d+)\/deposit$/);
    if (depositMatch && req.method === 'POST') {
      return sendError(res, 400, 'Direct deposits are disabled. Deposits require bank approval via maker-checker workflow. Please submit a deposit request via /api/customer/deposit-requests.');
    }

    const withdrawMatch = pathname.match(/^\/api\/customer\/me\/accounts\/(\d+)\/withdraw$/);
    if (withdrawMatch && req.method === 'POST') {
      const accId = parseInt(withdrawMatch[1], 10);
      const acc = accounts.find(a => a.id === accId && a.customerId === customer.id);
      if (!acc) return sendError(res, 400, 'Account not found');
      const amount = parseFloat(query.amount);
      if (acc.balance < amount) return sendError(res, 400, 'Insufficient balance');
      acc.balance -= amount;
      return sendJson(res, 200, acc);
    }

    sendError(res, 404, 'Endpoint not found');
  } catch (err) {
    console.error('API Error:', err);
    sendError(res, 500, err.message || 'Internal Server Error');
  }
});

server.listen(PORT, () => {
  console.log(`AMC Bank Enterprise Backend running on http://localhost:${PORT}`);
});
