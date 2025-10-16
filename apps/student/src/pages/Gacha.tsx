// pages/Gacha.tsx (예시)
const { inv, gacha } = useMemo(() => makeServices(), []);
// pool 로드 후
const onDraw10 = async ()=> {
  const res = await gacha.open(pool, 10, { idempotencyKey: crypto?.randomUUID?.() || String(Date.now()) });
  setResults(res.results);
};
