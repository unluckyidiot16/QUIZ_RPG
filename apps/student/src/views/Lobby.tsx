
import { Link } from 'react-router-dom';

export default function Lobby(){
  return (
    <div className="p-6 max-w-xl mx-auto">
      <h2 className="text-2xl font-bold">로비</h2>
      <p className="opacity-80 mt-2">지갑/가챠/공지 등은 여기서 확장합니다.</p>
      <div className="mt-6 flex gap-3">
        <Link className="px-4 py-2 bg-emerald-600 rounded" to="/play">던전 입장</Link>
        <Link className="px-4 py-2 bg-slate-700 rounded" to="/">메인</Link>
      </div>
    </div>
  );
}
