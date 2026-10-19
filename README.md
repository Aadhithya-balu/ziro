# ZiroCredit: AI Credit Report Error Dispute & Verification Assistant

[![Tests](https://img.shields.io/badge/Vitest-9%2F9%20Passing-emerald)](file:///c:/ziro/tests/unit.test.ts)
[![Next.js](https://img.shields.io/badge/Next.js-16%20(App%20Router)-black)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-CSS%20v4-38bdf8)](https://tailwindcss.com)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

> **ZiroCredit** is an autonomous AI agent for credit report auditing, statutory dispute generation, strict human-in-the-loop approval, idempotent mock bureau submission, and independent outcome reconciliation.

---

## 🌟 Key Highlights & Innovations

1. **Intelligent 3-Way Classification Engine**:
   - `POTENTIAL_ERROR`: Factual conflict between certified statements and reported trade-lines (e.g. TC1 unauthorized accounts).
   - `ACCURATE_NEGATIVE`: Corroborated negative entries that the consumer admits (e.g. TC2 30-day late payment). Frivolous disputes are suppressed to preserve credibility under FCRA § 623.
   - `UNCERTAIN`: Incomplete dates, missing account numbers, or lack of certified facts.
2. **Zero-Auto-Submit Security Guarantee**:
   - The agent strictly enforces human sign-off before any dispute can be transmitted to a credit bureau.
   - Version locking ensures that if a draft is edited (`v1 -> v2`), all prior approvals are automatically invalidated on the server.
3. **Mock Credit Bureau Portal**:
   - Deterministic, seeded local bureau portal (`mock://apex-bureau.local/v1`) supporting trade-line queries, idempotent dispute intake, and status transitions.
4. **Independent Outcome Verification**:
   - Does **not** assume a bureau status of `RESOLVED` means the error was actually corrected!
   - Re-downloads the live trade-line and compares it against the intended correction, exposing false resolutions (TC3).
5. **Interactive Test Lab**:
   - Execute all 4 official hackathon scenarios (TC1, TC2, TC3, TC4) directly from the UI or via Vitest with inspectable diffs and evidence.
6. **Append-Only Audit Ledger**:
   - Immutable event stream tracking state transitions, version bumps, approvals, and outcomes with sanitized payloads.

---

## 🚀 Quick Start Guide

### Prerequisites
- **Node.js**: v20+ or v24+ (Node 24 with native SQLite supported out of the box)
- **npm**: v10+

### Installation & Run

```bash
# 1. Clone repository
git clone https://github.com/Aadhithya-balu/ziro.git
cd ziro

# 2. Install dependencies
npm install --legacy-peer-deps

# 3. Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. The application will automatically seed realistic synthetic demonstration data on first launch!

---

## 🧪 Running the Test Suite

Execute the unit and scenario test suite covering classification, approvals, idempotency, verification, and all 4 official test cases:

```bash
npx vitest run
```

All 9 test assertions pass with 100% deterministic reproducibility:
- ✓ Classifies unauthorized account as `POTENTIAL_ERROR`
- ✓ Classifies verified late payment as `ACCURATE_NEGATIVE` and suppresses dispute
- ✓ Classifies unconfirmed facts or incomplete reports as `UNCERTAIN`
- ✓ Invalidates approval when draft is edited (`v1 -> v2`)
- ✓ Prevents duplicate dispute creation via idempotency keys
- ✓ TC1 (Loan user never took) verification
- ✓ TC2 (Accurate 30-day late payment) verification
- ✓ TC3 (Bureau marks resolved but report uncorrected) mismatch detection
- ✓ TC4 (Bureau requests ID upload) explicit user consent enforcement

---

## 📂 Project Directory Structure

```
c:\ziro\
├── data/
│   └── ziro_credit.db         # Persistent SQLite database
├── docs/
│   ├── ARCHITECTURE.md        # System architecture specification
│   ├── API.md                 # Complete REST API reference
│   ├── DEMO_GUIDE.md          # 5-minute live judge demonstration walkthrough
│   ├── LIMITATIONS.md         # Scope boundaries & security model
│   └── PRESENTATION.md        # Hackathon pitch outline
├── src/
│   ├── app/
│   │   ├── api/               # Validated Next.js App Router API endpoints
│   │   │   ├── audit/         # Audit stream query
│   │   │   ├── bureau/        # Mock bureau trade-line query
│   │   │   ├── cases/         # Case intake & detail management
│   │   │   │   └── [id]/      # Analyze, draft, approve, submit, verify, consent
│   │   │   ├── seed/          # Database reset & seed trigger
│   │   │   └── test-lab/      # Scenario runner & execution results
│   │   ├── globals.css        # Tailwind CSS styles
│   │   ├── layout.tsx         # Root layout with metadata
│   │   └── page.tsx           # Single-page dashboard application
│   ├── components/
│   │   ├── Navbar.tsx         # Modern fintech header with mode badges
│   │   ├── DashboardView.tsx  # KPI metrics & recent activity table
│   │   ├── IntakeView.tsx     # Credit report intake with 1-click test presets
│   │   ├── CaseDetailView.tsx # Workflow timeline, approval gate & verification
│   │   ├── TestLabView.tsx    # Interactive 4-scenario runner with diffs & logs
│   │   ├── BureauPortalView.tsx # Mock Credit Bureau registry inspector
│   │   └── AuditLogView.tsx   # Append-only compliance ledger
│   ├── lib/
│   │   ├── approval/          # Approval engine & version locking
│   │   ├── audit/             # Append-only audit logger
│   │   ├── bureau/            # Apex Mock Credit Bureau Portal
│   │   ├── classification/    # Deterministic engine & AI LLM adapter
│   │   ├── db/                # SQLite connection, schema & synthetic seed
│   │   ├── scenarios/         # TC1, TC2, TC3, TC4 scenario runner
│   │   └── verification/      # Independent outcome reconciliation engine
│   └── types/
│       ├── index.ts           # Strongly-typed domain interfaces
│       └── sqlite.d.ts        # Node:sqlite type declarations
├── tests/
│   └── unit.test.ts           # Vitest comprehensive test suite
├── .env.example               # Environment variables template
├── package.json
└── tsconfig.json
```

---

## 🛡️ Security & Ethical Guardrails

- **Synthetic Isolation**: Only interacts with the local `MockCreditBureauPortal`. Never connects to live credit bureau networks.
- **Anti-Hallucination Policy**: Never fabricates missing trade-line fields.
- **Explicit Consent for Documents**: In TC4 scenarios where the bureau requests government photo ID, the workflow halts and transmission is blocked until the consumer explicitly provides affirmative consent.
- **Append-Only Auditing**: Every decision, draft edit, approval, and verification diff is recorded in a tamper-evident audit ledger.
