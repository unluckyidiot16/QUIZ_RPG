// apps/student/src/views/Result.tsx
import { useNavigate, Link } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { newRunToken, resetLocalRunState, ensureRunToken, finishDungeon, type RunSummary } from '../api';
import { initQueue, enqueue } from '../lib/queue';

type Resp = { ok: true; idempotent: boolean } | null;

export default function Result() {
  const nav = useNavigate();
  // 페이지 진입 시 오프라인 재시도 큐 가동
  useEffect(() => { initQueue(finishDungeon); }, []);

  async function restart() {
    // “다시하기”는 즉시 새 런 발급 후 전투 화면으로
    await newRunToken();
    resetLocalRunState();
    nav('/play', { replace: true });
  }

  function goHome() {
    // 메인으로만 돌아갈 땐 표시만 리셋 (새 런은 Play 입장 시 발급)
    resetLocalRunState();
    nav('/', { replace: true });
  }
  
  const dataRaw = localStorage.getItem('qd:lastResult');
  const data = useMemo(() => (dataRaw ? JSON.parse(dataRaw) : null) as
    | Omit<RunSummary, 'runToken'>
    | null, [dataRaw]);

  const [resp, setResp] = useState<Resp>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!data || submitting) return;
    setSubmitting(true);
    let runToken: string;
    try {
      // runToken 발급 (없으면 신규, 있으면 재사용)
      runToken = await ensureRunToken();
    } catch (e) {
      console.error('enter_dungeon failed', e);
      setSubmitting(false);
      alert('던전 입장 토큰 발급 실패: 서버 연결을 확인해주세요.');
      return;
    }

    const summary: RunSummary = { ...data, runToken };
    try {
      const r = await finishDungeon(summary);
      setResp(r);
    } catch (e) {
      // 오프라인/서버 오류 → 큐에 적재하여 백그라운드 재시도
      enqueue(summary);
      console.error('finish_dungeon failed', e);
      alert('오프라인/오류: 네트워크 복구 시 자동 재시도합니다.');
    } finally {
      // 중복 클릭 방지 타임가드(약간의 쿨다운)
      setTimeout(() => setSubmitting(false), 1200);
    }
  }

  async function resubmitSameToken() {
    if (!data || submitting) return;
    const runToken = localStorage.getItem('qd:runToken');
    if (!runToken) {
      alert('runToken이 없어 재제출을 할 수 없어요. 먼저 "제출"을 한 번 눌러주세요.');
      return;
    }
    setSubmitting(true);
    const summary: RunSummary = { ...data, runToken };
    try {
      const r = await finishDungeon(summary);
      setResp(r);
    } catch (e) {
      enqueue(summary);
      console.error('resubmit failed', e);
      alert('오프라인/오류: 네트워크 복구 시 자동 재시도합니다.');
    } finally {
      setTimeout(() => setSubmitting(false), 800);
    }
  }

  if (!data) return <div className="p-6">기록이 없어요.</div>;

  return (
    <div className="p-6 max-w-xl mx-auto space-y-4">
      <h2 className="text-2xl font-bold">결과</h2>

      <div className="p-4 bg-slate-800 rounded space-y-2">
        <div>클리어: {data.cleared ? '성공' : '실패'}</div>
        <div>턴 수: {data.turns}</div>
        <div>소요 시간(초): {data.durationSec}</div>

        <div className="pt-2 flex gap-2">
          <button
            disabled={submitting}
            onClick={submit}
            className={`px-3 py-2 rounded ${submitting ? 'opacity-50 cursor-not-allowed bg-slate-600' : 'bg-emerald-600 hover:bg-emerald-500'}`}
          >
            {submitting ? '처리 중…' : '제출'}
          </button>

          <button
            disabled={submitting}
            onClick={resubmitSameToken}
            className="px-3 py-2 rounded bg-slate-700 hover:bg-slate-600"
          >
            재제출 테스트
          </button>
        </div>

        {/* 서버 응답 표시(멱등 여부 시각화) */}
        {resp && (
          <div className={`mt-2 inline-flex items-center gap-2 px-2 py-1 rounded text-sm ${
            resp.idempotent ? 'bg-slate-700' : 'bg-emerald-700'
          }`}>
            <span className="font-semibold">
              {resp.idempotent ? '이미 제출됨(멱등 처리)' : '제출 완료'}
            </span>
            <span className="opacity-80">
              idempotent=<b>{String(resp.idempotent)}</b>
            </span>
          </div>
        )}
      </div>

      <div className="mt-6 flex gap-3">
        <button className="px-4 py-2 bg-emerald-600 rounded" onClick={restart}>다시하기</button>
        <button className="px-4 py-2 bg-slate-700 rounded" onClick={goHome}>메인</button>
      </div>
    </div>
  );
}
