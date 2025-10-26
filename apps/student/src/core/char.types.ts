// 1) 값 먼저 + as const (리터럴 유지)
export const SUBJECTS = ['KOR','ENG','MATH','SCI','SOC','HIST'] as const;

// 2) 값에서 타입을 도출
export type Subject = typeof SUBJECTS[number];

// 3) 파생 타입들
export type Stats = { [S in Subject]: number };
export type SubjectLevels = { [S in Subject]: { lv: number; xp: number } };

// (옵션) 라벨/유틸
export const SUBJECT_LABEL: Record<Subject, string> = {
  KOR: '국어', ENG: '영어', MATH: '수학', SCI: '과학', SOC: '사회', HIST: '역사',
} as const;

export const isSubject = (s: string): s is Subject =>
  (SUBJECTS as readonly string[]).includes(s);

export const subjectLabel = (s: Subject) => SUBJECT_LABEL[s];

// P1-1 전용: 고정 순서 10문항(6 + 4)
export const SUBJECT_ORDER_10: Subject[] = [...SUBJECTS, ...SUBJECTS.slice(0, 4)];
