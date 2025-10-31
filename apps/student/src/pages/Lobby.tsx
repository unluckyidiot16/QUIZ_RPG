// apps/student/src/pages/Lobby.tsx (스테이지 섹션 추가용)
import { Link } from 'react-router-dom';
import React, { useEffect, useMemo, useState } from 'react';
import { loadStageDB, type StageJson } from '../game/stage.loader'; // ← 경로 확인
import { SKILL_HEX, SUBJECT_TO_COLOR } from '../core/affinity'; // (선택) 과목색 쓰고 싶을 때



type Difficulty = 'EASY'|'NORMAL'|'HARD';

export default function Lobby() {
  const [db, setDb] = useState<Record<string, StageJson> | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [globalDiff, setGlobalDiff] = useState<Difficulty | ''>(''); // 전체 적용 난이도(선택)

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const d = await loadStageDB(); // /packs/stages.v1.json 로드
        if (alive) setDb(d);
      } catch (e: any) {
        if (alive) setErr(e?.message || 'stage db load failed');
      }
    })();
    return () => { alive = false; };
  }, []);

  const stages = useMemo(() => db ? Object.values(db) : [], [db]);

  if (err) {
    return (
      <div className="p-4 text-red-400">
        스테이지 데이터를 불러오지 못했습니다: {err}
      </div>
    );
  }

  if (!db) {
    // 로딩 스켈레톤
    return (
      <div className="p-4">
        <div className="mb-3 h-6 w-40 bg-white/10 rounded" />
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-white/5 border border-white/10 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* (선택) 로비 상단 전체 난이도 셀렉터 */}
      <div className="flex items-center gap-2">
        <span className="text-sm opacity-70">난이도:</span>
        <select
          value={globalDiff}
          onChange={(e) => setGlobalDiff(e.target.value as Difficulty | '')}
          className="px-2 py-1 rounded bg-slate-900/70 border border-white/10"
        >
          <option value="">(스테이지 기본값)</option>
          <option value="EASY">EASY</option>
          <option value="NORMAL">NORMAL</option>
          <option value="HARD">HARD</option>
        </select>
      </div>

      {/* 스테이지 카드 그리드 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {stages.map((st) => {
          const diff = (globalDiff || st.defaultDifficulty || 'NORMAL') as Difficulty;
          return (
            <Link
              key={st.id}
              to={`/play?stage=${st.id}&diff=${diff}`} // enemy 파라미터 없이도 Play.tsx에서 고정 스폰
              className="
                block p-4 rounded-xl
                border border-white/10 bg-slate-900/60
                hover:border-white/20 hover:bg-slate-900/80
                transition shadow-sm
              "
            >
              <div className="flex items-center justify-between">
                <div className="text-base font-semibold">{st.name}</div>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 border border-white/10">
                  {diff}
                </span>
              </div>

              <div className="mt-1 text-xs opacity-80">
                ID: {st.id} · Pack: {st.packId}
              </div>

              {/* 과목 풀 뱃지 */}
              {st.subjectPool?.length ? (
                <div className="mt-2 flex flex-wrap gap-1">
                  {st.subjectPool.slice(0, 6).map((s) => (
                    <span
                      key={s}
                      className="text-[10px] px-1.5 py-0.5 rounded border border-white/10 bg-white/5"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="mt-2 text-xs opacity-60">과목 풀: 기본(전체)</div>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
