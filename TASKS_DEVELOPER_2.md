# TASKS_DEVELOPER_2.md: Workstream B — User Experience & Human Approval Gateway

> **Assigned Developer**: Developer 2  
> **Domain**: Dashboard Metrics, Dispute Draft Management, Version Invalidation & Human Approval Gateway  
> **Target Branch**: `feat/dev2-ux-approval`

---

## 1. Assigned Objective
Deliver a responsive, demo-ready fintech user experience across the dashboard, case details, dispute draft editor, and human approval gateway. Enforce server-side approval version locking, ensure draft edits invalidate prior approvals, and provide clear audit stream inspection.

---

## 2. Existing Functionality That Must Be Preserved
- Zero Automated Submissions: No dispute can be submitted without explicit, affirmative human approval.
- Version Locking: If a draft is updated (`v1 -> v2`), existing approvals are invalidated. Submitting with an obsolete approval version is blocked with `403 Forbidden`.
- 6-Stage Workflow Timeline visualizer.
- Append-only audit trail logging every user review, draft update, and state change.

---

## 3. Exact Files Developer 2 May Modify
- `src/lib/approval/engine.ts`
- `src/lib/audit/logger.ts`
- `src/app/api/cases/[id]/draft/route.ts`
- `src/app/api/cases/[id]/approve/route.ts`
- `src/app/api/audit/route.ts`
- `src/components/DashboardView.tsx`
- `src/components/AuditLogView.tsx`

---

## 4. Files Developer 2 Must NOT Modify Without Team Approval
- `src/types/index.ts` (Frozen shared contract)
- `src/lib/classification/engine.ts` (Owned by Developer 1)
- `src/lib/bureau/mock-portal.ts` (Owned by Developer 3)
- `src/lib/verification/engine.ts` (Owned by Developer 3)
- `src/components/CaseDetailView.tsx` (Shared integration file — coordinate edits)
- `src/lib/scenarios/runner.ts` (Shared test runner)

---

## 5. Specific Implementation Tasks
1. **Human Approval Gateway UI & API**:
   - In `src/lib/approval/engine.ts`, ensure `validateSubmissionEligibility` returns rich error diagnostics when approvals are missing, stale, or rejected.
   - Ensure `POST /api/cases/[id]/approve` accurately sets `submissionEligibility = true` for `APPROVED`, and `false` for `REJECTED` or `REQUEST_MORE_INFO`.
2. **Draft Version Management & Invalidation**:
   - In `src/app/api/cases/[id]/draft/route.ts`, confirm that `PUT` increments version number and resets `active_approval_id = NULL` and status to `AWAITING_APPROVAL`.
   - Add inline validation in the draft edit modal so users cannot save empty dispute text.
3. **Dashboard KPI Metrics & Filtering**:
   - In `src/components/DashboardView.tsx`, ensure the 6 KPI cards (Total Cases, Potential Errors, Awaiting Approval, Submitted, Resolved, Additional Info) update reactively when cases change state.
   - Add status pill filtering (e.g. view only "Awaiting Approval" cases).
4. **Audit Log Presentation**:
   - In `src/components/AuditLogView.tsx`, ensure the JSON metadata viewer allows copying raw audit payloads.
   - Ensure the event type filter (`APPROVAL`, `DISPUTE`, `VERIFICATION`) accurately isolates relevant events.

---

## 6. Acceptance Criteria
- [ ] Attempting to submit a dispute without human approval returns `403 Forbidden` with a clear explanation.
- [ ] Editing draft v1 immediately updates draft to v2 and marks status `AWAITING_APPROVAL`.
- [ ] Attempting to submit after draft modification without re-approval fails validation.
- [ ] All significant user actions (draft edit, approve, reject, request info) append sanitized records to `audit_events`.
- [ ] Passwords, tokens, or unnecessary sensitive identity data are never stored in audit logs.

---

## 7. Tests to Execute
```bash
# Run unit tests covering approval and version invalidation
npx vitest run tests/unit.test.ts

# Test approval API directly
node -e "fetch('http://localhost:3000/api/cases/CASE-2026-001/approve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ draftVersion: 1, action: 'APPROVED' }) }).then(r => r.json()).then(console.log);"

# Verify build and linting
npm run lint
npm run build
```

---

## 8. Required API & Type Contracts
- Consumes: `DisputeDraftRecord`, `ApprovalRecord`, `AuditEventRecord` from `@/types`.
- Produces: API response for `PUT /api/cases/[id]/draft`, `POST /api/cases/[id]/approve`, and `GET /api/audit`.

---

## 9. Dependencies on Other Developers
- **On Developer 1**: Developer 1 produces the initial `DisputeDraftRecord` (v1) that Developer 2 renders and allows the user to edit and approve.
- **On Developer 3**: Developer 3 requires a valid `ApprovalRecord` before dispatching disputes to the mock bureau.

---

## 10. Definition of Done
1. `npm run lint` passes with 0 errors and 0 warnings.
2. `npx vitest run` passes with all approval and invalidation tests green.
3. Version invalidation on draft edit is verified end-to-end.
4. Changes are isolated to owned files and committed to `feat/dev2-ux-approval`.
