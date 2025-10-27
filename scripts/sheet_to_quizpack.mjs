#!/usr/bin/env node
// scripts/sheet_to_quizpack.mjs
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

// ─────────────────────────────── utils ───────────────────────────────
const SUBJECT_CODES = ['KOR','ENG','MATH','SCI','SOC','HIST'];

const hashJson = (obj) =>
  crypto.createHash('sha1').update(JSON.stringify(obj)).digest('hex').slice(0, 8);

const toUpper = (v) => String(v ?? '').trim().toUpperCase();
const asNumber = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};
const asTags = (v) => {
  if (!v) return undefined;
  if (Array.isArray(v)) return v.map(String);
  // "a,b,c" → ["a","b","c"]
  return String(v).split(',').map(s => s.trim()).filter(Boolean);
};

// gviz json fetch (공개 보기 권한 필요)
async function fetchSheet({ sheetId, sheetName = '' }) {
  const base = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq`;
  const params = new URLSearchParams();
  params.set('tqx', 'out:json');
  if (sheetName) params.set('sheet', sheetName);
  const url = `${base}?${params.toString()}`;

  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`fetch failed ${res.status} ${res.statusText}`);
  }
  const txt = await res.text();
  // 응답은 google.visualization.Query.setResponse({...});
  const m = txt.match(/setResponse\(([\s\S]+)\);?/);
  if (!m) throw new Error('Unexpected gviz response');
  const json = JSON.parse(m[1]);

  const cols = (json.table?.cols ?? []).map(c => String(c.label || '').trim());
  const rows = (json.table?.rows ?? []).map(r => (r.c ?? []).map(c => c?.v ?? ''));
  return { cols, rows };
}

// 첫 행 헤더를 이용해 객체 배열로 변환
function rowsToObjects(cols, rows) {
  return rows.map(r => {
    const obj = {};
    cols.forEach((label, i) => {
      obj[label] = r[i];
    });
    return obj;
  });
}

// 헤더 이름 동의어 매핑(대소문자 무시)
function pickField(obj, candidates) {
  const keys = Object.keys(obj);
  for (const c of candidates) {
    const k = keys.find(k => k.toLowerCase() === c.toLowerCase());
    if (k) return { key: k, val: obj[k] };
  }
  return { key: null, val: undefined };
}

// 1행을 표준 퀴즈 아이템으로 정규화
function normalizeRow(row, idx) {
  // stem
  const { val: stem } = pickField(row, ['stem','question','문제','질문']);
  if (!stem) return null;

  // choices
  // 우선순위: A/B/C/D -> choice1..4 -> 1..4
  const { val: A } = pickField(row, ['A','a','choiceA','선지A']);
  const { val: B } = pickField(row, ['B','b','choiceB','선지B']);
  const { val: C } = pickField(row, ['C','c','choiceC','선지C']);
  const { val: D } = pickField(row, ['D','d','choiceD','선지D']);
  const choices = [A,B,C,D].map((t, i) => t != null && t !== '' ? { key: ['A','B','C','D'][i], text: String(t) } : null).filter(Boolean);

  // answerKey
  let { val: ans } = pickField(row, ['answerKey','answer','정답','correct']);
  let { val: ansIdx } = pickField(row, ['correctIndex','정답번호']);
  let answerKey = null;
  const s = String(ans ?? '').trim().toUpperCase();
  if (/^[ABCD]$/.test(s)) answerKey = s;
  else {
    const n = asNumber(ansIdx ?? ans);
    if (n != null && n >= 0 && n <= 3) answerKey = ['A','B','C','D'][n];
    if (n != null && n >= 1 && n <= 4) answerKey = ['A','B','C','D'][n-1];
  }
  if (!answerKey) return null;

  // explanation / subject / diff / time / tags
  const { val: explanation } = pickField(row, ['explanation','exp','해설','풀이']);
  const { val: subj }        = pickField(row, ['subject','과목']);
  const { val: diff }        = pickField(row, ['difficulty','난이도']);
  const { val: tsec }        = pickField(row, ['timeLimitSec','time','제한시간']);
  const { val: tags }        = pickField(row, ['tags','태그']);

  const subjU = toUpper(subj);
  const subject =
    SUBJECT_CODES.includes(subjU) ? subjU :
      (['GEN','GENERAL','COMMON','ALL'].includes(subjU) ? 'GEN' : undefined);

  return {
    id: String(row.id ?? row.ID ?? idx),
    stem: String(stem),
    choices,
    answerKey,
    explanation: explanation ? String(explanation) : undefined,
    subject,
    difficulty: asNumber(diff),
    timeLimitSec: asNumber(tsec),
    tags: asTags(tags),
  };
}

// 파일 쓰기 (과목별 분할 + index.json + 레거시 단일 JSON)
async function writeOutputs(out, invalids) {
  const ENV_OUT_PATH = process.env.OUT_PATH || '';
  const PACK_ID = process.env.PACK_ID
    || (ENV_OUT_PATH ? path.basename(ENV_OUT_PATH).replace(/\.json$/,'') : 'sample');
  const OUT_DIR = process.env.OUT_DIR
    || (ENV_OUT_PATH ? path.join(path.dirname(ENV_OUT_PATH), PACK_ID) : `apps/student/public/packs/${PACK_ID}`);
  const OUT_PATH = ENV_OUT_PATH || `apps/student/public/packs/${PACK_ID}.json`;

  // subject 분배 (allowGEN이면 GEN 유지, strict면 skip/맵핑)
  const by = Object.fromEntries([...SUBJECT_CODES, 'GEN'].map(s => [s, []]));
  const MODE = (process.env.SUBJECT_MODE || 'strict').toLowerCase();

  for (const it of out) {
    let s = toUpper(it.subject);
    if (!SUBJECT_CODES.includes(s)) {
      if (s === 'GEN' || MODE === 'allowgen') s = 'GEN';
      else continue; // strict에서 무과목은 제외(또는 상단 변환에서 이미 맵핑)
    }
    by[s].push(it);
  }

  await fs.mkdir(OUT_DIR, { recursive: true });

  const subjectsMap = {};
  const counts = {};
  for (const code of SUBJECT_CODES) {
    const arr = by[code];
    counts[code] = arr.length;
    const fname = `${code}.${hashJson(arr)}.json`;
    subjectsMap[code] = fname;
    await fs.writeFile(path.join(OUT_DIR, fname), JSON.stringify(arr, null, 2), 'utf8');
  }

  let genFile = '';
  if (by.GEN.length) {
    genFile = `GEN.${hashJson(by.GEN)}.json`;
    counts.GEN = by.GEN.length;
    await fs.writeFile(path.join(OUT_DIR, genFile), JSON.stringify(by.GEN, null, 2), 'utf8');
  }

  const indexJson = {
    packId: PACK_ID,
    version: 1,
    subjects: subjectsMap,
    general: genFile || undefined,
    counts
  };
  await fs.writeFile(path.join(OUT_DIR, 'index.json'), JSON.stringify(indexJson, null, 2), 'utf8');
  console.log(`[quizpack] wrote split pack: ${OUT_DIR}`);

  // 레거시 단일 파일(구 클라이언트 호환)
  const abs = path.resolve(process.cwd(), OUT_PATH);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, JSON.stringify(out, null, 2), 'utf8');
  console.log(`[quizpack] wrote legacy single file: ${OUT_PATH} items=${out.length} invalids=${invalids.length}`);
}

// ─────────────────────────────── main ───────────────────────────────
async function main() {
  const SHEET_ID = process.env.SHEET_ID;
  const SHEET_NAME = process.env.SHEET_NAME || '';

  if (!SHEET_ID) {
    throw new Error('SHEET_ID env is required');
  }

  const { cols, rows } = await fetchSheet({ sheetId: SHEET_ID, sheetName: SHEET_NAME });
  const objs = rowsToObjects(cols, rows);

  const out = [];
  const invalids = [];
  objs.forEach((row, i) => {
    const q = normalizeRow(row, i);
    if (q && q.stem && Array.isArray(q.choices) && q.choices.length >= 2) out.push(q);
    else invalids.push({ i, row });
  });

  console.log(`[quizpack] parsed rows: ${objs.length}, valid: ${out.length}, invalid: ${invalids.length}`);
  await writeOutputs(out, invalids);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(err => {
    console.error('[quizpack] failed:', err);
    process.exit(1);
  });
}
