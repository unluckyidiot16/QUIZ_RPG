// Google Sheets → Wearables 카탈로그 로더 (gviz JSON)
// 1) 시트에서 "웹에 게시" 후 사용
// 2) 기본은 /public/packs/wearables.v1.json 폴백

import type { WearableItem } from './wearable.types';

// 시트 컬럼 권장: id, name, slot, path, opacity, scale, offsetX, offsetY, atlasCols, atlasRows, atlasFrames, atlasFps, active
// path는 예: "Layer12_Hat/Hat_Cap_Red1.png" (상대) 또는 절대 URL

const ROOT = (import.meta.env.VITE_ASSETS_ROOT as string)
  ?? 'https://unluckyidiot16.github.io/assets-common/QuizRpg/';

const FALLBACK_JSON = '/packs/wearables.v1.json';

const join = (...p: string[]) => p.join('/').replace(/([^:])\/{2,}/g, '$1/');

function buildGvizUrl(sheetId: string, sheetName?: string, gid?: string){
  const base = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json`;
  if (sheetName) return `${base}&sheet=${encodeURIComponent(sheetName)}`;
  if (gid) return `${base}&gid=${encodeURIComponent(gid)}`;
  return base;
}

function parseGvizJSON(text: string){
  const m = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\)\s*;?$/);
  if (!m) throw new Error('gviz parse fail');
  return JSON.parse(m[1]);
}

function coerceNum(v:any){ const n = Number(v); return Number.isFinite(n) ? n : undefined; }
function coerceBool(v:any){ if (typeof v === 'boolean') return v; if (typeof v === 'string') return v.trim().toLowerCase()==='true'; return undefined; }

export async function fetchWearablesFromSheet(opts: {
  sheetId: string; sheetName?: string; gid?: string;
  assetsRoot?: string;
}): Promise<Record<string, WearableItem>> {
  const assetsRoot = (opts.assetsRoot ?? ROOT);

  // 1) gviz fetch
  let rows: any[] = [];
  let cols: any[] = [];
  try {
    const url = buildGvizUrl(opts.sheetId, opts.sheetName, opts.gid);
    const res = await fetch(url, { cache:'no-store' });
    const json = parseGvizJSON(await res.text());
    rows = json?.table?.rows ?? [];
    cols = json?.table?.cols ?? [];
  } catch (e) {
    // gviz 실패 시 폴백 JSON
    // eslint-disable-next-line no-console
    console.warn('[wearables] gviz failed, fallback to JSON', e);
    const res = await fetch(FALLBACK_JSON, { cache:'no-store' });
    if (!res.ok) throw new Error('fallback JSON missing');
    return await res.json();
  }

  // 2) 헤더 매핑 (라벨 기준)
  const idx: Record<string, number> = {};
  cols.forEach((c:any, i:number) => { idx[(c?.label||'').trim().toLowerCase()] = i; });

  const get = (r:any, key:string) => r?.c?.[idx[key]]?.v;

  // 3) 행 → WearableItem
  const map: Record<string, WearableItem> = {};
  for (const r of rows) {
    const active = coerceBool(get(r,'active'));
    if (active === false) continue;

    const id = String(get(r,'id') ?? '').trim();
    const name = String(get(r,'name') ?? id || '').trim();
    const slot = String(get(r,'slot') ?? '').trim(); // 'Hat' 등
    let path = String(get(r,'path') ?? '').trim();   // 절대 or 상대

    if (!id || !slot || !path) continue;
    const isAbs = /^https?:\/\//i.test(path);
    const src = isAbs ? path : join(assetsRoot, path);

    const opacity = coerceNum(get(r,'opacity'));
    const scale = coerceNum(get(r,'scale'));
    const offsetX = coerceNum(get(r,'offsetx'));
    const offsetY = coerceNum(get(r,'offsety'));
    const atlasCols = coerceNum(get(r,'atlascols'));
    const atlasRows = coerceNum(get(r,'atlasrows'));
    const atlasFrames = coerceNum(get(r,'atlasframes'));
    const atlasFps = coerceNum(get(r,'atlasfps'));

    const item: WearableItem = {
      id, name, slot: slot as any, src,
      opacity, scale,
      offset: (offsetX!=null || offsetY!=null) ? { x: offsetX||0, y: offsetY||0 } : undefined,
      atlas: (atlasCols && atlasRows && atlasFrames) ? {
        cols: atlasCols, rows: atlasRows, frames: atlasFrames, fps: atlasFps ?? 6
      } : undefined
    };
    map[id] = item;
  }
  return map;
}
