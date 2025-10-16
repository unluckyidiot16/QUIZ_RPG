// core/inventory.port.ts
import { InventoryState, InventoryDiff } from './items';

export interface InventoryGateway {
  load(): Promise<InventoryState>;
  apply(diff: InventoryDiff): Promise<InventoryState>;  // ★ merge(증감/장착) 단일 엔드포인트
}
