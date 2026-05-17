import React, { useState, useRef } from 'react';
import { Medicine } from '../types';
import DrugInteractionWarning from '../components/DrugInteractionWarning';
import { checkDrugInteractions, DetectedInteraction } from '../data/drugInteractions';
import { ScannedMed, extractMedicinesFromText, preprocessForOCR, makeTesseractWorker } from '../lib/ocr';

interface Props {
  medicines: Medicine[];
  setMedicines: React.Dispatch<React.SetStateAction<Medicine[]>>;
  onDone: () => void;
}

type ScanState = 'idle' | 'camera' | 'processing' | 'results';

const FREQ_PRESETS = [
  { label: 'Once Daily', times: ['08:00'] },
  { label: 'Twice Daily', times: ['08:00', '20:00'] },
  { label: 'Three Times', times: ['08:00', '14:00', '21:00'] },
  { label: 'Four Times', times: ['06:00', '12:00', '18:00', '22:00'] },
  { label: 'Nightly', times: ['22:00'] },
  { label: 'Custom', times: [] },
];

export default function ScanPage({ medicines, setMedicines, onDone }: Props) {
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [scannedResults, setScannedResults] = useState<ScannedMed[]>([]);
  const [error, setError] = useState('');
  const [uploadName, setUploadName] = useState('');
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrStatus, setOcrStatus] = useState('');

  const [pendingMeds, setPendingMeds] = useState<Medicine[]>([]);
  const [interactions, setInteractions] = useState<DetectedInteraction[]>([]);
  const [interactionDrug, setInteractionDrug] = useState('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (scanState === 'camera' && streamRef.current && videoRef.current) {
      const v = videoRef.current;
      v.srcObject = streamRef.current;
      v.play().catch(e => console.warn('Video play failed:', e));
    }
  }, [scanState]);

  const startCamera = async () => {
    if (!window.isSecureContext && window.location.hostname !== 'localhost') {
      setError('Camera requires an HTTPS connection or localhost to work.');
      return;
    }
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      setScanState('camera');
    } catch (e: any) {
      console.error('Camera Error:', e);
      setError('Camera access failed. Check permissions.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  };

  const runOcr = async (source: HTMLImageElement | HTMLCanvasElement) => {
    setScanState('processing');
    setOcrProgress(0);
    setOcrStatus('Waking up engine…');
    stopCamera();

    try {
      const processed = preprocessForOCR(source as any);
      setOcrStatus('Reading Prescription…');

      const worker = await makeTesseractWorker((p) => setOcrProgress(p));
      const { data: { text } } = await worker.recognize(processed);
      await worker.terminate();

      const meds = extractMedicinesFromText(text || '');
      if (meds.length === 0) {
        setError('No medicines detected. Please try a clearer photo.');
        setScanState('idle');
      } else {
        setScannedResults(meds);
        setScanState('results');
      }
    } catch (e: any) {
      console.error('OCR Error:', e?.message ?? String(e));
      setError(`Scan failed: ${e?.message || String(e) || 'Unknown error'}`);
      setScanState('idle');
    }
  };

  const handleCapture = () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      const canvas = document.createElement('canvas');
      const w = video.videoWidth || video.offsetWidth || 1280;
      const h = video.videoHeight || video.offsetHeight || 720;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(video, 0, 0, w, h);
        runOcr(canvas);
      }
    } catch (e: any) {
      console.error('Capture error:', e);
      setError('Failed to capture frame.');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadName(file.name);
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => runOcr(img);
    img.src = url;
  };

  const updateMed = (i: number, key: keyof ScannedMed, val: any) =>
    setScannedResults(prev => prev.map((m, idx) => idx === i ? { ...m, [key]: val } : m));

  const addMedTime = (idx: number) => {
    setScannedResults(prev => prev.map((m, i) => {
      if (i !== idx || m.doseTimes.length >= 4) return m;
      return { ...m, doseTimes: [...m.doseTimes, '12:00'] };
    }));
  };
  const updateMedTime = (idx: number, tIdx: number, val: string) => {
    setScannedResults(prev => prev.map((m, i) => {
      if (i !== idx) return m;
      const newTimes = [...m.doseTimes];
      newTimes[tIdx] = val;
      return { ...m, doseTimes: newTimes };
    }));
  };
  const removeMedTime = (idx: number, tIdx: number) => {
    setScannedResults(prev => prev.map((m, i) => {
      if (i !== idx) return m;
      return { ...m, doseTimes: m.doseTimes.filter((_, ti) => ti !== tIdx) };
    }));
  };
  const applyPreset = (idx: number, times: string[]) => {
    setScannedResults(prev => prev.map((m, i) => {
      if (i !== idx) return m;
      if (times.length === 0) return m; 
      return { ...m, doseTimes: [...times] };
    }));
  };
  const isPresetActive = (med: ScannedMed, p: { times: string[] }) => {
    if (p.times.length === 0) return false;
    return p.times.length === med.doseTimes.length && p.times.every((t, i) => t === med.doseTimes[i]);
  };

  const handleSave = () => {
    const existingNames = medicines.map(m => m.name.toLowerCase());
    const unique = scannedResults.filter(r => !existingNames.includes(r.name.toLowerCase()));
    const duplicates = scannedResults.filter(r => existingNames.includes(r.name.toLowerCase()));

    const newMeds: Medicine[] = unique.map(m => ({
      id: crypto.randomUUID(),
      name: m.name,
      stock: m.total,
      doseTime: m.doseTimes[0] ?? '08:00',
      doseTimes: m.doseTimes.length ? m.doseTimes : ['08:00'],
      doseQuantity: parseInt(m.quantity) || 1,
      dosage: m.strength.trim() || undefined,
      instructions: m.instructions.trim() || undefined,
      taken: false,
      takenTimes: [],
    }));

    let ixMeds: DetectedInteraction[] = [];
    let triggerDrug = '';
    for (const med of newMeds) {
      const found = checkDrugInteractions(med.name, medicines.map(m => m.name));
      if (found.length > 0) { ixMeds = found; triggerDrug = med.name; break; }
    }

    if (ixMeds.length > 0) {
      setPendingMeds(newMeds);
      setInteractions(ixMeds);
      setInteractionDrug(triggerDrug);
      return;
    }
    commitSave(newMeds, duplicates);
  };

  const commitSave = (meds: Medicine[], duplicates: ScannedMed[]) => {
    setMedicines(prev => [...prev, ...meds]);
    if (duplicates.length > 0) setError(`Skipped ${duplicates.map(d => d.name).join(', ')} — already in schedule.`);
    setScannedResults([]); setScanState('idle');
    setPendingMeds([]); setInteractions([]);
    onDone();
  };

  const handleCancel = () => { stopCamera(); setScanState('idle'); setScannedResults([]); setError(''); };

  return (
    <div className="flex-grow flex flex-col items-center justify-center h-full">
      {pendingMeds.length > 0 && interactions.length > 0 && (
        <DrugInteractionWarning
          newDrug={interactionDrug}
          interactions={interactions}
          onProceed={() => {
            const dupes = scannedResults.filter(r => medicines.some(m => m.name.toLowerCase() === r.name.toLowerCase()));
            commitSave(pendingMeds, dupes);
          }}
          onCancel={() => { setPendingMeds([]); setInteractions([]); }}
        />
      )}

      {scanState === 'camera' && (
        <div className="relative w-full aspect-[3/4] rounded-[3rem] overflow-hidden border-4 border-blue-600 shadow-2xl bg-black">
          <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
          <button onClick={handleCapture} className="absolute bottom-8 left-1/2 -translate-x-1/2 w-16 h-16 bg-white rounded-full border-4 border-blue-600 shadow-2xl active:scale-90 transition-transform" />
          <button onClick={handleCancel} className="absolute top-6 right-6 w-10 h-10 bg-black/40 rounded-full text-white font-black text-xl flex items-center justify-center">×</button>
        </div>
      )}

      {scanState === 'processing' && (
        <div className="text-center space-y-6 w-full">
          <div className="w-24 h-24 bg-blue-50 rounded-[2.5rem] flex items-center justify-center mx-auto shadow-inner">
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
          <h2 className="text-xl font-black text-slate-900 italic">Reading Prescription…</h2>
          <p className="text-slate-400 text-sm font-medium mt-1">{ocrStatus}</p>
          {ocrProgress > 0 && (
            <div className="w-48 mx-auto">
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-600 rounded-full transition-all duration-300" style={{ width: `${ocrProgress}%` }} />
              </div>
            </div>
          )}
        </div>
      )}

      {scanState === 'results' && (
        <div className="w-full space-y-6 animate-in slide-in-from-bottom-8">
          <div className="bg-white rounded-[3rem] p-6 shadow-xl border border-slate-50">
            <h3 className="text-xl font-black text-slate-900 italic mb-6 px-2">📋 Detected Medicines</h3>
            <div className="space-y-5 max-h-[52vh] overflow-y-auto px-1">
              {scannedResults.map((med, idx) => (
                <div key={idx} className="p-5 rounded-2xl border bg-slate-50 border-slate-100/50 space-y-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-900 truncate mr-2">{med.name}</span>
                    <button onClick={() => setScannedResults(prev => prev.filter((_, i) => i !== idx))} className="text-slate-300 hover:text-red-500 transition-colors text-xl flex-shrink-0">×</button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="flex flex-col gap-1 min-w-0">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Qty/Dose</span>
                      <input type="number" min="1" value={med.quantity} onChange={e => updateMed(idx, 'quantity', e.target.value)} className="bg-white border border-slate-100 px-2 py-2.5 text-xs font-black text-blue-600 rounded-xl w-full outline-none focus:ring-2 focus:ring-blue-100 text-center min-w-0" />
                    </div>
                    <div className="flex flex-col gap-1 min-w-0">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Total Tabs</span>
                      <input type="number" min="1" value={med.total} onChange={e => updateMed(idx, 'total', parseInt(e.target.value))} className="bg-white border border-slate-100 px-2 py-2.5 text-xs font-black text-blue-600 rounded-xl w-full outline-none focus:ring-2 focus:ring-blue-100 text-center min-w-0" />
                    </div>
                    <div className="flex flex-col gap-1 min-w-0">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Strength</span>
                      <input type="text" value={med.strength} placeholder="e.g. 500mg" onChange={e => updateMed(idx, 'strength', e.target.value)} className="bg-white border border-slate-100 px-2 py-2.5 text-xs font-black text-blue-600 rounded-xl w-full outline-none focus:ring-2 focus:ring-blue-100 text-center min-w-0" />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Frequency</label>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {FREQ_PRESETS.map(p => (
                        <button key={p.label} type="button" onClick={() => applyPreset(idx, p.times)}
                          className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isPresetActive(med, p) ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                          {p.label}
                        </button>
                      ))}
                    </div>
                    <div className="space-y-2 mt-3">
                      {med.doseTimes.map((t, tIdx) => (
                        <div key={tIdx} className="flex items-center gap-2">
                          <input type="time" value={t} onChange={e => updateMedTime(idx, tIdx, e.target.value)}
                            className="flex-1 p-2 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-xs outline-none focus:ring-2 focus:ring-blue-100 text-center" />
                          {med.doseTimes.length > 1 && (
                            <button type="button" onClick={() => removeMedTime(idx, tIdx)}
                              className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-red-400 hover:bg-red-50 rounded-xl transition-all font-black">
                              ×
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    {med.doseTimes.length < 4 && (
                      <button type="button" onClick={() => addMedTime(idx)}
                        className="mt-2 text-[10px] font-black text-blue-500 uppercase tracking-widest ml-1">
                        + Add another time
                      </button>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-100">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Special Instructions (opt)</label>
                    <input type="text" value={med.instructions} placeholder="e.g. Take with food" onChange={e => updateMed(idx, 'instructions', e.target.value)}
                      className="w-full mt-1.5 p-2 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-xs outline-none focus:ring-2 focus:ring-blue-100" />
                  </div>
                </div>
              ))}
            </div>
            <button onClick={handleSave} className="w-full bg-blue-600 text-white py-5 rounded-[2rem] font-black text-base shadow-xl mt-6 active:scale-[0.98] transition-all">Save to Schedule</button>
            <button onClick={handleCancel} className="w-full py-4 text-slate-400 font-bold text-xs uppercase mt-1">Cancel</button>
          </div>
        </div>
      )}

      {scanState === 'idle' && (
        <div className="text-center w-full space-y-4">
          {error && <div className="bg-red-50 border border-red-100 rounded-2xl p-4 text-red-500 font-bold text-sm">{error}</div>}
          <div className="w-24 h-24 bg-blue-50 rounded-[2.5rem] flex items-center justify-center text-4xl mx-auto mb-6 shadow-inner">📸</div>
          <h2 className="text-2xl font-black text-slate-900 italic mb-2">Prescription Scan</h2>
          <p className="text-slate-400 text-sm font-medium mb-8 max-w-[220px] mx-auto">Snap or upload — medicines detected automatically</p>
          <button onClick={startCamera} className="w-full bg-blue-600 text-white py-5 rounded-[2rem] font-black shadow-lg shadow-blue-100 active:scale-95 transition-all text-sm uppercase tracking-widest">📷 Use Camera</button>
          <button onClick={() => fileInputRef.current?.click()} className="w-full bg-white border-2 border-slate-200 text-slate-600 py-5 rounded-[2rem] font-black mt-2 active:scale-95 transition-all text-sm uppercase tracking-widest">📁 Upload Image</button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
        </div>
      )}
    </div>
  );
}