import React, { useRef, useState } from 'react';
import { VaultDoc } from '../types';

interface Props {
  docs: VaultDoc[];
  setDocs: React.Dispatch<React.SetStateAction<VaultDoc[]>>;
}

const categoryColors: Record<string, string> = {
  'Lab Report': 'bg-purple-50 text-purple-600',
  'Imaging': 'bg-blue-50 text-blue-600',
  'Prescription': 'bg-green-50 text-green-600',
  'Other': 'bg-slate-50 text-slate-500',
};
const categoryIcons: Record<string, string> = {
  'Lab Report': '🧪', 'Imaging': '🗂️', 'Prescription': '📋', 'Other': '📄',
};

function getCategory(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (['jpg', 'jpeg', 'png', 'dcm', 'webp'].includes(ext)) return 'Imaging';
  if (ext === 'pdf') return 'Prescription';
  return 'Other';
}

export default function VaultPage({ docs, setDocs }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [previewDoc, setPreviewDoc] = useState<VaultDoc | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<{ file: File; existingDoc: VaultDoc } | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState('');
  const [showAddSheet, setShowAddSheet] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  const addDoc = (name: string, data: string) => {
    const newDoc: VaultDoc = {
      id: crypto.randomUUID(),
      name,
      category: getCategory(name),
      date: today,
      dataUrl: data,
      fileData: data,
      isDemo: false,
    };
    setDocs(prev => [newDoc, ...prev]);
  };

  React.useEffect(() => {
    if (isScanning && streamRef.current && videoRef.current) {
      const v = videoRef.current;
      v.srcObject = streamRef.current;
      v.play().catch(e => console.warn('Vault camera play failed:', e));
    }
  }, [isScanning]);

  const startCamera = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      setIsScanning(true);
    } catch (e: any) {
      console.error('Vault Camera Error:', e);
      setError('Camera access denied. Please use Upload.');
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setIsScanning(false);
  };

  const handleCapture = () => {
    const v = videoRef.current, c = canvasRef.current;
    if (!v || !c) return;

    try {
      const width = v.videoWidth || v.offsetWidth || 1280;
      const height = v.videoHeight || v.offsetHeight || 720;

      c.width = width;
      c.height = height;

      const ctx = c.getContext('2d');
      if (ctx) {
        ctx.drawImage(v, 0, 0, width, height);
        const dataUrl = c.toDataURL('image/jpeg', 0.9);
        if (dataUrl && dataUrl.length > 100) {
          addDoc(`Scan_${new Date().getTime()}.jpg`, dataUrl);
          stopCamera();
        } else {
          throw new Error('Capture generated empty data.');
        }
      }
    } catch (e: any) {
      console.error('Vault Capture Error:', e);
      setError('Failed to capture document. Please try again.');
    }
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      const existing = docs.find(
        d => d.name.toLowerCase() === file.name.toLowerCase() && d.date === today
      );
      if (existing) {
        setDuplicateWarning({ file, existingDoc: existing });
        return;
      }

      const reader = new FileReader();
      reader.onload = () => addDoc(file.name, reader.result as string);
      reader.readAsDataURL(file);
    });
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleOpen = (doc: VaultDoc) => {
    if (doc.isDemo) { setPreviewDoc(doc); return; }
    const src = doc.dataUrl || doc.fileData;
    if (src) {
      const win = window.open('', '_blank');
      if (win) {
        // Use DOM APIs instead of document.write() — prevents XSS via crafted data URLs
        const d = win.document;
        Object.assign(d.body.style, { margin: '0', padding: '0' });
        if (src.startsWith('data:image') || src.startsWith('blob:')) {
          Object.assign(d.body.style, {
            background: '#000', display: 'flex',
            alignItems: 'center', justifyContent: 'center', minHeight: '100vh',
          });
          const img = d.createElement('img');
          img.src = src;
          Object.assign(img.style, { maxWidth: '100%', maxHeight: '100vh', objectFit: 'contain' });
          d.body.appendChild(img);
        } else {
          Object.assign(d.body.style, { height: '100vh', overflow: 'hidden' });
          const iframe = d.createElement('iframe');
          iframe.src = src;
          Object.assign(iframe.style, { width: '100%', height: '100%', border: 'none' });
          d.body.appendChild(iframe);
        }
        d.title = doc.name;
      }
    }
  };

  const handleDelete = (id: string) => setDocs(prev => prev.filter(d => d.id !== id));

  const handleReplaceConfirm = () => {
    if (!duplicateWarning) return;
    const { file } = duplicateWarning;
    const reader = new FileReader();
    reader.onload = () => {
      setDocs(prev => prev.filter(d => d.id !== duplicateWarning.existingDoc.id));
      addDoc(file.name, reader.result as string);
      setDuplicateWarning(null);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-6">
      <canvas ref={canvasRef} className="hidden" />

      {/* Camera Scanning Overlay */}
      {isScanning && (
        <div className="fixed inset-0 bg-black z-[60] flex flex-col items-center justify-center p-6 animate-in fade-in">
          <div className="relative w-full aspect-[3/4] rounded-[3rem] overflow-hidden border-4 border-blue-600 shadow-2xl">
            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/40 pointer-events-none" />
            <div className="absolute top-6 left-0 right-0 text-center">
              <span className="bg-black/50 text-white text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-full">Scan Document · High Contrast</span>
            </div>
            <button onClick={handleCapture} className="absolute bottom-8 left-1/2 -translate-x-1/2 w-16 h-16 bg-white rounded-full border-4 border-blue-600 shadow-2xl active:scale-90 transition-transform" />
            <button onClick={stopCamera} className="absolute top-6 right-6 w-10 h-10 bg-black/40 rounded-full text-white font-black text-xl flex items-center justify-center">×</button>
          </div>
          <p className="text-white/60 text-[10px] font-black uppercase tracking-widest mt-8">Align document within the frame</p>
        </div>
      )}

      {/* Duplicate warning modal */}
      {duplicateWarning && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center p-4 animate-in fade-in" onClick={() => setDuplicateWarning(null)}>
          <div className="bg-white rounded-[2.5rem] w-full max-w-md p-8 shadow-2xl animate-in slide-in-from-bottom-8" onClick={e => e.stopPropagation()}>
            <div className="text-3xl mb-4 text-center">⚠️</div>
            <h2 className="font-black text-slate-900 italic text-xl text-center mb-2">Duplicate Document</h2>
            <p className="text-sm font-bold text-slate-500 text-center mb-6">
              <span className="text-slate-800">"{duplicateWarning.file.name}"</span> was already uploaded today. Replace it?
            </p>
            <div className="space-y-3">
              <button onClick={handleReplaceConfirm}
                className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest active:scale-95 transition-all shadow-lg shadow-blue-100">
                Replace Existing
              </button>
              <button onClick={() => { setDuplicateWarning(null); addDoc(duplicateWarning.file.name, ''); }}
                className="w-full bg-slate-100 text-slate-600 py-4 rounded-2xl font-black text-sm uppercase tracking-widest active:scale-95 transition-all">
                Keep Both
              </button>
              <button onClick={() => setDuplicateWarning(null)}
                className="w-full py-3 text-slate-400 font-black text-sm uppercase tracking-widest">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center px-2">
        <h2 className="text-2xl font-black text-slate-900 italic">Vault</h2>
        <button onClick={() => setShowAddSheet(true)}
          className="bg-blue-600 text-white px-5 py-2.5 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-blue-100 active:scale-95 transition-all flex items-center gap-2">
          <span>+</span> Add Document
        </button>
        <input ref={fileRef} type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.dcm" className="hidden" onChange={handleUpload} />
      </div>

      {/* ADD DOCUMENT SHEET */}
      {showAddSheet && (
        <div className="fixed inset-0 z-[55] flex items-end justify-center" onClick={() => setShowAddSheet(false)}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative w-full max-w-md bg-white rounded-t-[2.5rem] shadow-2xl animate-in slide-in-from-bottom-4 duration-300" onClick={e => e.stopPropagation()}>
            <div className="px-6 pt-5 pb-8">
              <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-4" />
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-black text-slate-900 italic">Add Document</h3>
                  <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">to Vault</p>
                </div>
                <button onClick={() => setShowAddSheet(false)}
                  className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 font-black text-sm active:scale-90">×</button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => { setShowAddSheet(false); startCamera(); }}
                  className="w-full bg-purple-600 text-white py-6 rounded-[2rem] font-black text-sm uppercase tracking-widest shadow-lg shadow-purple-100 active:scale-95 transition-all flex flex-col items-center gap-2">
                  <span className="text-3xl">📷</span>
                  <span className="text-[10px]">Camera</span>
                </button>
                <button onClick={() => { setShowAddSheet(false); fileRef.current?.click(); }}
                  className="w-full bg-slate-700 text-white py-6 rounded-[2rem] font-black text-sm uppercase tracking-widest shadow-lg shadow-slate-200 active:scale-95 transition-all flex flex-col items-center gap-2">
                  <span className="text-3xl">📁</span>
                  <span className="text-[10px]">Upload File</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-4 text-red-500 font-bold text-xs animate-in slide-in-from-top-2">
          {error}
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        {['Lab Report', 'Imaging', 'Prescription'].map(cat => (
          <div key={cat} className="bg-white rounded-[1.5rem] p-4 border border-slate-100 text-center shadow-sm">
            <span className="text-2xl">{categoryIcons[cat]}</span>
            <p className="text-lg font-black text-slate-800 mt-1">{docs.filter(d => d.category === cat).length}</p>
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-tight">{cat}</p>
          </div>
        ))}
      </div>

      {docs.length === 0 ? (
        <div className="bg-white/50 border-2 border-dashed border-slate-200 rounded-[2.5rem] p-12 text-center">
          <div className="text-4xl mb-3">🗂️</div>
          <p className="text-slate-300 font-bold text-sm italic">No documents yet</p>
          <p className="text-[10px] font-bold text-slate-300 mt-1">Tap Add Document to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          {docs.map(doc => (
            <div key={doc.id} className="bg-white p-5 rounded-[1.8rem] border border-slate-100 shadow-sm flex items-center gap-4">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl flex-shrink-0 ${categoryColors[doc.category] || categoryColors['Other']}`}>
                {categoryIcons[doc.category] || '📄'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-800 text-sm truncate">{doc.name}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${categoryColors[doc.category] || categoryColors['Other']}`}>{doc.category}</span>
                  {doc.isDemo && <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-amber-50 text-amber-500">Demo</span>}
                  <span className="text-[10px] font-bold text-slate-300">{doc.date}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => handleOpen(doc)} className="text-blue-600 bg-blue-50 px-3 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all">Open</button>
                <button onClick={() => handleDelete(doc.id)} className="text-slate-300 hover:text-red-400 transition-colors text-xl px-1 py-2">×</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Demo doc modal */}
      {previewDoc && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6" onClick={() => setPreviewDoc(null)}>
          <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-sm shadow-2xl text-center" onClick={e => e.stopPropagation()}>
            <div className="text-4xl mb-4">{categoryIcons[previewDoc.category] || '📄'}</div>
            <h3 className="text-lg font-black text-slate-900 italic mb-2">{previewDoc.name}</h3>
            <p className="text-sm font-bold text-slate-400 mb-2">{previewDoc.category} • {previewDoc.date}</p>
            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 mb-6">
              <p className="text-xs font-bold text-amber-600">This is a demo document &mdash; no actual file is attached. Upload a real file to view it here.</p>
            </div>
            <button onClick={() => setPreviewDoc(null)} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest active:scale-95 transition-all">Got it</button>
          </div>
        </div>
      )}
    </div>
  );
}
