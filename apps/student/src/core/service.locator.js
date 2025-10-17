import { LocalInventoryGateway } from './inventory.local';
import { ClientAwarder } from './gacha.local';
export function makeServices() {
    // 미래 전환: VITE_INV_MODE === 'remote'면 원격 구현으로 교체
    const inv = new LocalInventoryGateway();
    const gacha = new ClientAwarder(inv);
    return { inv, gacha };
}
