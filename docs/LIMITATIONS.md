# ZiroCredit: Known Limitations & Failure Handling

## 1. Prototype Scope & Synthetic Isolation
- **Mock Bureau Isolation**: ZiroCredit interacts exclusively with the local `MockCreditBureauPortal` (`mock://apex-bureau.local/v1`). It does not connect to live e-OSCAR or live credit bureau APIs (Equifax, Experian, TransUnion) to prevent exposing test data to production agencies.
- **Synthetic Data Exclusivity**: All default customer names, social security references, and account numbers are synthetic.

## 2. Document Processing & Ingestion
- **PDF Extraction**: The prototype simulates PyMuPDF document extraction and includes structured manual input validation.
- **Strict Anti-Hallucination Policy**: If a field is missing from an uploaded document (such as reporting date or account number), the system marks the case as `UNCERTAIN` rather than inventing or extrapolating missing values.

## 3. Human Approval & Security Boundaries
- **Zero-Auto-Submit Guarantee**: Even if an LLM analysis assigns 99% confidence to an error, disputes cannot be dispatched to the bureau without an explicit, version-matched human approval.
- **Consent Gateways**: In scenarios where bureaus request identification documents (TC4), the system halts the workflow and blocks file transmission until the consumer provides explicit affirmative consent.
- **Server-Side Enforcement**: Frontend flags are never trusted for submission eligibility; approval IDs and version integrity are verified directly on the backend.

## 4. Failure Handling Mechanisms
- **Idempotency Protection**: Repeated submissions with the same idempotency key return the original dispute record, preventing duplicate submissions.
- **Dispute Draft Invalidation**: Editing any draft automatically voids previous approvals, preventing submission of un-reviewed modifications.
- **Independent Outcome Reconciliation**: A bureau status of `RESOLVED` is never assumed to be accurate. An independent re-download comparison catches uncorrected errors and records audit evidence.
