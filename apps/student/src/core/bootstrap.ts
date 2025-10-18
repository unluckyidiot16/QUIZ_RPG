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

function toCatalogL(catAny: any) {
  const m: Record<string, any> = {};
  if (Array.isArray(catAny)) {
    for (const it of catAny) m[toL(it.id)] = it;
  } else if (catAny && typeof catAny === "object") {
    for (const [id, it] of Object.entries(catAny)) m[toL(id)] = it;
  }
  return m;
}

/** 슬롯별 “없음/기본(.null/none/blank/default/없음/기본)” 후보 찾기 */
function findNullId(slot: Slot, catalogL: Record<string, any>): string | undefined {
  for (const [idL, it] of Object.entries(catalogL)) {
    if (it?.slot !== slot) continue;
    const nameL = toL(it?.name);
    if (
      idL.endsWith(".null") ||
      idL.includes("null") ||
      idL.includes("none") ||
      idL.includes("blank") ||
      idL.includes("default") ||
      nameL.includes("없음") ||
      nameL.includes("기본")
    ) {
      return it.id ?? idL; // 원본 id 우선
    }
  }
  return undefined;
}

/** 그 외 “기본” 후보(없음이 없을 때 blank/basic/regular/default 등) */
function pickDefaultId(slot: Slot, catalogL: Record<string, any>): string | undefined {
  const items = Object.values(catalogL).filter((i: any) => i?.slot === slot);
  const score = (it: any) => {
    const s = `${it?.id ?? ""} ${it?.name ?? ""}`.toLowerCase();
    return (s.includes("blank") || s.includes("basic") || s.includes("regular") ||
      s.includes("default") || s.endsWith(".null") || s.includes("없음")) ? 0 : 1;
  };
  items.sort((a, b) => score(a) - score(b));
  return (items[0] as any)?.id;
}

/** 최초 진입 시 1회 실행해도 안전: 멱등하게 동작 */
export async function bootstrapApp() {
  const { inv } = makeServices();

  const [state, catAny] = await Promise.all([
    inv.load(),
    loadWearablesCatalog(),
  ]);

  const catalogL = toCatalogL(catAny);

  // 현재 보유 세트(owned / cosmeticsOwned 중 있는 쪽 사용)
  const ownedRaw = (state?.cosmeticsOwned ?? state?.owned ?? []) as string[] | Record<string, unknown>;
  const ownedSet = new Set<string>(
    Array.isArray(ownedRaw)
      ? ownedRaw
      : typeof ownedRaw === "object"
        ? Object.keys(ownedRaw)
        : []
  );

  // 장착 상태
  const equipped: Record<Slot, string | undefined> = { ...(state?.equipped ?? {}) };

  // 1) 슬롯별 null 후보를 보유 목록에 **자동 추가**
  const grants: string[] = [];
  for (const slot of SLOTS) {
    const nullId = findNullId(slot, catalogL);
    if (nullId && !ownedSet.has(nullId)) {
      ownedSet.add(nullId);
      grants.push(nullId);
    }
  }

  // 2) 비어 있는 슬롯은 “null 후보 → 기본 후보” 순으로 장착 보정
  let equipPatched = false;
  for (const slot of SLOTS) {
    if (!equipped[slot]) {
      const nullId = findNullId(slot, catalogL);
      if (nullId) {
        equipped[slot] = nullId;
        equipPatched = true;
        continue;
      }
      const defId = pickDefaultId(slot, catalogL);
      if (defId) {
        equipped[slot] = defId;
        equipPatched = true;
      }
    }
  }

  // 변경 없다면 조용히 종료(멱등)
  if (!grants.length && !equipPatched) return;

  // 3) 저장(apply)
  //  - grant/replacers는 게이트웨이 구현에 따라 옵션일 수 있어서 any로 안전 처리
  const payload: any = {
    reason: "bootstrap:null-defaults",
  };
  if (grants.length) {
    // (지원 시) grant 필드
    payload.grant = grants;
    // (미지원 대비) owned/cosmeticsOwned도 함께 덮어쓰기/병합
    payload.replace = {
      cosmeticsOwned: Array.from(ownedSet),
      owned: Array.from(ownedSet),
    };
  }
  if (equipPatched) {
    payload.equip = equipped;
  }

  await inv.apply(payload);
  // 브로드캐스트
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("inv:changed"));
  }
}
