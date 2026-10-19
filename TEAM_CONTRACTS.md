# TEAM_CONTRACTS.md: Shared Interfaces, Protocols & API Specifications

> **Status**: **FROZEN & AUTHORITATIVE**  
> **Applies to**: Developer 1 (AI Analysis), Developer 2 (UX & Approval), Developer 3 (Mock Bureau & Verification)  
> **Rule**: No developer may alter these interfaces without prior team review and technical lead approval.

---

## 1. Frozen Shared Types (`src/types/index.ts`)

All three workstreams import domain contracts directly from `@/types`:

### A. Workflow & Enums
```typescript
export type WorkflowStatus =
  | 'DRAFT'
  | 'ANALYZED'
  | 'AWAITING_APPROVAL'
  | 'APPROVED'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'ADDITIONAL_INFORMATION_REQUIRED'
  | 'RESOLVED'
  | 'REJECTED'
  | 'FAILED';

export type ClassificationType = 'POTENTIAL_ERROR' | 'ACCURATE_NEGATIVE' | 'UNCERTAIN';

export type AccountType =
  | 'MORTGAGE'
  | 'AUTO_LOAN'
  | 'CREDIT_CARD'
  | 'PERSONAL_LOAN'
  | 'STUDENT_LOAN'
  | 'REVOLVING'
  | 'COLLECTIONS';

export type PaymentStatus =
  | 'CURRENT'
  | 'LATE_30'
  | 'LATE_60'
  | 'LATE_90'
  | 'CHARGE_OFF'
  | 'COLLECTIONS';

export type EvidenceVerificationStatus = 'VERIFIED' | 'UNVERIFIED' | 'PENDING_REVIEW';

export type OutcomeVerificationStatus =
  | 'PENDING'
  | 'VERIFIED_CORRECTION'
  | 'NOT_CORRECTED'
  | 'INCONCLUSIVE';
```

### B. Core Data Models

#### 1. `CaseRecord`
```typescript
export interface CaseRecord {
  id: string; // e.g. "CASE-2026-001"
  clientName: string;
  accountReference: string; // e.g. "ACC-9821-AUTO"
  issueType: string;
  workflowStatus: WorkflowStatus;
  classification?: ClassificationType;
  confidenceScore?: number; // 0.00 to 1.00
  reportRecordId?: string;
  activeDraftId?: string;
  activeApprovalId?: string;
  activeDisputeId?: string;
  consentGivenForIdUpload?: boolean;
  notes?: string;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}
```

#### 2. `CreditReportRecord`
```typescript
export interface CreditReportRecord {
  id: string; // e.g. "REP-2026-001"
  caseId: string;
  accountReference: string;
  creditorName: string;
  accountType: AccountType;
  reportedBalance: number;
  paymentStatus: PaymentStatus;
  paymentHistory: string;
  openedDate?: string;
  reportedDate: string;
  delinquencyDate?: string;
  userConfirmedFacts: string; // Statutory factual declaration
  discrepancyReason: string;
  userFactConfirmed: boolean; // Mandated true for POTENTIAL_ERROR
  sourceReportRef: string;
  extractionTimestamp: string;
  extractedValues: Record<string, unknown>;
  attachedEvidenceNotes?: string;
}
```

#### 3. `EvidenceRecord` (`EvidenceItem`)
```typescript
export interface EvidenceItem {
  id: string; // e.g. "EVI-172935..."
  caseId: string;
  sourceName: string;
  mockSourceRecordId: string;
  retrievalTimestamp: string;
  relevantExtractedValues: Record<string, unknown>;
  sourceUrlOrRoute: string; // e.g. "mock://apex-bureau.local/v1/accounts/ACC-9821-AUTO"
  verificationStatus: EvidenceVerificationStatus;
  label: string;
  details?: string;
}
export type EvidenceRecord = EvidenceItem;
```

#### 4. `ClassificationRecord`
```typescript
export interface ClassificationRecord {
  id: string; // e.g. "CLS-172935..."
  caseId: string;
  classification: ClassificationType;
  reasoningSummary: string;
  supportingFacts: string[];
  contradictingFacts: string[];
  evidenceIds: string[];
  missingInformation: string[];
  recommendedNextStep: string;
  humanReviewRequired: boolean;
  confidenceScore: number;
  engineMode: 'DETERMINISTIC_RULES' | 'LLM_ASSISTED';
  createdAt: string;
}
```

#### 5. `DisputeDraftRecord`
```typescript
export interface DisputeDraftRecord {
  id: string; // e.g. "DRF-172935..."
  caseId: string;
  version: number; // Integer (1, 2, 3...)
  bureauAccountReference: string;
  disputedField: string;
  userConfirmedStatement: string;
  relevantSupportingEvidence: string;
  explanationOfDiscrepancy: string;
  requestedCorrection: string;
  evidenceReferences: string[];
  createdAt: string;
  updatedAt: string;
}
```

#### 6. `ApprovalRecord`
```typescript
export interface ApprovalRecord {
  id: string; // e.g. "APP-172935..."
  caseId: string;
  approvedDraftVersion: number; // Strictly bound to draft version
  approvalTimestamp: string;
  userAction: 'APPROVED' | 'REJECTED' | 'REQUEST_MORE_INFO';
  submissionEligibility: boolean;
  reviewedBy: string;
  notes?: string;
}
```

#### 7. `DisputeRecord` (`MockBureauDisputeRecord`)
```typescript
export interface MockBureauDisputeRecord {
  id: string; // e.g. "MOCK-DISP-10928"
  caseId: string;
  approvedDraftVersion: number;
  approvalId: string;
  mockPortalReference: string;
  idempotencyKey: string; // e.g. "IDEMP-CASE-V1"
  submissionTimestamp: string;
  submissionResponse: Record<string, unknown>;
  currentStatus: WorkflowStatus;
  verificationStatus: OutcomeVerificationStatus;
  idRequestReason?: string;
  lastBureauUpdateTimestamp: string;
}
export type DisputeRecord = MockBureauDisputeRecord;
```

#### 8. `VerificationResultRecord`
```typescript
export interface VerificationResultRecord {
  id: string; // e.g. "VER-172935..."
  caseId: string;
  disputeId: string;
  targetField: string;
  originalReportedValue: string;
  latestObservedValue: string;
  intendedCorrection: string;
  outcome: OutcomeVerificationStatus; // 'VERIFIED_CORRECTION' | 'NOT_CORRECTED' | 'INCONCLUSIVE'
  reportReDownloadRef: string;
  verifiedTimestamp: string;
  comparisonDetails: string;
  explanation: string;
}
```

#### 9. `TestScenarioResult`
```typescript
export interface TestScenarioResult {
  scenarioId: 'TC1' | 'TC2' | 'TC3' | 'TC4';
  title: string;
  description: string;
  inputData: Record<string, unknown>;
  expectedResult: Record<string, unknown>;
  actualResult: Record<string, unknown>;
  status: 'PASS' | 'FAIL' | 'PENDING';
  evidenceProduced: Array<{ label: string; value: string }>;
  caseId?: string;
  executionTimestamp?: string;
  discrepancyExplanation?: string;
  logs: string[];
}
```

---

## 2. Shared API Endpoints & Contract Specifications

### 1. Ingestion & Analysis
- `GET /api/cases`: Returns `{ cases: CaseRecord[], metrics: DashboardMetrics }`.
- `POST /api/cases`: Ingests report trade-line.
  - **Body**: `{ clientName, accountReference, creditorName, accountType, reportedBalance, paymentStatus, paymentHistory, reportedDate, userConfirmedFacts, discrepancyReason, userFactConfirmed, sourceReportRef?, attachedEvidenceNotes? }`.
  - **Response (200)**: `{ success: true, caseId: string, reportId: string, message: string }`.
- `POST /api/cases/[id]/analyze`: Evaluates trade-line against confirmed facts.
  - **Response (200)**: `{ success: true, classification: ClassificationRecord, aiEnrichment: object, draft: DisputeDraftRecord | null }`.

### 2. Dispute Drafting & Human Approval
- `GET /api/cases/[id]/draft`: Returns `{ draft: DisputeDraftRecord }`.
- `PUT /api/cases/[id]/draft`: Updates draft text.
  - **Body**: `{ disputedField?, userConfirmedStatement?, explanationOfDiscrepancy?, requestedCorrection? }`.
  - **Behavior**: Increments version (`v1 -> v2`), sets `active_approval_id = NULL`, status to `AWAITING_APPROVAL`.
  - **Response (200)**: `{ success: true, message: string, draft: DisputeDraftRecord }`.
- `POST /api/cases/[id]/approve`: Records explicit human approval.
  - **Body**: `{ draftVersion: number, action: 'APPROVED' | 'REJECTED' | 'REQUEST_MORE_INFO', reviewedBy?, notes? }`.
  - **Response (200)**: `{ success: true, approval: ApprovalRecord, message: string }`.

### 3. Mock Bureau Submission & Verification
- `POST /api/cases/[id]/submit`: Dispatches approved dispute to mock bureau.
  - **Body**: `{ simulateIdRequest?: boolean }`.
  - **Safety Rule**: Server checks `ApprovalEngine.validateSubmissionEligibility(caseId)`. Rejects if no approval or draft version mismatch with `403 Forbidden`. Enforces idempotency via `IDEMP-{caseId}-V{version}`.
  - **Response (200)**: `{ success: true, dispute: MockBureauDisputeResponse, message: string }`.
- `GET /api/cases/[id]/bureau-status`: Returns `{ disputeId, status, lastUpdated, verificationStatus, idRequestReason, mockPortalReference }`.
- `POST /api/cases/[id]/bureau-status`: Updates status for testing.
  - **Body**: `{ newStatus: WorkflowStatus, notes?: string }`.
- `POST /api/cases/[id]/upload-consent`: Grants explicit user consent for ID upload (TC4).
  - **Body**: `{ consentGiven: boolean, documentType: string, consumerDeclaration: string }`.
  - **Safety Rule**: If `consentGiven` is false, returns `400 Bad Request`.
- `POST /api/cases/[id]/verify`: Triggers independent outcome verification.
  - **Behavior**: Re-downloads report trade-line from Mock Bureau, compares fields, stores `VerificationResultRecord`.
  - **Response (200)**: `{ success: true, verification: VerificationResultRecord, message: string }`.

### 4. Test Lab & Audit Endpoints
- `POST /api/test-lab/run`: Runs test scenario.
  - **Body**: `{ scenarioId: 'TC1' | 'TC2' | 'TC3' | 'TC4' | 'ALL' }`.
  - **Response (200)**: `{ success: true, allPassed: boolean, count: number, results: TestScenarioResult[] }`.
- `GET /api/audit`: Returns `{ events: AuditEventRecord[], count: number }`. Query params: `caseId`, `limit`.
- `POST /api/seed`: Resets or seeds SQLite database. Body: `{ force: boolean }`.

---

## 3. Workflow State Transition State Machine

```
                   [ Intake Created ]
                           │
                           ▼
                        DRAFT
                           │
                           ▼ POST /api/cases/[id]/analyze
                      ANALYZED
                           │
             ┌─────────────┴─────────────┐
             ▼                           ▼
[ POTENTIAL_ERROR ]            [ ACCURATE_NEGATIVE / UNCERTAIN ]
             │                                   │
             ▼                                   ▼
     AWAITING_APPROVAL                     (No draft created;
             │                             Workflow complete)
   ┌─────────┴─────────┐
   │                   │
   ▼ POST .../approve  ▼ PUT .../draft
APPROVED           (Increments version;
   │                resets to AWAITING_APPROVAL)
   ▼ POST .../submit
SUBMITTED ──────────────┐
   │                    │ (simulateIdRequest: true)
   ▼                    ▼
UNDER_REVIEW      ADDITIONAL_INFORMATION_REQUIRED
   │                    │
   │                    ▼ POST .../upload-consent
   │              UNDER_REVIEW
   │                    │
   ▼                    ▼
RESOLVED / REJECTED ◄───┘
   │
   ▼ POST /api/cases/[id]/verify
(Independent Outcome Verification)
   ├── VERIFIED_CORRECTION
   ├── NOT_CORRECTED (Mismatch Detected)
   └── INCONCLUSIVE
```

---

## 4. Technical Rules & Constraints

1. **Database Mode**: SQLite database `./data/ziro_credit.db` operates in `DELETE` journal mode. **Do NOT enable WAL mode**, as Windows file locks on `.db-shm` cause Turbopack panics (`os error 33`).
2. **Zero Automated Submissions**: Disputes may never be submitted directly by AI logic without an affirmative `APPROVED` record matching the exact version of the active draft.
3. **Draft Invalidation**: Any draft edit automatically sets the active approval to `NULL` and changes workflow status back to `AWAITING_APPROVAL`.
4. **Idempotency Protection**: Repeated submissions with the same idempotency key must return the existing dispute record without creating a new record or modifying state.
5. **Decoupled Verification**: Bureau status `RESOLVED` must never be equated to `VERIFIED_CORRECTION`. Only field-by-field re-download audits determine verification outcome.
6. **Testing Standard**: All three developers must verify `npm run lint` (0 errors), `npm run build`, and `npm test` before committing any code.
