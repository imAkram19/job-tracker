'use client';

import React, { useState } from 'react';
import { 
  X, 
  Copy, 
  Check, 
  ShieldCheck,
  Code
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
    { label: "Notice period / availability", value: "Immediate Joiner (0 days notice)" },
    { label: "Education & graduation", value: "MCA (Master of Computer Applications), 2024–2026 Batch" },
    { label: "Expected annual compensation", value: "₹4.5 – 6.5 LPA (Flexible for reputable organizations & learning opportunities)" },
    { label: "Preferred work locations", value: "Hyderabad (Primary), Bengaluru (Primary), open to relocation across India & Remote" },
    { label: "Core technical stack", value: "React, Next.js, Node.js, Express, PostgreSQL, Supabase, Tailwind CSS, TypeScript, REST APIs" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]">
      <div 
        className="w-full max-w-2xl rounded-xl bg-white border border-[rgba(17,24,39,0.08)] shadow-lg overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-[rgba(17,24,39,0.08)] flex items-center justify-between bg-white">
          <div>
            <h3 className="text-sm font-semibold text-[#111827]">Candidate Profile and ATS Reference</h3>
            <p className="text-xs text-[#6b7487]">Mohammad Akram • Quick copy cheat-sheet for job applications</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-[#6b7487] hover:text-[#111827] hover:bg-[#f5f7fa] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5 overflow-y-auto">
          
          {/* Quick Screening Answers */}
          <div>
            <h4 className="text-xs font-medium text-[#4b5565] mb-2 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[#2563eb]" />
              Standard ATS screening answers (click to copy)
            </h4>
            <div className="space-y-1.5">
              {screeningData.map((item, idx) => (
                <div 
                  key={idx}
                  className="p-3 rounded-lg bg-[#f8fafc] border border-[rgba(17,24,39,0.08)] flex items-center justify-between gap-3 group hover:border-[rgba(17,24,39,0.16)] transition-colors"
                >
                  <div className="space-y-0.5 min-w-0">
                    <span className="text-[10px] text-[#6b7487] block font-normal">
                      {item.label}
                    </span>
                    <span className="text-xs font-normal text-[#111827] block truncate">
                      {item.value}
                    </span>
                  </div>
                  <button
                    onClick={() => handleCopy(`field-${idx}`, item.value)}
                    className="p-1.5 rounded-md bg-white hover:bg-[#eceff4] text-[#4b5565] border border-[rgba(17,24,39,0.08)] transition-colors shrink-0"
                    title="Copy to clipboard"
                  >
                    {copiedKey === `field-${idx}` ? (
                      <Check className="w-3.5 h-3.5 text-[#16a34a]" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-[#6b7487]" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Flagship Projects */}
          <div>
            <h4 className="text-xs font-medium text-[#4b5565] mb-2 flex items-center gap-1.5">
              <Code className="w-3.5 h-3.5 text-[#2563eb]" />
              Production engineering projects
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="p-3 rounded-lg bg-[#f8fafc] border border-[rgba(17,24,39,0.08)] space-y-1">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-medium text-[#111827]">Cloud Gym Management</h5>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-white text-[#4b5565] border border-[rgba(17,24,39,0.08)] font-mono">
                    Next.js + Supabase
                  </span>
                </div>
                <p className="text-[11px] text-[#6b7487] leading-relaxed">
                  Multi-tenant membership tracking, recurring billing, RBAC, and analytics dashboards on PostgreSQL.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-[#f8fafc] border border-[rgba(17,24,39,0.08)] space-y-1">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-medium text-[#111827]">Biometric IoT Integration</h5>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-white text-[#4b5565] border border-[rgba(17,24,39,0.08)] font-mono">
                    Node.js + Serial/TCP
                  </span>
                </div>
                <p className="text-[11px] text-[#6b7487] leading-relaxed">
                  Real-time fingerprint/facial attendance sync, hardware-to-cloud communication, and offline queuing.
                </p>
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[rgba(17,24,39,0.08)] bg-white flex justify-end">
          <button
            onClick={onClose}
            className="h-8 px-3.5 rounded-lg text-xs font-normal text-[#4b5565] hover:text-[#111827] hover:bg-[#f5f7fa] border border-[rgba(17,24,39,0.08)] transition-colors"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
