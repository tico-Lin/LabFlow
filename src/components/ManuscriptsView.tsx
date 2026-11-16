// SPDX-License-Identifier: GPL-3.0-or-later
import React, { useEffect, useState } from 'react';

export const ManuscriptsView: React.FC = () => {
  const [title, setTitle] = useState('無氟無氯深共晶—鋁碘電池系統之開發與跨界面協同機制研究');
  const [author, setAuthor] = useState('LabFlow Research Group');
  const [abstractText, setAbstractText] = useState(
    'Cross-interface synergy of MIL-100(Fe)@CC host validated via Dunn CV separation (74.5%), PEIS zero-crossover (Rs = 0.5192 Ohm), and synchrotron XAS 7-model AIC fusion.'
  );
  const [texOutput, setTexOutput] = useState('');
  const [lintResult, setLintResult] = useState<{ compliant: boolean; missingDirectives: string[] } | null>(null);

  const generateLatex = async () => {
    const r = await fetch('/api/v1/latex/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, author, abstractText }),
    });
    const data = await r.json();
    setTexOutput(data.tex ?? '');
    setLintResult(data.lint ?? null);
  };

  useEffect(() => {
    generateLatex();
  }, []);

  const downloadTex = () => {
    const blob = new Blob([texOutput], { type: 'application/x-tex' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'research_manuscript_template.tex';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      <section className="space-y-4 border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 lg:col-span-5">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Cloud Linux LaTeX Compiler & Preamble Linter
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Enforces relative font paths (`times.ttf`, `pmingliu.ttc`) and `research-setup` for commercial-font-free Linux containers.
          </p>
        </div>

        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
          Manuscript / NSTC Proposal Title
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 block w-full border border-slate-300 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
          />
        </label>

        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
          Author / Principal Investigator
          <input
            type="text"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            className="mt-1 block w-full border border-slate-300 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
          />
        </label>

        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
          Abstract & Quantitative Summary
          <textarea
            rows={4}
            value={abstractText}
            onChange={(e) => setAbstractText(e.target.value)}
            className="mt-1 block w-full border border-slate-300 bg-white p-2.5 text-xs dark:border-slate-700 dark:bg-slate-950"
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={generateLatex}
            className="bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700"
          >
            Generate & Lint .tex
          </button>
          <button
            type="button"
            onClick={downloadTex}
            className="border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Download .tex
          </button>
        </div>

        {lintResult && (
          <div className="border-t border-slate-200 pt-3 text-xs dark:border-slate-800">
            <div className="font-mono font-semibold text-emerald-700 dark:text-emerald-400">
              {lintResult.compliant
                ? '● Linux Cloud Preamble Compliant (3/3 directives verified)'
                : `✖ Missing directives: ${lintResult.missingDirectives.join(', ')}`}
            </div>
            <ul className="mt-2 space-y-1 font-mono text-[11px] text-slate-500">
              <li>../../_common/styles/research-setup</li>
              <li>../../_common/fonts/times.ttf</li>
              <li>../../_common/fonts/pmingliu.ttc (AutoFakeBold/Slant)</li>
            </ul>
          </div>
        )}
      </section>

      <section className="border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 lg:col-span-7">
        <div className="flex items-center justify-between border-b border-slate-200 pb-2.5 dark:border-slate-800">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Generated XeLaTeX / LuaLaTeX Source (`booktabs` + `siunitx`)
          </h3>
          <span className="font-mono text-xs text-slate-500">UTF-8 · GPL-3.0</span>
        </div>
        <pre className="mt-3 max-h-[460px] overflow-auto border border-slate-200 bg-slate-50 p-4 font-mono text-xs leading-relaxed text-slate-800 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
          {texOutput}
        </pre>
      </section>
    </div>
  );
};
