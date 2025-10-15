
import { Link } from 'react-router-dom';

export default function Main(){
  return (
    <div className="p-6 max-w-xl mx-auto">
      <h1 className="text-3xl font-bold">오늘의 던전</h1>
      <p className="opacity-80 mt-2">퀴즈를 풀고 던전을 클리어하세요.</p>
      <div className="mt-6 grid gap-3 grid-cols-2">
        <Link className="text-center px-4 py-3 bg-emerald-600 rounded" to="/lobby">로비</Link>
        <Link className="text-center px-4 py-3 bg-indigo-600 rounded" to="/play">전투(퀴즈)</Link>
      </div>
      <p className="mt-6 text-sm opacity-70">팁: <code>?pack=sample</code> 쿼리로 샘플 팩을 불러올 수 있어요.</p>
    </div>
  );
}
