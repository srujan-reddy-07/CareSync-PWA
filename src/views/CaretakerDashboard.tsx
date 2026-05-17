import React, { useState, useEffect, useRef } from 'react';
import { UserProfile } from '../types';
import { api } from '../lib/api';
import { MEDICINE_NAMES } from '../data/medicineNames';
import { ScannedMed, extractMedicinesFromText, preprocessForOCR } from '../lib/ocr';

interface Props {
  profile: UserProfile;
  onLogout: () => void;
  apiToken: string | null;
}

type CaretakerView = 'patients' | 'alerts' | 'reports' | 'link' | 'profile';

interface RealPatient {
  id: string;
  name: string;
  phone: string;
  medicines: Array<{ id: string; name: string; taken: boolean; doseTime: string; stock: number; doseQuantity: number }>;
}

// ─── Demo patients shown when the demo caretaker account is used ──────────────
const DEMO_PATIENTS: RealPatient[] = [
  {
    id: 'demo-1',
    name: 'Rajesh Kumar',
    phone: '9876543210',
    medicines: [
      { id: 'd1m1', name: 'Metformin',    taken: true,  doseTime: '08:00', stock: 18, doseQuantity: 1 },
      { id: 'd1m2', name: 'Amlodipine',  taken: true,  doseTime: '08:00', stock: 4,  doseQuantity: 1 },
      { id: 'd1m3', name: 'Atorvastatin',taken: false, doseTime: '21:00', stock: 22, doseQuantity: 1 },
      { id: 'd1m4', name: 'Aspirin',      taken: false, doseTime: '12:30', stock: 3,  doseQuantity: 1 },
    ],
  },
  {
    id: 'demo-2',
    name: 'Priya Sharma',
    phone: '9123456789',
    medicines: [
      { id: 'd2m1', name: 'Levothyroxine', taken: true, doseTime: '07:00', stock: 30, doseQuantity: 1 },
      { id: 'd2m2', name: 'Calcium',        taken: true, doseTime: '13:00', stock: 14, doseQuantity: 2 },
      { id: 'd2m3', name: 'Vitamin D3',     taken: true, doseTime: '13:00', stock: 27, doseQuantity: 1 },
    ],
  },
  {
    id: 'demo-3',
    name: 'Ananya Mehta',
    phone: '9988776655',
    medicines: [
      { id: 'd3m1', name: 'Amoxicillin', taken: false, doseTime: '09:00', stock: 12, doseQuantity: 1 },
      { id: 'd3m2', name: 'Ibuprofen',   taken: false, doseTime: '14:00', stock: 2,  doseQuantity: 1 },
    ],
  },
];

const WEEK_DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function calcAdherence(medicines: RealPatient['medicines']) {
  if (!medicines.length) return 0;
  const taken = medicines.filter(m => m.taken).length;
  return Math.round((taken / medicines.length) * 100);
}

function formatTime(t: string) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const p = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${p}`;
}

function isMissed(doseTime: string, taken: boolean): boolean {
  if (taken) return false;
  const [h, m] = doseTime.split(':').map(Number);
  const dose = new Date();
  dose.setHours(h, m, 0, 0);
  return new Date() > dose;
}

const FREQ_PRESETS = [
  { label: 'Once', times: ['08:00'] },
  { label: 'Twice', times: ['08:00', '20:00'] },
  { label: '3×/day', times: ['08:00', '14:00', '21:00'] },
  { label: '4×/day', times: ['06:00', '12:00', '18:00', '22:00'] },
  { label: 'Nightly', times: ['22:00'] },
  { label: 'Custom', times: [] },
];

export default function CaretakerDashboard({ profile, onLogout, apiToken }: Props) {
  const [view, setView] = useState<CaretakerView>('patients');
  const [selectedPatient, setSelectedPatient] = useState<string | null>(null);
  const [patients, setPatients] = useState<RealPatient[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(false);
  const [linkPhone, setLinkPhone] = useState('');
  const [linkStatus, setLinkStatus] = useState('');
  const [linkError, setLinkError] = useState('');
  const [linking, setLinking] = useState(false);
  const [showProfileSheet, setShowProfileSheet] = useState(false);

  const [refillMedId, setRefillMedId] = useState<string | null>(null);
  const [refillQty, setRefillQty] = useState('10');
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [addTab, setAddTab] = useState<'manual' | 'scan'>('manual');
  const [addForm, setAddForm] = useState({ name: '', stock: '30', doseTimes: ['08:00'], doseQuantity: '1', dosage: '', instructions: '' });
  const [addCustomMode, setAddCustomMode] = useState(false);
  const [addFormError, setAddFormError] = useState('');
  const [savingMed, setSavingMed] = useState(false);
  const [ctScanState, setCtScanState] = useState<'idle' | 'processing' | 'results'>('idle');
  const [ctScanResults, setCtScanResults] = useState<ScannedMed[]>([]);
  const [ctScanError, setCtScanError] = useState('');
  const [ctScanProgress, setCtScanProgress] = useState(0);
  const ctUploadInputRef = useRef<HTMLInputElement>(null);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const cameraVideoRef = useRef<HTMLVideoElement>(null);
  const cameraCanvasRef = useRef<HTMLCanvasElement>(null);

  const initials = profile.name
    ? profile.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : 'CT';

  const isDemo = profile.name === 'Demo Caretaker';

  useEffect(() => {
    if (isDemo) {
      setPatients(DEMO_PATIENTS);
      return;
    }
    if (!apiToken) return;
    setLoadingPatients(true);
    api.caretaker.patients()
      .then(data => setPatients(data as RealPatient[]))
      .catch(() => {})
      .finally(() => setLoadingPatients(false));
  }, [apiToken, isDemo]);

  const handleLink = async () => {
    if (!linkPhone || linkPhone.length < 10) { setLinkError('Enter a valid 10-digit number'); return; }
    setLinking(true); setLinkError(''); setLinkStatus('');
    try {
      await api.caretaker.link(linkPhone);
      const data = await api.caretaker.patients();
      setPatients(data as RealPatient[]);
      setLinkStatus('Patient linked successfully!');
      setLinkPhone('');
      setTimeout(() => { setView('patients'); setLinkStatus(''); }, 1500);
    } catch (err: any) {
      setLinkError(err.message || 'Failed to link patient');
    } finally {
      setLinking(false);
    }
  };

  const handleAddMed = async (med: { name: string; stock: number; doseTime: string; doseTimes?: string[]; doseQuantity: number; dosage?: string; instructions?: string }) => {
    if (!selectedPatient) return;
    setSavingMed(true);
    try {
      const newEntry = { id: crypto.randomUUID(), name: med.name, taken: false, doseTime: med.doseTime, doseTimes: med.doseTimes || [med.doseTime], takenTimes: [], stock: med.stock, doseQuantity: med.doseQuantity, dosage: med.dosage, instructions: med.instructions };
      if (isDemo) {
        setPatients(prev => prev.map(p => p.id === selectedPatient ? { ...p, medicines: [...p.medicines, newEntry] } : p));
      } else {
        await api.caretaker.addMedicine(selectedPatient, med);
        const data = await api.caretaker.patients();
        setPatients(data as RealPatient[]);
      }
      setAddForm({ name: '', stock: '30', doseTimes: ['08:00'], doseQuantity: '1', dosage: '', instructions: '' });
      setAddCustomMode(false);
      setShowAddSheet(false);
      setCtScanState('idle');
      setCtScanResults([]);
    } finally {
      setSavingMed(false);
    }
  };

  const addCtTime = () => { if (addForm.doseTimes.length < 4) setAddForm(f => ({ ...f, doseTimes: [...f.doseTimes, '12:00'] })); };
  const removeCtTime = (i: number) => setAddForm(f => ({ ...f, doseTimes: f.doseTimes.filter((_, idx) => idx !== i) }));
  const updateCtTime = (i: number, val: string) => setAddForm(f => ({ ...f, doseTimes: f.doseTimes.map((t, idx) => idx === i ? val : t) }));
  const applyCtPreset = (times: string[]) => {
    if (times.length === 0) { setAddCustomMode(true); }
    else { setAddCustomMode(false); setAddForm(f => ({ ...f, doseTimes: [...times] })); }
  };
  const ctPresetIsActive = (p: { times: string[] }) => {
    if (p.times.length === 0) return addCustomMode;
    if (addCustomMode) return false;
    return p.times.length === addForm.doseTimes.length && p.times.every((t, i) => t === addForm.doseTimes[i]);
  };

  const handleDeleteMed = async (medicineId: string) => {
    if (!selectedPatient) return;
    if (isDemo) {
      setPatients(prev => prev.map(p => p.id === selectedPatient ? { ...p, medicines: p.medicines.filter(m => m.id !== medicineId) } : p));
    } else {
      await api.caretaker.deleteMedicine(selectedPatient, medicineId);
      const data = await api.caretaker.patients();
      setPatients(data as RealPatient[]);
    }
  };

  const handleRefillStock = async (medicineId: string) => {
    if (!selectedPatient) return;
    const qty = parseInt(refillQty);
    if (isNaN(qty) || qty <= 0) return;
    if (isDemo) {
      setPatients(prev => prev.map(p => p.id === selectedPatient
        ? { ...p, medicines: p.medicines.map(m => m.id === medicineId ? { ...m, stock: m.stock + qty } : m) }
        : p
      ));
    } else {
      await api.caretaker.refillStock(selectedPatient, medicineId, qty);
      const data = await api.caretaker.patients();
      setPatients(data as RealPatient[]);
    }
    setRefillMedId(null);
    setRefillQty('10');
  };

  const handleMarkGiven = async (medicineId: string, currentTaken: boolean) => {
    if (!selectedPatient) return;
    const newTaken = !currentTaken;
    if (isDemo) {
      setPatients(prev => prev.map(p => p.id === selectedPatient
        ? { ...p, medicines: p.medicines.map(m => m.id === medicineId ? { ...m, taken: newTaken } : m) }
        : p
      ));
    } else {
      await api.caretaker.markGiven(selectedPatient, medicineId, newTaken);
      const data = await api.caretaker.patients();
      setPatients(data as RealPatient[]);
    }
  };

  const runCaretakerOcr = async (source: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement) => {
    setCtScanState('processing');
    setCtScanProgress(0);
    setCtScanError('');
    
    try {
      const Tesseract = (window as any).Tesseract || (await import('tesseract.js'));
      const processed = preprocessForOCR(source);
      
      // Stop camera after capture
      stopCamera();

      if (processed.width <= 1) throw new Error('Invalid image frame.');

      const worker = await Tesseract.createWorker('eng', 1, {
        logger: (m: any) => { if (m.status === 'recognizing text') setCtScanProgress(Math.round(m.progress * 100)); },
      });

      const { data } = await worker.recognize(processed);
      const text = data.text || '';
      await worker.terminate();

      const meds = extractMedicinesFromText(text);
      
      if (meds.length === 0) {
        setCtScanError('No medicines detected. Try a clearer image.');
        setCtScanState('idle');
      } else {
        setCtScanResults(meds);
        setCtScanState('results');
      }
    } catch (e: any) {
      console.error('Caretaker OCR Error:', e);
      stopCamera();
      setCtScanError('OCR failed. Ensure you are on localhost and hold still.');
      setCtScanState('idle');
    }
  };

  const addCtScanMedTime = (idx: number) => {
    setCtScanResults(prev => prev.map((m, i) => {
      if (i !== idx || m.doseTimes.length >= 4) return m;
      return { ...m, doseTimes: [...m.doseTimes, '12:00'] };
    }));
  };
  const updateCtScanMedTime = (idx: number, tIdx: number, val: string) => {
    setCtScanResults(prev => prev.map((m, i) => {
      if (i !== idx) return m;
      const newTimes = [...m.doseTimes];
      newTimes[tIdx] = val;
      return { ...m, doseTimes: newTimes };
    }));
  };
  const removeCtScanMedTime = (idx: number, tIdx: number) => {
    setCtScanResults(prev => prev.map((m, i) => {
      if (i !== idx) return m;
      return { ...m, doseTimes: m.doseTimes.filter((_, ti) => ti !== tIdx) };
    }));
  };
  const applyCtScanPreset = (idx: number, times: string[]) => {
    setCtScanResults(prev => prev.map((m, i) => {
      if (i !== idx) return m;
      if (times.length === 0) return m; 
      return { ...m, doseTimes: [...times] };
    }));
  };
  const isCtScanPresetActive = (med: any, p: { times: string[] }) => {
    if (p.times.length === 0) return false;
    return p.times.length === med.doseTimes.length && p.times.every((t: string, i: number) => t === med.doseTimes[i]);
  };
  const updateCtScanMed = (idx: number, key: string, val: any) => {
    setCtScanResults(prev => prev.map((m, i) => i === idx ? { ...m, [key]: val } : m));
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
      setShowCameraModal(false);
    }
  };

  const handleCtFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => runCaretakerOcr(img);
    img.src = url;
    e.target.value = '';
  };

  useEffect(() => {
    if (showCameraModal && cameraStream && cameraVideoRef.current) {
      const v = cameraVideoRef.current;
      v.srcObject = cameraStream;
      v.play().catch(e => console.warn('Caretaker camera play failed:', e));
    }
  }, [showCameraModal, cameraStream]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      setCameraStream(stream);
      setShowCameraModal(true);
    } catch (e: any) {
      console.error('Caretaker Camera Error:', e);
      setCtScanError('Camera not accessible. Use Upload File instead.');
    }
  };

  const capturePhoto = () => {
    const video = cameraVideoRef.current;
    const canvas = cameraCanvasRef.current;
    if (!video || !canvas) return;

    try {
      const width = video.videoWidth || video.offsetWidth || 1280;
      const height = video.videoHeight || video.offsetHeight || 720;
      
      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, width, height);
        stopCamera();
        canvas.toBlob(blob => {
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          const img = new Image();
          img.onload = () => runCaretakerOcr(img);
          img.src = url;
        }, 'image/jpeg', 0.9);
      }
    } catch (e: any) {
      console.error('Caretaker Capture Error:', e);
      setCtScanError('Failed to capture photo.');
    }
  };

  const allAlerts = patients.flatMap(p => {
    const alerts: string[] = [];
    p.medicines.forEach(m => { if (m.stock <= 5) alerts.push(`Low stock: ${m.name} (${m.stock} tabs left)`); });
    const missed = p.medicines.filter(m => !m.taken);
    if (missed.length > 0) alerts.push(`${missed.length} dose${missed.length > 1 ? 's' : ''} pending today`);
    return alerts.map(a => ({ patient: p.name, phone: p.phone, id: p.id, message: a }));
  });

  const patient = patients.find(p => p.id === selectedPatient);

  const navItems: { view: CaretakerView; icon: string; label: string }[] = [
    { view: 'patients', icon: '👥', label: 'Patients' },
    { view: 'alerts', icon: '🔔', label: 'Alerts' },
    { view: 'link', icon: '🔗', label: 'Link' },
    { view: 'profile', icon: '⚙️', label: 'Profile' },
  ];

  return (
    <main className="min-h-screen bg-[#F8FAFC] font-sans flex flex-col">
      <div className="max-w-md mx-auto p-6 flex flex-col flex-grow w-full pb-32">

        <header className="w-full mt-6 mb-6 flex justify-between items-center px-2">
          <div className="flex flex-col gap-1">
            <img src="/logo.png" alt="CareSync" className="h-10 w-auto object-contain object-left" />
            <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Caretaker Portal</p>
          </div>
          <button onClick={() => setShowProfileSheet(true)}
            className="w-11 h-11 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold border-2 border-blue-200 text-sm active:scale-90 transition-all">
            {initials}
          </button>
        </header>

        {/* PROFILE SHEET */}
        {showProfileSheet && (
          <div className="fixed inset-0 z-[55] flex items-end justify-center" onClick={() => setShowProfileSheet(false)}>
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
            <div className="relative w-full max-w-md bg-white rounded-t-[2.5rem] p-8 pb-10 shadow-2xl animate-in slide-in-from-bottom-4 duration-300" onClick={e => e.stopPropagation()}>
              {/* Handle bar */}
              <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-6" />

              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-black text-xl border-2 border-blue-200">
                  {initials}
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 italic">{profile.name || 'Caretaker'}</h3>
                  <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Caretaker Portal</p>
                  {isDemo && <span className="text-[9px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md uppercase tracking-widest">Demo Account</span>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="bg-slate-50 rounded-2xl p-4 text-center">
                  <p className="text-2xl font-black text-blue-600">{patients.length}</p>
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Patients</p>
                </div>
                <div className="bg-slate-50 rounded-2xl p-4 text-center">
                  <p className="text-2xl font-black text-red-500">{allAlerts.length}</p>
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Active Alerts</p>
                </div>
              </div>

              <div className="space-y-2 mb-6">
                {patients.slice(0, 3).map(p => {
                  const adh = calcAdherence(p.medicines);
                  return (
                    <button key={p.id} onClick={() => { setSelectedPatient(p.id); setView('patients'); setShowProfileSheet(false); }}
                      className="w-full flex items-center gap-3 bg-slate-50 rounded-2xl px-4 py-3 active:scale-[0.98] transition-all text-left">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-black text-xs border border-blue-200 flex-shrink-0">
                        {(p.name || p.phone).split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-800 text-sm truncate">{p.name || p.phone}</p>
                        <p className="text-[9px] font-bold text-slate-400">{p.medicines.filter(m => m.taken).length}/{p.medicines.length} doses taken</p>
                      </div>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${adh >= 80 ? 'bg-green-50 text-green-600' : adh >= 50 ? 'bg-yellow-50 text-yellow-600' : 'bg-red-50 text-red-500'}`}>{adh}%</span>
                    </button>
                  );
                })}
              </div>

              <button onClick={onLogout}
                className="w-full py-4 bg-red-50 text-red-500 rounded-[1.5rem] font-black uppercase tracking-widest text-sm active:scale-95 transition-all">
                Logout
              </button>
            </div>
          </div>
        )}

        {isDemo && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-2.5 mb-4 flex items-center gap-2">
            <span className="text-sm">⚡</span>
            <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest">Demo mode — tap a patient to add/scan medicines</p>
          </div>
        )}

        {/* PATIENTS */}
        {view === 'patients' && !selectedPatient && (
          <div className="space-y-5 animate-in fade-in">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white rounded-[1.5rem] p-4 border border-slate-100 shadow-sm text-center">
                <p className="text-2xl font-black text-blue-600">{patients.length}</p>
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Patients</p>
              </div>
              <div className="bg-white rounded-[1.5rem] p-4 border border-slate-100 shadow-sm text-center">
                <p className="text-2xl font-black text-green-500">{patients.filter(p => p.medicines.every(m => m.taken)).length}</p>
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">On Track</p>
              </div>
              <div className="bg-white rounded-[1.5rem] p-4 border border-slate-100 shadow-sm text-center">
                <p className="text-2xl font-black text-red-500">{allAlerts.length}</p>
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Alerts</p>
              </div>
            </div>

            {loadingPatients && (
              <div className="text-center py-8">
                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Loading patients...</p>
              </div>
            )}

            {!loadingPatients && patients.length === 0 && (
              <div className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-sm text-center">
                <div className="text-4xl mb-3">👥</div>
                <p className="font-black text-slate-800 italic">No Patients Yet</p>
                <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest mt-1 mb-4">Link a patient using their phone number</p>
                <button onClick={() => setView('link')} className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-black text-sm active:scale-95 transition-all">
                  🔗 Link Patient
                </button>
              </div>
            )}

            {patients.map(p => {
              const adh = calcAdherence(p.medicines);
              const taken = p.medicines.filter(m => m.taken).length;
              const initParts = (p.name || p.phone).split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);
              const hasAlert = allAlerts.some(a => a.id === p.id);
              return (
                <button key={p.id} onClick={() => setSelectedPatient(p.id)}
                  className="w-full bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-4 text-left active:scale-[0.98] transition-all">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black text-sm border-2 flex-shrink-0 ${hasAlert ? 'bg-red-50 text-red-500 border-red-200' : 'bg-blue-50 text-blue-600 border-blue-200'}`}>
                    {initParts}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center">
                      <p className="font-bold text-slate-800">{p.name || p.phone}</p>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${adh >= 80 ? 'bg-green-50 text-green-600' : adh >= 50 ? 'bg-yellow-50 text-yellow-600' : 'bg-red-50 text-red-500'}`}>{adh}%</span>
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 mt-0.5">{p.phone} • {taken}/{p.medicines.length} doses</p>
                    <div className="mt-2 w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${adh >= 80 ? 'bg-green-400' : adh >= 50 ? 'bg-yellow-400' : 'bg-red-400'}`} style={{ width: `${adh}%` }} />
                    </div>
                  </div>
                  <span className="text-slate-300 text-xl flex-shrink-0">›</span>
                </button>
              );
            })}
          </div>
        )}

        {/* PATIENT DETAIL */}
        {view === 'patients' && selectedPatient && patient && (
          <div className="space-y-5 animate-in slide-in-from-right-4 duration-300">
            <button onClick={() => setSelectedPatient(null)} className="flex items-center gap-2 text-blue-600 font-black text-sm px-2">‹ All Patients</button>

            <div className="bg-white rounded-[2.5rem] p-6 border border-slate-100 shadow-sm">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-black text-lg border-2 border-blue-200">
                  {(patient.name || patient.phone).split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-black text-slate-900 italic">{patient.name || 'Patient'}</h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{patient.phone}</p>
                </div>
              </div>

              {/* Quick-action buttons — always visible at the top */}
              <div className="grid grid-cols-2 gap-2 mb-5">
                <button
                  onClick={() => { setAddTab('manual'); setAddFormError(''); setShowAddSheet(true); }}
                  className="flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-2xl font-black text-sm active:scale-95 transition-all shadow-sm shadow-blue-100">
                  ＋ Add Medicine
                </button>
                <button
                  onClick={() => { setAddTab('scan'); setCtScanState('idle'); setCtScanResults([]); setCtScanError(''); setShowAddSheet(true); }}
                  className="flex items-center justify-center gap-2 bg-purple-600 text-white py-3 rounded-2xl font-black text-sm active:scale-95 transition-all shadow-sm shadow-purple-100">
                  📷 Scan Rx
                </button>
              </div>

              <div className="bg-slate-50 rounded-2xl p-4 mb-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Today's Adherence</span>
                  <span className={`text-sm font-black ${calcAdherence(patient.medicines) >= 80 ? 'text-green-600' : 'text-yellow-600'}`}>{calcAdherence(patient.medicines)}%</span>
                </div>
                <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${calcAdherence(patient.medicines) >= 80 ? 'bg-green-400' : 'bg-yellow-400'}`} style={{ width: `${calcAdherence(patient.medicines)}%` }} />
                </div>
              </div>

              {allAlerts.filter(a => a.id === patient.id).map((a, i) => (
                <div key={i} className="bg-red-50 border border-red-100 rounded-2xl p-3 mb-2">
                  <p className="text-[10px] font-black text-red-500 uppercase tracking-widest">⚠️ {a.message}</p>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between px-2">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Today's Medicines</h3>
              <div className="flex items-center gap-2">
                <button onClick={() => { setAddTab('scan'); setCtScanState('idle'); setCtScanResults([]); setCtScanError(''); setShowAddSheet(true); }}
                  className="flex items-center gap-1 text-[10px] font-black text-purple-600 bg-purple-50 px-3 py-1.5 rounded-xl active:scale-95 transition-all border border-purple-100">
                  📷 Scan
                </button>
                <button onClick={() => { setAddTab('manual'); setAddFormError(''); setShowAddSheet(true); }}
                  className="flex items-center gap-1 text-[10px] font-black text-blue-600 bg-blue-50 px-3 py-1.5 rounded-xl active:scale-95 transition-all border border-blue-100">
                  + Add
                </button>
              </div>
            </div>
            {patient.medicines.length === 0 && (
              <div className="bg-white rounded-2xl p-8 border border-slate-100 text-center">
                <p className="text-slate-300 font-bold text-sm">No medicines scheduled</p>
                <p className="text-[10px] text-slate-300 font-bold mt-1">Use + Add or 📷 Scan above</p>
              </div>
            )}
            {patient.medicines.map((med, i) => (
              <div key={i} className={`bg-white p-4 rounded-[2rem] border shadow-sm ${med.taken ? 'opacity-60 border-slate-50' : 'border-slate-100'}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">💊</div>
                    <div>
                      <p className={`font-bold text-sm ${med.taken ? 'line-through text-slate-300' : 'text-slate-800'}`}>{med.name}</p>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{formatTime(med.doseTime)} • {med.stock} tabs left</p>
                    </div>
                  </div>
                  <button onClick={() => handleDeleteMed(med.id)}
                    className="w-7 h-7 flex items-center justify-center text-slate-300 hover:text-red-400 hover:bg-red-50 rounded-lg transition-all text-sm active:scale-90 flex-shrink-0">
                    ×
                  </button>
                </div>
                {isMissed(med.doseTime, med.taken) && (
                  <div className="flex items-center gap-1.5 mb-2 px-1">
                    <span className="text-red-500 text-xs">⚠️</span>
                    <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">
                      Missed — due at {formatTime(med.doseTime)}
                    </span>
                  </div>
                )}
                {refillMedId === med.id ? (
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">Add tablets:</span>
                    <input
                      type="number" min="1" value={refillQty}
                      onChange={e => setRefillQty(e.target.value)}
                      className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm text-center outline-none focus:ring-2 focus:ring-green-100"
                    />
                    <button onClick={() => handleRefillStock(med.id)}
                      className="px-4 py-2 bg-green-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all">
                      ✓
                    </button>
                    <button onClick={() => { setRefillMedId(null); setRefillQty('10'); }}
                      className="px-3 py-2 bg-slate-100 text-slate-400 rounded-xl font-black text-[10px] active:scale-95 transition-all">
                      ✕
                    </button>
                  </div>
                ) : (
                  <button onClick={() => { setRefillMedId(med.id); setRefillQty('10'); }}
                    className={`w-full py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 mb-2 border ${med.stock <= 5 ? 'bg-orange-50 text-orange-600 border-orange-100' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                    📦 {med.stock <= 5 ? `Low Stock (${med.stock} left) — Refill` : `Refill Stock • ${med.stock} tabs`}
                  </button>
                )}
                <button
                  onClick={() => handleMarkGiven(med.id, med.taken)}
                  className={`w-full py-2.5 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all active:scale-95 ${
                    med.taken
                      ? 'bg-green-50 text-green-600 border border-green-100'
                      : isMissed(med.doseTime, med.taken)
                        ? 'bg-red-500 text-white shadow-sm shadow-red-100'
                        : 'bg-blue-600 text-white shadow-sm shadow-blue-100'
                  }`}>
                  {med.taken ? '✓ Given — Tap to Undo' : '💊 Mark as Given'}
                </button>
              </div>
            ))}

            <a href={`tel:${patient.phone}`} className="w-full bg-blue-600 text-white py-5 rounded-[2rem] font-black text-sm uppercase tracking-widest shadow-lg shadow-blue-100 active:scale-95 transition-all flex items-center justify-center gap-2">
              📞 Call {patient.name?.split(' ')[0] || 'Patient'}
            </a>
          </div>
        )}

        {/* ALERTS */}
        {view === 'alerts' && (
          <div className="space-y-5 animate-in fade-in">
            <h2 className="text-2xl font-black text-slate-900 italic px-2">Alerts</h2>
            {allAlerts.length === 0 ? (
              <div className="bg-white rounded-[2.5rem] p-12 border border-slate-100 shadow-sm text-center">
                <div className="text-4xl mb-3">✅</div>
                <p className="font-black text-slate-800 italic">All Clear!</p>
                <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest mt-1">No alerts right now</p>
              </div>
            ) : (
              <>
                <div className="bg-red-50 border border-red-100 rounded-[2rem] p-4">
                  <p className="text-[10px] font-black text-red-500 uppercase tracking-widest">{allAlerts.length} Active Alert{allAlerts.length !== 1 ? 's' : ''}</p>
                </div>
                {allAlerts.map((alert, i) => (
                  <button key={i} onClick={() => { setSelectedPatient(alert.id); setView('patients'); }}
                    className="w-full bg-white p-5 rounded-[2rem] border border-red-100 shadow-sm flex items-center gap-4 text-left active:scale-[0.98] transition-all">
                    <div className="w-11 h-11 bg-red-50 rounded-full flex items-center justify-center font-black text-sm text-red-500 border-2 border-red-200 flex-shrink-0">
                      {alert.patient.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <p className="font-black text-slate-800 text-sm">{alert.patient}</p>
                      <p className="text-[10px] font-bold text-red-500 mt-0.5">⚠️ {alert.message}</p>
                    </div>
                    <span className="text-slate-300 text-xl">›</span>
                  </button>
                ))}
              </>
            )}
          </div>
        )}

        {/* LINK PATIENT */}
        {view === 'link' && (
          <div className="space-y-5 animate-in fade-in">
            <h2 className="text-2xl font-black text-slate-900 italic px-2">Link a Patient</h2>
            <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm space-y-5">
              <p className="text-sm font-bold text-slate-500">Enter the patient's registered phone number to link their account to yours.</p>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Patient's Phone Number</label>
                <input type="tel" value={linkPhone}
                  onChange={e => { setLinkPhone(e.target.value.replace(/\D/g, '').slice(0, 10)); setLinkError(''); }}
                  placeholder="Enter 10-digit number"
                  className={`w-full p-5 bg-slate-50 border rounded-2xl font-bold text-sm outline-none mt-2 focus:ring-2 focus:ring-blue-100 ${linkError ? 'border-red-300' : 'border-slate-100'}`} />
                {linkError && <p className="text-red-500 text-[10px] font-bold mt-1 ml-1">{linkError}</p>}
                {linkStatus && <p className="text-green-600 text-[10px] font-bold mt-1 ml-1">✓ {linkStatus}</p>}
              </div>
              <button onClick={handleLink} disabled={linking}
                className="w-full bg-blue-600 text-white py-5 rounded-[2rem] font-black text-sm uppercase tracking-widest shadow-lg shadow-blue-100 active:scale-95 transition-all disabled:opacity-60">
                {linking ? 'Linking...' : '🔗 Link Patient'}
              </button>
            </div>

            {patients.length > 0 && (
              <div className="bg-white rounded-[2.5rem] p-6 border border-slate-100 shadow-sm">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Linked Patients ({patients.length})</h3>
                {patients.map(p => (
                  <div key={p.id} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
                    <div className="w-9 h-9 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 font-black text-xs border border-blue-100">
                      {(p.name || p.phone).split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold text-slate-800 text-sm">{p.name || 'Patient'}</p>
                      <p className="text-[10px] font-bold text-slate-400">{p.phone}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* PROFILE */}
        {view === 'profile' && (
          <div className="space-y-5 animate-in fade-in">
            <h2 className="text-2xl font-black text-slate-900 italic px-2">My Profile</h2>
            <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm text-center">
              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-black text-2xl border-2 border-blue-200 mx-auto mb-4">{initials}</div>
              <h3 className="text-xl font-black text-slate-900 italic">{profile.name || 'Caretaker'}</h3>
              <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mt-1">Caretaker</p>
            </div>
            <div className="bg-white rounded-[2.5rem] p-6 border border-slate-100 shadow-sm">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Linked Patients ({patients.length})</h3>
              {patients.length === 0 ? (
                <p className="text-slate-300 text-xs font-bold text-center py-2">No patients linked yet</p>
              ) : patients.map(p => (
                <div key={p.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl mb-2 last:mb-0">
                  <div className="w-9 h-9 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 font-black text-xs border border-blue-100">
                    {(p.name || p.phone).split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 text-sm">{p.name || 'Patient'}</p>
                    <p className="text-[10px] font-bold text-slate-400">{p.phone}</p>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={onLogout} className="w-full py-5 bg-red-50 text-red-500 rounded-[2rem] font-black uppercase tracking-widest text-sm active:scale-95 transition-all">
              Logout
            </button>
          </div>
        )}
      </div>

      {/* ADD MEDICINE SHEET */}
      {showAddSheet && patient && (
        <div className="fixed inset-0 z-[55] flex items-end justify-center" onClick={() => { setShowAddSheet(false); setCtScanState('idle'); setCtScanResults([]); }}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative w-full max-w-md bg-white rounded-t-[2.5rem] shadow-2xl animate-in slide-in-from-bottom-4 duration-300 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white rounded-t-[2.5rem] px-6 pt-5 pb-4 border-b border-slate-50 z-10">
              <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-4" />
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-black text-slate-900 italic">Add Medicine</h3>
                  <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">for {patient.name || 'Patient'}</p>
                </div>
                <button onClick={() => { setShowAddSheet(false); setCtScanState('idle'); setCtScanResults([]); }}
                  className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 font-black text-sm active:scale-90">×</button>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setAddTab('manual')}
                  className={`flex-1 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${addTab === 'manual' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                  ✏️ Add Manually
                </button>
                <button onClick={() => { setAddTab('scan'); setCtScanState('idle'); setCtScanResults([]); setCtScanError(''); }}
                  className={`flex-1 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${addTab === 'scan' ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                  📷 Scan Rx
                </button>
              </div>
            </div>

            <div className="px-6 pb-28 pt-5">
              {addTab === 'manual' && (
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Medicine Name *</label>
                    <input
                      list="ct-med-names"
                      value={addForm.name}
                      onChange={e => { setAddForm(f => ({ ...f, name: e.target.value })); setAddFormError(''); }}
                      placeholder="e.g. Metformin"
                      className="w-full mt-1 p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-100"
                    />
                    <datalist id="ct-med-names">
                      {MEDICINE_NAMES.slice(0, 100).map(n => <option key={n} value={n} />)}
                    </datalist>
                    {addFormError && <p className="text-red-500 text-[10px] font-bold mt-1 ml-1">{addFormError}</p>}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Stock (tablets)</label>
                      <input type="number" min="0" value={addForm.stock}
                        onChange={e => setAddForm(f => ({ ...f, stock: e.target.value }))}
                        className="w-full mt-1 p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-100" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Pills / Dose</label>
                      <input type="number" min="1" value={addForm.doseQuantity}
                        onChange={e => setAddForm(f => ({ ...f, doseQuantity: e.target.value }))}
                        className="w-full mt-1 p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-100" />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Frequency</label>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {FREQ_PRESETS.map(p => (
                        <button key={p.label} type="button" onClick={() => applyCtPreset(p.times)}
                          className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${ctPresetIsActive(p) ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                          {p.label}
                        </button>
                      ))}
                    </div>
                    <div className="space-y-2 mt-3">
                      {addForm.doseTimes.map((t, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <input type="time" value={t} onChange={e => updateCtTime(i, e.target.value)}
                            className="flex-1 p-3 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-100" />
                          {addForm.doseTimes.length > 1 && (
                            <button type="button" onClick={() => removeCtTime(i)}
                              className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-red-400 hover:bg-red-50 rounded-xl transition-all font-black">
                              ×
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    {addForm.doseTimes.length < 4 && (
                      <button type="button" onClick={addCtTime}
                        className="mt-2 text-[10px] font-black text-blue-500 uppercase tracking-widest ml-1">
                        + Add another time
                      </button>
                    )}
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Strength (opt)</label>
                    <input type="text" value={addForm.dosage} placeholder="e.g. 500mg"
                      onChange={e => setAddForm(f => ({ ...f, dosage: e.target.value }))}
                      className="w-full mt-1 p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-100" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Instructions (opt)</label>
                    <input type="text" value={addForm.instructions} placeholder="e.g. Take with food"
                      onChange={e => setAddForm(f => ({ ...f, instructions: e.target.value }))}
                      className="w-full mt-1 p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-100" />
                  </div>
                  <button
                    disabled={savingMed}
                    onClick={() => {
                      if (!addForm.name.trim()) { setAddFormError('Medicine name is required'); return; }
                      if (!addForm.doseTimes.length) { setAddFormError('Add at least one dose time'); return; }
                      handleAddMed({ name: addForm.name.trim(), stock: parseInt(addForm.stock) || 30, doseTime: addForm.doseTimes[0], doseTimes: addForm.doseTimes, doseQuantity: parseInt(addForm.doseQuantity) || 1, dosage: addForm.dosage || undefined, instructions: addForm.instructions || undefined });
                    }}
                    className="w-full bg-blue-600 text-white py-5 rounded-[2rem] font-black text-sm uppercase tracking-widest shadow-lg shadow-blue-100 active:scale-95 transition-all disabled:opacity-60 mt-2">
                    {savingMed ? 'Saving...' : '+ Add Medicine'}
                  </button>
                </div>
              )}

              {addTab === 'scan' && (
                <div className="space-y-4">
                  {ctScanState === 'idle' && (
                    <>
                      <div className="bg-purple-50 rounded-2xl p-4 text-center border border-purple-100">
                        <p className="text-3xl mb-2">📋</p>
                        <p className="text-sm font-black text-purple-800">Upload a prescription photo</p>
                        <p className="text-[10px] font-bold text-purple-500 mt-1">The AI will detect medicines automatically</p>
                      </div>
                      {ctScanError && (
                        <div className="bg-red-50 border border-red-100 rounded-2xl p-3">
                          <p className="text-[10px] font-black text-red-500">{ctScanError}</p>
                        </div>
                      )}
                      <input ref={ctUploadInputRef} type="file" accept="image/*" className="hidden" onChange={handleCtFileUpload} />
                      <canvas ref={cameraCanvasRef} className="hidden" />
                      <div className="grid grid-cols-2 gap-3">
                        <button onClick={startCamera}
                          className="w-full bg-purple-600 text-white py-5 rounded-[2rem] font-black text-sm uppercase tracking-widest shadow-lg shadow-purple-100 active:scale-95 transition-all flex flex-col items-center gap-1">
                          <span className="text-2xl">📷</span>
                          <span className="text-[10px]">Camera</span>
                        </button>
                        <button onClick={() => ctUploadInputRef.current?.click()}
                          className="w-full bg-slate-700 text-white py-5 rounded-[2rem] font-black text-sm uppercase tracking-widest shadow-lg shadow-slate-200 active:scale-95 transition-all flex flex-col items-center gap-1">
                          <span className="text-2xl">📁</span>
                          <span className="text-[10px]">Upload File</span>
                        </button>
                      </div>
                      <button onClick={() => { setAddTab('manual'); setAddFormError(''); }}
                        className="w-full py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Or add manually instead
                      </button>
                    </>
                  )}

                  {ctScanState === 'processing' && (
                    <div className="py-10 text-center space-y-4">
                      <div className="w-14 h-14 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto" />
                      <p className="font-black text-slate-700">Scanning prescription...</p>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-purple-500 rounded-full transition-all duration-300" style={{ width: `${ctScanProgress}%` }} />
                      </div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{ctScanProgress}% complete</p>
                    </div>
                  )}

                  {ctScanState === 'results' && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-green-500 font-black">✓</span>
                        <p className="text-sm font-black text-slate-700">{ctScanResults.length} medicine{ctScanResults.length !== 1 ? 's' : ''} detected</p>
                        <button onClick={() => { setCtScanState('idle'); setCtScanResults([]); }} className="ml-auto text-[10px] font-black text-slate-400 uppercase">Rescan</button>
                      </div>
                      {ctScanResults.map((med, i) => (
                        <div key={i} className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="font-black text-slate-800 text-sm">💊 {med.name}</p>
                            {med.strength && <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg">{med.strength}</span>}
                          </div>
                          <div className="grid grid-cols-3 gap-2 mb-2">
                            <div className="flex flex-col gap-1 min-w-0">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Qty/Dose</span>
                              <input type="number" min="1" value={med.quantity} onChange={e => updateCtScanMed(i, 'quantity', e.target.value)} className="bg-white border border-slate-100 px-2 py-2 text-xs font-black text-blue-600 rounded-xl w-full outline-none focus:ring-2 focus:ring-blue-100 text-center min-w-0" />
                            </div>
                            <div className="flex flex-col gap-1 min-w-0">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Total Tabs</span>
                              <input type="number" min="1" value={med.total} onChange={e => updateCtScanMed(i, 'total', parseInt(e.target.value))} className="bg-white border border-slate-100 px-2 py-2 text-xs font-black text-blue-600 rounded-xl w-full outline-none focus:ring-2 focus:ring-blue-100 text-center min-w-0" />
                            </div>
                            <div className="flex flex-col gap-1 min-w-0">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Strength</span>
                              <input type="text" value={med.strength} placeholder="e.g. 500mg" onChange={e => updateCtScanMed(i, 'strength', e.target.value)} className="bg-white border border-slate-100 px-2 py-2 text-xs font-black text-blue-600 rounded-xl w-full outline-none focus:ring-2 focus:ring-blue-100 text-center min-w-0" />
                            </div>
                          </div>
                          
                          <div className="pt-2 border-t border-slate-100 mb-3">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Frequency</label>
                            <div className="flex flex-wrap gap-1 mt-1.5 mb-2">
                              {FREQ_PRESETS.map(p => (
                                <button key={p.label} type="button" onClick={() => applyCtScanPreset(i, p.times)}
                                  className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${isCtScanPresetActive(med, p) ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                                  {p.label}
                                </button>
                              ))}
                            </div>
                            <div className="space-y-1.5">
                              {med.doseTimes.map((t, tIdx) => (
                                <div key={tIdx} className="flex items-center gap-2">
                                  <input type="time" value={t} onChange={e => updateCtScanMedTime(i, tIdx, e.target.value)}
                                    className="flex-1 p-1.5 bg-white border border-slate-100 rounded-xl font-bold text-xs outline-none focus:ring-2 focus:ring-blue-100 text-center" />
                                  {med.doseTimes.length > 1 && (
                                    <button type="button" onClick={() => removeCtScanMedTime(i, tIdx)}
                                      className="w-6 h-6 flex items-center justify-center text-slate-300 hover:text-red-400 hover:bg-red-50 rounded-lg transition-all font-black">
                                      ×
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                            {med.doseTimes.length < 4 && (
                              <button type="button" onClick={() => addCtScanMedTime(i)}
                                className="mt-1 text-[9px] font-black text-blue-500 uppercase tracking-widest ml-1">
                                + Add time
                              </button>
                            )}
                          </div>

                          <div className="pt-2 border-t border-slate-100 mb-3">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Special Instructions (opt)</label>
                            <input type="text" value={med.instructions} placeholder="e.g. Take with food" onChange={e => updateCtScanMed(i, 'instructions', e.target.value)}
                              className="w-full mt-1.5 p-1.5 bg-white border border-slate-100 rounded-xl font-bold text-xs outline-none focus:ring-2 focus:ring-blue-100" />
                          </div>

                          <button
                            disabled={savingMed}
                            onClick={() => handleAddMed({ name: med.name, stock: med.total, doseTime: med.doseTimes[0] || '08:00', doseTimes: med.doseTimes, doseQuantity: parseInt(med.quantity) || 1, dosage: med.strength || undefined, instructions: med.instructions || undefined })}
                            className="w-full bg-blue-600 text-white py-2.5 rounded-xl font-black text-[11px] uppercase tracking-widest active:scale-95 transition-all disabled:opacity-60">
                            {savingMed ? 'Adding...' : '+ Add to Patient'}
                          </button>
                        </div>
                      ))}
                      <button onClick={() => { setCtScanState('idle'); setCtScanResults([]); startCamera(); }}
                        className="w-full py-3 text-[10px] font-black text-purple-600 bg-purple-50 rounded-2xl uppercase tracking-widest active:scale-95 border border-purple-100">
                        📷 Scan Another Prescription
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CAMERA MODAL */}
      {showCameraModal && (
        <div className="fixed inset-0 z-[60] bg-black flex flex-col">
          <div className="flex items-center justify-between px-5 pt-10 pb-4">
            <p className="text-white font-black text-sm uppercase tracking-widest">📷 Point at Prescription</p>
            <button onClick={stopCamera} className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center text-white font-black active:scale-90 transition-all">×</button>
          </div>
          <video ref={cameraVideoRef} autoPlay playsInline muted className="flex-1 w-full object-cover" />
          <div className="px-8 py-10 flex justify-center">
            <button onClick={capturePhoto}
              className="w-20 h-20 rounded-full bg-white border-4 border-white shadow-2xl active:scale-90 transition-all flex items-center justify-center">
              <div className="w-14 h-14 rounded-full bg-purple-600" />
            </button>
          </div>
        </div>
      )}

      {/* BOTTOM NAV — hidden when any sheet is open */}
      {!showAddSheet && !showProfileSheet && (
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-md z-50">
        <nav className="bg-white/95 backdrop-blur-xl border border-slate-200 rounded-full p-3 flex items-center justify-between shadow-2xl">
          {navItems.map(item => (
            <button key={item.view} onClick={() => { setView(item.view); setSelectedPatient(null); }}
              className={`flex-1 flex flex-col items-center py-1 gap-0.5 transition-all relative ${view === item.view ? 'text-blue-600' : 'text-slate-300'}`}>
              <span className="text-xl">{item.icon}</span>
              <span className={`text-[8px] font-black uppercase tracking-widest ${view === item.view ? 'text-blue-600' : 'text-slate-300'}`}>{item.label}</span>
              {item.view === 'alerts' && allAlerts.length > 0 && (
                <span className="absolute -top-1 right-3 w-4 h-4 bg-red-500 rounded-full text-white text-[8px] font-black flex items-center justify-center">{allAlerts.length}</span>
              )}
            </button>
          ))}
        </nav>
      </div>
      )}
    </main>
  );
}
