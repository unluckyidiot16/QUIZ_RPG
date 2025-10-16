// apps/student/src/core/wearable.sheet.ts
// Runtime Google Sheet loader (gviz) → ItemCatalog
import type {
  AnyItem,
  ItemCatalog,
  WearableItem,
  Rarity,
} from './wearable.types';

// ---- Env ----
const SHEET_ID =
  (import.meta as any).env?.VITE_WEAR_SHEET_ID ||
  (import.meta as any).env?.VITE_SHEET_ID ||
  '';

const SHEET_NAME =
  (import.meta as any).env?.VITE_WEAR_SHEET_NAME ||
  (import.meta as any).env?.VITE_SHEET_NAME ||
  'Wearables';

const ASSETS_ROOT =
  ((import.meta as any).env?.VITE_ASSETS_ROOT as string | undefined)?.replace(/\/+$/, '') || '';

// ---- Utils ----
const toNum = (v: any) => {
  if (v == null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

const truthy = (v: any) => {
  const s = String(v ?? '').trim().toLowerCase();
  return s === 'true' || s === '1' || s === 'y' || s === 'yes';
};

const RSET = new Set<Rarity>(['common','uncommon','rare','epic','legendary','mythic']);
const normRarity = (v: any): Rarity | undefined => {
  const s = String(v ?? '').trim().toLowerCase();
  return RSET.has(s as Rarity) ? (s as Rarity) : undefined;
};

const joinUrl = (root: string, p: string) =>
  !root ? p.replace(/^\/+/, '') : `${root}/${p.replace(/^\/+/, '')}`;

// gviz 응답에서 JSON만 추출
function parseGviz(text: string): any {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('gviz: invalid payload');
  return JSON.parse(text.slice(start, end + 1));
}

function gvizUrl(sheetId: string, sheetName: string) {
  const base = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq`;
  const q = encodeURIComponent('select *');
  const tqx = 'out:json';
  return `${base}?tqx=${tqx}&sheet=${encodeURIComponent(sheetName)}&tq=${q}`;
}

// ---- Main loader ----
export async function loadWearablesCatalog(): Promise<ItemCatalog> {
  if (!SHEET_ID) return {}; // env 누락 시 깔끔히 폴백

  try {
    const res = await fetch(gvizUrl(SHEET_ID, SHEET_NAME), { cache: 'no-store' });
    if (!res.ok) throw new Error(`gviz HTTP ${res.status}`);
    const raw = await res.text();
    const j = parseGviz(raw);

    // gviz 표 파싱
    const cols: string[] = (j.table?.cols || []).map((c: any) =>
      String(c?.label ?? '').trim().toLowerCase()
    );
    const rows: any[] = j.table?.rows || [];

    // 컬럼 인덱스 빠르게 찾기
    const idx = (name: string) => cols.indexOf(name);

    const I = {
      id: idx('id'),
      name: idx('name'),
      slot: idx('slot'),
      path: idx('path'),
      rarity: idx('rarity'),
      opacity: idx('opacity'),
      scale: idx('scale'),
      offsetX: idx('offsetx'),
      offsetY: idx('offsety'),
      aCols: idx('atlascols'),
      aRows: idx('atlasrows'),
      aFrames: idx('atlasframes'),
      aFps: idx('atlasfps'),
      active: idx('active'),
    };

    const cat: ItemCatalog = {};

    for (const r of rows) {
      const c = r.c || [];
      const get = (k: number) => (k >= 0 ? c[k]?.v ?? c[k]?.f ?? '' : '');

      const id = String(get(I.id) ?? '').trim();
      if (!id) continue;

      const active = truthy(get(I.active));
      if (I.active >= 0 && !active) continue; // active 컬럼이 있고 false면 스킵

      const name = String(get(I.name) ?? id).trim();
      const slot = String(get(I.slot) ?? '').trim() as WearableItem['slot'];
      const path = String(get(I.path) ?? '').trim();

      if (!slot) continue; // 필수
      if (!path) continue; // 필수

      const rarity = normRarity(get(I.rarity));
      const opacity = toNum(get(I.opacity));
      const scale = toNum(get(I.scale));
      const ox = toNum(get(I.offsetX));
      const oy = toNum(get(I.offsetY));
      const aCols = toNum(get(I.aCols));
      const aRows = toNum(get(I.aRows));
      const aFrames = toNum(get(I.aFrames));
      const aFps = toNum(get(I.aFps));

      const src = /^https?:\/\//i.test(path) ? path : joinUrl(ASSETS_ROOT, path);

      const wearable: WearableItem = {
        kind: 'cosmetic',
        id, name, slot, src,
        ...(rarity ? { rarity } : {}),
        ...(opacity != null ? { opacity } : {}),
        ...(scale   != null ? { scale }   : {}),
        ...((ox != null || oy != null) ? { offset: { x: ox || 0, y: oy || 0 } } : {}),
        ...((aCols && aRows && aFrames) ? {
          atlas: { cols: aCols, rows: aRows, frames: aFrames, ...(aFps ? { fps: aFps } : {}) }
        } : {})
      };

      cat[id] = wearable as AnyItem;
    }

    return cat;
  } catch (e) {
    // 실패 시 빈 카탈로그 반환 (catalog.ts에서 폴백 처리)
    return {};
  }
}

// catalog.ts가 두 이름 중 아무거나 부를 수 있도록 별칭 export
export const loadWearablesCatalogFromSheet = loadWearablesCatalog;
