// core/inventory.local.ts
import { InventoryGateway } from './inventory.port';
import { InventoryState, InventoryDiff } from './items';

const K = 'qrpg_inventory_v1';
const def: InventoryState = { coins:0, items:{}, cosmeticsOwned:{}, equipped:{}, version:1 };

function loadLocal(): InventoryState {
  try { return { ...def, ...JSON.parse(localStorage.getItem(K) ?? 'null') }; }
  catch { return { ...def }; }
}
function saveLocal(s:InventoryState){ localStorage.setItem(K, JSON.stringify(s)); }

export class LocalInventoryGateway implements InventoryGateway {
  async load(){ return loadLocal(); }
  async apply(diff: InventoryDiff){
    const s = loadLocal();
    if (diff.coinDelta) s.coins = Math.max(0, s.coins + diff.coinDelta);
    if (diff.itemDelta){
      for (const [id, d] of Object.entries(diff.itemDelta)) {
        s.items[id] = Math.max(0, (s.items[id] ?? 0) + d);
        if (s.items[id] === 0) delete s.items[id];
      }
    }
    if (diff.cosmeticsAdd) diff.cosmeticsAdd.forEach(id => s.cosmeticsOwned[id]=true);
    if (diff.equip) s.equipped = { ...s.equipped, ...diff.equip };
    saveLocal(s);
    return s;
  }
}
