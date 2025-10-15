
# QUIZ_RPG — Patch Set (2025-10-15)

This patch adds:
- Student/Admin Vite apps (React+TS+Tailwind for student, React+TS for admin)
- Netlify configs (root site for Student, nested site for Admin)
- SRI post-build tooling (manifest.json generator + integrity injector)
- A simple mock Question pack (packs/sample.json)
- A 30-tab launcher script for classroom rehearsal

## How to apply

1) Unzip at your repo root (same level as your root `package.json`).
   - This patch **won't overwrite** your root files automatically. Review/merge the snippets below.

2) Add/merge the following to your **root `package.json`** `scripts`:
```json
{
  "scripts": {
    "manifest": "DIST_DIR=apps/student/dist tsx scripts/build-manifest.mjs",
    "sri": "DIST_DIR=apps/student/dist tsx scripts/postbuild-sri.mjs",
    "manifest:student": "DIST_DIR=apps/student/dist tsx scripts/build-manifest.mjs",
    "sri:student": "DIST_DIR=apps/student/dist tsx scripts/postbuild-sri.mjs",
    "manifest:admin": "DIST_DIR=apps/admin/dist tsx scripts/build-manifest.mjs",
    "sri:admin": "DIST_DIR=apps/admin/dist tsx scripts/postbuild-sri.mjs"
  }
}
```

3) Install deps in each app (first run will generate lockfile entries):
```bash
pnpm -C apps/student i
pnpm -C apps/admin i
```

4) Student local dev:
```bash
pnpm -C apps/student dev
# open http://localhost:5173/?pack=sample
```

5) Build + SRI locally:
```bash
pnpm -C apps/student build
pnpm manifest && pnpm sri
```

6) Netlify (root site for Student):
- Make sure your repo root has `netlify.toml` (included in this patch).
- Post-processing should be OFF (Asset optimization) to keep SRI valid.

7) Admin as separate Netlify site:
- Create a new Netlify site pointing to the same repo.
- Base directory: `apps/admin`
- Publish directory: `dist`
- Build command is taken from `apps/admin/netlify.toml`

## Notes
- Student app uses Tailwind. Admin app is minimal React+TS.
- You can later wire Supabase (RPC, auth) without changing this structure.
