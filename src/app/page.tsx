"use client";
import React, { useState, useEffect, useRef } from 'react';
import LoginPage from '../views/LoginPage';
import HomePage from '../views/HomePage';
import StockPage from '../views/StockPage';
import ScanPage from '../views/ScanPage';
import VaultPage from '../views/VaultPage';
import ContactPage from '../views/ContactPage';
import CaretakerDashboard from '../views/CaretakerDashboard';
import MedicalIDModal from '../components/MedicalIDModal';
import BottomNav from '../components/BottomNav';
import NotificationBanner from '../components/NotificationBanner';
import OfflineIndicator from '../components/OfflineIndicator';
import { useNotifications } from '../hooks/useNotifications';
import { Medicine, UserProfile, VaultDoc, LoginMode, AppView } from '../types';
import { secureGet, secureSet } from '../lib/secureStorage';

// We removed the Express API bindings from the Replit version to keep Next.js security and Supabase actions safe.
// Next.js will use these local states for UI rendering, while backend sync will happen via Supabase in the future.

const DEFAULT_MEDICINES: Medicine[] = [
  { id: '1', name: 'Aspirin', stock: 12, doseTime: '12:30', doseTimes: ['12:30'], doseQuantity: 1, taken: false, takenTimes: [] },
];
const DEFAULT_VAULT: VaultDoc[] = [
  { id: '1', name: 'Blood Test Report.pdf', category: 'Lab Report', date: '2026-04-10', isDemo: true },
  { id: '2', name: 'X-Ray Chest.jpg', category: 'Imaging', date: '2026-03-22', isDemo: true },
  { id: '3', name: 'Prescription - Dr. Mehta.pdf', category: 'Prescription', date: '2026-04-28', isDemo: true },
];

function loadPlain<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback; } catch { return fallback; }
}
function savePlain(key: string, val: unknown) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

export default function CareSyncApp() {
  const [hasMounted, setHasMounted] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginMode, setLoginMode] = useState<LoginMode>('user');
  const [userProfile, setUserProfile] = useState<UserProfile>({ 
    name: '', bloodType: '', allergies: '', emergencyContactName: '', emergencyContactPhone: '' 
  });

  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [vaultDocs, setVaultDocs] = useState<VaultDoc[]>([]);
  const [secureLoaded, setSecureLoaded] = useState(false);

  const [currentView, setCurrentView] = useState<AppView>('home');
  const [showMedicalID, setShowMedicalID] = useState(false);

  const skipMedSync = useRef(false);
  const skipVaultSync = useRef(false);

  // Eliminate hydration errors by delaying the first real render until mount
  useEffect(() => {
    const loggedIn = loadPlain('cs_loggedIn', false);
    const mode = loadPlain('cs_loginMode', 'user');
    const profile = loadPlain('cs_profile', { 
      name: '', bloodType: '', allergies: '', emergencyContactName: '', emergencyContactPhone: '' 
    });

    setIsLoggedIn(loggedIn);
    setLoginMode(mode);
    setUserProfile(profile);
    
    setHasMounted(true);

    Promise.all([
      secureGet<Medicine[]>('cs_medicines', DEFAULT_MEDICINES),
      secureGet<VaultDoc[]>('cs_vault', DEFAULT_VAULT),
    ]).then(([meds, vault]) => {
      skipMedSync.current = true;
      skipVaultSync.current = true;
      setMedicines(meds);
      setVaultDocs(vault);
      setSecureLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!hasMounted || !secureLoaded) return;
    const today = new Date().toDateString();
    const lastReset = localStorage.getItem('cs_lastReset');
    if (lastReset !== today) {
      setMedicines(prev => prev.map(m => ({ ...m, taken: false, takenTimes: [] })));
      localStorage.setItem('cs_lastReset', today);
    }
  }, [secureLoaded]);

  useEffect(() => { savePlain('cs_loggedIn', isLoggedIn); }, [isLoggedIn]);
  useEffect(() => { savePlain('cs_loginMode', loginMode); }, [loginMode]);
  useEffect(() => { savePlain('cs_profile', userProfile); }, [userProfile]);

  useEffect(() => {
    if (!secureLoaded) return;
    if (skipMedSync.current) { skipMedSync.current = false; return; }
    secureSet('cs_medicines', medicines);
  }, [medicines, secureLoaded]);

  useEffect(() => {
    if (!secureLoaded) return;
    if (skipVaultSync.current) { skipVaultSync.current = false; return; }
    secureSet('cs_vault', vaultDocs);
  }, [vaultDocs, secureLoaded]);

  useNotifications(medicines, isLoggedIn && loginMode === 'user');

  const handleLogin = (profile: UserProfile, mode: LoginMode) => {
    setUserProfile(profile);
    setLoginMode(mode);
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentView('home');
  };

  if (!hasMounted) {
    return <main className="min-h-screen bg-[#F8FAFC]" />;
  }

  if (!isLoggedIn) return <LoginPage onLogin={handleLogin} />;

  if (loginMode === 'caretaker') {
    return (
      <>
        <OfflineIndicator />
        <CaretakerDashboard profile={userProfile} onLogout={handleLogout} apiToken={null} />
      </>
    );
  }

  const initials = userProfile.name
    ? userProfile.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : 'ME';

  if (!secureLoaded) {
    return (
      <main className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-blue-50 rounded-[2rem] flex items-center justify-center mx-auto text-2xl shadow-inner">🔒</div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Decrypting your data…</p>
          <div className="w-8 h-1 bg-blue-200 rounded-full mx-auto overflow-hidden">
            <div className="h-full bg-blue-600 rounded-full animate-pulse w-full" />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F8FAFC] text-[#1E293B] relative font-sans flex flex-col">
      <OfflineIndicator />
      <div className="max-w-md mx-auto p-6 flex flex-col flex-grow w-full pb-32">
        <header className="w-full mt-6 mb-8 flex justify-between items-center px-2">
          <div className="flex flex-col gap-1">
            <img src="/logo.png" alt="CareSync" className="h-10 w-auto object-contain object-left" />
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">AES-256 Encrypted</span>
            </div>
          </div>
          <button onClick={() => setShowMedicalID(true)} className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold border-2 border-blue-200">
            {initials}
          </button>
        </header>

        {currentView === 'home' && <NotificationBanner />}
        {currentView === 'home' && <HomePage medicines={medicines} setMedicines={setMedicines} profile={userProfile} />}
        {currentView === 'stock' && <StockPage medicines={medicines} setMedicines={setMedicines} />}
        {currentView === 'scan' && <ScanPage medicines={medicines} setMedicines={setMedicines} onDone={() => setCurrentView('home')} />}
        {currentView === 'vault' && <VaultPage docs={vaultDocs} setDocs={setVaultDocs} />}
        {currentView === 'contact' && <ContactPage profile={userProfile} />}
      </div>

      <BottomNav currentView={currentView} setCurrentView={setCurrentView} />
      {showMedicalID && (
        <MedicalIDModal profile={userProfile} setProfile={setUserProfile} onClose={() => setShowMedicalID(false)} onLogout={handleLogout} />
      )}
    </main>
  );
}