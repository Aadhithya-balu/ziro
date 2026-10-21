'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
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

/* ─────────────────────────────────────────────────────────────────────────────
   CINEMATIC 3D VESPER PRISM CENTERPIECE
   High-quality multi-faceted crystal with real-time pointer tracking & caustics
   ───────────────────────────────────────────────────────────────────────────── */
function CinematicVesperPrism({ mousePos }: { mousePos: { x: number; y: number } }) {
  const prismRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number | null>(null);
  const currentRot = useRef({ rx: 14, ry: -18, rz: 0, ty: 0 });

  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (prefersReducedMotion) return;

    const startTime = performance.now();

    const render = (now: number) => {
      const t = (now - startTime) / 1000;

      // Base idle continuous precession
      const targetRx = 14 + Math.sin(t * 0.75) * 8 - mousePos.y * 18;
      const targetRy = -18 + Math.cos(t * 0.55) * 24 + mousePos.x * 24;
      const targetRz = Math.sin(t * 0.45) * 4;
      const targetTy = Math.sin(t * 0.95) * -7;

      // Smooth interpolation (lerp)
      currentRot.current.rx += (targetRx - currentRot.current.rx) * 0.08;
      currentRot.current.ry += (targetRy - currentRot.current.ry) * 0.08;
      currentRot.current.rz += (targetRz - currentRot.current.rz) * 0.08;
      currentRot.current.ty += (targetTy - currentRot.current.ty) * 0.08;

      if (prismRef.current) {
        prismRef.current.style.transform =
          `rotateX(${currentRot.current.rx}deg) ` +
          `rotateY(${currentRot.current.ry}deg) ` +
          `rotateZ(${currentRot.current.rz}deg) ` +
          `translateY(${currentRot.current.ty}px)`;
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [mousePos, prefersReducedMotion]);

  return (
    <div
      className="relative flex items-center justify-center flex-shrink-0"
      style={{
        perspective: '900px',
        width: 140,
        height: 140,
      }}
    >
      {/* Ambient caustics glow pool */}
      <div
        className="absolute rounded-full pointer-events-none transition-all duration-300"
        style={{
          width: 150,
          height: 150,
          background: 'radial-gradient(circle, var(--vp-prism-ambient) 0%, transparent 70%)',
          filter: 'blur(24px)',
          opacity: 0.65,
        }}
      />

      {/* 3D Transform Container */}
      <div
        ref={prismRef}
        className="relative"
        style={{
          width: 100,
          height: 100,
          transformStyle: 'preserve-3d',
          transform: 'rotateX(14deg) rotateY(-18deg)',
        }}
      >
        {/* Core Luminescent Shard (Internal Refraction) */}
        <div
          className="absolute inset-4 rounded-lg pointer-events-none"
          style={{
            background: 'linear-gradient(135deg, var(--vp-accent-violet-text) 0%, var(--vp-accent-coral) 50%, var(--vp-accent-brass) 100%)',
            opacity: 0.35,
            filter: 'blur(4px)',
            transform: 'translateZ(0px) rotate(45deg)',
          }}
        />

        {/* Facet 1: Front Spectral Violet Primary */}
        <div
          className="absolute inset-0 rounded-xl"
          style={{
            background: 'linear-gradient(135deg, rgba(140,104,253,0.72) 0%, rgba(90,63,212,0.22) 100%)',
            border: '1.5px solid var(--vp-border-seam-violet)',
            boxShadow: '0 0 28px var(--vp-accent-violet-glow)',
            backdropFilter: 'blur(3px)',
            WebkitBackdropFilter: 'blur(3px)',
            transform: 'translateZ(34px)',
          }}
        />

        {/* Facet 2: Right Signal Coral Reflection */}
        <div
          className="absolute inset-0 rounded-xl"
          style={{
            background: 'linear-gradient(135deg, rgba(255,128,109,0.58) 0%, rgba(255,128,109,0.08) 100%)',
            border: '1.5px solid var(--vp-border-seam-coral)',
            transform: 'rotateY(60deg) translateZ(34px)',
          }}
        />

        {/* Facet 3: Left Liquid Brass Milestone Reflection */}
        <div
          className="absolute inset-0 rounded-xl"
          style={{
            background: 'linear-gradient(135deg, rgba(230,191,120,0.58) 0%, rgba(230,191,120,0.08) 100%)',
            border: '1.5px solid var(--vp-border-seam-brass)',
            transform: 'rotateY(-60deg) translateZ(34px)',
          }}
        />

        {/* Facet 4: Top Specular Crystal Cap */}
        <div
          className="absolute left-0 right-0 rounded-md"
          style={{
            top: -16,
            height: 36,
            background: 'linear-gradient(180deg, var(--vp-prism-sheen) 0%, transparent 100%)',
            border: '1px solid rgba(255,255,255,0.25)',
            transform: 'rotateX(72deg) translateZ(12px)',
          }}
        />

        {/* Facet 5: Bottom Emerald/Teal Horizon */}
        <div
          className="absolute left-0 right-0 rounded-md"
          style={{
            bottom: -16,
            height: 36,
            background: 'linear-gradient(0deg, rgba(45,212,191,0.3) 0%, transparent 100%)',
            border: '1px solid rgba(45,212,191,0.25)',
            transform: 'rotateX(-72deg) translateZ(12px)',
          }}
        />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   INTERACTIVE KPI STAT CARD (3D TILT + PRISM SEAM)
   ───────────────────────────────────────────────────────────────────────────── */
interface KpiCardProps {
  title: string;
  value: number;
  desc: string;
  icon: React.ElementType;
  seam: string;
  finger: string;
  badge: string;
  badgeClass: string;
}

function KpiCard({ title, value, desc, icon: Icon, seam, finger, badge, badgeClass }: KpiCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [sheenStyle, setSheenStyle] = useState({ opacity: 0, x: 50, y: 50 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const dx = (x - cx) / cx;
    const dy = (y - cy) / cy;

    el.style.transform = `perspective(600px) rotateX(${-dy * 4}deg) rotateY(${dx * 4}deg) translateY(-2px)`;
    setSheenStyle({ opacity: 1, x: (x / rect.width) * 100, y: (y / rect.height) * 100 });
  };

  const handleMouseLeave = () => {
    if (cardRef.current) {
      cardRef.current.style.transform = '';
    }
    setSheenStyle({ opacity: 0, x: 50, y: 50 });
  };

  return (
    <div
      ref={cardRef}
      className={`vp-card ${seam} relative overflow-hidden flex flex-col justify-between`}
      style={{
        padding: '1.25rem',
        minHeight: '160px',
        transition: 'transform 0.22s ease, box-shadow 0.22s ease, border-color 0.18s ease',
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Dynamic specular light sheen */}
      <div
        className="absolute inset-0 pointer-events-none transition-opacity duration-300"
        style={{
          opacity: sheenStyle.opacity * 0.18,
          background: `radial-gradient(circle at ${sheenStyle.x}% ${sheenStyle.y}%, rgba(255,255,255,0.8) 0%, transparent 60%)`,
        }}
      />

      {/* Top row */}
      <div>
        <div className="flex items-start justify-between mb-3">
          <span className={`vp-badge ${badgeClass}`}>{badge}</span>
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{
              background: 'var(--vp-bg-surface-elevated)',
              border: '1px solid var(--vp-border)',
            }}
          >
            <Icon className="w-4 h-4" style={{ color: 'var(--vp-text-secondary)' }} />
          </div>
        </div>

        <p className="text-xs font-semibold" style={{ color: 'var(--vp-text-secondary)' }}>
          {title}
        </p>

        {/* Value */}
        <div className="flex items-baseline gap-2 mt-1">
          <span
            className="text-3xl font-extrabold tracking-tight"
            style={{
              color: 'var(--vp-text-primary)',
              fontFeatureSettings: '"tnum"',
            }}
          >
            {value}
          </span>
          <span className="text-xs" style={{ color: 'var(--vp-text-muted)' }}>
            {desc}
          </span>
        </div>
      </div>

      {/* Footer fingerprint indicator */}
      <div
        className="pt-3 mt-3 flex items-center gap-2"
        style={{ borderTop: '1px solid var(--vp-border-subtle)' }}
      >
        <span className={`vp-finger ${finger}`} />
        <span className="text-[10px] font-medium" style={{ color: 'var(--vp-text-muted)' }}>
          Synthetic Trade-Line Tracking
        </span>
      </div>
    </div>
  );
}

/* ── Status badges with accessible contrast & geometric markers ── */
function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'AWAITING_APPROVAL':
      return (
        <span className="vp-badge vp-badge-violet inline-flex items-center gap-1.5">
          <Clock className="w-3 h-3" /> Awaiting Approval
        </span>
      );
    case 'APPROVED':
      return (
        <span className="vp-badge vp-badge-brass inline-flex items-center gap-1.5">
          <ShieldCheck className="w-3 h-3" /> Approved
        </span>
      );
    case 'SUBMITTED':
    case 'UNDER_REVIEW':
      return (
        <span className="vp-badge vp-badge-teal inline-flex items-center gap-1.5">
          <Send className="w-3 h-3" /> Bureau Review
        </span>
      );
    case 'ADDITIONAL_INFORMATION_REQUIRED':
      return (
        <span className="vp-badge vp-badge-coral inline-flex items-center gap-1.5">
          <AlertTriangle className="w-3 h-3" /> ID Required
        </span>
      );
    case 'RESOLVED':
      return (
        <span className="vp-badge vp-badge-emerald inline-flex items-center gap-1.5">
          <CheckCircle2 className="w-3 h-3" /> Resolved
        </span>
      );
    default:
      return <span className="vp-badge vp-badge-muted">{status}</span>;
  }
}

function FingerForStatus({ status }: { status: string }) {
  switch (status) {
    case 'AWAITING_APPROVAL': return <span className="vp-finger vp-finger-violet" />;
    case 'APPROVED':          return <span className="vp-finger vp-finger-brass" />;
    case 'SUBMITTED':
    case 'UNDER_REVIEW':      return <span className="vp-finger vp-finger-teal" />;
    case 'ADDITIONAL_INFORMATION_REQUIRED': return <span className="vp-finger vp-finger-coral" />;
    case 'RESOLVED':          return <span className="vp-finger vp-finger-emerald" />;
    default:                  return <span className="vp-finger vp-finger-muted" />;
  }
}

const STATUS_FILTERS = [
  'ALL',
  'AWAITING_APPROVAL',
  'APPROVED',
  'SUBMITTED',
  'ADDITIONAL_INFORMATION_REQUIRED',
  'RESOLVED',
] as const;

export function DashboardView({
  metrics,
  cases,
  onOpenCase,
  onNavigateToIntake,
  onNavigateToTestLab,
}: DashboardViewProps) {
  const [filter, setFilter] = useState<string>('ALL');
  const [heroMouse, setHeroMouse] = useState({ x: 0, y: 0 });
  const heroRef = useRef<HTMLDivElement>(null);

  const handleHeroMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!heroRef.current) return;
    const rect = heroRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    setHeroMouse({ x, y });
  }, []);

  const handleHeroMouseLeave = useCallback(() => {
    setHeroMouse({ x: 0, y: 0 });
  }, []);

  const statCards: KpiCardProps[] = [
    {
      title: 'Total Ingested Cases',
      value: metrics.totalCases,
      desc: 'trade-lines monitored',
      icon: FolderOpen,
      seam: 'vp-seam-violet',
      finger: 'vp-finger-violet',
      badge: 'PORTFOLIO',
      badgeClass: 'vp-badge-violet',
    },
    {
      title: 'Potential Errors Identified',
      value: metrics.potentialErrors,
      desc: 'actionable discrepancies',
      icon: AlertTriangle,
      seam: 'vp-seam-coral',
      finger: 'vp-finger-coral',
      badge: 'ACTIONABLE',
      badgeClass: 'vp-badge-coral',
    },
    {
      title: 'Awaiting User Approval',
      value: metrics.awaitingApproval,
      desc: 'human sign-off required',
      icon: Clock,
      seam: 'vp-seam-brass',
      finger: 'vp-finger-brass',
      badge: 'SECURITY GATE',
      badgeClass: 'vp-badge-brass',
    },
    {
      title: 'Submitted to Bureau',
      value: metrics.submittedDisputes,
      desc: 'active investigations',
      icon: Send,
      seam: 'vp-seam-teal',
      finger: 'vp-finger-teal',
      badge: 'IN FLIGHT',
      badgeClass: 'vp-badge-teal',
    },
    {
      title: 'Resolved Disputes',
      value: metrics.resolvedDisputes,
      desc: 'pending outcome audit',
      icon: CheckCircle2,
      seam: 'vp-seam-emerald',
      finger: 'vp-finger-emerald',
      badge: 'CLOSED QUEUE',
      badgeClass: 'vp-badge-emerald',
    },
    {
      title: 'Additional Evidence Required',
      value: metrics.requiringAdditionalEvidence,
      desc: 'uncertain or KYC paused',
      icon: HelpCircle,
      seam: 'vp-seam-coral',
      finger: 'vp-finger-coral',
      badge: 'NEEDS INPUT',
      badgeClass: 'vp-badge-coral',
    },
  ];

  const filteredCases = filter === 'ALL'
    ? cases
    : cases.filter((c) => c.workflowStatus === filter);

  return (
    <div className="space-y-8 vp-fade-up pb-12">

      {/* ── Hero Banner with 3D Cinematic Prism ── */}
      <div
        ref={heroRef}
        onMouseMove={handleHeroMouseMove}
        onMouseLeave={handleHeroMouseLeave}
        className="vp-card vp-card-elevated vp-precision-grid relative overflow-hidden"
        style={{ padding: '2rem 2.25rem' }}
      >
        {/* Ambient violet and coral radial lighting */}
        <div
          className="absolute right-0 top-0 w-96 h-96 pointer-events-none transition-all duration-300"
          style={{
            background: 'radial-gradient(ellipse at top right, var(--vp-accent-violet-glow) 0%, transparent 70%)',
            opacity: 0.8,
          }}
        />
        <div
          className="absolute bottom-0 left-0 w-72 h-40 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at bottom left, var(--vp-accent-coral-glow) 0%, transparent 70%)',
            opacity: 0.5,
          }}
        />

        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="flex items-center gap-6">
            {/* Cinematic 3D Prism Centerpiece */}
            <CinematicVesperPrism mousePos={heroMouse} />

            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="vp-badge vp-badge-violet">PROTOTYPE NOTICE</span>
                <span className="text-xs" style={{ color: 'var(--vp-text-secondary)' }}>
                  All data displayed is synthetic and simulated
                </span>
              </div>
              <h1
                className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-tight"
                style={{ color: 'var(--vp-text-primary)' }}
              >
                Credit Dispute &amp; Independent Outcome Audit
                <br />
                <span style={{ color: 'var(--vp-accent-violet-text)' }}>Control Center</span>
              </h1>
              <p className="text-sm max-w-2xl" style={{ color: 'var(--vp-text-secondary)', lineHeight: 1.6 }}>
                ZiroCredit analyzes credit trade-lines, generates evidence-backed disputes, enforces
                human sign-off before submission, and independently re-downloads credit files to audit
                actual bureau correction outcomes.
              </p>
            </div>
          </div>

          {/* Primary Action controls */}
          <div className="flex flex-wrap items-center gap-3 flex-shrink-0">
            <button className="vp-btn-primary" onClick={onNavigateToIntake}>
              <PlusCircle className="w-4 h-4" />
              New Analysis
            </button>
            <button className="vp-btn-ghost" onClick={onNavigateToTestLab}>
              <FlaskConical className="w-4 h-4" style={{ color: 'var(--vp-accent-teal)' }} />
              Launch Test Lab
            </button>
          </div>
        </div>
      </div>

      {/* ── KPI Stat Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 vp-stagger">
        {statCards.map((stat, idx) => (
          <KpiCard key={idx} {...stat} />
        ))}
      </div>

      {/* ── Case Table ── */}
      <div className="vp-card overflow-hidden">
        {/* Table header */}
        <div
          className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          style={{ borderBottom: '1px solid var(--vp-border)' }}
        >
          <div>
            <h2
              className="text-base font-bold flex items-center gap-2"
              style={{ color: 'var(--vp-text-primary)' }}
            >
              <FileText className="w-4 h-4" style={{ color: 'var(--vp-accent-violet)' }} />
              Trade-Line Cases &amp; Workflow Status
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--vp-text-secondary)' }}>
              Select any case to inspect evidence, review AI dispute drafts, approve submissions, or verify outcomes.
            </p>
          </div>
          <div className="text-xs font-mono font-semibold" style={{ color: 'var(--vp-text-muted)' }}>
            {filteredCases.length} / {cases.length} cases
          </div>
        </div>

        {/* Status filter pills */}
        <div
          className="px-6 py-3 flex items-center gap-2 overflow-x-auto"
          style={{
            borderBottom: '1px solid var(--vp-border-subtle)',
            background: 'var(--vp-bg-surface-elevated)',
          }}
        >
          <span className="text-[11px] font-bold uppercase tracking-wider mr-1" style={{ color: 'var(--vp-text-muted)' }}>
            Filter:
          </span>
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className="text-[11px] font-semibold px-3 py-1 rounded-md transition-all whitespace-nowrap"
              style={{
                fontFamily: 'inherit',
                background: filter === s ? 'var(--vp-accent-violet-dim)' : 'transparent',
                color:      filter === s ? 'var(--vp-accent-violet-text)' : 'var(--vp-text-secondary)',
                border:     filter === s ? '1px solid var(--vp-border-seam-violet)' : '1px solid transparent',
                cursor: 'pointer',
              }}
            >
              {s === 'ALL' ? 'All Cases' : s.replace(/_/g, ' ').replace(/\b(\w)/g, (c) => c.toUpperCase())}
            </button>
          ))}
        </div>

        {/* Table body */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr
                className="text-[11px] font-bold uppercase tracking-wider"
                style={{
                  color: 'var(--vp-text-muted)',
                  borderBottom: '1px solid var(--vp-border)',
                }}
              >
                <th className="pl-6 py-3.5 w-6"></th>
                <th className="px-4 py-3.5">Case ID</th>
                <th className="px-4 py-3.5">Account Ref</th>
                <th className="px-4 py-3.5">Discrepancy / Client</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5">Updated</th>
                <th className="pr-6 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--vp-border-subtle)' }}>
              {filteredCases.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-sm" style={{ color: 'var(--vp-text-muted)' }}>
                    No trade-line cases match the selected filter.
                  </td>
                </tr>
              ) : (
                filteredCases.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => onOpenCase(c.id)}
                    className="vp-table-row cursor-pointer"
                  >
                    <td className="pl-6 py-4 w-4">
                      <FingerForStatus status={c.workflowStatus} />
                    </td>
                    <td
                      className="px-4 py-4 font-mono text-xs font-bold"
                      style={{ color: 'var(--vp-accent-violet-text)' }}
                    >
                      {c.id}
                    </td>
                    <td
                      className="px-4 py-4 font-mono text-xs"
                      style={{ color: 'var(--vp-text-secondary)' }}
                    >
                      {c.accountReference}
                    </td>
                    <td className="px-4 py-4 text-xs font-medium" style={{ color: 'var(--vp-text-primary)' }}>
                      {c.issueType}
                      <span className="block text-[11px] font-normal" style={{ color: 'var(--vp-text-muted)' }}>
                        {c.clientName}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge status={c.workflowStatus} />
                    </td>
                    <td
                      suppressHydrationWarning
                      className="px-4 py-4 font-mono text-xs"
                      style={{ color: 'var(--vp-text-muted)' }}
                    >
                      {new Date(c.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="pr-6 py-4 text-right">
                      <button
                        onClick={(e) => { e.stopPropagation(); onOpenCase(c.id); }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                        style={{
                          background: 'var(--vp-accent-violet-dim)',
                          color: 'var(--vp-accent-violet-text)',
                          border: '1px solid var(--vp-border-seam-violet)',
                          fontFamily: 'inherit',
                          cursor: 'pointer',
                        }}
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Inspect
                        <ArrowRight className="w-3 h-3" />
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
