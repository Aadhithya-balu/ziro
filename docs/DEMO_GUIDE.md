# ZiroCredit: Live Judge Demonstration Guide

Follow this 5-minute walkthrough to demonstrate all required capabilities and test scenarios to hackathon evaluators.

---

### Step 1: Dashboard Overview (1 Minute)
1. Launch application (`http://localhost:3000`).
2. Show the **Fintech KPI Metrics**:
   - Total Cases, Potential Errors, Awaiting Approval, Submitted, Resolved, Additional Evidence Required.
3. Point out the clear **Synthetic Demo Environment** badge and explain data isolation.
4. Show the **Recent Activity Table** with confidence meters and workflow status pills.

---

### Step 2: Test Lab Official Scenarios (2 Minutes)
1. Click **"Test Lab (4 Scenarios)"** in the navigation bar.
2. Click **"Run All Official Scenarios"**.
3. Watch all 4 official scenarios execute in parallel/sequence:
   - **TC1 (Loan User Never Took)**: Classifies as `POTENTIAL_ERROR`, generates draft, halts submission pending human approval.
   - **TC2 (Accurate 30-Day Late Payment)**: Classifies as `ACCURATE_NEGATIVE`, suppresses draft generation, explains why disputing accurate negative entries harms credibility.
   - **TC3 (Bureau Marks Dispute Resolved)**: Bureau reports `RESOLVED`, but ZiroCredit re-downloads the report, detects the trade-line still exists, and flags `NOT_CORRECTED`!
   - **TC4 (Bureau Requests ID Upload)**: Bureau requests ID documents. Workflow pauses at `ADDITIONAL_INFORMATION_REQUIRED` and strictly prevents uploading without explicit user consent.
4. Open the execution logs accordion on TC3 to demonstrate inspectable diff evidence.

---

### Step 3: End-to-End Interactive Case Walkthrough (1.5 Minutes)
1. Click **"New Analysis"** in the navigation.
2. Click the preset button: **"TC1: Never Opened Loan"** (1-click autofill).
3. Review the statutory truth certification checkbox: *"I solemnly confirm that the factual statements provided above are true..."*
4. Click **"Ingest & Run AI Classification"**.
5. Observe the 6-stage workflow pipeline:
   - Review the generated **Dispute Draft v1**.
   - Click **"Edit Draft"**, modify the requested correction text, and save.
   - Note the security alert: **Draft is now v2, and prior approvals have been automatically invalidated!**
   - Click **"Approve Draft v2"**.
   - Click **"Submit Approved Dispute to Bureau"**.
   - Show the Mock Bureau Dispute ID generated (`MOCK-DISP-...`).
6. In the Bureau Response Simulator, click **"Set: Resolved"**.
7. Click **"Run Independent Re-Download Audit"** to verify the actual outcome.

---

### Step 4: Compliance & Audit Trail (0.5 Minutes)
1. Click **"Audit Trail"** in the navbar.
2. Show the immutable append-only event stream documenting every state transition, approval ID, and draft version modification.
3. Click **"Inspect"** on any event to inspect the sanitized JSON payload.
