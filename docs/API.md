# ZiroCredit API Reference

All endpoints return JSON responses. Inputs are validated on the server with Zod schemas.

---

### 1. Case Management

#### `GET /api/cases`
Returns a list of cases along with computed dashboard KPI metrics.
- **Query Params**: `status`, `classification`
- **Response**: `{ cases: CaseRecord[], metrics: DashboardMetrics }`

#### `POST /api/cases`
Creates a new case and normalized credit report record.
- **Request Body**:
  ```json
  {
    "clientName": "Alex Mercer",
    "accountReference": "ACC-9821-AUTO",
    "creditorName": "Apex Horizon Auto Finance",
    "accountType": "AUTO_LOAN",
    "reportedBalance": 24500,
    "paymentStatus": "CURRENT",
    "reportedDate": "2026-09-01",
    "userConfirmedFacts": "I have never applied for this loan.",
    "discrepancyReason": "Unauthorized account",
    "userFactConfirmed": true
  }
  ```

#### `GET /api/cases/[id]`
Returns complete case details including trade-line report, evidence chain, classifications, dispute drafts, approvals, bureau disputes, and outcome verification.

---

### 2. Analysis & Drafts

#### `POST /api/cases/[id]/analyze`
Triggers deterministic classification and AI narrative legal enrichment. Automatically generates dispute draft v1 if classified as `POTENTIAL_ERROR`.

#### `GET /api/cases/[id]/draft`
Retrieves the latest dispute draft for a case.

#### `PUT /api/cases/[id]/draft`
Updates draft content (disputed field, explanation, requested correction).
- **Behavior**: Increments draft version (`v1 -> v2`) and invalidates all existing approvals.

---

### 3. Human Approval & Submission

#### `POST /api/cases/[id]/approve`
Records an explicit human approval or rejection.
- **Request Body**:
  ```json
  {
    "draftVersion": 1,
    "action": "APPROVED",
    "reviewedBy": "Alex Mercer",
    "notes": "Reviewed and certified."
  }
  ```

#### `POST /api/cases/[id]/submit`
Submits an approved dispute to the Mock Credit Bureau Portal.
- **Server Validation**: Verifies active approval exists and draft version matches approved version. Enforces idempotency via `idempotencyKey`.

---

### 4. Bureau & Verification

#### `GET /api/cases/[id]/bureau-status`
Returns current dispute status from the Mock Bureau.

#### `POST /api/cases/[id]/bureau-status`
Allows simulating status updates (`UNDER_REVIEW`, `ADDITIONAL_INFORMATION_REQUIRED`, `RESOLVED`, `REJECTED`).

#### `POST /api/cases/[id]/verify`
Triggers independent outcome verification. Re-downloads the trade-line from the mock portal and compares against intended correction. Returns `VERIFIED_CORRECTION` or `NOT_CORRECTED`.

#### `POST /api/cases/[id]/upload-consent`
Records explicit consumer consent before uploading identification documents in TC4 scenarios.

---

### 5. Test Lab & Audit

#### `POST /api/test-lab/run`
Executes test scenario (`TC1`, `TC2`, `TC3`, `TC4`, or `ALL`).
- **Response**: `{ success: true, allPassed: boolean, results: TestScenarioResult[] }`

#### `GET /api/test-lab/results`
Returns past scenario execution runs.

#### `GET /api/audit`
Returns append-only audit stream.
- **Query Params**: `caseId`, `limit`

#### `POST /api/seed`
Resets and seeds the SQLite database with rich synthetic demonstration cases.
