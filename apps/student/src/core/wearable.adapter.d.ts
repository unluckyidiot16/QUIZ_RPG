import type { Equipped, WearableCatalog, ItemCatalog } from './wearable.types';
import type { Layer } from '../shared/ui/AvatarRenderer';
/**
 * equippedToLayers
 * - equipped: 현재 장착 상태 (id 매핑)
 * - catalogAny: WearableCatalog | ItemCatalog | Record<string,unknown>
 *   전달 시 AnyItem 카탈로그여도 코스메틱만 추출하여 사용
 * - 반환: AvatarRenderer용 layers
 */
export declare function equippedToLayers(equipped: Equipped, catalogAny?: WearableCatalog | ItemCatalog | Record<string, unknown>): Layer[];
