'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  ScrollText,
  Search,
  Filter,
  Eye,
  RefreshCw,
  Copy,
  CheckCheck,
  Lock,
} from 'lucide-react';
import { AuditEventRecord } from '@/types';

/* ── Event type badge colors ── */
function EventTypeBadge({ eventType }: { eventType: string }) {
  if (eventType.includes('APPROVAL'))
    return <span className="vp-badge vp-badge-brass">{eventType}</span>;
  if (eventType.includes('VERIFIED') || eventType.includes('VERIFICATION'))
    return <span className="vp-badge vp-badge-emerald">{eventType}</span>;
  if (eventType.includes('CONSENT'))
    return <span className="vp-badge vp-badge-coral">{eventType}</span>;
  if (eventType.includes('DISPUTE') || eventType.includes('DRAFT'))
    return <span className="vp-badge vp-badge-teal">{eventType}</span>;
  if (eventType.includes('CLASSIFICATION') || eventType.includes('ANALYSIS'))
    return <span className="vp-badge vp-badge-violet">{eventType}</span>;
  return <span className="vp-badge vp-badge-muted">{eventType}</span>;
}

/* ── Copy-to-clipboard button ── */
function CopyJsonButton({ payload }: { payload: unknown }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* silent — clipboard may be unavailable */
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
      style={{
        background: copied ? 'var(--vp-emerald-dim)' : 'var(--vp-graphite-hi)',
        color:      copied ? 'var(--vp-emerald)' : 'var(--vp-lavender-ash)',
        border:     copied ? '1px solid rgba(48,201,126,0.35)' : '1px solid var(--vp-graphite-rim)',
        fontFamily: 'inherit',
        cursor: 'pointer',
      }}
      title="Copy raw JSON payload to clipboard"
    >
      {copied ? <CheckCheck className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? 'Copied!' : 'Copy JSON'}
    </button>
  );
}

const FILTER_OPTIONS = [
  { value: 'ALL',            label: 'All Events' },
  { value: 'APPROVAL',       label: 'Approvals' },
  { value: 'CLASSIFICATION', label: 'Classifications' },
  { value: 'DISPUTE',        label: 'Dispute Events' },
  { value: 'DRAFT',          label: 'Draft Edits' },
  { value: 'VERIFIED',       label: 'Outcome Verifications' },
  { value: 'CONSENT',        label: 'Consumer Consent' },
] as const;

export function AuditLogView() {
  const [events, setEvents] = useState<AuditEventRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<AuditEventRecord | null>(null);

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/audit?limit=200');
      const data = await res.json();
      setEvents(data.events || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const filteredEvents = events.filter((e) => {
    if (filterType !== 'ALL' && !e.eventType.includes(filterType)) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchCase   = e.caseId?.toLowerCase().includes(q);
      const matchType   = e.eventType.toLowerCase().includes(q);
      const matchResult = e.actionResult.toLowerCase().includes(q);
      return matchCase || matchType || matchResult;
    }
    return true;
  });

  return (
    <div className="space-y-6 vp-fade-up max-w-6xl mx-auto pb-12">

      {/* ── Header banner ── */}
      <div
        className="vp-card vp-seam-violet relative overflow-hidden"
        style={{ padding: '1.5rem 2rem' }}
      >
        {/* Ambient purple glow */}
        <div
          className="absolute top-0 right-0 w-72 h-48 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at top right, rgba(124,92,252,0.10) 0%, transparent 70%)',
          }}
        />

        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="vp-badge vp-badge-violet">
                <Lock className="w-2.5 h-2.5 mr-0.5" />
                IMMUTABLE RECORD
              </span>
              <span className="text-xs" style={{ color: 'var(--vp-lavender-ash)' }}>
                Append-Only Event Ledger
              </span>
            </div>
            <h1
              className="text-2xl font-extrabold tracking-tight flex items-center gap-3"
              style={{ color: 'var(--vp-porcelain)' }}
            >
              <ScrollText className="w-6 h-6" style={{ color: 'var(--vp-violet)' }} />
              Workflow &amp; Compliance Audit Trail
            </h1>
            <p className="text-sm mt-1 max-w-2xl" style={{ color: 'var(--vp-lavender-ash)', lineHeight: 1.6 }}>
              High-integrity tamper-evident log documenting intake events, AI evaluations, human approval
              decisions, version updates, mock bureau transmissions, and independent outcome verifications.
            </p>
          </div>

          <button
            onClick={fetchEvents}
            className="vp-btn-ghost flex-shrink-0"
            style={{ alignSelf: 'flex-start' }}
          >
            <RefreshCw
              className="w-3.5 h-3.5"
              style={{ animation: loading ? 'vp-spin 0.8s linear infinite' : 'none' }}
            />
            Refresh Stream
          </button>
        </div>
      </div>

      {/* ── Filter & Search bar ── */}
      <div
        className="vp-card flex flex-col sm:flex-row gap-3"
        style={{ padding: '1rem 1.25rem' }}
      >
        {/* Search */}
        <div className="relative flex-1">
          <Search
            className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: 'var(--vp-muted)' }}
          />
          <input
            type="text"
            placeholder="Search by Case ID, event type, or action result…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="vp-input"
            style={{ paddingLeft: '2.25rem' }}
          />
        </div>

        {/* Event type filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--vp-muted)' }} />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="vp-input"
            style={{ width: 'auto', cursor: 'pointer' }}
          >
            {FILTER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {/* Count */}
        <div
          className="flex items-center text-xs font-mono px-3 py-2 rounded-lg flex-shrink-0"
          style={{
            background: 'var(--vp-midnight)',
            border: '1px solid var(--vp-graphite-rim)',
            color: 'var(--vp-muted)',
          }}
        >
          {filteredEvents.length} / {events.length} events
        </div>
      </div>

      {/* ── Events table ── */}
      <div className="vp-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr
                style={{
                  background: 'var(--vp-midnight)',
                  borderBottom: '1px solid var(--vp-graphite-rim)',
                }}
              >
                {['Timestamp', 'Event Type', 'Case ID', 'State Transition', 'Action Result', ''].map((h, i) => (
                  <th
                    key={i}
                    className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--vp-muted)' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredEvents.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-10 text-center text-sm"
                    style={{ color: 'var(--vp-muted)' }}
                  >
                    {loading ? 'Loading audit stream…' : 'No matching audit events located.'}
                  </td>
                </tr>
              ) : (
                filteredEvents.map((evt) => (
                  <tr
                    key={evt.id}
                    className="vp-table-row"
                    style={{ borderBottom: '1px solid var(--vp-graphite-rim)' }}
                  >
                    {/* Timestamp */}
                    <td
                      suppressHydrationWarning
                      className="px-5 py-3.5 font-mono text-[11px] whitespace-nowrap"
                      style={{ color: 'var(--vp-muted)' }}
                    >
                      {new Date(evt.timestamp).toLocaleString([], {
                        month:  'short',
                        day:    'numeric',
                        hour:   '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>

                    {/* Event type badge */}
                    <td className="px-5 py-3.5">
                      <EventTypeBadge eventType={evt.eventType} />
                    </td>

                    {/* Case ID */}
                    <td
                      className="px-5 py-3.5 font-mono text-xs font-bold"
                      style={{ color: 'var(--vp-violet-text)' }}
                    >
                      {evt.caseId || '—'}
                    </td>

                    {/* State transition */}
                    <td className="px-5 py-3.5 text-[11px]">
                      {evt.previousState && evt.newState ? (
                        <span className="flex items-center gap-1">
                          <span style={{ color: 'var(--vp-muted)' }}>{evt.previousState}</span>
                          <span style={{ color: 'var(--vp-lavender-ash)' }}>→</span>
                          <span className="font-semibold" style={{ color: 'var(--vp-emerald)' }}>
                            {evt.newState}
                          </span>
                        </span>
                      ) : (
                        <span style={{ color: 'var(--vp-lavender-ash)' }}>{evt.newState || 'N/A'}</span>
                      )}
                    </td>

                    {/* Action result */}
                    <td
                      className="px-5 py-3.5 text-xs max-w-xs truncate"
                      style={{ color: 'var(--vp-porcelain)' }}
                      title={evt.actionResult}
                    >
                      {evt.actionResult}
                    </td>

                    {/* Inspect button */}
                    <td className="pr-5 py-3.5 text-right">
                      <button
                        onClick={() => setSelectedEvent(evt)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all font-mono"
                        style={{
                          background: 'var(--vp-graphite-hi)',
                          color: 'var(--vp-lavender-ash)',
                          border: '1px solid var(--vp-graphite-rim)',
                          cursor: 'pointer',
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.background = 'var(--vp-violet-glow)';
                          (e.currentTarget as HTMLButtonElement).style.color = 'var(--vp-violet-text)';
                          (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--vp-violet-seam)';
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.background = 'var(--vp-graphite-hi)';
                          (e.currentTarget as HTMLButtonElement).style.color = 'var(--vp-lavender-ash)';
                          (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--vp-graphite-rim)';
                        }}
                      >
                        <Eye className="w-3 h-3" style={{ color: 'var(--vp-violet)' }} />
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── JSON Payload Inspector Modal ── */}
      {selectedEvent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'var(--vp-bg-overlay)', backdropFilter: 'blur(8px)' }}
          onClick={() => setSelectedEvent(null)}
        >
          <div
            className="vp-card vp-scale-up vp-seam-violet max-w-2xl w-full shadow-2xl"
            style={{ maxHeight: '85vh', overflowY: 'auto', padding: '1.5rem' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div
              className="flex items-start justify-between pb-4 mb-4"
              style={{ borderBottom: '1px solid var(--vp-graphite-rim)' }}
            >
              <div>
                <span
                  className="font-mono text-[11px] font-bold block mb-1"
                  style={{ color: 'var(--vp-violet)' }}
                >
                  {selectedEvent.id}
                </span>
                <h3 className="text-base font-bold" style={{ color: 'var(--vp-porcelain)' }}>
                  {selectedEvent.eventType}
                </h3>
                {selectedEvent.caseId && (
                  <span className="font-mono text-xs" style={{ color: 'var(--vp-violet-text)' }}>
                    {selectedEvent.caseId}
                  </span>
                )}
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="vp-btn-ghost text-xs"
                style={{ padding: '0.375rem 0.75rem', fontSize: '0.75rem' }}
              >
                Close
              </button>
            </div>

            {/* Content */}
            <div className="space-y-4 text-xs">
              {/* Timestamp */}
              <div>
                <span className="text-xs font-semibold block mb-1" style={{ color: 'var(--vp-lavender-ash)' }}>
                  Timestamp
                </span>
                <p
                  className="font-mono text-[11px] px-3 py-2 rounded-lg"
                  style={{
                    background: 'var(--vp-midnight)',
                    border: '1px solid var(--vp-graphite-rim)',
                    color: 'var(--vp-muted)',
                  }}
                >
                  {new Date(selectedEvent.timestamp).toISOString()}
                </p>
              </div>

              {/* State transition */}
              {(selectedEvent.previousState || selectedEvent.newState) && (
                <div>
                  <span className="text-xs font-semibold block mb-1" style={{ color: 'var(--vp-lavender-ash)' }}>
                    State Transition
                  </span>
                  <p
                    className="font-mono text-[11px] px-3 py-2 rounded-lg"
                    style={{
                      background: 'var(--vp-midnight)',
                      border: '1px solid var(--vp-graphite-rim)',
                      color: 'var(--vp-porcelain)',
                    }}
                  >
                    {selectedEvent.previousState || '(none)'} → {selectedEvent.newState || '(none)'}
                  </p>
                </div>
              )}

              {/* Action result */}
              <div>
                <span className="text-xs font-semibold block mb-1" style={{ color: 'var(--vp-lavender-ash)' }}>
                  Action Result
                </span>
                <p
                  className="text-[11px] px-3 py-2.5 rounded-lg leading-relaxed"
                  style={{
                    background: 'var(--vp-midnight)',
                    border: '1px solid var(--vp-graphite-rim)',
                    color: 'var(--vp-porcelain)',
                  }}
                >
                  {selectedEvent.actionResult}
                </p>
              </div>

              {/* Raw JSON with copy button */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold" style={{ color: 'var(--vp-lavender-ash)' }}>
                    Raw JSON Metadata Payload
                  </span>
                  <CopyJsonButton payload={selectedEvent.metadata || {}} />
                </div>
                <pre
                  className="text-[11px] px-4 py-3.5 rounded-lg overflow-x-auto whitespace-pre-wrap max-h-64 font-mono leading-relaxed"
                  style={{
                    background: 'var(--vp-midnight)',
                    border: '1px solid var(--vp-graphite-rim)',
                    color: 'var(--vp-violet-text)',
                  }}
                >
                  {JSON.stringify(selectedEvent.metadata || {}, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
