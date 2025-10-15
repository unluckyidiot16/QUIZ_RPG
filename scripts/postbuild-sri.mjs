
import { readFile, writeFile } from 'fs/promises';
import { join, resolve } from 'path';

const DIST = process.env.DIST_DIR ? resolve(process.cwd(), process.env.DIST_DIR) : resolve(process.cwd(), 'apps/student/dist');
const INDEX = join(DIST, 'index.html');
const MF = join(DIST, 'manifest.json');

const CSP = [
  "default-src 'self'",
  "img-src 'self' data: blob:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self'",
  "connect-src 'self' https://*.supabase.co",
  "worker-src 'self'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'"
].join('; ');

function parseAttrs(tag) {
  const attrs = {};
  for (const m of tag.matchAll(/\s([a-zA-Z:-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
    const [, k, v1, v2, v3] = m;
    attrs[k] = v1 ?? v2 ?? v3 ?? '';
  }
  return attrs;
}
function serializeTag(name, attrs, selfClose=false){
  const parts = [name];
  for (const [k,v] of Object.entries(attrs)) {
    if (v === '' && k !== 'crossorigin') continue;
    parts.push(`${k}="${String(v).replace(/"/g,'&quot;')}"`);
  }
  return `<${parts.join(' ')}${selfClose ? ' />' : '>'}`;
}
function ensureCspMeta(html){
  const meta = `<meta http-equiv="Content-Security-Policy" content="${CSP}">`;
  if (html.includes('http-equiv="Content-Security-Policy"'))
    return html.replace(/<meta[^>]+http-equiv="Content-Security-Policy"[^>]*>/i, meta);
  return html.replace(/<head([^>]*)>/i, `<head$1>\n    ${meta}`);
}
function loadMap(json){
  const map = new Map();
  const arr = json.files || json;
  for (const r of arr) map.set(r.path.replace(/^\//,''), r.sha256);
  return map;
}
function pickIntegrity(src, map){
  return [...map.keys()].reduce((acc,k)=> src.endsWith(k) ? map.get(k) : acc, null);
}

let html = await readFile(INDEX, 'utf8');
const mf = JSON.parse(await readFile(MF, 'utf8'));
const imap = loadMap(mf);

// <script src="...">
html = html.replace(/<script\b[^>]*src=["']([^"']+)["'][^>]*><\/script>/g, (m, src) => {
  const attrs = parseAttrs(m);
  const sri = pickIntegrity(src, imap);
  if (sri) { attrs.integrity = sri; attrs.crossorigin = 'anonymous'; }
  return `${serializeTag('script', attrs)}</script>`;
});
// <link rel="stylesheet" href="...">
html = html.replace(/<link\b([^>]*rel=["']stylesheet["'][^>]*)>/g, (m, inside) => {
  const tag = `<link ${inside}>`;
  const attrs = parseAttrs(tag);
  const sri = pickIntegrity(attrs.href || '', imap);
  if (sri) { attrs.integrity = sri; attrs.crossorigin = 'anonymous'; }
  return serializeTag('link', attrs, true);
});
// modulepreload
html = html.replace(/<link\b([^>]*rel=["']modulepreload["'][^>]*)>/g, (m, inside) => {
  const tag = `<link ${inside}>`;
  const attrs = parseAttrs(tag);
  const sri = pickIntegrity(attrs.href || '', imap);
  if (sri) { attrs.integrity = sri; attrs.crossorigin = 'anonymous'; }
  return serializeTag('link', attrs, true);
});

// CSP meta
html = ensureCspMeta(html);
await writeFile(INDEX, html, 'utf8');
console.log('[sri] integrity + CSP injected → index.html');
