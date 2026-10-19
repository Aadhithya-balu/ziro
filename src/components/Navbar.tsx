'use client';

import React from 'react';
import {
  ShieldAlert,
  LayoutDashboard,
  FilePlus,
  FlaskConical,
  Building2,
  ScrollText,
  RotateCcw,
  Sparkles,
} from 'lucide-react';

interface NavbarProps {
  activeTab: 'dashboard' | 'intake' | 'cases' | 'testlab' | 'bureau' | 'audit';
  setActiveTab: (tab: 'dashboard' | 'intake' | 'cases' | 'testlab' | 'bureau' | 'audit') => void;
  onResetSeed: () => void;
  isResetting: boolean;
}

export function Navbar({ activeTab, setActiveTab, onResetSeed, isResetting }: NavbarProps) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'intake', label: 'New Analysis', icon: FilePlus },
    { id: 'testlab', label: 'Test Lab (4 Scenarios)', icon: FlaskConical },
    { id: 'bureau', label: 'Mock Bureau Portal', icon: Building2 },
    { id: 'audit', label: 'Audit Trail', icon: ScrollText },
  ] as const;

  return (
    <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 text-slate-100 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Branding */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-blue-500 to-cyan-400 flex items-center justify-center shadow-indigo-500/25 shadow-md">
              <ShieldAlert className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                  ZiroCredit
                </span>
                <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  AI Agent
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium hidden sm:block">
                Credit Report Error Dispute & Verification Assistant
              </p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right Action Controls */}
          <div className="flex items-center space-x-2">
            <span className="hidden lg:inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20">
              <Sparkles className="w-3 h-3 mr-1 text-amber-400" />
              Synthetic Demo Environment
            </span>

            <button
              onClick={onResetSeed}
              disabled={isResetting}
              title="Reset demonstration data to clean seeded state"
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-slate-800 border border-slate-700 hover:bg-slate-700 hover:text-white transition disabled:opacity-50"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{isResetting ? 'Resetting...' : 'Reset Data'}</span>
            </button>
          </div>
        </div>

        {/* Mobile Navigation bar */}
        <div className="md:hidden flex items-center justify-around py-2 border-t border-slate-800 overflow-x-auto text-xs">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex flex-col items-center py-1 px-2 rounded font-medium ${
                  isActive ? 'text-indigo-400 font-bold' : 'text-slate-400'
                }`}
              >
                <Icon className="w-4 h-4 mb-0.5" />
                <span>{item.label.split(' ')[0]}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}
