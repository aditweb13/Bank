# AMC Bank – User Guide & System Architecture Documentation

Welcome to **AMC Bank Enterprise Digital Banking Platform**. This comprehensive guide details the application structure, technology stack, setup instructions, account login credentials, and end-to-end system workflows.

---

## 📑 Table of Contents
1. [Overview](#1-overview)
2. [Technology Stack](#2-technology-stack)
3. [How to Run the Application](#3-how-to-run-the-application)
4. [User Accounts & Login Credentials](#4-user-accounts--login-credentials)
5. [How the Application Works (Core Workflows)](#5-how-the-application-works-core-workflows)
   - [Authentication & Role Management](#authentication--role-management)
   - [Customer Banking Portal](#customer-banking-portal)
   - [Admin Operations Portal](#admin-operations-portal)
6. [Business Logic & Validation Rules](#6-business-logic--validation-rules)
7. [Testing & Verification](#7-testing--verification)

---

## 1. Overview

**AMC Bank** is a full-stack, enterprise-grade digital banking web application tailored for BFSI (Banking, Financial Services, and Insurance) operations. It features secure JWT-based authentication, strict role-based access control (`ROLE_ADMIN` vs `ROLE_CUSTOMER`), maker-checker approval workflows, fixed deposit lifecycle management, real-time fund transfers, and automated loan eligibility/EMI calculation.

---

## 2. Technology Stack

### Frontend Stack (`amc-frontend`)
- **Framework**: React 18 + Vite
- **Styling**: Vanilla CSS with customized design system (glassmorphic dark UI, micro-animations, fluid layouts)
- **Icons**: Lucide React (`lucide-react`)
- **HTTP Client**: Axios with centralized JWT Bearer interceptors
- **Testing**: Vitest + React Testing Library

### Backend Architecture (`amc-backend` & Node Dev Backend)
- **Primary Enterprise Backend (`amc-backend`)**:
  - **Language/SDK**: Java 17
  - **Framework**: Spring Boot 3.3.4
  - **Security**: Spring Security + JJWT 0.12.6 (Stateless JWT token filter)
  - **Data Access**: Spring Data JPA + Hibernate ORM
  - **Database**: PostgreSQL (with Flyway database migrations V1 to V5)
- **Development Mock Backend (`amc-backend/server.js`)**:
  - Node.js lightweight HTTP server serving identical REST API endpoints on port `8080` for rapid local frontend testing without requiring PostgreSQL/Maven.

---

## 3. How to Run the Application

### Option A: Running with Node Dev Server (Recommended for Fast Local Testing)

1. **Start the Backend (`server.js`)**:
   Open a terminal in `amc-backend/` and run:
   ```bash
   node server.js
   ```
   *The server will start on `http://localhost:8080`.*

2. **Start the Frontend (`amc-frontend`)**:
   Open a second terminal in `amc-frontend/` and run:
   ```bash
   npm run dev
   ```
   *The Vite frontend will start on `http://localhost:5173`.*

3. **Open in Browser**:
   Navigate to `http://localhost:5173` to access the application.

---

### Option B: Running with Spring Boot & PostgreSQL Backend

1. **Database Setup**: Ensure PostgreSQL is running on `localhost:5432` with a database named `amc_bank` and user `postgres`.
2. **Start Spring Boot**:
   ```bash
   cd amc-backend
   mvnw spring-boot:run
   ```
3. **Start Frontend**:
   ```bash
   cd amc-frontend
   npm run dev
   ```

---

## 4. User Accounts & Login Credentials

### Administrator Account

| Role | Username / Email | Password | Access Level |
| :--- | :--- | :--- | :--- |
| **Administrator** | `admin` | `admin123` | Full access to customer onboarding, account status toggling, loan approvals, deposit Maker-Checker requests, and system stats. |

---

### Customer Accounts

| Customer Name | Login Email | Password | Account Number(s) | Type | Initial Balance | PAN Number |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Khushi Sharma** | `Khushi@example.com` | `customer123` | `AC1002003001`<br>`AC1002003003` | SAVINGS<br>SALARY | ₹1,75,000<br>₹84,999 | `ABCDE1234F` |
| **Priya Patel** | `priya@example.com` | `customer123` | `AC1002003002` | SAVINGS | ₹75,000 | `ABCDE5678F` |
| **Adi** | `adi@example.com` | `customer123` | `ACWP16Z733TZ` | SAVINGS | ₹14,60,001 | `ABCDE1223A` |

---

## 5. How the Application Works (Core Workflows)

### Authentication & Role Management
- Users sign in via `/login`.
- Upon successful authentication, a signed **JWT Bearer token** is returned and stored in `localStorage` (`token`, `role`, `username`, `customerId`, `customerName`).
- Route guards dynamically direct admins to `/admin` and customers to `/customer`.

---

### Customer Banking Portal (`/customer`)

1. **Dashboard & Summary**:
   - Visual metrics showing total balance across all owned accounts.
   - Quick action bar for Transfers, Loans, Fixed Deposits, and Cash Deposit requests.

2. **Accounts & Fund Transfers**:
   - **Self Transfer**: Move money between two accounts owned by the customer instantly.
   - **External Transfer**: Send money to any active bank account number.
   - **Validation Checks**: Verifies sufficient funds, minimum balance compliance, active account status, and daily transfer limits.

3. **Fixed Deposits (FD)**:
   - Open a Fixed Deposit by selecting tenure (3 to 60 months) and interest rate (up to 7.5% p.a.).
   - Includes real-time maturity yield calculation.
   - Supports **Premature Closure** with automated 1% penalty recalculation on earned interest.

4. **Loans & EMI Management**:
   - Customers can apply for Personal, Home, Car, or Education loans.
   - Built-in loan calculator shows monthly EMI, total interest, and complete breakdown prior to submission.
   - Real-time loan tracking (Pending Approval, Active, Closed).

5. **Cash Deposit Requests (Maker-Checker)**:
   - Customers submit cash deposit requests specifying account number and amount.
   - Status remains `PENDING` until an Admin verifies and approves the request.

---

### Admin Operations Portal (`/admin`)

1. **Admin Dashboard**:
   - Overview of total customer base, total deposits, active loans, and pending deposit requests.

2. **Customer Onboarding & Management**:
   - **Add New Customer**: Onboards a customer with name, email, PAN number, and initial password. Automatically creates login credentials.
   - **View & Update Customer**: Inspect customer details, update email/phone/address, or view linked accounts and loans.

3. **Account Operations**:
   - Create new Savings/Salary/Current accounts for customers.
   - Toggle account statuses (`ACTIVE`, `FROZEN`, `CLOSED`).
   - Admin direct deposit/withdrawal for branch counters.

4. **Approval Center (Maker-Checker Engine)**:
   - Review pending cash deposit requests submitted by customers.
   - **Approve**: Credits customer account balance and records transaction.
   - **Reject**: Rejects request with audit reason.

---

## 6. Business Logic & Validation Rules

### Loan Eligibility Rules
- **Minimum Principal**: ₹10,000
- **Interest Rate**: $> 0\%$ and $\le 50\%$ p.a.
- **Tenure**: $1$ to $480$ months
- **Max Active Loans**: Maximum 3 active loans per customer
- **Collateral / Balance Requirement**: Customer's total balance across active accounts must be $\ge 10\%$ of requested principal.

### Equal Monthly Installment (EMI) Formula
$$\text{EMI} = \frac{P \times r \times (1 + r)^n}{(1 + r)^n - 1}$$
*where $P = \text{Principal}$, $r = \text{Monthly interest rate } (\frac{\text{annual rate}}{12 \times 100})$, and $n = \text{tenure in months}$.*

---

## 7. Testing & Verification

Run automated frontend tests using Vitest:
```bash
cd amc-frontend
npm test
```
All unit tests (`TransferView.test.jsx`, `transfer_and_approvals.test.js`, `format.test.js`) are configured to execute cleanly.
