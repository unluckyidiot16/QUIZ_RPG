
import { createHash } from 'crypto';
import { readdir, readFile, writeFile } from 'fs/promises';
import { join, resolve } from 'path';

const DIST = process.env.DIST_DIR ? resolve(process.cwd(), process.env.DIST_DIR) : resolve(process.cwd(), 'apps/student/dist');
const GLOBS = /\.(js|css|html|svg|png|webp|json|woff2?)$/i;

async function listFiles(dir) {
  const out = [];
  const ents = await readdir(dir, { withFileTypes: true });
  for (const e of ents) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...await listFiles(p));
    else if (GLOBS.test(p)) out.push(p);
  }
  return out;
}

const files = await listFiles(DIST);
const records = [];
for (const f of files) {
  const buf = await readFile(f);
  const sha = createHash('sha256').update(buf).digest('base64');
  const rel = f.slice(DIST.length + 1).replaceAll('\\','/');
  records.push({ path: rel, sha256: `sha256-${sha}` });
}
await writeFile(join(DIST, 'manifest.json'), JSON.stringify({ files: records }, null, 2));
console.log(`[manifest] wrote ${records.length} entries → ${join(DIST,'manifest.json')}`);
