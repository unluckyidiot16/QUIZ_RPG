import { mult } from '../game/combat/affinity';
test('diagonal is 1', () => expect(mult('KOR','KOR')).toBe(1));
test('ring rule', () => {
  // KOR은 뒤(=GEN)에 강함(1.5), 앞(=ENG)에 약함(0.5)
  expect(mult('KOR','GEN')).toBeGreaterThan(1);
  expect(mult('KOR','ENG')).toBeLessThan(1);
});
