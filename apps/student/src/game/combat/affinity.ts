// apps/student/src/core/affinity.ts
export type Subject   = 'KOR'|'ENG'|'MATH'|'SCI'|'SOC'|'HIST';
export type SkillColor = 'blank'|'blue'|'dark'|'green'|'red'|'yellow';

// 과목 → 색상(슬라임 6색)
export const SUBJECT_TO_COLOR: Record<Subject, SkillColor> = {
  // 필요시 자유롭게 바꿔도 OK
  KOR: 'red',
  ENG: 'blue',
  MATH: 'yellow',
  SCI: 'green',
  SOC: 'blank',
  HIST: 'dark',
};

// 색상 팔레트(라이트 톤): UI/레이더/배지에 사용
export const SKILL_HEX: Record<SkillColor,string> = {
  blank:  '#e5e7eb', // gray-300
  blue:   '#60a5fa', // blue-400
  dark:   '#64748b', // slate-500
  green:  '#34d399', // emerald-400
  red:    '#f87171', // rose-400
  yellow: '#fbbf24', // amber-400
};

// Tailwind 유틸 (배지/테두리 등에)
export const COLOR_CLS: Record<SkillColor,{bg:string;text:string;ring:string}> = {
  blank:  { bg:'bg-slate-800',   text:'text-slate-200',  ring:'ring-slate-400' },
  blue:   { bg:'bg-blue-900/40',  text:'text-blue-300',   ring:'ring-blue-400' },
  dark:   { bg:'bg-slate-900/60', text:'text-slate-300',  ring:'ring-slate-500' },
  green:  { bg:'bg-emerald-900/40',text:'text-emerald-300',ring:'ring-emerald-400' },
  red:    { bg:'bg-rose-900/40',  text:'text-rose-300',   ring:'ring-rose-400' },
  yellow: { bg:'bg-amber-900/40', text:'text-amber-300',  ring:'ring-amber-400' },
};

// 6각 순환 순서
export const SUBJECT_ORDER: Subject[] = ['KOR','ENG','MATH','SCI','SOC','HIST'];

// 과목 간 배수(원형 상성)
export function subjectMultiplier(att: Subject, def: Subject): number {
  const N = SUBJECT_ORDER.length; // 6
  const ai = SUBJECT_ORDER.indexOf(att);
  const di = SUBJECT_ORDER.indexOf(def);
  if (ai < 0 || di < 0) return 1.0;

  if ((ai + 1) % N === di) return 1.25; // att가 def의 다음 → 우위
  if ((di + 1) % N === ai) return 0.8;  // att가 def의 이전 → 열위
  return 1.0;                           // 나머지 → 보통
}

export const subjectToColorHex = (s: Subject) => SKILL_HEX[SUBJECT_TO_COLOR[s]];
