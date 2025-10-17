import { GachaAwarder, GachaResult } from './gacha.port';
import { GachaPoolDef } from './items';
import { InventoryGateway } from './inventory.port';
export declare class ClientAwarder implements GachaAwarder {
    private inv;
    constructor(inv: InventoryGateway);
    open(pool: GachaPoolDef, count: number, opts?: {
        idempotencyKey?: string;
    }): Promise<GachaResult>;
}
