'use client';

import React, { useState } from 'react';
import {
  FlaskConical,
  Play,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  Terminal,
  RefreshCw,
  Eye,
} from 'lucide-react';
import { TestScenarioResult } from '@/types';

interface TestLabViewProps {
  onOpenCase: (caseId: string) => void;
}

export function TestLabView({ onOpenCase }: TestLabViewProps) {
  const [runningId, setRunningId] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, TestScenarioResult>>({});
  const [expandedLogs, setExpandedLogs] = useState<Record<string, boolean>>({});

  const scenarioMetadata = [
    {
      id: 'TC1',
      title: 'TC1: Loan the user never took',
      subtitle: 'Identity Theft / Unauthorized Account Dispute Protocol',
      description:
        'A synthetic credit report contains an auto loan account. The user certifies under penalty of perjury that they never opened it. The mock bureau corroborates the trade-line listing.',
      expected: 'Classify as POTENTIAL_ERROR -> Generate dispute draft -> Strict Human Approval required before submission.',
    },
    {
      id: 'TC2',
      title: 'TC2: Accurate 30-day late payment',
      subtitle: 'Negative Record Protection (FCRA § 623 Anti-Frivolous Filter)',
      description:
        'The credit report records a payment 30 days late. The user confirms making the payment late. Authoritative evidence corroborates the 30-day delinquency.',
      expected: 'Classify as ACCURATE_NEGATIVE -> Suppress dispute draft -> Explain that accurate negatives cannot be disputed.',
    },
    {
      id: 'TC3',
      title: 'TC3: Bureau marks dispute resolved',
      subtitle: 'Independent Re-Download & Outcome Audit Mismatch Detection',
      description:
        'A submitted dispute is marked RESOLVED by the mock bureau, but the independent re-downloaded report reveals the unauthorized trade-line STILL EXISTS.',
      expected: 'Re-download report -> Compare against requested correction -> Mark outcome as NOT_CORRECTED -> Highlight mismatch.',
    },
    {
      id: 'TC4',
      title: 'TC4: Bureau requests ID upload',
      subtitle: 'KYC Document Consent & Security Guardrail Protocol',
      description:
        'The mock credit bureau pauses the dispute requesting government photo ID and utility bill under FCRA § 605B / Rule 402.',
      expected: 'Pause workflow -> Set status to ADDITIONAL_INFORMATION_REQUIRED -> Mandate explicit consumer consent before uploading.',
    },
  ];

  const runScenario = async (id: 'TC1' | 'TC2' | 'TC3' | 'TC4' | 'ALL') => {
    setRunningId(id);
    try {
      const res = await fetch('/api/test-lab/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarioId: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Test execution failed');

      const updated = { ...results };
      data.results.forEach((r: TestScenarioResult) => {
        updated[r.scenarioId] = r;
      });
      setResults(updated);
    } catch (err: any) {
      alert(`Error running scenario: ${err.message}`);
    } finally {
      setRunningId(null);
    }
  };

  const toggleLog = (id: string) => {
    setExpandedLogs((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-8 animate-fadeIn max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/30 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              Official Hackathon Test Suite
            </span>
            <span className="text-xs text-slate-400">Deterministic & Reproducible</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center space-x-2">
            <FlaskConical className="w-7 h-7 text-indigo-400" />
            <span>Interactive Scenario Test Lab</span>
          </h1>
          <p className="text-sm text-slate-300 max-w-2xl mt-1">
            Execute all four official test scenarios against live backend engines. Inspect input parameters, expected vs. actual outputs, evidentiary artifacts, and immutable execution logs.
          </p>
        </div>

        <button
          onClick={() => runScenario('ALL')}
          disabled={runningId !== null}
          className="inline-flex items-center space-x-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-sm shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50 hover:scale-[1.02]"
        >
          {runningId === 'ALL' ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Executing All 4 Scenarios...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-current" />
              <span>Run All Official Scenarios</span>
            </>
          )}
        </button>
      </div>

      {/* Scenarios Grid */}
      <div className="space-y-6">
        {scenarioMetadata.map((sc) => {
          const res = results[sc.id];
          const isRunning = runningId === sc.id || runningId === 'ALL';
          const isExpanded = expandedLogs[sc.id] || false;

          return (
            <div
              key={sc.id}
              className={`bg-slate-900 border rounded-2xl shadow-xl overflow-hidden transition-all ${
                res?.status === 'PASS'
                  ? 'border-emerald-500/30'
                  : res?.status === 'FAIL'
                  ? 'border-rose-500/40'
                  : 'border-slate-800'
              }`}
            >
              {/* Card Header */}
              <div className="p-6 border-b border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2.5">
                    <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded bg-slate-800 text-indigo-300 border border-slate-700">
                      {sc.id}
                    </span>
                    <h3 className="text-lg font-bold text-white">{sc.title}</h3>
                    {res && (
                      <span
                        className={`inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-black tracking-wide border ${
                          res.status === 'PASS'
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                        }`}
                      >
                        {res.status === 'PASS' ? (
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 mr-1" />
                        )}
                        <span>{res.status}</span>
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-indigo-300 font-medium">{sc.subtitle}</p>
                  <p className="text-xs text-slate-300 max-w-3xl leading-relaxed">{sc.description}</p>
                </div>

                <div className="flex items-center space-x-2.5 shrink-0">
                  {res?.caseId && (
                    <button
                      onClick={() => onOpenCase(res.caseId!)}
                      className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
                    >
                      <Eye className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Inspect Case</span>
                    </button>
                  )}
                  <button
                    onClick={() => runScenario(sc.id as any)}
                    disabled={isRunning}
                    className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-bold border border-slate-700 transition disabled:opacity-50"
                  >
                    {isRunning ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                    ) : (
                      <Play className="w-3.5 h-3.5 fill-current text-indigo-400" />
                    )}
                    <span>{isRunning ? 'Running...' : 'Execute Test'}</span>
                  </button>
                </div>
              </div>

              {/* Execution Details & Assertions */}
              {res ? (
                <div className="p-6 space-y-4 bg-slate-950/40">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    {/* Expected */}
                    <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                      <span className="font-bold uppercase tracking-wider text-slate-400 block">
                        Expected Outcome Assertions
                      </span>
                      <pre className="font-mono text-[11px] text-slate-300 bg-slate-950 p-3 rounded-lg border border-slate-800 overflow-x-auto whitespace-pre-wrap">
                        {JSON.stringify(res.expectedResult, null, 2)}
                      </pre>
                    </div>

                    {/* Actual */}
                    <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                      <span className="font-bold uppercase tracking-wider text-slate-400 block">
                        Actual Live Engine Results
                      </span>
                      <pre className="font-mono text-[11px] text-emerald-300 bg-slate-950 p-3 rounded-lg border border-slate-800 overflow-x-auto whitespace-pre-wrap">
                        {JSON.stringify(res.actualResult, null, 2)}
                      </pre>
                    </div>
                  </div>

                  {/* Evidence Produced */}
                  {res.evidenceProduced.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        Inspectable Evidence Produced
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        {res.evidenceProduced.map((evi, idx) => (
                          <div key={idx} className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                            <span className="block text-[10px] text-slate-400 font-mono">{evi.label}</span>
                            <span className="font-bold text-slate-200 truncate block mt-0.5">{evi.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Discrepancy Explanation */}
                  {res.discrepancyExplanation && (
                    <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-500/30 text-xs text-indigo-200">
                      <span className="font-bold text-white block mb-0.5">Verification Analysis:</span>
                      {res.discrepancyExplanation}
                    </div>
                  )}

                  {/* Logs Toggle */}
                  <div className="pt-2">
                    <button
                      onClick={() => toggleLog(sc.id)}
                      className="inline-flex items-center space-x-1.5 text-xs text-slate-400 hover:text-white font-mono"
                    >
                      <Terminal className="w-3.5 h-3.5 text-slate-400" />
                      <span>{isExpanded ? 'Hide Engine Logs' : 'View Engine Execution Logs'}</span>
                      {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>

                    {isExpanded && (
                      <div className="mt-2 p-3 rounded-xl bg-black/90 font-mono text-[11px] text-slate-300 border border-slate-800 space-y-1 max-h-48 overflow-y-auto">
                        {res.logs.map((line, lidx) => (
                          <div key={lidx} className="leading-tight">
                            {line}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-5 text-center text-xs text-slate-400 bg-slate-950/20">
                  Ready to execute. Click <span className="font-bold text-slate-300">"Execute Test"</span> to run live validation.
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
