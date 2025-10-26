import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { loadPlayer, loadItemDB, deriveBattleStats, PlayerOps, needXP, type PlayerState, type ItemDef } from '../core/player'
import { SUBJECT_TO_COLOR, SKILL_HEX, COLOR_CLS } from '../game/combat/affinity'
import { SUBJECTS, SUBJECT_LABEL, type Subject } from '../core/char.types';
import { grantSubjectXp, totalLevel } from '../core/player';


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
  const levels = (player as any)?.base?.subLevels || {};
  const Lsum = totalLevel(levels);

  const addXp = async (s: Subject, v: number) => {
    setBusy(true);
    const p = loadPlayer();
    grantSubjectXp(p, s, v);
    (PlayerOps as any)?.save?.(p);
    setPlayer(loadPlayer());
    setBusy(false);
  };

  return (
    <div className="mt-3 p-3 rounded bg-slate-800/60">
      <div className="flex items-center justify-between">
        <div className="font-semibold">Overall Lv. {Lsum}</div>
        <div className="text-sm opacity-80">과목별 레벨/경험치</div>
      </div>

      <ul className="mt-3 space-y-2">
        {SUBJECTS.map((s)=> {
          const lv = levels[s]?.lv ?? 0;
          const xp = levels[s]?.xp ?? 0;
          const need = needXP(lv);
          const pct = Math.round((xp/need)*100);
          return (
            <li key={s} className="flex items-center gap-3">
              <div className="w-16 text-sm opacity-80">{SUBJECT_LABEL[s]}</div>
              <div className="flex-1">
                <div className="h-2 bg-slate-700 rounded overflow-hidden">
                  <div className="h-full rounded bg-emerald-500" style={{ width: `${pct}%` }} />
                </div>
                <div className="text-xs opacity-70 mt-0.5">Lv {lv} · XP {xp}/{need}</div>
              </div>
              <div className="flex gap-1">
                <button disabled={busy} onClick={()=>addXp(s, 1)}  className="px-2 py-1 rounded bg-slate-700 text-xs">+1</button>
                <button disabled={busy} onClick={()=>addXp(s, 10)} className="px-2 py-1 rounded bg-slate-700 text-xs">+10</button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SubjectBlock({ stat }:{ stat: { subAtk: Record<string, number> } & { hp:number, def:number } }){
  return (
    <div className="mt-4 p-3 rounded bg-slate-800/60">
      <div className="font-semibold mb-2">과목별 공격력</div>
      <div className="grid grid-cols-2 gap-4 items-center">
        <Radar6
          values={SUBJECTS.map(s=> stat.subAtk[s] ?? 0)}
          labels={SUBJECTS.map(s=> SUBJECT_LABEL[s])}
          colors={SUBJECTS.map((s: Subject)=> SKILL_HEX[SUBJECT_TO_COLOR[s]])}
        />
        <ul className="text-sm grid grid-cols-2 gap-2">
          {SUBJECTS.map((s: Subject) => {
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
    <div className="mt-2">
      <div className="text-sm opacity-80 mb-1">{slot}</div>
      <div className="flex items-center gap-2">
        <div className="flex-1 p-2 rounded bg-slate-900">
          {equipped ? (
            <div className="flex items-center justify-between">
              <div><b>{equipped.name}</b> <span className="text-xs opacity-70">[{equipped.rarity}]</span></div>
              <div className="text-xs opacity-80">{fmtStats(equipped)}</div>
            </div>
          ) : (<span className="opacity-50">미장착</span>)}
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
      const LABEL: Record<string, string> = SUBJECT_LABEL as any;
      arr.push(entries.map(([k,v])=> `${LABEL[k] ?? k} +${v}`).join(' · '))
    }
  }
  return arr.join(' · ')
}

function Radar6({ values, labels, colors }:{ values:number[]; labels:string[]; colors?: string[] }){
  const max = Math.max(1, ...values);
  const norm = values.map(v=> v/max);
  const angles = [...Array(6)].map((_,i)=> (-90 + i*60) * Math.PI/180);
  const center = 60, R = 50;
  const pts = norm.map((t,i)=> {
    const r = R * t;
    const x = center + r * Math.cos(angles[i]);
    const y = center + r * Math.sin(angles[i]);
    return `${x},${y}`;
  }).join(' ');
  const ring = (p:number)=> [...Array(6)].map((_,i)=>{
    const r = R * p;
    const x = center + r * Math.cos(angles[i]);
    const y = center + r * Math.sin(angles[i]);
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={140} height={140} viewBox="0 0 120 120" className="mx-auto">
      {[0.33,0.66,1].map((p,idx)=> (
        <polygon key={idx} points={ring(p)} fill="none" stroke="currentColor" opacity="0.2" />
      ))}
      {angles.map((a,i)=> {
        const stroke = colors?.[i] ?? 'currentColor';
        return <line key={i} x1={center} y1={center} x2={center+R*Math.cos(a)} y2={center+R*Math.sin(a)} stroke={stroke} opacity="0.6" />
      })}
      <polygon points={pts} fill="currentColor" opacity="0.3" />
      {angles.map((a,i)=> (
        <text key={i} x={center+(R+8)*Math.cos(a)} y={center+(R+8)*Math.sin(a)}
              textAnchor="middle" dominantBaseline="middle" fontSize="8"
              fill={colors?.[i] ?? 'currentColor'}>{labels[i]}</text>
      ))}
    </svg>
  )
}
