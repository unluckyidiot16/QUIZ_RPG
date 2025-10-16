// core/gacha.port.ts
import { GachaPoolDef } from './items';
export interface GachaResult { results: string[]; consumed: { coin?: number; ticketId?: string; count?: number }; }

export interface GachaAwarder {
  open(pool: GachaPoolDef, count: number, opts?: { idempotencyKey?: string }): Promise<GachaResult>;
}
