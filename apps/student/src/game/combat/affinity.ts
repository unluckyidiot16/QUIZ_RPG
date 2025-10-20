export type Elem = 'KOR'|'ENG'|'MATH'|'SCI'|'SOC'|'GEN';

// 6개 과목을 원형으로 두고 "한 칸 뒤에 강함, 한 칸 앞에 약함" 규칙(간단/직관)
export const ELEMS: Elem[] = ['KOR','ENG','MATH','SCI','SOC','GEN'];

// 강/약 배수
const STRONG = 1.5;
const WEAK   = 0.5;

// 기본 1.0으로 채우고 원형 규칙 적용
const buildMatrix = () => {
  const M: Record<Elem, Record<Elem, number>> = {} as any;
  for (const a of ELEMS) {
    M[a] = {} as any;
    for (const d of ELEMS) M[a][d] = 1.0;
  }
  // 원형: ... -> KOR -> ENG -> MATH -> SCI -> SOC -> GEN -> (다시 KOR)
  const idx = (e: Elem) => ELEMS.indexOf(e);
  for (const a of ELEMS) {
    const i = idx(a);
    const strongDef = ELEMS[(i - 1 + ELEMS.length) % ELEMS.length]; // 뒤(시계 반대)
    const weakDef   = ELEMS[(i + 1) % ELEMS.length];                // 앞(시계 방향)
    M[a][strongDef] = STRONG;
    M[a][weakDef]   = WEAK;
  }
  return M;
};

const MATRIX = buildMatrix();
export const mult = (att: Elem, def: Elem) => MATRIX[att]?.[def] ?? 1.0;

/** 쿼리 파라미터 또는 기본값으로 플레이어/적 속성 결정 */
export function resolveElemsFromQuery(qs: URLSearchParams): { player: Elem; enemy: Elem } {
  const asElem = (v?: string): Elem => (ELEMS as string[]).includes(v ?? '') ? (v as Elem) : 'GEN';
  return {
    player: asElem(qs.get('p')),
    enemy : asElem(qs.get('e')),
  };
}
