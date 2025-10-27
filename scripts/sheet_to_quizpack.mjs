// scripts/sheet_to_quizpack.mjs
// Google Sheet (gviz JSON) → apps/student/public/packs/<pack>.json
// 열 별칭 자유: id, subject(과목), difficulty(난이도), time/timeLimit/timeLimitSec,
// stem(지문), A/B/C/D 또는 options/choices, answerKey/answer/correctIndex, explanation, tags, rev
// 사용법:
//   SHEET_ID=... SHEET_NAME="문제시트" OUT_PATH="apps/student/public/packs/sample.json" node scripts/sheet_to_quizpack.mjs
//
// 옵션(환경변수):
//   SUBJECT_MODE=strict|allowGEN   (기본 strict = 6과목으로 정규화, GEN은 매핑)
//   GEN_MAP_TO=SOC                 (strict일 때 GEN을 어느 과목으로 매핑할지)
//   DIFF_TABLE="25,20,15,12,10"    (난이도 1..5 기본 제한시간초, 미지정시 내부 기본표)

// .env.local 우선, 없으면 .env 로드
import fsSync from 'node:fs'; 
try {
  const { default: dotenv } = await import('dotenv');
  const envPath = fsSync.existsSync('.env.local') ? '.env.local' : '.env';
  dotenv.config({ path: envPath });
} catch {}

import fs from 'node:fs/promises';
import path from 'node:path';

const SHEET_ID   = process.env.SHEET_ID;
const SHEET_NAME = process.env.SHEET_NAME || '';
const OUT_PATH   = process.env.OUT_PATH || 'apps/student/public/packs/sample.json';

const SUBJECT_MODE = (process.env.SUBJECT_MODE || 'strict').toLowerCase();
const GEN_MAP_TO   = (process.env.GEN_MAP_TO || 'SOC').toUpperCase();

const DIFF_TABLE = (process.env.DIFF_TABLE || '').split(',').map(s=>Number(s.trim())).filter(n=>Number.isFinite(n));
const DIFF_TIME_DEFAULT = DIFF_TABLE.length >= 5
  ? {1:DIFF_TABLE[0],2:DIFF_TABLE[1],3:DIFF_TABLE[2],4:DIFF_TABLE[3],5:DIFF_TABLE[4]}
  : {1:25,2:20,3:15,4:12,5:10}; // 제안 기본값

if (!SHEET_ID) {
  console.error('[quizpack] SHEET_ID is required.');
  process.exit(1);
}

async function httpGet(url) {
  if (typeof fetch === 'function') return fetch(url, { cache: 'no-store' });
  const { default: nodeFetch } = await import('node-fetch');
  return nodeFetch(url);
}
function buildGvizUrl(id, sheetName=''){
  const base = `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:json`;
  return sheetName ? `${base}&sheet=${encodeURIComponent(sheetName)}` : base;
}
function parseGviz(text){
  const m = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\)\s*;?\s*$/);
  if (!m) throw new Error('gviz parse fail: unexpected response');
  return JSON.parse(m[1]);
}
function mapHeader(cols){
  const idx = {};
  cols.forEach((c, i) => { idx[(c?.label || '').trim().toLowerCase()] = i; });
  return idx;
}
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
const SUBJECTS = new Set(['KOR','ENG','MATH','SCI','SOC','HIST']);
const SUBJECT_SYNONYM = new Map([
  // 한글 별칭
  ['국어','KOR'], ['영어','ENG'], ['수학','MATH'], ['과학','SCI'], ['사회','SOC'], ['역사','HIST'],
  // 영문 소문자
  ['korean','KOR'], ['english','ENG'], ['math','MATH'], ['science','SCI'], ['social','SOC'], ['history','HIST'],
]);

function canonSubject(x){
  if (!x) return undefined;
  const s = String(x).trim();
  const u = s.toUpperCase();
  if (SUBJECTS.has(u)) return u;
  const syn = SUBJECT_SYNONYM.get(s.toLowerCase());
  if (syn) return syn;
  if (u === 'GEN') {
    return SUBJECT_MODE === 'allowGEN' ? 'GEN' : GEN_MAP_TO;
  }
  return undefined;
}
function normalizeAnswerKey(answerKey, answer, correctIndex){
  // 'A'~'D' or 숫자 인덱스(0~3)
  if (typeof answerKey === 'string' && /^[ABCD]$/i.test(answerKey)) return answerKey.toUpperCase();
  if (typeof answer === 'string' && /^[ABCD]$/i.test(answer)) return answer.toUpperCase();
  const idx = (typeof correctIndex === 'number' ? correctIndex
    : typeof answer === 'number' ? answer
      : typeof answerKey === 'number' ? answerKey
        : -1);
  if (idx >= 0 && idx <= 3) return (['A','B','C','D'])[idx];
  return null;
}
function toInt(v){ const n = Number(v); return Number.isFinite(n) ? Math.floor(n) : undefined; }
function parseTags(v){
  if (!v) return undefined;
  if (Array.isArray(v)) return v.map(String).map(s=>s.trim()).filter(Boolean);
  // 쉼표/세미콜론/파이프 구분
  return String(v).split(/[;,|]/).map(s=>s.trim()).filter(Boolean);
}

async function main(){
  const url = buildGvizUrl(SHEET_ID, SHEET_NAME);
  console.log('[quizpack] fetching sheet…', url);
  let json;
  try {
    const res = await httpGet(url);
    const txt = await res.text();
    json = parseGviz(txt);
  } catch (e) {
    console.error('[quizpack] gviz fetch failed:', e?.message || e);
    process.exit(1);
  }

  const rows = json?.table?.rows || [];
  const cols = json?.table?.cols || [];
  const H = mapHeader(cols);
  console.log(`[quizpack] rows=${rows.length}, cols=${cols.length}`);

  // 헤더 별칭
  const A_ID       = ['id','문항id','qid'];
  const A_SUBJECT  = ['subject','과목'];
  const A_DIFF     = ['difficulty','난이도','diff','level'];
  const A_TIME     = ['timelimitsec','time','timelimit','limit','제한시간','time(s)'];
  const A_STEM     = ['stem','지문','문항','문제'];
  const A_EXPL     = ['explanation','해설','해답','설명'];
  const A_TAGS     = ['tags','태그'];
  const A_REV      = ['rev','revision','ver','version'];

  // 선택지
  const A_A        = ['a','A'];
  const A_B        = ['b','B'];
  const A_C        = ['c','C'];
  const A_D        = ['d','D'];
  const A_CHOICES  = ['choices','options','선택지','보기'];
  const A_ANS      = ['answerkey','answer','정답'];
  const A_CIDX     = ['correctindex','answerindex','정답인덱스'];

  /** @type {any[]} */
  const out = [];
  const invalids = [];

  rows.forEach((r, i) => {
    const id   = String(getV(r,H,A_ID) ?? (i+1)).trim();
    const subj = canonSubject(getV(r,H,A_SUBJECT));
    const diff = toInt(getV(r,H,A_DIFF));
    const tl   = toInt(getV(r,H,A_TIME));
    const stem = String(getV(r,H,A_STEM) ?? '').trim();
    const exp  = getV(r,H,A_EXPL) != null ? String(getV(r,H,A_EXPL)) : undefined;
    const tags = parseTags(getV(r,H,A_TAGS));
    const rev  = toInt(getV(r,H,A_REV));

    // 선택지 수집: A/B/C/D → 없으면 choices/options 시도
    const choices = [];
    const pushChoice = (keyList, letter) => {
      const v = getV(r,H,keyList);
      if (v != null && v !== '') choices.push({ key: letter, text: String(v) });
    };
    pushChoice(A_A,'A'); pushChoice(A_B,'B'); pushChoice(A_C,'C'); pushChoice(A_D,'D');

    if (!choices.length) {
      const raw = getV(r,H,A_CHOICES);
      if (Array.isArray(raw)) {
        raw.slice(0,4).forEach((t,idx)=> choices.push({ key:['A','B','C','D'][idx], text: String(t?.text ?? t) }));
      } else if (typeof raw === 'string' && raw.trim()) {
        raw.split(/[|]/).slice(0,4).forEach((t,idx)=> choices.push({ key:['A','B','C','D'][idx], text: t.trim() }));
      }
    }

    const ansLetter = normalizeAnswerKey(getV(r,H,A_ANS), getV(r,H,A_ANS), getV(r,H,A_CIDX));
    if (!stem || choices.length < 2 || !ansLetter) {
      invalids.push({ row:i, id, reason:'stem/choices/answer invalid' });
      return;
    }

    /** 문제 한 건 */
    const item = {
      id,
      subject: subj,                 // undefined 가능(팩에서 미사용할 수도)
      difficulty: (diff>=1&&diff<=5) ? diff : undefined,
      timeLimitSec: (tl && tl>0) ? tl : undefined,
      stem,
      choices,
      answerKey: ansLetter,
      ...(exp   ? { explanation: exp } : {}),
      ...(tags  ? { tags } : {}),
      ...(rev!=null ? { rev } : {})
    };

    // subject strict 모드: 없는/GEN → 매핑 후 저장
    if (!item.subject) {
      // 무과목 → 그대로 저장(선택), 혹은 기본 맵핑 원하면 여기서 지정
    } else if (item.subject === 'GEN' && SUBJECT_MODE === 'strict') {
      item.subject = GEN_MAP_TO;
    }

    // timeLimitSec이 없으면 난이도 표로 기본값 부여(선택)
    if (!item.timeLimitSec && item.difficulty && DIFF_TIME_DEFAULT[item.difficulty]) {
      item.timeLimitSec = DIFF_TIME_DEFAULT[item.difficulty];
    }

    out.push(item);
  });

  if (invalids.length) {
    console.warn('[quizpack] invalid rows:', invalids.slice(0,5), `... (+${invalids.length-5} more)`);
  }

  const abs = path.resolve(process.cwd(), OUT_PATH);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, JSON.stringify(out, null, 2), 'utf8');
  console.log(`[quizpack] wrote ${OUT_PATH} items=${out.length} invalids=${invalids.length}`);
}

main().catch(err => { console.error(err); process.exit(1); });
