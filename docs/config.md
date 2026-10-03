# ⚙️ ARBC Bank – Unified Configuration Architecture

This document defines the single source of truth for configuration across all environments (Local, Test, Production).

---

## 🗄️ Database Standard Specifications

| Parameter | Standard Value | Description |
| :--- | :--- | :--- |
| **Database Name** | `arbc_bank_db` | Single unified PostgreSQL database name across Docker, local dev, and prod. |
| **Database Username** | `postgres` | Standard database owner role. |
| **Database Port** | `5432` | Standard PostgreSQL port (bound to `127.0.0.1:5432` locally). |
| **Schema Owner** | Flyway | Hibernate DDL auto-generation is disabled (`ddl-auto: validate`). |

---

## 🔐 Environment Variables & Profile Strategy

### Required Environment Variables

| Variable Name | Required | Default (Local Only) | Description |
| :--- | :---: | :--- | :--- |
| `SPRING_DATASOURCE_URL` | Yes | `jdbc:postgresql://localhost:5432/arbc_bank_db` | PostgreSQL JDBC Connection URL |
| `SPRING_DATASOURCE_USERNAME` | Yes | `postgres` | Database Username |
| `SPRING_DATASOURCE_PASSWORD` | Yes | `postgres` | Database Password |
| `JWT_SECRET` | **Yes** | *No default in prod* | Base64/HMAC-SHA secret ($\ge 256$ bits) |
| `CORS_ALLOWED_ORIGINS` | Yes | `http://localhost:5173` | Comma-separated list of allowed CORS origins |
| `VITE_API_BASE_URL` | Yes | `/api` | Frontend API proxy endpoint or backend URL |

---

## 📦 Application Profiles

1. **`local` (`application-local.yml`)**:
   - Environment for local development.
   - Enables Flyway migrations with dev seed data.
   - Outputs formatted SQL logs.

2. **`test` (`application-test.yml`)**:
   - Profile used by JUnit / Vitest integration test suites.
   - Disables unnecessary external connections; runs Flyway against Testcontainers PostgreSQL.

3. **`prod` (`application-prod.yml`)**:
   - Strict production environment.
   - Requires explicit `JWT_SECRET` and `SPRING_DATASOURCE_PASSWORD`.
   - `ddl-auto: validate` enforced.
