'use client';

import React, { useState } from 'react';
import {
  UploadCloud,
  AlertCircle,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  FileText,
} from 'lucide-react';

import { normalizeBalance, normalizeDate } from '@/lib/classification/normalization';

interface IntakeViewProps {
  onCaseCreated: (caseId: string) => void;
}

export function IntakeView({ onCaseCreated }: IntakeViewProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [clientName, setClientName] = useState('Alex Mercer (Synthetic Consumer)');
  const [accountReference, setAccountReference] = useState('ACC-9821-AUTO');
  const [creditorName, setCreditorName] = useState('Apex Horizon Auto Finance');
  const [accountType, setAccountType] = useState('AUTO_LOAN');
  const [reportedBalance, setReportedBalance] = useState('24500');
  const [paymentStatus, setPaymentStatus] = useState('CURRENT');
  const [paymentHistory, setPaymentHistory] = useState('OK OK OK OK OK');
  const [openedDate, setOpenedDate] = useState('2025-03-12');
  const [reportedDate, setReportedDate] = useState('2026-09-01');
  const [delinquencyDate, setDelinquencyDate] = useState('');
  const [discrepancyReason, setDiscrepancyReason] = useState(
    'Account never opened by consumer (potential identity theft or mixed file error).'
  );
  const [userConfirmedFacts, setUserConfirmedFacts] = useState(
    'I have never applied for or opened an auto loan with Apex Horizon Auto Finance. This vehicle and account are completely unauthorized.'
  );
  const [attachedEvidenceNotes, setAttachedEvidenceNotes] = useState(
    'Consumer identity affidavit attached; no vehicle registration under consumer name.'
  );
  const [userFactConfirmed, setUserFactConfirmed] = useState(true);
  const [sourceReportRef, setSourceReportRef] = useState('SYNTHETIC-REPORT-APEX-AUDIT.pdf');

  // Fast Synthetic Preset Fillers
  const applyPreset = (preset: 'TC1' | 'TC2' | 'TC3' | 'TC4' | 'OBSOLETE' | 'DUPLICATE') => {
    if (preset === 'TC1') {
      setClientName('Alex Mercer (Synthetic Consumer)');
      setAccountReference('ACC-9821-AUTO');
      setCreditorName('Apex Horizon Auto Finance');
      setAccountType('AUTO_LOAN');
      setReportedBalance('24500');
      setPaymentStatus('CURRENT');
      setPaymentHistory('OK OK OK OK OK');
      setOpenedDate('2025-03-12');
      setReportedDate('2026-09-01');
      setDelinquencyDate('');
      setDiscrepancyReason('Account never opened by consumer (TC1: Unauthorized Account)');
      setUserConfirmedFacts(
        'I have never applied for or opened an auto loan with Apex Horizon Auto Finance. This vehicle and account are completely unauthorized.'
      );
      setAttachedEvidenceNotes('Identity affidavit; no DMV registration under consumer name.');
      setUserFactConfirmed(true);
      setSourceReportRef('MOCK-REPORT-TC1.pdf');
    } else if (preset === 'TC2') {
      setClientName('Elena Rostova (Synthetic Consumer)');
      setAccountReference('ACC-5510-CARD');
      setCreditorName('Vanguard National Bank');
      setAccountType('CREDIT_CARD');
      setReportedBalance('1850');
      setPaymentStatus('LATE_30');
      setPaymentHistory('OK OK 30 OK OK');
      setOpenedDate('2023-01-15');
      setReportedDate('2026-08-10');
      setDelinquencyDate('2026-05-15');
      setDiscrepancyReason('Inquiring about negative 30-day late entry (TC2: Accurate Negative)');
      setUserConfirmedFacts(
        'I was indeed 30 days late on my May payment due to moving between apartments. I did miss the payment deadline.'
      );
      setAttachedEvidenceNotes('Bank debit statement confirming payment made 32 days past due date.');
      setUserFactConfirmed(true);
      setSourceReportRef('MOCK-REPORT-TC2.pdf');
    } else if (preset === 'TC3') {
      setClientName('Marcus Brody (Synthetic Consumer)');
      setAccountReference('ACC-3312-COLLECT');
      setCreditorName('Midland Recovery Services');
      setAccountType('COLLECTIONS');
      setReportedBalance('3420');
      setPaymentStatus('COLLECTIONS');
      setPaymentHistory('COLLECTIONS');
      setOpenedDate('2025-06-01');
      setReportedDate('2026-07-22');
      setDelinquencyDate('2025-06-01');
      setDiscrepancyReason('Fraudulent collection account (TC3: False Resolution Audit)');
      setUserConfirmedFacts(
        'This collection account is fraudulent and never belonged to me. The debt collector has never validated the debt.'
      );
      setAttachedEvidenceNotes('Debt validation demand letter; zero underlying contract.');
      setUserFactConfirmed(true);
      setSourceReportRef('MOCK-REPORT-TC3.pdf');
    } else if (preset === 'TC4') {
      setClientName('Samantha Ray (Synthetic Consumer)');
      setAccountReference('ACC-8840-MTG');
      setCreditorName('Sovereign National Mortgage');
      setAccountType('MORTGAGE');
      setReportedBalance('412000');
      setPaymentStatus('CURRENT');
      setPaymentHistory('OK OK OK OK');
      setOpenedDate('2024-04-10');
      setReportedDate('2026-09-15');
      setDelinquencyDate('');
      setDiscrepancyReason('Unverified mortgage liability (TC4: Bureau ID Request Protocol)');
      setUserConfirmedFacts('I do not hold a mortgage with Sovereign National Mortgage.');
      setAttachedEvidenceNotes('Property deed and address mismatch records.');
      setUserFactConfirmed(true);
      setSourceReportRef('MOCK-REPORT-TC4.pdf');
    } else if (preset === 'OBSOLETE') {
      setClientName('Jordan Vance (Synthetic Consumer)');
      setAccountReference('ACC-7719-COLLECT');
      setCreditorName('Cascade Asset Recovery');
      setAccountType('COLLECTIONS');
      setReportedBalance('2100');
      setPaymentStatus('COLLECTIONS');
      setPaymentHistory('COLLECTIONS');
      setOpenedDate('2017-02-10');
      setReportedDate('2026-09-01');
      setDelinquencyDate('2018-04-15');
      setDiscrepancyReason('Statutory obsolescence period exceeded (FCRA § 605, 15 U.S.C. § 1681c)');
      setUserConfirmedFacts(
        'This collection trade-line commenced delinquency on April 15, 2018—more than 8 years ago. Under FCRA § 605 (15 U.S.C. § 1681c), adverse collections cannot be reported past 7 years and must be expunged.'
      );
      setAttachedEvidenceNotes('Original billing statement showing first delinquency commencement April 2018.');
      setUserFactConfirmed(true);
      setSourceReportRef('MOCK-REPORT-OBSOLETE.pdf');
    } else if (preset === 'DUPLICATE') {
      setClientName('David Cho (Synthetic Consumer)');
      setAccountReference('ACC-4491-STUDENT-B');
      setCreditorName('National Student Loan Servicing');
      setAccountType('STUDENT_LOAN');
      setReportedBalance('14250');
      setPaymentStatus('CURRENT');
      setPaymentHistory('OK OK OK OK');
      setOpenedDate('2022-09-01');
      setReportedDate('2026-08-20');
      setDelinquencyDate('');
      setDiscrepancyReason('Duplicate trade-line reporting (FCRA § 607b, 15 U.S.C. § 1681e(b))');
      setUserConfirmedFacts(
        'This loan is a duplicate reporting of my federal student loan obligation already listed under account ACC-4491-STUDENT-A with identical balance $14,250 and servicer. Double reporting inflates my liability.'
      );
      setAttachedEvidenceNotes('Servicer disclosure confirming single promissory note.');
      setUserFactConfirmed(true);
      setSourceReportRef('MOCK-REPORT-DUPLICATE.pdf');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!userFactConfirmed) {
      setError('You must confirm that the entered facts are accurate to the best of your knowledge before analysis.');
      return;
    }

    const cleanBalance = normalizeBalance(reportedBalance);
    if (isNaN(cleanBalance)) {
      setError('Please enter a valid reported balance (e.g. 24500 or $24,500.00).');
      return;
    }

    const cleanReportedDate = normalizeDate(reportedDate);
    if (!cleanReportedDate) {
      setError('Please provide a valid bureau reporting date (YYYY-MM-DD).');
      return;
    }

    const cleanOpenedDate = openedDate ? normalizeDate(openedDate) : undefined;
    if (openedDate && !cleanOpenedDate) {
      setError('Invalid account opened date format. Expected YYYY-MM-DD.');
      return;
    }

    const cleanDelinquencyDate = delinquencyDate ? normalizeDate(delinquencyDate) : undefined;
    if (delinquencyDate && !cleanDelinquencyDate) {
      setError('Invalid delinquency date format. Expected YYYY-MM-DD.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        clientName: clientName.trim(),
        accountReference: accountReference.trim(),
        creditorName: creditorName.trim(),
        accountType,
        reportedBalance: cleanBalance,
        paymentStatus,
        paymentHistory: paymentHistory.trim() || 'OK OK OK',
        openedDate: cleanOpenedDate,
        reportedDate: cleanReportedDate,
        delinquencyDate: cleanDelinquencyDate,
        userConfirmedFacts: userConfirmedFacts.trim(),
        discrepancyReason: discrepancyReason.trim(),
        userFactConfirmed,
        sourceReportRef: sourceReportRef.trim() || 'MANUAL-ENTRY.pdf',
        attachedEvidenceNotes: attachedEvidenceNotes.trim() || undefined,
      };

      const res = await fetch('/api/cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.message || 'Failed to submit credit intake.');
      }

      // Automatically trigger classification & AI analysis on new case
      const analyzeRes = await fetch(`/api/cases/${data.caseId}/analyze`, { method: 'POST' });
      if (!analyzeRes.ok) {
        const analyzeData = await analyzeRes.json();
        console.warn('Analysis completed with advisory note:', analyzeData.error || analyzeData.message);
      }

      onCaseCreated(data.caseId);
    } catch (err: any) {
      setError(err.message || 'An error occurred during intake.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fadeIn">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight flex items-center space-x-2">
          <FileText className="w-7 h-7 text-indigo-400" />
          <span>Credit Report Ingestion & Discrepancy Intake</span>
        </h1>
        <p className="text-sm text-slate-300 mt-1">
          Upload a credit report PDF or submit structured trade-line details with certified consumer statements. Never fabricates missing fields.
        </p>
      </div>

      {/* Preset Quick Fill Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-md">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-slate-300 flex items-center space-x-1.5">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Fast Preset Demonstrations (1-Click Fill)</span>
          </span>
          <span className="text-[11px] text-slate-400">Loads official test scenarios instantly</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          <button
            type="button"
            onClick={() => applyPreset('TC1')}
            className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-slate-700 text-xs font-semibold text-left transition"
          >
            <span className="block font-bold">TC1: Never Opened</span>
            <span className="text-[10px] text-slate-400 font-normal">Auto Loan ($24.5k)</span>
          </button>
          <button
            type="button"
            onClick={() => applyPreset('TC2')}
            className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 text-xs font-semibold text-left transition"
          >
            <span className="block font-bold">TC2: 30-Day Late</span>
            <span className="text-[10px] text-slate-400 font-normal">Credit Card ($1.8k)</span>
          </button>
          <button
            type="button"
            onClick={() => applyPreset('TC3')}
            className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 text-xs font-semibold text-left transition"
          >
            <span className="block font-bold">TC3: False Resol.</span>
            <span className="text-[10px] text-slate-400 font-normal">Collections ($3.4k)</span>
          </button>
          <button
            type="button"
            onClick={() => applyPreset('TC4')}
            className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 text-xs font-semibold text-left transition"
          >
            <span className="block font-bold">TC4: ID Request</span>
            <span className="text-[10px] text-slate-400 font-normal">Mortgage ($412k)</span>
          </button>
          <button
            type="button"
            onClick={() => applyPreset('OBSOLETE')}
            className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-rose-300 border border-slate-700 text-xs font-semibold text-left transition"
          >
            <span className="block font-bold">FCRA: Obsolete Debt</span>
            <span className="text-[10px] text-slate-400 font-normal">8-Year Collections ($2.1k)</span>
          </button>
          <button
            type="button"
            onClick={() => applyPreset('DUPLICATE')}
            className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-purple-300 border border-slate-700 text-xs font-semibold text-left transition"
          >
            <span className="block font-bold">FCRA: Duplicate Line</span>
            <span className="text-[10px] text-slate-400 font-normal">Student Loan ($14.2k)</span>
          </button>
        </div>
      </div>

      {/* Upload Box Simulation */}
      <div className="border-2 border-dashed border-slate-700 hover:border-indigo-500/50 bg-slate-900/60 rounded-2xl p-6 text-center transition">
        <UploadCloud className="w-10 h-10 text-indigo-400 mx-auto mb-2" />
        <h3 className="text-sm font-bold text-white">Sample PDF Report Extraction Simulation</h3>
        <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
          Currently populated from: <span className="font-mono text-indigo-300 font-semibold">{sourceReportRef}</span>. Structured manual fields below are validated strictly.
        </p>
        <span className="inline-block mt-3 px-2.5 py-1 rounded bg-slate-800 text-[11px] font-medium text-slate-400 border border-slate-700">
          PyMuPDF normalization rules active (No hallucinations permitted)
        </span>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Submission Blocked: </span>
              {error}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Consumer / Client Name
            </label>
            <input
              type="text"
              required
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Trade-Line Account Reference
            </label>
            <input
              type="text"
              required
              value={accountReference}
              onChange={(e) => setAccountReference(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl font-mono text-slate-100 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Creditor / Furnisher Name
            </label>
            <input
              type="text"
              required
              value={creditorName}
              onChange={(e) => setCreditorName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Account Type
            </label>
            <select
              value={accountType}
              onChange={(e) => setAccountType(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm focus:border-indigo-500 focus:outline-none"
            >
              <option value="AUTO_LOAN">Auto Loan</option>
              <option value="CREDIT_CARD">Credit Card</option>
              <option value="MORTGAGE">Mortgage</option>
              <option value="PERSONAL_LOAN">Personal Loan</option>
              <option value="COLLECTIONS">Collections</option>
              <option value="STUDENT_LOAN">Student Loan</option>
              <option value="REVOLVING">Revolving</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Reported Balance ($ USD)
            </label>
            <input
              type="number"
              step="any"
              min="0"
              required
              value={reportedBalance}
              onChange={(e) => setReportedBalance(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Reported Payment Status
            </label>
            <select
              value={paymentStatus}
              onChange={(e) => setPaymentStatus(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm focus:border-indigo-500 focus:outline-none"
            >
              <option value="CURRENT">Current / Paid as Agreed</option>
              <option value="LATE_30">30 Days Past Due</option>
              <option value="LATE_60">60 Days Past Due</option>
              <option value="LATE_90">90 Days Past Due</option>
              <option value="CHARGE_OFF">Charge Off</option>
              <option value="COLLECTIONS">Collections</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Bureau Reporting Date
            </label>
            <input
              type="date"
              required
              value={reportedDate}
              onChange={(e) => setReportedDate(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Account Opened Date
            </label>
            <input
              type="date"
              value={openedDate}
              onChange={(e) => setOpenedDate(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Factual Statement */}
        <div className="space-y-4 pt-2 border-t border-slate-800">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
              Why Is This Entry Inaccurate or In Dispute?
            </label>
            <input
              type="text"
              required
              value={discrepancyReason}
              onChange={(e) => setDiscrepancyReason(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5 flex items-center justify-between">
              <span>Consumer Confirmed Facts (Statement of Truth)</span>
              <span className="text-[11px] text-indigo-400 font-normal">Directly informs AI classification engine</span>
            </label>
            <textarea
              rows={3}
              required
              value={userConfirmedFacts}
              onChange={(e) => setUserConfirmedFacts(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Supporting Evidence Notes / Attached Documents
            </label>
            <input
              type="text"
              value={attachedEvidenceNotes}
              onChange={(e) => setAttachedEvidenceNotes(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </div>

          {/* Regulatory Truth Certification */}
          <div className="p-4 rounded-xl bg-slate-950 border border-indigo-500/30 flex items-start space-x-3">
            <input
              id="confirmFact"
              type="checkbox"
              checked={userFactConfirmed}
              onChange={(e) => setUserFactConfirmed(e.target.checked)}
              className="mt-1 w-4 h-4 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
            />
            <label htmlFor="confirmFact" className="text-xs text-slate-300 cursor-pointer">
              <span className="font-bold text-white block mb-0.5">
                Statutory Factual Certification (FCRA § 611 Declaration)
              </span>
              I solemnly confirm that the factual statements provided above are true, accurate, and complete to the best of my knowledge. I understand that submitting knowingly false statements undermines dispute validity under federal law.
            </label>
          </div>
        </div>

        {/* Submit */}
        <div className="pt-2 flex items-center justify-end space-x-3">
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center space-x-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50 hover:scale-[1.01]"
          >
            {isSubmitting ? (
              <span>Analyzing with AI Agent...</span>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Ingest & Run AI Classification</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
