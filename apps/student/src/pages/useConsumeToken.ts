import { sb } from '../core/sb';

function readTokenId(): string | null {
  const m = location.pathname.match(/\/token\/([0-9a-f-]{36})/i);
  if (m) return m[1];
  const q = new URLSearchParams(location.search).get('token');
  return q;
}

function firstRow<T = any>(data: any): T | null {
  if (!data) return null;
  return Array.isArray(data) ? (data[0] ?? null) : data;
}

export async function bootstrapFromToken() {
  try {
    const tokenId = readTokenId();
    if (!tokenId) {
      return { consumed:false, gate:'ok' as const, message:'', userId:null as string|null };
    }

    const fp = `${navigator.userAgent}|${screen.width}x${screen.height}`;

    // 1) 토큰 소비
    const consume = await sb.rpc('consume_qr_token', { p_token_id: tokenId, p_device_fp: fp });
    if (consume.error) {
      return {
        consumed:false,
        gate:'blocked' as const,
        message: consume.error.message || '토큰 소비 실패',
        userId:null
      };
    }
    const cRow = firstRow<{ ok:boolean; user_id:string }>(consume.data);
    const userId = cRow?.user_id;
    if (!userId) {
      return { consumed:false, gate:'blocked' as const, message:'user_id 응답 없음', userId:null };
    }
    localStorage.setItem('student_user_id', userId);

    // 2) 게이트 확인
    const gate = await sb.rpc('get_access_gate_simple', { p_user_id: userId });

    if (gate.error) {
      return {
        consumed:true,
        gate:'blocked' as const,
        message: gate.error.message || '접속 확인 실패',
        userId
      };
    }
    const gRow = firstRow<{ gate:'ok'|'blocked'|'maintenance'|'out_of_window'; message:string }>(gate.data);
    const status = gRow?.gate ?? 'blocked';
    const message = gRow?.message ?? '';
    return { consumed:true, gate:status, message, userId };
  } catch (e:any) {
    return { consumed:false, gate:'blocked' as const, message: e?.message ?? '네트워크 오류', userId:null };
  }
}
