'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  LayoutDashboard,
  FilePlus,
  FlaskConical,
  Building2,
  ScrollText,
  RotateCcw,
  Sparkles,
  Sun,
  Moon,
} from 'lucide-react';

interface NavbarProps {
  activeTab: 'dashboard' | 'intake' | 'cases' | 'testlab' | 'bureau' | 'audit';
  setActiveTab: (tab: 'dashboard' | 'intake' | 'cases' | 'testlab' | 'bureau' | 'audit') => void;
  onResetSeed: () => void;
  isResetting: boolean;
}

export function Navbar({ activeTab, setActiveTab, onResetSeed, isResetting }: NavbarProps) {
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    setMounted(true);
    // Check saved theme or default to dark
    const saved = localStorage.getItem('ziro-theme') as 'dark' | 'light' | null;
    if (saved) {
      setTheme(saved);
      document.documentElement.setAttribute('data-theme', saved);
      document.documentElement.classList.toggle('light', saved === 'light');
      document.documentElement.classList.toggle('dark', saved === 'dark');
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    }
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('ziro-theme', next);
    document.documentElement.setAttribute('data-theme', next);
    if (next === 'light') {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    }
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard',            icon: LayoutDashboard },
    { id: 'intake',    label: 'New Analysis',          icon: FilePlus },
    { id: 'testlab',   label: 'Test Lab (4 Scenarios)', icon: FlaskConical },
    { id: 'bureau',    label: 'Mock Bureau',            icon: Building2 },
    { id: 'audit',     label: 'Audit Trail',            icon: ScrollText },
  ] as const;

  return (
    <header
      className="sticky top-0 z-40 shadow-lg transition-colors duration-200"
      style={{
        background: 'var(--vp-nav-bg)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--vp-border)',
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* ── Logo & Branding ── */}
          <button
            onClick={() => setActiveTab('dashboard')}
            className="flex items-center gap-3 group text-left"
            style={{ background: 'none', border: 'none', cursor: 'pointer' }}
          >
            {/* Prism logo mark */}
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center relative overflow-hidden flex-shrink-0 transition-transform duration-200 group-hover:scale-105"
              style={{
                background: 'linear-gradient(135deg, var(--vp-accent-violet) 0%, #5A3FD4 60%, #3A1FA0 100%)',
                boxShadow: '0 2px 14px var(--vp-accent-violet-glow)',
              }}
            >
              {/* Subtle prism reflection overlay */}
              <div
                className="absolute inset-0 opacity-30"
                style={{
                  background: 'linear-gradient(135deg, rgba(255,128,109,0.5) 0%, transparent 50%, rgba(230,191,120,0.4) 100%)',
                }}
              />
              <ShieldAlert className="w-5 h-5 text-white relative z-10" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span
                  className="font-extrabold text-xl tracking-tight transition-colors duration-200"
                  style={{ color: 'var(--vp-text-primary)' }}
                >
                  ZiroCredit
                </span>
                <span className="vp-badge vp-badge-violet" style={{ fontSize: '0.625rem' }}>
                  AI Agent
                </span>
              </div>
              <p className="text-[11px] font-medium hidden sm:block transition-colors duration-200" style={{ color: 'var(--vp-text-secondary)' }}>
                Credit Report Error Dispute &amp; Verification Assistant
              </p>
            </div>
          </button>

          {/* ── COMMAND DOCK — Desktop Navigation ── */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                    isActive ? 'vp-nav-active' : 'vp-nav-idle'
                  }`}
                  style={{ fontFamily: 'inherit', cursor: 'pointer' }}
                >
                  <Icon
                    className="w-3.5 h-3.5"
                    style={{ color: isActive ? 'var(--vp-accent-violet-text)' : 'var(--vp-text-secondary)' }}
                  />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* ── Right Controls ── */}
          <div className="flex items-center gap-2.5">
            {/* Synthetic demo badge */}
            <span
              className="hidden lg:inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold"
              style={{
                background: 'var(--vp-accent-brass-dim)',
                color: 'var(--vp-accent-brass-text)',
                border: '1px solid var(--vp-border-seam-brass)',
              }}
            >
              <Sparkles className="w-3 h-3" />
              Synthetic Demo
            </span>

            {/* ── VESPER PRISM Faceted Theme Toggle ── */}
            <button
              onClick={toggleTheme}
              role="switch"
              aria-checked={mounted ? theme === 'dark' : true}
              aria-label={`Toggle theme: current is ${mounted ? theme : 'dark'} mode`}
              title={`Switch to ${(mounted ? theme : 'dark') === 'dark' ? 'Light' : 'Dark'} Mode`}
              suppressHydrationWarning
              className="relative inline-flex items-center rounded-full p-0.5 transition-all focus:outline-none"
              style={{
                background: 'var(--vp-bg-surface-elevated)',
                border: '1px solid var(--vp-border)',
                width: 62,
                height: 30,
                cursor: 'pointer',
              }}
            >
              {/* Sliding crystal thumb */}
              <div
                suppressHydrationWarning
                className="rounded-full flex items-center justify-center transition-all duration-300 ease-out"
                style={{
                  width: 24,
                  height: 24,
                  transform: (!mounted || theme === 'dark') ? 'translateX(2px)' : 'translateX(32px)',
                  background: (!mounted || theme === 'dark')
                    ? 'linear-gradient(135deg, #8C68FD 0%, #5A3FD4 100%)'
                    : 'linear-gradient(135deg, #FFFFFF 0%, #EDE8F7 100%)',
                  boxShadow: (!mounted || theme === 'dark')
                    ? '0 0 10px rgba(140, 104, 253, 0.45)'
                    : '0 2px 6px rgba(0, 0, 0, 0.15)',
                  border: (!mounted || theme === 'dark')
                    ? '1px solid rgba(255, 255, 255, 0.25)'
                    : '1px solid #DCD5EA',
                }}
              >
                {(!mounted || theme === 'dark') ? (
                  <Moon className="w-3 h-3 text-white" />
                ) : (
                  <Sun className="w-3 h-3 text-amber-500" />
                )}
              </div>

              {/* Background ambient icons */}
              <div
                suppressHydrationWarning
                className="absolute inset-0 flex items-center justify-between px-2 text-[10px] pointer-events-none select-none"
              >
                <Moon
                  className="w-3 h-3 transition-opacity duration-200"
                  style={{
                    opacity: (!mounted || theme === 'dark') ? 0 : 0.45,
                    color: 'var(--vp-text-secondary)',
                  }}
                />
                <Sun
                  className="w-3 h-3 transition-opacity duration-200"
                  style={{
                    opacity: (mounted && theme === 'light') ? 0 : 0.45,
                    color: 'var(--vp-text-secondary)',
                  }}
                />
              </div>
            </button>

            {/* Reset seed button */}
            <button
              onClick={onResetSeed}
              disabled={isResetting}
              title="Reset demonstration data to clean seeded state"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-40"
              style={{
                background: 'var(--vp-bg-surface-elevated)',
                color: 'var(--vp-text-secondary)',
                border: '1px solid var(--vp-border)',
                fontFamily: 'inherit',
                cursor: isResetting ? 'not-allowed' : 'pointer',
              }}
            >
              <RotateCcw
                className="w-3.5 h-3.5"
                style={{ animation: isResetting ? 'vp-spin 0.8s linear infinite' : 'none' }}
              />
              <span className="hidden sm:inline">{isResetting ? 'Resetting…' : 'Reset Data'}</span>
            </button>
          </div>
        </div>

        {/* ── Mobile Navigation bar ── */}
        <div
          className="md:hidden flex items-center justify-around py-2 overflow-x-auto text-xs"
          style={{ borderTop: '1px solid var(--vp-border)' }}
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className="flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg transition-all"
                style={{
                  background: isActive ? 'var(--vp-accent-violet-dim)' : 'transparent',
                  color: isActive ? 'var(--vp-accent-violet-text)' : 'var(--vp-text-secondary)',
                  border: 'none',
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                }}
              >
                <Icon className="w-4 h-4" />
                <span className="text-[10px] font-semibold whitespace-nowrap">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}
