import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { loadPlayer, levelFromXp, loadItemDB, deriveBattleStats, PlayerOps, type PlayerState, type ItemDef } from '../core/player'
import { SUBJECTS, SUBJECT_LABEL } from '../core/char.types'
import { SUBJECT_TO_COLOR, SKILL_HEX, COLOR_CLS } from '../game/combat/affinity'

export default function Status(){
  const [player, setPlayer] = useState<PlayerState|null>(null)
  const [items, setItems] = useState<Record<string, ItemDef>>({})
  const [busy, setBusy] = useState(false)
  const [itemsReady, setItemsReady] = useState(false)

  useEffect(() => {
    setPlayer(loadPlayer());
    loadItemDB('/packs/items.v1.json').then((db) => { setItems(db || {}); setItemsReady(true); });
  }, []);

  // ✅ 훅은 항상 호출되도록 하고, 렌더링만 분기한다.
  const ready = !!player && itemsReady;

  const hasBase = useMemo(() => {
    const b = (player as any)?.base;
    return !!b && typeof b.hp === 'number' && typeof b.def === 'number';
  }, [player]);

  const fallbackStat = useMemo(() => ({
    hp: (player as any)?.base?.hp ?? 50,
    def: (player as any)?.base?.def ?? 0,
    subAtk: SUBJECTS.reduce((acc, s) => { (acc as any)[s] = 0; return acc; }, {} as Record<string, number>)
  }), [player]);

  const stat = useMemo(() => {
    try {
      if (!ready || !hasBase) return fallbackStat;
      return deriveBattleStats(items, player!);
    } catch (e) {
      console.warn('[Status] deriveBattleStats failed, fallback used:', e);
      return fallbackStat;
    }
  }, [ready, hasBase, items, player, fallbackStat]);

  return (
    <div className="p-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold">상태</h1>

      {!ready && <div className="mt-3">로딩…</div>}

      {ready && !hasBase && (
        <div className="mt-3 p-3 rounded bg-amber-900/40 ring-1 ring-amber-700 text-amber-100">
          <b>플레이어 데이터가 구형 형식입니다.</b><br/>
          기본값으로 표시 중이며, 전투/결과 저장 과정에서 최신 스키마로 자동 보정됩니다.
          <div className="mt-2 flex gap-2">
            <Link className="px-3 py-1 rounded bg-slate-700" to="/create">캐릭터 설정으로 이동</Link>
            <button
              className="px-3 py-1 rounded bg-slate-700"
              onClick={() => { try { (PlayerOps as any)?.save?.(loadPlayer()); } catch(_) {} setPlayer(loadPlayer()); }}
            >
              재시도
            </button>
          </div>
        </div>
      )}

      {ready && (
        <>
          {/* 레벨/XP */}
          <LevelBlock player={player!} setPlayer={setPlayer} busy={busy} setBusy={setBusy} />

          {/* 전투 스탯 요약 */}
          <div className="mt-4 p-3 rounded bg-slate-800/60">
            <div className="font-semibold mb-2">전투 스탯 (기본 + 장비)</div>
            <ul className="grid grid-cols-2 gap-2 text-center">
              <li className="p-2 rounded bg-slate-900">HP<br/><b>{stat.hp}</b></li>
              <li className="p-2 rounded bg-slate-900">DEF<br/><b>{stat.def}</b></li>
            </ul>
          </div>

          {/* 과목별 공격력 + 레이더 */}
          <SubjectBlock stat={stat} />

          {/* 장비 */}
          <div className="mt-4 p-3 rounded bg-slate-800/60">
            <div className="font-semibold mb-2">장비</div>
            <EquipRow slot="Weapon" items={items} player={player!} onChange={()=>setPlayer(loadPlayer())} />
            <EquipRow slot="Armor" items={items} player={player!} onChange={()=>setPlayer(loadPlayer())} />
            <EquipRow slot="Accessory" items={items} player={player!} onChange={()=>setPlayer(loadPlayer())} />
            <p className="text-xs opacity-70 mt-2">※ 가챠 코스튬은 외형 전용이며 스탯이 없습니다. 장비는 던전 보상으로만 획득합니다.</p>
          </div>

          <div className="mt-6 flex gap-2">
            <Link className="px-3 py-2 rounded bg-slate-700" to="/inventory">인벤토리</Link>
            <Link className="px-3 py-2 rounded bg-slate-700" to="/">메인</Link>
          </div>
        </>
      )}
    </div>
  )
}

function LevelBlock({ player, setPlayer, busy, setBusy }:{
  player: PlayerState, setPlayer: (p: PlayerState)=>void, busy: boolean, setBusy: (b:boolean)=>void
}){
  const lv = levelFromXp(player.totalXp)
  return (
    <div className="mt-3 p-3 rounded bg-slate-800/60">
      <div className="flex items-center justify-between">
        <div className="font-semibold">Lv. {lv.level}</div>
        <div className="text-sm opacity-80">XP {lv.curXp} / {lv.needXp}</div>
      </div>
      <div className="h-2 bg-slate-700 rounded mt-2 overflow-hidden">
        <div className="h-full rounded bg-emerald-500" style={{width: `${Math.round(lv.progress*100)}%`}} />
      </div>
      <div className="mt-2 flex gap-2">
        <button disabled={busy} onClick={async()=>{ setBusy(true); PlayerOps.grantXp(1);  setPlayer(loadPlayer()); setBusy(false) }} className="px-3 py-1 rounded bg-emerald-600">+1 XP</button>
        <button disabled={busy} onClick={async()=>{ setBusy(true); PlayerOps.grantXp(10); setPlayer(loadPlayer()); setBusy(false) }} className="px-3 py-1 rounded bg-emerald-700">+10 XP</button>
      </div>
    </div>
  )
}

function SubjectBlock({ stat }:{ stat: { subAtk: Record<string, number> } & { hp:number, def:number } }){
  return (
    <div className="mt-4 p-3 rounded bg-slate-800/60">
      <div className="font-semibold mb-2">과목별 공격력</div>
      <div className="grid grid-cols-2 gap-4 items-center">
        <Radar6
          values={SUBJECTS.map(s=> stat.subAtk[s] ?? 0)}
          labels={SUBJECTS.map(s=> SUBJECT_LABEL[s])}
          colors={SUBJECTS.map(s=> SKILL_HEX[SUBJECT_TO_COLOR[s]])}
        />
        <ul className="text-sm grid grid-cols-2 gap-2">
          {SUBJECTS.map(s => {
            const c = SUBJECT_TO_COLOR[s];
            const cls = COLOR_CLS[c];
            return (
              <li key={s} className={`p-2 rounded ring-1 ${cls.bg} ${cls.text} ${cls.ring} flex items-center justify-between`}>
                <span className="flex items-center gap-2">
                  <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: SKILL_HEX[c] }} />
                  {SUBJECT_LABEL[s]}
                </span>
                <b>{stat.subAtk[s] ?? 0}</b>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  )
}

function EquipRow({ slot, items, player, onChange }:{
  slot:'Weapon'|'Armor'|'Accessory', items:Record<string,ItemDef>, player:PlayerState, onChange:()=>void
}){
  const equippedId = (player as any)?.equipment?.[slot] as string | undefined
  const equipped = equippedId ? items[equippedId] : undefined
  const bagKeys = Object.keys((player as any)?.bag || {});
  const options = bagKeys
    .map(id => items[id])
    .filter((it): it is ItemDef => !!it && it.slot === slot)

  return (
    <div
