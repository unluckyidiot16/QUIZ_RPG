// src/core/bootstrap.ts
import { loadWearablesCatalog } from './wearable.catalog';
import type { WearableItem, Slot } from './wearable.types';
import { makeServices } from './service.locator';
import { notifyInventoryChanged } from './inv.bus';

// 슬롯 우선순위(아래일수록 위에 그림)
const SLOTS: Slot[] = [
  'Body','Face','BodySuit','Pants','Shoes','Clothes','Sleeves',
  'Bag','Necklace','Scarf','Bowtie','Hair','Hat'
];

// 소문자 보조
const toL = (s?: string) => (s ?? '').toLowerCase();

// 이미지 src 추출(스키마 다양성 대응)
function pickSrc(it?: any): string | undefined {
  const v =
    it?.src ?? it?.image ?? it?.img ?? it?.renderSrc ?? it?.render ??
    it?.thumbnail ?? it?.thumb ??
    (Array.isArray(it?.images) ? it.images[0] : undefined) ??
    (Array.isArray(it?.assets) ? it.assets[0] : undefined) ??
    (typeof it?.file === 'string' ? it.file : undefined) ??
    (typeof it?.url  === 'string' ? it.url  : undefined);
  return typeof v === 'string' ? v : undefined;
}

// 기본(Null/Blank/Regular/Default) 휴리스틱
function pickDefaultId(slot: Slot, catalog: Record<string, WearableItem>): string | undefined {
  const items = Object.values(catalog).filter(i => i.slot === slot);

  // 1) active === true 우선
  const act = items.find(i => (i as any).active === true && pickSrc(i));
  if (act) return act.id;

  // 2) 이름/아이디 키워드 기반 폴백
  const pref = (keys: string[]) =>
    items.find(i => {
      const id = toL(i.id);
      const name = toL(i.name);
      const has = (s: string) => keys.some(k => s.includes(k));
      return pickSrc(i) && (has(id) || has(name));
    })?.id;

  // 슬롯별 추천 키워드
  const kw: Record<Slot, string[]> = {
    Body: ['blank','basic','default','white'],
    Face: ['regular','basic','default','face'],
    BodySuit: ['blank','basic','default'],
    Pants: ['null','none','blank','basic','default'],
    Shoes: ['null','none','blank','basic','default'],
    Clothes: ['blank','basic','default','shirt','dress'],
    Sleeves: ['blank','basic','default','sleeve'],
    Bag: ['null','none','blank','basic','default','bag'],
    Necklace: ['null','none','blank','basic','default','necklace'],
    Scarf: ['null','none','blank','basic','default','scarf','scaf'],
    Bowtie: ['null','none','blank','basic','default','bowtie'],
    Hair: ['null','none','blank','basic','default','hair'],
    Hat: ['null','none','blank','basic','default','hat'],
    // 확장 슬롯이 있으면 추가
  } as any;

  const byKw = pref(kw[slot] ?? ['null','none','blank','regular','default','basic']);
  if (byKw) return byKw;

  // 3) 마지막 폴백: 아무거나 src 있는 첫 번째
  const anyWithSrc = items.find(i => pickSrc(i))?.id;
  return anyWithSrc;
}

/** 첫 실행 시, 기본 아이템 자동 장착 */
export async function bootstrapFirstRun() {
  const { inv } = makeServices();
  const [state, catAny] = await Promise.all([inv.load(), loadWearablesCatalog()]);
  const catalog: Record<string, WearableItem> = Array.isArray(catAny)
    ? Object.fromEntries((catAny as WearableItem[]).map(it => [it.id, it]))
    : (catAny as Record<string, WearableItem>);

  const equipped = { ...(state.equipped as Record<string, string> ?? {}) };

  // 슬롯별로 비어있으면 기본값 채우기
  const equipPatch: Partial<Record<Slot, string>> = {};
  for (const slot of SLOTS) {
    if (!equipped[slot]) {
      const id = pickDefaultId(slot, catalog);
      if (id) equipPatch[slot] = id;
    }
  }

  if (Object.keys(equipPatch).length) {
    await inv.apply({ equip: equipPatch, reason: 'bootstrap:first-run' });
    notifyInventoryChanged();
  }
}

/** 앱 진입 시 1회 호출 */
export async function bootstrapApp() {
  // 여기서 서버 동기화 등 확장 가능
  await bootstrapFirstRun();
}
