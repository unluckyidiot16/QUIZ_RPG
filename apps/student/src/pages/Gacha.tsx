// apps/student/src/pages/Gacha.tsx
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { makeServices } from '../core/service.locator';
import { loadGachaPool } from '../core/packs';
import type { GachaPoolDef } from '../core/items';
import { newIdempotencyKey } from '../shared/lib/idempotency';

type Wearable = { id: string; name?: string; slot?: string; src?: string; rarity?: string };
type CatalogMap = Record<string, Wearable>;

// 🔧 wearables.v1.json은 "id -> item" 맵 구조입니다.
async function loadCatalogMap(): Promise<CatalogMap> {
  const res = await fetch('/packs/wearables.v1.json');
  const raw = await res.json();
  // 맵이면 그대로, 배열/다른 형태면 아이디 키로 변환
  if (raw && !Array.isArray(raw) && typeof raw === 'object') {
    return raw as CatalogMap;
  }
  const arr: Wearable[] = Array.isArray(raw) ? raw : (raw.items ?? []);
  const map: CatalogMap = {};
  for (const it of arr) map[it.id] = it;
  return map;
}

export default function Gacha(){
  const { inv, gacha } = useMemo(() => makeServices(), []);
  const [pool, setPool] = useState<GachaPoolDef| null>(null);
  const [coins, setCoins] = useState<number>(0);
  const [err, setErr] = useState<string | null>(null);
  const [cat, setCat] = useState<CatalogMap>({});
  const [results, setResults] = useState<string[]>([]); // 최근 획득 아이템 id[]

  useEffect(() => {
    (async () => {
      const s = await inv.load();
      setCoins(s.coins);
      try { setPool(await loadGachaPool()); } catch {}
      try { setCat(await loadCatalogMap()); } catch {}
    })();
  }, []);

  async function draw(n:number){
    if (!pool) return;
    setErr(null);
    try {
      const res = await gacha.open(pool, n, { idempotencyKey: newIdempotencyKey('gacha') });

      // ⬇️ 핵심: 소유 인벤토리에 '획득' 반영 (중복은 내부에서 무시되도록 설계)
      await inv.apply({ cosmeticsAdd: res.results, reason: 'gacha:open' });

      // 코인 최신화
      const s = await inv.load();
      setCoins(s.coins);

      // 결과 카드 그리드 표시
      setResults(prev => [...res.results, ...prev].slice(0, 50));

      // 옷장 등에서 즉시 반영되도록 이벤트 브로드캐스트(간단 버스)
      window.dispatchEvent(new CustomEvent('inv:changed'));
    } catch (e:any) {
      setErr(e?.message ?? '가챠 실패');
    }
  }

  return (
    <div className="p-6 max-w-xl mx-auto">
      {/* 상단 네비 */}
      <div className="flex items-center justify-between">
        <Link to="/" className="text-sm opacity-80 hover:opacity-100">← 메인으로</Link>
        <Link to="/wardrobe" className="text-sm opacity-80 hover:opacity-100">옷장으로 →</Link>
      </div>

      <h2 className="mt-2 text-2xl font-bold">가챠</h2>
      <div className="mt-1 text-sm opacity-80">보유 코인: <b>{coins}</b></div>
      {err && <div className="mt-2 text-red-400 text-sm">{err}</div>}

      <div className="mt-4 flex gap-3">
        <button className="px-3 py-2 bg-slate-700 rounded" onClick={()=>draw(1)}>1회</button>
        <button className="px-3 py-2 bg-slate-700 rounded" onClick={()=>draw(10)}>10회</button>
        {/* DEV: 테스트 코인 */}
        <button
          className="ml-auto px-3 py-2 bg-emerald-700 rounded"
          onClick={async ()=>{
            await inv.apply({ coinDelta: +100, reason: 'dev:grant' });
            setCoins((await inv.load()).coins);
          }}>
          +100 코인(DEV)
        </button>
      </div>

      {/* 결과: 박스형 카드 그리드 */}
      <div className="mt-6 grid grid-cols-3 gap-3">
        {results.map((id, i) => {
          const it = cat[id];
          return (
            <div key={i} className="border border-white/10 rounded-xl p-2 flex flex-col items-center">
              <div className="w-20 h-20 bg-white/5 rounded-lg overflow-hidden flex items-center justify-center">
                {it?.src
                  ? <img src={it.src} alt={it?.name ?? id} className="w-full h-full object-contain" />
                  : <span className="text-xs opacity-60">이미지 없음</span>}
              </div>
              <div className="mt-2 text-xs text-center leading-tight">
                <div className="font-medium">{it?.name ?? id}</div>
                {it?.slot && <div className="opacity-60">{it.slot}</div>}
              </div>
            </div>
          );
        })}
      </div>

      {/* 하단 네비 */}
      <div className="mt-6 flex justify-end gap-3">
        <Link to="/wardrobe" className="px-3 py-2 bg-indigo-700 rounded">옷장에서 확인</Link>
      </div>
    </div>
  );
}
