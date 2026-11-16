// SPDX-License-Identifier: GPL-3.0-or-later
import React, { useEffect, useState } from 'react';
import { WorkbenchView } from './components/WorkbenchView';
import { SpreadsheetView } from './components/SpreadsheetView';
import { ElnLimsView } from './components/ElnLimsView';
import { StarMapView } from './components/StarMapView';
import { ManuscriptsView } from './components/ManuscriptsView';
import { AntigraityDrawer } from './components/AntigraityDrawer';

type NavSection = 'workbench' | 'spreadsheet' | 'eln_lims' | 'starmap' | 'manuscripts';

export default function App() {
  const [activeNav, setActiveNav] = useState<NavSection>('workbench');
  const [isDark, setIsDark] = useState(false);
  const [antigraityOpen, setAntigraityOpen] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  const navItems: { id: NavSection; label: string }[] = [
    { id: 'workbench', label: 'Workbench' },
    { id: 'spreadsheet', label: 'Spreadsheet' },
    { id: 'eln_lims', label: 'ELN & LIMS' },
    { id: 'starmap', label: 'Star Map' },
    { id: 'manuscripts', label: 'Manuscripts' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-8 px-6 py-3.5">
          {/* Zone 1: Single text element wordmark */}
          <a
            href="#workbench"
            onClick={(e) => {
              e.preventDefault();
              setActiveNav('workbench');
            }}
            className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 dark:text-slate-100"
          >
            LabFlow
          </a>

          {/* Zone 2: 5 concise single-line text nav links */}
          <nav aria-label="Primary Workspace" className="flex items-center gap-6 overflow-x-auto text-sm font-medium">
            {navItems.map((item) => {
              const active = activeNav === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveNav(item.id)}
                  className={`border-b-2 pb-1 text-sm whitespace-nowrap shrink-0 transition-colors ${
                    active
                      ? 'border-blue-600 text-slate-900 dark:border-cyan-400 dark:text-white'
                      : 'border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: 1 primary CTA */}
          <div className="shrink-0">
            <button
              type="button"
              onClick={() => setAntigraityOpen(true)}
              className="bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 whitespace-nowrap shrink-0 dark:bg-blue-600 dark:hover:bg-blue-700"
            >
              Run Antigraity
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] px-6 py-5">
        {activeNav === 'workbench' && (
          <WorkbenchView isDark={isDark} onToggleTheme={() => setIsDark((d) => !d)} />
        )}
        {activeNav === 'spreadsheet' && <SpreadsheetView />}
        {activeNav === 'eln_lims' && <ElnLimsView />}
        {activeNav === 'starmap' && <StarMapView />}
        {activeNav === 'manuscripts' && <ManuscriptsView />}
      </main>

      <AntigraityDrawer open={antigraityOpen} onClose={() => setAntigraityOpen(false)} />
    </div>
  );
}
