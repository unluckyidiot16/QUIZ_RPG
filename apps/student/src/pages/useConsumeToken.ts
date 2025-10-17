import { sb } from '../core/sb';

function readTokenId(): string | null {
  const m = location.pathname.match(/\/token\/([0-9a-f-]{36})/i);
  if (m) return m[1];
  const q = new URLSearchParams(location.search).get('token');
  return q;
}

export async function bootstrapFromToken() {
  const tokenId = readTokenId();
  if (!tokenId) return { consumed:false, gate:'ok' as const, message:'', userId:null as string|null };

  const fp = `${navigator.userAgent}|${screen.width}x${screen.height}`;
  const consume = await sb.rpc('consume_qr_token', { p_token_id: tokenId, p_device_fp: fp });
  if (consume.error) {
    return { consumed:false, gate:'blocked' as const, message: consume.error.message, userId:null };
  }
  const userId = (consume.data as { ok:boolean; user_id:string }).user_id;
  localStorage.setItem('student_user_id', userId);

  const gate = await sb.rpc('get_access_gate', {
    p_user_id: userId, p_user_agent: navigator.userAgent, p_ip: null
  });
  if (gate.error) throw gate.error;

  const { gate:status, message } = gate.data as { gate:'ok'|'blocked'|'maintenance'|'out_of_window'; message:string };
  return { consumed:true, gate:status, message, userId };
}
