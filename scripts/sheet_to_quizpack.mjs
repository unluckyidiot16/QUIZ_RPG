#!/usr/bin/env node
// scripts/sheet_to_quizpack.mjs
// 목적: Google Sheet 1개 → 단일 JSON 1개 (과목 고정, 분할/zip 생성 없음)

import fs from 'node:fs/promises';
import path from 'node:path';

// ───────────────────── utils ─────────────────────
const SUBJECT_CODES = ['KOR','ENG','MATH','SCI','SOC','HIST'] as const;
const toUpper = (v) => String(v ?? '').trim().toUpperCase();
const asNumber = (v) => (Number.isFinite(+v) ? +v : undefined);
const asTags = (v) => (Array.isArray(v) ? v.map(String) :
  (v == null ? undefined : String(v).split(',').map(s=>s.trim()).filter(Boolean)));

function packIdToSubject(packIdRaw) {
  const u = toUpper(packIdRaw);
  // 현재 워크플로 매트릭스와 1:1 (KorPack, EngPack, MathPack, SciPack, SocPack, HistPack)
  // 필요 시 여기에만 항목 추가하세요. (이 외 추론 없음)
  const MAP = {
    KORPACK: 'KOR',
    ENGPACK: 'ENG',
    MATHPACK: 'MATH',
    SCIPACK: 'SCI',
    SOCPACK: 'SOC',
    HISTPACK: 'HIST',
  };
  return MAP[u] || '';
}

// gviz json fetch (시트가 "링크로 열람" 가능해야 함)
async function fetchSheet({ sheetId, sheetName = '' }) {
  const base = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq`;
  const params = new URLSearchParams();
  params.set('tqx', 'out:json');
  if (sheetName) params.set('sheet', sheetName);
  const url = `${base}?${params.toString()}`;

  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`fetch failed ${res.status} ${res.statusText}`);
  const txt = await res.text();
  const m = txt.match(/setResponse\(([\s\S]+)\);?/);
  if (!m) throw new Error('Unexpected gviz response');
  const json = JSON.parse(m[1]);

  const cols = (json.table?.cols ?? []).map(c => String(c.label || '').trim());
  const rows = (json.table?.rows ?? []).map(r => (r.c ?? []).map(c => c?.v ?? ''));
  return { cols, rows };
}

function rowsToObjects(cols, rows) {
  return rows.map(r => {
    const o = {};
    cols.forEach((label, i) => { o[label] = r[i]; });
    return o;
  });
}

function pickField(obj, candidates) {
  const keys = Object.keys(obj);
  for (const c of candidates) {
    const k = keys.find(k => k.toLowerCase() === c.toLowerCase());
    if (k) return { key: k, val: obj[k] };
  }
  return { key: null, val: undefined };
}

// 1행 → 표준 퀴즈 아이템 (과목은 PACK_ID로 고정 주입)
function makeNormalizer(fixedSubject /* 'KOR' | ... */) {
  return function normalizeRow(row, idx) {
    // stem
    const { val: stem } = pickField(row, ['stem','question','문제','질문']);
    if (!stem) return null;

    // choices: A/B/C/D → choice1..4 → 1..4
    const { val: A } = pickField(row, ['A','a','choiceA','선지A']);
    const { val: B } = pickField(row, ['B','b','choiceB','선지B']);
    const { val: C } = pickField(row, ['C','c','choiceC','선지C']);
    const { val: D } = pickField(row, ['D','d','choiceD','선지D']);
    const choices = [A,B,C,D].map((t,i)=> (t!=null && t!=='') ? { key: ['A','B','C','D'][i], text: String(t) } : null).filter(Boolean);
    if (choices.length < 2) return null;

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

    // 나머지 메타
    const { val: explanation } = pickField(row, ['explanation','exp','해설','풀이']);
    const { val: diff }        = pickField(row, ['difficulty','난이도']);
    const { val: tsec }        = pickField(row, ['timeLimitSec','time','제한시간']);
    const { val: tags }        = pickField(row, ['tags','태그']);

    return {
      id: String(row.id ?? row.ID ?? idx),
      stem: String(stem),
      choices,
      answerKey,
      explanation: explanation ? String(explanation) : undefined,
      subject: fixedSubject || undefined,          // ✅ 시트의 subject 칼럼은 무시하고 고정
      difficulty: asNumber(diff),
      timeLimitSec: asNumber(tsec),
      tags: asTags(tags),
    };
  }
}

// 단일 파일로만 저장
async function writeSingle(out, invalids) {
  const ENV_OUT_PATH = process.env.OUT_PATH || '';
  const PACK_ID = process.env.PACK_ID
    || (ENV_OUT_PATH ? path.basename(ENV_OUT_PATH).replace(/\.json$/,'') : 'sample');
  const OUT_PATH = ENV_OUT_PATH || `apps/student/public/packs/${PACK_ID}.json`;

  await fs.mkdir(path.dirname(OUT_PATH), { recursive: true });
  await fs.writeFile(OUT_PATH, JSON.stringify(out, null, 2), 'utf8');
  console.log(`[quizpack] wrote: ${OUT_PATH} items=${out.length} invalids=${invalids.length}`);
}

// ───────────────────── main ─────────────────────
async function main() {
  const SHEET_ID   = process.env.SHEET_ID;
  const SHEET_NAME = process.env.SHEET_NAME || '';
  if (!SHEET_ID) throw new Error('SHEET_ID env is required');

  // 과목 고정: SUBJECT_CODE가 있으면 우선, 없으면 PACK_ID에서 1:1 매핑
  const SUBJECT_CODE = toUpper(process.env.SUBJECT_CODE) || packIdToSubject(process.env.PACK_ID || '');
  if (!SUBJECT_CODES.includes(SUBJECT_CODE)) {
    throw new Error(`SUBJECT_CODE required (env SUBJECT_CODE=KOR|ENG|MATH|SCI|SOC|HIST or PACK_ID→subject 매핑 실패)`);
  }

  const { cols, rows } = await fetchSheet({ sheetId: SHEET_ID, sheetName: SHEET_NAME });
  const objs = rowsToObjects(cols, rows);

  const normalizeRow = makeNormalizer(SUBJECT_CODE);
  const out = [];
  const invalids = [];
  objs.forEach((row, i) => {
    const q = normalizeRow(row, i);
    if (q) out.push(q);
    else invalids.push({ i, row });
  });

  console.log(`[quizpack] parsed rows: ${objs.length}, valid: ${out.length}, invalid: ${invalids.length}`);
  await writeSingle(out, invalids);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(err => {
    console.error('[quizpack] failed:', err);
    process.exit(1);
  });
}
