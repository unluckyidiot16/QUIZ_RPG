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

// 추가: 별칭 테이블(필요 시 확장)
const SUBJECT_SYNONYM: Record<string, Subject> = {
  '국어': 'KOR', 'korean': 'KOR',
  '영어': 'ENG', 'english': 'ENG',
  '수학': 'MATH', 'math': 'MATH',
  '과학': 'SCI', 'science': 'SCI',
  '사회': 'SOC', 'social': 'SOC',
  '역사': 'HIST', 'history': 'HIST',
};

function canonSubject(x: unknown, SUBJECTS_LIST: readonly Subject[]): Subject | 'GEN' | '' {
  if (x == null) return '';
  const s = String(x).trim();
  const u = s.toUpperCase();

  // 정식 코드 매칭
  if ((SUBJECTS_LIST as readonly string[]).includes(u)) return u as Subject;

  // 별칭 매핑
  const syn = SUBJECT_SYNONYM[s.toLowerCase()];
  if (syn) return syn;

  // 공통/일반
  if (u === 'GEN' || u === 'GENERAL' || u === 'COMMON' || u === 'ALL') return 'GEN';
  return '';
}

export function buildQuestionPools(items: QuizItem[], SUBJECTS: readonly Subject[]): QuestionPools {
  const bySubject = Object.fromEntries(SUBJECTS.map(s => [s, [] as QuizItem[]])) as Record<Subject, QuizItem[]>;
  const general: QuizItem[] = [];

  for (const it of items || []) {
    const m = canonSubject(it.subject, SUBJECTS);
    if (m && m !== 'GEN' && (SUBJECTS as readonly string[]).includes(m)) {
      bySubject[m as Subject].push(it);
    } else {
      general.push(it); // 없음/GEN/미매칭 → general
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
  opts?: { level?: number; diffSelector?: DiffSelector; avoidIds?: Set<string>; rng?: () => number }
): QuizItem | null {
  const rng = opts?.rng ?? Math.random;

  // 1) 후보 풀 결합
  const subjectPool = pools.bySubject[subject] ?? [];
  let candidates = subjectPool.length ? [...subjectPool, ...pools.general] : [...pools.general];
  if (!candidates.length) return null;

  // 2) 중복 회피
  if (opts?.avoidIds?.size) {
    const filtered = candidates.filter(q => !opts!.avoidIds!.has(q.id));
    if (filtered.length) candidates = filtered;
  }

  // 3) 난이도 타깃(있을 때만)
  const level = Math.max(0, Math.floor(opts?.level ?? 0));
  const target = opts?.diffSelector?.({ level, subject });
  if (Number.isFinite(target)) {
    const t = Math.round(target!);
    const near = candidates.filter(q => Number.isFinite(q.difficulty as any) && Math.abs((q.difficulty as number) - t) <= 1);
    if (near.length) candidates = near;
  }

  // 4) 살짝 셔플(편향 감소)
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  // 5) 최종 픽
  return candidates[Math.floor(rng() * candidates.length)] || null;
}

