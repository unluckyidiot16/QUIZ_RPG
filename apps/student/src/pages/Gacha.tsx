// apps/student/src/pages/Gacha.tsx
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { makeServices } from '../core/service.locator';
import { loadGachaPool } from '../core/packs';
import { loadWearablesCatalog } from '../core/wearable.catalog';
import type { GachaPoolDef } from '../core/items';
import { newIdempotencyKey } from '../shared/lib/idempotency';

const prefix = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
const normalizeSrc = (src?: string) => {
  if (!src) return undefined;
  if (/^https?:\/\//i.test(src)) return src;
  return src.startsWith("/") ? `${prefix}${src}` : `${prefix}/${src}`;
};

export default function Gacha(){
  const { inv, gacha } = useMemo(() => makeServices(), []);
  const [pool, setPool] = useState<GachaPoolDef| null>(null);
  const [coins, setCoins] = useState<number>(0);
  const [err, setErr] = useState<string | null>(null);
  const [cat, setCat] = useState<Record<string, any>>({});
  const catL = useMemo(() => {
    const m: Record<string, any> = {};
    if (Array.isArray(cat)) {
      for (const it of cat) if (it?.id) m[it.id.toLowerCase()] = it;
    } else {
      for (const [id, it] of Object.entries(cat as any)) m[id.toLowerCase()] = it;
    }
    return m;
    }, [cat]);
  const toCanonicalId = (id: string) => (cat[id] ?? catL[id.toLowerCase()] ?? { id }).id as string;
  const [results, setResults] = useState<string[]>([]); // 최근 획득 아이템 id[]

  useEffect(() => {
    (async () => {
      const s = await inv.load();
      setCoins(s.coins);
      try { setPool(await loadGachaPool()); } catch {}
      try { setCat(await loadWearablesCatalog()); } catch {}
    })();
  }, []);

  async function draw(n:number){
    if (!pool) return;
    setErr(null);
    try {
      const res = await gacha.open(pool, n, { idempotencyKey: newIdempotencyKey('gacha') });

      // ⬇️ 핵심: 소유 인벤토리에 '획득' 반영 (중복은 내부에서 무시되도록 설계)
      const fixed = res.results.map(toCanonicalId);
      await inv.apply({ cosmeticsAdd: fixed, reason: 'gacha:open' });

      // 코인 최신화
      const s = await inv.load();
      setCoins(s.coins);

      // 결과 카드 그리드 표시
      setResults(prev => [...fixed, ...prev].slice(0, 50));

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
          const it = cat[id] ?? catL[id.toLowerCase()];
          return (
            <div key={i} className="border border-white/10 rounded-xl p-2 flex flex-col items-center">
              <div className="w-20 h-20 bg-white/5 rounded-lg overflow-hidden flex items-center justify-center">
                {it?.src
                  ? <img src={normalizeSrc(it.src)} alt={it?.name ?? id} className="w-full h-full object-contain" />
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
