# TASKS_DEVELOPER_3.md: Workstream C — Mock Bureau & Independent Verification

> **Assigned Developer**: Developer 3  
> **Domain**: Mock Credit Bureau Portal, Submission Idempotency, KYC ID Consent Gate & Independent Outcome Audit  
> **Target Branch**: `feat/dev3-bureau-verification`

---

## 1. Assigned Objective
Maintain and extend the local `MockCreditBureauPortal`, enforce backend duplicate-submission protection via idempotency keys, implement the KYC ID consent security barrier (TC4), and manage independent outcome reconciliation comparing re-downloaded trade-lines against intended corrections (TC3).

---

## 2. Existing Functionality That Must Be Preserved
- Deterministic, seeded local bureau portal (`mock://apex-bureau.local/v1`) with zero real credit bureau connectivity.
- Idempotent submission: Re-submitting with the same idempotency key (`IDEMP-{caseId}-V{version}`) must return the existing dispute record rather than creating a duplicate.
- TC4 Security Rule: Bureau requests for government photo ID must halt the workflow at `ADDITIONAL_INFORMATION_REQUIRED` and strictly require affirmative consumer consent before document upload.
- TC3 Verification Rule: Bureau status `RESOLVED` must never be equated with `VERIFIED_CORRECTION`. The actual trade-line must be re-downloaded and audited.

---

## 3. Exact Files Developer 3 May Modify
- `src/lib/bureau/mock-portal.ts`
- `src/lib/verification/engine.ts`
- `src/app/api/bureau/route.ts`
- `src/app/api/cases/[id]/submit/route.ts`
- `src/app/api/cases/[id]/bureau-status/route.ts`
- `src/app/api/cases/[id]/verify/route.ts`
- `src/app/api/cases/[id]/upload-consent/route.ts`
- `src/components/BureauPortalView.tsx`

---

## 4. Files Developer 3 Must NOT Modify Without Team Approval
- `src/types/index.ts` (Frozen shared contract)
- `src/lib/classification/engine.ts` (Owned by Developer 1)
- `src/lib/approval/engine.ts` (Owned by Developer 2)
- `src/components/CaseDetailView.tsx` (Shared integration screen)
- `src/lib/scenarios/runner.ts` (Shared test runner)

---

## 5. Specific Implementation Tasks
1. **Mock Bureau Trade-Line Database**:
   - In `src/lib/bureau/mock-portal.ts`, support additional query filters (e.g. search by SSN last 4 or creditor name).
   - Ensure `generateEvidenceFromBureau` attaches clean `EvidenceItem` records with unique evidence IDs and timestamps.
2. **Idempotent Dispute Submission**:
   - In `src/app/api/cases/[id]/submit/route.ts`, verify that the idempotency key binds both `caseId` and `draft.version`.
   - Ensure the server validates `ApprovalEngine.validateSubmissionEligibility(caseId)` before touching bureau state.
3. **TC4 Identity Consent Protocol**:
   - In `src/app/api/cases/[id]/upload-consent/route.ts`, ensure that if `consentGiven === false`, the API returns `400 Bad Request`.
   - Verify that upon valid consent, dispute status advances to `UNDER_REVIEW` and an audit event is logged.
4. **TC3 Independent Outcome Verification**:
   - In `src/lib/verification/engine.ts`, strengthen comparison logic:
     - Deletion: If trade-line is missing from bureau or marked deleted -> `VERIFIED_CORRECTION`.
     - False Resolution: If bureau status is `RESOLVED` but trade-line still exists with non-zero balance -> `NOT_CORRECTED` with explicit discrepancy explanation.
     - Ambiguous: If fields cannot be cleanly parsed -> `INCONCLUSIVE`.
5. **Bureau Portal Inspector UI**:
   - In `src/components/BureauPortalView.tsx`, allow live search and inspection of registered mock accounts and dispute queue.

---

## 6. Acceptance Criteria
- [ ] Retrying a dispute submission with the same idempotency key returns the existing dispute ID without creating a new record.
- [ ] Submitting a dispute simulating an ID request transitions case to `ADDITIONAL_INFORMATION_REQUIRED` and halts document transmission until consent is granted.
- [ ] Running outcome verification on a case where the trade-line remains unchanged returns `outcome: NOT_CORRECTED` with diff details.
- [ ] All bureau status updates log append-only records to `audit_events`.
- [ ] No network requests are made to live credit bureaus (isolated local mock only).

---

## 7. Tests to Execute
```bash
# Run unit tests covering idempotency and verification
npx vitest run tests/unit.test.ts

# Execute TC3 and TC4 via API
node -e "fetch('http://localhost:3000/api/test-lab/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scenarioId: 'TC3' }) }).then(r => r.json()).then(console.log);"
node -e "fetch('http://localhost:3000/api/test-lab/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scenarioId: 'TC4' }) }).then(r => r.json()).then(console.log);"

# Verify build and linting
npm run lint
npm run build
```

---

## 8. Required API & Type Contracts
- Consumes: `MockBureauDisputeRecord`, `VerificationResultRecord`, `EvidenceItem` from `@/types`.
- Produces: API response for `/api/bureau`, `/api/cases/[id]/submit`, `/api/cases/[id]/verify`, and `/api/cases/[id]/upload-consent`.

---

## 9. Dependencies on Other Developers
- **On Developer 1**: Developer 1's intake module triggers evidence collection via `MockCreditBureauPortal.generateEvidenceFromBureau`.
- **On Developer 2**: Developer 3's submission endpoint requires a valid `ApprovalRecord` produced by Developer 2's approval engine.

---

## 10. Definition of Done
1. `npm run lint` passes with 0 errors and 0 warnings.
2. `npx vitest run` passes with all idempotency and verification tests green.
3. TC3 (false resolution) and TC4 (ID consent gate) pass with live inspectable evidence.
4. Changes are isolated to owned files and committed to `feat/dev3-bureau-verification`.
