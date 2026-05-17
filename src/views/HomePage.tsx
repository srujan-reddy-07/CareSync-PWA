import React from 'react';
import { Medicine, UserProfile } from '../types';

interface Props {
  medicines: Medicine[];
  setMedicines: React.Dispatch<React.SetStateAction<Medicine[]>>;
  profile: UserProfile;
}

function formatTime(time24: string) {
  if (!time24) return '';
  const [h, m] = time24.split(':').map(Number);
  return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

function toMins(t: string) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

type DoseEvent = {
  med: Medicine;
  time: string;
  taken: boolean;
  mins: number;
};

export default function HomePage({ medicines, setMedicines }: Props) {
  // Build flat list of all dose events, sorted by time
  const allEvents: DoseEvent[] = medicines
    .flatMap(m => {
      const times = m.doseTimes?.length ? m.doseTimes : [m.doseTime];
      return times.map(t => ({
        med: m,
        time: t,
        taken: m.takenTimes?.includes(t) ?? m.taken,
        mins: toMins(t),
      }));
    })
    .sort((a, b) => a.mins - b.mins);

  const nowMins = new Date().getHours() * 60 + new Date().getMinutes();
  const nextEvent = allEvents.find(e => !e.taken && e.mins > nowMins)
    ?? allEvents.find(e => !e.taken)
    ?? null;

  const takeDose = (medId: string, time: string) => {
    setMedicines(prev => prev.map(m => {
      if (m.id !== medId) return m;
      if (m.takenTimes?.includes(time)) return m; // already taken
      const takenTimes = [...(m.takenTimes ?? []), time];
      const times = m.doseTimes?.length ? m.doseTimes : [m.doseTime];
      const taken = takenTimes.length >= times.length;
      return { ...m, takenTimes, taken, stock: Math.max(0, m.stock - m.doseQuantity) };
    }));
  };

  const nextTimeParts = nextEvent ? formatTime(nextEvent.time).split(' ') : ['--', '--'];

  return (
    <div className="space-y-6">

      {/* Next Dose hero */}
      <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 text-center">
        <span className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.2em] block mb-4 italic underline decoration-blue-100 underline-offset-4">Next Dose</span>
        {nextEvent ? (
          <>
            <div className="flex items-baseline justify-center gap-2 text-[#0F172A] mb-2">
              <span className="text-6xl font-black tracking-tighter">{formatTime(nextEvent.time).split(' ')[0]}</span>
              <span className="text-xl font-bold text-slate-300">{formatTime(nextEvent.time).split(' ')[1]}</span>
            </div>
            <p className="text-slate-500 font-bold text-xs italic">
              {nextEvent.med.name} • {nextEvent.med.doseQuantity} tab(s)
            </p>
            {nextEvent.med.instructions && (
              <p className="mt-2 text-[10px] font-black text-blue-500 uppercase tracking-widest bg-blue-50 py-1.5 px-3 rounded-xl inline-block">
                ℹ️ {nextEvent.med.instructions}
              </p>
            )}
          </>
        ) : (
          <>
            <div className="flex items-center justify-center mb-3">
              <span className="text-5xl">🎉</span>
            </div>
            <p className="text-slate-700 font-black text-base">All doses taken for today!</p>
            <p className="text-slate-400 font-medium text-xs mt-1">Great job staying on track</p>
          </>
        )}
      </div>

      {/* Medicine cards — one per medicine, with per-dose-time rows */}
      {medicines.map(med => {
        const times = med.doseTimes?.length ? med.doseTimes : [med.doseTime];
        const allTaken = times.every(t => med.takenTimes?.includes(t) ?? med.taken);
        return (
          <div
            key={med.id}
            className={`p-6 bg-white rounded-[2.2rem] border transition-all ${allTaken ? 'opacity-60 border-slate-50' : 'border-slate-100 shadow-sm'}`}
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-2xl">💊</div>
              <div>
                <span className={`text-xl font-bold ${allTaken ? 'line-through text-slate-300' : ''}`}>{med.name}</span>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Stock: {Math.max(0, med.stock)} left • {med.doseQuantity} pill(s){med.dosage ? ` • ${med.dosage}` : ''}
                </p>
                {med.instructions && (
                  <p className={`mt-1 text-[9px] font-bold ${allTaken ? 'text-slate-300' : 'text-blue-500'} italic`}>
                    Note: {med.instructions}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              {times.map(t => {
                const isTaken = med.takenTimes?.includes(t) ?? (allTaken);
                const outOfStock = med.stock <= 0;
                return (
                  <div key={t} className={`flex items-center justify-between px-4 py-3 rounded-2xl ${isTaken ? 'bg-green-50' : 'bg-slate-50'}`}>
                    <span className="text-sm font-black text-slate-500">{formatTime(t)}</span>
                    {!isTaken && !outOfStock && (
                      <button
                        onClick={() => takeDose(med.id, t)}
                        className="bg-blue-600 text-white px-5 py-1.5 rounded-xl font-black text-xs shadow-sm active:scale-95 transition-all"
                      >TAKE</button>
                    )}
                    {!isTaken && outOfStock && (
                      <span className="text-[10px] font-black text-red-500 uppercase tracking-widest bg-red-50 px-3 py-1 rounded-lg">OUT OF STOCK</span>
                    )}
                    {isTaken && (
                      <span className="text-[10px] font-black text-green-500 uppercase tracking-widest bg-green-100 px-3 py-1 rounded-lg">✓ TAKEN</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {medicines.length === 0 && (
        <div className="bg-white/50 border-2 border-dashed border-slate-200 rounded-[2.5rem] p-12 text-center">
          <p className="text-slate-300 font-bold text-sm italic">No medicines scheduled</p>
          <p className="text-[10px] font-bold text-slate-300 mt-1">Go to Inventory to add your first medicine</p>
        </div>
      )}

      {/* Full day timeline */}
      {allEvents.length > 0 && (
        <div className="bg-white/50 border border-slate-200 rounded-[2.5rem] p-6">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 italic">Today&apos;s Schedule</h3>
          <ul className="space-y-3">
            {allEvents.map((ev, i) => (
              <li key={`${ev.med.id}-${ev.time}-${i}`} className="flex flex-col gap-0.5 py-1.5 border-b border-slate-100 last:border-0">
                <div className={`flex justify-between font-bold text-sm ${ev.taken ? 'text-slate-300 line-through' : 'text-slate-700'}`}>
                  <span>• {ev.med.name}</span>
                  <span>{ev.taken ? 'Done ✓' : formatTime(ev.time)}</span>
                </div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">
                  Take {ev.med.doseQuantity} tab(s) {ev.med.instructions ? `— ${ev.med.instructions}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
