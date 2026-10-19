'use client';

import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Send,
  HelpCircle,
  FolderOpen,
  ArrowRight,
  ShieldCheck,
  FileText,
  FlaskConical,
  PlusCircle,
  Eye,
} from 'lucide-react';
import { CaseRecord } from '@/types';

interface DashboardMetrics {
  totalCases: number;
  potentialErrors: number;
  awaitingApproval: number;
  submittedDisputes: number;
  resolvedDisputes: number;
  requiringAdditionalEvidence: number;
}

interface DashboardViewProps {
  metrics: DashboardMetrics;
  cases: CaseRecord[];
  onOpenCase: (caseId: string) => void;
  onNavigateToIntake: () => void;
  onNavigateToTestLab: () => void;
}

export function DashboardView({
  metrics,
  cases,
  onOpenCase,
  onNavigateToIntake,
  onNavigateToTestLab,
}: DashboardViewProps) {
  const statCards = [
    {
      title: 'Total Ingested Cases',
      value: metrics.totalCases,
      desc: 'Credit trade-lines monitored',
      icon: FolderOpen,
      color: 'from-blue-600 to-indigo-600',
      badge: 'Portfolio',
    },
    {
      title: 'Potential Errors Identified',
      value: metrics.potentialErrors,
      desc: 'Actionable factual discrepancies',
      icon: AlertTriangle,
      color: 'from-amber-500 to-orange-600',
      badge: 'Actionable',
    },
    {
      title: 'Awaiting User Approval',
      value: metrics.awaitingApproval,
      desc: 'Human sign-off strictly required',
      icon: Clock,
      color: 'from-purple-600 to-pink-600',
      badge: 'Security Gate',
    },
    {
      title: 'Submitted to Bureau',
      value: metrics.submittedDisputes,
      desc: 'Active in Mock Credit Bureau',
      icon: Send,
      color: 'from-cyan-500 to-blue-600',
      badge: 'In Flight',
    },
    {
      title: 'Resolved Disputes',
      value: metrics.resolvedDisputes,
      desc: 'Pending outcome verification',
      icon: CheckCircle2,
      color: 'from-emerald-500 to-teal-600',
      badge: 'Closed Queue',
    },
    {
      title: 'Additional Evidence Required',
      value: metrics.requiringAdditionalEvidence,
      desc: 'Uncertain or KYC paused',
      icon: HelpCircle,
      color: 'from-rose-500 to-red-600',
      badge: 'Needs Input',
    },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'AWAITING_APPROVAL':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/30">
            <Clock className="w-3 h-3 mr-1" />
            Awaiting Approval
          </span>
        );
      case 'APPROVED':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/30">
            <ShieldCheck className="w-3 h-3 mr-1" />
            Approved
          </span>
        );
      case 'SUBMITTED':
      case 'UNDER_REVIEW':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
            <Send className="w-3 h-3 mr-1" />
            Bureau Review
          </span>
        );
      case 'ADDITIONAL_INFORMATION_REQUIRED':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <AlertTriangle className="w-3 h-3 mr-1" />
            ID Required (Paused)
          </span>
        );
      case 'RESOLVED':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Resolved
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
            {status}
          </span>
        );
    }
  };

  const getClassificationBadge = (cls?: string) => {
    switch (cls) {
      case 'POTENTIAL_ERROR':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
            POTENTIAL ERROR
          </span>
        );
      case 'ACCURATE_NEGATIVE':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700">
            ACCURATE NEGATIVE
          </span>
        );
      case 'UNCERTAIN':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30">
            UNCERTAIN
          </span>
        );
      default:
        return (
          <span className="text-xs text-slate-400 font-medium italic">Pending Analysis</span>
        );
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Synthetic Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/30 rounded-2xl p-5 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                PROTOTYPE NOTICE
              </span>
              <span className="text-xs text-slate-400">All data displayed is synthetic and simulated</span>
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">
              Credit Dispute & Independent Outcome Audit Control Center
            </h1>
            <p className="text-sm text-slate-300 max-w-2xl">
              ZiroCredit analyzes credit trade-lines, generates evidence-backed disputes, enforces human sign-off before submission, and independently re-downloads credit files to audit actual bureau correction outcomes.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={onNavigateToIntake}
              className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-md shadow-indigo-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <PlusCircle className="w-4 h-4" />
              <span>New Analysis</span>
            </button>
            <button
              onClick={onNavigateToTestLab}
              className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-sm shadow transition-all hover:scale-[1.02]"
            >
              <FlaskConical className="w-4 h-4 text-cyan-400" />
              <span>Launch Test Lab</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {statCards.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div
              key={idx}
              className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden hover:border-slate-700 transition"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-400">{stat.title}</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                  {stat.badge}
                </span>
              </div>
              <div className="flex items-baseline space-x-3">
                <span className="text-3xl font-extrabold text-white tracking-tight">{stat.value}</span>
                <span className="text-xs text-slate-400">{stat.desc}</span>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                <div className="flex items-center space-x-1.5">
                  <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${stat.color}`} />
                  <span>Synthetic Trade-Line Tracking</span>
                </div>
                <Icon className="w-4 h-4 text-slate-400" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent Activity Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="p-5 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center space-x-2">
              <FileText className="w-5 h-5 text-indigo-400" />
              <span>Recent Trade-Line Cases & Workflow Status</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Select any case to inspect evidence, review AI dispute drafts, approve submissions, or verify outcomes.
            </p>
          </div>
          <div className="text-xs text-slate-400 font-medium">
            Showing {cases.length} synthetic cases
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/60 text-xs uppercase font-semibold text-slate-400 tracking-wider border-b border-slate-800">
              <tr>
                <th scope="col" className="px-5 py-3.5">Case ID</th>
                <th scope="col" className="px-5 py-3.5">Account Ref</th>
                <th scope="col" className="px-5 py-3.5">Issue Type</th>
                <th scope="col" className="px-5 py-3.5">Classification</th>
                <th scope="col" className="px-5 py-3.5">Confidence</th>
                <th scope="col" className="px-5 py-3.5">Current Status</th>
                <th scope="col" className="px-5 py-3.5">Last Updated</th>
                <th scope="col" className="px-5 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {cases.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-slate-500">
                    No active cases found. Click "New Analysis" or run the Test Lab to populate demonstration cases.
                  </td>
                </tr>
              ) : (
                cases.map((c) => (
                  <tr
                    key={c.id}
                    className="hover:bg-slate-800/40 transition cursor-pointer"
                    onClick={() => onOpenCase(c.id)}
                  >
                    <td className="px-5 py-4 font-mono text-xs font-bold text-indigo-300">
                      {c.id}
                    </td>
                    <td className="px-5 py-4 font-mono text-xs text-slate-300">
                      {c.accountReference}
                    </td>
                    <td className="px-5 py-4 font-medium text-slate-200">
                      {c.issueType}
                      <span className="block text-[11px] text-slate-400 font-normal">{c.clientName}</span>
                    </td>
                    <td className="px-5 py-4">
                      {getClassificationBadge(c.classification)}
                    </td>
                    <td className="px-5 py-4">
                      {c.confidenceScore ? (
                        <div className="flex items-center space-x-2">
                          <div className="w-16 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-indigo-500 h-1.5 rounded-full"
                              style={{ width: `${Math.round(c.confidenceScore * 100)}%` }}
                            />
                          </div>
                          <span className="text-xs font-semibold text-slate-300">
                            {Math.round(c.confidenceScore * 100)}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {getStatusBadge(c.workflowStatus)}
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-400 font-mono">
                      {new Date(c.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenCase(c.id);
                        }}
                        className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600 hover:text-white border border-indigo-500/30 text-xs font-medium transition"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Inspect</span>
                        <ArrowRight className="w-3 h-3 ml-0.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
