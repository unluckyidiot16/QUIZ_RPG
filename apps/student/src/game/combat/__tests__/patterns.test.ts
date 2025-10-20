import { actByPattern } from '@/game/combat/patterns';
const rng0 = () => 0.99; // 크리 안나오도록
test('Aggressive strong on turn 3', () => {
  const a1 = actByPattern('Aggressive', { rng: rng0, turn: 2 });
  const a2 = actByPattern('Aggressive', { rng: rng0, turn: 3 });
  expect(a2.dmgToPlayer).toBeGreaterThan(a1.dmgToPlayer);
});
test('Shield toggles', () => {
  expect(actByPattern('Shield', { rng: rng0, turn: 2 }).shieldActive).toBeTruthy();
  expect(actByPattern('Shield', { rng: rng0, turn: 3 }).shieldActive).toBeFalsy();
});
test('Spiky retaliates on hit', () => {
  expect(actByPattern('Spiky', { rng: rng0, turn: 1 }).spikeOnHit).toBeGreaterThan(0);
});
