'use client';

import React, { useState, useEffect } from 'react';
import {
  Building2,
  Search,
  Database,
  RefreshCw,
  ShieldCheck,
  FileCheck2,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Layers,
  Lock,
} from 'lucide-react';
import { MockBureauAccount } from '@/lib/bureau/mock-portal';

interface MockDisputeItem {
  id: string;
  caseId: string;
  approvedDraftVersion: number;
  approvalId: string;
  mockPortalReference: string;
  idempotencyKey: string;
  submissionTimestamp: string;
  submissionResponse: Record<string, unknown>;
  currentStatus: string;
  verificationStatus: string;
  idRequestReason?: string;
  lastBureauUpdateTimestamp: string;
  clientName?: string;
  accountReference?: string;
  issueType?: string;
  consentGivenForIdUpload?: boolean;
}

export function BureauPortalView() {
  const [activeTab, setActiveTab] = useState<'disputes' | 'registry'>('disputes');
  const [accounts, setAccounts] = useState<MockBureauAccount[]>([]);
  const [disputes, setDisputes] = useState<MockDisputeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter state for Accounts
  const [searchTerm, setSearchTerm] = useState('');
  const [searchedAccount, setSearchedAccount] = useState<MockBureauAccount | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Filter for disputes
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Selected Dispute for Inspector Drawer / Modal
  const [selectedDispute, setSelectedDispute] = useState<MockDisputeItem | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  // Transition testing state
  const [transitioningStatus, setTransitioningStatus] = useState(false);
  const [targetStatus, setTargetStatus] = useState<string>('RESOLVED');

  // Consent testing state
  const [consentDeclaration, setConsentDeclaration] = useState(
    'I affirmatively consent to transmit my government identification to Apex Mock Bureau solely for dispute processing.'
  );
  const [documentType, setDocumentType] = useState('GOVERNMENT_PHOTO_ID');
  const [submittingConsent, setSubmittingConsent] = useState(false);
  const [consentMessage, setConsentMessage] = useState<string | null>(null);

  const fetchBureauData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/bureau');
      if (!res.ok) throw new Error('Failed to fetch mock bureau data');
      const data = await res.json();
      setAccounts(data.accounts || []);
      setDisputes(data.disputes || []);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error loading bureau data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBureauData();
  }, []);

  const handleAccountSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) {
      setSearchedAccount(null);
      setSearchError(null);
      return;
    }
    setSearchError(null);
    setSearchedAccount(null);

    try {
      const res = await fetch(`/api/bureau?accountRef=${encodeURIComponent(searchTerm.trim())}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Account not found');
      setSearchedAccount(data.account);
    } catch (err: any) {
      setSearchError(err.message || 'Account not located in mock registry');
    }
  };

  const runVerification = async (caseId: string) => {
    try {
      setVerifying(true);
      setVerificationError(null);
      setVerificationResult(null);

      const res = await fetch(`/api/cases/${caseId}/verify`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Verification request failed');

      setVerificationResult(data.verification);
      await fetchBureauData();
    } catch (err: any) {
      setVerificationError(err.message || 'Failed to complete independent verification');
    } finally {
      setVerifying(false);
    }
  };

  const updateBureauStatus = async (caseId: string, newStatus: string) => {
    try {
      setTransitioningStatus(true);
      const res = await fetch(`/api/cases/${caseId}/bureau-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newStatus, notes: `Simulated status transition to ${newStatus}` }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update bureau status');

      await fetchBureauData();
      if (selectedDispute && selectedDispute.caseId === caseId) {
        setSelectedDispute({ ...selectedDispute, currentStatus: newStatus });
      }
    } catch (err: any) {
      alert(`Error updating status: ${err.message}`);
    } finally {
      setTransitioningStatus(false);
    }
  };

  const grantConsent = async (caseId: string, consentGiven: boolean) => {
    try {
      setSubmittingConsent(true);
      setConsentMessage(null);

      const res = await fetch(`/api/cases/${caseId}/upload-consent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consentGiven,
          documentType,
          consumerDeclaration: consentDeclaration,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Consent processing failed');
      }

      setConsentMessage(data.message || 'Consent successfully recorded and workflow resumed.');
      await fetchBureauData();
      if (selectedDispute && selectedDispute.caseId === caseId) {
        setSelectedDispute({
          ...selectedDispute,
          currentStatus: data.workflowStatus || 'UNDER_REVIEW',
          consentGivenForIdUpload: consentGiven,
        });
      }
    } catch (err: any) {
      setConsentMessage(`Blocked: ${err.message}`);
    } finally {
      setSubmittingConsent(false);
    }
  };

  const filteredDisputes = disputes.filter((d) => {
    if (statusFilter === 'ALL') return true;
    return d.currentStatus === statusFilter;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SUBMITTED':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'UNDER_REVIEW':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'ADDITIONAL_INFORMATION_REQUIRED':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      case 'RESOLVED':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      case 'REJECTED':
      case 'FAILED':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
      default:
        return 'bg-slate-700/50 text-slate-300 border-slate-600/50';
    }
  };

  const getVerificationColor = (outcome: string) => {
    switch (outcome) {
      case 'VERIFIED_CORRECTION':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      case 'NOT_CORRECTED':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/30 animate-pulse';
      case 'INCONCLUSIVE':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn max-w-6xl mx-auto pb-16">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-cyan-950/40 to-slate-900 border border-cyan-500/30 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 mb-2 flex-wrap gap-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              SIMULATED REPOSITORY
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center space-x-1">
              <ShieldCheck className="w-3 h-3" />
              <span>ISOLATED MOCK PORTAL</span>
            </span>
            <span className="text-xs text-slate-400 font-mono">mock://apex-bureau.local/v1</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center space-x-2">
            <Building2 className="w-7 h-7 text-cyan-400" />
            <span>Apex Mock Credit Bureau Portal</span>
          </h1>
          <p className="text-sm text-slate-300 max-w-2xl mt-1">
            Inspect simulated credit bureau trade-lines, review incoming dispute submissions, verify idempotent dispatch, manage KYC ID consent barriers (TC4), and audit independent report verification results (TC3).
          </p>
        </div>

        <button
          onClick={fetchBureauData}
          disabled={loading}
          className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold shadow transition self-start md:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Bureau State</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold">
          {error}
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl shadow">
          <span className="text-slate-400 text-xs block mb-1 flex items-center space-x-1">
            <Database className="w-3.5 h-3.5 text-cyan-400" />
            <span>Seeded Trade-Lines</span>
          </span>
          <span className="text-2xl font-extrabold text-white">{accounts.length}</span>
          <span className="text-[10px] text-slate-500 block mt-0.5">Authoritative bureau core</span>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl shadow">
          <span className="text-slate-400 text-xs block mb-1 flex items-center space-x-1">
            <Layers className="w-3.5 h-3.5 text-blue-400" />
            <span>Lodged Disputes</span>
          </span>
          <span className="text-2xl font-extrabold text-blue-400">{disputes.length}</span>
          <span className="text-[10px] text-slate-500 block mt-0.5">Idempotently tracked</span>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl shadow">
          <span className="text-slate-400 text-xs block mb-1 flex items-center space-x-1">
            <Lock className="w-3.5 h-3.5 text-purple-400" />
            <span>ID Verification Paused</span>
          </span>
          <span className="text-2xl font-extrabold text-purple-400">
            {disputes.filter((d) => d.currentStatus === 'ADDITIONAL_INFORMATION_REQUIRED').length}
          </span>
          <span className="text-[10px] text-slate-500 block mt-0.5">TC4 consent mandated</span>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl shadow">
          <span className="text-slate-400 text-xs block mb-1 flex items-center space-x-1">
            <FileCheck2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Re-Audit Verifications</span>
          </span>
          <span className="text-2xl font-extrabold text-emerald-400">
            {disputes.filter((d) => d.verificationStatus && d.verificationStatus !== 'PENDING').length}
          </span>
          <span className="text-[10px] text-slate-500 block mt-0.5">TC3 independent audits</span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-800 space-x-2">
        <button
          onClick={() => setActiveTab('disputes')}
          className={`px-5 py-3 text-xs font-bold uppercase tracking-wider flex items-center space-x-2 border-b-2 transition ${
            activeTab === 'disputes'
              ? 'border-cyan-500 text-cyan-400 bg-cyan-950/20'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Dispute Ingestion Queue ({disputes.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('registry')}
          className={`px-5 py-3 text-xs font-bold uppercase tracking-wider flex items-center space-x-2 border-b-2 transition ${
            activeTab === 'registry'
              ? 'border-cyan-500 text-cyan-400 bg-cyan-950/20'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>Trade-Line Core Registry ({accounts.length})</span>
        </button>
      </div>

      {/* TAB 1: DISPUTES QUEUE */}
      {activeTab === 'disputes' && (
        <div className="space-y-6">
          {/* Filter Bar */}
          <div className="flex items-center justify-between flex-wrap gap-3 bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow">
            <div className="flex items-center space-x-2 flex-wrap gap-y-1">
              <span className="text-xs text-slate-400 font-semibold mr-1">Filter Status:</span>
              {['ALL', 'SUBMITTED', 'UNDER_REVIEW', 'ADDITIONAL_INFORMATION_REQUIRED', 'RESOLVED', 'REJECTED'].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition ${
                    statusFilter === st
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800'
                  }`}
                >
                  {st.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
            <span className="text-xs text-slate-400">{filteredDisputes.length} records shown</span>
          </div>

          {/* Disputes Table or Empty State */}
          {loading ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 text-xs">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-cyan-400" />
              Loading mock bureau submissions...
            </div>
          ) : filteredDisputes.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 text-xs space-y-2">
              <Layers className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="font-semibold text-slate-300">No Mock Bureau Disputes Found</p>
              <p className="max-w-md mx-auto text-slate-500">
                Disputes submitted via the case detail approval gateway will appear here with idempotency keys and mock tracking references.
              </p>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="bg-slate-950/70 text-[11px] uppercase font-bold text-slate-400 tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="px-5 py-3.5">Dispute Tracking ID</th>
                      <th className="px-5 py-3.5">Case Reference</th>
                      <th className="px-5 py-3.5">Consumer / Account</th>
                      <th className="px-5 py-3.5">Bureau Status</th>
                      <th className="px-5 py-3.5">ID Consent (TC4)</th>
                      <th className="px-5 py-3.5">Outcome Audit (TC3)</th>
                      <th className="px-5 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 text-xs">
                    {filteredDisputes.map((disp) => (
                      <tr
                        key={disp.id}
                        className={`hover:bg-slate-800/50 cursor-pointer transition ${
                          selectedDispute?.id === disp.id ? 'bg-cyan-950/30' : ''
                        }`}
                        onClick={() => {
                          setSelectedDispute(disp);
                          setVerificationResult(null);
                          setVerificationError(null);
                          setConsentMessage(null);
                        }}
                      >
                        <td className="px-5 py-3.5 font-mono text-cyan-300 font-bold">
                          {disp.id}
                        </td>
                        <td className="px-5 py-3.5 font-mono text-slate-300">
                          {disp.caseId} <span className="text-[10px] text-slate-500 block">v{disp.approvedDraftVersion}</span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="font-semibold text-white block">{disp.clientName || 'Synthetic Consumer'}</span>
                          <span className="font-mono text-[10px] text-slate-400">{disp.accountReference || 'ACC-REF'}</span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getStatusColor(disp.currentStatus)}`}>
                            {disp.currentStatus.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          {disp.currentStatus === 'ADDITIONAL_INFORMATION_REQUIRED' ? (
                            disp.consentGivenForIdUpload ? (
                              <span className="text-emerald-400 flex items-center space-x-1 text-[11px] font-semibold">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Consent Granted</span>
                              </span>
                            ) : (
                              <span className="text-purple-400 flex items-center space-x-1 text-[11px] font-bold animate-pulse">
                                <Lock className="w-3.5 h-3.5" />
                                <span>Consent Required</span>
                              </span>
                            )
                          ) : (
                            <span className="text-slate-500 text-[11px]">Not Required</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getVerificationColor(disp.verificationStatus)}`}>
                            {disp.verificationStatus.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDispute(disp);
                              setVerificationResult(null);
                              setVerificationError(null);
                              setConsentMessage(null);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 inline-flex items-center space-x-1"
                          >
                            <span>Inspect</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* INSPECTOR DRAWER / MODAL FOR SELECTED DISPUTE */}
          {selectedDispute && (
            <div className="bg-slate-900 border-2 border-cyan-500/40 rounded-2xl p-6 shadow-2xl space-y-6 animate-fadeIn">
              <div className="flex items-start justify-between flex-wrap gap-4 border-b border-slate-800 pb-4">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-mono font-bold text-cyan-400">{selectedDispute.id}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getStatusColor(selectedDispute.currentStatus)}`}>
                      {selectedDispute.currentStatus.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-white mt-1">Dispute Submission & Outcome Audit Console</h3>
                  <p className="text-xs text-slate-400">
                    Case: <span className="font-mono text-slate-300 font-bold">{selectedDispute.caseId}</span> | Draft Version: <span className="font-mono text-slate-300">v{selectedDispute.approvedDraftVersion}</span> | Idempotency Key: <span className="font-mono text-cyan-300">{selectedDispute.idempotencyKey}</span>
                  </p>
                </div>

                <button
                  onClick={() => setSelectedDispute(null)}
                  className="px-3 py-1 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
                >
                  Close Console
                </button>
              </div>

              {/* Grid: Workflow State & Controls */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Column A: Bureau Status & Transition Simulator */}
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-4">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                    <Building2 className="w-4 h-4 text-cyan-400" />
                    <span>Bureau Workflow State Controller</span>
                  </h4>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-800/80">
                      <span className="text-slate-400">Portal Endpoint:</span>
                      <span className="font-mono text-slate-300 text-[11px]">{selectedDispute.mockPortalReference}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800/80">
                      <span className="text-slate-400">Submitted Timestamp:</span>
                      <span className="font-mono text-slate-300 text-[11px]">{selectedDispute.submissionTimestamp}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800/80">
                      <span className="text-slate-400">Verification Outcome:</span>
                      <span className={`font-bold px-2 py-0.5 rounded text-[10px] border ${getVerificationColor(selectedDispute.verificationStatus)}`}>
                        {selectedDispute.verificationStatus}
                      </span>
                    </div>
                  </div>

                  {/* Simulate Status Transition */}
                  <div className="pt-2 border-t border-slate-800 space-y-2">
                    <label className="text-[11px] font-bold text-slate-300 block">
                      Simulate Bureau Status Transition (Testing Tool):
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={targetStatus}
                        onChange={(e) => setTargetStatus(e.target.value)}
                        className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500"
                      >
                        <option value="UNDER_REVIEW">UNDER_REVIEW</option>
                        <option value="ADDITIONAL_INFORMATION_REQUIRED">ADDITIONAL_INFORMATION_REQUIRED</option>
                        <option value="RESOLVED">RESOLVED (Test False Resolution)</option>
                        <option value="REJECTED">REJECTED</option>
                      </select>
                      <button
                        onClick={() => updateBureauStatus(selectedDispute.caseId, targetStatus)}
                        disabled={transitioningStatus}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg text-xs font-bold text-cyan-300 transition"
                      >
                        {transitioningStatus ? 'Updating...' : 'Update Status'}
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-500">
                      Note: Marking status as RESOLVED allows testing TC3: verifying that RESOLVED does not equal verified correction without an independent report audit.
                    </p>
                  </div>
                </div>

                {/* Column B: TC4 KYC ID Consent Barrier */}
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-4">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                    <Lock className="w-4 h-4 text-purple-400" />
                    <span>TC4 Identification Consent Barrier</span>
                  </h4>

                  {selectedDispute.idRequestReason ? (
                    <div className="p-3 bg-purple-950/30 border border-purple-500/30 rounded-lg text-xs text-purple-200 space-y-1">
                      <span className="font-bold text-[11px] block text-purple-300">Bureau Statutory Request:</span>
                      <p className="text-[11px] text-purple-300/90">{selectedDispute.idRequestReason}</p>
                    </div>
                  ) : (
                    <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-400">
                      No identification documentation requested for this dispute.
                    </div>
                  )}

                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Affirmative Consent State:</span>
                      {selectedDispute.consentGivenForIdUpload ? (
                        <span className="text-emerald-400 font-bold flex items-center space-x-1">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>CONSENT GRANTED</span>
                        </span>
                      ) : (
                        <span className="text-rose-400 font-bold flex items-center space-x-1">
                          <XCircle className="w-4 h-4" />
                          <span>BLOCKED / PENDING CONSENT</span>
                        </span>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="text-[11px] font-semibold text-slate-300 block">
                        Identification Document Type:
                      </label>
                      <select
                        value={documentType}
                        onChange={(e) => setDocumentType(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-purple-500"
                      >
                        <option value="GOVERNMENT_PHOTO_ID">Government Photo ID (Driver's License / State ID)</option>
                        <option value="UTILITY_BILL">Proof of Address (Utility Bill / Lease)</option>
                        <option value="PASSPORT">Passport (FCRA § 605B Identity Document)</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[11px] font-semibold text-slate-300 block">
                        Consumer Declaration (Mandated Affirmative Consent):
                      </label>
                      <textarea
                        value={consentDeclaration}
                        onChange={(e) => setConsentDeclaration(e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-purple-500"
                      />
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => grantConsent(selectedDispute.caseId, true)}
                        disabled={submittingConsent}
                        className="flex-1 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-lg shadow transition"
                      >
                        {submittingConsent ? 'Recording...' : 'Grant Affirmative Consent'}
                      </button>

                      <button
                        onClick={() => grantConsent(selectedDispute.caseId, false)}
                        disabled={submittingConsent}
                        className="px-3 py-2 bg-rose-950/50 hover:bg-rose-900/60 border border-rose-500/40 text-rose-300 text-xs font-semibold rounded-lg transition"
                      >
                        Decline Consent
                      </button>
                    </div>

                    {consentMessage && (
                      <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-slate-300">
                        {consentMessage}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Section C: Independent Outcome Verification (TC3) */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                    <FileCheck2 className="w-4 h-4 text-emerald-400" />
                    <span>TC3 Independent Outcome Verification (Re-Download Audit)</span>
                  </h4>

                  <button
                    onClick={() => runVerification(selectedDispute.caseId)}
                    disabled={verifying}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg transition flex items-center space-x-1.5"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${verifying ? 'animate-spin' : ''}`} />
                    <span>{verifying ? 'Auditing Fresh Report...' : 'Re-Download & Run Independent Verification'}</span>
                  </button>
                </div>

                <p className="text-xs text-slate-400">
                  Strict Rule: Bureau status `RESOLVED` does NOT equal verified correction. Independent verification retrieves a fresh report trade-line and audits whether the intended deletion, balance, or status correction truly took effect.
                </p>

                {verificationError && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs">
                    {verificationError}
                  </div>
                )}

                {verificationResult && (
                  <div className={`p-4 rounded-xl border space-y-3 ${
                    verificationResult.outcome === 'VERIFIED_CORRECTION'
                      ? 'bg-emerald-950/20 border-emerald-500/40'
                      : verificationResult.outcome === 'NOT_CORRECTED'
                      ? 'bg-rose-950/30 border-rose-500/50'
                      : 'bg-amber-950/20 border-amber-500/40'
                  }`}>
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-extrabold border ${getVerificationColor(verificationResult.outcome)}`}>
                        OUTCOME: {verificationResult.outcome}
                      </span>
                      <span className="text-[11px] font-mono text-slate-400">
                        Audit Timestamp: {verificationResult.verifiedTimestamp}
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs">
                      <p className="text-white font-bold">{verificationResult.explanation}</p>
                      <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 text-[11px] font-mono space-y-1">
                        <div>
                          <span className="text-slate-400">Target Field: </span>
                          <span className="text-cyan-300 font-semibold">{verificationResult.targetField}</span>
                        </div>
                        <div>
                          <span className="text-slate-400">Original Value: </span>
                          <span className="text-slate-200">{verificationResult.originalReportedValue}</span>
                        </div>
                        <div>
                          <span className="text-slate-400">Fresh Bureau Record: </span>
                          <span className="text-amber-300 font-semibold">{verificationResult.latestObservedValue}</span>
                        </div>
                        <div>
                          <span className="text-slate-400">Intended Correction: </span>
                          <span className="text-emerald-300">{verificationResult.intendedCorrection}</span>
                        </div>
                        <div>
                          <span className="text-slate-400">Audit Comparison Details: </span>
                          <span className="text-slate-300">{verificationResult.comparisonDetails}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: TRADE-LINE REGISTRY */}
      {activeTab === 'registry' && (
        <div className="space-y-6">
          {/* Account Query Search */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <Search className="w-4 h-4 text-cyan-400" />
              <span>Mock Bureau Trade-Line Query</span>
            </h3>

            <form onSubmit={handleAccountSearch} className="flex gap-3">
              <input
                type="text"
                placeholder="Search by Account Reference (e.g. ACC-9821-AUTO, ACC-5510-CARD, ACC-3312-COLLECT)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl font-mono text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
              />
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-md transition"
              >
                Query Registry
              </button>
            </form>

            {searchError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                {searchError}
              </div>
            )}

            {searchedAccount && (
              <div className="p-4 rounded-xl bg-slate-950 border border-cyan-500/30 space-y-2 text-xs animate-fadeIn">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-sm">{searchedAccount.creditorName}</span>
                  <span className="font-mono text-cyan-300 font-semibold">{searchedAccount.accountReference}</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-slate-300">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Consumer Name:</span>
                    <span>{searchedAccount.consumerName}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">SSN Last 4:</span>
                    <span className="font-mono">{searchedAccount.consumerSsnLast4}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Reported Balance:</span>
                    <span className="font-bold text-emerald-400">${searchedAccount.balance.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Payment Status:</span>
                    <span className="font-semibold text-amber-300">{searchedAccount.paymentStatus}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Bureau Accounts Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <Database className="w-4 h-4 text-cyan-400" />
                <span>Authoritative Seeded Accounts in Bureau Core</span>
              </h3>
              <span className="text-xs text-slate-400">{accounts.length} active records</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950/60 text-xs uppercase font-semibold text-slate-400 tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="px-5 py-3.5">Account Ref</th>
                    <th className="px-5 py-3.5">Creditor</th>
                    <th className="px-5 py-3.5">Consumer</th>
                    <th className="px-5 py-3.5">SSN4</th>
                    <th className="px-5 py-3.5">Type</th>
                    <th className="px-5 py-3.5">Balance</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5">Reported</th>
                    <th className="px-5 py-3.5">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 text-xs">
                  {accounts.map((acc) => (
                    <tr key={acc.accountReference} className="hover:bg-slate-800/40">
                      <td className="px-5 py-3.5 font-mono text-cyan-300 font-semibold">
                        {acc.accountReference}
                      </td>
                      <td className="px-5 py-3.5 font-bold text-white">{acc.creditorName}</td>
                      <td className="px-5 py-3.5 text-slate-300">{acc.consumerName}</td>
                      <td className="px-5 py-3.5 font-mono text-slate-400">***-**-{acc.consumerSsnLast4}</td>
                      <td className="px-5 py-3.5 text-slate-400">{acc.accountType}</td>
                      <td className="px-5 py-3.5 font-bold text-emerald-400">${acc.balance.toLocaleString()}</td>
                      <td className="px-5 py-3.5 font-semibold text-amber-300">{acc.paymentStatus}</td>
                      <td className="px-5 py-3.5 font-mono text-slate-400">{acc.reportedDate}</td>
                      <td className="px-5 py-3.5 text-[11px] text-slate-400 max-w-xs truncate">
                        {acc.bureauNotes || 'Standard simulated trade-line'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
