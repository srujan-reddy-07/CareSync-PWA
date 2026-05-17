import React, { useState } from 'react';
import { Medicine } from '../types';
import MedicineAutocomplete from '../components/MedicineAutocomplete';
import DrugInteractionWarning from '../components/DrugInteractionWarning';
import { checkDrugInteractions, DetectedInteraction } from '../data/drugInteractions';

interface Props {
  medicines: Medicine[];
  setMedicines: React.Dispatch<React.SetStateAction<Medicine[]>>;
}

function formatTime(t: string) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

const FREQ_PRESETS = [
  { label: 'Once daily', times: ['08:00'] },
  { label: 'Twice daily', times: ['08:00', '20:00'] },
  { label: 'Three times', times: ['08:00', '14:00', '21:00'] },
  { label: 'Four times', times: ['06:00', '12:00', '18:00', '22:00'] },
  { label: 'Nightly', times: ['22:00'] },
  { label: 'Custom', times: [] },
];

export default function StockPage({ medicines, setMedicines }: Props) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [addingStockId, setAddingStockId] = useState<string | null>(null);
  const [addStockQty, setAddStockQty] = useState('10');
  const [form, setForm] = useState({
    name: '', stock: '', doseTimes: ['08:00'], doseQuantity: '1', dosage: '', instructions: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [customMode, setCustomMode] = useState(false);
  const [pendingMed, setPendingMed] = useState<Medicine | null>(null);
  const [interactions, setInteractions] = useState<DetectedInteraction[]>([]);

  const buildMed = (): Medicine => ({
    id: crypto.randomUUID(),
    name: form.name.trim(),
    stock: parseInt(form.stock),
    doseTime: form.doseTimes[0] ?? '08:00',
    doseTimes: form.doseTimes.length ? form.doseTimes : ['08:00'],
    doseQuantity: parseInt(form.doseQuantity) || 1,
    dosage: form.dosage.trim() || undefined,
    instructions: form.instructions.trim() || undefined,
    taken: false,
    takenTimes: [],
  });

  const handleAddMedicine = () => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = 'Medicine name is required';
    if (!form.stock || isNaN(Number(form.stock)) || Number(form.stock) < 0) errs.stock = 'Enter a valid stock count';
    if (!form.doseTimes.length) errs.doseTimes = 'Add at least one dose time';
    setFormErrors(errs);
    if (Object.keys(errs).length) return;

    const sameName = medicines.find(m => m.name.trim().toLowerCase() === form.name.trim().toLowerCase());
    if (sameName) { setFormErrors({ name: `"${sameName.name}" is already in your schedule` }); return; }

    const found = checkDrugInteractions(form.name.trim(), medicines.map(m => m.name));
    if (found.length > 0) { setPendingMed(buildMed()); setInteractions(found); return; }
    commitAdd(buildMed());
  };

  const commitAdd = (med: Medicine) => {
    setMedicines(prev => [...prev, med]);
    setForm({ name: '', stock: '', doseTimes: ['08:00'], doseQuantity: '1', dosage: '', instructions: '' });
    setShowAddForm(false);
    setFormErrors({});
    setCustomMode(false);
    setPendingMed(null);
    setInteractions([]);
  };

  const addTime = () => {
    if (form.doseTimes.length >= 4) return;
    setForm(f => ({ ...f, doseTimes: [...f.doseTimes, '12:00'] }));
  };
  const removeTime = (i: number) => setForm(f => ({ ...f, doseTimes: f.doseTimes.filter((_, idx) => idx !== i) }));
  const updateTime = (i: number, val: string) => setForm(f => ({ ...f, doseTimes: f.doseTimes.map((t, idx) => idx === i ? val : t) }));

  // Custom: explicit toggle state — clicking Custom sets it; any named preset clears it
  const applyPreset = (times: string[]) => {
    if (times.length === 0) {
      setCustomMode(true); // enter custom mode — times stay as-is for user to edit
    } else {
      setCustomMode(false);
      setForm(f => ({ ...f, doseTimes: [...times] }));
    }
  };

  const presetIsActive = (p: { label: string; times: string[] }) => {
    if (p.times.length === 0) return customMode; // "Custom" button
    if (customMode) return false;
    return p.times.length === form.doseTimes.length && p.times.every((t, i) => t === form.doseTimes[i]);
  };

  const handleAddStock = (id: string) => {
    const qty = parseInt(addStockQty);
    if (isNaN(qty) || qty <= 0) return;
    setMedicines(prev => prev.map(m => m.id === id ? { ...m, stock: m.stock + qty } : m));
    setAddingStockId(null); setAddStockQty('10');
  };

  const handleDelete = (id: string) => setMedicines(prev => prev.filter(m => m.id !== id));

  return (
    <div className="space-y-6">
      {pendingMed && interactions.length > 0 && (
        <DrugInteractionWarning
          newDrug={pendingMed.name}
          interactions={interactions}
          onProceed={() => commitAdd(pendingMed)}
          onCancel={() => { setPendingMed(null); setInteractions([]); }}
        />
      )}

      <div className="flex justify-between items-center px-2">
        <h2 className="text-2xl font-black text-slate-900 italic">Inventory</h2>
        <button
          onClick={() => { setShowAddForm(s => !s); setFormErrors({}); }}
          className={`w-11 h-11 rounded-full font-black text-xl shadow-lg transition-all ${showAddForm ? 'bg-slate-300 text-white rotate-45' : 'bg-blue-600 text-white active:scale-90'}`}
        >+</button>
      </div>

      {showAddForm && (
        <div className="bg-white rounded-[2rem] p-6 border border-blue-100 shadow-sm space-y-4 animate-in slide-in-from-top-4 duration-300">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Add New Medicine</h3>

          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Medicine Name</label>
            <MedicineAutocomplete value={form.name} onChange={val => setForm(f => ({ ...f, name: val }))} hasError={!!formErrors.name} />
            {formErrors.name && <p className="text-red-500 text-[10px] font-bold mt-1 ml-1">{formErrors.name}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Total Stock</label>
              <input type="number" min="0" value={form.stock} onChange={e => setForm(f => ({ ...f, stock: e.target.value }))} placeholder="e.g. 30"
                className={`w-full p-4 bg-slate-50 border rounded-xl font-bold text-sm outline-none mt-1 focus:ring-2 focus:ring-blue-100 ${formErrors.stock ? 'border-red-300 bg-red-50' : 'border-slate-100'}`} />
              {formErrors.stock && <p className="text-red-500 text-[10px] font-bold mt-1 ml-1">{formErrors.stock}</p>}
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Pills per dose</label>
              <input type="number" min="1" value={form.doseQuantity} onChange={e => setForm(f => ({ ...f, doseQuantity: e.target.value }))}
                className="w-full p-4 bg-slate-50 border border-slate-100 rounded-xl font-bold text-sm outline-none mt-1 focus:ring-2 focus:ring-blue-100" />
              <p className="text-[9px] text-slate-300 font-bold ml-1 mt-0.5">How many pills each time</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Strength <span className="normal-case font-medium">(opt)</span></label>
              <input type="text" value={form.dosage} onChange={e => setForm(f => ({ ...f, dosage: e.target.value }))} placeholder="e.g. 500mg"
                className="w-full p-4 bg-slate-50 border border-slate-100 rounded-xl font-bold text-sm outline-none mt-1 focus:ring-2 focus:ring-blue-100" />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Instructions <span className="normal-case font-medium">(opt)</span></label>
              <input type="text" value={form.instructions} onChange={e => setForm(f => ({ ...f, instructions: e.target.value }))} placeholder="e.g. After meals"
                className="w-full p-4 bg-slate-50 border border-slate-100 rounded-xl font-bold text-sm outline-none mt-1 focus:ring-2 focus:ring-blue-100" />
            </div>
          </div>

          {/* Frequency presets */}
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Frequency</label>
            <div className="flex flex-wrap gap-2">
              {FREQ_PRESETS.map(p => (
                <button key={p.label} onClick={() => applyPreset(p.times)}
                  className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                    presetIsActive(p) ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-blue-300'
                  }`}>{p.label}</button>
              ))}
            </div>
          </div>

          {/* Individual time pickers */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Dose Times</label>
              {form.doseTimes.length < 4 && (
                <button onClick={addTime} className="text-[10px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 px-3 py-1 rounded-lg">+ Add Time</button>
              )}
            </div>
            <div className="space-y-2">
              {form.doseTimes.map((t, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center text-[10px] font-black text-blue-600">{i + 1}</div>
                  <input type="time" value={t} onChange={e => updateTime(i, e.target.value)}
                    className="flex-1 p-3 bg-slate-50 border border-slate-100 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-100" />
                  {form.doseTimes.length > 1 && (
                    <button onClick={() => removeTime(i)} className="w-7 h-7 text-slate-300 hover:text-red-400 font-black text-lg transition-colors">×</button>
                  )}
                </div>
              ))}
            </div>
            {formErrors.doseTimes && <p className="text-red-500 text-[10px] font-bold mt-1 ml-1">{formErrors.doseTimes}</p>}
          </div>

          <button onClick={handleAddMedicine}
            className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black text-sm shadow-lg shadow-blue-100 active:scale-95 transition-all uppercase tracking-widest">
            Add to Inventory
          </button>
        </div>
      )}

      {medicines.length === 0 && !showAddForm && (
        <div className="bg-white/50 border-2 border-dashed border-slate-200 rounded-[2.5rem] p-12 text-center">
          <p className="text-slate-300 font-bold text-sm italic">No medicines yet</p>
          <p className="text-[10px] font-bold text-slate-300 mt-1">Tap + to add your first medicine</p>
        </div>
      )}

      <div className="space-y-4">
        {medicines.map(med => {
          const times = med.doseTimes?.length ? med.doseTimes : [med.doseTime];
          const pct = Math.min(100, (med.stock / Math.max(med.stock + 10, 30)) * 100);
          const isLow = med.stock <= 5;
          return (
            <div key={med.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-lg">💊</div>
                  <div>
                    <span className="font-bold text-slate-800 italic">{med.name}{med.dosage ? <span className="text-blue-500 font-black text-sm"> {med.dosage}</span> : ''}</span>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      {times.map(formatTime).join(' · ')} • {med.doseQuantity} pill(s) each dose
                    </p>
                    {med.instructions && (
                      <p className="text-[9px] font-bold text-blue-500 italic mt-1">Note: {med.instructions}</p>
                    )}
                    {times.length > 1 && (
                      <span className="text-[8px] font-black text-blue-500 bg-blue-50 px-2 py-0.5 rounded-md uppercase tracking-widest">
                        {times.length}× daily
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => { setAddingStockId(addingStockId === med.id ? null : med.id); setAddStockQty('10'); }}
                    className="text-blue-600 bg-blue-50 w-8 h-8 rounded-lg font-black text-lg flex items-center justify-center active:scale-90 transition-all">+</button>
                  <button onClick={() => handleDelete(med.id)}
                    className="text-slate-300 hover:text-red-400 w-8 h-8 rounded-lg font-black text-lg flex items-center justify-center transition-colors">×</button>
                </div>
              </div>

              {addingStockId === med.id && (
                <div className="flex items-center gap-2 mb-4 animate-in slide-in-from-top-2 duration-200">
                  <input type="number" min="1" value={addStockQty} onChange={e => setAddStockQty(e.target.value)} autoFocus
                    className="flex-1 bg-slate-50 border border-slate-100 rounded-xl p-3 font-bold text-sm outline-none focus:ring-2 focus:ring-blue-100" />
                  <button onClick={() => handleAddStock(med.id)} className="bg-blue-600 text-white px-4 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest active:scale-95">Add</button>
                </div>
              )}

              <div className="flex items-baseline gap-2 mb-2">
                <span className={`text-3xl font-black ${isLow ? 'text-red-500' : 'text-blue-600'}`}>{Math.max(0, med.stock)}</span>
                <span className="text-[10px] font-black text-slate-300 uppercase">Tabs Left</span>
                {isLow && <span className="text-[10px] font-black text-red-500 uppercase bg-red-50 px-2 py-0.5 rounded-md ml-1">Low Stock</span>}
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className={`h-full transition-all rounded-full ${isLow ? 'bg-red-400' : 'bg-blue-500'}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
