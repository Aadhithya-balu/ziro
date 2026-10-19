# TASKS_DEVELOPER_1.md: Workstream A — AI Analysis & Intake

> **Assigned Developer**: Developer 1  
> **Domain**: Ingestion, Classification Engine, AI Legal Enrichment & TC1/TC2 Verification  
> **Target Branch**: `feat/dev1-ai-analysis`

---

## 1. Assigned Objective
Enhance credit report extraction rules, strengthen deterministic classification reasoning for complex reporting anomalies (e.g. duplicate trade-lines, outdated public records, re-aged debts), refine provider-independent AI legal narrative generation, and ensure 100% compliance with TC1 (unauthorized loan) and TC2 (accurate late payment) scenarios.

---

## 2. Existing Functionality That Must Be Preserved
- Deterministic 3-way classification: `POTENTIAL_ERROR`, `ACCURATE_NEGATIVE`, `UNCERTAIN`.
- Strict anti-frivolous rule: Suppressing dispute generation for verified accurate negative data (e.g. TC2).
- Statutory factual certification requirement: Consumer must certify facts under FCRA § 611 standard.
- Deterministic local AI fallback (allowing offline demo runs without paid LLM API keys).
- Anti-hallucination guarantee: Missing fields must produce `UNCERTAIN`, never fabricated values.

---

## 3. Exact Files Developer 1 May Modify
- `src/lib/classification/engine.ts`
- `src/lib/classification/llm-adapter.ts`
- `src/app/api/cases/route.ts`
- `src/app/api/cases/[id]/analyze/route.ts`
- `src/components/IntakeView.tsx`

---

## 4. Files Developer 1 Must NOT Modify Without Team Approval
- `src/types/index.ts` (Frozen shared contract)
- `src/lib/approval/engine.ts` (Owned by Developer 2)
- `src/lib/bureau/mock-portal.ts` (Owned by Developer 3)
- `src/lib/verification/engine.ts` (Owned by Developer 3)
- `src/components/CaseDetailView.tsx` (Shared integration screen)
- `src/lib/scenarios/runner.ts` (Shared test runner)

---

## 5. Specific Implementation Tasks
1. **Trade-Line Ingestion & Normalization**:
   - Add parsing support for additional account types (`STUDENT_LOAN`, `REVOLVING`, `COLLECTIONS`) in `src/components/IntakeView.tsx`.
   - Ensure date formats (ISO `YYYY-MM-DD`) and currency numbers are normalized cleanly before passing to `/api/cases`.
2. **Advanced Classification Rules in `engine.ts`**:
   - Implement rule for **Duplicate Accounts**: Detect identical balances and creditor names reported under different account references.
   - Implement rule for **Obsolete Negative Information**: Flag negative entries reported beyond the 7-year statutory FCRA limit.
   - Ensure incomplete entries (missing opened date or unconfirmed facts) consistently yield `UNCERTAIN` with clear missing data checklists.
3. **AI Legal Narrative Enrichment in `llm-adapter.ts`**:
   - Expand the statutory reference library in `AIAnalysisAdapter` to include citations for:
     - 15 U.S.C. § 1681c (Statutory obsolescence period).
     - 15 U.S.C. § 1681s-2 (Furnisher duties upon notice of dispute).
   - Ensure formatting renders markdown cleanly in client views.
4. **TC1 & TC2 Scenario Defense**:
   - Guarantee that TC1 always outputs `POTENTIAL_ERROR` with dispute draft `v1` generated.
   - Guarantee that TC2 always outputs `ACCURATE_NEGATIVE` with `draft === null`.

---

## 6. Acceptance Criteria
- [ ] Submitting an account with confirmed late payment admission outputs `ACCURATE_NEGATIVE` and `draft === null`.
- [ ] Submitting an unauthorized loan with certified denial outputs `POTENTIAL_ERROR` and a formal dispute draft targeting account ownership.
- [ ] Submitting a report with unconfirmed user facts outputs `UNCERTAIN` with human review flagged as `true`.
- [ ] Local deterministic fallback works reliably with zero external API keys set.
- [ ] No fabricated values appear when mandatory fields are omitted.

---

## 7. Tests to Execute
```bash
# Run unit tests covering classification
npx vitest run tests/unit.test.ts

# Execute TC1 and TC2 via API
node -e "fetch('http://localhost:3000/api/test-lab/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scenarioId: 'TC1' }) }).then(r => r.json()).then(console.log);"
node -e "fetch('http://localhost:3000/api/test-lab/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scenarioId: 'TC2' }) }).then(r => r.json()).then(console.log);"

# Verify build and linting
npm run lint
npm run build
```

---

## 8. Required API & Type Contracts
- Consumes: `CreditReportRecord`, `EvidenceItem`, `ClassificationRecord`, `DisputeDraftRecord` from `@/types`.
- Produces: API response for `POST /api/cases` and `POST /api/cases/[id]/analyze`.

---

## 9. Dependencies on Other Developers
- **On Developer 2**: Developer 2 consumes `ClassificationRecord` and `DisputeDraftRecord` in the case detail view. Do not rename output keys (`disputedField`, `explanationOfDiscrepancy`, `requestedCorrection`).
- **On Developer 3**: Developer 3 retrieves authoritative evidence items that Developer 1's engine attaches to classifications.

---

## 10. Definition of Done
1. `npm run lint` passes with 0 errors and 0 warnings.
2. `npx vitest run` passes with all classification tests green.
3. TC1 and TC2 scenario evaluations pass with live inspectable evidence.
4. Changes are isolated to owned files and committed to `feat/dev1-ai-analysis`.
