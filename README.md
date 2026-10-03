# 🏦 ARBC Bank – Enterprise Digital Banking Platform

![Java](https://img.shields.io/badge/Java-17-orange.svg)
![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.3.4-brightgreen.svg)
![Spring Security](https://img.shields.io/badge/Spring%20Security-JWT-red.svg)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue.svg)
![Flyway](https://img.shields.io/badge/Flyway-Migrations-red.svg)
![React](https://img.shields.io/badge/React-18-cyan.svg)
![Vite](https://img.shields.io/badge/Vite-5-purple.svg)
![Vitest](https://img.shields.io/badge/Testing-Vitest-yellow.svg)

**ARBC Bank** is a full-featured, enterprise-grade BFSI (Banking, Financial Services, and Insurance) digital banking web application built with **Java 17**, **Spring Boot 3.3.4**, **Spring Security + JWT**, **Spring Data JPA**, **Flyway Database Migrations**, **PostgreSQL**, and a modern **React 18 + Vite** frontend.

---

## 📑 Table of Contents
1. [Overview](#-overview)
2. [Technology Stack](#-technology-stack)
3. [System Architecture](#-system-architecture)
4. [User Accounts & Default Credentials](#-user-accounts--default-credentials)
5. [Key Features & Workflows](#-key-features--workflows)
   - [Customer Banking Portal](#customer-banking-portal)
   - [Admin Operations Portal](#admin-operations-portal)
   - [Banking Controls & Core Rules](#banking-controls--core-rules)
6. [Business Formulas & Logic](#-business-formulas--logic)
7. [Installation & Setup Guide](#-installation--setup-guide)
8. [REST API Documentation](#-rest-api-documentation)
9. [Automated Testing](#-automated-testing)
10. [Database Migrations](#-database-migrations)

---

## 🌟 Overview

ARBC Bank provides an end-to-end digital banking experience for customers and banking administrators. It supports real-time dual-ledger fund transfers, maker-checker cash deposit approvals, term/fixed deposits with premature closure logic, automated loan eligibility evaluations, reducing-balance EMI calculators, and administrative customer onboarding.

---

## 💻 Technology Stack

### Frontend Architecture (`amc-frontend`)
- **Core Framework**: React 18 + Vite 5
- **UI & Styling**: Vanilla CSS with custom glassmorphic theme system, responsive grid/flex layouts, and dark mode support.
- **Icons & Components**: Lucide React (`lucide-react`)
- **API Client**: Axios with request/response interceptors for JWT Bearer token management.
- **Test Suite**: Vitest + React Testing Library

### Backend Architecture (`amc-backend` & Dev Server)
- **Production Backend (`amc-backend`)**:
  - **Runtime & Language**: JDK 17
  - **Framework**: Spring Boot 3.3.4
  - **Security**: Spring Security + JJWT 0.12.6 (Stateless JWT Filter)
  - **Persistence**: Spring Data JPA + Hibernate ORM
  - **Database & Schema**: PostgreSQL 16 with Flyway versioned migrations (`V1` to `V5`)
- **Lightweight Dev Backend (`server.js`)**:
  - Node.js REST API mock server running on port `8080` for instant local testing without Maven/PostgreSQL dependencies.

---

## 🏗️ System Architecture

```mermaid
graph TD
    Client[React 18 + Vite Frontend (Port 5173)] -->|Bearer JWT + REST API| Gateway[Spring Boot Controller / Node Backend (Port 8080)]
    Gateway --> Security[JwtAuthenticationFilter & SecurityConfig]
    Security --> Service[BankService (Atomic Transactional Logic)]
    Service --> Repos[Spring Data JPA Repositories]
    Repos --> DB[(PostgreSQL Database)]
```

---

## 🔑 User Accounts & Default Credentials

### Administrator Credentials

| Role | Username / Email | Password | Access Rights |
| :--- | :--- | :--- | :--- |
| **Administrator** | `admin` | `admin123` | Full access: customer CRUD onboarding, account freezing/unfreezing, deposit maker-checker approvals, and bank stats. |

---

### Pre-Configured Customer Accounts

| Customer Name | Login Email | Password | Account Number(s) | Account Type | Initial Balance | PAN Number | KYC Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Khushi Sharma** | `Khushi@example.com` | `customer123` | `AC1002003001`<br>`AC1002003003` | SAVINGS<br>SALARY | ₹1,75,000<br>₹84,999 | `ABCDE1234F` | `VERIFIED` |
| **Priya Patel** | `priya@example.com` | `customer123` | `AC1002003002` | SAVINGS | ₹75,000 | `ABCDE5678F` | `VERIFIED` |
| **Adi** | `adi@example.com` | `customer123` | `ACWP16Z733TZ` | SAVINGS | ₹14,60,001 | `ABCDE1223A` | `PENDING` |

---

## ✨ Key Features & Workflows

### Customer Banking Portal (`/customer`)
- 📊 **Account Portfolio Dashboard**: Consolidated view of active balances, recent transactions, and quick action shortcuts.
- 💸 **Fund Transfers**:
  - **Self-Transfer**: Move funds instantly between accounts owned by the same customer.
  - **External Transfer**: Transfer funds to any external account number.
  - Real-time limit check, minimum balance verification, and balance validation.
- 🏛️ **Fixed Deposits (FD)**:
  - Open term deposits selecting tenure (3–60 months) and interest rate (up to 7.5% p.a.).
  - Maturity yield projections & premature closure penalty calculations.
- 💳 **Loans & EMI Amortization**:
  - Apply for Personal, Home, Car, or Education loans.
  - Built-in EMI calculator showing monthly EMI and total interest payable.
- 📥 **Cash Deposit Requests (Maker-Checker)**:
  - Submit cash deposit requests for branch/admin verification.

### Admin Operations Portal (`/admin`)
- 📈 **Executive KPI Dashboard**: Metrics on total bank deposits, customer directory size, loan portfolio volume, and pending approvals.
- 👤 **Customer Onboarding & Management**:
  - Register new customers with name, email, PAN, and initial password. Automatically creates login credentials.
  - View customer profile, update contact info, inspect linked accounts/loans.
- ⚙️ **Account Lifecycle Operations**:
  - Open new Savings, Current, or Salary accounts for customers.
  - Update account status (`ACTIVE`, `FROZEN`, `CLOSED`).
  - Direct branch deposit & withdrawal counters.
- 🔍 **Maker-Checker Approval Center**:
  - Audit and approve/reject pending cash deposit requests.

---

## 🧮 Business Formulas & Logic

### Loan Eligibility Rules
1. **Minimum Principal**: ₹10,000
2. **Interest Rate**: $> 0\%$ and $\le 50\%$ p.a.
3. **Tenure**: $1$ to $480$ months
4. **Max Active Loans**: Maximum 3 active loans per customer.
5. **Collateral/Balance Safeguard**: Customer's total balance across active accounts must be $\ge 10\%$ of requested principal.

### Reducing Balance Monthly EMI Formula
$$\text{EMI} = \frac{P \times r \times (1 + r)^n}{(1 + r)^n - 1}$$
*where $P = \text{Principal Amount}$, $r = \text{Monthly Interest Rate } (\frac{\text{Annual Rate}}{12 \times 100})$, and $n = \text{Tenure in Months}$.*

---

## 🚀 Installation & Setup Guide

### Option A: Local Dev Server Mode (Fastest Setup)

1. **Start the Mock API Backend (`server.js`)**:
   ```bash
   cd amc-backend
   node server.js
   ```
   *Runs on `http://localhost:8080`.*

2. **Start the React Frontend**:
   ```bash
   cd amc-frontend
   npm run dev
   ```
   *Runs on `http://localhost:5173`.*

---

### Option B: Production Backend Mode (Spring Boot + PostgreSQL)

1. **Database Setup**: Ensure PostgreSQL is running on `localhost:5432` with a database named `amc_bank` and user `postgres`.
2. **Start Spring Boot Application**:
   ```bash
   cd amc-backend
   mvn spring-boot:run
   ```
3. **Start React Frontend**:
   ```bash
   cd amc-frontend
   npm run dev
   ```

---

## 📡 REST API Documentation

| Method | Endpoint | Role Required | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/login` | Public | Authenticate user & return JWT token + role |
| `GET` | `/api/dashboard` | `ROLE_ADMIN` | Aggregated bank metrics and customer stats |
| `GET` | `/api/customers` | `ROLE_ADMIN` | Searchable & paginated customer directory |
| `POST` | `/api/customers` | `ROLE_ADMIN` | Create new customer & auto-provision login user |
| `GET` | `/api/customers/{id}` | `ROLE_ADMIN` | Fetch customer details by ID |
| `PUT` | `/api/customers/{id}` | `ROLE_ADMIN` | Update customer details (email/phone/address) |
| `DELETE` | `/api/customers/{id}` | `ROLE_ADMIN` | Delete customer (blocks if active accounts exist) |
| `GET` | `/api/customers/{id}/accounts` | `ROLE_ADMIN` | List all accounts belonging to customer |
| `POST` | `/api/customers/{id}/accounts` | `ROLE_ADMIN` | Open new bank account for customer |
| `PUT` | `/api/accounts/{id}/status` | `ROLE_ADMIN` | Update account status (`ACTIVE`, `FROZEN`, `CLOSED`) |
| `POST` | `/api/accounts/{id}/deposit` | `ROLE_ADMIN` | Admin direct cash deposit |
| `POST` | `/api/accounts/{id}/withdraw` | `ROLE_ADMIN` | Admin direct cash withdrawal |
| `POST` | `/api/deposit-requests/{id}/approve` | `ROLE_ADMIN` | Maker-Checker approval of pending deposit |
| `GET` | `/api/customer/accounts` | `ROLE_CUSTOMER` | Fetch active accounts of logged-in customer |
| `POST` | `/api/customer/transfer` | `ROLE_CUSTOMER` | Execute atomic fund transfer |
| `GET` | `/api/customer/transactions` | `ROLE_CUSTOMER` | Paginated transaction history |
| `POST` | `/api/customer/loans/apply` | `ROLE_CUSTOMER` | Submit loan application |
| `POST` | `/api/customer/fixed-deposits` | `ROLE_CUSTOMER` | Open term deposit |

---

## 🧪 Automated Testing

To run the frontend Vitest unit test suite:
```bash
cd amc-frontend
npm test
```
- **Test Files**: `TransferView.test.jsx`, `transfer_and_approvals.test.js`, `format.test.js`
- **Result**: **16 / 16 tests passing**.

---

## 🗄️ Database Migrations

Database schema versioning is managed via Flyway SQL scripts (`amc-backend/src/main/resources/db/migration/`):
- `V1__initial_schema.sql`: Core tables (`users`, `customers`, `accounts`, `transactions`, `loans`).
- `V2__seed_data.sql`: Seed data for initial admin and customer accounts.
- `V3__loan_installments_and_repayment.sql`: Loan EMI schedule tables.
- `V4__transfers_and_deposit_requests.sql`: Transfers and maker-checker deposit request schemas.
- `V5__rename_khushi.sql`: Customer record standardization migration.
