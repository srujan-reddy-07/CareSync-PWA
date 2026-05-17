# 🩺 CareSync — Your Personal Smart Health Companion
CareSync is a premium, beautifully crafted Personal Health Assistant designed to make managing medicines and medical records simple, safe, and entirely private. 

Built with a stunning glassmorphism design optimized for both mobile screens and desktops, CareSync transforms the chaotic chore of tracking pills and lab reports into a seamless, high-fidelity daily routine.

---

## ✨ What Makes CareSync Special? (Every Feature Explained)

### 📸 1. Smart Prescription Scanner (OCR-Powered)
Instead of typing out long, complicated chemical names and dosages by hand, CareSync uses local **Tesseract.js** client-side machine learning to analyze photos of your paper prescriptions instantly.
* **Smart Dosage Recognition:** Features a robust look-behind and look-ahead text analysis window (120-character range) that maps out dosage strengths (like *500mg* or *10ml*) even if the text is messy or out of order.
* **Auto-Normalization:** Clever regex algorithms automatically clean up standard scanner errors (e.g., misreading `O` as `0` or correcting garbled units like `rng` back to `mg`).
* **Special Instructions Extraction:** The OCR engine intelligently scans for phrases like *"after meals," "empty stomach,"* or *"with water"* and automatically populates notes for you.

### 🛡️ 2. Smart Drug-Interaction Guardian
Taking multiple medications can be dangerous if they conflict. CareSync features a **built-in safety net**:
* Every time you add a new medication—whether by scanning a prescription or typing it in manually—the app cross-references your current list against a local database of critical drug interactions.
* If a conflict is found (e.g., mixing Aspirin with Ibuprofen or Warfarin), a beautiful **Drug Interaction Warning overlay** alerts you with safety levels (Moderate/High/Critical) and medical details before the pill is added.

### 🔑 3. Ultra-Secure Medical Vault (Client-Side Encrypted)
Your medical data belongs to you. Period.
* **AES-256-GCM Encryption:** CareSync uses the browser's native **Web Crypto API (SubtleCrypto)** to secure your medical history timeline and files.
* **Client-Side Security:** Files like PDFs, X-Rays, and lab reports are encrypted *in the browser* using a secure user-derived key before they are saved.
* **Completely Private:** Even if your hosting server is compromised, no one can read your files without your secret encryption key.

### 🧑‍⚕️ 4. Caretaker Command Center
For families, caretakers, and nurses, CareSync has a complete **Caretaker Mode**:
* **Remote Management:** Easily link and view multiple patient profiles.
* **Full Scheduling Parity:** Caretakers can manually schedule medicines, configure multi-dose daily frequencies (Once, Twice, 3×, 4× daily, or Custom), and adjust dosages.
* **Dedicated Scanner Integration:** Caretakers can directly scan prescriptions on behalf of their patients, verify the extracted schedule, and instantly save it to their patient's live schedule.

### 📊 5. Intuitive Daily Tracker & Inventory Check
* **"One-Tap" Pill Counter:** Keep track of your daily doses in real-time. Tapping "Take" automatically logs the exact timestamp and deducts the dose from your inventory count.
* **Low Stock Alerts:** The progress-bar based inventory tracker flashes red and displays a **"Low Stock"** warning when a medicine falls below 5 pills, reminding you to refill.
* **Timestamps History:** Track exactly when you took each pill throughout the day with our beautiful timeline views.

---

## 🛠️ The Tech Behind the App
* **Frontend Architecture:** Next.js 16 (App Router) utilizing modern client-side views.
* **Styling System:** Custom Vanilla CSS styling paired with Tailwind CSS for curated, sleek dark-mode glassmorphic layouts.
* **Encryption Core:** Web Crypto API (AES-256-GCM).
* **Database & Auth Hooks:** Supabase SSR (Auth Middleware + secure server actions prepared).
* **AI OCR engine:** Local Tesseract.js worker thread.

---

## 📦 Getting Started & Running Locally

Want to host CareSync or run it on your machine? It takes less than 2 minutes to set up:

### 1. Grab dependencies
```bash
npm install
```

### 2. Configure your Environment Variables
Create a file named `.env.local` in the root folder of the project and paste your Supabase configuration:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-public-anon-key
```

### 3. Spin up the local development server
```bash
npm run dev
```
Open **`http://localhost:3000`** in your browser to experience CareSync locally!

### 4. Build a production bundle
To generate an optimized, statically pre-rendered bundle ready to upload to Vercel or any server:
```bash
npm run build
```

---

## 🔒 Security Guarantee
* **Zero Third-Party Leaks:** All OCR prescription processing happens right inside your browser window. No photos or prescription text blobs are ever sent to external AI servers.
* **Self-Contained Data:** All critical interactions and encryption happen locally, ensuring maximum HIPAA compliance.
