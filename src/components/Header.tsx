'use client';

import React, { useState } from 'react';
import { 
  Copy, 
  Check, 
  FileText, 
  Github, 
  Database, 
  DownloadCloud
} from 'lucide-react';
import { isSupabaseConfigured } from '@/lib/supabase';

interface HeaderProps {
  onOpenDossier: () => void;
  onOpenExport: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenDossier, onOpenExport }) => {
  const [copiedPitch, setCopiedPitch] = useState(false);

  const pitchText = 
    "Hi, I am Mohammad Akram, an MCA (2024-2026) fresher specializing in full-stack web engineering with React, Next.js, Node.js, and Supabase/PostgreSQL. I have built and deployed a production multi-tenant Gym Management platform and an IoT biometric synchronization agent. I am an immediate joiner eager to contribute high-impact code. Let's connect!";

  const copyPitch = () => {
    navigator.clipboard.writeText(pitchText);
    setCopiedPitch(true);
    setTimeout(() => setCopiedPitch(false), 2500);
  };

  return (
    // Non-sticky header that scrolls naturally with page
    <header className="border-b border-slate-200/90 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
        
        {/* Main Row */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          
          {/* Left: Branding & Profile */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-xs font-bold text-sm shrink-0">
              MA
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                  Mohammad Akram
                </h1>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-medium">
                  MCA 2026 Fresher
                </span>
              </div>
              <p className="text-xs text-slate-500 font-normal hidden sm:block">
                Job Application Command Center • Hyderabad / Bengaluru / Remote
              </p>
            </div>
          </div>

          {/* Right: Actions & Badges */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
            
            {/* Supabase status badge */}
            <div 
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border shrink-0 ${
                isSupabaseConfigured 
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}
              title={isSupabaseConfigured ? "Connected to Supabase PostgreSQL cloud sync" : "Running on LocalStorage fallback"}
            >
              <Database className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden xs:inline">{isSupabaseConfigured ? 'Supabase Synced' : 'Local Storage'}</span>
              <span className="xs:hidden">{isSupabaseConfigured ? 'Synced' : 'Local'}</span>
            </div>

            <div className="flex items-center gap-2">
              {/* Copy Pitch Button */}
              <button
                onClick={copyPitch}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition active:scale-95 shadow-2xs"
                title="Copy 60-second elevator pitch"
              >
                {copiedPitch ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700 font-medium">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-500" />
                    <span className="hidden xs:inline">Copy Pitch</span>
                    <span className="xs:hidden">Pitch</span>
                  </>
                )}
              </button>

              {/* Dossier Modal Button */}
              <button
                onClick={onOpenDossier}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white transition shadow-sm active:scale-95"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Dossier</span>
              </button>

              {/* Export Modal Button */}
              <button
                onClick={onOpenExport}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 transition shadow-2xs"
                title="Export applications or backup"
              >
                <DownloadCloud className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden sm:inline">Export</span>
              </button>

              {/* GitHub Link */}
              <a
                href="https://github.com/imAkram19/job-tracker"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-900 border border-slate-200 transition shadow-2xs shrink-0"
                title="GitHub Repo"
              >
                <Github className="w-3.5 h-3.5" />
              </a>
            </div>

          </div>

        </div>

      </div>
    </header>
  );
};
