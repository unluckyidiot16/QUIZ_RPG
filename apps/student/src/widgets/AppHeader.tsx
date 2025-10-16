import React, { useEffect, useMemo, useState } from 'react';
import { AvatarRenderer } from '../shared/ui/AvatarRenderer';
import { makeServices } from '../core/service.locator';
import type { Equipped, WearableItem } from '../core/wearable.types';
import { loadWearablesCatalog } from '../core/wearable.catalog';
import { equippedToLayers } from '../core/wearable.adapter';

export default function AppHeader() {
  const { inv } = useMemo(() => makeServices(), []);
  const [equipped, setEquipped] = useState<Equipped>({});
  const [catalog, setCatalog] = useState<Record<string, WearableItem>>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const [s, cat] = await Promise.all([
        inv.load(),            // 착용 정보
        loadWearablesCatalog() // 시트→JSON 카탈로그
      ]);
      setEquipped((s.equipped || {}) as Equipped);
      setCatalog(cat);
      setReady(true);
    })();
  }, [inv]);

  const layers = useMemo(() => equippedToLayers(equipped, catalog), [equipped, catalog]);

  return (
    <header className="w-full px-4 py-3 flex items-center gap-3 bg-slate-900/60">
      <div className="shrink-0">
        {/* 카탈로그가 로드되면 즉시 렌더; 로딩 중엔 자리만 잡아둠 */}
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
