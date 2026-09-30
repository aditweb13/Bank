# 🏦 AMC Bank – Enterprise Digital Banking Platform

![Java](https://img.shields.io/badge/Java-17-orange.svg)
![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.3.4-brightgreen.svg)
![Spring Security](https://img.shields.io/badge/Spring%20Security-JWT-red.svg)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue.svg)
![React](https://img.shields.io/badge/React-18-cyan.svg)
![Vite](https://img.shields.io/badge/Vite-5-purple.svg)
![Vitest](https://img.shields.io/badge/Testing-Vitest-yellow.svg)

**AMC Bank** is a full-featured, enterprise-grade BFSI (Banking, Financial Services, and Insurance) web platform built with **Java 17**, **Spring Boot 3.3.4**, **Spring Security + JWT**, **Spring Data JPA**, **Flyway**, **PostgreSQL**, and a modern **React 18 + Vite** frontend.

---

## 🏗️ System Architecture

```mermaid
graph TD
    Client[React + Vite Frontend (Port 5173)] -->|Bearer JWT + REST| Gateway[Spring Boot Controller / Node Server (Port 8080)]
    Gateway --> Security[JwtAuthenticationFilter & SecurityConfig]
    Security --> Service[BankService (Atomic Transactional Logic)]
    Service --> Repos[Spring Data JPA Repositories]
    Repos --> DB[(PostgreSQL Database)]
```

---

## ✨ Key Features

### 1. Modern Fintech User Interface
- **Responsive Layout**: Designed for seamless banking on mobile devices (360px+) up to ultra-wide desktop monitors.
- **Glassmorphic Design**: Sleek dark-mode aesthetic with fluid transitions, dynamic loaders, status indicators, and modal dialogs.
- **Accessibility & Masking**: Sensitive account number show/hide toggles, Indian Rupee formatting (`₹`), and clear visual hierarchy.

### 2. Dual Role Banking Portals
- 👤 **Customer Banking Portal (`/customer`)**:
  - Portfolio Dashboard with multi-account balances.
  - **Fund Transfers**: Atomic self-transfers between personal accounts and external payee transfers.
  - **Fixed Deposits**: Open term deposits with maturity calculations and premature closure penalty calculations.
  - **Loans & EMI Calculator**: Automated eligibility evaluation, reducing-balance EMI schedules, and status tracking.
  - **Maker-Checker Deposit Requests**: Submit cash deposit requests for branch/admin verification.
- 🛡️ **Admin Operations Portal (`/admin`)**:
  - Executive KPI dashboard showing total deposits, customer count, loan portfolio, and volume statistics.
  - Customer CRUD onboarding with automated login credential creation.
  - Account lifecycle management (open account, toggle status `ACTIVE`, `FROZEN`, `CLOSED`).
  - Maker-Checker approval center for pending cash deposits.

### 3. Banking Business Logic & Controls
- **Atomic Dual-Ledger Accounting**: Dual-ledger transaction accounting with balance checks.
- **Limit Enforcement**: Account-level daily transfer limits (e.g. ₹1,00,000 for Savings).
- **Loan Underwriting Safeguards**:
  - Minimum loan principal: ₹10,000.
  - Interest rate: $> 0\%$ and $\le 50\%$ p.a.
  - Tenure: $1$ to $480$ months.
  - Maximum active loans per customer: 3.
  - Balance requirement: Customer active accounts must hold at least **10% of the requested principal**.

---

## 🔑 Default Demo Credentials

| Role | Username / Email | Password | Access Rights |
| :--- | :--- | :--- | :--- |
| **Administrator** | `admin` | `admin123` | Full admin rights, customer CRUD, account freeze, deposit approvals |
| **Customer (Khushi Sharma)** | `Khushi@example.com` | `customer123` | Personal accounts (`AC1002003001`, `AC1002003003`), fund transfer, FDs, loans |
| **Customer (Priya Patel)** | `priya@example.com` | `customer123` | Personal account (`AC1002003002`), fund transfer, FDs, loans |

---

## 🚀 How to Run locally

### Option 1: Fast Local Dev Mode (Node Mock Server + Vite Frontend)

1. **Start the Backend Server**:
   ```bash
   cd amc-backend
   node server.js
   ```
   *Runs REST API on `http://localhost:8080`.*

2. **Start the Frontend UI**:
   ```bash
   cd amc-frontend
   npm run dev
   ```
   *Runs Vite UI on `http://localhost:5173`.*

---

### Option 2: Production Stack (Spring Boot + PostgreSQL)

1. **Database Setup**: Ensure PostgreSQL is running on `localhost:5432` with database `amc_bank`.
2. **Start Spring Boot Backend**:
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

## 📡 REST API Reference

| Method | Endpoint | Role Required | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/login` | Public | Authenticate user & return JWT token + role |
| `GET` | `/api/dashboard` | `ROLE_ADMIN` | Aggregated bank metrics and customer count |
| `GET` | `/api/customers` | `ROLE_ADMIN` | List and search all bank customers |
| `POST` | `/api/customers` | `ROLE_ADMIN` | Create customer & auto-provision login user |
| `PUT` | `/api/customers/{id}` | `ROLE_ADMIN` | Update customer contact & KYC profile |
| `DELETE` | `/api/customers/{id}` | `ROLE_ADMIN` | Delete customer (if no open accounts/loans exist) |
| `PUT` | `/api/accounts/{id}/status` | `ROLE_ADMIN` | Update account status (`ACTIVE`, `FROZEN`, `CLOSED`) |
| `POST` | `/api/deposit-requests/{id}/approve` | `ROLE_ADMIN` | Maker-Checker approval of pending deposit |
| `GET` | `/api/customer/accounts` | `ROLE_CUSTOMER` | Fetch authenticated customer accounts |
| `POST` | `/api/customer/transfer` | `ROLE_CUSTOMER` | Execute fund transfer |
| `GET` | `/api/customer/transactions` | `ROLE_CUSTOMER` | Paginated transaction history |
| `POST` | `/api/customer/loans/apply` | `ROLE_CUSTOMER` | Apply for personal, home, or auto loan |
| `POST` | `/api/customer/fixed-deposits` | `ROLE_CUSTOMER` | Open term deposit |

---

## 🧪 Automated Testing

Run unit tests for the frontend:
```bash
cd amc-frontend
npm test
```
All unit tests (`TransferView.test.jsx`, `transfer_and_approvals.test.js`, `format.test.js`) are configured to execute cleanly.

---

## 📂 Documentation & Guides
For complete account details, system workflows, and architectural breakdown, refer to [`USER.md`](file:///c:/Users/WIN11/Downloads/bfsi_project/USER.md).
