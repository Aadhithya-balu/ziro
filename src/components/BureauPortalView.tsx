'use client';

import React, { useState, useEffect } from 'react';
import {
  Building2,
  Search,
  Database,
  RefreshCw,
} from 'lucide-react';
import { MockBureauAccount } from '@/lib/bureau/mock-portal';

export function BureauPortalView() {
  const [accounts, setAccounts] = useState<MockBureauAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchedAccount, setSearchedAccount] = useState<MockBureauAccount | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/bureau');
      const data = await res.json();
      setAccounts(data.accounts || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;
    setSearchError(null);
    setSearchedAccount(null);

    try {
      const res = await fetch(`/api/bureau?accountRef=${encodeURIComponent(searchTerm.trim())}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Account not found');
      setSearchedAccount(data.account);
    } catch (err: any) {
      setSearchError(err.message || 'Search failed');
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 via-cyan-950/40 to-slate-900 border border-cyan-500/30 rounded-2xl p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              SIMULATED REPOSITORY
            </span>
            <span className="text-xs text-slate-400">Endpoint: mock://apex-bureau.local/v1</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center space-x-2">
            <Building2 className="w-7 h-7 text-cyan-400" />
            <span>Apex Mock Credit Bureau Portal</span>
          </h1>
          <p className="text-sm text-slate-300 max-w-2xl mt-1">
            Direct inspection interface for the local Mock Credit Bureau database. Search registered trade-lines, review simulated consumer portfolios, and verify data isolation from real credit bureaus.
          </p>
        </div>

        <button
          onClick={fetchAccounts}
          className="inline-flex items-center space-x-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Bureau DB</span>
        </button>
      </div>

      {/* Account Query Search */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center space-x-2">
          <Search className="w-4 h-4 text-cyan-400" />
          <span>Trade-Line Registry Query</span>
        </h3>

        <form onSubmit={handleSearch} className="flex gap-3">
          <input
            type="text"
            placeholder="Search by Account Reference (e.g. ACC-9821-AUTO, ACC-5510-CARD)..."
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
          <div className="p-4 rounded-xl bg-slate-950 border border-cyan-500/30 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-white text-sm">{searchedAccount.creditorName}</span>
              <span className="font-mono text-cyan-300 font-semibold">{searchedAccount.accountReference}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-slate-300">
              <div>
                <span className="text-slate-400 block text-[10px]">Consumer:</span>
                <span>{searchedAccount.consumerName}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Reported Balance:</span>
                <span className="font-bold text-emerald-400">${searchedAccount.balance.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Status:</span>
                <span className="font-semibold text-amber-300">{searchedAccount.paymentStatus}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Payment History:</span>
                <span className="font-mono">{searchedAccount.paymentHistory}</span>
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
  );
}
