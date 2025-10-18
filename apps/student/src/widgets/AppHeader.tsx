// src/widgets/AppHeader.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { makeServices } from '../core/service.locator';
console.warn("[AppHeader] MOUNT @", location.pathname, "time:", Date.now());


type Slot =
  | 'Body' | 'Face' | 'BodySuit' | 'Pants' | 'Shoes' | 'Clothes' | 'Sleeves'
  | 'Necklace' | 'Bag' | 'Scarf' | 'Bowtie' | 'Hair' | 'Hat';
type WearableItem = { id:string; name?:string; slot:Slot; src?:string; layer?:number; z?:number; };

const SLOTS: Slot[] = ['Body','BodySuit','Pants','Shoes','Clothes','Sleeves','Bag','Necklace','Scarf','Bowtie','Face','Hair','Hat'];
const Z: Record<Slot, number> = { Body:0, BodySuit:5, Pants:10, Shoes:15, Clothes:20, Sleeves:25, Bag:30, Necklace:40, Scarf:45, Bowtie:50, Face:55, Hair:60, Hat:70 };

const __prefix = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '');
const norm = (src?:string) => !src ? undefined : /^https?:\/\//.test(src) ? src : (src.startsWith('/')?`${__prefix}${src}`:`${__prefix}/${src}`);
const pickSrc = (it?:any) =>
  norm(it?.src ?? it?.image ?? it?.img ?? it?.renderSrc ?? it?.render ??
    it?.thumbnail ?? (Array.isArray(it?.images)?it.images[0]:undefined) ??
    (typeof it?.url==='string'?it.url:undefined));

async function loadCatalog(): Promise<Record<string, WearableItem>> {
  const url = (import.meta as any).env?.VITE_PACKS_BASE
    ? `${(import.meta as any).env.VITE_PACKS_BASE.replace(/\/+$/,'')}/wearables.v1.json`
    : '/packs/wearables.v1.json';
  const res = await fetch(url, { cache:'no-store' });
  const raw = await res.json();
  const arr: WearableItem[] = Array.isArray(raw) ? raw : Object.values(raw||{});
  return Object.fromEntries(arr.map(it => [it.id, it]));
}

// ── 싱글톤 마운트 가드 ───────────────────────────
let __APP_HEADER_MOUNTED__ = false;

export default function AppHeader(){
  // 두 번째 이상 마운트되면 즉시 무시
  if (__APP_HEADER_MOUNTED__) return null;
  __APP_HEADER_MOUNTED__ = true;

  const { inv } = useMemo(() => makeServices(), []);
  const [equipped, setEquipped] = useState<Record<string,string>>({});
  const [catalog,  setCatalog ] = useState<Record<string, WearableItem>>({});
  const [ready,    setReady   ] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [s, cat] = await Promise.all([inv.load(), loadCatalog()]);
      if (!alive) return;
      setEquipped(s?.equipped ?? {});
      setCatalog(cat);
      setReady(true);
    })();

    const onChanged = async () => {
      const s = await inv.load();
      setEquipped(s?.equipped ?? {});
    };
    window.addEventListener('inv:changed', onChanged as EventListener);

    return () => {
      alive = false;
      window.removeEventListener('inv:changed', onChanged as EventListener);
      __APP_HEADER_MOUNTED__ = false; // 가드 해제
    };
  }, [inv]);

  const layers = useMemo(() => {
    const out: {id:string; slot:Slot; src:string; z:number}[] = [];
    for (const slot of SLOTS){
      const id = equipped[slot];
      if (!id) continue;
      const it = catalog[id] ?? catalog[id?.toLowerCase()];
      const src = pickSrc(it);
      if (!src) continue;
      const z = Number.isFinite((it as any)?.layer ?? (it as any)?.z)
        ? Number((it as any)?.layer ?? (it as any)?.z)
        : (Z[slot] ?? 0);
      out.push({ id, slot, src, z });
    }
    return out.sort((a,b)=>a.z-b.z);
  }, [equipped, catalog]);

  return (
    <header className="flex items-center gap-3 p-3">
      <div className="w-[96px] h-[96px] rounded-xl overflow-hidden bg-black/20 border border-white/10 relative">
        {ready && layers.length ? layers.map(l => (
          <img
            key={`${l.slot}:${l.id}`}
            src={l.src}
            alt=""
            className="absolute inset-0 object-contain max-w-full max-h-full pointer-events-none select-none"
            style={{ zIndex:l.z }}
          />
        )) : <div className="w-[96px] h-[96px]" />}
      </div>
      <div className="flex-1">
        <div className="text-lg font-semibold">오늘의 던전</div>
        <div className="text-sm opacity-70">내 아바타</div>
      </div>
    </header>
  );
}
