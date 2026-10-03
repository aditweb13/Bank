# Phase 0 – Cleanup and Foundation: Task Tracker

**Goal:** Turn the current project into a clean, reproducible, CI-protected codebase, so Phase 1 (ledger) starts on solid ground.
**Duration:** Week 1 (about 5–7 working days)
**Owner:** _your name_
**Start date:** ____-__-__  **Target end date:** ____-__-__

---

## How to use this file

- Tick a box `[x]` when the task is done **and** its acceptance check passes.
- Status legend: `⬜ Todo` · `🟦 In progress` · `✅ Done` · `⛔ Blocked`
- Update the **Progress Summary** and **Daily Log** at the end of each session.
- Work in the order of the sections; later sections depend on earlier ones.
- Commit this file with your code so history shows real progress.

---

## Progress Summary

| # | Section | Tasks | Done | Status |
|---|---------|-------|------|--------|
| 1 | Repository hygiene | 9 | 8 | 🟦 |
| 2 | Project rename and branding | 6 | 0 | ⬜ |
| 3 | Configuration unification | 8 | 0 | ⬜ |
| 4 | Secrets and environment handling | 9 | 0 | ⬜ |
| 5 | Data consistency fixes | 8 | 0 | ⬜ |
| 6 | Dev mock backend (`server.js`) decision | 5 | 0 | ⬜ |
| 7 | Test baseline and Testcontainers | 8 | 0 | ⬜ |
| 8 | CI pipeline (GitHub Actions) | 8 | 0 | ⬜ |
| 9 | Dockerization and one-command startup | 7 | 0 | ⬜ |
| 10 | Documentation consolidation | 7 | 0 | ⬜ |
| 11 | Phase sign-off | 5 | 0 | ⬜ |
| | **Total** | **80** | **8** | |

---

## Definition of Done (Phase 0 exit criteria)

All must be true before starting Phase 1:

- [ ] A fresh `git clone` runs the whole stack (Postgres + backend + frontend) with **one command** and no manual DB creation.
- [ ] CI runs build, tests, and lint on every pull request, and `main` is protected.
- [ ] No secret, password, or default JWT key is hard-coded in any committed file (except clearly labeled local-dev seed data).
- [ ] The app **refuses to start** if `JWT_SECRET` is missing or too short.
- [ ] One database name, one config source, one set of run instructions everywhere.
- [ ] Emails are stored lowercase and unique case-insensitively.
- [ ] Backend integration tests run against a real PostgreSQL (Testcontainers), not H2 or mocks.
- [ ] README and docs match what the code really does.

---

## Section 1 – Repository hygiene

**Files:** repo root, `.gitignore`, `.gitattributes`

- [x] **1.1** Create a full backup: zip the current project and copy it somewhere outside the repo.
- [x] **1.2** Run `git status` and confirm everything is committed. Tag the current state `v0.1.0-baseline`.
- [x] **1.3** Rename the uploaded `_gitignore` to `.gitignore` (the leading underscore means Git is currently **not** using it).
- [x] **1.4** Make sure `.gitignore` covers: `node_modules/`, `target/`, `dist/`, `.env`, `.env.*` (but keep `.env.example`), `*.log`, `.idea/`, `.vscode/` (optional), `.classpath`, `.project`, `.settings/`, `pgdata/`.
- [x] **1.5** Search git history for committed secrets: `git log -p | grep -iE "password|secret|jwt"`. List anything found (rotate it in Section 4).
- [x] **1.6** Remove already-tracked junk: `git rm -r --cached node_modules target dist` if present.
- [x] **1.7** Add `.gitattributes` (`* text=auto eol=lf`) so Windows/Eclipse/VS Code stop causing line-ending diffs.
- [x] **1.8** Add `.editorconfig` (UTF-8, LF, 2 spaces for JS/YAML, 4 for Java).
- [ ] **1.9** Delete `RUN_THIS_VERSION_FIRST.txt` after its content is merged into the README (Section 10).

**Acceptance:** `git status` is clean after a build; `git ls-files | grep -E "node_modules|target/"` returns nothing.

---

## Section 2 – Project rename and branding

**Why:** "AMC Bank" implies you are a licensed bank. Pick a neutral product name before it spreads further.

- [ ] **2.1** Choose a working product name (e.g. `PayLedger`, `SettleKit`; check domain and trademark availability roughly).
- [ ] **2.2** Rename folders only if cheap (`amc-backend` → `backend`, `amc-frontend` → `frontend`); update `docker-compose.yml` paths accordingly.
- [ ] **2.3** Change Java package root and Maven `groupId/artifactId` (use IDE refactor, not find/replace).
- [ ] **2.4** Update UI strings, page titles, logo/favicon text, and email templates.
- [ ] **2.5** Rename Docker containers, volumes, and DB name (see Section 3 for the DB name decision).
- [ ] **2.6** Update README title and badges.

**Acceptance:** `grep -ri "amc" --include=*.java --include=*.jsx --include=*.yml --include=*.md .` returns only intentional references (e.g. the changelog).

---

## Section 3 – Configuration unification

**Current inconsistencies found:** README says database `amc_bank`; Docker and `RUN_THIS_VERSION_FIRST.txt` say `amc_bank_customer_login`; README uses `mvn`, USER.md uses `mvnw`.

- [ ] **3.1** Decide the single DB name (suggest: `<product>_db`), single DB user, and port. Write them in an ADR or `docs/config.md`.
- [ ] **3.2** Replace `application.properties` with `application.yml` plus profiles: `application-local.yml`, `application-test.yml`, `application-prod.yml`.
- [ ] **3.3** All environment-specific values come from environment variables with **no insecure defaults** for secrets: `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, `JWT_SECRET`, `CORS_ALLOWED_ORIGINS`.
- [ ] **3.4** Frontend: API base URL from `VITE_API_BASE_URL`, with `.env.example` documented.
- [ ] **3.5** CORS origin list comes from config, not hard-coded (`CORS_ALLOWED_ORIGINS`, comma separated).
- [ ] **3.6** Set `spring.jpa.hibernate.ddl-auto=validate` (Flyway owns the schema, Hibernate must never alter it).
- [ ] **3.7** Set `spring.flyway.enabled=true`, `baseline-on-migrate=false`, and fail startup on migration errors.
- [ ] **3.8** Standardize on the Maven wrapper (`./mvnw`) everywhere in docs and CI; commit the `.mvn/` folder.

**Acceptance:** `grep -r "amc_bank" .` shows one DB name only; switching profile changes behavior without code edits.

---

## Section 4 – Secrets and environment handling

**Problems found:** `docker-compose.yml` has default JWT secret and `postgres` password; seed credentials (`admin/admin123`, `customer123`) are documented publicly.

- [ ] **4.1** Create `.env.example` (committed) listing every variable with fake placeholder values and comments.
- [ ] **4.2** Create local `.env` (gitignored) with real local values; confirm `git check-ignore .env` prints `.env`.
- [ ] **4.3** Remove default values from `docker-compose.yml`: change `${JWT_SECRET:-...}` and `${DB_PASSWORD:-postgres}` to required variables (`${JWT_SECRET:?JWT_SECRET is required}`).
- [ ] **4.4** Generate a new JWT secret (`openssl rand -base64 64`); the old one in the repo is now considered **compromised**, so do not reuse it.
- [ ] **4.5** Add startup validation: app fails fast if `JWT_SECRET` is blank or shorter than 32 bytes (use `@Validated` config properties or a `@PostConstruct` check).
- [ ] **4.6** Move seed users out of production migrations: put `admin/admin123` and demo customers in a `local`/`dev`-only seed (Flyway location `db/seed-dev` enabled only in the `local` profile).
- [ ] **4.7** In `prod` profile, no default admin exists; add a documented one-time bootstrap (env vars `BOOTSTRAP_ADMIN_EMAIL` + `BOOTSTRAP_ADMIN_PASSWORD`, forced password change).
- [ ] **4.8** Add a secret scanner: `gitleaks` as a pre-commit hook and a CI step.
- [ ] **4.9** Update the database port exposure: don't publish Postgres `5432` to all interfaces outside local dev (bind to `127.0.0.1:5432:5432`).

**Acceptance:** `docker compose up` without `.env` fails with a clear message; gitleaks reports zero findings on the working tree.

---

## Section 5 – Data consistency fixes

**Files:** new Flyway migration (continue from your latest version, currently `V5`), `User`/`Customer` entities, auth service.

- [ ] **5.1** Normalize emails to lowercase in the service layer on **every write and every login lookup** (fixes `Khushi@example.com` vs `khushi@example.com`).
- [ ] **5.2** Write a migration to lowercase and trim existing emails; first run a query to detect would-be duplicates and resolve them manually.
- [ ] **5.3** Add unique index: `CREATE UNIQUE INDEX uq_users_email_lower ON users (lower(email));` (same for `customers` if separate).
- [ ] **5.4** Add DB constraints for PAN format (`^[A-Z]{5}[0-9]{4}[A-Z]$`) and a unique index on PAN.
- [ ] **5.5** Add `NOT NULL` and `CHECK` constraints where logic assumes them (status enums, non-negative balances for now).
- [ ] **5.6** Review `V5__rename_khushi.sql`: a rename should be data, not schema history. Leave it as is (never edit applied migrations) but add a note in `docs/migrations.md`, and don't create more name-specific migrations.
- [ ] **5.7** Fix demo data oddities: account `ACWP16Z733TZ` has a different format from `AC1002003001`; define one account-number generator and document it.
- [ ] **5.8** Add Bean Validation on all request DTOs (`@Email`, `@Pattern` for PAN, `@Size`, `@Positive`).

**Acceptance:** logging in with `KHUSHI@Example.com` and `khushi@example.com` hits the same user; inserting a duplicate email in different case fails.

---

## Section 6 – Dev mock backend (`server.js`) decision

**Why:** Two backends implementing the same API will drift apart. The Spring backend must be the single source of truth.

- [ ] **6.1** Decide: **delete** (recommended) or **keep as dev-only**. Record the choice in an ADR.
- [ ] **6.2** If keeping: move to `dev-tools/mock-server/`, add a banner in its README that says "not for production, may be outdated".
- [ ] **6.3** If deleting: remove file, remove it from README/USER.md "Option A", and make sure the frontend runs against Spring Boot only.
- [ ] **6.4** Replace the convenience it provided: a `docker compose up` that boots Postgres + backend in under 2 minutes (Section 9).
- [ ] **6.5** Search the frontend for any logic that only works with the mock behavior and fix it.

**Acceptance:** README has exactly one supported way to run the backend.

---

## Section 7 – Test baseline and Testcontainers

**Why:** Phase 1 needs real-Postgres tests for locking and constraints; H2 will hide bugs.

- [ ] **7.1** Run the current frontend suite (`npm test`) and record the baseline (README claims 16/16); fix any failing test first.
- [ ] **7.2** Run backend tests (`./mvnw test`); record how many exist. If few or none, note the gap.
- [ ] **7.3** Add dependencies: `org.testcontainers:postgresql`, `org.testcontainers:junit-jupiter`, `spring-boot-testcontainers`, AssertJ.
- [ ] **7.4** Create a shared `PostgresTestBase` (singleton container, `@ServiceConnection` or `@DynamicPropertySource`) so the container starts once per run.
- [ ] **7.5** Ensure Flyway migrations run in tests against the container (this validates every migration on every build).
- [ ] **7.6** Write smoke tests: context loads; login succeeds with a seeded user; unauthenticated call returns 401; customer calling an admin endpoint returns 403.
- [ ] **7.7** Write a test that fails if two migrations share the same version number or if `ddl-auto` is not `validate`.
- [ ] **7.8** Add basic backend coverage reporting (JaCoCo); no minimum yet, just visibility.

**Acceptance:** `./mvnw verify` passes on a laptop with only Docker installed; no H2 dependency remains.

---

## Section 8 – CI pipeline (GitHub Actions)

**Files:** `.github/workflows/ci.yml`, `.github/pull_request_template.md`, `.github/dependabot.yml`

- [ ] **8.1** Backend job: set up JDK 17, cache Maven, run `./mvnw verify` (Testcontainers works on GitHub-hosted runners).
- [ ] **8.2** Frontend job: Node 20, `npm ci`, `npm run lint`, `npm test -- --run`, `npm run build`.
- [ ] **8.3** Add a lint step: ESLint + Prettier check for the frontend; Checkstyle or Spotless for Java.
- [ ] **8.4** Add secret scanning job (`gitleaks`).
- [ ] **8.5** Add dependency checks: Dependabot for Maven, npm, and Docker; optionally OWASP Dependency-Check.
- [ ] **8.6** Add a Docker build job that builds both images (no push yet) to catch broken Dockerfiles.
- [ ] **8.7** Protect `main`: require PR, require passing CI, require 1 review (or self-review checklist if solo), disallow force push.
- [ ] **8.8** Add a PR template with checklist: tests added, migration included, no secrets, docs updated.

**Acceptance:** open a test PR that breaks a test; CI turns red and merge is blocked. Revert, CI turns green.

---

## Section 9 – Dockerization and one-command startup

**Files:** `docker-compose.yml`, `backend/Dockerfile`, `frontend/Dockerfile`, `Makefile` (optional)

- [ ] **9.1** Multi-stage backend Dockerfile (Maven build stage, slim JRE 17 runtime stage, non-root user).
- [ ] **9.2** Multi-stage frontend Dockerfile (Node build, nginx serve) with SPA fallback config (`try_files ... /index.html`).
- [ ] **9.3** Update `docker-compose.yml` with the unified DB name, required env vars (Section 4), healthchecks for backend, and `depends_on: condition: service_healthy`.
- [ ] **9.4** Remove the obsolete `version: '3.8'` line (Compose v2 ignores it).
- [ ] **9.5** Add Spring Boot Actuator `/actuator/health` (exposed only for health), used by the Docker healthcheck.
- [ ] **9.6** Add a `Makefile` or `scripts/` with `make up`, `make down`, `make reset-db`, `make test`.
- [ ] **9.7** Verify on a clean machine or fresh clone in a temp folder: `cp .env.example .env && docker compose up --build` leads to a working login page.

**Acceptance:** from a fresh clone, the stack is usable in under 5 minutes with one command after copying `.env`.

---

## Section 10 – Documentation consolidation

**Problem:** `README.md`, `USER.md`, and `RUN_THIS_VERSION_FIRST.txt` repeat and contradict each other.

- [ ] **10.1** Make `README.md` the single entry point: what it is, quick start (Docker), dev setup, tests, folder structure.
- [ ] **10.2** Move deep content to `docs/`: `architecture.md`, `api.md`, `business-rules.md`, `migrations.md`, `config.md`.
- [ ] **10.3** Merge `USER.md` into `docs/user-guide.md`; delete duplicated tables (credentials, formulas).
- [ ] **10.4** Document seeded demo users **only** under "local development", with a warning that they don't exist in production.
- [ ] **10.5** Remove claims that aren't verified (e.g. "16/16 tests passing" should be shown by a CI badge instead).
- [ ] **10.6** Add `CONTRIBUTING.md` (branching, commit style, how to add a migration, how to run tests).
- [ ] **10.7** Add `docs/adr/` with a template and your first ADRs from this phase (DB name, mock server, secrets policy).

**Acceptance:** a new developer can set up using only the README, with no contradictory instructions.

---

## Section 11 – Phase sign-off

- [ ] **11.1** Walk through the Definition of Done list at the top; tick each item with evidence (link, screenshot, or command output).
- [ ] **11.2** Do a **clean-room test**: clone into a new folder, follow only the README, and note any friction.
- [ ] **11.3** Run `gitleaks` and a dependency scan one last time; fix or document any findings.
- [ ] **11.4** Merge to `main`, tag `v0.1.1-phase0`, and write a short changelog entry.
- [ ] **11.5** Create the `feature/phase1-ledger` branch and copy `PHASE_1_LEDGER_TASKS.md` into `docs/`.

---

## Suggested daily schedule

| Day | Focus | Sections |
|-----|-------|----------|
| 1 | Backup, repo hygiene, rename decision | 1, 2 |
| 2 | Config unification, secrets | 3, 4 |
| 3 | Data consistency migration, mock server decision | 5, 6 |
| 4 | Testcontainers and baseline tests | 7 |
| 5 | CI pipeline and branch protection | 8 |
| 6 | Docker one-command startup | 9 |
| 7 | Docs consolidation, sign-off | 10, 11 |

---

## Risks and mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Rename breaks imports or paths | Build fails | Use IDE refactor, commit before and after, run tests immediately (2.3) |
| Lowercase-email migration hits duplicates | Migration fails | Pre-check query and manual merge (5.2) |
| Old secret already leaked via git history | Security exposure | Treat as compromised, rotate, never reuse (4.4); consider history rewrite only if repo was ever public |
| Moving seed data breaks demo | Lost convenience | Keep a `local` profile seed so `make up` still gives a working demo (4.6) |
| Testcontainers slow or Docker missing | Developer friction | Singleton container, document Docker requirement (7.4) |
| Spending more than a week here | Delays the ledger | Time-box; anything not on the Definition of Done goes to a backlog |

---

## Decision log

| Date | Decision | Reason | Link |
|------|----------|--------|------|
| 2026-10-03 | Rebrand product to ARBC Bank | User explicitly selected ARBC Bank as official brand name | User prompt |
| 2026-10-03 | Delete server.js mock server | Eliminate dual-backend divergence risk; Spring Boot is single source of truth | User prompt |
| 2026-10-03 | Standardize DB name to arbc_bank_db | Unified database naming across Compose, Spring Boot, and documentation | User prompt |

## Daily log

| Date | Done today | Blockers | Next |
|------|------------|----------|------|
| 2026-10-03 | Completed Discovery (Step 0) & Section 1 (Tasks 1.1-1.8) | None | Section 2 - Project rename and branding |
