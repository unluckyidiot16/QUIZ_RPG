// src/core/char.types.ts
export type Subject = 'KOR' | 'ENG' | 'MATH' | 'SCI' | 'SOC' | 'HIST';
export type Stats = Record<Subject, number>;

export const SUBJECTS: Subject[] = ['KOR','ENG','MATH','SCI','SOC','HIST'];

// 라벨/헬퍼
export const SUBJECT_LABEL: Record<Subject, string> = {
  KOR:'국어', ENG:'영어', MATH:'수학', SCI:'과학', SOC:'사회', HIST:'역사',
};
export const subjectLabel = (s: Subject) => SUBJECT_LABEL[s];

// P1-1 전용: 고정 순서 10문항(6 + 4)
export const SUBJECT_ORDER_10: Subject[] = [...SUBJECTS, ...SUBJECTS.slice(0, 4)];
