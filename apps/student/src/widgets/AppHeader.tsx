import React, { useEffect, useMemo, useState } from 'react';
import { AvatarRenderer } from '../shared/ui/AvatarRenderer';
import { makeServices } from '../core/service.locator';
import type { Equipped, WearableItem } from '../core/wearable.types';
import { loadWearablesCatalog } from '../core/wearable.catalog';
import { onInventoryChanged } from '../core/inv.bus';
import { preloadImages } from '../shared/ui/preload'; // 프리로드 유틸

// ── 유틸 ─────────────────────────────────────────
type Slot =
  | 'Body' | 'Face' | 'BodySuit' | 'Pants' | 'Shoes' | 'Clothes' | 'Sleeves'
  | 'Necklace' | 'Bag' | 'Scarf' | 'Bowtie' | 'Hair' | 'Hat';

const SLOTS: Slot[] = ['Body','BodySuit','Pants','Shoes','Clothes','Sleeves','Bag','Necklace','Scarf','Bowtie','Face','Hair','Hat'];

const toL = (s?: string) => (s ?? '').toLowerCase();

const __prefix = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '');
const normalizeSrc = (src?: string) => {
  if (!src) return undefined;
  if (/^https?:\/\//i.test(src)) return src;
  return src.startsWith('/') ? `${__prefix}${src}` : `${__prefix}/${src}`;
};

// 다양한 스키마 대응: src | image | url | thumbnail | images[0] | assets[0] ...
const pickSrc = (it?: any) =>
  normalizeSrc(
    it?.src ??
    it?.image ??
    it?.img ??
    it?.renderSrc ??
    it?.render ??
    it?.thumbnail ??
    it?.thumb ??
    (Array.isArray(it?.images) ? it.images[0] : undefined) ??
    (Array.isArray(it?.assets) ? it.assets[0] : undefined) ??
    (typeof it?.file === 'string' ? it.file : undefined) ??
    (typeof it?.url === 'string' ? it.url : undefined)
  );

// equipped만으로 레이어 계산(절대 카탈로그 전체로 확장 금지)
function toLayers(equipped: Equipped, catalog: Record<string, WearableItem>) {
  const layers: { id: string; slot: Slot; src?: string; name?: string; z: number }[] = [];
  const Z_BY_SLOT: Record<Slot, number> = {
    Body: 0, BodySuit: 5, Pants: 10, Shoes: 15, Clothes: 20, Sleeves: 25,
    Bag: 30, Necklace: 40, Scarf: 45, Bowtie: 50, Face: 55, Hair: 60, Hat: 70,
  };
  const getZ = (slot: Slot, it?: any) => Number.isFinite(it?.layer ?? it?.z) ? Number(it?.layer ?? it?.z) : (Z_BY_SLOT[slot] ?? 0);

  for (const slot of SLOTS) {
    const id = equipped[slot];
    if (!id) continue;
    const it = catalog[id] ?? catalog[toL(id)];
    layers.push({
        id,
        slot,
        src: pickSrc(it) ?? '',
        name: it?.name ?? id,
        z: getZ(slot, it),
    });
  }
  // 낮은 z 아래, 높은 z 위
  layers.sort((a, b) => a.z - b.z);
  return layers;
}

// ── 컴포넌트 ─────────────────────────────────────
export default function AppHeader() {
  const { inv } = useMemo(() => makeServices(), []);
  const [equipped, setEquipped] = useState<Equipped>({});
  const [catalog, setCatalog] = useState<Record<string, WearableItem>>({});
  const [ready, setReady] = useState(false);

  // 초기 로드
  useEffect(() => {
    (async () => {
      try {
        const [s, catAny] = await Promise.all([inv.load(), loadWearablesCatalog()]);
        // 카탈로그: 배열/맵 모두 대응
        const catMap: Record<string, WearableItem> = Array.isArray(catAny)
          ? Object.fromEntries((catAny as WearableItem[]).map(it => [it.id, it]))
          : (catAny as Record<string, WearableItem>);

        setEquipped((s.equipped || {}) as Equipped);
        setCatalog(catMap);
      } finally {
        setReady(true);
      }
    })();
  }, [inv]);

  // 인벤 변경 반영
  useEffect(() => {
    const off = onInventoryChanged(async () => {
      const [s, catAny] = await Promise.all([inv.load(), loadWearablesCatalog()]);
      const catMap: Record<string, WearableItem> = Array.isArray(catAny)
        ? Object.fromEntries((catAny as WearableItem[]).map(it => [it.id, it]))
        : (catAny as Record<string, WearableItem>);
      setEquipped((s.equipped || {}) as Equipped);
      setCatalog(catMap);
    });
    return off;
  }, [inv]);

  // 장착 데이터가 실제로 존재할 때만 레이어 계산/프리로드
  const hasEquip = useMemo(() => Object.values(equipped || {}).some(Boolean), [equipped]);
  const layers = useMemo(
    () => (hasEquip ? toLayers(equipped, catalog) : []),
    [hasEquip, equipped, catalog]
  );

  // 프리로드: 장착된 레이어 src만, 중복 제거
  useEffect(() => {
    if (!hasEquip) return; // ☜ 첫 진입에 장착이 준비되기 전에 전체 프리로드 방지
    const srcs = Array.from(new Set(layers.map(l => l.src).filter(Boolean) as string[]));
    if (srcs.length) preloadImages(srcs);
  }, [hasEquip, layers]);

  return (
    <header className="w-full px-4 py-3 flex items-center gap-3 bg-slate-900/60">
      <div className="shrink-0">
        {ready && hasEquip ? (
          <AvatarRenderer
            layers={layers.map(l => ({ ...l, src: l.src ?? '' }))}
            size={120}
            corsMode="none"
          />
        ) : (
          <div style={{ width: 120, height: 120 }} />
        )}
      </div>
      <div className="flex-1">
        <div className="text-lg font-semibold">오늘의 던전</div>
        <div className="text-sm opacity-70">내 아바타</div>
      </div>
    </header>
  );
}
