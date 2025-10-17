// apps/student/src/core/bootstrap.ts
// 첫 실행 시 초기 장착/보유 세팅:
// - 시트/카탈로그의 active === true 항목을 "슬롯별로 0~1개" 사용
// - 슬롯별 active 항목이 없으면 blank/basic/regular/default/.null 휴리스틱으로 폴백
// - 이미 장착 상태가 있으면 아무 것도 하지 않음
// - 적용 후 inv:changed 이벤트 브로드캐스트

import { LocalInventoryGateway } from "./inventory.local";
import { loadWearablesCatalog } from "./wearable.catalog";
import type { Slot, WearableItem } from "./wearable.types";

const SLOTS: Slot[] = [
  "Hair",
  "Hat",
  "Clothes",
  "BodySuit",
  "Pants",
  "Shoes",
  "Sleeves",
  "Necklace",
  "Scarf",
  "Bowtie",
  "Bag",
  "Body",
  "Face",
];

const toL = (s?: string) => (s ?? "").toLowerCase();

function pickDefaultId(slot: Slot, cat: Record<string, WearableItem>): string | undefined {
  const items = Object.values(cat).filter((i) => i.slot === slot);
  const score = (it: WearableItem) => {
    const s = `${it.id} ${it.name ?? ""}`.toLowerCase();
    // 기본(없음/무채색) 스킨을 더 낮은 점수로 우선 선택
    if (
      s.includes("blank") ||
      s.includes("basic") ||
      s.includes("regular") ||
      s.includes("default") ||
      s.endsWith(".null") ||
      s.includes("없음")
    )
      return 0;
    return 1;
  };
  return items.sort((a, b) => score(a) - score(b))[0]?.id;
}

export async function bootstrapFirstRun(): Promise<void> {
  const inv = new LocalInventoryGateway();
  const s = await inv.load();

  // 이미 초기화되어 장착된 내역이 있으면 종료
  if (s && s.equipped && Object.keys(s.equipped).length > 0) return;

  // 카탈로그 로딩(맵/배열 모두 대응: wearable.catalog 가 normalize 하므로 맵 기준으로 취급)
  const catAny = await loadWearablesCatalog();
  const cat: Record<string, WearableItem> = Array.isArray(catAny)
    ? Object.fromEntries(
      (catAny as WearableItem[]).filter(Boolean).map((it) => [it.id, it])
    )
    : (catAny as Record<string, WearableItem>);

  // 1) active === true 를 슬롯별로 1개만 채택
  const activeBySlot = new Map<Slot, string>();
  for (const it of Object.values(cat)) {
    const slot = it?.slot as Slot | undefined;
    if (!slot) continue;
    // 시트/JSON에서 active가 true일 때만 초기 장착 대상으로 사용
    if ((it as any).active === true) {
      if (!activeBySlot.has(slot)) {
        activeBySlot.set(slot, it.id);
      } else {
        // 중복이면 첫 항목 유지 + 경고
        // (중복을 허용하되, 동작은 예측 가능하게)
        console.warn(
          "[bootstrap] duplicate active for slot:",
          slot,
          "keep=",
          activeBySlot.get(slot),
          "ignore=",
          it.id
        );
      }
    }
  }

  // 2) nextEquip/owned 구성: active 우선, 없으면 휴리스틱 폴백
  const nextEquip: Partial<Record<Slot, string>> = {};
  const ownedSet = new Set<string>();

  for (const slot of SLOTS) {
    const id = activeBySlot.get(slot) ?? pickDefaultId(slot, cat);
    if (id) {
      nextEquip[slot] = id;
      ownedSet.add(id);
    }
  }

  // 장착할 항목이 없다면 종료
  if (Object.keys(nextEquip).length === 0) return;

  // 3) 적용: 장착 + 보유 추가
  await inv.apply({
    equip: (nextEquip as any),
    cosmeticsAdd: Array.from(ownedSet),
    reason: "seed:first-run",
  });

  // 4) 다른 화면(옷장/가챠 등) 갱신
  try {
    window.dispatchEvent(new CustomEvent("inv:changed"));
  } catch {
    // SSR/테스트 등 window 미존재 환경은 무시
  }
}
