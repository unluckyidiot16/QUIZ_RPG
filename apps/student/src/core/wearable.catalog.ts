// apps/student/src/core/wearable.catalog.ts
// Wearables/Items catalog loader (JSON → fallback to Sheet), catalog-agnostic.
// - Primary: /packs/wearables.v1.json (from GitHub Actions)
// - Fallback: runtime Google Sheet loader (optional)
// - Normalizes legacy cosmetic-only JSON (no `kind`) to AnyItem

import type {
  AnyItem,
  ItemCatalog,
  WearableCatalog,
  WearableItem,
} from './wearable.types';
import { isCosmetic } from './wearable.types';

// ===== Config =====
const PACKS_BASE = (import.meta as any).env?.VITE_PACKS_BASE as string | undefined;
// e.g. VITE_PACKS_BASE=https://cdn.example.com/packs
const DEFAULT_JSON_URL = PACKS_BASE
  ? `${PACKS_BASE.replace(/\/+$/, '')}/wearables.v1.json`
  : '/packs/wearables.v1.json';

// ===== In-memory cache =====
let _cache: ItemCatalog | null = null;

// ===== Normalizers =====
function normalizeLegacy(obj: Record<string, any>): ItemCatalog {
  // Legacy format: { [id]: { id, name, slot, src, ... } } without `kind`.
  const out: ItemCatalog = {};
  for (const [id, raw] of Object.entries(obj || {})) {
    if (!raw || typeof raw !== 'object') continue;
    // If it looks like a wearable (has slot/src), treat as cosmetic
    if (raw.slot && raw.src) {
      const it: WearableItem = {
        kind: 'cosmetic',
        id: raw.id ?? id,
        name: raw.name ?? id,
        slot: raw.slot,
        src: raw.src,
        rarity: raw.rarity,
        opacity: raw.opacity,
        scale: raw.scale,
        offset: raw.offset,
        atlas: raw.atlas,
      };
      out[id] = it as AnyItem;
    } else {
      // Unknown shape → skip (or keep as-is if you want to surface)
    }
  }
  return out;
}

function normalizeAny(obj: unknown): ItemCatalog {
  if (!obj || typeof obj !== 'object') return {};
  // Heuristic: if entries have `kind`, assume AnyItem map; else legacy cosmetic map.
  const sample = Object.values(obj as Record<string, any>)[0];
  if (sample && typeof sample === 'object' && 'kind' in sample) {
    // Already AnyItem map
    return obj as ItemCatalog;
  }
  return normalizeLegacy(obj as Record<string, any>);
}

// ===== Primary loader (JSON) =====
async function fetchJsonCatalog(url: string, bust = false): Promise<ItemCatalog> {
  const u = bust ? `${url}${url.includes('?') ? '&' : '?'}b=${Date.now()}` : url;
  const res = await fetch(u, { cache: 'no-store' });
  if (!res.ok) throw new Error(`catalog HTTP ${res.status}`);
  const data = await res.json();
  return normalizeAny(data);
}

// ===== Fallback loader (runtime Sheet) =====
async function fetchSheetCatalog(): Promise<ItemCatalog> {
  try {
    // Optional dynamic import to avoid bundling if not used.
    const mod = await import('./wearable.sheet');
    // Expect: mod.loadWearablesCatalogFromSheet? or mod.loadWearablesCatalog?
    const fn =
      (mod as any).loadWearablesCatalogFromSheet ||
      (mod as any).loadWearablesCatalog ||
      null;
    if (!fn) throw new Error('no sheet loader export');
    const data = await fn();
    return normalizeAny(data);
  } catch {
    return {};
  }
}

/**
 * Load wearables/items catalog
 * @param opts.url   override JSON url
 * @param opts.bust  add cache-busting query param
 * @param opts.skipSheetFallback  if true, do not try sheet fallback
 */
export async function loadWearablesCatalog(opts?: {
  url?: string;
  bust?: boolean;
  skipSheetFallback?: boolean;
}): Promise<ItemCatalog> {
  if (_cache) return _cache;

  const url = opts?.url ?? DEFAULT_JSON_URL;
  try {
    _cache = await fetchJsonCatalog(url, !!opts?.bust);
    if (!_cache || Object.keys(_cache).length === 0 && !opts?.skipSheetFallback) {
      // Empty file → try sheet
      const fallback = await fetchSheetCatalog();
      if (Object.keys(fallback).length) _cache = fallback;
    }
  } catch {
    if (!opts?.skipSheetFallback) {
      const fallback = await fetchSheetCatalog();
      if (Object.keys(fallback).length) _cache = fallback;
    }
    _cache ||= {};
  }
  return _cache;
}

/**
 * Force-refresh the in-memory cache (e.g., after manual JSON update)
 */
export async function reloadWearablesCatalog(opts?: {
  url?: string;
  bust?: boolean;
  skipSheetFallback?: boolean;
}): Promise<ItemCatalog> {
  _cache = null;
  return loadWearablesCatalog({ ...opts, bust: true });
}

/**
 * Convenience: get only cosmetic items (for Avatar rendering)
 */
export async function loadCosmeticsCatalog(opts?: {
  url?: string;
  bust?: boolean;
  skipSheetFallback?: boolean;
}): Promise<WearableCatalog> {
  const cat = await loadWearablesCatalog(opts);
  const out: WearableCatalog = {};
  for (const [id, it] of Object.entries(cat)) {
    if (isCosmetic(it)) out[id] = it;
  }
  return out;
}

// ----- Optional legacy named export to avoid imports breaking -----
// Some older code might import { WEARABLES }. Export an empty map safely.
export const WEARABLES: WearableCatalog = {};
