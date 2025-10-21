// apps/student/src/core/currency.ts
const KEY = 'qrpg_wallet_v1';
export type Wallet = { gold: number };
const DEF: Wallet = { gold: 0 };

export function loadWallet(): Wallet {
  try { return { ...DEF, ...JSON.parse(localStorage.getItem(KEY) ?? 'null') } } catch { return { ...DEF } }
}
export function saveWallet(w: Wallet){ localStorage.setItem(KEY, JSON.stringify(w)) }
export function addGold(n: number){ const w = loadWallet(); w.gold = Math.max(0, w.gold + Math.round(n)); saveWallet(w); return w }
export function canAfford(n: number){ return loadWallet().gold >= n }
export function spendGold(n: number){ const w = loadWallet(); if (w.gold < n) return false; w.gold -= n; saveWallet(w); return true }
