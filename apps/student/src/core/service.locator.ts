// core/service.locator.ts
import { InventoryGateway } from './inventory.port';
import { LocalInventoryGateway } from './inventory.local';
import { GachaAwarder } from './gacha.port';
import { ClientAwarder } from './gacha.local';

export function makeServices(){
  // 미래 전환: VITE_INV_MODE === 'remote'면 원격 구현으로 교체
  const inv: InventoryGateway = new LocalInventoryGateway();
  const gacha: GachaAwarder = new ClientAwarder(inv);
  return { inv, gacha };
}
