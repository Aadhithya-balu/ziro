'use client';

import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Send,
  FileText,
  Edit3,
  ThumbsUp,
  ThumbsDown,
  RefreshCw,
  Sparkles,
  Lock,
  Search,
  Scale,
} from 'lucide-react';
import {
  CaseRecord,
  CreditReportRecord,
  EvidenceItem,
  ClassificationRecord,
  DisputeDraftRecord,
  ApprovalRecord,
  MockBureauDisputeRecord,
  VerificationResultRecord,
  AuditEventRecord,
} from '@/types';

interface CaseDetailViewProps {
  caseId: string;
  onBack: () => void;
  onRefreshData: () => void;
}

export function CaseDetailView({ caseId, onBack, onRefreshData }: CaseDetailViewProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Loaded case data
  const [caseRecord, setCaseRecord] = useState<CaseRecord | null>(null);
  const [report, setReport] = useState<CreditReportRecord | null>(null);
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [classification, setClassification] = useState<ClassificationRecord | null>(null);
  const [drafts, setDrafts] = useState<DisputeDraftRecord[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRecord[]>([]);
  const [bureauDispute, setBureauDispute] = useState<MockBureauDisputeRecord | null>(null);
  const [verification, setVerification] = useState<VerificationResultRecord | null>(null);
  const [auditEvents, setAuditEvents] = useState<AuditEventRecord[]>([]);

  // Action states
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Edit Draft Modal State
  const [isEditingDraft, setIsEditingDraft] = useState(false);
  const [editDisputedField, setEditDisputedField] = useState('');
  const [editExplanation, setEditExplanation] = useState('');
  const [editRequestedCorrection, setEditRequestedCorrection] = useState('');

  // ID Consent Modal State (TC4)
  const [idConsentDeclaration, setIdConsentDeclaration] = useState(
    'I explicitly authorize ZiroCredit to transmit my simulated state photo ID for FCRA § 605B identity verification.'
  );

  const fetchCaseDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/cases/${caseId}`);
      if (!res.ok) throw new Error('Failed to load case');
      const data = await res.json();

      setCaseRecord(data.case);
      setReport(data.report);
      setEvidence(data.evidence || []);
      setClassification(data.classification);
      setDrafts(data.drafts || []);
      setApprovals(data.approvals || []);
      setBureauDispute(data.bureauDispute);
      setVerification(data.verification);
      setAuditEvents(data.auditEvents || []);

      const latestDraft = (data.drafts || [])[0];
      if (latestDraft) {
        setEditDisputedField(latestDraft.disputedField);
        setEditExplanation(latestDraft.explanationOfDiscrepancy);
        setEditRequestedCorrection(latestDraft.requestedCorrection);
      }
    } catch (err: any) {
      setError(err.message || 'Error loading case details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCaseDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  const latestDraft = drafts[0] || null;

  // Actions
  const handleApproveDraft = async () => {
    if (!latestDraft) return;
    setActionLoading(true);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/cases/${caseId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draftVersion: latestDraft.version,
          action: 'APPROVED',
          reviewedBy: 'Authorized Consumer / Case Officer',
          notes: 'Explicit human approval certified on review screen.',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Approval failed');

      setActionMessage({ text: 'Draft successfully approved! You can now submit it to the bureau.', type: 'success' });
      await fetchCaseDetails();
      onRefreshData();
    } catch (err: any) {
      setActionMessage({ text: err.message, type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectDraft = async () => {
    if (!latestDraft) return;
    setActionLoading(true);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/cases/${caseId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draftVersion: latestDraft.version,
          action: 'REJECTED',
          reviewedBy: 'Authorized Consumer / Case Officer',
          notes: 'User declined proposed dispute draft.',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Rejection failed');

      setActionMessage({ text: 'Draft rejected. Dispute will not be submitted.', type: 'success' });
      await fetchCaseDetails();
      onRefreshData();
    } catch (err: any) {
      setActionMessage({ text: err.message, type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveDraftEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/cases/${caseId}/draft`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          disputedField: editDisputedField,
          explanationOfDiscrepancy: editExplanation,
          requestedCorrection: editRequestedCorrection,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Draft update failed');

      setIsEditingDraft(false);
      setActionMessage({
        text: `Draft updated to v${data.draft.version}! Notice: Prior approvals have been invalidated. Please re-review and approve.`,
        type: 'success',
      });
      await fetchCaseDetails();
      onRefreshData();
    } catch (err: any) {
      setActionMessage({ text: err.message, type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmitToBureau = async (simulateIdRequest: boolean = false) => {
    setActionLoading(true);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/cases/${caseId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ simulateIdRequest }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.reason || 'Submission failed');

      setActionMessage({
        text: `Dispute ${data.dispute.disputeId} lodged with Mock Bureau! Initial status: ${data.dispute.status}`,
        type: 'success',
      });
      await fetchCaseDetails();
      onRefreshData();
    } catch (err: any) {
      setActionMessage({ text: err.message, type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleAdvanceBureauStatus = async (newStatus: string) => {
    setActionLoading(true);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/cases/${caseId}/bureau-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newStatus,
          notes: `Simulated portal transition to ${newStatus}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Status update failed');

      setActionMessage({
        text: `Bureau status updated to ${newStatus}.`,
        type: 'success',
      });
      await fetchCaseDetails();
      onRefreshData();
    } catch (err: any) {
      setActionMessage({ text: err.message, type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRunVerification = async () => {
    setActionLoading(true);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/cases/${caseId}/verify`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Verification failed');

      setActionMessage({
        text: `Independent Outcome Verification Complete: ${data.verification.outcome}`,
        type: 'success',
      });
      await fetchCaseDetails();
      onRefreshData();
    } catch (err: any) {
      setActionMessage({ text: err.message, type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleProvideConsentForId = async () => {
    setActionLoading(true);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/cases/${caseId}/upload-consent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consentGiven: true,
          documentType: 'GOVERNMENT_PHOTO_ID',
          consumerDeclaration: idConsentDeclaration,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Consent recording failed');

      setActionMessage({
        text: 'Explicit consent recorded. Simulated ID transmitted securely to Mock Bureau. Workflow resumed to UNDER_REVIEW.',
        type: 'success',
      });
      await fetchCaseDetails();
      onRefreshData();
    } catch (err: any) {
      setActionMessage({ text: err.message, type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center space-y-3">
        <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin mx-auto" />
        <p className="text-sm text-slate-400">Loading case intelligence and audit trail...</p>
      </div>
    );
  }

  if (error || !caseRecord) {
    return (
      <div className="p-8 text-center space-y-4">
        <AlertTriangle className="w-10 h-10 text-rose-400 mx-auto" />
        <h2 className="text-lg font-bold text-white">Error Loading Case</h2>
        <p className="text-sm text-slate-400">{error || 'Case not found'}</p>
        <button
          onClick={onBack}
          className="px-4 py-2 rounded-lg bg-slate-800 text-slate-200 text-xs font-semibold hover:bg-slate-700"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fadeIn max-w-6xl mx-auto pb-12">
      {/* Top Bar with Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <button
          onClick={onBack}
          className="inline-flex items-center space-x-2 text-slate-400 hover:text-white text-xs font-semibold transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </button>

        <div className="flex items-center space-x-3">
          <span className="font-mono text-xs text-slate-400">Case ID:</span>
          <span className="font-mono text-xs font-bold text-indigo-300 px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-md">
            {caseRecord.id}
          </span>
          <span className="text-xs px-2.5 py-1 rounded-md font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
            {caseRecord.workflowStatus}
          </span>
        </div>
      </div>

      {/* Action Notification */}
      {actionMessage && (
        <div
          className={`p-4 rounded-xl text-xs font-medium flex items-center space-x-2 ${
            actionMessage.type === 'success'
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
          }`}
        >
          {actionMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          )}
          <span>{actionMessage.text}</span>
        </div>
      )}

      {/* Workflow Stepper */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">
          Autonomous Dispute & Audit Pipeline
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-slate-950 border border-indigo-500/40">
            <span className="block font-bold text-white">1. Ingestion</span>
            <span className="text-[11px] text-slate-400">Normalized & Certified</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-950 border border-indigo-500/40">
            <span className="block font-bold text-white">2. Evidence</span>
            <span className="text-[11px] text-slate-400">{evidence.length} Source Records</span>
          </div>
          <div className={`p-3 rounded-xl bg-slate-950 border ${classification ? 'border-amber-500/40' : 'border-slate-800'}`}>
            <span className="block font-bold text-white">3. Classification</span>
            <span className="text-[11px] text-amber-300 font-semibold">
              {classification?.classification || 'Pending'}
            </span>
          </div>
          <div className={`p-3 rounded-xl bg-slate-950 border ${latestDraft ? 'border-blue-500/40' : 'border-slate-800'}`}>
            <span className="block font-bold text-white">4. Dispute Draft</span>
            <span className="text-[11px] text-slate-400">
              {latestDraft ? `v${latestDraft.version} Formulated` : 'Not Applicable'}
            </span>
          </div>
          <div className={`p-3 rounded-xl bg-slate-950 border ${caseRecord.workflowStatus === 'APPROVED' ? 'border-emerald-500/40' : 'border-slate-800'}`}>
            <span className="block font-bold text-white">5. Human Sign-Off</span>
            <span className="text-[11px] text-slate-400">
              {approvals.length > 0 ? approvals[0].userAction : 'Required'}
            </span>
          </div>
          <div className={`p-3 rounded-xl bg-slate-950 border ${verification ? 'border-purple-500/40' : 'border-slate-800'}`}>
            <span className="block font-bold text-white">6. Outcome Audit</span>
            <span className="text-[11px] text-purple-300 font-semibold">
              {verification?.outcome || 'Pending Bureau'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid: Left Column (Trade-Line Details & Classification), Right Column (Draft, Approval, Bureau, Verification) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Trade-Line Summary */}
          {report && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                  <FileText className="w-4 h-4 text-indigo-400" />
                  <span>Reported Trade-Line Record</span>
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                  {report.sourceReportRef}
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">Creditor:</span>
                  <span className="font-bold text-white">{report.creditorName}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">Account Reference:</span>
                  <span className="font-mono text-indigo-300">{report.accountReference}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">Account Type:</span>
                  <span className="text-slate-200">{report.accountType}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">Reported Balance:</span>
                  <span className="font-bold text-emerald-400">${report.reportedBalance.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">Payment Status:</span>
                  <span className="font-semibold text-amber-300">{report.paymentStatus}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">Payment History:</span>
                  <span className="font-mono text-slate-300">{report.paymentHistory}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">Reported Date:</span>
                  <span className="text-slate-300">{report.reportedDate}</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                  Certified Consumer Statement
                </span>
                <p className="text-xs text-slate-300 italic">"{report.userConfirmedFacts}"</p>
              </div>
            </div>
          )}

          {/* Classification Reasoning */}
          {classification && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                  <Scale className="w-4 h-4 text-amber-400" />
                  <span>Deterministic Classification</span>
                </h3>
                <span className="text-xs font-extrabold px-2.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {classification.classification}
                </span>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed bg-slate-950 p-3 rounded-xl border border-slate-800">
                {classification.reasoningSummary}
              </p>

              {/* Supporting Facts */}
              {classification.supportingFacts.length > 0 && (
                <div className="space-y-1">
                  <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
                    Supporting Evidentiary Facts
                  </span>
                  <ul className="text-xs space-y-1 text-slate-300 list-disc list-inside">
                    {classification.supportingFacts.map((fact, idx) => (
                      <li key={idx} className="leading-tight">{fact}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Missing Information */}
              {classification.missingInformation.length > 0 && (
                <div className="space-y-1 pt-2 border-t border-slate-800">
                  <span className="text-[11px] font-bold text-rose-400 uppercase tracking-wider">
                    Missing Information Required
                  </span>
                  <ul className="text-xs space-y-1 text-slate-300 list-disc list-inside">
                    {classification.missingInformation.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Recommended Next Step */}
              <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-500/30 text-xs text-indigo-200">
                <span className="font-bold block text-white mb-0.5">Recommended Statutory Procedure:</span>
                {classification.recommendedNextStep}
              </div>
            </div>
          )}

          {/* Evidence Items */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center justify-between">
              <span>Authoritative Evidence Chain</span>
              <span className="text-xs text-slate-400">{evidence.length} items</span>
            </h3>
            {evidence.length === 0 ? (
              <p className="text-xs text-slate-500">No external evidence linked.</p>
            ) : (
              evidence.map((evi) => (
                <div key={evi.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-200">{evi.label}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20">
                      {evi.verificationStatus}
                    </span>
                  </div>
                  <p className="text-slate-400 text-[11px]">{evi.details}</p>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 font-mono">
                    <span>{evi.sourceName}</span>
                    <span>Ref: {evi.mockSourceRecordId}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Dispute Draft Card */}
          {latestDraft ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-800">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center space-x-2">
                    <Edit3 className="w-4 h-4 text-indigo-400" />
                    <span>Proposed Dispute Draft</span>
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-semibold">
                      v{latestDraft.version}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Governed by FCRA § 611 (15 U.S.C. § 1681i). Edits increment version and invalidate approvals.
                  </p>
                </div>

                <button
                  onClick={() => setIsEditingDraft(true)}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 text-xs font-medium border border-slate-700 transition"
                >
                  <Edit3 className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Edit Draft</span>
                </button>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <span className="font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Disputed Subject / Field
                  </span>
                  <div className="p-2.5 rounded-lg bg-slate-950 font-medium text-slate-200 border border-slate-800">
                    {latestDraft.disputedField}
                  </div>
                </div>

                <div>
                  <span className="font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Formal Discrepancy Notice & Statutory Basis
                  </span>
                  <div className="p-3 rounded-lg bg-slate-950 font-mono text-[11px] text-slate-300 border border-slate-800 whitespace-pre-wrap leading-relaxed">
                    {latestDraft.explanationOfDiscrepancy}
                  </div>
                </div>

                <div>
                  <span className="font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Requested Statutory Remedy
                  </span>
                  <div className="p-2.5 rounded-lg bg-slate-950 font-medium text-indigo-300 border border-slate-800">
                    {latestDraft.requestedCorrection}
                  </div>
                </div>
              </div>

              {/* HUMAN APPROVAL ACTION PANEL */}
              <div className="pt-4 border-t border-slate-800">
                <div className="p-4 rounded-xl bg-slate-950 border border-purple-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-purple-300 flex items-center space-x-1.5">
                      <Lock className="w-4 h-4 text-purple-400" />
                      <span>Dedicated Human Approval Gateway</span>
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">
                      Target: mock://apex-bureau.local/v1
                    </span>
                  </div>

                  <p className="text-xs text-slate-300">
                    Per security mandate, ZiroCredit will <span className="font-bold text-white">never submit a dispute automatically</span>. An authorized user must explicitly approve draft <span className="font-bold text-indigo-300">v{latestDraft.version}</span>.
                  </p>

                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <button
                      onClick={handleApproveDraft}
                      disabled={actionLoading}
                      className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition disabled:opacity-50"
                    >
                      <ThumbsUp className="w-3.5 h-3.5" />
                      <span>Approve Draft v{latestDraft.version}</span>
                    </button>

                    <button
                      onClick={() => handleSubmitToBureau(false)}
                      disabled={actionLoading || caseRecord.workflowStatus !== 'APPROVED'}
                      className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Submit Approved Dispute to Bureau</span>
                    </button>

                    <button
                      onClick={handleRejectDraft}
                      disabled={actionLoading}
                      className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-rose-950/40 text-slate-300 hover:text-rose-300 border border-slate-700 text-xs font-medium transition"
                    >
                      <ThumbsDown className="w-3.5 h-3.5" />
                      <span>Reject Draft</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <h3 className="text-base font-bold text-white">No Dispute Draft Generated</h3>
              <p className="text-xs text-slate-400">
                {classification?.classification === 'ACCURATE_NEGATIVE'
                  ? 'This record was evaluated as ACCURATE_NEGATIVE. Disputing verified accurate negative information merely because it lowers credit score is prohibited under FCRA § 623 and diminishes dispute credibility. The agent appropriately withheld draft generation.'
                  : 'A dispute draft can only be formulated for cases with a POTENTIAL_ERROR classification.'}
              </p>
            </div>
          )}

          {/* TC4 Consent Gateway Banner (When status is ADDITIONAL_INFORMATION_REQUIRED) */}
          {caseRecord.workflowStatus === 'ADDITIONAL_INFORMATION_REQUIRED' && (
            <div className="bg-gradient-to-r from-amber-950/60 via-slate-900 to-amber-950/60 border border-amber-500/50 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex items-center space-x-2 text-amber-400">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <h4 className="font-bold text-sm text-white">
                  Bureau Action Paused: Identity Verification Required (TC4 Protocol)
                </h4>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                The Mock Bureau has issued an identity request under FCRA § 605B / Rule 402. System security rules mandate that <span className="font-bold text-white">no identity documentation can be transmitted without explicit affirmative consumer consent</span>.
              </p>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300">
                <label className="font-semibold block text-slate-400 mb-1">Consumer Consent Declaration:</label>
                <input
                  type="text"
                  value={idConsentDeclaration}
                  onChange={(e) => setIdConsentDeclaration(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 text-xs focus:outline-none"
                />
              </div>
              <button
                onClick={handleProvideConsentForId}
                disabled={actionLoading}
                className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-md transition"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Grant Explicit Consent & Transmit Simulated ID</span>
              </button>
            </div>
          )}

          {/* Mock Bureau Status Tracking & Simulation Controls */}
          {bureauDispute && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center space-x-2">
                    <Send className="w-4 h-4 text-cyan-400" />
                    <span>Mock Credit Bureau Status Tracker</span>
                  </h4>
                  <span className="font-mono text-xs text-cyan-300">
                    Dispute ID: {bureauDispute.id}
                  </span>
                </div>
                <span className="text-xs font-bold px-2.5 py-1 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                  {bureauDispute.currentStatus}
                </span>
              </div>

              {/* Bureau Status Simulator Buttons */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Bureau Response Simulator (Hackathon Testing)
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleAdvanceBureauStatus('UNDER_REVIEW')}
                    disabled={actionLoading}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700"
                  >
                    Set: Under Review
                  </button>
                  <button
                    onClick={() => handleAdvanceBureauStatus('RESOLVED')}
                    disabled={actionLoading}
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 text-xs font-medium border border-emerald-500/30"
                  >
                    Set: Resolved (Bureau Closes Dispute)
                  </button>
                  <button
                    onClick={() => handleAdvanceBureauStatus('ADDITIONAL_INFORMATION_REQUIRED')}
                    disabled={actionLoading}
                    className="px-2.5 py-1.5 rounded-lg bg-amber-950/60 hover:bg-amber-900/60 text-amber-300 text-xs font-medium border border-amber-500/30"
                  >
                    Simulate: ID Required
                  </button>
                </div>
              </div>

              {/* INDEPENDENT OUTCOME VERIFICATION TRIGGER */}
              <div className="pt-2">
                <div className="p-4 rounded-xl bg-purple-950/30 border border-purple-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-purple-300 flex items-center space-x-1.5">
                      <Sparkles className="w-4 h-4 text-purple-400" />
                      <span>Independent Outcome Verification</span>
                    </span>
                    <span className="text-[11px] text-slate-400">Re-downloads Trade-Line</span>
                  </div>

                  <p className="text-xs text-slate-300">
                    Never trust bureau resolution flags alone. ZiroCredit re-downloads the official trade-line from the bureau portal to verify if the reported entry was actually deleted or corrected.
                  </p>

                  <button
                    onClick={handleRunVerification}
                    disabled={actionLoading}
                    className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md transition"
                  >
                    <Search className="w-3.5 h-3.5" />
                    <span>Run Independent Re-Download Audit</span>
                  </button>
                </div>
              </div>

              {/* Verification Results Display */}
              {verification && (
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300">Independent Audit Outcome</span>
                    <span
                      className={`text-xs font-extrabold px-2.5 py-0.5 rounded border ${
                        verification.outcome === 'VERIFIED_CORRECTION'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          : verification.outcome === 'NOT_CORRECTED'
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                          : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      }`}
                    >
                      {verification.outcome}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">{verification.explanation}</p>

                  <div className="p-2.5 rounded bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-300">
                    <span className="text-slate-400 block mb-0.5">Comparison Audit Details:</span>
                    {verification.comparisonDetails}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Audit Events Accordion */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Immutable Audit Events ({auditEvents.length})
            </h4>
            <div className="max-h-56 overflow-y-auto space-y-2 pr-1 divide-y divide-slate-800/60">
              {auditEvents.map((evt) => (
                <div key={evt.id} className="pt-2 text-xs space-y-0.5">
                  <div className="flex items-center justify-between font-mono text-[10px] text-slate-400">
                    <span className="text-indigo-300 font-bold">{evt.eventType}</span>
                    <span>{new Date(evt.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <p className="text-slate-300 text-[11px]">{evt.actionResult}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Draft Modal */}
      {isEditingDraft && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <Edit3 className="w-4 h-4 text-indigo-400" />
                <span>Edit Dispute Draft</span>
              </h3>
              <span className="text-xs text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded border border-amber-500/20 font-medium">
                Will Invalidate Existing Approvals
              </span>
            </div>

            <form onSubmit={handleSaveDraftEdit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 font-bold uppercase mb-1">Disputed Field</label>
                <input
                  type="text"
                  required
                  value={editDisputedField}
                  onChange={(e) => setEditDisputedField(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold uppercase mb-1">
                  Discrepancy Explanation & Evidence
                </label>
                <textarea
                  rows={4}
                  required
                  value={editExplanation}
                  onChange={(e) => setEditExplanation(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 font-mono text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold uppercase mb-1">Requested Correction</label>
                <input
                  type="text"
                  required
                  value={editRequestedCorrection}
                  onChange={(e) => setEditRequestedCorrection(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditingDraft(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md"
                >
                  Save as New Version & Invalidate Approvals
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
