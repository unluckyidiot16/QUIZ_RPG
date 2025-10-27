// /game/quiz/picker.ts
import type { Subject } from '../../core/char.types';

export type Choice = { key: 'A'|'B'|'C'|'D'; text: string };
export type QuizItem = {
  id: string;
  stem: string;
  choices: Choice[];
  answerKey: Choice['key'];
  explanation?: string;
  subject?: string;           // 'KOR' | ... | 'GEN' | undefined
  difficulty?: number;        // 1..5 (optional)
  timeLimitSec?: number;      // optional
  tags?: string[];
  rev?: number;
};

export type QuestionPools = {
  bySubject: Record<Subject, QuizItem[]>;
  general: QuizItem[]; // subject가 없거나 'GEN'인 문제
};

// 시트/팩에서 읽어온 배열을 과목별 풀로 변환
export function buildQuestionPools(items: QuizItem[], SUBJECTS: readonly Subject[]): QuestionPools {
  const bySubject = Object.fromEntries(SUBJECTS.map(s => [s, [] as QuizItem[]])) as Record<Subject, QuizItem[]>;
  const general: QuizItem[] = [];

  for (const it of items || []) {
    const subj = String(it.subject || '').toUpperCase() as Subject | 'GEN' | '';
    if (subj && (SUBJECTS as readonly string[]).includes(subj)) {
      bySubject[subj as Subject].push(it);
    } else {
      // subject 없음, 또는 GEN → 일반 풀
      general.push(it);
    }
  }
  return { bySubject, general };
}

// (선택 주입) 난이도 목표 함수 타입
export type DiffSelector = (params: { level: number, subject: Subject }) => number | undefined;

// 과목별 문제 선택기
export function pickQuestionForSubject(
  subject: Subject,
  pools: QuestionPools,
  opts?: {
    level?: number;          // 현재 과목 레벨(없어도 동작)
    diffSelector?: DiffSelector; // 주입 가능
    avoidIds?: Set<string>;  // 중복 방지(선택)
    rng?: () => number;      // PRNG 주입(선택), 기본 Math.random
  }
): QuizItem | null {
  const rng = opts?.rng ?? Math.random;
  const level = Math.max(0, Math.floor(opts?.level ?? 0));

  // 1) 후보 풀: 해당 과목 + 일반 섞기
  const subjectPool = pools.bySubject[subject] ?? [];
  let candidates = subjectPool.length ? [...subjectPool, ...pools.general] : [...pools.general];

  if (!candidates.length) return null;

  // 2) 중복 회피
  if (opts?.avoidIds?.size) {
    const filtered = candidates.filter(q => !opts!.avoidIds!.has(q.id));
    if (filtered.length) candidates = filtered;
  }

  // 3) 난이도 타겟 필터(주입된 diffSelector가 있을 때만)
  const target = opts?.diffSelector?.({ level, subject });
  if (Number.isFinite(target)) {
    const t = Math.round(target!);
    const near = candidates.filter(q => Number.isFinite(q.difficulty as any) && Math.abs((q.difficulty as number) - t) <= 1);
    if (near.length) candidates = near;
  }

  // 4) 랜덤 픽
  return candidates[Math.floor(rng() * candidates.length)] || null;
}
