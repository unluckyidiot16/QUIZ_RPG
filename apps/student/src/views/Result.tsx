
import { Link } from 'react-router-dom';

export default function Result(){
  const dataRaw = localStorage.getItem('qd:lastResult');
  const data = dataRaw ? JSON.parse(dataRaw) : null;
  return (
    <div className="p-6 max-w-xl mx-auto">
      <h2 className="text-2xl font-bold">결과</h2>
      {data ? (
        <div className="mt-4 p-4 bg-slate-800 rounded">
          <div>클리어: {data.cleared ? '성공' : '실패'}</div>
          <div>턴 수: {data.turns}</div>
          <div>소요 시간(초): {data.durationSec}</div>
        </div>
      ) : <div className="mt-4">기록이 없어요.</div>}
      <div className="mt-6 flex gap-3">
        <Link className="px-4 py-2 bg-emerald-600 rounded" to="/play">다시하기</Link>
        <Link className="px-4 py-2 bg-slate-700 rounded" to="/">메인</Link>
      </div>
    </div>
  );
}
