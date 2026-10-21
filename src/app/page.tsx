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
  const [, setLoading] = useState(true);
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
    <div
      className="min-h-screen flex flex-col transition-colors duration-200"
      style={{ backgroundColor: 'var(--vp-midnight)', color: 'var(--vp-porcelain)' }}
    >
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
      <footer
        className="mt-auto py-5 text-center text-xs"
        style={{
          background: 'var(--vp-graphite)',
          borderTop: '1px solid var(--vp-graphite-rim)',
          color: 'var(--vp-muted)',
        }}
      >
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              className="font-extrabold tracking-tight"
              style={{ color: 'var(--vp-porcelain)' }}
            >
              ZiroCredit
            </span>
            <span>— AI Credit Report Error Dispute &amp; Verification Assistant</span>
          </div>
          <p style={{ fontSize: '0.6875rem', color: 'var(--vp-muted)' }}>
            Synthetic &amp; Isolated Demonstration Environment • Strict FCRA Compliance Prototype
          </p>
        </div>
      </footer>
    </div>
  );
}
