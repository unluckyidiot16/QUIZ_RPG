import React, { useEffect, useMemo, useState } from 'react';
import { AvatarRenderer } from '../shared/ui/AvatarRenderer';
import { makeServices } from '../core/service.locator';
import type { WearableItem } from '../core/wearable.types';
import { loadWearablesCatalog } from '../core/wearable.catalog';
import { onInventoryChanged } from '../core/inv.bus';

type Slot =
  | 'Body' | 'Face' | 'BodySuit' | 'Pants' | 'Shoes' | 'Clothes' | 'Sleeves'
  | 'Necklace' | 'Bag' | 'Scarf' | 'Bowtie' | 'Hair' | 'Hat';

const SLOTS: Slot[] = [
  'Body','BodySuit','Pants','Shoes','Clothes','Sleeves',
  'Bag','Necklace','Scarf','Bowtie','Face','Hair','Hat'
];

const __prefix = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '');
const normalizeSrc = (src?: string) => {
  if (!src) return undefined;
  if (/^https?:\/\//i.test(src)) return src;
  return src.startsWith('/') ? `${__prefix}${src}` : `${__prefix}/${src}`;
};
const pickSrc = (it?: any) =>
  normalizeSrc(
    it?.src ?? it?.image ?? it?.img ?? it?.renderSrc ?? it?.render ??
    it?.thumbnail ?? it?.thumb ??
    (Array.isArray(it?.images) ? it.images[0] : undefined) ??
    (Array.isArray(it?.assets) ? it.assets[0] : undefined) ??
    (typeof it?.file === 'string' ? it.file : undefined) ??
    (typeof it?.url === 'string' ? it.url : undefined)
  );

function toLayers(equipped: Record<string, string>, catalog: Record<string, WearableItem>) {
  const Z: Record<Slot, number> = {
    Body: 0, BodySuit: 5, Pants: 10, Shoes: 15, Clothes: 20, Sleeves: 25,
    Bag: 30, Necklace: 40, Scarf: 45, Bowtie: 50, Face: 55, Hair: 60, Hat: 70,
  };
  const out: { id: string; slot: Slot; src: string; z: number }[] = [];
  for (const slot of SLOTS) {
    const id = equipped[slot];
    if (!id) continue;
    const it = catalog[id] ?? catalog[id?.toLowerCase()];
    const src = pickSrc(it);
    if (!src) continue;
    const z = Number.isFinite((it as any)?.layer ?? (it as any)?.z)
      ? Number((it as any)?.layer ?? (it as any)?.z) : (Z[slot] ?? 0);
    out.push({ id, slot, src, z });
  }
  return out.sort((a,b)=>a.z-b.z);
}

export default function AppHeader() {
  const { inv } = useMemo(() => makeServices(), []);
  const [equipped, setEquipped] = useState<Record<string, string>>({});
  const [catalog,  setCatalog ] = useState<Record<string, WearableItem>>({});
  const [ready,    setReady   ] = useState(false);

  useEffect(() => {
    (async () => {
      const [s, catAny] = await Promise.all([inv.load(), loadWearablesCatalog()]);
      const catMap: Record<string, WearableItem> = Array.isArray(catAny)
        ? Object.fromEntries((catAny as WearableItem[]).map(it => [it.id, it]))
        : (catAny as Record<string, WearableItem>);
      setEquipped(s?.equipped ?? {});
      setCatalog(catMap);
      setReady(true);
    })();

    const off = onInventoryChanged(async () => {
      const s = await inv.load();
      setEquipped(s?.equipped ?? {});
    });
    return off;
  }, [inv]);

  const layers = useMemo(() => toLayers(equipped, catalog), [equipped, catalog]);

  return (
    <header className="flex items-center gap-3 p-3">
      <div className="w-[96px] h-[96px] rounded-xl overflow-hidden bg-black/20 border border-white/10 grid place-items-center">
        {ready && layers.length ? (
          <AvatarRenderer
            size={96}
            corsMode="none"
            layers={layers.map(l => ({ id: l.id, src: l.src, z: l.z }))}
          />
        ) : (
          <div className="w-[96px] h-[96px]" />
        )}
      </div>
      <div className="flex-1">
        <div className="text-lg font-semibold">오늘의 던전</div>
        <div className="text-sm opacity-70">내 아바타</div>
      </div>
    </header>
  );
}
