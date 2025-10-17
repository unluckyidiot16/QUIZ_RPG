import { InventoryGateway } from './inventory.port';
import { InventoryState, InventoryDiff } from './items';
export declare class LocalInventoryGateway implements InventoryGateway {
    load(): Promise<InventoryState>;
    apply(diff: InventoryDiff): Promise<InventoryState>;
}
