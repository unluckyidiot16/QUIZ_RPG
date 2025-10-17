import { LocalInventoryGateway } from './inventory.local';
import { loadWearablesCatalog } from './wearable.catalog';
import type { Slot, WearableItem } from './wearable.types';

const SLOTS: Slot[] = [
  'Body','Face','BodySuit','Pants','Shoes','Clothes',
  'Sleeves','Necklace','Bag','Scarf','Bowtie','Hair','Hat'
];

function pickDefaultId(slot: Slot, cat: Record<string, WearableItem>): string | undefined {
  const items = Object.values(cat).filter(i => i.slot === slot);
  const score = (it: WearableItem) => {
    const s = `${it.id} ${it.name}`.toLowerCase();
    return (s.includes('blank') || s.includes('basic') || s.includes('regular') || s.includes('default')) ? 0 : 1;
  };
  return items.sort((a,b)=>score(a)-score(b))[0]?.id;
}

/** 첫 실행 1회만 기본 장착/소유를 시드 */
export async function bootstrapFirstRun() {
  const inv = new LocalInventoryGateway();
  const s = await inv.load();
  if (s && Object.keys(s.equipped ?? {}).length > 0) return; // 이미 시드됨

  const cat = await loadWearablesCatalog(); // wearables.v1.json 또는 sheet
  const nextEquip: Record<string,string> = {};
  const own: string[] = [];

  for (const slot of SLOTS) {
    const id = pickDefaultId(slot, cat as any);
    if (id) { nextEquip[slot] = id; own.push(id); }
  }

  if (Object.keys(nextEquip).length === 0) return;
  await inv.apply({ equip: nextEquip, cosmeticsAdd: own, reason: 'seed:first-run' });
}
