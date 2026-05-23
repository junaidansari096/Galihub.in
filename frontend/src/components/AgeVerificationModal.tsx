import React from 'react';
import { ShieldAlert } from 'lucide-react';

interface AgeVerificationModalProps {
  onConfirm: () => void;
  onReject: () => void;
}

export default function AgeVerificationModal({ onConfirm, onReject }: AgeVerificationModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-fade-in">
      <div className="bg-[#1e293b] border border-[#334155] max-w-md w-full rounded-3xl p-8 text-center space-y-6 shadow-2xl relative">
        <div className="mx-auto w-16 h-16 bg-[#ff4d4d]/10 border border-[#ff4d4d]/20 rounded-full flex items-center justify-center text-[#ff4d4d]">
          <ShieldAlert className="h-8 w-8 animate-pulse" />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-black text-white uppercase tracking-wider">18+ Content Warning</h2>
          <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
            This portal archive contains extremely vulgar, offensive, and sexually explicit slang terminology intended strictly for linguistic research and adult users.
          </p>
        </div>

        <div className="bg-[#0f172a]/60 border border-[#334155]/60 rounded-2xl p-4 text-xs text-slate-400 text-left space-y-1.5 font-medium">
          <p>By entering, you confirm that:</p>
          <ul className="list-disc pl-4 space-y-1">
            <li>You are at least 18 years of age (or age of majority in your jurisdiction).</li>
            <li>You consent to viewing extreme slang terms.</li>
          </ul>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-2">
          <button
            onClick={onReject}
            className="py-3 px-4 rounded-xl border border-[#334155] hover:border-slate-400 hover:bg-slate-800 text-slate-350 hover:text-white font-bold text-sm transition-all cursor-pointer"
          >
            Exit / Leave
          </button>
          <button
            onClick={onConfirm}
            className="py-3 px-4 rounded-xl bg-[#ff4d4d] hover:bg-[#e04343] hover:shadow-lg hover:shadow-[#ff4d4d]/20 text-white font-black text-sm transition-all cursor-pointer uppercase tracking-wider text-center"
          >
            Enter / Access
          </button>
        </div>
      </div>
    </div>
  );
}
