import { makeRng } from '@/shared/lib/rng';
test('deterministic', () => {
  const r1 = makeRng('seed'); const a = [r1.next(), r1.next(), r1.next()];
  const r2 = makeRng('seed'); const b = [r2.next(), r2.next(), r2.next()];
  expect(a).toEqual(b);
});
