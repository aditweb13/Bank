# 📋 ARBC Bank – Phase 1 Implementation & Progress Task Tracker

This task file outlines all the core tasks and milestones required to complete **Phase 1: Foundation, User Authentication, Customer Onboarding, Account Management & Core Fund Transfers** for ARBC Bank Enterprise Digital Banking Platform.

---

## 🎯 Phase 1 Objectives & Scope

- [x] **Project Infrastructure & Setup**: Server initialization, REST API proxy configuration, database migration scripts (`V1__initial_schema.sql`, `V2__seed_data.sql`).
- [x] **JWT Authentication & Security**: Role-based access control (`ROLE_ADMIN` vs `ROLE_CUSTOMER`), token storage, protected routes.
- [ ] **Customer Onboarding & Profile Management**: Administrative customer registration, PAN verification, KYC status handling.
- [ ] **Account Management Core**: Multi-account creation (Savings, Current, Salary), balance calculations, status management (`ACTIVE`, `FROZEN`, `CLOSED`).
- [ ] **Core Fund Transfers**: Dual-ledger self & external transfers with transaction limit validation and instant balance reflection.
- [ ] **Quality Assurance & Verification**: Verification tests, API integration checks, and end-to-end workflow validation.

---

## 📅 Detailed Task Checklist

### Module 1: Project Setup & System Infrastructure
- [x] **Task 1.1**: Set up project structure (`amc-backend` and `amc-frontend`).
- [x] **Task 1.2**: Configure database migrations & seed scripts (`V1__initial_schema.sql`, `V2__seed_data.sql`).
- [x] **Task 1.3**: Configure lightweight backend dev server (`amc-backend/server.js`) on port `8080`.
- [x] **Task 1.4**: Configure Vite dev server proxy (`amc-frontend/vite.config.js`) pointing `/api` to `http://localhost:8080`.
- [x] **Task 1.5**: Rebrand platform elements across UI and server from AMC Bank to **ARBC Bank**.

---

### Module 2: Authentication & Access Control
- [x] **Task 2.1**: Implement JWT authentication filter & token generation mechanism.
- [x] **Task 2.2**: Build Login Page UI (`amc-frontend/src/pages/LoginPage.jsx`) supporting Admin and Customer logins.
- [x] **Task 2.3**: Implement frontend Axios interceptors (`amc-frontend/src/services/api.js`) for attaching `Authorization: Bearer <token>`.
- [x] **Task 2.4**: Implement Role-based routing (`ROLE_ADMIN` redirecting to `/admin`, `ROLE_CUSTOMER` redirecting to `/customer`).
- [x] **Task 2.5**: Add session logout & local storage token cleanup logic.

---

### Module 3: Customer Onboarding & KYC Management (Admin Portal)
- [ ] **Task 3.1**: Design Admin Customer Management View (`amc-frontend/src/components/AdminCustomersView.jsx`).
- [ ] **Task 3.2**: Build Customer Registration Modal (Fields: Full Name, Email, Phone, City, PAN Number, Address, Initial Password).
- [ ] **Task 3.3**: Implement backend customer creation REST endpoint (`POST /api/admin/customers`).
- [ ] **Task 3.4**: Implement Customer KYC Verification status toggling (`PENDING`, `VERIFIED`, `REJECTED`).
- [ ] **Task 3.5**: Implement Customer search, filter, and detailed profile viewing drawer.

---

### Module 4: Account Lifecycle & Balance Controls
- [ ] **Task 4.1**: Build Account Creation REST endpoint (`POST /api/admin/accounts`) for opening Savings, Current, or Salary accounts.
- [ ] **Task 4.2**: Implement Account Status controls (`ACTIVE`, `FROZEN`, `CLOSED`) with admin override capability.
- [ ] **Task 4.3**: Implement balance safeguard validations (Minimum balance rules: ₹1,000 for Savings, ₹5,00,00 for Current).
- [ ] **Task 4.4**: Build Customer Account Portfolio view (`amc-frontend/src/pages/CustomerApp.jsx`) displaying total balance across all accounts.
- [ ] **Task 4.5**: Add quick-copy account number and masked account display logic.

---

### Module 5: Fund Transfers & Transaction Ledger
- [ ] **Task 5.1**: Build Self-Transfer interface allowing instant movement of funds between a customer's own accounts.
- [ ] **Task 5.2**: Build External Transfer interface allowing transfers to third-party accounts via Account Number & IFSC code.
- [ ] **Task 5.3**: Enforce daily transaction limit checks (Default: ₹1,00,000 for Savings, ₹5,00,000 for Current).
- [ ] **Task 5.4**: Implement dual-ledger atomic debit/credit operations with reference ID generation (`TXN...`).
- [ ] **Task 5.5**: Build Customer Transaction History table with transaction filtering (Type, Date, Amount range).
- [ ] **Task 5.6**: Build Admin Global Transfers Ledger (`amc-frontend/src/components/AdminTransfersView.jsx`) for complete auditability.

---

### Module 6: Testing, Polish & Verification
- [ ] **Task 6.1**: Run backend API endpoint unit & integration tests (`vitest run` / Maven tests).
- [ ] **Task 6.2**: Perform browser integration testing using `admin` / `admin123` credentials.
- [ ] **Task 6.3**: Verify end-to-end customer registration, account opening, and fund transfer execution.
- [ ] **Task 6.4**: Ensure glassmorphic design consistency and dark/light theme responsiveness.

---

## 📊 Summary of Phase 1 Deliverables

| Deliverable | Key Components | Completion Criteria |
| :--- | :--- | :--- |
| **Authentication System** | JWT Auth, Login Page, Local Storage Token | Secure sign-in for `ROLE_ADMIN` & `ROLE_CUSTOMER` |
| **Customer Onboarding** | Admin Portal, Registration Form, PAN/KYC | Admin can register customers & verify KYC |
| **Account Management** | Accounts Table, Status Controls, Balance Check | Support Savings/Current/Salary accounts & freezing |
| **Fund Transfer Engine** | Self Transfer, External Transfer, Double Entry | Atomic balance updates & daily limit enforcement |
| **Audit Ledger** | Global Transaction History, Account Statements | Full transparency & transaction reference IDs |

---

> [!TIP]
> Mark tasks as completed by changing `[ ]` to `[x]` in this markdown file as you progress through Phase 1 implementation.
