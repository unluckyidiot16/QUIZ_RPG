// apps/student/src/pages/Lobby.tsx (스테이지 섹션 추가용)
import { Link } from 'react-router-dom';
import { STAGES, type StageDef } from '../game/stage';
import { ENEMIES, subjectFromSprite } from '../core/enemy';
import { SUBJECT_TO_COLOR, SKILL_HEX } from '../core/affinity';

function stageList(): StageDef[] {
  return Object.values(STAGES);
}

export default function Lobby() {
  const stages = stageList();
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">로비</h1>
        <Link to="/" className="text-sm opacity-80 hover:opacity-100">메인</Link>
      </div>

      {/* 스테이지 선택 */}
      <h2 className="mt-6 mb-2 text-lg font-semibold">스테이지 선택</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {stages.map(st => {
          const enemy = Array.isArray(ENEMIES)
            ? ENEMIES.find(e => e.id === st.enemyId)
            : (ENEMIES as any)[st.enemyId];
          const ALL_SUBJECTS = ['KOR','ENG','MATH','SCI','SOC','HIST'] as const;
          type Subject = typeof ALL_SUBJECTS[number];
          const isSubject = (x: any): x is Subject => (ALL_SUBJECTS as readonly string[]).includes(x);
          // 2) subj를 명시적 Subject | undefined 로 확정
          const subj: Subject | undefined = isSubject(enemy?.subject)
            ? enemy!.subject
            : (enemy?.sprite ? subjectFromSprite(enemy.sprite) : undefined);
             // 3) color를 명시적 SkillColor 로 확정
          type SkillColor = 'blank'|'blue'|'dark'|'green'|'red'|'yellow';
           const color: SkillColor = subj ? SUBJECT_TO_COLOR[subj] : 'blank';
          return (
            <Link
              key={st.id}
              to={`/play?stage=${st.id}&enemy=${st.enemyId}${subj ? `&esubj=${subj}` : ''}`}
              className="
    block p-4 rounded-xl
    border border-white/10 bg-slate-900/60
    hover:border-white/20 hover:bg-slate-900/80
    transition shadow-sm
  "
            >
              <div className="flex items-center justify-between">
                <div className="text-base font-medium">{st.name}</div>
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full"
                  style={{ background: SKILL_HEX[color] }}
                />
              </div>
              <div className="mt-1 text-xs opacity-70">
                적: {enemy?.name ?? '???'} · 주과목: {subj ?? '—'}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
