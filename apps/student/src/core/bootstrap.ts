import { makeServices } from "./service.locator";

// 로컬 타입(의존 최소화)
type Slot =
  | "Body" | "Face" | "BodySuit" | "Pants" | "Shoes" | "Clothes" | "Sleeves"
  | "Necklace" | "Bag" | "Scarf" | "Bowtie" | "Hair" | "Hat";

const SLOTS: Slot[] = ["Body","Face","BodySuit","Pants","Shoes","Clothes","Sleeves","Necklace","Bag","Scarf","Bowtie","Hair","Hat"];
const toL = (s?:string)=> (s??"").toLowerCase();

async function loadCatalogArr(): Promise<any[]> {
  const url = (import.meta as any).env?.VITE_PACKS_BASE
    ? `${(import.meta as any).env.VITE_PACKS_BASE.replace(/\/+$/,'')}/wearables.v1.json`
    : "/packs/wearables.v1.json";
  const res = await fetch(url, { cache:"no-store" });
  const raw = await res.json();
  return Array.isArray(raw) ? raw : Object.values(raw||{});
}
const isNullish = (it:any) => {
  const s = `${toL(it?.id)} ${toL(it?.name)}`;
  return s.endsWith(".null") || s.includes("null") || s.includes("none") || s.includes("blank") || s.includes("default") || s.includes("없음") || s.includes("기본");
};
function pickActiveDefault(slot:Slot, arr:any[]){
  const list = arr.filter(i => i?.slot === slot && i?.active === true && i?.id);
  if (!list.length) return undefined;
  const nonNull = list.filter(i => !isNullish(i));
  const pool = nonNull.length ? nonNull : list;
  const score = (it:any) => { const s = toL(`${it?.id} ${it?.name}`); let v = 0; if (s.includes("regular")) v -= 3; if (s.includes("blank")) v -= 2; if (s.includes("basic")) v -= 1; return v; };
  pool.sort((a,b)=>score(a)-score(b));
  return pool[0]?.id as string | undefined;
}

export async function bootstrapApp() {
  const { inv } = makeServices();
  const [state, catalog] = await Promise.all([inv.load(), loadCatalogArr()]);

  const ownedRaw = (state?.cosmeticsOwned ?? state?.owned ?? []) as string[] | Record<string, unknown>;
  const ownedSet = new Set<string>(Array.isArray(ownedRaw) ? ownedRaw : typeof ownedRaw==='object' ? Object.keys(ownedRaw) : []);
  const equipped: Record<Slot, string | undefined> = { ...(state?.equipped ?? {}) };

  const grants: string[] = [];
  let equipPatched = false;

  for (const s of SLOTS){
    const defId = pickActiveDefault(s, catalog);
    if (!defId) continue;
    if (!ownedSet.has(defId)) { ownedSet.add(defId); grants.push(defId); }
    if (!equipped[s]) { equipped[s] = defId; equipPatched = true; }
  }

  if (!grants.length && !equipPatched) return;

  await inv.apply({
    cosmeticsAdd: grants.length ? grants : undefined, // ✅ LocalInventoryGateway가 지원
    equip: equipPatched ? equipped : undefined,
    reason: "bootstrap:active-defaults",
  });

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("inv:changed"));
  }
}
