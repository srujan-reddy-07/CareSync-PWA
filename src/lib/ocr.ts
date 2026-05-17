import { createWorker } from 'tesseract.js';
import { MEDICINE_NAMES } from '../data/medicineNames';

export type ScannedMed = { name: string; quantity: string; doseTimes: string[]; total: number; strength: string; instructions: string };

export async function makeTesseractWorker(onProgress?: (p: number) => void) {
  return createWorker('eng', 1, {
    workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@v7.0.0/dist/worker.min.js',
    corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@v5.0.0/tesseract-core-simd-lstm.wasm.js',
    logger: (m: any) => {
      if (m.status === 'recognizing text' && onProgress) {
        onProgress(Math.round(m.progress * 100));
      }
    },
  });
}

export function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[m][n];
}

export function fuzzyMatchMedicine(text: string, medName: string): boolean {
  const tU = text.toUpperCase();
  const mU = medName.toUpperCase();
  if (tU.includes(mU)) return true;
  const tokens = tU.split(/[\s\n\r,;:.()[\]{}/\\|]+/).filter(w => w.length >= 3 && !/^\d+$/.test(w));
  const medTokens = mU.split(/\s+/);
  const threshold = Math.max(1, Math.floor(mU.replace(/\s/g, '').length / 7));
  if (medTokens.length === 1) {
    for (const tok of tokens) {
      if (Math.abs(tok.length - mU.length) > threshold + 1) continue;
      if (levenshtein(tok, mU) <= threshold) return true;
    }
  } else {
    for (let i = 0; i <= tokens.length - medTokens.length; i++) {
      const candidate = tokens.slice(i, i + medTokens.length).join(' ');
      if (levenshtein(candidate, mU) <= threshold * medTokens.length) return true;
    }
  }
  return false;
}

export function extractFromNumberedLines(text: string): string[] {
  const candidates: string[] = [];
  for (const line of text.split(/[\n\r]+/)) {
    const m = line.match(/^\s*\d+[\.\)]\s+([A-Za-z][a-z]{2,}(?:[-\s][A-Za-z][a-z]{2,})?)/);
    if (m) candidates.push(m[1].trim());
  }
  return candidates;
}

export function parseFrequency(context: string): string[] {
  const c = context.toLowerCase();
  if (/\b(qid|four\s*times|4\s*times|every\s*6\s*h)\b/.test(c)) return ['06:00', '12:00', '18:00', '22:00'];
  if (/\b(tid|three\s*times|3\s*times|thrice|every\s*8\s*h|t\.i\.d)\b/.test(c)) return ['08:00', '14:00', '21:00'];
  if (/\b(bid|twice|two\s*times|2\s*times|every\s*12|b\.i\.d)\b/.test(c)) return ['08:00', '20:00'];
  if (/\bnightly\b|\bbedtime\b|\bbefore\s*bed\b|\bat\s*night\b/.test(c)) return ['22:00'];
  if (/\bevening\b/.test(c)) return ['18:00'];
  if (/\bmorning\b/.test(c)) return ['08:00'];
  if (/\bonce\s*(daily|a\s*day)\b|\bqd\b/.test(c)) return ['08:00'];
  return ['08:00'];
}

export function extractDosageFromContext(context: string): string {
  const qtyM = context.match(/qty\s*[:\s]\s*(\d+)/i);
  if (qtyM) return qtyM[1];
  const countM = context.match(/(\d{1,3})\s*(?:tab|cap|pill|pc)/i);
  if (countM) return countM[1];
  return '30';
}

export function preprocessForOCR(source: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement): HTMLCanvasElement {
  try {
    if (!source) throw new Error('Source image is missing');
    const sw = source instanceof HTMLCanvasElement ? source.width
      : source instanceof HTMLVideoElement ? source.videoWidth
        : source.naturalWidth || 0;
    const sh = source instanceof HTMLCanvasElement ? source.height
      : source instanceof HTMLVideoElement ? source.videoHeight
        : source.naturalHeight || 0;
    const finalW = sw || (source as any).offsetWidth || 1;
    const finalH = sh || (source as any).offsetHeight || 1;
    const out = document.createElement('canvas');
    const scale = Math.min(2.0, 1500 / Math.max(finalW, finalH));
    out.width = Math.round(finalW * scale);
    out.height = Math.round(finalH * scale);
    const ctx = out.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Canvas context failed');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.filter = 'grayscale(1) contrast(1.5) brightness(1.1)';
    ctx.drawImage(source, 0, 0, out.width, out.height);
    return out;
  } catch (e) {
    console.warn('Preprocessing failed, using safety fallback:', e);
    const fallback = document.createElement('canvas');
    fallback.width = 1; fallback.height = 1;
    return fallback;
  }
}

export function normalizeOcrText(text: string): string {
  return text
    .replace(/\|/g, 'I')
    .replace(/\bI(?=[a-z])/g, 'l')
    .replace(/([a-zA-Z])0([a-zA-Z])/g, '$1O$2'); // Only convert 0 to O if surrounded by letters!
}

export function extractStrength(context: string): string {
  const m = context.match(/([0-9][0-9Oo]*(?:\.[0-9Oo]+)?)\s*(?:-|–)?\s*(mg|ml|mcg|g|iu|rn[gq]|m\s*g)\b/i);
  if (m) {
    let num = m[1].replace(/[Oo]/g, '0');
    let unit = m[2].toLowerCase().replace(/\s/g, '');
    if (unit === 'rng' || unit === 'rnq') unit = 'mg';
    return `${num}${unit}`;
  }
  return '';
}
export function extractInstructions(context: string): string {
  const c = context.toLowerCase();
  if (/\b(after\s*meals?|pc|post\s*meal)\b/.test(c)) return 'After meals';
  if (/\b(before\s*meals?|ac|pre\s*meal)\b/.test(c)) return 'Before meals';
  if (/\b(with\s*food|with\s*meals?)\b/.test(c)) return 'With food';
  if (/\b(empty\s*stomach)\b/.test(c)) return 'On empty stomach';
  if (/\b(with\s*water)\b/.test(c)) return 'With water';
  return '';
}

export function extractMedicinesFromText(rawText: string): ScannedMed[] {
  const text = normalizeOcrText(rawText);
  const found: ScannedMed[] = [];
  const seen = new Set<string>();

  const listedCandidates = extractFromNumberedLines(text);
  for (const candidate of listedCandidates) {
    for (const med of MEDICINE_NAMES) {
      if (seen.has(med.toUpperCase())) continue;
      if (fuzzyMatchMedicine(candidate, med)) {
        seen.add(med.toUpperCase());
        const idx = text.toUpperCase().indexOf(candidate.toUpperCase().slice(0, 6));
        const ctx = text.slice(Math.max(0, idx - 60), Math.min(text.length, idx + 120));
        found.push({ name: med, quantity: '1', doseTimes: parseFrequency(ctx), total: parseInt(extractDosageFromContext(ctx)) || 30, strength: extractStrength(ctx), instructions: extractInstructions(ctx) });
        break;
      }
    }
  }

  for (const med of MEDICINE_NAMES) {
    if (seen.has(med.toUpperCase())) continue;
    if (fuzzyMatchMedicine(text, med)) {
      seen.add(med.toUpperCase());
      const idx = text.toUpperCase().indexOf(med.toUpperCase().slice(0, 6));
      const ctx = text.slice(Math.max(0, idx - 60), Math.min(text.length, idx + 120));
      found.push({ name: med, quantity: '1', doseTimes: parseFrequency(ctx), total: parseInt(extractDosageFromContext(ctx)) || 30, strength: extractStrength(ctx), instructions: extractInstructions(ctx) });
    }
  }

  return found.slice(0, 8);
}