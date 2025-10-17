import type { ItemCatalog, WearableCatalog } from './wearable.types';
/**
 * Load wearables/items catalog
 * @param opts.url   override JSON url
 * @param opts.bust  add cache-busting query param
 * @param opts.skipSheetFallback  if true, do not try sheet fallback
 */
export declare function loadWearablesCatalog(opts?: {
    url?: string;
    bust?: boolean;
    skipSheetFallback?: boolean;
}): Promise<ItemCatalog>;
/**
 * Force-refresh the in-memory cache (e.g., after manual JSON update)
 */
export declare function reloadWearablesCatalog(opts?: {
    url?: string;
    bust?: boolean;
    skipSheetFallback?: boolean;
}): Promise<ItemCatalog>;
/**
 * Convenience: get only cosmetic items (for Avatar rendering)
 */
export declare function loadCosmeticsCatalog(opts?: {
    url?: string;
    bust?: boolean;
    skipSheetFallback?: boolean;
}): Promise<WearableCatalog>;
export declare const WEARABLES: WearableCatalog;
