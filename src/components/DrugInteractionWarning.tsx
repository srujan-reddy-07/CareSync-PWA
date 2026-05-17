import React from 'react';
import { DetectedInteraction, Severity } from '../data/drugInteractions';

interface Props {
  newDrug: string;
  interactions: DetectedInteraction[];
  onProceed: () => void;
  onCancel: () => void;
}

const SEVERITY_CONFIG: Record<Severity, { bg: string; border: string; badge: string; icon: string; label: string }> = {
  major:    { bg: 'bg-red-50',    border: 'border-red-200',    badge: 'bg-red-500 text-white',     icon: '🚨', label: 'MAJOR' },
  moderate: { bg: 'bg-orange-50', border: 'border-orange-200', badge: 'bg-orange-500 text-white',  icon: '⚠️', label: 'MODERATE' },
  minor:    { bg: 'bg-yellow-50', border: 'border-yellow-200', badge: 'bg-yellow-500 text-white',  icon: 'ℹ️', label: 'MINOR' },
};

export default function DrugInteractionWarning({ newDrug, interactions, onProceed, onCancel }: Props) {
  const hasMajor = interactions.some(i => i.severity === 'major');

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center p-4 animate-in fade-in duration-200" onClick={onCancel}>
      <div
        className="bg-white rounded-[2.5rem] w-full max-w-md p-8 shadow-2xl animate-in slide-in-from-bottom-8 duration-300 max-h-[80vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`flex items-center gap-3 mb-6 p-4 rounded-2xl ${hasMajor ? 'bg-red-50 border border-red-100' : 'bg-orange-50 border border-orange-100'}`}>
          <span className="text-3xl">{hasMajor ? '🚨' : '⚠️'}</span>
          <div>
            <h2 className="font-black text-slate-900 italic text-lg">Drug Interaction Detected</h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
              Adding <span className={hasMajor ? 'text-red-600' : 'text-orange-600'}>{newDrug}</span> may interact with {interactions.length} existing medicine{interactions.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Interactions list */}
        <div className="space-y-3 mb-6">
          {interactions.map((ix, i) => {
            const cfg = SEVERITY_CONFIG[ix.severity];
            return (
              <div key={i} className={`rounded-2xl p-4 border ${cfg.bg} ${cfg.border}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{cfg.icon}</span>
                    <span className="font-black text-slate-800 text-sm">{newDrug}</span>
                    <span className="text-slate-300 font-bold">+</span>
                    <span className="font-black text-slate-800 text-sm">{ix.withDrug}</span>
                  </div>
                  <span className={`text-[8px] font-black px-2 py-0.5 rounded-full ${cfg.badge}`}>{cfg.label}</span>
                </div>
                <p className="text-xs font-bold text-slate-700 mb-1">⚡ {ix.effect}</p>
                <p className="text-[10px] font-bold text-slate-500">💡 {ix.advice}</p>
              </div>
            );
          })}
        </div>

        {/* Disclaimer */}
        <div className="bg-slate-50 rounded-2xl p-4 mb-6 border border-slate-100">
          <p className="text-[10px] font-bold text-slate-400">
            ⚕️ This is informational only. Consult your doctor or pharmacist before making any medication changes.
          </p>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          {!hasMajor && (
            <button onClick={onProceed}
              className="w-full bg-orange-500 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest active:scale-95 transition-all shadow-lg shadow-orange-100">
              Add Anyway — I've Consulted My Doctor
            </button>
          )}
          {hasMajor && (
            <button onClick={onProceed}
              className="w-full bg-red-500 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest active:scale-95 transition-all shadow-lg shadow-red-100">
              Override — My Doctor Approved This
            </button>
          )}
          <button onClick={onCancel}
            className="w-full py-4 text-slate-400 font-black text-sm uppercase tracking-widest active:scale-95 transition-all">
            Cancel — Don't Add
          </button>
        </div>
      </div>
    </div>
  );
}
