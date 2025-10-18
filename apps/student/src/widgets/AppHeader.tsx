import React, { useEffect, useMemo, useState } from 'react';
import { makeServices } from '../core/service.locator';
import { loadWearablesCatalog } from '../core/wearable.catalog';

type Slot =
  | 'Body' | 'Face' | 'BodySuit' | 'Pants' | 'Shoes' | 'Clothes' | 'Sleeves'
  | 'Necklace' | 'Bag' | 'Scarf' | 'Bowtie' | 'Hair' | 'Hat';

type WearableItem = {
  id: string;
  name?: string;
  slot: Slot;
  // 다양한 스키마 대응
  src?: string; image?: string; img?: string; renderSrc?: string; render?: string;
  thumbnail?: string; thumb?: string; file?: string; url?: string;
  images?: string[]; assets?: string[];
  layer?: number; z?: number;
};

const SLOTS: Slot[] = [
  'Body','BodySuit','Pants','Shoes','Clothes','Sleeves',
  'Bag','Necklace','Scarf','Bowtie','Face','Hair','Hat'
];

const Z: Record<Slot, number> = {
  Body:0, BodySuit:5, Pants:10, Shoes:15, Clothes:20, Sleeves:25,
  Bag:30, Necklace:40, Scarf:45, Bowtie:50, Face:55, Hair:60, Hat:70,
};

// BASE_URL 하위에 배포돼도 안전하게 동작하도록 prefix
const BASE = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '');
const normalizeSrc = (src?: string) => {
  if (!src) return undefined;
  if (/^https?:\/\//i.test(src)) return src;
  return src.startsWith('/') ? `${BASE}${src}` : `${BASE}/${src}`;
};

// wearables 스키마가 제각각이어도 최대한 경로를 뽑아냄
const pickSrc = (it?: Partial<WearableItem>) =>
  normalizeSrc(
    it?.src ?? it?.image ?? it?.img ?? it?.renderSrc ?? it?.render ??
    it?.thumbnail ?? it?.thumb ??
    (Array.isArray(it?.images) ? it!.images![0] : undefined) ??
    (Array.isArray(it?.assets) ? it!.assets![0] : undefined) ??
    (typeof it?.file === 'string' ? it!.file! : undefined) ??
    (typeof it?.url  === 'string' ? it!.url!  : undefined)
  );

function toCatalogMap(catAny: any) {
  const map: Record<string, WearableItem> = {};
  if (Array.isArray(catAny)) {
    for (const it of catAny) map[(it.id || '').toLowerCase()] = it;
  } else if (catAny && typeof catAny === 'object') {
    for (const [id, it] of Object.entries(catAny)) map[id.toLowerCase()] = it as WearableItem;
  }
  return map;
}

export default function AppHeader() {
  const { inv } = useMemo(() => makeServices(), []);
  const [equipped, setEquipped] = useState<Record<string, string>>({});
  const [catalogL, setCatalogL] = useState<Record<string, WearableItem>>({});
  const [ready, setReady] = useState(false);

  // 공용 로더 사용 → 배포 경로/캐싱 정책 그대로 공유
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [state, cat] = await Promise.all([inv.load(), loadWearablesCatalog()]);
        if (!alive) return;
        setEquipped(state?.equipped ?? {});
        setCatalogL(toCatalogMap(cat));
      } catch (e) {
        console.error('[AppHeader] init failed:', e);
      } finally {
        if (alive) setReady(true);
      }
    })();

    const onInvChanged = async () => {
      const s = await inv.load();
      setEquipped(s?.equipped ?? {});
    };
    window.addEventListener('inv:changed', onInvChanged as EventListener);

    return () => {
      alive = false;
      window.removeEventListener('inv:changed', onInvChanged as EventListener);
    };
  }, [inv]);

  // 레이어 계산
  const layers = useMemo(() => {
    const out: { id: string; slot: Slot; src: string; z: number }[] = [];
    for (const slot of SLOTS) {
      const id = equipped[slot];
      if (!id) continue;
      const it = catalogL[id.toLowerCase()];
      const src = pickSrc(it);
      if (!src) continue;
      const z = Number.isFinite((it as any)?.layer ?? (it as any)?.z)
        ? Number((it as any)?.layer ?? (it as any)?.z)
        : (Z[slot] ?? 0);
      out.push({ id, slot, src, z });
    }
    return out.sort((a, b) => a.z - b.z);
  }, [equipped, catalogL]);

  return (
    <header className="flex items-center gap-3 p-3">
      <div className="w-[96px] h-[96px] rounded-xl overflow-hidden bg-black/20 border border-white/10 relative">
        {ready && layers.length > 0 ? (
          layers.map(L => (
            <img
              key={`${L.slot}:${L.id}`}
              src={L.src}
              alt=""
              className="absolute inset-0 object-contain max-w-full max-h-full pointer-events-none select-none"
              style={{ zIndex: L.z }}
            />
          ))
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
