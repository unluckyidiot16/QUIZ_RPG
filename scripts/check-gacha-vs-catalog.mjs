// scripts/check-gacha-vs-catalog.mjs
import fs from 'node:fs/promises';

const pool = JSON.parse(await fs.readFile('apps/student/public/packs/gacha_basic.json','utf8'));
const cat  = JSON.parse(await fs.readFile('apps/student/public/packs/wearables.v1.json','utf8'));
const map  = Array.isArray(cat) ? Object.fromEntries(cat.map(x=>[x.id,x])) : cat;

const ids = new Set();
for (const box of pool.boxes ?? []) {
  for (const it of box.items ?? []) ids.add(it.cosmeticId);
}
const missing = [...ids].filter(id => !map[id]);
if (missing.length) {
  console.error('[check] Missing in catalog:', missing);
  process.exit(1);
} else {
  console.log('[check] Pool ↔ Catalog OK');
}
