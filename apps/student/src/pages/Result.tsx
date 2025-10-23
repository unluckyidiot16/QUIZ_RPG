// apps/student/src/pages/Result.tsx
import { useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { newRunToken, resetLocalRunState, ensureRunToken, finishDungeon, type RunSummary } from '../api';
import { initQueue, enqueue } from '../shared/lib/queue';
import RewardModal from '../shared/assets/RewardModal';
import { loadPlayer, PlayerOps, loadItemDB, type ItemDef } from '../core/player';
import { appPath, staticURL } from '../shared/lib/urls';

type Resp = { ok: true; idempotent: boolean } | null;
import * as api from '../api';

export default function Result() {
  const nav = useNavigate();

// 컴포넌트 내부 state
  const [rewardOpen, setRewardOpen] = useState(false);
  const [rewardBag, setRewardBag] = useState<Record<string, number>>({});
  const [items, setItems] = useState<Record<string, ItemDef>>({});
  
  
  // 오프라인 재시도 큐 가동
  useEffect(() => { initQueue(finishDungeon); }, []);

  // 아이템 DB 1회 로드
  useEffect(() => {
    (async () => {
      const db = await loadItemDB('/packs/items.v1.json');
      setItems(db);
    })();
  }, []);

// 결과 진입 시 보상 읽기
  useEffect(() => {
    const raw = localStorage.getItem('qd:lastRewards');
    if (raw) {
      try {
        const bag = JSON.parse(raw) as Record<string, number>;
        if (bag && Object.keys(bag).length) {
          setRewardBag(bag);
          setRewardOpen(true);
          localStorage.removeItem('qd:lastRewards'); // 한 번 보여줬으면 비움
        }
      } catch {}
    }
  }, []);

  useEffect(() => {
    const K = 'qd:pendingReceipts';
    const arr: any[] = JSON.parse(localStorage.getItem(K) || '[]');
    if (!arr.length) return;
    (async () => {
      const fn = (api as any)?.applyReceipt;
      const stay: any[] = [];
      for (const rec of arr) {
        try { if (typeof fn === 'function') await fn(rec); else stay.push(rec); }
        catch { stay.push(rec); }
      }
      localStorage.setItem(K, JSON.stringify(stay));
    })();
    }, []);

  const handleEquip = async (id: string) => {
    // 1) items DB가 아직 로드 안된 상태(레이스) 대비
    let it = items[id];
    if (!it) {
      const db = await loadItemDB('/packs/items.v1.json');
      setItems(db);
      it = db[id];
    }
    if (!it || !it.slot) { setRewardOpen(false); return; } // 안전 종료(원하면 토스트)

    const p = loadPlayer();
    if ((p.bag?.[id] ?? 0) <= 0) {
      PlayerOps.grantItem(id, 1);       // 가방에 최소 1개 보장
    }
    PlayerOps.equip(it.slot as any, id); // 슬롯 기준 장착
    setRewardOpen(false);                // ✅ 장착 후 모달 닫기
  };

  // ✅ shared/assets/RewardModal 이 전역 함수를 찾는 경우를 대비한 브리지
  (globalThis as any).handleEquip = handleEquip;
  (globalThis as any).closeRewardModal = () => setRewardOpen(false);
  
  async function restart() {
    await newRunToken();
    resetLocalRunState();
    nav(appPath('/play'), { replace: true });
  }

  function goHome() {
    resetLocalRunState();
    nav(appPath('/'), { replace: true });
  }

  // 저장된 결과 읽기 — 객체/배열 모두 허용
  const raw = localStorage.getItem('qd:lastResult');
  const parsed: any = useMemo(() => (raw ? JSON.parse(raw) : null), [raw]);

  // 호환: 배열(턴 로그)로 저장된 옛 포맷도 요약으로 변환
  const data: Omit<RunSummary, 'runToken' | 'finalHash'> | null = useMemo(() => {
    if (!parsed) return null;
    if (Array.isArray(parsed)) {
      const turns = parsed;
      const total = turns.length || 0;
      const correct = turns.filter((t: any) => t?.correct).length;
      const cleared = correct >= Math.ceil(Math.max(1, total) * 0.6);
      const durationSec = Number(localStorage.getItem('qd:lastDurationSec') || '0') || 0;
      return { cleared, turns: total, durationSec };
    }
    // 객체 포맷
    const { cleared, turns, durationSec } = parsed;
    if (typeof turns === 'number') {
      return {
        cleared: Boolean(cleared),
        turns: Math.max(0, turns|0),
        durationSec: Math.max(0, Number(durationSec) || 0),
      };
    }
    return null;
  }, [parsed]);

  const [resp, setResp] = useState<Resp>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!data || submitting) return;
    setSubmitting(true);
    let runToken: string;
    try {
      runToken = await ensureRunToken();
    } catch (e) {
      console.error('enter_dungeon failed', e);
      setSubmitting(false);
      alert('던전 입장 토큰 발급 실패: 서버 연결을 확인해주세요.');
      return;
    }

    const summary: RunSummary = { ...data, runToken, finalHash: '' };
    try {
      const r = await finishDungeon(summary);
      setResp(r);
    } catch (e) {
      enqueue(summary);
      console.error('finish_dungeon failed', e);
      alert('오프라인/오류: 네트워크 복구 시 자동 재시도합니다.');
    } finally {
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
    const summary: RunSummary = { ...data, runToken, finalHash: '' };
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

        {resp && (
          <div className={`mt-2 inline-flex items-center gap-2 px-2 py-1 rounded text-sm ${
            resp.idempotent ? 'bg-slate-700' : 'bg-emerald-700'
          }`}>
            <span className="font-semibold">
              {resp.idempotent ? '이미 제출됨(멱등 처리)' : '제출 완료'}
            </span>
            <span className="opacity-80">idempotent=<b>{String(resp.idempotent)}</b></span>
          </div>
        )}
      </div>
      <RewardModal
        open={rewardOpen}
        rewards={rewardBag}
        onClose={() => setRewardOpen(false)}
        onEquip={handleEquip}
      />
      <div className="mt-6 flex gap-3">
        <button className="px-4 py-2 bg-emerald-600 rounded" onClick={restart}>다시하기</button>
        <button className="px-4 py-2 bg-slate-700 rounded" onClick={goHome}>메인</button>
      </div>
    </div>
  );
}
