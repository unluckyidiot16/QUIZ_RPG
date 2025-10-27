#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

// ===== 새 저장 로직: 과목별 파일 + index.json + (레거시 단일 파일 병행) =====

// 1) PACK_ID/OUT_DIR 계산 (환경변수 없으면 OUT_PATH에서 유도)
const PACK_ID = process.env.PACK_ID
  || path.basename(String(OUT_PATH)).replace(/\.json$/,'')
  || 'sample';

const OUT_DIR = process.env.OUT_DIR
  || path.join(path.dirname(OUT_PATH), PACK_ID);

// 2) 해시 유틸
const hashJson = (obj) =>
  crypto.createHash('sha1').update(JSON.stringify(obj)).digest('hex').slice(0,8);

// 교체용: writeOutputs 전체
async function writeOutputs(out, invalids) {
  const SUBJECT_CODES = ['KOR','ENG','MATH','SCI','SOC','HIST'];

  // env → 기본값 유도
  const ENV_OUT_PATH = process.env.OUT_PATH || '';

  const OUT_PATH = ENV_OUT_PATH || `apps/student/public/packs/${PACK_ID}.json`;

  // subject 분배 (allowGEN이면 GEN 유지, strict면 skip/맵핑)
  const by = Object.fromEntries([...SUBJECT_CODES, 'GEN'].map(s => [s, []]));
  const MODE = (process.env.SUBJECT_MODE || 'strict').toLowerCase();

  for (const it of out) {
    let s = String(it.subject || '').trim().toUpperCase();
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
