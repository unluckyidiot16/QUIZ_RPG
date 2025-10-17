import { InventoryGateway } from './inventory.port';
import { GachaAwarder } from './gacha.port';
export declare function makeServices(): {
    inv: InventoryGateway;
    gacha: GachaAwarder;
};
