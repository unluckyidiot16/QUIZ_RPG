import { xpForLevel, levelFromXp } from '../../core/player'

test('xp curve monotonic', ()=>{
  expect(xpForLevel(1)).toBeGreaterThan(0)
  expect(xpForLevel(5)).toBeGreaterThan(xpForLevel(4))
})

test('cumulative xp → exact level', ()=>{
  let total = 0
  for (let lv=1; lv<=10; lv++){
    total += xpForLevel(lv)
    const cur = levelFromXp(total)
    expect(cur.level).toBe(lv+1)
    expect(cur.curXp).toBe(0)
  }
})
