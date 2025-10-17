import { InventoryState, InventoryDiff } from './items';
export interface InventoryGateway {
    load(): Promise<InventoryState>;
    apply(diff: InventoryDiff): Promise<InventoryState>;
}
