'use client';

import React, { useState } from 'react';
import { 
  Copy, 
  Check, 
  FileText, 
  Github, 
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
    setTimeout(() => setCopiedPitch(false), 2000);
  };

  return (
    <header className="border-b border-[rgba(17,24,39,0.08)] bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
        
        {/* Main Row */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          
          {/* Left: Branding & Profile */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#eceff4] border border-[rgba(17,24,39,0.08)] flex items-center justify-center text-[#111827] font-medium text-xs tracking-tight shrink-0">
              JT
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-sm sm:text-base font-semibold text-[#111827] tracking-tight">
                  Job Tracker
                </h1>
                <span className="text-[11px] px-2 py-0.5 rounded-md bg-[#eceff4] text-[#4b5565] border border-[rgba(17,24,39,0.08)] font-normal">
                  Mohammad Akram
                </span>
              </div>
              <p className="text-xs text-[#6b7487] font-normal hidden sm:block">
                Permanent full-time technology roles • MCA 2026
              </p>
            </div>
          </div>

          {/* Right: Actions & Signature Telemetry Status */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-[rgba(17,24,39,0.06)]">
            
            {/* Signature Live status dot */}
            <div 
              className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-mono border border-[rgba(17,24,39,0.08)] bg-[#f5f7fa] text-[#4b5565] shrink-0"
              title={isSupabaseConfigured ? "Connected to Supabase PostgreSQL cloud sync" : "Running on LocalStorage fallback"}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isSupabaseConfigured ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              <span className="hidden xs:inline">{isSupabaseConfigured ? 'Supabase Synced' : 'Local Storage'}</span>
              <span className="xs:hidden">{isSupabaseConfigured ? 'Synced' : 'Local'}</span>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Copy Pitch Button */}
              <button
                onClick={copyPitch}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[#f5f7fa] hover:bg-[#eceff4] text-[#4b5565] hover:text-[#111827] border border-[rgba(17,24,39,0.08)] transition-colors"
                title="Copy 60-second elevator pitch"
              >
                {copiedPitch ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700 font-medium">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-[#6b7487]" />
                    <span className="hidden xs:inline">Copy Pitch</span>
                    <span className="xs:hidden">Pitch</span>
                  </>
                )}
              </button>

              {/* Dossier Modal Button */}
              <button
                onClick={onOpenDossier}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#2563eb] hover:bg-[#1d4ed8] text-white transition-colors"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Dossier</span>
              </button>

              {/* Export Modal Button */}
              <button
                onClick={onOpenExport}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white hover:bg-[#f5f7fa] text-[#4b5565] hover:text-[#111827] border border-[rgba(17,24,39,0.08)] transition-colors"
                title="Export applications or backup"
              >
                <DownloadCloud className="w-3.5 h-3.5 text-[#6b7487]" />
                <span className="hidden sm:inline">Export</span>
              </button>

              {/* GitHub Link */}
              <a
                href="https://github.com/imAkram19/job-tracker"
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-lg bg-white hover:bg-[#f5f7fa] text-[#6b7487] hover:text-[#111827] border border-[rgba(17,24,39,0.08)] transition-colors shrink-0"
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
