# AMC Bank â€“ Enterprise Digital Banking Platform

> **Java 17 Â· Spring Boot 3.3.4 Â· Spring Security + JWT Â· PostgreSQL Â· React 18 + Vite**

---

## Table of Contents

1. [Project Structure](#project-structure)
2. [Quick Start](#quick-start)
3. [Credentials](#credentials)
4. [Feature Summary](#feature-summary)
5. [API Reference](#api-reference)
6. [Configuration Properties](#configuration-properties)
7. [Database Schema](#database-schema)
8. [Verification Flows](#verification-flows)
9. [Running Tests](#running-tests)
10. [Architecture Notes](#architecture-notes)

---

## Project Structure

```
bfsi_project/
â”œâ”€â”€ amc-backend/          # Spring Boot 3.3.4 backend
â”‚   â”œâ”€â”€ src/main/java/com/amcbank/simple/
â”‚   â”‚   â”œâ”€â”€ model/        # JPA entities
â”‚   â”‚   â”œâ”€â”€ repository/   # Spring Data JPA repos
â”‚   â”‚   â”œâ”€â”€ service/      # Business logic
â”‚   â”‚   â”œâ”€â”€ dto/          # Request/Response DTOs
â”‚   â”‚   â”œâ”€â”€ controller/   # REST controllers
â”‚   â”‚   â”œâ”€â”€ security/     # JWT filter, SecurityConfig
â”‚   â”‚   â””â”€â”€ exception/    # GlobalExceptionHandler
â”‚   â”œâ”€â”€ src/main/resources/db/migration/  # Flyway migrations
â”‚   â””â”€â”€ server.js         # Node.js mock backend (dev/testing)
â””â”€â”€ amc-frontend/         # React 18 + Vite
    â”œâ”€â”€ src/pages/        # CustomerApp.jsx, AdminApp.jsx, LoginPage.jsx
    â”œâ”€â”€ src/components/   # TransferView, AdminApprovalsView, ...
    â”œâ”€â”€ src/services/     # api.js (Axios client)
    â””â”€â”€ src/__tests__/    # Vitest unit tests
```

---

## Quick Start

### Option A â€“ Node.js Dev Mode (no Java/PostgreSQL needed)

```bash
# Terminal 1: Start mock backend
cd amc-backend
node server.js          # runs on http://localhost:8080

# Terminal 2: Start frontend
cd amc-frontend
npm install
npm run dev             # runs on http://localhost:5173
```

### Option B â€“ Full Spring Boot + PostgreSQL

```bash
# 1. Create DB
createdb amcbank

# 2. Configure application.properties (see Configuration section)

# 3. Start backend (Flyway auto-runs migrations V1-V4)
cd amc-backend
./mvnw spring-boot:run

# 4. Start frontend
cd amc-frontend
npm run dev
```

---

## Credentials

| Role     | Username          | Password    |
|----------|-------------------|-------------|
| Customer | Khushi@example.com | customer123 |
| Customer | priya@example.com | customer123 |
| Admin    | admin             | admin123    |

**Mock Accounts (Node dev mode)**

| Customer     | Account Number | Balance    |
|--------------|----------------|------------|
| Khushi Sharma | AC1002003001   | Rs 1,60,000 |
| Khushi Sharma | AC1002003003   | Rs 45,000  |
| Priya Patel  | AC1002003002   | Rs 75,000  |

---

## Feature Summary

### 1. Authentication and Security
- JWT-based stateless auth (ROLE_ADMIN / ROLE_CUSTOMER)
- BCrypt password hashing
- Account ownership checks on every customer endpoint

### 2. Loan and EMI System
- Eligibility: principal >= Rs 10,000, interest 0-50%, tenure 1-480 months, max 3 active loans, balance >= 10% of principal
- Full amortization schedule auto-generated on loan sanction
- Repayment, prepayment, foreclosure with penalty
- Customer auto-debit toggle per loan

### 3. Funds Transfer (Fully Implemented)

**External Transfer:**
- Transfer to any other AMC Bank account by account number
- Live payee verification (name masked: "P**** P****")
- Per-transaction limit: Rs 50,000
- Daily cumulative limit: Rs 2,00,000
- Pessimistic locking (consistent order) prevents race conditions
- Idempotency key prevents duplicate debits on network retries
- Dual ledger entries: TRANSFER_DEBIT + TRANSFER_CREDIT share same reference_no
- Transfer receipt with print capability
- Paginated transfer history with account/status filters

**Own Account (Self) Transfer:**
- Move funds between your own accounts instantly
- No payee verification step needed
- Destination account selected from a dropdown (shows current balance)
- Review modal clearly labels destination as "Your Own Account"
- Same atomic guarantee and idempotency as external transfers
- Auto-fills remarks "Own Account Transfer" if left blank
- Balance changes show for both source and destination

### 4. Maker-Checker Deposit Approval (Fully Implemented)
- Customer submits deposit request (PENDING) -- balance does NOT change
- Bank admin (checker) reviews and approves or rejects
- **Separation of Duties**: admin who created request cannot approve it
- **Double Approval Guard**: pessimistic lock + status check prevents race
- Reject requires mandatory reason (blank reason blocked)
- Customer can cancel their own PENDING request
- Approved: credits balance + writes DEPOSIT ledger entry + sends notification
- Admin KPI tile shows pending approval count on dashboard
- Ledger reconciliation verifies balance matches transaction history

### 5. Customer Portal
- Dashboard with balance charts, loan summary, recent transactions
- Account management, transaction history (CSV/PDF download)
- Beneficiary management
- Fixed Deposits
- Loan application and EMI schedule viewer
- In-app notifications
- Profile and KYC viewer

### 6. Admin Portal
- Customer CRUD (create/edit/delete, account status management)
- All-accounts overview
- Deposit Approvals queue with history tab
- Transfers audit log (all customers)
- Ledger reconciliation per account
- Dashboard KPI cards (customers, accounts, loans, pending approvals)

---

## API Reference

### Authentication
| Method | Endpoint    | Auth | Description                      |
|--------|-------------|------|----------------------------------|
| POST   | /api/login  | None | Returns { token, role, username } |

### Customer - Transfers
| Method | Endpoint                    | Auth     | Description                     |
|--------|-----------------------------|----------|---------------------------------|
| POST   | /api/customer/transfers     | CUSTOMER | Execute transfer (external or self) |
| GET    | /api/customer/transfers     | CUSTOMER | Paginated transfer history      |

### Account Lookup
| Method | Endpoint                              | Auth          | Description                        |
|--------|---------------------------------------|---------------|------------------------------------|
| GET    | /api/accounts/lookup/{accountNumber}  | Authenticated | Returns masked holder name for payee verification |

### Customer - Deposit Requests
| Method | Endpoint                                      | Auth     | Description                    |
|--------|-----------------------------------------------|----------|--------------------------------|
| POST   | /api/customer/deposit-requests                | CUSTOMER | Submit a deposit request       |
| GET    | /api/customer/deposit-requests                | CUSTOMER | Paginated own deposit requests |
| DELETE | /api/customer/deposit-requests/{id}/cancel    | CUSTOMER | Cancel own PENDING request     |

### Admin - Deposit Approvals
| Method | Endpoint                              | Auth  | Description                      |
|--------|---------------------------------------|-------|----------------------------------|
| GET    | /api/deposit-requests                 | ADMIN | Paginated all deposit requests   |
| GET    | /api/deposit-requests/pending-count   | ADMIN | Count of PENDING requests        |
| POST   | /api/deposit-requests/{id}/approve    | ADMIN | Approve with optional remarks    |
| POST   | /api/deposit-requests/{id}/reject     | ADMIN | Reject with mandatory reason     |

### Admin - Transfers Audit
| Method | Endpoint       | Auth  | Description                          |
|--------|----------------|-------|--------------------------------------|
| GET    | /api/transfers | ADMIN | All transfers across all customers   |

### Admin - Reconciliation
| Method | Endpoint                        | Auth  | Description                               |
|--------|---------------------------------|-------|-------------------------------------------|
| GET    | /api/admin/reconcile/{accountId} | ADMIN | Ledger sum vs balance; flags discrepancies |

### Customer - Loans
| Method | Endpoint                                  | Auth     | Description               |
|--------|-------------------------------------------|----------|---------------------------|
| POST   | /api/customer/me/loans/apply              | CUSTOMER | Apply for a loan          |
| GET    | /api/customer/me/loans                    | CUSTOMER | List own loans            |
| GET    | /api/customer/me/loans/{id}/schedule      | CUSTOMER | EMI installment schedule  |
| POST   | /api/customer/me/loans/{id}/repay         | CUSTOMER | Pay an installment        |
| POST   | /api/customer/me/loans/{id}/prepay        | CUSTOMER | Prepay ahead of schedule  |
| POST   | /api/customer/me/loans/{id}/foreclose     | CUSTOMER | Foreclose with penalty    |

---

## Configuration Properties

```properties
# Transfer Limits
amc.banking.transfer.per-transaction-limit=50000.00
amc.banking.transfer.daily-limit=200000.00
amc.banking.transfer.minimum-balance=500.00

# Deposit Request Limits and Controls
amc.banking.deposit.min-amount=100.00
amc.banking.deposit.max-amount=10000000.00
amc.banking.deposit.large-deposit-threshold=1000000.00
amc.banking.deposit.separation-of-duties=true

# JWT
amc.jwt.secret=<your-256-bit-secret>
amc.jwt.expiration-ms=86400000

# Database (Flyway)
spring.flyway.enabled=true
spring.flyway.baseline-on-migrate=true
```

---

## Database Schema

### Flyway Migration Files

| File                                       | Description                                                        |
|--------------------------------------------|--------------------------------------------------------------------|
| V1__initial_schema.sql                     | customers, users, accounts, transactions, loans, loan_installments |
| V2__audit_notifications.sql                | audit_logs, notifications tables                                   |
| V3__beneficiaries_fds.sql                  | beneficiaries, fixed_deposits tables                               |
| V4__transfers_and_deposit_requests.sql     | transfers, deposit_requests; drops reference_id unique constraint  |

### Key New Tables (V4)

**transfers**
```sql
id BIGSERIAL PRIMARY KEY,
from_account_id BIGINT REFERENCES accounts,
to_account_id BIGINT REFERENCES accounts,
amount NUMERIC(15,2) NOT NULL,
reference_no VARCHAR(50) UNIQUE,
status VARCHAR(20),          -- SUCCESS / FAILED
remarks VARCHAR(500),
idempotency_key VARCHAR(100) UNIQUE,
sender_customer_id BIGINT,
created_at TIMESTAMP
```

**deposit_requests**
```sql
id BIGSERIAL PRIMARY KEY,
reference_no VARCHAR(50) UNIQUE,
account_id BIGINT REFERENCES accounts,
customer_id BIGINT REFERENCES customers,
amount NUMERIC(15,2) NOT NULL,
mode VARCHAR(20),            -- CASH / CHEQUE / NEFT / IMPS / UPI
payment_reference VARCHAR(100),
remarks VARCHAR(500),
status VARCHAR(20),          -- PENDING / APPROVED / REJECTED / CANCELLED
requested_by_admin VARCHAR(100),
requested_at TIMESTAMP,
reviewed_by VARCHAR(100),
reviewed_at TIMESTAMP,
review_remarks VARCHAR(500),
flagged_large BOOLEAN
```

---

## Verification Flows

### External Transfer

1. Login: Khushi@example.com / customer123
2. Sidebar: **Fund Transfer**
3. Click **External Transfer** tab (default)
4. Select source: AC1002003001
5. Type destination: `AC1002003002`
6. Wait for: "Verified Payee: P**** P****"
7. Amount: 5000, Remarks: "Test payment"
8. Click **Review & Confirm Transfer**
9. Modal shows accounts, balance after debit
10. Click **Authorize & Send Money**
11. Receipt: Reference No, timestamp, SUCCESS badge
12. Click **Transfer History** -- record appears

### Own Account (Self) Transfer

1. Login: Khushi@example.com / customer123
2. Sidebar: **Fund Transfer**
3. Click **Own Account Transfer** tab
4. Blue info banner appears
5. Debit Account: AC1002003001 (Rs 1,60,000)
6. Credit Account: AC1002003003 (Rs 45,000) -- only other own accounts shown
7. Amount: 15000
8. Click **Review Self Transfer**
9. Confirm modal shows "Your Own Account" for destination
10. Click **Authorize & Send Money**
11. Receipt shows SUCCESS; AC1002003001 = Rs 1,45,000; AC1002003003 = Rs 60,000

### Maker-Checker Deposit

1. Login as customer -- **Deposit Requests** sidebar
2. Select account, Amount: 12000, Mode: CHEQUE, Ref: CHQ-001
3. Click **Submit Deposit Request**
4. Status shows PENDING; balance unchanged
5. Logout, login as admin
6. Dashboard shows Pending Approvals badge
7. Go to **Deposit Approvals** -- request appears
8. Click **Approve**, enter remarks, confirm
9. Login back as customer -- balance increased by Rs 12,000
10. Request shows APPROVED with reviewer name

### Separation of Duties Check

1. Admin creates deposit request on behalf of customer (via API with admin token)
2. Same admin tries to approve it
3. Response: 403 "Separation of duties violation: maker admin cannot approve their own deposit request"
4. A different admin can approve it successfully

### Ledger Reconciliation

1. Admin -> **Deposit Approvals** -> **Ledger Reconciliation** tab
2. Enter account ID (e.g., 1)
3. Click **Run Reconciliation**
4. Report: calculatedLedgerBalance = accountBalance, discrepancy = 0.00, balanced: true

---

## Running Tests

### Frontend (Vitest)

```bash
cd amc-frontend
npm test
```

Expected: **12 tests passing** across 2 files:
- `format.test.js` (5 tests): transaction type formatting, status badges
- `transfer_and_approvals.test.js` (7 tests): UI helpers for transfers and deposit approvals

### Backend (JUnit 5 + Mockito)

```bash
cd amc-backend
mvn test -Dtest=TransferServiceTest    # 7+ tests: transfer, idempotency, limits, auth
mvn test -Dtest=DepositServiceTest     # 12 tests: maker-checker, separation of duties
mvn test -Dtest=BankServiceTest        # Existing loan/account service tests
mvn test                               # All test suites
```

**TransferServiceTest covers:**
- Successful transfer: dual ledger entries, balance updates
- Idempotent retry: same key returns same result without double-debit
- Minimum balance retention enforcement
- Same-account transfer rejection
- Frozen account rejection
- Per-transaction limit enforcement (> Rs 50,000)
- Daily limit enforcement (> Rs 2,00,000)
- Unauthorized account access blocked

**DepositServiceTest covers:**
- Create request: balance unchanged, PENDING status
- Invalid amount (zero, below minimum) blocked
- Frozen account blocked
- Unauthorized customer blocked
- Approve: credits balance, writes ledger entry, sends notification
- Double approval blocked (already processed status)
- Separation of duties: maker cannot approve own request
- Different admin can approve (separation of duties allowed)
- Reject: mandatory reason enforced, balance unchanged
- Cancel: own pending request, non-owner blocked, non-pending blocked
- Ledger reconciliation: matches sum of DEPOSIT + CREDIT - DEBIT vs balance

---

## Architecture Notes

### Double-Entry Ledger
Both the debit and credit legs of every transfer share the **same `reference_no`** in the `transactions` table. The original `UNIQUE` constraint on `transactions.reference_id` was dropped in V4 and replaced with an index.

### Pessimistic Locking
Accounts are locked in **consistent ID order** (min ID first, then max ID) to prevent deadlocks when two users transfer to each other simultaneously.

### Idempotency
Each transfer form generates a fresh UUID (idempotency_key). If the same key is submitted twice, the second call returns the original result without double-debiting. This survives browser refresh and network retries.

### Self Transfer
Self-transfers use the same `/api/customer/transfers` endpoint. The frontend resolves the destination account number from the own-account dropdown and passes it as `toAccountNumber`. The backend processes it identically to external transfers with the same atomic guarantee.

### Maker-Checker Pattern
The `deposit_requests.requested_by_admin` field tracks which admin submitted a request on behalf of a customer. The `separation-of-duties` flag (default true) prevents the same admin from being both maker and checker.
