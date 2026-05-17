import React, { useState } from 'react';
import { UserProfile, LoginMode, AuthMethod } from '../types';
import { api } from '../lib/api';

interface Props {
  onLogin: (profile: UserProfile, mode: LoginMode, token?: string) => void;
}

export default function LoginPage({ onLogin }: Props) {
  const [loginMode, setLoginMode] = useState<LoginMode>('user');
  const [authMethod, setAuthMethod] = useState<AuthMethod>('otp');
  const [isSigningUp, setIsSigningUp] = useState(false);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');

  const validateEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  const validatePhone = (p: string) => /^\d{10}$/.test(p);
  const clearErrors = () => { setErrors({}); setApiError(''); };

  const handleSendOtp = async () => {
    const errs: Record<string, string> = {};
    if (isSigningUp && !name.trim()) errs.name = 'Full name is required';
    if (!validatePhone(phone)) errs.phone = 'Enter a valid 10-digit mobile number';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setLoading(true);
    setApiError('');
    try {
      await api.auth.sendOtp(phone, loginMode);
      setOtpSent(true);
    } catch (err: any) {
      setApiError(err.message || 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (authMethod === 'otp') {
      if (!otpSent) { handleSendOtp(); return; }
      const errs: Record<string, string> = {};
      if (!/^\d{6}$/.test(otp)) errs.otp = 'Enter the 6-digit OTP';
      setErrors(errs);
      if (Object.keys(errs).length) return;
      setLoading(true);
      setApiError('');
      try {
        const res = await api.auth.verifyOtp(phone, otp, name.trim() || undefined, loginMode);
        onLogin({
          name: res.user.name || name.trim() || 'User',
          bloodType: '', allergies: '', emergencyContactName: '', emergencyContactPhone: '',
        }, loginMode, res.token);
      } catch (err: any) {
        setApiError(err.message || 'Verification failed. Please try again.');
      } finally {
        setLoading(false);
      }
    } else {
      const errs: Record<string, string> = {};
      if (isSigningUp && !name.trim()) errs.name = 'Full name is required';
      if (!validateEmail(email)) errs.email = 'Enter a valid email address';
      if (password.length < 6) errs.password = 'Password must be at least 6 characters';
      if (isSigningUp && password !== confirmPassword) errs.confirmPassword = 'Passwords do not match';
      if (!isSigningUp && !Object.keys(errs).length) {
        const stored = localStorage.getItem(`cs_user_${email}`);
        if (!stored) errs.email = 'No account found with this email';
        else if (JSON.parse(stored).password !== password) errs.password = 'Incorrect password';
      }
      setErrors(errs);
      if (Object.keys(errs).length) return;
      setLoading(true);
      setTimeout(() => {
        const profileName = name.trim() || email.split('@')[0];
        if (isSigningUp) localStorage.setItem(`cs_user_${email}`, JSON.stringify({ name: profileName, password }));
        const saved = !isSigningUp ? JSON.parse(localStorage.getItem(`cs_user_${email}`) || '{}') : null;
        onLogin({ name: saved?.name || profileName, bloodType: '', allergies: '', emergencyContactName: '', emergencyContactPhone: '' }, loginMode);
        setLoading(false);
      }, 600);
    }
  };

  const handleDemoLogin = async (mode: LoginMode) => {
    setLoading(true);
    setApiError('');
    const demoPhone = mode === 'user' ? '9999999999' : '8888888888';
    const demoName = mode === 'user' ? 'Demo User' : 'Demo Caretaker';
    try {
      await api.auth.sendOtp(demoPhone, mode);
      const res = await api.auth.verifyOtp(demoPhone, '123456', demoName, mode);
      onLogin({ name: demoName, bloodType: 'O+', allergies: 'None', emergencyContactName: 'Demo', emergencyContactPhone: '9999999998' }, mode, res.token);
    } catch {
      onLogin({ name: demoName, bloodType: 'O+', allergies: 'None', emergencyContactName: 'Demo', emergencyContactPhone: '9999999998' }, mode);
    } finally {
      setLoading(false);
    }
  };

  const switchAuthMethod = () => { setAuthMethod(a => a === 'otp' ? 'password' : 'otp'); setOtpSent(false); clearErrors(); };
  const switchMode = () => { setIsSigningUp(s => !s); setOtpSent(false); clearErrors(); };

  return (
    <main className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-6 font-sans">
      <div className="w-full max-w-md bg-white rounded-[3rem] p-10 shadow-xl border border-slate-50">
        <header className="mb-8 text-center">
          <img src="/logo.png" alt="CareSync" className="w-44 mx-auto mb-4 drop-shadow-sm" />
          <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">
            {isSigningUp ? 'Join Network' : 'Welcome Back'}
          </p>
        </header>

        <div className="flex bg-slate-100 p-1.5 rounded-2xl mb-6">
          {(['user', 'caretaker'] as LoginMode[]).map(mode => (
            <button key={mode} onClick={() => setLoginMode(mode)}
              className={`flex-1 py-3 rounded-xl font-black text-[10px] transition-all ${loginMode === mode ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>
              {mode.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Demo button */}
        <button onClick={() => handleDemoLogin(loginMode)} disabled={loading}
          className="w-full mb-6 py-3 bg-blue-50 border-2 border-blue-100 text-blue-600 rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all disabled:opacity-60">
          ⚡ Try Demo {loginMode === 'caretaker' ? 'Caretaker' : 'User'} — No Signup Needed
        </button>

        {apiError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-2xl text-red-500 font-bold text-xs text-center">
            {apiError}
          </div>
        )}

        <div className="space-y-4 text-left">
          {isSigningUp && (
            <div>
              <label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Full Name</label>
              <input type="text" value={name} onChange={e => { setName(e.target.value); clearErrors(); }} placeholder="Enter your full name"
                className={`w-full p-5 bg-slate-50 border rounded-2xl font-bold text-sm outline-none mt-1 focus:ring-2 focus:ring-blue-100 transition-all ${errors.name ? 'border-red-300 bg-red-50' : 'border-slate-100'}`} />
              {errors.name && <p className="text-red-500 text-[10px] font-bold mt-1 ml-2">{errors.name}</p>}
            </div>
          )}

          {authMethod === 'otp' ? (
            <>
              <div>
                <label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Mobile Number</label>
                <input type="tel" value={phone} onChange={e => { setPhone(e.target.value.replace(/\D/g, '').slice(0, 10)); clearErrors(); }}
                  placeholder="Enter 10-digit number" disabled={otpSent}
                  className={`w-full p-5 bg-slate-50 border rounded-2xl font-bold text-sm outline-none mt-1 focus:ring-2 focus:ring-blue-100 transition-all ${errors.phone ? 'border-red-300 bg-red-50' : 'border-slate-100'} ${otpSent ? 'opacity-60' : ''}`} />
                {errors.phone && <p className="text-red-500 text-[10px] font-bold mt-1 ml-2">{errors.phone}</p>}
              </div>
              {otpSent && (
                <div className="animate-in slide-in-from-top-2 duration-300">
                  <div className="flex justify-between items-center ml-2 mb-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">OTP</label>
                    <span className="text-[10px] font-bold text-green-600">OTP sent ✓ (use any 6 digits)</span>
                  </div>
                  <input type="tel" value={otp} onChange={e => { setOtp(e.target.value.replace(/\D/g, '').slice(0, 6)); clearErrors(); }}
                    placeholder="Enter 6-digit OTP" autoFocus
                    className={`w-full p-5 bg-slate-50 border rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-100 transition-all ${errors.otp ? 'border-red-300 bg-red-50' : 'border-slate-100'}`} />
                  {errors.otp && <p className="text-red-500 text-[10px] font-bold mt-1 ml-2">{errors.otp}</p>}
                  <button onClick={() => { setOtpSent(false); setOtp(''); }} className="text-[10px] font-bold text-blue-500 mt-2 ml-2">Change number</button>
                </div>
              )}
            </>
          ) : (
            <>
              <div>
                <label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Email Address</label>
                <input type="email" value={email} onChange={e => { setEmail(e.target.value); clearErrors(); }} placeholder="Enter email"
                  className={`w-full p-5 bg-slate-50 border rounded-2xl font-bold text-sm outline-none mt-1 focus:ring-2 focus:ring-blue-100 transition-all ${errors.email ? 'border-red-300 bg-red-50' : 'border-slate-100'}`} />
                {errors.email && <p className="text-red-500 text-[10px] font-bold mt-1 ml-2">{errors.email}</p>}
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Password</label>
                <input type="password" value={password} onChange={e => { setPassword(e.target.value); clearErrors(); }} placeholder="Min 6 characters"
                  className={`w-full p-5 bg-slate-50 border rounded-2xl font-bold text-sm outline-none mt-1 focus:ring-2 focus:ring-blue-100 transition-all ${errors.password ? 'border-red-300 bg-red-50' : 'border-slate-100'}`} />
                {errors.password && <p className="text-red-500 text-[10px] font-bold mt-1 ml-2">{errors.password}</p>}
              </div>
              {isSigningUp && (
                <div>
                  <label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Confirm Password</label>
                  <input type="password" value={confirmPassword} onChange={e => { setConfirmPassword(e.target.value); clearErrors(); }} placeholder="Re-enter password"
                    className={`w-full p-5 bg-slate-50 border rounded-2xl font-bold text-sm outline-none mt-1 focus:ring-2 focus:ring-blue-100 transition-all ${errors.confirmPassword ? 'border-red-300 bg-red-50' : 'border-slate-100'}`} />
                  {errors.confirmPassword && <p className="text-red-500 text-[10px] font-bold mt-1 ml-2">{errors.confirmPassword}</p>}
                </div>
              )}
            </>
          )}

          <button onClick={handleSubmit} disabled={loading}
            className="w-full bg-blue-600 text-white py-5 rounded-[2.5rem] font-black text-lg shadow-xl active:scale-95 transition-all mt-4 disabled:opacity-70">
            {loading ? '...' : authMethod === 'otp' && !otpSent ? 'SEND OTP' : isSigningUp ? 'SIGN UP' : 'SIGN IN'}
          </button>
        </div>

        <div className="mt-8 flex flex-col gap-4 text-center">
          <button onClick={switchAuthMethod} className="text-[10px] font-black text-blue-600 uppercase underline decoration-blue-100 underline-offset-4">
            Use {authMethod === 'otp' ? 'Email & Password' : 'Phone & OTP'}
          </button>
          <button onClick={switchMode} className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            {isSigningUp ? 'Already have an account? Login' : "Don't have an account? Signup"}
          </button>
        </div>
      </div>
    </main>
  );
}
