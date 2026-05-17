import React, { useState } from 'react';
import { UserProfile } from '../types';

interface Props {
  profile: UserProfile;
  setProfile: React.Dispatch<React.SetStateAction<UserProfile>>;
  onClose: () => void;
  onLogout: () => void;
}

export default function MedicalIDModal({ profile, setProfile, onClose, onLogout }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<UserProfile>(profile);

  const handleSave = () => {
    setProfile(draft);
    setEditing(false);
  };

  const field = (label: string, key: keyof UserProfile, type = 'text', placeholder = '') => (
    <div className="bg-slate-50 rounded-2xl p-4">
      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">{label}</span>
      {editing ? (
        <input
          type={type}
          value={draft[key]}
          onChange={e => setDraft(d => ({ ...d, [key]: e.target.value }))}
          placeholder={placeholder || `Enter ${label.toLowerCase()}`}
          className="w-full font-bold text-slate-800 bg-white border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-blue-100 text-sm transition-all"
        />
      ) : (
        <span className="font-bold text-slate-800">{profile[key] || <span className="text-slate-300 italic font-medium">Not set</span>}</span>
      )}
    </div>
  );

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6"
      onClick={!editing ? onClose : undefined}
    >
      <div
        className="bg-white rounded-[2.5rem] p-8 w-full max-w-sm shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-black text-slate-900 italic">Medical ID</h2>
          {!editing && (
            <button
              onClick={() => { setDraft(profile); setEditing(true); }}
              className="text-[10px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 px-3 py-1.5 rounded-xl"
            >
              Edit
            </button>
          )}
        </div>

        <div className="space-y-3">
          {field('Full Name', 'name', 'text', 'Your full name')}
          {field('Blood Type', 'bloodType', 'text', 'e.g. O+')}
          {field('Allergies', 'allergies', 'text', 'e.g. Penicillin, Peanuts')}
          {field('Emergency Contact Name', 'emergencyContactName', 'text', 'e.g. Srujan Reddy')}
          {field('Emergency Contact Phone', 'emergencyContactPhone', 'tel', 'e.g. 9876543210')}
        </div>

        {editing ? (
          <div className="mt-6 space-y-3">
            <button
              onClick={handleSave}
              className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-sm shadow-lg active:scale-95 transition-all"
            >
              Save Changes
            </button>
            <button
              onClick={() => { setDraft(profile); setEditing(false); }}
              className="w-full py-3 text-slate-400 font-bold text-sm"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            <button
              onClick={onClose}
              className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-sm shadow-lg active:scale-95 transition-all"
            >
              Close
            </button>
            <button
              onClick={onLogout}
              className="w-full py-3 text-red-400 font-black text-sm uppercase tracking-widest"
            >
              Logout
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
