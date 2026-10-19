'use client';

import React, { useState, useEffect } from 'react';
import { Navbar } from '@/components/Navbar';
import { DashboardView } from '@/components/DashboardView';
import { IntakeView } from '@/components/IntakeView';
import { CaseDetailView } from '@/components/CaseDetailView';
import { TestLabView } from '@/components/TestLabView';
import { BureauPortalView } from '@/components/BureauPortalView';
import { AuditLogView } from '@/components/AuditLogView';
import { CaseRecord } from '@/types';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'intake' | 'cases' | 'testlab' | 'bureau' | 'audit'>('dashboard');
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [metrics, setMetrics] = useState({
    totalCases: 0,
    potentialErrors: 0,
    awaitingApproval: 0,
    submittedDisputes: 0,
    resolvedDisputes: 0,
    requiringAdditionalEvidence: 0,
  });
  const [loading, setLoading] = useState(true);
  const [isResetting, setIsResetting] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/cases');
      const data = await res.json();
      setCases(data.cases || []);
      if (data.metrics) {
        setMetrics(data.metrics);
      }
    } catch (err) {
      console.error('Error fetching cases:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleResetSeed = async () => {
    if (!confirm('Reset database to clean synthetic demonstration state?')) return;
    setIsResetting(true);
    try {
      await fetch('/api/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true }),
      });
      setSelectedCaseId(null);
      await loadData();
    } catch (err) {
      console.error('Reset error:', err);
    } finally {
      setIsResetting(false);
    }
  };

  const handleOpenCase = (id: string) => {
    setSelectedCaseId(id);
  };

  const handleCaseCreated = (id: string) => {
    loadData();
    setSelectedCaseId(id);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setSelectedCaseId(null);
          setActiveTab(tab);
        }}
        onResetSeed={handleResetSeed}
        isResetting={isResetting}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {selectedCaseId ? (
          <CaseDetailView
            caseId={selectedCaseId}
            onBack={() => {
              setSelectedCaseId(null);
              loadData();
            }}
            onRefreshData={loadData}
          />
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <DashboardView
                metrics={metrics}
                cases={cases}
                onOpenCase={handleOpenCase}
                onNavigateToIntake={() => setActiveTab('intake')}
                onNavigateToTestLab={() => setActiveTab('testlab')}
              />
            )}

            {activeTab === 'intake' && (
              <IntakeView onCaseCreated={handleCaseCreated} />
            )}

            {activeTab === 'testlab' && (
              <TestLabView onOpenCase={handleOpenCase} />
            )}

            {activeTab === 'bureau' && <BureauPortalView />}

            {activeTab === 'audit' && <AuditLogView />}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-900 bg-slate-950/80 py-6 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <span className="font-extrabold text-slate-200 tracking-tight">ZiroCredit</span>
            <span>— AI Credit Report Error Dispute & Verification Assistant</span>
          </div>
          <p className="text-[11px] text-slate-400">
            Synthetic & Isolated Demonstration Environment • Strict FCRA Compliance Prototype
          </p>
        </div>
      </footer>
    </div>
  );
}
