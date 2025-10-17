// scripts/sheet_to_wearables.mjs
// Google Sheet(gviz JSON) → apps/student/public/packs/wearables.v1.json
// 컬럼 권장: id, name, slot, path, opacity, scale, offsetX, offsetY, atlasCols, atlasRows, atlasFrames, atlasFps, active

import fs from 'node:fs/promises';
import path from 'node:path';

const RSET = new Set(['common','uncommon','rare','epic','legendary','mythic']);
const normRarity = v => {
  const s = String(v ?? '').trim().toLowerCase();
  return RSET.has(s) ? s : undefined;
};

// ── add under existing const RSET/normRarity ──
const RMAP = new Map([
  ['n','common'], ['common','common'],
  ['r','rare'],   ['rare','rare'],
  ['sr','epic'],  ['epic','epic'],
  ['ssr','legendary'], ['legendary','legendary'],
  ['mythic','mythic'],
]);
const normRarity2 = v => {
  const s = String(v ?? '').trim().toLowerCase();
  return RMAP.get(s) || (RSET.has(s) ? s : undefined);
};

const SLOT_SYNONYM = new Map([
  ['shirt','Clothes'], ['shirts','Clothes'], ['dress','Clothes'],
  ['scaf','Scarf'],    ['scarf','Scarf'],
  ['hair','Hair'], ['hat','Hat'], ['bow','Hat'],
  ['bag','Bag'],   ['bowtie','Bowtie'], ['necklace','Necklace'],
  ['pants','Pants'], ['shoes','Shoes'],
  ['bodysuit','BodySuit'], ['sleeve','Sleeves'], ['sleeves','Sleeves'],
  ['body','Body'], ['face','Face'], ['clothes','Clothes'],
]);

function inferSlotFromId(id='') {
  const s = String(id).toLowerCase();
  for (const [k, v] of SLOT_SYNONYM) {
    if (s.startsWith(k + '.')) return v;
  }
  return undefined;
}

function canonSlot(slotRaw, id) {
  const raw = String(slotRaw ?? '').trim();
  if (ALLOWED_SLOTS.has(raw)) return raw;
  const syn = SLOT_SYNONYM.get(raw.toLowerCase());
  if (syn && ALLOWED_SLOTS.has(syn)) return syn;
  const inf = inferSlotFromId(id);
  if (inf && ALLOWED_SLOTS.has(inf)) return inf;
  return undefined;
}


const SHEET_ID   = process.env.SHEET_ID;
const SHEET_NAME = process.env.SHEET_NAME || '';
const ASSETS_ROOT = (process.env.ASSETS_ROOT || 'https://unluckyidiot16.github.io/assets-common/QuizRpg/').replace(/\/+$/,'') + '/';
const OUT_PATH   = process.env.OUT_PATH || 'apps/student/public/packs/wearables.v1.json';
const FORCE      = String(process.env.FORCE || 'false').toLowerCase() === 'true';

if (!SHEET_ID) {
  console.error('[wearables] SHEET_ID is required (secrets.WEAR_SHEET_ID).');
  process.exit(1);
}

const ALLOWED_SLOTS = new Set([
  'Body','Face','BodySuit','Pants','Shoes','Clothes',
  'Sleeves','Necklace','Bag','Scarf','Bowtie','Hair','Hat'
]);

const joinUrl = (...p) => p.join('/').replace(/([^:])\/{2,}/g, '$1/');

function buildGvizUrl(id, sheetName=''){
  const base = `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:json`;
  return sheetName ? `${base}&sheet=${encodeURIComponent(sheetName)}` : base;
}

function parseGviz(text){
  const m = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\)\s*;?$/);
  if (!m) throw new Error('gviz parse fail: unexpected response');
  return JSON.parse(m[1]);
}

function toNum(v){ const n = Number(v); return Number.isFinite(n) ? n : undefined; }
function toBool(v){ if (typeof v === 'boolean') return v; if (typeof v === 'string') return v.trim().toLowerCase()==='true'; return undefined; }

function mapHeader(cols){
  const idx = {};
  cols.forEach((c, i) => { idx[(c?.label || '').trim().toLowerCase()] = i; });
  return (row, key) => row?.c?.[idx[key]]?.v;
}

async function main(){
  console.log('[wearables] fetching sheet…');
  let json;
  try {
    const url = buildGvizUrl(SHEET_ID, SHEET_NAME);
    const res = await fetch(url, { cache: 'no-store' });
    const txt = await res.text();
    json = parseGviz(txt);
  } catch (e) {
    console.error('[wearables] gviz fetch failed:', e?.message || e);
    if (!FORCE) {
      // 실패 시도: 변경 없음 처리 (워크플로우가 실패로 끊기지 않도록)
      process.exit(0);
    }
    throw e;
  }

  const rows = json?.table?.rows || [];
  const cols = json?.table?.cols || [];
  const get = mapHeader(cols);

  /** @type {Record<string, any>} */
  const out = {};
  let total = 0, kept = 0, skipped = 0;

  for (const r of rows) {
    total++;
    const active = toBool(get(r,'active'));
    if (active === false) { skipped++; continue; }

    const id   = String(get(r,'id') ?? '').trim();
    const name = String((get(r,'name') ?? id) || '').trim();
    // slot 유연화(동의어/추론 포함)
    const slot = canonSlot(get(r,'slot'), id);
    // path, src, image, url, thumbnail, file, images[0], assets[0] 등 폭넓게 지원
    const candidates = [
      get(r,'path'), get(r,'src'), get(r,'image'), get(r,'url'),
      get(r,'thumbnail'), get(r,'file')
    ];
    // 배열형 열(images/assets)에 첫 값이 들어오는 경우
    const imagesCell = get(r,'images');   // "a|b|c" 처럼 들어오면 첫 값
    const assetsCell = get(r,'assets');
    if (imagesCell && typeof imagesCell === 'string') {
      candidates.push(imagesCell.split(/[|,]/)[0]);
    }
    if (assetsCell && typeof assetsCell === 'string') {
      candidates.push(assetsCell.split(/[|,]/)[0]);
    }
    let pth = '';
    for (const v of candidates) {
      const s = String(v ?? '').trim();
      if (s) { pth = s; break; }
    }

    if (!id)  { console.warn(`[wearables] skip: missing id`); skipped++; continue; }
    if (!slot){ console.warn(`[wearables] skip: missing/invalid slot @${id}`); skipped++; continue; }
    if (!pth) { console.warn(`[wearables] skip: missing path/src @${id}`); skipped++; continue; }

    const isAbs = /^https?:\/\//i.test(pth);
        // 앞뒤 슬래시 정리
    const cleaned = pth.replace(/^\.?\/*/, '');
    const src = isAbs ? pth : joinUrl(ASSETS_ROOT, cleaned);

    const opacity = toNum(get(r,'opacity'));
    const scale   = toNum(get(r,'scale'));
    const ox      = toNum(get(r,'offsetx'));
    const oy      = toNum(get(r,'offsety'));
    const aCols   = toNum(get(r,'atlascols'));
    const aRows   = toNum(get(r,'atlasrows'));
    const aFrames = toNum(get(r,'atlasframes'));
    const aFps    = toNum(get(r,'atlasfps'));
    const rarity  = normRarity2(get(r,'rarity'));

    
    const item = {
      id, name, slot, src,
      ...(rarity ? { rarity } : {}),
      ...(opacity != null ? { opacity } : {}),
      ...(scale   != null ? { scale }   : {}),
      ...((ox != null || oy != null) ? { offset: { x: ox || 0, y: oy || 0 } } : {}),
      ...((aCols && aRows && aFrames) ? { atlas: { cols: aCols, rows: aRows, frames: aFrames, ...(aFps?{fps:aFps}:{}) } } : {})
    };

    out[id] = item;
    kept++;
  }

  // Pretty write only if changed
  const abs = path.resolve(process.cwd(), OUT_PATH);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  const next = JSON.stringify(out, null, 2);
  let prev = '';
  try { prev = await fs.readFile(abs, 'utf8'); } catch {}
  if (prev !== next) {
    await fs.writeFile(abs, next, 'utf8');
    console.log(`[wearables] wrote ${OUT_PATH} (total=${total}, kept=${kept}, skipped=${skipped})`);
  } else {
    console.log('[wearables] no changes detected.');
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
