// apps/student/src/core/bootstrap.ts
import { makeServices } from "./service.locator";
import { loadWearablesCatalog } from "./wearable.catalog";

type Slot =
  | "Body" | "Face" | "BodySuit" | "Pants" | "Shoes" | "Clothes" | "Sleeves"
  | "Necklace" | "Bag" | "Scarf" | "Bowtie" | "Hair" | "Hat";

const SLOTS: Slot[] = [
  "Body","Face","BodySuit","Pants","Shoes","Clothes","Sleeves",
  "Necklace","Bag","Scarf","Bowtie","Hair","Hat",
];

const toL = (s?: string) => (s ?? "").toLowerCase();

function toCatalogArray(catAny: any): any[] {
  if (Array.isArray(catAny)) return catAny;
  if (catAny && typeof catAny === "object") return Object.values(catAny);
  return [];
}
function bySlot(items: any[], slot: Slot) {
  return items.filter(i => i?.slot === slot);
}
function isNullish(it: any) {
  const idL = toL(it?.id);
  const nmL = toL(it?.name);
  return (
    idL.endsWith(".null") || idL.includes("null") || idL.includes("none") ||
    idL.includes("blank") || idL.includes("default") ||
    nmL.includes("없음") || nmL.includes("기본")
  );
}

/** slot별 기본 선택: active:true 우선, 그중 non-null 우선, 없으면 nullish 허용 */
function pickActiveDefault(slot: Slot, catalogArr: any[]) {
  const list = bySlot(catalogArr, slot)
    .filter(i => (i?.active === true) && i?.id);

  if (!list.length) return undefined;

  const nonNull = list.filter(i => !isNullish(i));
  const pickPool = nonNull.length ? nonNull : list;

  // 가벼운 가중치: 이름/아이디에 blank/regular 등 있으면 먼저
  const score = (it: any) => {
    const s = `${toL(it?.id)} ${toL(it?.name)}`;
    let v = 0;
    if (s.includes("regular")) v -= 3;
    if (s.includes("blank"))   v -= 2;
    if (s.includes("basic"))   v -= 1;
    return v;
  };
  pickPool.sort((a,b)=>score(a)-score(b));
  return pickPool[0]?.id as string | undefined;
}

export async function bootstrapApp() {
  const { inv } = makeServices();
  const [state, catAny] = await Promise.all([inv.load(), loadWearablesCatalog()]);
  const catalogArr = toCatalogArray(catAny);

  // 현재 보유/장착
  const ownedRaw = (state?.cosmeticsOwned ?? state?.owned ?? []) as string[] | Record<string, unknown>;
  const ownedSet = new Set<string>(
    Array.isArray(ownedRaw)
      ? ownedRaw
      : typeof ownedRaw === "object"
        ? Object.keys(ownedRaw)
        : []
  );
  const equipped: Record<Slot, string | undefined> = { ...(state?.equipped ?? {}) };

  // 1) 슬롯별 default 후보 = active:true 우선 선택
  const grants: string[] = [];
  let equipPatched = false;

  for (const slot of SLOTS) {
    const defId = pickActiveDefault(slot, catalogArr);
    if (!defId) continue;

    // 보유에 없다면 부여
    if (!ownedSet.has(defId)) {
      ownedSet.add(defId);
      grants.push(defId);
    }
    // 장착 비어있으면 기본 장착
    if (!equipped[slot]) {
      equipped[slot] = defId;
      equipPatched = true;
    }
  }

  if (!grants.length && !equipPatched) return; // 변경 없으면 종료(멱등)

  const payload: any = { reason: "bootstrap:active-defaults" };
  if (grants.length) {
    payload.grant = grants; // 게이트웨이가 지원하면 사용
    payload.replace = { cosmeticsOwned: Array.from(ownedSet), owned: Array.from(ownedSet) }; // 미지원 대비
  }
  if (equipPatched) payload.equip = equipped;

  await inv.apply(payload);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("inv:changed"));
  }
}
