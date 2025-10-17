// student/useConsumeToken.ts
import { supabase } from '@/core';

function readTokenId(): string | null {
  const m = location.pathname.match(/\/token\/([0-9a-f-]{36})/i);
  if (m) return m[1];
  const q = new URLSearchParams(location.search).get('token');
  return q;
}

export async function bootstrapFromToken() {
  const tokenId = readTokenId();
  if (!tokenId) return { consumed: false, gate: 'ok' as const, message: '' };

  // 기기 식별자(간단): UA|widthxheight (원하면 해시화)
  const fp = `${navigator.userAgent}|${screen.width}x${screen.height}`;

  const consume = await supabase.rpc('consume_qr_token', { p_token_id: tokenId, p_device_fp: fp });
  if (consume.error) {
    // 이미 사용/만료/무효 → 사용자 메시지
    return { consumed: false, gate: 'blocked' as const, message: consume.error.message };
  }

  const gate = await supabase.rpc('get_access_gate', {
    p_user_agent: navigator.userAgent,
    p_ip: null, // (선택) CF-Connecting-IP 같은 프록시 정보를 별도 경로로 전달 가능
  });
  if (gate.error) throw gate.error;

  const { gate: status, message } = gate.data as { gate: 'ok'|'blocked'|'maintenance'|'out_of_window'; message: string };
  return { consumed: true, gate: status, message };
}
