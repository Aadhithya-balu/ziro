'use client';

import React, { useState, useEffect } from 'react';
import {
  ScrollText,
  Search,
  Filter,
  ShieldCheck,
  Eye,
  RefreshCw,
  Clock,
  Terminal,
} from 'lucide-react';
import { AuditEventRecord } from '@/types';

export function AuditLogView() {
  const [events, setEvents] = useState<AuditEventRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<AuditEventRecord | null>(null);

  const fetchEvents = async () => {
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
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const filteredEvents = events.filter((e) => {
    if (filterType !== 'ALL' && !e.eventType.includes(filterType)) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchCase = e.caseId?.toLowerCase().includes(q);
      const matchType = e.eventType.toLowerCase().includes(q);
      const matchResult = e.actionResult.toLowerCase().includes(q);
      return matchCase || matchType || matchResult;
    }
    return true;
  });

  return (
    <div className="space-y-8 animate-fadeIn max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 via-purple-950/40 to-slate-900 border border-purple-500/30 rounded-2xl p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
              IMMUTABLE RECORD
            </span>
            <span className="text-xs text-slate-400">Append-Only Event Ledger</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center space-x-2">
            <ScrollText className="w-7 h-7 text-purple-400" />
            <span>Workflow & Compliance Audit Trail</span>
          </h1>
          <p className="text-sm text-slate-300 max-w-2xl mt-1">
            High-integrity tamper-evident log documenting intake events, AI evaluations, human approval decisions, version updates, mock bureau transmissions, and independent outcome verifications.
          </p>
        </div>

        <button
          onClick={fetchEvents}
          className="inline-flex items-center space-x-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Audit Stream</span>
        </button>
      </div>

      {/* Filters & Search */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search events by Case ID, type, or action result..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-purple-500"
          />
        </div>

        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none"
          >
            <option value="ALL">All Event Types</option>
            <option value="APPROVAL">Approvals</option>
            <option value="CLASSIFICATION">Classifications</option>
            <option value="DISPUTE">Dispute Events</option>
            <option value="VERIFIED">Outcome Verifications</option>
            <option value="CONSENT">Consumer Consent</option>
          </select>
        </div>
      </div>

      {/* Events Stream Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/60 text-xs uppercase font-semibold text-slate-400 tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-5 py-3.5">Timestamp</th>
                <th className="px-5 py-3.5">Event Type</th>
                <th className="px-5 py-3.5">Case ID</th>
                <th className="px-5 py-3.5">State Transition</th>
                <th className="px-5 py-3.5">Action Result</th>
                <th className="px-5 py-3.5 text-right">Payload</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-xs">
              {filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-slate-500">
                    No matching audit events located.
                  </td>
                </tr>
              ) : (
                filteredEvents.map((evt) => (
                  <tr key={evt.id} className="hover:bg-slate-800/40">
                    <td className="px-5 py-3.5 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                      {new Date(evt.timestamp).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs font-bold text-purple-300">
                      {evt.eventType}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs text-indigo-300 font-semibold">
                      {evt.caseId || '—'}
                    </td>
                    <td className="px-5 py-3.5 text-[11px] text-slate-300">
                      {evt.previousState && evt.newState ? (
                        <span>
                          <span className="text-slate-400">{evt.previousState}</span> →{' '}
                          <span className="font-semibold text-emerald-400">{evt.newState}</span>
                        </span>
                      ) : (
                        <span>{evt.newState || 'N/A'}</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-slate-200 max-w-sm truncate">
                      {evt.actionResult}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => setSelectedEvent(evt)}
                        className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[11px] font-mono"
                      >
                        <Eye className="w-3 h-3 text-purple-400" />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* JSON Payload Inspector Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <span className="font-mono text-xs text-purple-400 font-bold block">{selectedEvent.id}</span>
                <h3 className="text-base font-bold text-white">{selectedEvent.eventType}</h3>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="text-slate-400 hover:text-white text-xs font-semibold px-2 py-1 bg-slate-800 rounded-md"
              >
                Close
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-400 block font-bold mb-0.5">Action Result:</span>
                <p className="text-slate-200 bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                  {selectedEvent.actionResult}
                </p>
              </div>

              <div>
                <span className="text-slate-400 block font-bold mb-0.5">Raw JSON Metadata Payload:</span>
                <pre className="font-mono text-[11px] text-purple-300 bg-slate-950 p-3.5 rounded-lg border border-slate-800 overflow-x-auto max-h-60 whitespace-pre-wrap">
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
