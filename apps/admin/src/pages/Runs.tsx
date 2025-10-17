import { useEffect, useState } from 'react';
import { sb } from '../core/sb';

type Row = {
  run_id: string; user_id: string; nickname: string;
  cleared: boolean; turns: number; duration_sec: number;
  created_at: string; closed_at: string | null;
  coins: number | null; stars: number | null;
};

export default function Runs() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true); setErr(null);
    const { data, error } = await sb.rpc('admin_list_recent_runs', {
      p_limit: 50, p_only_open: false, p_only_closed: false, p_since: null
    });
    if (error) { setErr(error.message); setLoading(false); return; }
    setRows(data as Row[]); setLoading(false);
  }

  useEffect(() => { load(); }, []);

  if (loading) return <div className="p-4">로딩…</div>;
  if (err) return <div className="p-4 text-rose-400">오류: {err}</div>;

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-3">최근 런(최근 50)</h1>
      <div className="overflow-x-auto">
        <table className="min-w-[720px] text-sm">
          <thead className="text-left opacity-80">
          <tr>
            <th className="px-2 py-1">시간</th>
            <th className="px-2 py-1">유저</th>
            <th className="px-2 py-1">결과</th>
            <th className="px-2 py-1">턴</th>
            <th className="px-2 py-1">소요(초)</th>
            <th className="px-2 py-1">마감</th>
            <th className="px-2 py-1">지갑</th>
          </tr>
          </thead>
          <tbody>
          {rows.map(r => (
            <tr key={r.run_id} className="border-t border-slate-800">
              <td className="px-2 py-1">{new Date(r.created_at).toLocaleString()}</td>
              <td className="px-2 py-1">{r.nickname.slice(0,24)}<div className="opacity-60">{r.user_id.slice(0,8)}…</div></td>
              <td className="px-2 py-1">{r.cleared ? '성공' : '실패'}</td>
              <td className="px-2 py-1">{r.turns}</td>
              <td className="px-2 py-1">{r.duration_sec}</td>
              <td className="px-2 py-1">
                {r.closed_at ? '마감' : <span className="px-2 py-0.5 rounded bg-amber-700">진행중</span>}
              </td>
              <td className="px-2 py-1">{(r.coins ?? 0)}/{(r.stars ?? 0)}⭐</td>
            </tr>
          ))}
          </tbody>
        </table>
      </div>
      <button onClick={load} className="mt-3 px-3 py-2 rounded bg-slate-700">새로고침</button>
    </div>
  );
}
