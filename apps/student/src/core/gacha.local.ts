// core/gacha.local.ts
import { GachaAwarder, GachaResult } from './gacha.port';
import { GachaPoolDef, InventoryDiff } from './items';
import { InventoryGateway } from './inventory.port';

export class ClientAwarder implements GachaAwarder {
  constructor(private inv: InventoryGateway) {}
  async open(pool:GachaPoolDef, count:number, opts?:{idempotencyKey?:string}): Promise<GachaResult> {
    const inv = await this.inv.load();
    const costCoin = pool.cost.coin ?? 0;
    const ticketId = pool.cost.ticketId;

    // 비용 체크
    if (ticketId){
      const have = inv.items[ticketId] ?? 0;
      if (have < count) throw new Error('티켓이 부족합니다.');
    } else {
      if (inv.coins < costCoin * count) throw new Error('코인이 부족합니다.');
    }

    // RNG (MVP: 간단, 추후 seed 교체 가능)
    const total = pool.entries.reduce((a,e)=>a+e.weight,0);
    const results:string[] = [];
    for (let i=0;i<count;i++){
      const r = Math.random() * total;
      let acc = 0, pick = pool.entries[0].cosmeticId;
      for (const e of pool.entries){ acc += e.weight; if (r <= acc){ pick = e.cosmeticId; break; } }
      results.push(pick);
    }

    // 인벤토리 반영은 포트로
    const diff: InventoryDiff = {
      idempotencyKey: opts?.idempotencyKey,
      coinDelta: ticketId ? 0 : -(costCoin*count),
      itemDelta: ticketId ? { [ticketId]: -count } : undefined,
      cosmeticsAdd: results,
      reason: `gacha:${pool.id}`
    };
    await this.inv.apply(diff);

    return { results, consumed: ticketId ? { ticketId, count } : { coin: costCoin*count } };
  }
}
