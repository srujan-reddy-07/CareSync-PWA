export type Medicine = {
  id: string;
  name: string;
  stock: number;
  doseTime: string;       // first dose time (kept for compat)
  doseTimes: string[];    // all scheduled dose times for the day (≥1)
  doseQuantity: number;
  dosage?: string;        // strength per pill, e.g. "500mg", "10ml"
  instructions?: string;  // special instructions e.g. "Take after meals"
  taken: boolean;         // true when ALL doseTimes are in takenTimes
  takenTimes: string[];   // specific times already logged today
};

export type UserProfile = {
  name: string;
  bloodType: string;
  allergies: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
};

export type VaultDoc = {
  id: string;
  name: string;
  category: string;
  date: string;
  dataUrl?: string;
  fileData?: string;
  isDemo?: boolean;
};

export type LoginMode = 'user' | 'caretaker';
export type AuthMethod = 'otp' | 'password';
export type AppView = 'home' | 'stock' | 'scan' | 'vault' | 'contact';
