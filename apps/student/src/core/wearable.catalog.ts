import type { WearableItem } from './wearable.types';
import { fetchWearablesFromSheet } from './wearable.sheet';

let CACHE: Record<string, WearableItem> | null = null;

export async function loadWearablesCatalog(): Promise<Record<string, WearableItem>> {
  if (CACHE) return CACHE;

  const SHEET_ID = import.meta.env.VITE_WEAR_SHEET_ID as string | undefined;
  const SHEET_NAME = import.meta.env.VITE_WEAR_SHEET_NAME as string | undefined;
  const ROOT = import.meta.env.VITE_ASSETS_ROOT as string | undefined;

  if (SHEET_ID) {
    try {
      CACHE = await fetchWearablesFromSheet({ sheetId: SHEET_ID, sheetName: SHEET_NAME, assetsRoot: ROOT });
      return CACHE;
    } catch (e) {
      console.warn('[wearables] sheet load failed, trying fallback JSON…', e);
    }
  }

  // 폴백: 번들/배포된 정적 JSON
  const res = await fetch('/packs/wearables.v1.json', { cache:'no-store' });
  CACHE = await res.json();
  return CACHE!;
}
