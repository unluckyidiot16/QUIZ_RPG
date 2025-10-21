// apps/student/src/components/RewardModal.tsx
export default function RewardModal({open, rewards, onClose, onEquip}:{open:boolean; rewards: Record<string,number>; onClose:()=>void; onEquip?:(id:string)=>void}){
  if (!open) return null;
  const entries = Object.entries(rewards);
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-slate-800 p-4 rounded-xl w-[360px]">
        <div className="text-lg font-semibold">획득 보상</div>
        <div className="mt-3 grid gap-2">
          {entries.map(([id,n])=>(
            <div key={id} className="flex items-center justify-between p-2 rounded bg-slate-900">
              <span>{id}</span>
              <div className="flex items-center gap-2">
                <span className="text-sm opacity-80">×{n}</span>
                {onEquip && n>0 && <button className="px-2 py-1 text-xs rounded bg-emerald-700" onClick={()=>onEquip(id)}>장착</button>}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 text-right">
          <button className="px-3 py-1 rounded bg-slate-700" onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  )
}
