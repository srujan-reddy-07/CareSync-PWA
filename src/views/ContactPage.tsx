import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';

interface Props {
  profile: UserProfile;
}

export default function ContactPage({ profile }: Props) {
  const [sosCountdown, setSosCountdown] = useState<number | null>(null);
  const contactName = profile.emergencyContactName || 'Emergency Contact';
  const contactPhone = profile.emergencyContactPhone || '911';

  useEffect(() => {
    if (sosCountdown === null) return;
    if (sosCountdown === 0) {
      window.location.href = `tel:${contactPhone}`;
      setSosCountdown(null);
      return;
    }
    const t = setTimeout(() => setSosCountdown(c => (c ?? 1) - 1), 1000);
    return () => clearTimeout(t);
  }, [sosCountdown, contactPhone]);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-black text-slate-900 italic px-2">Support</h2>

      <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm text-center">
        <div className="w-20 h-20 bg-blue-50 rounded-full mx-auto mb-4 flex items-center justify-center text-3xl shadow-inner">👨‍⚕️</div>
        <h3 className="text-2xl font-black text-slate-900 italic tracking-tighter">
          {contactName}
        </h3>
        <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-2">Primary Emergency Contact</p>
        {profile.emergencyContactPhone && (
          <p className="text-sm font-bold text-slate-400 mb-8">{profile.emergencyContactPhone}</p>
        )}
        {!profile.emergencyContactPhone && (
          <p className="text-[10px] font-bold text-slate-300 italic mb-8">Set contact in your Medical ID</p>
        )}

        {sosCountdown === null ? (
          <button
            onClick={() => setSosCountdown(3)}
            className="w-full bg-red-500 text-white py-6 rounded-2xl font-black shadow-lg shadow-red-100 uppercase tracking-widest text-sm active:scale-95 transition-all"
          >
            🚨 SOS Emergency
          </button>
        ) : (
          <div className="space-y-3">
            <div className="w-full bg-red-500 text-white py-6 rounded-2xl font-black shadow-lg shadow-red-100 text-center">
              <p className="text-sm uppercase tracking-widest">Calling in...</p>
              <p className="text-5xl font-black mt-1">{sosCountdown}</p>
            </div>
            <button
              onClick={() => setSosCountdown(null)}
              className="w-full py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-sm uppercase tracking-widest active:scale-95 transition-all"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 gap-3">
          <a
            href={`tel:${contactPhone}`}
            className="bg-blue-50 text-blue-600 py-4 rounded-2xl font-black text-xs uppercase tracking-widest text-center active:scale-95 transition-all"
          >
            📞 Call Contact
          </a>
          <a
            href="tel:102"
            className="bg-red-50 text-red-500 py-4 rounded-2xl font-black text-xs uppercase tracking-widest text-center active:scale-95 transition-all"
          >
            🚑 Ambulance
          </a>
        </div>
      </div>

      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Helplines</h3>
        <div className="space-y-3">
          {[
            { label: 'Medical Emergency', number: '102' },
            { label: 'Police', number: '100' },
            { label: 'Poison Control', number: '1800-116-117' },
          ].map(item => (
            <a
              key={item.number}
              href={`tel:${item.number}`}
              className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl active:bg-slate-100 transition-all"
            >
              <span className="font-bold text-slate-700 text-sm">{item.label}</span>
              <span className="font-black text-blue-600 text-sm">{item.number}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
