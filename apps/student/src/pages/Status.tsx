import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { loadPlayer, levelFromXp, loadItemDB, deriveBattleStats, PlayerOps, type PlayerState, type ItemDef } from '../core/player'
import { SUBJECTS, SUBJECT_LABEL } from '../core/char.types'
import { SUBJECT_TO_COLOR, SKILL_HEX, COLOR_CLS } from '../game/combat/affinity'


export default function Status(){
  const [player, setPlayer] = useState<PlayerState|null>(null)
  const [items, setItems] = useState<Record<string, ItemDef>>({})
  const [busy, setBusy] = useState(false)

  useEffect(()=>{ setPlayer(loadPlayer()); loadItemDB('/packs/items.v1.json').then(setItems) }, [])
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

      {/* 전투 스탯 요약 */}
      <div className="mt-4 p-3 rounded bg-slate-800/60">
        <div className="font-semibold mb-2">전투 스탯 (기본 + 장비)</div>
        <ul className="grid grid-cols-2 gap-2 text-center">
          <li className="p-2 rounded bg-slate-900">HP<br/><b>{stat.hp}</b></li>
          <li className="p-2 rounded bg-slate-900">DEF<br/><b>{stat.def}</b></li>
        </ul>
      </div>

      {/* 과목별 공격력 + 레이더 */}
      <div className="mt-4 p-3 rounded bg-slate-800/60">
        <div className="font-semibold mb-2">과목별 공격력</div>
        <div className="grid grid-cols-2 gap-4 items-center">
          <Radar6
            values={SUBJECTS.map(s=> stat.subAtk[s])}
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
                  <b>{stat.subAtk[s]}</b>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* 장비 */}
      <div className="mt-4 p-3 rounded bg-slate-800/60">
        <div className="font-semibold mb-2">장비</div>
        <EquipRow slot="Weapon" items={items} player={player} onChange={()=>setPlayer(loadPlayer())} />
        <EquipRow slot="Armor" items={items} player={player} onChange={()=>setPlayer(loadPlayer())} />
        <EquipRow slot="Accessory" items={items} player={player} onChange={()=>setPlayer(loadPlayer())} />
        <p className="text-xs opacity-70 mt-2">※ 가챠 코스튬은 외형 전용이며 스탯이 없습니다. 장비는 던전 보상으로만 획득합니다.</p>
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
  if (s.def) arr.push(`DEF +${s.def}`)
  if (s.hp) arr.push(`HP +${s.hp}`)
  if (s.subAtk){
    const entries = Object.entries(s.subAtk)
    if (entries.length){
      const LABEL: Record<string, string> = SUBJECT_LABEL as any; // TS index guard
      arr.push(entries.map(([k,v])=> `${LABEL[k] ?? k} +${v}`).join(' · '))
    }
  }
  return arr.join(' · ')
}
// ── 6각형 레이더 차트 (SVG, 라이브러리 불필요) ──
function Radar6({ values, labels, colors }:{ values:number[]; labels:string[]; colors?: string[] }){
  const max = Math.max(1, ...values)
  const norm = values.map(v=> v/max)
  const angles = [...Array(6)].map((_,i)=> (-90 + i*60) * Math.PI/180) // 위쪽부터 시계방향
  const center = 60, R = 50
  const pts = norm.map((t,i)=> {
    const r = R * t
    const x = center + r * Math.cos(angles[i])
    const y = center + r * Math.sin(angles[i])
    return `${x},${y}`
  }).join(' ')

  const ring = (p:number)=> [...Array(6)].map((_,i)=>{
    const r = R * p
    const x = center + r * Math.cos(angles[i])
    const y = center + r * Math.sin(angles[i])
    return `${x},${y}`
  }).join(' ')

  return (
    <svg width={140} height={140} viewBox="0 0 120 120" className="mx-auto">
      {/* 그리드 링 */}
      {[0.33,0.66,1].map((p,idx)=> (
        <polygon key={idx} points={ring(p)} fill="none" stroke="currentColor" opacity="0.2" />
      ))}
      {/* 축 */}
      {angles.map((a,i)=> {
        const stroke = colors?.[i] ?? 'currentColor';
        return <line key={i} x1={center} y1={center} x2={center+R*Math.cos(a)} y2={center+R*Math.sin(a)} stroke={stroke} opacity="0.6" />
      })}
      {/* 값 폴리곤 */}
      <polygon points={pts} fill="currentColor" opacity="0.3" />
      {/* 라벨 */}
      {angles.map((a,i)=> (
        <text key={i} x={center+(R+8)*Math.cos(a)} y={center+(R+8)*Math.sin(a)}
              textAnchor="middle" dominantBaseline="middle" fontSize="8"
              fill={colors?.[i] ?? 'currentColor'}>{labels[i]}</text>
      ))}
    </svg>
  )
}

