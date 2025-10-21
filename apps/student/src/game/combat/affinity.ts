// apps/student/src/game/combat/affinity.ts
export type Subject = 'KOR'|'ENG'|'MATH'|'SCI'|'SOC'|'HIST';
export type SkillColor = 'blank'|'blue'|'dark'|'green'|'red'|'yellow';

export const SUBJECT_ORDER: Subject[] = ['KOR','ENG','MATH','SCI','SOC','HIST'];

export const SUBJECT_TO_COLOR: Record<Subject, SkillColor> = {
  KOR:'blank', ENG:'blue', MATH:'dark', SCI:'green', SOC:'red', HIST:'yellow',
};
export const COLOR_TO_SUBJECT: Record<SkillColor, Subject> = {
  blank:'KOR', blue:'ENG', dark:'MATH', green:'SCI', red:'SOC', yellow:'HIST',
};

export const SKILL_HEX = {
  blank:'#e5e7eb', blue:'#60a5fa', dark:'#64748b',
  green:'#34d399', red:'#f87171', yellow:'#fbbf24',
} as const;

export const COLOR_CLS = {
  blank:{ bg:'bg-slate-800', text:'text-slate-200', ring:'ring-slate-400' },
  blue:{ bg:'bg-blue-900/40', text:'text-blue-300', ring:'ring-blue-400' },
  dark:{ bg:'bg-slate-900/60', text:'text-slate-300', ring:'ring-slate-500' },
  green:{ bg:'bg-emerald-900/40', text:'text-emerald-300', ring:'ring-emerald-400' },
  red:{ bg:'bg-rose-900/40', text:'text-rose-300', ring:'ring-rose-400' },
  yellow:{ bg:'bg-amber-900/40', text:'text-amber-300', ring:'ring-amber-400' },
} as const;

// 6각 순환 상성: att가 def의 '다음 칸'이면 강(1.25), '이전 칸'이면 약(0.8)
export function subjectMultiplier(att: Subject, def: Subject): number {
  const N = SUBJECT_ORDER.length; const ai = SUBJECT_ORDER.indexOf(att); const di = SUBJECT_ORDER.indexOf(def);
  if (ai < 0 || di < 0) return 1.0;
  if ((ai + 1) % N === di) return 1.25;
  if ((di + 1) % N === ai) return 0.8;
  return 1.0;
}
