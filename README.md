# HelpDesk Pro — Support Ticket Management System

> A production-grade full-stack support ticket platform with role-based access, secure JWT authentication,
> HttpOnly cookie-based refresh tokens, Flyway-managed schema, soft deletion, and a modern React frontend.

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Roles & Permissions](#roles--permissions)
- [Quick Start (after implementation)](#quick-start-after-implementation)
- [Environment Variables](#environment-variables)
- [How to Create an Agent Account](#how-to-create-an-agent-account)
- [Authentication & Token Flow](#authentication--token-flow)
- [Project Structure](#project-structure)
- [API Overview](#api-overview)
- [Features](#features)
- [Architecture Decisions](#architecture-decisions)

---

## Overview

HelpDesk Pro allows **Users** to submit and track support tickets, while **Agents** manage, assign, prioritise, and resolve those tickets.

Key security properties:
- Public registration **always creates USER accounts** — the role field is ignored even if supplied.
- **No public agent registration endpoint** exists.
- Passwords hashed with **BCrypt** (strength 12).
- **Short-lived access JWTs** (15 min) stored only in React memory — never `localStorage`.
- **Refresh tokens** stored as HttpOnly Secure SameSite=Strict cookies — inaccessible to JavaScript.
- **Flyway** manages all schema migrations; `ddl-auto=validate` in production.
- Tickets and comments use **soft deletion** to preserve history.
- Internal agent comments are **invisible to USER roles** at the repository layer.
- All sensitive configuration via environment variables — no secrets in source code.

---

## Tech Stack

| Layer        | Technology & Version                                                        |
|--------------|-----------------------------------------------------------------------------|
| Backend      | Java 21 LTS, Spring Boot **3.3.4** (stable LTS-compatible release), Spring Security 6.3.x, Spring Data JPA, Hibernate 6.5.x, Maven |
| Auth         | JJWT **0.12.6** (HS512), BCrypt strength 12, HttpOnly refresh cookie        |
| Schema       | Flyway **10.x**, `ddl-auto=validate`                                        |
| Database     | MySQL **8.x**                                                               |
| Frontend     | React **18.3.x** + Vite **5.4.x**, JavaScript ES2022+, React Router **6.26.x**, Axios **1.7.x**, Tailwind CSS **3.4.x** |
| Testing      | JUnit 5, Mockito, MockMvc, H2 (test scope), Vitest, React Testing Library, MSW |

---

## Roles & Permissions

| Action                              | USER         | AGENT     |
|-------------------------------------|--------------|-----------|
| Register / Login                    | ✅            | ✅        |
| Create a ticket                     | ✅            | ❌        |
| View own tickets                    | ✅            | ❌        |
| View all tickets                    | ❌            | ✅        |
| Edit/soft-delete own ticket         | ✅ (OPEN only)| ❌        |
| Update ticket status / priority     | ❌            | ✅        |
| Assign ticket                       | ❌            | ✅        |
| Add public comment                  | ✅            | ✅        |
| Add internal comment                | ❌            | ✅        |
| View internal comments              | ❌            | ✅        |
| View ticket activity history        | ✅ (own)      | ✅ (all)  |
| Search & filter tickets             | ✅ (own only) | ✅ (all)  |
| View user dashboard                 | ✅            | ❌        |
| View agent dashboard                | ❌            | ✅        |

---

## Quick Start (after implementation)

### Prerequisites

- Java 21+, Maven 3.9+
- Node.js 22+, npm
- MySQL 8.x running locally (create the `helpdesk_db` database manually)

### Backend

```bash
cd backend

# 1. Copy the example env file and fill in your values
cp .env.example .env

# 2. Export environment variables (Spring Boot does NOT auto-load .env — see note below)
#    Linux/macOS:
export $(cat .env | xargs)
#    Windows PowerShell:
Get-Content .env | ForEach-Object { $k,$v = $_ -split '=',2; Set-Item "env:$k" $v }

# 3. Build and run (Flyway will apply migrations automatically on startup)
mvn clean install -DskipTests
mvn spring-boot:run

# Swagger UI available at:
# http://localhost:8080/swagger-ui.html
```

### Frontend

```bash
cd frontend
cp .env.example .env     # set VITE_API_BASE_URL=http://localhost:8080/api
npm install
npm run dev
# App available at http://localhost:5173
```

> **⚠️ Important**: Spring Boot does **not** automatically read a `.env` file.
> You must export the variables into your shell session, use your IDE's run configuration,
> or add the optional `spring-dotenv` library. See [PROJECT_PLAN.md → Section 10](./PROJECT_PLAN.md#10-configuration--secrets-guide) for full details.

---

## Environment Variables

### Backend

| Variable                    | Required | Description                                     |
|-----------------------------|----------|-------------------------------------------------|
| `DB_URL`                    | ✅        | JDBC URL for MySQL                              |
| `DB_USERNAME`               | ✅        | MySQL username                                  |
| `DB_PASSWORD`               | ✅        | MySQL password                                  |
| `JWT_SECRET`                | ✅        | ≥ 64 random Base64 bytes — run `openssl rand -base64 64` |
| `JWT_EXPIRATION_MS`         | ✅        | Access token lifetime ms — recommended `900000` (15 min) |
| `JWT_REFRESH_EXPIRATION_MS` | ✅        | Refresh token lifetime ms — recommended `604800000` (7 days) |
| `CORS_ALLOWED_ORIGINS`      | ✅        | Frontend origin, e.g. `http://localhost:5173`   |
| `SERVER_PORT`               | ❌        | Defaults to `8080`                              |
| `AGENT_BOOTSTRAP_SECRET`    | ❌        | Only needed when running the `seed` profile     |

### Frontend

| Variable            | Description                               |
|---------------------|-------------------------------------------|
| `VITE_API_BASE_URL` | Backend base URL, e.g. `http://localhost:8080/api` |

---

## How to Create an Agent Account

There is **no public endpoint** for agent registration — by design.

**Development / initial setup:**

```bash
# Run the seed profile to bootstrap a first agent account
AGENT_BOOTSTRAP_SECRET=my-secret \
AGENT_EMAIL=agent@helpdesk.com \
AGENT_PASSWORD=TempPass1! \
mvn spring-boot:run -Dspring-boot.run.profiles=seed
```

The `AgentSeedRunner` reads those env vars, verifies the secret, creates the agent, then exits.
It is **disabled in all other profiles** — it cannot fire in production.

**Production:**

Promote an existing user via a database command run by an authorised team member:

```sql
UPDATE users SET role = 'AGENT' WHERE email = 'agent@company.com';
```

Access to the production database must be controlled separately.

---

## Authentication & Token Flow

```
1. User logs in → POST /api/auth/login
   ← Access JWT (15 min) in JSON body  [stored in React memory]
   ← Refresh token in HttpOnly cookie  [browser manages; JS cannot read]

2. API request → Authorization: Bearer <access_token>

3. Access token expires (401) → Axios interceptor auto-calls POST /api/auth/refresh
   ← New access JWT in JSON body
   ← New refresh token cookie (old one revoked — rotation)
   → Original request retried transparently

4. Refresh token expired/revoked → redirect to /login

5. User logs out → POST /api/auth/logout
   ← Refresh token revoked in DB
   ← Cookie cleared (Max-Age=0)
   ← React AuthContext cleared
```

**Security properties:**
- Refresh token is never accessible to JavaScript (HttpOnly cookie).
- Access token is never written to `localStorage` or `sessionStorage`.
- If an attacker steals a refresh token and uses it, the rotation detects reuse and revokes all sessions.

---

## Project Structure

```
help desk-task/
├── README.md
├── PROJECT_PLAN.md
├── .gitignore
├── backend/
│   ├── pom.xml
│   ├── .env.example
│   └── src/main/
│       ├── java/com/helpdesk/
│       │   ├── config/        ← Security, CORS, beans
│       │   ├── controller/    ← REST endpoints
│       │   ├── dto/           ← Request + response DTOs
│       │   ├── entity/        ← JPA entities + enums
│       │   ├── exception/     ← Global handler + custom exceptions
│       │   ├── repository/    ← Spring Data JPA repos
│       │   ├── runner/        ← AgentSeedRunner (@Profile("seed"))
│       │   ├── security/      ← JWT, filters, UserDetailsService
│       │   └── service/       ← Business logic
│       └── resources/
│           ├── application.yml
│           └── db/migration/  ← Flyway V1–V5 SQL scripts
└── frontend/
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── api/           ← Axios instances + per-domain API modules
        ├── components/    ← Reusable UI components
        ├── context/       ← AuthContext (memory token only)
        ├── hooks/         ← Custom React hooks
        └── pages/         ← auth/, user/, agent/ page components
```

---

## API Overview

All endpoints are prefixed with `/api`. Interactive docs at `/swagger-ui.html` after startup.

| Group         | Base Path                        | Key Actions                              |
|---------------|----------------------------------|------------------------------------------|
| Auth          | `/api/auth`                      | register, login, refresh, logout, /me    |
| Tickets       | `/api/tickets`                   | CRUD, status, priority, assign, search   |
| Comments      | `/api/tickets/{id}/comments`     | add, list (role-filtered), edit, delete  |
| Agents        | `/api/agents`                    | list agents for assignment               |
| Dashboard     | `/api/dashboard`                 | role-specific stats                      |

See **[PROJECT_PLAN.md → Section 3](./PROJECT_PLAN.md#3-rest-api-endpoints--authorization)** for the full endpoint catalogue.

---

## Features

- **Secure Registration** — public endpoint always creates USER; no role accepted from client
- **Agent Bootstrap** — seed profile + env secret; no public agent endpoint
- **Short-lived JWT** — 15-minute access tokens; HS512 signed; ≥ 512-bit secret
- **HttpOnly Refresh Cookies** — refresh token invisible to JavaScript; rotated on every use
- **BCrypt** password hashing (strength 12)
- **Flyway Migrations** — mandatory; `ddl-auto=validate` in production
- **Soft Deletion** — tickets and comments preserve history; never hard-deleted
- **Internal Comments** — AGENT-only; filtered at repository layer; excluded from USER DTOs
- **Role-based Access Control** — `@PreAuthorize` + service-layer ownership/role checks
- **Ticket Lifecycle** — OPEN → IN_PROGRESS → RESOLVED → CLOSED (state machine in service)
- **Activity History** — append-only audit log for every state change
- **Search & Filter** — keyword + multi-dimension filters with pagination
- **Global Exception Handling** — `@RestControllerAdvice`; no stack traces in responses
- **Input Validation** — Jakarta Validation on all request DTOs

---

## Architecture Decisions

See **[PROJECT_PLAN.md → Section 7](./PROJECT_PLAN.md#7-architecture-decisions--trade-offs)**
for the full decision table with rationale and trade-offs for all 20 architectural choices.
