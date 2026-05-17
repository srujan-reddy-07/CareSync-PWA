import React, { useState, useEffect } from 'react';

export default function NotificationBanner() {
  const [status, setStatus] = useState<NotificationPermission | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!('Notification' in window)) return;
    setStatus(Notification.permission);
  }, []);

  if (!status || status === 'granted' || status === 'denied' || dismissed) return null;

  const handleEnable = () => {
    Notification.requestPermission().then(p => setStatus(p));
  };

  return (
    <div className="bg-blue-50 border border-blue-100 rounded-[1.5rem] p-4 flex items-center gap-3 mb-4">
      <span className="text-2xl">🔔</span>
      <div className="flex-1">
        <p className="font-black text-slate-800 text-xs">Enable Dose Reminders</p>
        <p className="text-[10px] font-bold text-slate-400 mt-0.5">Get notified when it's time to take your medicine</p>
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleEnable}
          className="bg-blue-600 text-white px-3 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all"
        >
          Enable
        </button>
        <button onClick={() => setDismissed(true)} className="text-slate-300 text-xl px-1">×</button>
      </div>
    </div>
  );
}
