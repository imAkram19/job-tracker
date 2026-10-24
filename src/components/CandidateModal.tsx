'use client';

import React, { useState } from 'react';
import { 
  X, 
  Copy, 
  Check, 
  User, 
  Code, 
  ShieldCheck 
} from 'lucide-react';

interface CandidateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CandidateModal: React.FC<CandidateModalProps> = ({ isOpen, onClose }) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const screeningData = [
    { label: "Notice Period / Availability", value: "Immediate Joiner (0 days notice)" },
    { label: "Current Education & Batch", value: "MCA (Master of Computer Applications), 2024–2026 Batch" },
    { label: "Expected Annual CTC", value: "₹4.5 – 6.5 LPA (Flexible for reputable organizations & learning opportunities)" },
    { label: "Preferred Work Locations", value: "Hyderabad (Primary), Bengaluru (Primary), open to relocation across India & Remote" },
    { label: "Core Technical Stack", value: "React, Next.js, Node.js, Express, PostgreSQL, Supabase, Tailwind CSS, TypeScript, REST APIs" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="w-full max-w-2xl rounded-xl bg-white border border-slate-200 shadow-xl overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center font-bold">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Candidate Profile & ATS Answers</h3>
              <p className="text-xs text-slate-500">Mohammad Akram • Quick copy cheat-sheet for job portals</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5 overflow-y-auto">
          
          {/* Quick Screening Answers */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2.5 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Standard ATS Application Answers (1-Click Copy)
            </h4>
            <div className="space-y-2">
              {screeningData.map((item, idx) => (
                <div 
                  key={idx}
                  className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between gap-3 group hover:border-slate-300 transition"
                >
                  <div className="space-y-0.5 min-w-0">
                    <span className="text-[10px] font-semibold text-slate-500 block uppercase tracking-wider">
                      {item.label}
                    </span>
                    <span className="text-xs font-medium text-slate-800 block truncate">
                      {item.value}
                    </span>
                  </div>
                  <button
                    onClick={() => handleCopy(`field-${idx}`, item.value)}
                    className="p-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 transition shrink-0 shadow-2xs"
                    title="Copy to clipboard"
                  >
                    {copiedKey === `field-${idx}` ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Flagship Projects */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2.5 flex items-center gap-1.5">
              <Code className="w-4 h-4 text-blue-600" />
              Flagship Production Projects
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-bold text-slate-900">Cloud Gym Management</h5>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-mono">
                    Next.js + Supabase
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Multi-tenant membership tracking, recurring billing, RBAC, and analytics dashboards on PostgreSQL.
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-bold text-slate-900">Biometric IoT Integration</h5>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono">
                    Node.js + Serial/TCP
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Real-time fingerprint/facial attendance sync, hardware-to-cloud communication, and offline queuing.
                </p>
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50/70 flex justify-end">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-slate-200 hover:bg-slate-300 text-slate-800 transition"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
