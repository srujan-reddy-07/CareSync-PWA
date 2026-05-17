import React from 'react';
import { AppView } from '../types';

interface Props {
  currentView: AppView;
  setCurrentView: (v: AppView) => void;
}

const navItems: { view: AppView; icon: string; label: string }[] = [
  { view: 'home', icon: '🏠', label: 'Home' },
  { view: 'stock', icon: '📦', label: 'Stock' },
  { view: 'scan', icon: '📷', label: 'Scan' },
  { view: 'vault', icon: '🗂️', label: 'Vault' },
  { view: 'contact', icon: '📞', label: 'SOS' },
];

export default function BottomNav({ currentView, setCurrentView }: Props) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-md z-50">
      <nav className="bg-white/95 backdrop-blur-xl border border-slate-200 rounded-full p-3 flex items-center justify-between shadow-2xl">
        {navItems.map(item => (
          <button
            key={item.view}
            onClick={() => setCurrentView(item.view)}
            className={`flex-1 flex flex-col items-center py-1 gap-0.5 transition-all ${currentView === item.view ? 'text-blue-600' : 'text-slate-300'}`}
          >
            {item.view === 'scan' ? (
              <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all ${currentView === 'scan' ? 'bg-blue-600 text-white shadow-blue-200' : 'bg-slate-50 text-slate-300'}`}>
                {item.icon}
              </div>
            ) : (
              <>
                <span className="text-xl">{item.icon}</span>
                <span className={`text-[8px] font-black uppercase tracking-widest ${currentView === item.view ? 'text-blue-600' : 'text-slate-300'}`}>
                  {item.label}
                </span>
              </>
            )}
          </button>
        ))}
      </nav>
    </div>
  );
}
