import React from 'react';
import { bootstrapFromToken } from './useConsumeToken';

export default function TokenGatePage() {
  const [s, setS] = React.useState<{loading:boolean; gate:string; message:string}>({loading:true, gate:'', message:''});

  React.useEffect(() => {
    (async () => {
      const res = await bootstrapFromToken();
      if (res.gate === 'ok') {
        location.replace('/home');
      } else {
        setS({ loading:false, gate:res.gate, message:res.message });
      }
    })();
  }, []);

  if (s.loading) return <div className="p-6">접속 확인 중…</div>;

  const title =
    s.gate === 'maintenance' ? '서버 점검 중' :
      s.gate === 'blocked' ? '접속 차단됨' :
        s.gate === 'out_of_window' ? '접속 가능 시간이 아님' :
          '알 수 없는 상태';

  return (
    <div className="m-6 rounded-xl border p-5 bg-yellow-50">
      <h2 className="font-bold text-lg">{title}</h2>
      <p className="text-sm mt-1">{s.message || '관리자에게 문의하세요.'}</p>
      <div className="mt-3 flex gap-3">
        <a className="underline" href="/">메인으로</a>
        <button className="underline" onClick={()=>location.reload()}>다시 시도</button>
      </div>
    </div>
  );
}
