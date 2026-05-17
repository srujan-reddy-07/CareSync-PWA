export type Severity = 'major' | 'moderate' | 'minor';

export interface DrugInteraction {
  drugs: [string, string];
  severity: Severity;
  effect: string;
  advice: string;
}

export interface DetectedInteraction extends DrugInteraction {
  withDrug: string;
}

// ─── Interaction Database ───────────────────────────────────────────────────
// Each entry: drugs are partial-name fragments (lowercase) matched via includes()
export const DRUG_INTERACTIONS: DrugInteraction[] = [
  // ── Bleeding / Anticoagulant ──────────────────────────────────────────────
  { drugs: ['warfarin', 'aspirin'],        severity: 'major',    effect: 'Greatly increased bleeding risk', advice: 'Monitor INR closely; use gastroprotectant' },
  { drugs: ['warfarin', 'ibuprofen'],      severity: 'major',    effect: 'Increased bleeding risk',         advice: 'Avoid combination; use Paracetamol instead' },
  { drugs: ['warfarin', 'naproxen'],       severity: 'major',    effect: 'Increased bleeding risk',         advice: 'Avoid — use Paracetamol for pain relief' },
  { drugs: ['warfarin', 'fluconazole'],    severity: 'major',    effect: 'Markedly increased INR / bleeding', advice: 'Consider dose reduction; monitor INR daily' },
  { drugs: ['warfarin', 'amiodarone'],     severity: 'major',    effect: 'Severely raised INR',             advice: 'Halve warfarin dose; monitor INR weekly' },
  { drugs: ['warfarin', 'rifampicin'],     severity: 'major',    effect: 'Drastically reduced anticoagulation', advice: 'Avoid or double warfarin dose with frequent INR monitoring' },
  { drugs: ['warfarin', 'phenytoin'],      severity: 'moderate', effect: 'Unpredictable INR changes',       advice: 'Monitor INR at least weekly during co-therapy' },
  { drugs: ['warfarin', 'clarithromycin'], severity: 'major',    effect: 'Elevated INR; bleeding risk',     advice: 'Monitor INR every 1–2 days during antibiotic course' },
  { drugs: ['amiodarone', 'warfarin'],     severity: 'major',    effect: 'Potentiated anticoagulation',     advice: 'Reduce warfarin by 30–50%; close INR monitoring' },
  { drugs: ['aspirin', 'ibuprofen'],       severity: 'moderate', effect: "Ibuprofen reduces aspirin's antiplatelet effect", advice: 'Take aspirin 2 h before ibuprofen or switch to Paracetamol' },
  { drugs: ['clopidogrel', 'omeprazole'],  severity: 'moderate', effect: 'Reduced antiplatelet effectiveness', advice: 'Prefer pantoprazole or rabeprazole as PPI alternative' },
  { drugs: ['clopidogrel', 'pantoprazole'], severity: 'minor',   effect: 'Slight reduction in clopidogrel effect', advice: 'Acceptable combination; monitor clinically' },

  // ── Cardiovascular ────────────────────────────────────────────────────────
  { drugs: ['metoprolol', 'verapamil'],    severity: 'major',    effect: 'Bradycardia and heart block risk', advice: 'Avoid combination; use alternate antianginal' },
  { drugs: ['atenolol', 'verapamil'],      severity: 'major',    effect: 'Bradycardia and heart block risk', advice: 'Avoid; if needed, monitor HR/ECG closely' },
  { drugs: ['digoxin', 'amiodarone'],      severity: 'major',    effect: 'Digoxin toxicity (nausea, arrhythmia)', advice: 'Reduce digoxin dose by 50%; monitor levels' },
  { drugs: ['amlodipine', 'simvastatin'],  severity: 'moderate', effect: 'Increased simvastatin levels → myopathy', advice: 'Cap simvastatin at 20 mg/day with amlodipine' },
  { drugs: ['amlodipine', 'cyclosporine'], severity: 'major',    effect: 'Elevated cyclosporine levels',    advice: 'Monitor cyclosporine trough levels; consider dose adjustment' },

  // ── Statins ───────────────────────────────────────────────────────────────
  { drugs: ['simvastatin', 'amiodarone'],  severity: 'major',    effect: 'Myopathy / rhabdomyolysis risk',  advice: 'Cap simvastatin at 20 mg/day; prefer rosuvastatin' },
  { drugs: ['simvastatin', 'clarithromycin'], severity: 'major', effect: 'Severe myopathy risk',            advice: 'Withhold simvastatin during antibiotic course' },
  { drugs: ['atorvastatin', 'clarithromycin'], severity: 'major', effect: 'Elevated atorvastatin → myopathy', advice: 'Use lowest effective dose; monitor for muscle pain' },

  // ── Serotonin Syndrome ────────────────────────────────────────────────────
  { drugs: ['fluoxetine', 'tramadol'],     severity: 'major',    effect: 'Serotonin syndrome (life-threatening)', advice: 'Avoid — use non-opioid analgesics with SSRIs' },
  { drugs: ['sertraline', 'tramadol'],     severity: 'major',    effect: 'Serotonin syndrome risk',         advice: 'Avoid — choose non-serotonergic analgesic' },
  { drugs: ['paroxetine', 'tramadol'],     severity: 'major',    effect: 'Serotonin syndrome + CYP2D6 inhibition raises tramadol levels', advice: 'Contraindicated; use alternative pain relief' },
  { drugs: ['escitalopram', 'tramadol'],   severity: 'major',    effect: 'Serotonin syndrome risk',         advice: 'Avoid combination' },
  { drugs: ['citalopram', 'tramadol'],     severity: 'major',    effect: 'Serotonin syndrome + QT prolongation', advice: 'Contraindicated; select non-serotonergic analgesic' },
  { drugs: ['fluoxetine', 'maoi'],         severity: 'major',    effect: 'Potentially fatal serotonin syndrome', advice: 'Contraindicated — 14-day washout required between drugs' },
  { drugs: ['sertraline', 'maoi'],         severity: 'major',    effect: 'Potentially fatal serotonin syndrome', advice: 'Contraindicated — 14-day washout required' },

  // ── Nephrotoxicity / Renal ────────────────────────────────────────────────
  { drugs: ['methotrexate', 'ibuprofen'],  severity: 'major',    effect: 'Methotrexate toxicity (bone marrow, GI, kidneys)', advice: 'Avoid NSAIDs with methotrexate; use Paracetamol' },
  { drugs: ['methotrexate', 'naproxen'],   severity: 'major',    effect: 'Methotrexate toxicity',           advice: 'Avoid — use Paracetamol only' },
  { drugs: ['lithium', 'ibuprofen'],       severity: 'major',    effect: 'Lithium toxicity (tremor, confusion, arrhythmia)', advice: 'Avoid NSAIDs; use Paracetamol; monitor lithium levels' },
  { drugs: ['lithium', 'naproxen'],        severity: 'major',    effect: 'Lithium toxicity',                advice: 'Avoid; monitor lithium serum level if unavoidable' },
  { drugs: ['lisinopril', 'spironolactone'], severity: 'major',  effect: 'Hyperkalemia risk',               advice: 'Monitor potassium levels every 1–3 months' },
  { drugs: ['ramipril', 'spironolactone'], severity: 'major',    effect: 'Hyperkalemia risk',               advice: 'Monitor potassium closely' },
  { drugs: ['enalapril', 'spironolactone'], severity: 'major',   effect: 'Hyperkalemia risk',               advice: 'Check serum potassium regularly' },

  // ── Metabolic ─────────────────────────────────────────────────────────────
  { drugs: ['metformin', 'alcohol'],       severity: 'moderate', effect: 'Lactic acidosis risk',            advice: 'Avoid alcohol use; ensure adequate hydration' },
  { drugs: ['ciprofloxacin', 'theophylline'], severity: 'major', effect: 'Theophylline toxicity (seizures, arrhythmia)', advice: 'Reduce theophylline dose by 50–75%; monitor levels' },

  // ── Seizure / CNS ─────────────────────────────────────────────────────────
  { drugs: ['carbamazepine', 'lamotrigine'], severity: 'moderate', effect: 'Reduced lamotrigine levels; loss of seizure control', advice: 'Increase lamotrigine dose; monitor serum levels' },

  // ── GI Bleeding ───────────────────────────────────────────────────────────
  { drugs: ['prednisolone', 'ibuprofen'],  severity: 'moderate', effect: 'Additive GI bleeding risk',       advice: 'Use PPI prophylaxis; prefer Paracetamol' },
  { drugs: ['dexamethasone', 'ibuprofen'], severity: 'moderate', effect: 'Additive GI ulcer risk',          advice: 'Add PPI cover; minimise NSAID use' },
  { drugs: ['prednisolone', 'aspirin'],    severity: 'moderate', effect: 'GI bleeding risk',                advice: 'Use PPI cover; monitor for GI symptoms' },
];

// ─── Checker ─────────────────────────────────────────────────────────────────
export function checkDrugInteractions(
  newDrug: string,
  existingDrugs: string[]
): DetectedInteraction[] {
  const results: DetectedInteraction[] = [];
  const newLower = newDrug.toLowerCase();

  for (const existing of existingDrugs) {
    const existLower = existing.toLowerCase();
    for (const pair of DRUG_INTERACTIONS) {
      const [a, b] = pair.drugs;
      const match =
        (newLower.includes(a) && existLower.includes(b)) ||
        (newLower.includes(b) && existLower.includes(a));
      if (match) {
        results.push({ ...pair, withDrug: existing });
      }
    }
  }
  return results;
}
