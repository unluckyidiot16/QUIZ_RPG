// teacher/qrIssue.ts
import { supabase } from '@/core'; // 기존 인스턴스 사용
import QRCode from 'qrcode';

export async function issueTokens({
                                    classId,
                                    count,
                                    expiresAt,     // Date | string
                                    note,
                                  }: { classId?: string; count: number; expiresAt: string | Date; note?: string; }) {
  const { data, error } = await supabase.rpc('issue_qr_tokens', {
    p_class_id: classId ?? null,
    p_count: count,
    p_expires_at: typeof expiresAt === 'string' ? expiresAt : (expiresAt as Date).toISOString(),
    p_note: note ?? null,
  });
  if (error) throw error;
  return data as { id: string, batch_id: string, expires_at: string }[];
}

export async function makeQrCanvas(tokenId: string, canvas: HTMLCanvasElement) {
  const url = `${location.origin}/token/${tokenId}`; // 또는 ?token=...
  await QRCode.toCanvas(canvas, url, { width: 256, errorCorrectionLevel: 'M' });
  return url;
}
