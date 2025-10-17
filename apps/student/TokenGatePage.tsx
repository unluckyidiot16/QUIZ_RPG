// student/TokenGatePage.tsx
import React from 'react';
import { bootstrapFromToken } from './useConsumeToken';

export default function TokenGatePage() {
  const [state, setState] = React.useState<{loading:boolean, gate:string, message:string}>({loading:true, gate:'', message:''});

  React.useEffect(() => {
    (async () => {
      const res = await bootstrapFromToken();
      if (res.gate !== 'ok') {
        setState({loading:false, gate:res.gate, message:res.message});
      } else {
        // OK → 홈/대시보드로 라우팅
        location.replace('/home');
      }
    })();
  }, []);

  if (state.loading) return <div className="p-6">접속 확인 중…</div>;
  if (state.gate === 'maintenance') return <Banner title="서버 점검 중" desc={state.message} />;
  if (state.gate === 'blocked') return <Banner title="접속 차단" desc={state.message} />;
  if (state.gate === 'out_of_window') return <Banner title="접속 가능 시간이 아닙니다" desc={state.message} />;
  return <Banner title="알 수 없는 상태" desc="관리자에게 문의하세요." />;
}

function Banner({title, desc}:{title:string; desc:string}) {
  return (
    <div className="m-6 rounded-xl border p-5 bg-yellow-50">
      <h2 className="font-bold text-lg">{title}</h2>
      <p className="text-sm mt-1">{desc}</p>
      <a className="underline mt-3 inline-block" href="/">메인으로</a>
    </div>
  );
}
