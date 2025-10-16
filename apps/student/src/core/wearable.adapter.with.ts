// src/core/wearable.adapter.with.ts
import type { Equipped } from './wearable.types';
import { SLOT_Z } from './wearable.types';
import type { WearableItem } from './wearable.types';
import type { Layer } from '../shared/ui/AvatarRenderer';

export function equippedToLayersWith(equipped: Equipped, catalog: Record<string, WearableItem>): Layer[] {
  const layers: Layer[] = [];
  const order = ['Body','Face','BodySuit','Pants','Shoes','Clothes','Sleeves','Necklace','Bag','Scarf','Bowtie','Hair','Hat'] as const;
  for (const slot of order) {
    const id = (equipped as any)[slot];
    if (!id) continue;
    const item = catalog[id]; if (!item) continue;
    layers.push({
      id: item.id, src: item.src, z: SLOT_Z[slot],
      opacity: item.opacity, scale: item.scale, offset: item.offset,
      atlas: item.atlas ? { ...item.atlas, fps: item.atlas.fps ?? 6 } : undefined,
    });
  }
  return layers.sort((a,b)=>a.z-b.z);
}
