// src/widgets/AppHeader.tsx
import { loadWearablesCatalog } from '../core/wearable.catalog';
import { equippedToLayers } from '../core/wearable.adapter';
import type { Equipped } from '../core/wearable.types';
import { makeServices } from '../core/service.locator';
import { useEffect, useMemo, useState } from 'react';
import { AvatarRenderer } from '../shared/ui/AvatarRenderer';

export default function AppHeader() {
  const { inv } = useMemo(() => makeServices(), []);
  const [equipped, setEquipped] = useState<Equipped>({});
  const [layers, setLayers] = useState<any[]>([]);

  useEffect(() => { inv.load().then(s => setEquipped(s.equipped as any)); }, [inv]);
  useEffect(() => {
    (async () => {
      const catalog = await loadWearablesCatalog();
      // equippedToLayers가 catalog를 사용하도록 오버로드 하거나, 내부에서 import하는 버전이라면 그대로 사용.
      // 간단히: adapter가 catalog를 참조하도록 살짝 수정해도 OK.
      const { equippedToLayersWith } = await import('../core/wearable.adapter.with'); // 아래 추가 예시
      setLayers(equippedToLayersWith(equipped, catalog));
    })();
  }, [equipped]);


  return (
    <header className="w-full px-4 py-3 flex items-center gap-3 bg-slate-900/60">
      <div className="shrink-0">
        <AvatarRenderer layers={layers} size={120} corsMode="none" />
      </div>
      <div className="flex-1">
        <div className="text-lg font-semibold">오늘의 던전</div>
        <div className="text-sm opacity-70">내 아바타</div>
      </div>
    </header>
  );
}
