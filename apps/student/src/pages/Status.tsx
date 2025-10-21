import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { loadPlayer, levelFromXp, loadItemDB, deriveBattleStats, PlayerOps, type PlayerState, type ItemDef } from '../core/player'

export default function Status(){
  const [player, setPlayer] = useState<PlayerState|null>(null)
  const [items, setItems] = useState<Record<string, ItemDef>>({})
  const [busy, setBusy] = useState(false)

  useEffect(()=>{ setPlayer(loadPlayer()); loadItemDB().then(setItems) }, [])
  if (!player) return <div className="p-6">로딩…</div>

  const lv = levelFromXp(player.totalXp)
  const stat = deriveBattleStats(items, player)

  return (
    <div className="p-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold">상태</h1>

      {/* 레벨/XP */}
      <div className="mt-3 p-3 rounded bg-slate-800/60">
        <div className="flex items-center justify-between">
          <div className="font-semibold">Lv. {lv.level}</div>
          <div className="text-sm opacity-80">XP {lv.curXp} / {lv.needXp}</div>
        </div>
        <div className="h-2 bg-slate-700 rounded mt-2 overflow-hidden">
          <div className="h-full rounded bg-emerald-500" style={{width: `${Math.round(lv.progress*100)}%`}} />
        </div>
        <div className="mt-2 flex gap-2">
          <button disabled={busy} onClick={async()=>{ setBusy(true); PlayerOps.grantXp(1); setPlayer(loadPlayer()); setBusy(false) }} className="px-3 py-1 rounded bg-emerald-600">+1 XP</button>
          <button disabled={busy} onClick={async()=>{ setBusy(true); PlayerOps.grantXp(10); setPlayer(loadPlayer()); setBusy(false) }} className="px-3 py-1 rounded bg-emerald-700">+10 XP</button>
        </div>
      </div>

      {/* 전투 스탯 */}
      <div className="mt-4 p-3 rounded bg-slate-800/60">
        <div className="font-semibold mb-2">전투 스탯 (기본 + 장비)</div>
        <ul className="grid grid-cols-3 gap-2 text-center">
          <li className="p-2 rounded bg-slate-900">HP<br/><b>{stat.hp}</b></li>
          <li className="p-2 rounded bg-slate-900">ATK<br/><b>{stat.atk}</b></li>
          <li className="p-2 rounded bg-slate-900">DEF<br/><b>{stat.def}</b></li>
        </ul>
      </div>

      {/* 장비 */}
      <div className="mt-4 p-3 rounded bg-slate-800/60">
        <div className="font-semibold mb-2">장비</div>
        <EquipRow slot="Weapon" items={items} player={player} onChange={()=>setPlayer(loadPlayer())} />
        <EquipRow slot="Armor" items={items} player={player} onChange={()=>setPlayer(loadPlayer())} />
        <EquipRow slot="Accessory" items={items} player={player} onChange={()=>setPlayer(loadPlayer())} />
      </div>

      <div className="mt-6 flex gap-2">
        <Link className="px-3 py-2 rounded bg-slate-700" to="/inventory">인벤토리</Link>
        <Link className="px-3 py-2 rounded bg-slate-700" to="/">메인</Link>
      </div>
    </div>
  )
}


function EquipRow({ slot, items, player, onChange }:{ slot:'Weapon'|'Armor'|'Accessory', items:Record<string,ItemDef>, player:PlayerState, onChange:()=>void }){
  const equippedId = player.equipment[slot]
  const equipped = equippedId ? items[equippedId] : undefined
  const options = Object.keys(player.bag)
    .map(id => items[id])
    .filter(it => it && it.slot === slot)

  return (
    <div className="mt-2">
      <div className="text-sm opacity-80 mb-1">{slot}</div>
      <div className="flex items-center gap-2">
        <div className="flex-1 p-2 rounded bg-slate-900">
          {equipped ? (<div className="flex items-center justify-between">
            <div><b>{equipped.name}</b> <span className="text-xs opacity-70">[{equipped.rarity}]</span></div>
            <div className="text-xs opacity-80">{fmtStats(equipped)}</div>
          </div>) : (<span className="opacity-50">미장착</span>)}
        </div>
        <select className="px-2 py-1 rounded bg-slate-900" value={equippedId ?? ''} onChange={e=>{ const v = e.target.value || undefined; PlayerOps.equip(slot, v); onChange() }}>
          <option value="">— 선택 —</option>
          {options.map(it=> (
            <option key={it.id} value={it.id}>{it.name}</option>
          ))}
        </select>
        {equippedId && <button className="px-2 py-1 rounded bg-slate-700" onClick={()=>{ PlayerOps.equip(slot, undefined); onChange() }}>해제</button>}
      </div>
    </div>
  )
}

function fmtStats(it: ItemDef){
  const s = it.stats ?? {}
  const arr: string[] = []
  if (s.atk) arr.push(`ATK +${s.atk}`)
  if (s.def) arr.push(`DEF +${s.def}`)
  if (s.hp) arr.push(`HP +${s.hp}`)
  return arr.join(' · ')
}

