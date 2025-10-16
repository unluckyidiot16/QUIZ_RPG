import React, { useEffect, useMemo, useState } from 'react';
import { AvatarRenderer } from '../shared/ui/AvatarRenderer';
import { makeServices } from '../core/service.locator';
import type { Equipped, WearableItem } from '../core/wearable.types';
import { loadWearablesCatalog } from '../core/wearable.catalog';
import { equippedToLayers } from '../core/wearable.adapter';
import { onInventoryChanged } from '../core/inv.bus';
import { preloadImages } from '../shared/ui/preload'; // ✅ 누락 import 추가

export default function AppHeader() {
  const { inv } = useMemo(() => makeServices(), []);
  const [equipped, setEquipped] = useState<Equipped>({});
  const [catalog, setCatalog] = useState<Record<string, WearableItem>>({});
  const [ready, setReady] = useState(false);

  // ✅ 초기 로드
  useEffect(() => {
    (async () => {
      try {
        const [s, cat] = await Promise.all([inv.load(), loadWearablesCatalog()]);
        setEquipped((s.equipped || {}) as Equipped);
        setCatalog(cat);
      } finally {
        setReady(true);
      }
    })();
  }, [inv]);

  // ✅ 인벤토리 변경 이벤트 반영
  useEffect(() => {
    const off = onInventoryChanged(async () => {
      const [s, cat] = await Promise.all([inv.load(), loadWearablesCatalog()]);
      setEquipped((s.equipped || {}) as Equipped);
      setCatalog(cat);
    });
    return off;
  }, [inv]);

  const layers = React.useMemo(() => equippedToLayers(equipped, catalog), [equipped, catalog]);

  // ✅ 프리로드
  useEffect(() => { preloadImages(layers.map(l => l.src)); }, [layers]);

  return (
    <header className="w-full px-4 py-3 flex items-center gap-3 bg-slate-900/60">
      <div className="shrink-0">
        {ready ? (
          <AvatarRenderer layers={layers} size={120} corsMode="none" />
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
