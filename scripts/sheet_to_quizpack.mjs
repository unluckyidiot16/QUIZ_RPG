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

// 3) 과목 분배
const SUBJECT_CODES = ['KOR','ENG','MATH','SCI','SOC','HIST'];
const by = Object.fromEntries([...SUBJECT_CODES, 'GEN'].map(s => [s, []]));

// out 배열은 스크립트 위쪽에서 이미 만들어져 있음
for (const it of out) {
  let s = String(it.subject || '').trim().toUpperCase();
  if (!SUBJECT_CODES.includes(s)) {
    // allowGEN이면 미분류/GEN을 GEN으로, strict면 제외(이미 위에서 GEN→맵핑 수행)
    if ((process.env.SUBJECT_MODE || 'strict').toLowerCase() === 'allowgen') {
      s = 'GEN';
    } else {
      continue; // strict 모드에서 무과목은 건너뜀
    }
  }
  by[s].push(it);
}

// 4) 출력 폴더 생성
await fs.mkdir(OUT_DIR, { recursive: true });

// 5) 과목별 파일 작성
const subjectsMap = {};
const counts = {};
for (const code of SUBJECT_CODES) {
  const arr = by[code];
  counts[code] = arr.length;
  const fname = `${code}.${hashJson(arr)}.json`;
  subjectsMap[code] = fname;
  await fs.writeFile(path.join(OUT_DIR, fname), JSON.stringify(arr, null, 2), 'utf8');
}

// 6) GEN(일반) 파일(있을 때만)
let genFile = '';
if (by.GEN.length) {
  genFile = `GEN.${hashJson(by.GEN)}.json`;
  counts.GEN = by.GEN.length;
  await fs.writeFile(path.join(OUT_DIR, genFile), JSON.stringify(by.GEN, null, 2), 'utf8');
}

// 7) index.json 작성
const indexJson = {
  packId: PACK_ID,
  version: 1,
  subjects: subjectsMap,   // { KOR: "KOR.<hash>.json", ... }
  general: genFile || undefined,
  counts
};
await fs.writeFile(path.join(OUT_DIR, 'index.json'), JSON.stringify(indexJson, null, 2), 'utf8');
console.log(`[quizpack] wrote split pack: ${OUT_DIR}`);

// 8) (선택) 레거시 단일 파일도 병행 저장 → 클라이언트 수정 없이 즉시 사용 가능
const abs = path.resolve(process.cwd(), OUT_PATH);
await fs.mkdir(path.dirname(abs), { recursive: true });
await fs.writeFile(abs, JSON.stringify(out, null, 2), 'utf8');
console.log(`[quizpack] wrote legacy single file: ${OUT_PATH} items=${out.length} invalids=${invalids.length}`);

