// src/core/wearable.adapter.ts
import type { Equipped } from './wearable.types';
import { SLOT_Z } from './wearable.types';
import { WEARABLES, DEFAULT_BY_SLOT } from './wearable.catalog';
import type { Layer } from '../shared/ui/AvatarRenderer';

export function equippedToLayers(equipped: Equipped): Layer[] {
  // 12개 슬롯 순서대로 살피면서, 착용 아이템 → 레이어로 변환
  const layers: Layer[] = [];
  (Object.keys(SLOT_Z) as (keyof typeof SLOT_Z)[]).forEach((slot) => {
    const itemId = equipped[slot] || DEFAULT_BY_SLOT[slot];
    if (!itemId) return;
    const item = WEARABLES[itemId];
    if (!item) return;
    layers.push({
      id: item.id,
      src: item.src,
      z: SLOT_Z[slot],
      opacity: item.opacity,
      scale: item.scale,
      offset: item.offset,
      atlas: item.atlas ? {
        cols: item.atlas.cols, rows: item.atlas.rows,
        frames: item.atlas.frames, fps: item.atlas.fps ?? 6
      } : undefined,
    });
  });
  // z값 기준 정렬(안전)
  layers.sort((a, b) => a.z - b.z);
  return layers;
}
