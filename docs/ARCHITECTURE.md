# ZiroCredit: System Architecture & Design Specification

## 1. Architectural Philosophy

**ZiroCredit** is designed as a mission-critical fintech AI agent for automated credit report auditing, evidence-backed dispute drafting, strict human approval enforcement, and independent outcome reconciliation.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        ZiroCredit Web Interface                        │
│   (Dashboard • Intake • Pipeline Inspection • Test Lab • Audit Stream) │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ JSON / REST
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       Next.js App Router Backend                       │
│  • Zod Input Validation  • Version Locking  • Idempotency Gatekeeper   │
└───────────┬───────────────────────┬──────────────────────┬─────────────┘
            │                       │                      │
            ▼                       ▼                      ▼
┌──────────────────────┐ ┌──────────────────────┐ ┌──────────────────────┐
│Classification Engine │ │    Approval Gate     │ │ Outcome Verification │
│• POTENTIAL_ERROR     │ │• Version Locking     │ │• Re-download Audit   │
│• ACCURATE_NEGATIVE   │ │• Invalidation on edit│ │• False Resolution    │
│• UNCERTAIN           │ │• Zero-Auto-Submit    │ │  Detection (TC3)     │
└───────────┬──────────┘ └──────────┬───────────┘ └──────────┬───────────┘
            │                       │                        │
            ▼                       ▼                        ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      Persistent SQLite Database                        │
│   (Cases • Trade-Lines • Evidence • Drafts • Approvals • Audit Events) │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   Apex Mock Credit Bureau Portal                       │
│    • Trade-Line Database  • Dispute Queue  • ID Request Simulation     │
└────────────────────────────────────────────────────────────────────────┘
```

## 2. Core Modules

### A. Intake & Extraction Layer
- **Ingestion**: Supports synthetic report extraction and structured trade-line submission.
- **Truth Certification**: Consumers affirmatively certify factual claims under FCRA § 611 standard.
- **Data Integrity**: Never invents or hallucinates missing account details.

### B. Classification Engine (`src/lib/classification/engine.ts`)
Distinguishes between:
1. `POTENTIAL_ERROR`: Factual conflict between certified statements and reported trade-lines (e.g. TC1 unauthorized loans).
2. `ACCURATE_NEGATIVE`: Corroborated negative entries that the consumer admits (e.g. TC2 30-day late payment). Frivolous disputes are suppressed to preserve credibility.
3. `UNCERTAIN`: Incomplete dates, missing account numbers, or lack of factual certification.

### C. Dispute Formulation & Version Invalidation
- Generates structured dispute notices citing FCRA § 611 and § 605B.
- Increments version counter (`v1 -> v2`) upon user editing.
- Modifying draft immediately invalidates existing approvals, forcing re-review.

### D. Human Approval Gateway (`src/lib/approval/engine.ts`)
- **Zero Automated Submissions**: Backend strictly validates that a valid human approval exists matching the exact draft version being submitted.
- Bypassing the approval gateway produces a `403 Forbidden` error.

### E. Mock Credit Bureau (`src/lib/bureau/mock-portal.ts`)
- Seeded, deterministic portal simulating credit agency APIs (`mock://apex-bureau.local/v1`).
- Enforces duplicate submission prevention via idempotent keys (`IDEMP-CASE-V{version}`).
- Supports dynamic status lifecycle: `SUBMITTED -> UNDER_REVIEW -> ADDITIONAL_INFORMATION_REQUIRED -> RESOLVED`.

### F. Independent Outcome Verification (`src/lib/verification/engine.ts`)
- Does **not** equate bureau `RESOLVED` with actual verified correction.
- Re-downloads the live trade-line from the bureau.
- Compares the freshly downloaded record with the intended remedy:
  - `VERIFIED_CORRECTION`: Trade-line deleted or balance updated to $0.
  - `NOT_CORRECTED`: Trade-line remains unchanged despite bureau marking dispute "resolved" (TC3).
  - `INCONCLUSIVE`: Unclear resolution.

### G. Append-Only Audit Trail (`src/lib/audit/logger.ts`)
- Records state transitions, human actions, draft modifications, bureau responses, and verification results.
- Sanitizes all entries to exclude passwords, tokens, or sensitive identification data.
