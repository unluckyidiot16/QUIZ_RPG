// apps/student/src/core/wearable.adapter.ts
// Catalog-agnostic adapter: accepts WearableCatalog | ItemCatalog | Record<string, any>
// and renders Avatar layers using only cosmetic items.

import type {
  Equipped,
  Slot,
  WearableItem,
  WearableCatalog,
  ItemCatalog,
} from './wearable.types';
import { SLOT_Z, cosmeticsOnly } from './wearable.types';
import type { Layer } from '../shared/ui/AvatarRenderer';
// (optional fallback if a static catalog exists; safe even if not exported)
import * as Cat from './wearable.catalog';

// 고정 슬롯 순서 (겹침 규칙)
const ORDER: Slot[] = [
  'Body','Face','BodySuit','Pants','Shoes','Clothes',
  'Sleeves','Necklace','Bag','Scarf','Bowtie','Hair','Hat','Weapon'
];

// 주어진 카탈로그를 코스메틱 전용으로 정규화
function normalizeCatalog(
  catalogAny?: WearableCatalog | ItemCatalog | Record<string, unknown>
): WearableCatalog {
  const fromArg = catalogAny ? cosmeticsOnly(catalogAny as any) : undefined;
  if (fromArg && Object.keys(fromArg).length) return fromArg;

  // (폴백) wearable.catalog.ts 가 WEARABLES 를 내보내는 경우만 사용
  const maybeStatic = (Cat as any)?.WEARABLES;
  if (maybeStatic) {
    const filtered = cosmeticsOnly(maybeStatic);
    if (Object.keys(filtered).length) return filtered;
  }
  return {};
}

// 슬롯별 기본 아이템 자동 산출
function computeDefaults(catalog: WearableCatalog): Partial<Record<Slot,string>> {
  const defaults: Partial<Record<Slot,string>> = {};
  const items = Object.values(catalog);

  const score = (it: WearableItem) => {
    const s = `${it.id} ${it.name}`.toLowerCase();
    // 'blank/basic/regular/default' 를 기본 후보로 우선
    if (s.includes('blank') || s.includes('basic') || s.includes('regular') || s.includes('default')) return 0;
    return 1;
  };

  for (const it of items) {
    const slot = it.slot as Slot;
    const curId = defaults[slot];
    if (!curId) { defaults[slot] = it.id; continue; }
    const cur = catalog[curId];
    if (cur && score(it) < score(cur)) defaults[slot] = it.id;
  }
  return defaults;
}

/**
 * equippedToLayers
 * - equipped: 현재 장착 상태 (id 매핑)
 * - catalogAny: WearableCatalog | ItemCatalog | Record<string,unknown>
 *   전달 시 AnyItem 카탈로그여도 코스메틱만 추출하여 사용
 * - 반환: AvatarRenderer용 layers
 */
export function equippedToLayers(
  equipped: Equipped,
  catalogAny?: WearableCatalog | ItemCatalog | Record<string, unknown>
): Layer[] {
  const catalog = normalizeCatalog(catalogAny);
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
