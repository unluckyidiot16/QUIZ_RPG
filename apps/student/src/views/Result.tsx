import { Link } from 'react-router-dom';
import { ensureRunToken, finishDungeon, type RunSummary } from '../api';
import { initQueue, enqueue } from '../lib/queue';

initQueue(finishDungeon); // 앱 최초 1회만 실행되도록 옮겨도 OK

export default function Result(){
  const dataRaw = localStorage.getItem('qd:lastResult');
  const data = dataRaw ? JSON.parse(dataRaw) : null;

  async function submit() {
    if (!data) return;
    const runToken = await ensureRunToken();
    const summary: RunSummary = { ...data, runToken };
    try {
      await finishDungeon(summary);
      alert('제출 완료');
    } catch {
      enqueue(summary); // 오프라인/에러 → 큐에 적재, 백그라운드 재시도
      alert('오프라인/오류: 네트워크 복구 시 자동 재시도합니다.');
    }
  }

  return (
    <div className="p-6 max-w-xl mx-auto">
      <h2 className="text-2xl font-bold">결과</h2>
      {data ? (
        <div className="mt-4 p-4 bg-slate-800 rounded">
          <div>클리어: {data.cleared ? '성공' : '실패'}</div>
          <div>턴 수: {data.turns}</div>
          <div>소요 시간(초): {data.durationSec}</div>
          <button className="mt-4" onClick={submit}>제출</button>
        </div>
      ) : <div className="mt-4">기록이 없어요.</div>}
      <div className="mt-6 flex gap-3">
        <Link className="px-4 py-2 bg-emerald-600 rounded" to="/play">다시하기</Link>
        <Link className="px-4 py-2 bg-slate-700 rounded" to="/">메인</Link>
      </div>
    </div>
  );
}
