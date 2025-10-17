// scripts/sheet_to_wearables.mjs
// Google Sheet (gviz JSON) → apps/student/public/packs/wearables.v1.json
// 컬럼(한/영) 자유: id, name(이름), slot(슬롯), path/src/image/url/thumbnail/file(이미지/경로),
// rarity(희귀도/등급), opacity, scale, offsetX(오프셋X), offsetY(오프셋Y),
// atlasCols/Rows/Frames/Fps, active(활성/사용/enabled)

import fs from 'node:fs/promises';
import path from 'node:path';

// ──────────────────────────────────────────────────────────────
// 환경 변수
// ──────────────────────────────────────────────────────────────
const SHEET_ID    = process.env.SHEET_ID;  // 필수
const SHEET_NAME  = process.env.SHEET_NAME || '';   // 있으면 지정
const ASSETS_ROOT = (process.env.ASSETS_ROOT || 'https://unluckyidiot16.github.io/assets-common/QuizRpg/')
  .replace(/\/+$/,'') + '/';
const OUT_PATH    = process.env.OUT_PATH || 'apps/student/public/packs/wearables.v1.json';
const FORCE       = String(process.env.FORCE || 'false').toLowerCase() === 'true';

if (!SHEET_ID) {
  console.error('[wearables] SHEET_ID is required.');
  process.exit(1);
}

// ──────────────────────────────────────────────────────────────
// Node 16 호환 fetch
// ──────────────────────────────────────────────────────────────
async function httpGet(url) {
  if (typeof fetch === 'function') return fetch(url, { cache: 'no-store' });
  const { default: nodeFetch } = await import('node-fetch');
  return nodeFetch(url);
}

// ──────────────────────────────────────────────────────────────
const ALLOWED_SLOTS = new Set([
  'Body','Face','BodySuit','Pants','Shoes','Clothes','Sleeves',
  'Necklace','Bag','Scarf','Bowtie','Hair','Hat'
]);

const SLOT_SYNONYM = new Map([
  ['shirt','Clothes'], ['shirts','Clothes'], ['dress','Clothes'], ['clothes','Clothes'],
  ['scaf','Scarf'], ['scarf','Scarf'],
  ['hair','Hair'], ['hat','Hat'], ['bow','Hat'],
  ['bag','Bag'], ['bowtie','Bowtie'], ['necklace','Necklace'],
  ['pants','Pants'], ['shoes','Shoes'],
  ['bodysuit','BodySuit'], ['sleeve','Sleeves'], ['sleeves','Sleeves'],
  ['body','Body'], ['face','Face'],
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

const RSET = new Set(['common','uncommon','rare','epic','legendary','mythic']);
const RMAP = new Map([
  ['n','common'], ['common','common'],
  ['r','rare'],   ['rare','rare'],
  ['sr','epic'],  ['epic','epic'],
  ['ssr','legendary'], ['legendary','legendary'],
  ['mythic','mythic'],
]);
const normRarity = v => {
  const s = String(v ?? '').trim().toLowerCase();
  return RMAP.get(s) || (RSET.has(s) ? s : undefined);
};

const joinUrl = (...p) => p.join('/').replace(/([^:])\/{2,}/g, '$1/');

function buildGvizUrl(id, sheetName=''){
  const base = `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:json`;
  return sheetName ? `${base}&sheet=${encodeURIComponent(sheetName)}` : base;
}

function parseGviz(text){
  const m = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\)\s*;?\s*$/);
  if (!m) throw new Error('gviz parse fail: unexpected response');
  return JSON.parse(m[1]);
}

function toNum(v){ const n = Number(v); return Number.isFinite(n) ? n : undefined; }
function toMaybeBool(v){
  if (typeof v === 'boolean') return v;
  if (v == null) return undefined;
  const s = String(v).trim().toLowerCase();
  if (['y','yes','true','1','on','사용','활성','enable','enabled'].includes(s)) return true;
  if (['n','no','false','0','off','미사용','비활성','disable','disabled'].includes(s)) return false;
  return undefined;
}

// 헤더 인덱스 맵핑(소문자)
function mapHeader(cols){
  const idx = {};
  cols.forEach((c, i) => { idx[(c?.label || '').trim().toLowerCase()] = i; });
  return idx;
}

// 다국어/별칭 지원 get(row, aliases[])
function getV(row, headerIdx, aliases){
  for (const key of aliases) {
    const k = String(key).toLowerCase();
    const i = headerIdx[k];
    if (i == null) continue;
    const val = row?.c?.[i]?.v;
    if (val != null && val !== '') return val;
  }
  return undefined;
}

async function main(){
  const url = buildGvizUrl(SHEET_ID, SHEET_NAME);
  console.log('[wearables] fetching sheet…', url);
  let json;
  try {
    const res = await httpGet(url);
    const txt = await res.text();
    json = parseGviz(txt);
  } catch (e) {
    console.error('[wearables] gviz fetch failed:', e?.message || e);
    if (!FORCE) process.exit(0);
    throw e;
  }

  const rows = json?.table?.rows || [];
  const cols = json?.table?.cols || [];
  const headerIdx = mapHeader(cols);
  console.log(`[wearables] rows=${rows.length}, cols=${cols.length}`);

  // 컬럼 별칭 세트
  const A_ID       = ['id','아이디'];
  const A_NAME     = ['name','이름','ko','kr'];
  const A_SLOT     = ['slot','슬롯','분류','카테고리','slotname'];
  const A_RARITY   = ['rarity','희귀도','등급','tier','grade'];
  const A_ACTIVE   = ['active','활성','활성화','사용','사용여부','enabled','enable'];

  const A_PATHLIKE = [
    'path','src','image','img','url','thumbnail','thumb','file','이미지','이미지경로','경로'
  ];
  const A_IMAGES   = ['images','assets','sprites','frames'];

  const A_OPACITY  = ['opacity','투명도'];
  const A_SCALE    = ['scale','스케일','배율'];
  const A_OFFX     = ['offsetx','offx','x','좌표x','오프셋x'];
  const A_OFFY     = ['offsety','offy','y','좌표y','오프셋y'];

  const A_ACOLS    = ['atlascols','acol','acols','atlas_cols','atlas columns'];
  const A_AROWS    = ['atlasrows','arow','arows','atlas_rows','atlas rows'];
  const A_AFRAMES  = ['atlasframes','afr','aframes','atlas_frames'];
  const A_AFPS     = ['atlasfps','afps','atlas_fps'];

  /** @type {Record<string, any>} */
  const out = {};
  let total = 0, kept = 0, skipped = 0, actives = 0;

  for (const r of rows) {
    total++;
    const activeRaw = getV(r, headerIdx, A_ACTIVE);
    const active = toMaybeBool(activeRaw); // ← 값을 보존(스킵하지 않음)
    if (active === true) actives++;

    const id   = String(getV(r, headerIdx, A_ID) ?? '').trim();
    const name = String((getV(r, headerIdx, A_NAME) ?? id) || '').trim();

    // 슬롯 정규화/추론
    const slot = canonSlot(getV(r, headerIdx, A_SLOT), id);

    // 경로 후보 (단일 컬럼 + 배열형 첫 값)
    const candidates = [];
    for (const key of A_PATHLIKE) {
      const v = getV(r, headerIdx, [key]);
      if (v != null) candidates.push(v);
    }
    for (const key of A_IMAGES) {
      const vv = getV(r, headerIdx, [key]);
      if (Array.isArray(vv) && vv.length) candidates.push(vv[0]);
      else if (typeof vv === 'string' && vv) {
        const first = vv.split(/[|,]/).map(s => s.trim()).filter(Boolean)[0];
        if (first) candidates.push(first);
      }
    }

    let pth = '';
    for (const v of candidates) {
      const s = String(v ?? '').trim();
      if (s) { pth = s; break; }
    }

    // 유효성(필수 3종) 체크
    if (!id)  { console.warn('[wearables] skip: missing id'); skipped++; continue; }
    if (!slot){ console.warn(`[wearables] skip: missing/invalid slot @${id}`); skipped++; continue; }
    if (!pth) { console.warn(`[wearables] skip: missing path/src @${id}`); skipped++; continue; }

    // 절대/상대 경로 정리 → src 생성
    const isAbs = /^https?:\/\//i.test(pth);
    const cleaned = String(pth).replace(/^\.?\/*/, '');
    const src = isAbs ? pth : joinUrl(ASSETS_ROOT, cleaned);

    const opacity = toNum(getV(r, headerIdx, A_OPACITY));
    const scale   = toNum(getV(r, headerIdx, A_SCALE));
    const ox      = toNum(getV(r, headerIdx, A_OFFX));
    const oy      = toNum(getV(r, headerIdx, A_OFFY));
    const aCols   = toNum(getV(r, headerIdx, A_ACOLS));
    const aRows   = toNum(getV(r, headerIdx, A_AROWS));
    const aFrames = toNum(getV(r, headerIdx, A_AFRAMES));
    const aFps    = toNum(getV(r, headerIdx, A_AFPS));
    const rarity  = normRarity(getV(r, headerIdx, A_RARITY));

    const item = {
      id, name, slot, src,
      ...(rarity ? { rarity } : {}),
      ...(opacity != null ? { opacity } : {}),
      ...(scale   != null ? { scale }   : {}),
      ...((ox != null || oy != null) ? { offset: { x: ox || 0, y: oy || 0 } } : {}),
      ...((aCols && aRows && aFrames) ? { atlas: { cols: aCols, rows: aRows, frames: aFrames, ...(aFps?{fps:aFps}:{}) } } : {}),
      ...(active !== undefined ? { active } : {}) // ← active를 JSON에 반영(스킵 X)
    };

    out[id] = item;
    kept++;
  }

  // 파일 쓰기 (변경시에만)
  const abs = path.resolve(process.cwd(), OUT_PATH);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  const next = JSON.stringify(out, null, 2);
  let prev = '';
  try { prev = await fs.readFile(abs, 'utf8'); } catch {}
  if (prev !== next) {
    await fs.writeFile(abs, next, 'utf8');
    console.log(`[wearables] wrote ${OUT_PATH} (total=${total}, kept=${kept}, skipped=${skipped}, active=true:${actives})`);
  } else {
    console.log('[wearables] no changes detected.', `(total=${total}, kept=${kept}, skipped=${skipped}, active=true:${actives})`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
