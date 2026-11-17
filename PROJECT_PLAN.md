# HelpDesk Pro — Detailed Implementation Plan & Architecture

> Status: **REVISED — AWAITING APPROVAL v2** — No application code has been written yet.
> Last revised: 2026-11-17 — incorporates mandatory architectural security review.

---

## Table of Contents

1. [Workspace Layout](#1-workspace-layout)
2. [Database Entities & Relationships](#2-database-entities--relationships)
3. [REST API Endpoints & Authorization](#3-rest-api-endpoints--authorization)
4. [Backend Folder Structure](#4-backend-folder-structure)
5. [Frontend Folder Structure](#5-frontend-folder-structure)
6. [Implementation Phases](#6-implementation-phases)
7. [Architecture Decisions & Trade-offs](#7-architecture-decisions--trade-offs)
8. [Testing Strategy](#8-testing-strategy)
9. [Security Checklist](#9-security-checklist)
10. [Configuration & Secrets Guide](#10-configuration--secrets-guide)
11. [Dependency Version Matrix](#11-dependency-version-matrix)

---

## 1. Workspace Layout

```
help desk-task/                   ← git root
├── README.md
├── PROJECT_PLAN.md
├── .gitignore                    ← .env files excluded
├── backend/                      ← Spring Boot Maven project
│   ├── pom.xml
│   ├── .env.example              ← template only — never commit .env
│   └── src/
│       ├── main/
│       │   ├── java/com/helpdesk/
│       │   └── resources/
│       │       ├── application.yml          ← env-var references only
│       │       └── db/migration/            ← Flyway versioned SQL scripts (MANDATORY)
│       │           ├── V1__create_users.sql
│       │           ├── V2__create_tickets.sql
│       │           ├── V3__create_comments.sql
│       │           └── V4__create_ticket_activities.sql
│       └── test/
│           ├── java/com/helpdesk/
│           └── resources/
│               └── application-test.yml    ← H2 in-memory, test JWT secret
└── frontend/                     ← React + Vite project
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    ├── postcss.config.js
    ├── .env.example
    └── src/
```

---

## 2. Database Entities & Relationships

### 2.1 Entity Map

```
users ──< tickets >── comments
  |           |
  |      ticket_activities
  |
  └──< user_roles (enum column, single-role design)
```

### 2.2 Entity Definitions

---

#### `users`

| Column        | Type                    | Constraints                              |
|---------------|-------------------------|------------------------------------------|
| id            | BIGINT UNSIGNED         | PK, AUTO_INCREMENT                       |
| username      | VARCHAR(50)             | UNIQUE, NOT NULL                         |
| email         | VARCHAR(100)            | UNIQUE, NOT NULL                         |
| password_hash | VARCHAR(255)            | NOT NULL (BCrypt, strength ≥ 12)         |
| full_name     | VARCHAR(100)            | NOT NULL                                 |
| role          | ENUM('USER','AGENT')    | NOT NULL, DEFAULT 'USER'                 |
| is_active     | BOOLEAN                 | NOT NULL, DEFAULT TRUE                   |
| created_at    | DATETIME                | NOT NULL, DEFAULT CURRENT_TIMESTAMP      |
| updated_at    | DATETIME                | NOT NULL, DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP |

> **Decision**: Public registration always produces `role = USER`. Role is never accepted from request bodies.
> The `role` column is set programmatically by `AuthService`; no DTO exposes it as a settable field.

---

#### `tickets`

| Column         | Type                                                     | Constraints                   |
|----------------|----------------------------------------------------------|-------------------------------|
| id             | BIGINT UNSIGNED                                          | PK, AUTO_INCREMENT            |
| title          | VARCHAR(200)                                             | NOT NULL                      |
| description    | TEXT                                                     | NOT NULL                      |
| status         | ENUM('OPEN','IN_PROGRESS','RESOLVED','CLOSED')           | NOT NULL, DEFAULT 'OPEN'      |
| priority       | ENUM('LOW','MEDIUM','HIGH','CRITICAL')                   | NOT NULL, DEFAULT 'MEDIUM'    |
| category       | ENUM('TECHNICAL','BILLING','GENERAL','FEATURE_REQUEST','BUG_REPORT') | NOT NULL |
| created_by_id  | BIGINT UNSIGNED FK                                       | → users.id, NOT NULL          |
| assigned_to_id | BIGINT UNSIGNED FK                                       | → users.id, NULLABLE          |
| is_deleted     | BOOLEAN                                                  | NOT NULL, DEFAULT FALSE       |
| deleted_at     | DATETIME                                                 | NULLABLE                      |
| created_at     | DATETIME                                                 | NOT NULL                      |
| updated_at     | DATETIME                                                 | NOT NULL                      |
| resolved_at    | DATETIME                                                 | NULLABLE                      |
| closed_at      | DATETIME                                                 | NULLABLE                      |

> **Soft Deletion**: `DELETE /tickets/{id}` sets `is_deleted = TRUE` and records `deleted_at`.
> All queries must include `WHERE is_deleted = FALSE`. History is preserved. Hard delete is never performed.
> Trade-off: Requires discipline in every query; mitigated by a Hibernate `@Where` annotation or
> a Specification appended in `TicketRepository`.

---

#### `comments`

| Column      | Type        | Constraints                       |
|-------------|-------------|-----------------------------------|
| id          | BIGINT UNSIGNED | PK, AUTO_INCREMENT            |
| ticket_id   | BIGINT UNSIGNED FK | → tickets.id, NOT NULL, CASCADE |
| author_id   | BIGINT UNSIGNED FK | → users.id, NOT NULL          |
| body        | TEXT        | NOT NULL                          |
| is_internal | BOOLEAN     | NOT NULL, DEFAULT FALSE           |
| is_deleted  | BOOLEAN     | NOT NULL, DEFAULT FALSE           |
| deleted_at  | DATETIME    | NULLABLE                          |
| created_at  | DATETIME    | NOT NULL                          |
| updated_at  | DATETIME    | NOT NULL                          |

> **Internal Comment Rules** (enforced in service + repository layer, never in controller alone):
> 1. `is_internal` may only be set `TRUE` by an authenticated AGENT.
> 2. `AuthService`/`CommentService` explicitly overrides `isInternal = false` when the caller is a USER — it is **not** silently coerced; it throws a `BadRequestException` so the client knows the field is invalid for their role.
> 3. `CommentRepository.findByTicketId(ticketId, callerRole)` uses a conditional `WHERE` clause:
>    - AGENT: no extra filter
>    - USER: `AND is_internal = FALSE`
> 4. The `is_internal` field is **never** present in the `CommentDto` returned to USERs.

---

#### `ticket_activities`

| Column      | Type         | Constraints                      |
|-------------|--------------|----------------------------------|
| id          | BIGINT UNSIGNED | PK, AUTO_INCREMENT             |
| ticket_id   | BIGINT UNSIGNED FK | → tickets.id, NOT NULL   |
| actor_id    | BIGINT UNSIGNED FK | → users.id, NOT NULL     |
| action_type | VARCHAR(50)  | NOT NULL                         |
| old_value   | VARCHAR(255) | NULLABLE                         |
| new_value   | VARCHAR(255) | NULLABLE                         |
| description | VARCHAR(500) | NOT NULL                         |
| created_at  | DATETIME     | NOT NULL                         |

> `ticket_activities` rows are **never soft-deleted or updated** — append-only immutable audit log.
> No `is_deleted` column here by design.

**action_type values**: `TICKET_CREATED`, `STATUS_CHANGED`, `PRIORITY_CHANGED`, `ASSIGNED`, `UNASSIGNED`,
`COMMENT_ADDED`, `CATEGORY_CHANGED`, `TICKET_DELETED` (soft-delete event)

---

#### `refresh_tokens`

| Column      | Type            | Constraints                            |
|-------------|-----------------|----------------------------------------|
| id          | BIGINT UNSIGNED | PK, AUTO_INCREMENT                     |
| user_id     | BIGINT UNSIGNED FK | → users.id, NOT NULL, CASCADE       |
| token_hash  | VARCHAR(255)    | UNIQUE, NOT NULL (SHA-256 of raw token)|
| expires_at  | DATETIME        | NOT NULL                               |
| revoked     | BOOLEAN         | NOT NULL, DEFAULT FALSE                |
| created_at  | DATETIME        | NOT NULL                               |

> Storing a **hash** of the refresh token ensures the raw token is not recoverable from the DB.
> On refresh: hash the incoming token, look up the row, verify not revoked/expired, issue new access token + rotate refresh token.

---

### 2.3 Flyway Migration Strategy

**Flyway is mandatory** — `ddl-auto` is set to `validate` in all non-test profiles.

```
db/migration/
├── V1__create_users.sql
├── V2__create_tickets.sql
├── V3__create_comments.sql
├── V4__create_ticket_activities.sql
└── V5__create_refresh_tokens.sql
```

- Files are **versioned and immutable** once merged. Never edit a committed migration file.
- For schema changes: add a new `V{n}__describe_change.sql`.
- Tests use `ddl-auto: create-drop` with H2 (Flyway disabled in test profile) so the ORM creates the schema from entities; this avoids MySQL-specific SQL syntax in test mode.

> **Trade-off**: Two schema sources of truth (Flyway for prod, Hibernate for tests). Mitigated by running
> integration tests against a real MySQL instance in CI to catch schema drift.

---

### 2.4 Entity Relationship Diagram

```
┌─────────────────────┐         ┌──────────────────────────────┐
│        users        │         │           tickets             │
│─────────────────────│         │──────────────────────────────│
│ id (PK)             │◄───────│ created_by_id (FK)            │
│ username            │         │ assigned_to_id (FK) ──►      │
│ email               │         │ id (PK)                       │
│ password_hash       │         │ title / description           │
│ full_name           │         │ status / priority / category  │
│ role                │         │ is_deleted / deleted_at       │
│ is_active           │         │ created_at / updated_at       │
│ created_at          │         │ resolved_at / closed_at       │
│ updated_at          │         └──────────────────────────────┘
└─────────────────────┘                      │ 1
         │ 1                                 │
         │                       ┌───────────┴────────────┐
         ▼ many                  │                        │
┌─────────────────────┐       many                      many
│   refresh_tokens    │          │                        │
│─────────────────────│ ┌────────▼──────────┐ ┌──────────▼─────────┐
│ id (PK)             │ │     comments      │ │  ticket_activities  │
│ user_id (FK)        │ │───────────────────│ │────────────────────│
│ token_hash          │ │ id (PK)           │ │ id (PK)            │
│ expires_at          │ │ ticket_id (FK)    │ │ ticket_id (FK)     │
│ revoked             │ │ author_id (FK)    │ │ actor_id (FK)      │
│ created_at          │ │ body              │ │ action_type        │
└─────────────────────┘ │ is_internal       │ │ old_value          │
                        │ is_deleted        │ │ new_value          │
                        │ created_at        │ │ description        │
                        └───────────────────┘ │ created_at         │
                                              └────────────────────┘
```

---

## 3. REST API Endpoints & Authorization

### 3.1 Conventions

- Base path: `/api`
- All protected routes require `Authorization: Bearer <access_token>`
- Consistent JSON response envelope:
  ```json
  { "success": true,  "data": { ... }, "message": "...", "timestamp": "2024-01-01T00:00:00Z" }
  { "success": false, "error": "RESOURCE_NOT_FOUND", "message": "...", "timestamp": "..." }
  ```
- Pagination query params: `page` (0-based), `size`, `sortBy`, `sortDir`
- HTTP status codes are always semantically correct (never 200 on error)

---

### 3.2 Auth Endpoints — `/api/auth`

| Method | Path        | Auth      | Description                                           |
|--------|-------------|-----------|-------------------------------------------------------|
| POST   | `/register` | ❌        | Register — always creates USER. Role field ignored.   |
| POST   | `/login`    | ❌        | Authenticate. Returns short-lived access JWT + sets `refresh_token` HttpOnly cookie. |
| POST   | `/refresh`  | Cookie    | Rotate refresh token, return new access JWT.          |
| POST   | `/logout`   | ✅ Bearer | Revoke refresh token server-side, clear cookie.       |
| GET    | `/me`       | ✅ Bearer | Return current user profile (no password hash).       |

#### Agent Bootstrap (Development / Ops Only)

There is **no public endpoint** for AGENT registration. The controlled mechanisms are:

1. **CLI seed script** (Phase 1): A Spring Boot `CommandLineRunner` active only when
   `spring.profiles.active=seed` reads `AGENT_BOOTSTRAP_SECRET` from the environment and creates
   the first agent account. Disabled in production profile.
2. **Direct database promotion** (production): An ops team member runs a migration or SQL command
   to `UPDATE users SET role='AGENT' WHERE email='...'` with appropriate access controls.
3. **Future**: An authenticated ADMIN role (out of scope for v1) can promote users.

> **Trade-off**: The seed runner slightly increases startup complexity. It is guarded by profile
> activation (`spring.profiles.active=seed`) and a required env var, so it cannot fire accidentally
> in production.

#### Token Behavior

| Token         | Storage            | Lifetime         | Delivery                        |
|---------------|--------------------|------------------|---------------------------------|
| Access JWT    | JavaScript memory (not persisted) | 15 minutes | `Authorization: Bearer` header |
| Refresh token | Server DB (hashed) + HttpOnly cookie | 7 days (configurable) | `Set-Cookie: refresh_token=...; HttpOnly; Secure; SameSite=Strict; Path=/api/auth` |

**Access token**: Short-lived. Stored in React component state / AuthContext memory only —
never `localStorage` or `sessionStorage`.

**Refresh token**: Raw value lives exclusively in an HttpOnly cookie.
JavaScript has zero access to it. On `/refresh`, the browser sends the cookie automatically.
Server looks up the hash in `refresh_tokens`, validates it, revokes the old row,
inserts a new one (rotation), and returns a new access JWT + a new cookie.

**Logout**: `POST /api/auth/logout` revokes the refresh token row in the DB and instructs the
browser to clear the cookie with `Set-Cookie: refresh_token=; Max-Age=0; HttpOnly; Secure`.

**On 401 (access token expired)**: Axios interceptor silently calls `/api/auth/refresh`.
If the refresh cookie is valid, a new access token is obtained and the original request retried
transparently. If the refresh also fails (cookie expired/revoked), the user is redirected to `/login`.

> **Trade-off vs. localStorage**: HttpOnly cookies cannot be read by JavaScript, eliminating the
> XSS-steals-refresh-token attack. The trade-off is that CSRF is a potential risk for the
> `/api/auth/refresh` endpoint, mitigated by `SameSite=Strict` (browsers won't send the cookie
> on cross-site requests). An additional double-submit CSRF token can be added in production hardening.

#### Login Response

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzUxMiJ9...",
    "tokenType": "Bearer",
    "expiresIn": 900000,
    "user": { "id": 1, "username": "john_doe", "email": "john@example.com", "role": "USER", "fullName": "John Doe" }
  }
}
```

Cookie set by server: `Set-Cookie: refresh_token=<raw>; HttpOnly; Secure; SameSite=Strict; Path=/api/auth; Max-Age=604800`

#### Register Request (always produces USER)

```json
{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "SecurePass1!",
  "fullName": "John Doe"
}
```

> The `role` field is **not** present in `RegisterRequest.java`. Even if a client sends it,
> Jackson will ignore unknown fields, and `AuthService` hard-codes `role = Role.USER`.

---

### 3.3 Ticket Endpoints — `/api/tickets`

| Method | Path                   | Auth | Allowed Roles     | Description                                      |
|--------|------------------------|------|-------------------|--------------------------------------------------|
| POST   | `/`                    | ✅   | USER              | Create ticket                                    |
| GET    | `/`                    | ✅   | USER → own only; AGENT → all | List/search tickets (paginated + filtered) |
| GET    | `/{id}`                | ✅   | USER(own), AGENT  | Get ticket detail                                |
| PUT    | `/{id}`                | ✅   | USER(own, OPEN only) | Edit title/description/category             |
| DELETE | `/{id}`                | ✅   | USER(own, OPEN only) | Soft-delete ticket                           |
| PATCH  | `/{id}/status`         | ✅   | AGENT             | Update status (state machine validated)          |
| PATCH  | `/{id}/priority`       | ✅   | AGENT             | Update priority                                  |
| PATCH  | `/{id}/assign`         | ✅   | AGENT             | Assign to an agent                               |
| PATCH  | `/{id}/unassign`       | ✅   | AGENT             | Remove assignment                                |
| GET    | `/{id}/activities`     | ✅   | USER(own), AGENT  | Ticket activity history                          |

**Filter Query Params (GET `/tickets`):**
`status`, `priority`, `category`, `assignedToMe` (AGENT only), `keyword`, `createdAfter`, `createdBefore`, `page`, `size`, `sortBy`, `sortDir`

**Soft-delete behaviour**: Soft-deleted tickets still appear in AGENT views with a `deleted` badge.
USERs cannot see their soft-deleted tickets. Activity log records `TICKET_DELETED` event.

---

### 3.4 Comment Endpoints — `/api/tickets/{ticketId}/comments`

| Method | Path    | Auth | Allowed Roles         | Description                              |
|--------|---------|------|-----------------------|------------------------------------------|
| POST   | `/`     | ✅   | USER(own ticket), AGENT | Add comment                            |
| GET    | `/`     | ✅   | USER(own), AGENT      | List comments (internal filtered by role)|
| PUT    | `/{id}` | ✅   | Author only           | Edit own comment (within 15 min window)  |
| DELETE | `/{id}` | ✅   | Author only           | Soft-delete own comment                  |

**Comment creation rules (enforced in `CommentService`, not controller alone):**

```
If caller.role == USER AND request.isInternal == true:
    throw BadRequestException("Internal comments are restricted to agents")

If caller.role == USER:
    comment.isInternal = false   // redundant safety assignment

Insert comment; write COMMENT_ADDED activity entry.
```

**Comment fetch rules (enforced in `CommentRepository`):**

```sql
-- For AGENTs:
SELECT * FROM comments WHERE ticket_id = ? AND is_deleted = FALSE

-- For USERs:
SELECT * FROM comments WHERE ticket_id = ? AND is_deleted = FALSE AND is_internal = FALSE
```

The `CommentDto` returned to USERs **does not include the `isInternal` field at all** (Jackson `@JsonIgnore` or separate DTO per role).

---

### 3.5 Agent Endpoints — `/api/agents`

| Method | Path | Auth | Role  | Description                              |
|--------|------|------|-------|------------------------------------------|
| GET    | `/`  | ✅   | AGENT | List all active agents (for assignment)  |

---

### 3.6 Dashboard Endpoints — `/api/dashboard`

| Method | Path      | Auth | Role  | Description                                   |
|--------|-----------|------|-------|-----------------------------------------------|
| GET    | `/user`   | ✅   | USER  | Stats: open/in-progress/resolved/closed counts |
| GET    | `/agent`  | ✅   | AGENT | Stats: total by status, by priority, assigned to me |

---

## 4. Backend Folder Structure

```
backend/
├── pom.xml
├── .env.example
└── src/
    ├── main/
    │   ├── java/com/helpdesk/
    │   │   ├── HelpDeskApplication.java
    │   │   │
    │   │   ├── config/
    │   │   │   ├── SecurityConfig.java           ← Filter chain, CORS, CSRF config
    │   │   │   ├── CorsConfig.java               ← Origin whitelist from env
    │   │   │   └── AppConfig.java                ← PasswordEncoder bean (BCrypt strength 12)
    │   │   │
    │   │   ├── security/
    │   │   │   ├── JwtTokenProvider.java         ← HS512, generate/validate/parse
    │   │   │   ├── JwtAuthenticationFilter.java  ← OncePerRequestFilter (access token only)
    │   │   │   ├── UserDetailsServiceImpl.java
    │   │   │   ├── SecurityUtils.java            ← getCurrentUser() helper
    │   │   │   └── RefreshTokenService.java      ← Issue, rotate, revoke refresh tokens
    │   │   │
    │   │   ├── entity/
    │   │   │   ├── User.java
    │   │   │   ├── Ticket.java                   ← @Where(clause="is_deleted=false")
    │   │   │   ├── Comment.java                  ← @Where(clause="is_deleted=false")
    │   │   │   ├── TicketActivity.java
    │   │   │   ├── RefreshToken.java
    │   │   │   └── enums/
    │   │   │       ├── Role.java
    │   │   │       ├── TicketStatus.java
    │   │   │       ├── TicketPriority.java
    │   │   │       └── TicketCategory.java
    │   │   │
    │   │   ├── repository/
    │   │   │   ├── UserRepository.java
    │   │   │   ├── TicketRepository.java
    │   │   │   ├── CommentRepository.java        ← role-aware query methods
    │   │   │   ├── TicketActivityRepository.java
    │   │   │   └── RefreshTokenRepository.java
    │   │   │
    │   │   ├── dto/
    │   │   │   ├── request/
    │   │   │   │   ├── RegisterRequest.java      ← NO role field
    │   │   │   │   ├── LoginRequest.java
    │   │   │   │   ├── RefreshTokenRequest.java  ← (unused; token comes from cookie)
    │   │   │   │   ├── CreateTicketRequest.java
    │   │   │   │   ├── UpdateTicketRequest.java
    │   │   │   │   ├── UpdateStatusRequest.java
    │   │   │   │   ├── UpdatePriorityRequest.java
    │   │   │   │   ├── AssignTicketRequest.java
    │   │   │   │   └── CreateCommentRequest.java
    │   │   │   └── response/
    │   │   │       ├── ApiResponse.java
    │   │   │       ├── AuthResponse.java
    │   │   │       ├── UserSummaryDto.java
    │   │   │       ├── TicketDto.java
    │   │   │       ├── TicketSummaryDto.java
    │   │   │       ├── CommentDto.java           ← isInternal omitted for USER role
    │   │   │       ├── AgentCommentDto.java      ← isInternal included for AGENT role
    │   │   │       ├── ActivityDto.java
    │   │   │       ├── PagedResponse.java
    │   │   │       ├── UserDashboardDto.java
    │   │   │       └── AgentDashboardDto.java
    │   │   │
    │   │   ├── service/
    │   │   │   ├── AuthService.java              ← register (role=USER hardcoded), login, logout
    │   │   │   ├── RefreshTokenService.java      ← rotate, revoke, validate
    │   │   │   ├── TicketService.java            ← CRUD, ownership, state machine, soft-delete
    │   │   │   ├── CommentService.java           ← isInternal enforcement, visibility
    │   │   │   ├── ActivityService.java
    │   │   │   ├── DashboardService.java
    │   │   │   └── UserService.java
    │   │   │
    │   │   ├── controller/
    │   │   │   ├── AuthController.java
    │   │   │   ├── TicketController.java
    │   │   │   ├── CommentController.java
    │   │   │   ├── AgentController.java
    │   │   │   └── DashboardController.java
    │   │   │
    │   │   ├── exception/
    │   │   │   ├── GlobalExceptionHandler.java
    │   │   │   ├── ResourceNotFoundException.java
    │   │   │   ├── AccessDeniedException.java
    │   │   │   ├── BadRequestException.java
    │   │   │   ├── TicketStateException.java
    │   │   │   └── DuplicateResourceException.java
    │   │   │
    │   │   └── runner/
    │   │       └── AgentSeedRunner.java          ← @Profile("seed") only, reads env secret
    │   │
    │   └── resources/
    │       ├── application.yml
    │       └── db/migration/
    │           ├── V1__create_users.sql
    │           ├── V2__create_tickets.sql
    │           ├── V3__create_comments.sql
    │           ├── V4__create_ticket_activities.sql
    │           └── V5__create_refresh_tokens.sql
    │
    └── test/
        ├── java/com/helpdesk/
        │   ├── controller/
        │   │   ├── AuthControllerTest.java
        │   │   ├── TicketControllerTest.java
        │   │   └── CommentControllerTest.java
        │   ├── service/
        │   │   ├── AuthServiceTest.java
        │   │   ├── TicketServiceTest.java
        │   │   ├── CommentServiceTest.java
        │   │   └── RefreshTokenServiceTest.java
        │   └── repository/
        │       ├── TicketRepositoryTest.java
        │       └── CommentRepositoryTest.java
        └── resources/
            └── application-test.yml
```

---

## 5. Frontend Folder Structure

```
frontend/
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── .env.example
└── src/
    ├── main.jsx
    ├── App.jsx
    │
    ├── api/
    │   ├── axiosInstance.js          ← Axios; attaches access token from memory; intercepts 401
    │   ├── authApi.js                ← login, logout, refresh (cookie handled by browser)
    │   ├── ticketsApi.js
    │   ├── commentsApi.js
    │   └── dashboardApi.js
    │
    ├── context/
    │   └── AuthContext.jsx           ← Stores { user, accessToken } in React state (memory only)
    │
    ├── hooks/
    │   ├── useAuth.js
    │   ├── useTickets.js
    │   └── usePagination.js
    │
    ├── components/
    │   ├── common/
    │   │   ├── Navbar.jsx
    │   │   ├── Sidebar.jsx
    │   │   ├── ProtectedRoute.jsx
    │   │   ├── RoleRoute.jsx
    │   │   ├── Spinner.jsx
    │   │   ├── Pagination.jsx
    │   │   ├── Badge.jsx
    │   │   ├── ErrorMessage.jsx
    │   │   └── ConfirmDialog.jsx
    │   │
    │   ├── tickets/
    │   │   ├── TicketCard.jsx
    │   │   ├── TicketList.jsx
    │   │   ├── TicketFilters.jsx
    │   │   ├── TicketForm.jsx
    │   │   ├── TicketStatusBadge.jsx
    │   │   └── TicketPriorityBadge.jsx
    │   │
    │   ├── comments/
    │   │   ├── CommentThread.jsx
    │   │   ├── CommentItem.jsx
    │   │   └── CommentForm.jsx
    │   │
    │   └── activity/
    │       └── ActivityTimeline.jsx
    │
    └── pages/
        ├── auth/
        │   ├── LoginPage.jsx
        │   └── RegisterPage.jsx
        ├── user/
        │   ├── UserDashboard.jsx
        │   ├── MyTicketsPage.jsx
        │   ├── CreateTicketPage.jsx
        │   └── TicketDetailPage.jsx
        └── agent/
            ├── AgentDashboard.jsx
            ├── AllTicketsPage.jsx
            └── TicketDetailPage.jsx
```

---

## 6. Implementation Phases

### Phase 1 — Project Scaffolding ✅ (in progress)
- [x] `pom.xml` with pinned dependency versions
- [x] `application.yml` with env-var references only
- [x] `application-test.yml` with H2 config
- [x] `.env.example` for backend
- [x] `.gitignore` with `.env` excluded
- [ ] Vite + React project init (`npm create vite@latest`)
- [ ] Frontend `.env.example`
- [ ] Flyway migration scripts V1–V5 (DDL only, no data)
- [ ] MySQL database `helpdesk_db` created manually

### Phase 2 — Backend Core: Auth & Security
- [ ] `User`, `RefreshToken` entities
- [ ] `JwtTokenProvider` (HS512, 15-min access, env-var secret)
- [ ] `JwtAuthenticationFilter`
- [ ] `SecurityConfig` (CORS, cookie config, public endpoints whitelist)
- [ ] `AuthService` — register (USER only), login, logout, /me
- [ ] `RefreshTokenService` — issue/rotate/revoke with hashed storage
- [ ] `AuthController` — cookie handling on login/refresh/logout
- [ ] `AgentSeedRunner` — `@Profile("seed")` guard
- [ ] DTO validation, `GlobalExceptionHandler`

### Phase 3 — Backend: Tickets
- [ ] `Ticket` entity with `@Where` soft-delete filter
- [ ] Flyway V2 migration
- [ ] `TicketRepository` — JPQL search + filter with `Pageable`
- [ ] `TicketService` — CRUD, ownership, state machine, soft-delete
- [ ] `ActivityService`
- [ ] `TicketController` with `@PreAuthorize`

### Phase 4 — Backend: Comments & Dashboard
- [ ] `Comment` entity with `@Where` soft-delete filter
- [ ] `CommentRepository` — role-aware query
- [ ] `CommentService` — `isInternal` enforcement
- [ ] `CommentController`
- [ ] `DashboardService` + `DashboardController`
- [ ] `AgentController`

### Phase 5 — Frontend: Auth & Routing
- [ ] `AuthContext` — in-memory access token only
- [ ] Axios interceptors — silent refresh on 401 via cookie
- [ ] `ProtectedRoute` + `RoleRoute`
- [ ] `LoginPage` + `RegisterPage`

### Phase 6 — Frontend: User Flow
- [ ] `UserDashboard`, `MyTicketsPage`, `CreateTicketPage`, `TicketDetailPage`

### Phase 7 — Frontend: Agent Flow
- [ ] `AgentDashboard`, `AllTicketsPage`, `TicketDetailPage`

### Phase 8 — Testing
- [ ] All test cases listed in Section 8

### Phase 9 — Polish & Documentation
- [ ] Springdoc OpenAPI/Swagger UI
- [ ] Postman collection
- [ ] Final README update

---

## 7. Architecture Decisions & Trade-offs

| # | Decision | Choice | Rationale | Trade-off |
|---|----------|--------|-----------|-----------|
| 1 | **Public registration role** | Always `USER`, hard-coded in service | Prevents privilege escalation via tampered requests | Ops must use seed runner or SQL to create first agent |
| 2 | **Agent bootstrap** | `@Profile("seed")` `CommandLineRunner` + env secret | No public endpoint exposed; production profile ignores the runner | Requires profile activation discipline; not self-service |
| 3 | **Access token lifetime** | 15 minutes | Limits window of token theft abuse | Requires silent refresh; adds complexity to Axios layer |
| 4 | **Refresh token storage** | HttpOnly Secure SameSite=Strict cookie + hashed DB row | Cookie inaccessible to JS (XSS-safe); hash in DB means raw token is non-recoverable | SameSite=Strict may break federated identity flows in future; refresh endpoint must handle CORS cookie correctly |
| 5 | **Access token storage (FE)** | React state / AuthContext memory | Never in localStorage/sessionStorage — no XSS persistence | Lost on page refresh; handled by calling `/refresh` on app mount (silent re-auth) |
| 6 | **Refresh token rotation** | Yes — single-use, rotated on every use | Detects token reuse attacks (stolen token invalidates the whole family) | Concurrency: parallel requests all calling `/refresh` simultaneously → mitigated by locking or a 5-second grace window |
| 7 | **JWT signing algorithm** | HS512 | Strong symmetric HMAC; suitable for single-service deployment | Key must be ≥ 512 bits (64 bytes); generated with `openssl rand -base64 64` |
| 8 | **JWT secret strength** | ≥ 64 random bytes (512 bits), env-var only | Prevents brute-force key guessing | Secret rotation requires reissuing all tokens (all users re-login); document rotation process |
| 9 | **BCrypt strength** | 12 rounds | Adequate work factor for 2024-era hardware (~300ms/hash) | Higher = slower login; consider Argon2id for new projects (Spring Security 6 supports it) |
| 10 | **Schema management** | Flyway mandatory; `ddl-auto=validate` | Repeatable, reviewable, auditable migrations; prevents accidental schema drift | Extra files to maintain; CI must run Flyway before tests against MySQL |
| 11 | **Test schema strategy** | H2 + `ddl-auto=create-drop` (Flyway disabled in test) | Fast, no MySQL dependency for unit/service tests | Schema drift between Flyway SQL and Hibernate model; mitigated by MySQL integration test suite in CI |
| 12 | **Soft deletion** | `is_deleted` + `deleted_at` on `tickets` and `comments` | Preserves history and audit log integrity | All queries must filter `is_deleted=FALSE`; handled by Hibernate `@Where` + repo default |
| 13 | **Activity log** | Append-only, no soft delete | Immutable audit trail; legal/compliance value | Storage grows unboundedly; archival strategy needed for large deployments |
| 14 | **Internal comments** | `is_internal` boolean; rejected (not silently coerced) for USERs | Clear API contract; client learns its mistake; server-enforced at service layer | Slightly more verbose than silent coercion; justified by security clarity |
| 15 | **Comment DTO per role** | Separate `CommentDto` / `AgentCommentDto` | `isInternal` never reaches USER response payload | Small duplication; acceptable for security boundary clarity |
| 16 | **Role model** | Single `role` ENUM column | Only two roles; no multi-role requirement | Not extensible to multi-role without schema change; acceptable for v1 scope |
| 17 | **Pagination** | Spring Data `Pageable` | Native integration, consistent API | None significant |
| 18 | **Search** | JPQL `LIKE` + JPA Specification | Adequate for MVP | Not full-text; can migrate to MySQL `FULLTEXT` index or Elasticsearch post-MVP |
| 19 | **CORS** | Explicit origin whitelist, `allowCredentials=true` | Required for cookie-based refresh token to work cross-origin | Cannot use wildcard `*` with credentials; origin must be exact |
| 20 | **Spring Boot does NOT auto-load `.env`** | Use OS env vars or `spring-dotenv` library | Prevents accidental secret loading; forces explicit setup | Developer must export vars or use an explicit dotenv loader; documented in Section 10 |

---

## 8. Testing Strategy

### 8.1 Backend Test Coverage

| Layer       | Framework                       | Scope                                            |
|-------------|---------------------------------|--------------------------------------------------|
| Unit        | JUnit 5 + Mockito               | Services, JWT generation/validation, role logic  |
| Integration | Spring Boot Test + MockMvc + H2 | Full HTTP cycle, security filters, DB state      |
| Repository  | `@DataJpaTest` + H2             | Custom JPQL, pagination, soft-delete filter      |

### 8.2 Mandatory Test Scenarios (new and updated)

#### Agent Registration Protection
- `POST /api/auth/register` with `"role":"AGENT"` in body → 201 with `role=USER` (field ignored)
- Attempting to hit any non-existent `/register/agent` public endpoint → 404
- `AgentSeedRunner` with wrong `AGENT_BOOTSTRAP_SECRET` → no user created, exception logged
- `AgentSeedRunner` with correct secret on `seed` profile → AGENT user created with hashed password

#### Internal Comment Visibility
- AGENT creates internal comment → 201
- USER requests comment list → internal comment absent from response
- USER attempts `isInternal: true` in comment body → 400 Bad Request
- `CommentRepository` query with `isAgent=false` returns only public comments (repository test)

#### Soft Deletion
- USER soft-deletes own OPEN ticket → `is_deleted=TRUE`, `TICKET_DELETED` activity written
- Soft-deleted ticket not returned in USER's `GET /tickets`
- Soft-deleted ticket visible to AGENT with `deleted=true` marker
- Attempt to comment on soft-deleted ticket → 404 (or 410 Gone)

#### Ticket Ownership
- USER accesses another user's ticket by ID → 403
- USER edits another user's ticket → 403
- AGENT accesses any ticket → 200

#### Role Permissions
- USER calls `PATCH /tickets/{id}/status` → 403
- USER calls `PATCH /tickets/{id}/assign` → 403
- AGENT calls `POST /tickets` → 403
- AGENT calls `GET /dashboard/user` → 403
- USER calls `GET /dashboard/agent` → 403

#### Refresh Token Behavior
- Valid refresh cookie → 200 with new access token + rotated cookie
- Expired refresh cookie → 401
- Revoked refresh token reuse → 401 + all sessions for user revoked (reuse detection)
- `POST /logout` → refresh token revoked, cookie cleared
- On app mount with valid cookie: silent `/refresh` succeeds, user stays logged in

### 8.3 Frontend

| Type        | Framework                          | Scope                                |
|-------------|------------------------------------|--------------------------------------|
| Unit        | Vitest + React Testing Library     | Form validation, badge rendering     |
| Integration | Vitest + MSW (Mock Service Worker) | Auth flows, 401 silent refresh, redirects |

---

## 9. Security Checklist

- [x] **Role assignment** — always `USER` on registration; never from request body
- [x] **Agent creation** — no public endpoint; seed runner guarded by profile + env secret
- [x] **Passwords** — BCrypt strength 12; never stored or logged in plain text
- [x] **JWT algorithm** — HS512; secret ≥ 512 bits; from env var only
- [x] **Access token lifetime** — 15 minutes
- [x] **Refresh token** — HttpOnly Secure SameSite=Strict cookie; hashed in DB; single-use rotation
- [x] **Token reuse detection** — reused refresh token revokes all sessions for that user
- [x] **Logout** — server-side revocation + cookie clearing
- [x] **Internal comments** — rejected (not silently coerced) for USERs; excluded from USER response DTOs
- [x] **Soft deletion** — history preserved; `is_deleted` filter on all queries
- [x] **CORS** — explicit origin whitelist; `allowCredentials=true`; no wildcard
- [x] **Input validation** — Jakarta Validation on all DTOs; `@Valid` on all controller methods
- [x] **SQL injection** — parameterised JPA/JPQL only; no string concatenation in queries
- [x] **Ownership checks** — service layer enforces `createdBy.id == currentUser.id`
- [x] **Role enforcement** — `@PreAuthorize` + service-layer double-check
- [x] **Error messages** — no stack traces, internal paths, or sensitive data in API responses
- [x] **Schema management** — Flyway mandatory; `ddl-auto=validate` in production profile
- [x] **Secrets** — `DB_PASSWORD`, `JWT_SECRET` in env only; `.env` in `.gitignore`; Spring Boot does not auto-load `.env` (see Section 10)
- [x] **HTTPS** — TLS terminated at reverse proxy (Nginx) in production
- [x] **Rate limiting** — Bucket4j or Spring Cloud Gateway on `/api/auth/**` (production hardening)

---

## 10. Configuration & Secrets Guide

### Critical: Spring Boot Does Not Auto-Load `.env` Files

> Spring Boot's `application.yml` can reference environment variables with `${VAR_NAME}` syntax,
> but **Spring Boot does not read a `.env` file automatically**. You must supply variables through
> one of these mechanisms:

#### Option A — Export in shell (recommended for local dev)

```bash
# Linux / macOS
export DB_URL="jdbc:mysql://localhost:3306/helpdesk_db?..."
export DB_USERNAME="root"
export DB_PASSWORD="yourpassword"
export JWT_SECRET="$(openssl rand -base64 64)"
export JWT_EXPIRATION_MS=900000
mvn spring-boot:run
```

```powershell
# Windows PowerShell
$env:DB_URL = "jdbc:mysql://localhost:3306/helpdesk_db?useSSL=false&serverTimezone=UTC"
$env:DB_USERNAME = "root"
$env:DB_PASSWORD = "yourpassword"
$env:JWT_SECRET = "REPLACE_WITH_64_BYTE_BASE64_SECRET"
$env:JWT_EXPIRATION_MS = "900000"
mvn spring-boot:run
```

#### Option B — `spring-dotenv` library (dev convenience)

Add to `pom.xml`:
```xml
<dependency>
    <groupId>me.paulschwarz</groupId>
    <artifactId>spring-dotenv</artifactId>
    <version>4.0.0</version>
</dependency>
```
Then create `backend/.env` (git-ignored) with `KEY=VALUE` pairs.
This library loads `.env` as a Spring `PropertySource` on startup.

> **Never** use `spring-dotenv` in production — use OS-level env vars, Kubernetes secrets, or a vault.

#### Option C — IDE run configuration (IntelliJ / VS Code)

Configure environment variables in the run/debug configuration for the Spring Boot application.

### Generating a Strong JWT Secret

```bash
# Generates a cryptographically secure 64-byte (512-bit) Base64 secret
openssl rand -base64 64
```

The output is a single line; paste it as the value of `JWT_SECRET`.

### Environment Variable Reference

| Variable                   | Required | Example / Notes                                         |
|----------------------------|----------|---------------------------------------------------------|
| `DB_URL`                   | ✅        | `jdbc:mysql://localhost:3306/helpdesk_db?useSSL=false&serverTimezone=UTC&allowPublicKeyRetrieval=true` |
| `DB_USERNAME`              | ✅        | MySQL user                                              |
| `DB_PASSWORD`              | ✅        | MySQL password                                          |
| `JWT_SECRET`               | ✅        | ≥ 64 random Base64 bytes (`openssl rand -base64 64`)   |
| `JWT_EXPIRATION_MS`        | ✅        | `900000` (15 min access token)                          |
| `JWT_REFRESH_EXPIRATION_MS`| ✅        | `604800000` (7 days refresh token)                      |
| `SERVER_PORT`              | ❌        | Default `8080`                                          |
| `CORS_ALLOWED_ORIGINS`     | ✅        | `http://localhost:5173` (dev); production frontend URL  |
| `AGENT_BOOTSTRAP_SECRET`   | ❌        | Required only when running `--spring.profiles.active=seed` |

---

## 11. Dependency Version Matrix

> All versions pinned. Spring Boot parent manages transitive versions where possible.

### Backend

| Dependency                        | Version     | Notes                                      |
|-----------------------------------|-------------|--------------------------------------------|
| Java                              | **21** (LTS)| Spring Boot 3.3.x requires Java 17+        |
| Spring Boot                       | **3.3.4**   | Latest 3.3.x; stable; Java 21 compatible   |
| Spring Security                   | **6.3.x**   | Managed by Boot parent                     |
| Spring Data JPA / Hibernate       | **6.5.x**   | Managed by Boot parent                     |
| MySQL Connector/J                 | **8.3.0**   | Managed by Boot parent                     |
| JJWT API                          | **0.12.6**  | Latest stable; HS512 support               |
| JJWT Impl                         | **0.12.6**  | Runtime                                    |
| JJWT Jackson                      | **0.12.6**  | Runtime                                    |
| Lombok                            | **1.18.34** | Managed by Boot parent                     |
| Springdoc OpenAPI WebMVC UI       | **2.6.0**   | Compatible with Spring Boot 3.3.x          |
| Flyway Core                       | **10.x**    | Managed by Boot parent (`spring-boot-starter-data-jpa` includes it) |
| Flyway MySQL                      | **10.x**    | Add `flyway-mysql` artifact explicitly     |
| H2 Database                       | **2.x**     | Test scope; managed by Boot parent         |
| Spring Security Test              | **6.3.x**   | Test scope; managed by Boot parent         |
| spring-dotenv (optional dev)      | **4.0.0**   | For `.env` file loading in development     |

### Frontend

| Dependency              | Version     | Notes                             |
|-------------------------|-------------|-----------------------------------|
| Node.js                 | **22.x** LTS| Confirmed available in environment |
| React                   | **18.3.x**  |                                   |
| React DOM               | **18.3.x**  |                                   |
| React Router DOM        | **6.26.x**  | Latest v6 stable                  |
| Vite                    | **5.4.x**   | Latest stable                     |
| Axios                   | **1.7.x**   | Latest stable                     |
| Tailwind CSS            | **3.4.x**   | v3 stable; v4 alpha not yet stable|
| PostCSS                 | **8.4.x**   | Tailwind dependency               |
| Autoprefixer            | **10.4.x**  | Tailwind dependency               |
| Vitest                  | **2.x**     | Test runner                       |
| @testing-library/react  | **16.x**    | Component testing                 |
| @testing-library/jest-dom | **6.x**  | DOM matchers                      |
| msw                     | **2.x**     | Mock Service Worker for API mocks |
