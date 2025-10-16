// apps/student/src/core/wearable.adapter.ts
import type { Equipped, Slot, WearableItem } from './wearable.types';
import { SLOT_Z } from './wearable.types';
// ❗️named import 제거 → namespace import (없어도 안전)
import * as Cat from './wearable.catalog';
import type { Layer } from '../shared/ui/AvatarRenderer';

// 슬롯 고정 순서
const ORDER: Slot[] = [
  'Body','Face','BodySuit','Pants','Shoes','Clothes',
  'Sleeves','Necklace','Bag','Scarf','Bowtie','Hair','Hat'
];

// 카탈로그 기본값 (catalog가 내보내지 않으면 빈 객체)
const DEFAULT_CATALOG: Record<string, WearableItem> =
  (((Cat as any).WEARABLES as Record<string, WearableItem>) || {});

// 슬롯별 기본 아이템 자동 산출
function computeDefaults(catalog: Record<string, WearableItem>): Partial<Record<Slot,string>> {
  const defaults: Partial<Record<Slot,string>> = {};
  const items = Object.values(catalog);
  const score = (it: WearableItem) => {
    const s = `${it.id} ${it.name}`.toLowerCase();
    return (s.includes('blank') || s.includes('basic') || s.includes('regular') || s.includes('default')) ? 0 : 1;
  };
  for (const it of items) {
    const slot = it.slot as Slot;
    const curId = defaults[slot];
    if (!curId) { defaults[slot] = it.id; continue; }
    const cur = catalog[curId];
    if (score(it) < score(cur)) defaults[slot] = it.id;
  }
  return defaults;
}

/**
 * Wardrobe의 equipped 상태를 AvatarRenderer layers로 변환
 * - catalog 주입: 시트 로딩을 쓰면 loadWearablesCatalog() 결과를 넘겨주세요.
 * - catalog 생략 시: 정적 카탈로그(내보냈다면 사용), 없으면 빈 객체.
 */
export function equippedToLayers(
  equipped: Equipped,
  catalog: Record<string, WearableItem> = DEFAULT_CATALOG
): Layer[] {
  const defaults = computeDefaults(catalog);
  const layers: Layer[] = [];

  for (const slot of ORDER) {
    const itemId = (equipped as any)?.[slot] ?? defaults[slot];
    if (!itemId) continue;
    const item = catalog[itemId];
    if (!item) continue;

    layers.push({
      id: item.id,
      src: item.src,
      z: SLOT_Z[slot],
      opacity: item.opacity,
      scale: item.scale,
      offset: item.offset,
      atlas: item.atlas
        ? { cols: item.atlas.cols, rows: item.atlas.rows, frames: item.atlas.frames, fps: item.atlas.fps ?? 6 }
        : undefined,
    });
  }

  layers.sort((a,b)=>a.z-b.z);
  return layers;
}
