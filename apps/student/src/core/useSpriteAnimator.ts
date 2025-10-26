// apps/student/src/game/combat/useSpriteAnimator.ts
import { useEffect, useMemo, useRef, useState } from 'react';
import { enemyFrameUrl, stateFrameCount, type EnemyState } from './sprites';
import type { EnemySprite } from './enemy';

export function useSpriteAnimator(
  sprite: EnemySprite,
  state: EnemyState,
  fps: number = 6,
  loop: boolean = true
) {
  const [idx, setIdx] = useState(1);
  const max = useMemo(() => Math.max(1, stateFrameCount(sprite, state)), [sprite, state]);

  useEffect(() => { setIdx(1); }, [sprite, state]); // 상태 바뀌면 처음부터

  useEffect(() => {
    if (max <= 1) return; // 한 프레임이면 정지
    let raf = 0; let last = performance.now();
    const step = 1000 / Math.max(1, fps);
    const tick = (t: number) => {
      if (t - last >= step) {
        setIdx(prev => {
          const next = prev + 1;
          if (next > max) return loop ? 1 : max;
          return next;
        });
        last = t;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [max, fps, loop]);

  const url = enemyFrameUrl(sprite, state, idx);
  return { frameUrl: url, frame: idx, frameMax: max };
}
