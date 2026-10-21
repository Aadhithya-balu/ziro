# ZiroCredit: UI/UX Design System & Specification Document

> **Project**: ZiroCredit — AI Credit Report Error Dispute & Independent Verification Assistant  
> **Target Environment**: Web / Desktop & Tablet Responsive (Next.js 16 + Tailwind CSS + Lucide Icons)  
> **Document Version**: 1.0.0  
> **Status**: Official Design Specification

---

## 1. Design Philosophy & UX Vision

### 1.1 The Core FinTech Challenge
Credit repair and dispute systems often suffer from two extremes:
1. **Opaque "Black Box" Automation**: Unregulated tools that mass-submit frivolous template letters, risking federal FCRA § 623 penalties and damaging consumer credibility.
2. **Cumbersome Manual Portals**: Bureau workflows that fatigue consumers with dense legal jargon, obscure dispute statuses, and deceptive "resolved" declarations where errors remain on file.

### 1.2 The ZiroCredit Approach
ZiroCredit balances **autonomous AI intelligence** with **strict human-in-the-loop control**, encapsulated in four core UX tenets:

1. **Uncompromising Human Agency**: Zero automated submissions. The AI proposes, analyzes, and drafts; the consumer certifies, edits, and authorizes.
2. **Visual Truth & Independent Reconciliation**: The UI transparently exposes discrepancies between bureau claims (e.g. "Resolved") and empirical facts (re-downloaded trade-lines).
3. **Instant Situational Awareness**: Dense financial records are organized into a high-clarity 6-stage pipeline, immediate KPI indicators, and contextual legal citations (FCRA § 611, § 605B).
4. **State-of-the-Art Aesthetic**: A sleek, dark-mode fintech interface engineered with slate tones, vibrant status glows, glassmorphism, and clear micro-interactions.

---

## 2. Design Tokens & Visual Identity

### 2.1 Color Palette
The color hierarchy combines deep space neutrals with high-contrast, semantic status indicators:

| Token | Hex / Value | Tailwind Class | Semantic Usage |
|---|---|---|---|
| **Base Canvas** | `#020617` | `bg-slate-950` | Primary app background |
| **Card / Surface** | `#0f172a` | `bg-slate-900` | Elevating containers, panels, cards |
| **Surface Accent** | `#1e293b` | `bg-slate-800` | Hover states, secondary buttons, inputs |
| **Borders** | `#334155` / `rgba(51,65,85,0.4)` | `border-slate-800` | Subtle containment dividers |
| **Primary Brand** | `#4f46e5` to `#06b6d4` | `from-indigo-600 to-cyan-400` | Brand logo, primary accents, active tabs |
| **Success / Verified** | `#10b981` | `text-emerald-400`, `bg-emerald-500/10` | Verified corrections, approved drafts |
| **Warning / Action** | `#f59e0b` | `text-amber-400`, `bg-amber-500/10` | Potential errors, review alerts, demo badge |
| **Security / Consent** | `#a855f7` | `text-purple-400`, `bg-purple-500/10` | Approval gates, KYC consent, audit ledger |
| **Danger / Mismatch** | `#f43f5e` | `text-rose-400`, `bg-rose-500/10` | Audit mismatch (TC3), rejection, errors |
| **In-Flight Bureau** | `#06b6d4` | `text-cyan-400`, `bg-cyan-500/10` | Lodged disputes, mock bureau portal |

### 2.2 Typography
- **Primary Sans**: `Geist Sans` / `Inter` / `system-ui`
  - High legibility at small sizes (`text-[10px]` to `text-xs`) for dense financial data tables.
  - Bold headlines (`font-black`, `font-extrabold`) for clear visual hierarchy.
- **Data & Numeric Mono**: `Geist Mono` / `ui-monospace`
  - Used for Case IDs (`CASE-2026-001`), Account Numbers (`ACC-9821-AUTO`), Timestamps, and FCRA statutory citations.

### 2.3 Surfaces, Depth & Glassmorphism
- **Sticky Glass Navbar**: `bg-slate-900/95 backdrop-blur-md border-b border-slate-800`
- **Card Containers**: `rounded-2xl border border-slate-800 bg-slate-900 shadow-xl`
- **Soft Glow Accents**:
  - Indigo Button Glow: `shadow-lg shadow-indigo-600/30`
  - Warning Accent: `border-amber-500/30 bg-amber-500/10`
  - Success Accent: `border-emerald-500/30 bg-emerald-500/10`

---

## 3. Information Architecture (IA)

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                             ZiroCredit Navigation Bar                             │
│  [Logo + AI Badge]   [Dashboard] [New Analysis] [Test Lab] [Mock Bureau] [Audit] │
└────────────────────────────────────────┬─────────────────────────────────────────┘
                                         │
        ┌────────────────────────────────┼────────────────────────────────┐
        ▼                                ▼                                ▼
┌───────────────┐              ┌──────────────────┐             ┌──────────────────┐
│ 1. Dashboard  │              │ 2. New Analysis  │             │ 3. Case Details  │
│ • 6 KPI Cards │              │ • Synthetic Demo │             │ • 6-Stage Flow   │
│ • Case Filter │              │   Presets (TC1-4)│             │ • Trade-Line Info│
│ • Master List │              │ • Intake Form    │             │ • AI Legal Draft │
│ • Case Select │              │ • FCRA Certify   │             │ • Approval Gate  │
└───────┬───────┘              └─────────┬────────┘             │ • Bureau Submit  │
        │                                │                      │ • Outcome Audit  │
        └────────────────►───────────────┴──────────────────────►───────┬──────────┘
                                                                        │
                        ┌───────────────────────────────────────────────┤
                        ▼                                               ▼
              ┌──────────────────┐                            ┌──────────────────┐
              │ 4. Mock Bureau   │                            │ 5. Audit Ledger  │
              │ • Live Disputes  │                            │ • Immutable Log  │
              │ • Trade-Line DB  │                            │ • Type Filters   │
              │ • Bureau Status  │                            │ • JSON Inspector │
              │ • Discrepancy Sim│                            │ • Copy Payload   │
              └──────────────────┘                            └──────────────────┘
```

---

## 4. Detailed Screen & Component Specifications

### 4.1 Dashboard View (`DashboardView.tsx`)
**Primary Purpose**: Executive operational overview of all monitored trade-lines, urgent action queues, and high-level case resolution rates.

#### Key UX Elements:
1. **Hero KPI Grid (6 Metric Cards)**:
   - *Total Ingested Cases*: Overall portfolio scale.
   - *Potential Errors Identified*: Actionable accounts where consumer facts conflict with reported records.
   - *Awaiting User Approval*: Urgent queue requiring affirmative human sign-off.
   - *Submitted to Bureau*: Disputes actively under investigation with credit agencies.
   - *Resolved Disputes*: Cases completed and awaiting independent verification.
   - *Additional Evidence Required*: Paused flows requiring KYC identity uploads or clarification.
2. **Quick Workflow Launch Banners**:
   - Direct button to launch *Test Lab (4 Automated Scenarios)*.
   - Direct button to ingest a *New Case Intake*.
3. **Interactive Filterable Case Table**:
   - Status pill filter toggles (`ALL`, `POTENTIAL_ERROR`, `AWAITING_APPROVAL`, `SUBMITTED`, `RESOLVED`, `ADDITIONAL_INFO`).
   - Search input filtering by Client Name, Creditor, or Case ID.
   - Action button leading directly into the detailed 6-stage case workspace.

---

### 4.2 Intake & Trade-Line Normalization View (`IntakeView.tsx`)
**Primary Purpose**: Streamlined, error-resistant ingestion of credit report trade-lines, with instant one-click demonstration scenario presets.

#### Key UX Elements:
1. **One-Click Scenario Presets Bar**:
   - Buttons for **TC1** (Unauthorized Auto Loan), **TC2** (Accurate 30-Day Late), **TC3** (False Resolution Mismatch), **TC4** (Bureau KYC ID Request), and Obsolete/Duplicate entries.
   - Instantly populates synthetic inputs without manual typing.
2. **Structured Trade-Line Form**:
   - Normalized Account Reference, Creditor Name, Account Type dropdown, Reported Balance, and Delinquency History.
   - Clean numeric validation with automatic currency formatting.
3. **Consumer Truth Certification Checkbox (FCRA § 611 Standard)**:
   - High-visibility legal callout requiring the consumer to certify under penalty of perjury that their factual statements are truthful.
   - Prevents frivolous dispute generation and sets legal grounding for the AI agent.

---

### 4.3 Case Detail & Human Approval Gateway (`CaseDetailView.tsx`)
**Primary Purpose**: Mission-critical case command center where the AI analysis is inspected, dispute notices are edited, and human approvals are certified.

#### 1. 6-Stage Autonomous Dispute & Audit Stepper:
A dynamic visual progress track updating in real time across the case lifecycle:
```
[1. Ingestion] ──► [2. Evidence] ──► [3. Classification] ──► [4. Dispute Draft] ──► [5. Human Sign-Off] ──► [6. Outcome Audit]
 Normalized          Certified        POTENTIAL_ERROR         v1 Formulated          Affirmative            Independent
 & Certified          Affidavit       or ACCURATE_NEG         (Version Lock)         Approval Certified     Trade-Line Audit
```

#### 2. Split-Screen Layout:
- **Left Column (5 Cols)**:
  - *Reported Trade-Line Summary*: Creditor, balance, reported status, account opened/reported dates.
  - *Consumer Evidence & Certified Statements*: Facts asserted by the consumer.
  - *AI Classification Card*: Rationale, confidence score, and statutory references (FCRA § 611 / § 605B).
- **Right Column (7 Cols)**:
  - *Dispute Notice Document Viewer*: Formatted letter citing legal authorities and explicit factual contradictions.
  - *Edit Draft Modal & Version Invalidation*:
    - Allows consumer to refine disputed fields, explanations, and remedies.
    - **UX Safeguard**: Editing increments version (`v1 -> v2`) and immediately clears approval state with an amber warning banner.
  - *Human Approval Gateway*:
    - Three clear actions: **Approve Draft (Green)**, **Reject Dispute (Red)**, **Request Info (Yellow)**.
    - Locks submission eligibility to `true` ONLY on affirmative approval.
  - *Mock Bureau Submission Panel*:
    - Active only after valid approval.
    - Option to simulate bureau KYC document requests.
  - *Independent Outcome Verification Panel*:
    - Re-downloads the live trade-line and compares it with the intended remedy.
    - Highlights discrepancies in rose red (`NOT_CORRECTED`) vs. verified removal in emerald green (`VERIFIED_CORRECTION`).

---

### 4.4 Mock Bureau Portal View (`BureauPortalView.tsx`)
**Primary Purpose**: Dual-purpose simulation portal demonstrating credit bureau operations, dispute investigation queues, and trade-line registry states.

#### Key UX Elements:
1. **Tab 1: Active Dispute Queue**:
   - Filter by status (`ALL`, `SUBMITTED`, `UNDER_REVIEW`, `ADDITIONAL_INFO`, `RESOLVED`).
   - Detailed dispute inspection drawer showing idempotency keys, timestamps, and consumer declarations.
   - Interactive status advancement triggers for live demonstrations.
2. **Tab 2: Master Bureau Trade-Line Database**:
   - Real-time search by account reference (`ACC-9821-AUTO`, `ACC-4491-CARD`).
   - Demonstrates how trade-lines exist inside credit reporting agency databases before and after investigation.

---

### 4.5 Test Lab View (`TestLabView.tsx`)
**Primary Purpose**: One-click validation and testing workbench running the 4 canonical FCRA credit dispute scenarios.

#### Key UX Elements:
1. **Interactive Scenario Cards**:
   - **TC1: Loan User Never Took**: Tests potential error classification and draft formulation.
   - **TC2: Accurate 30-Day Late Payment**: Tests anti-frivolous filtering and dispute suppression.
   - **TC3: Bureau Marks Resolved (Mismatch)**: Tests independent re-download audit and false resolution detection.
   - **TC4: Bureau Requests ID Upload**: Tests KYC identity pause and explicit consumer consent guardrail.
2. **Real-Time Step-by-Step Execution Log**:
   - Live execution spinner and step markers showing exact backend transitions.
   - Terminal-style JSON log drawer with expandable inspection.
   - Direct button: "Open Created Case" to inspect full visual evidence.

---

### 4.6 Append-Only Audit Trail View (`AuditLogView.tsx`)
**Primary Purpose**: Regulatory-grade, tamper-evident security ledger capturing every critical system event.

#### Key UX Elements:
1. **Security Banner**:
   - Highlights immutable ledger status and zero credential logging guarantee.
2. **Filter & Search Bar**:
   - Quick filters: `ALL`, `APPROVAL`, `DISPUTE`, `VERIFICATION`, `CASE`.
   - Instant search by Case ID or Actor.
3. **Audit Event Cards**:
   - Actor identification (e.g., `Alex Mercer / Authorized Officer`, `AI Agent Orchestrator`).
   - Timestamp with second-level precision.
   - Expandable Raw Metadata Drawer with one-click **Copy JSON** button.

---

## 5. Human-in-the-Loop Micro-Interactions & Safety Guardrails

### 5.1 Zero Automated Submissions Guardrail
- **UI State**: The `Submit to Bureau` button is rendered in a disabled, locked state with a padlock icon (`Lock`) whenever `active_approval_id` is null or `isEligibleForSubmission === false`.
- **Tooltip / Diagnostic Alert**: Explicitly informs the user: *"Affirmative human approval required before submission to credit reporting agencies."*

### 5.2 Version Invalidation Flow
1. User reviews Draft `v1`.
2. User clicks **"Edit Draft"**.
3. Modal displays input fields for Disputed Field, Narrative Explanation, and Requested Remedy.
4. User saves changes:
   - Version updates to `v2`.
   - Previous approval is permanently invalidated (`active_approval_id = NULL`).
   - Banner notification appears: *"Draft modified to v2. Previous approvals have been invalidated. Please review and re-approve."*
   - Submission button re-locks immediately.

### 5.3 Consumer Consent Boundary for Identity Documents (TC4)
- When the bureau requests photo ID or proof of residence:
  - The workflow automatically halts and enters `ADDITIONAL_INFORMATION_REQUIRED`.
  - A prominent purple Consent Modal triggers.
  - The agent is legally prevented from uploading documents autonomously.
  - Requires the consumer to affirmatively type/confirm an authorization declaration.

---

## 6. Responsive Breakpoints & Layout Adaptability

| Viewport | Width | Layout Adjustments |
|---|---|---|
| **Mobile** | `< 640px` | Single column; bottom navigation bar; 6-stage stepper stacks in 2-column grid; compact KPI cards |
| **Tablet** | `640px - 1024px` | 2-column KPI cards; horizontal scrolling tabs; stacked case detail view |
| **Desktop** | `> 1024px` | Full 12-column split grid (5/7 column layout in Case Details); sticky glass top header; full table views |

---

## 7. Accessibility & Regulatory Compliance (a11y)

1. **Color Contrast**:
   - All text maintains WCAG AA contrast standards (minimum 4.5:1 ratio against `slate-900` / `slate-950`).
   - Muted secondary copy uses `text-slate-400` on dark canvas (7.2:1 contrast ratio).
2. **Keyboard Navigation**:
   - Focus rings: `focus:outline-none focus:ring-2 focus:ring-indigo-500/50`.
   - Tab navigation supported across all buttons, inputs, tabs, and modal dialogs.
3. **Semantic HTML**:
   - Proper heading hierarchy (`h1`, `h2`, `h3`).
   - Aria attributes and SVG icons accompanied by descriptive labels.
4. **FCRA Statutory Disclaimers**:
   - Clear legal disclaimers stating that ZiroCredit is an AI-assisted evaluation tool, not legal counsel, and that consumers retain sole decision-making authority over dispute submissions.
