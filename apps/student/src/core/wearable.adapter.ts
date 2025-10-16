// apps/student/src/core/wearable.adapter.ts
import type { Equipped, Slot, WearableItem } from './wearable.types';
import { SLOT_Z } from './wearable.types';
import { WEARABLES } from './wearable.catalog'; // 정적 카탈로그가 있으면 사용. (시트 로더 쓰면 아래 사용법 참고)
import type { Layer } from '../shared/ui/AvatarRenderer';

// 슬롯 고정 순서 (겹침 규칙)
const ORDER: Slot[] = [
  'Body','Face','BodySuit','Pants','Shoes','Clothes',
  'Sleeves','Necklace','Bag','Scarf','Bowtie','Hair','Hat'
];

// 카탈로그에서 슬롯별 기본 아이템 자동 산출
function computeDefaults(catalog: Record<string, WearableItem>): Partial<Record<Slot,string>> {
  const defaults: Partial<Record<Slot,string>> = {};
  const items = Object.values(catalog);
  // 우선순위: id/name에 blank|basic|regular|default 가 있으면 가중치 높음
  const score = (it: WearableItem) => {
    const s = `${it.id} ${it.name}`.toLowerCase();
    if (s.includes('blank') || s.includes('basic') || s.includes('regular') || s.includes('default')) return 0;
    return 1;
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
 * equipped 상태와 카탈로그를 받아 AvatarRenderer용 layers로 변환
 * - catalog 파라미터를 생략하면 WEARABLES(정적)를 사용 (기존 코드와 호환)
 * - 시트 로딩을 쓰는 경우 loadWearablesCatalog()로 받은 객체를 catalog에 넣어 호출
 */
export function equippedToLayers(
  equipped: Equipped,
  catalog: Record<string, WearableItem> = WEARABLES
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
