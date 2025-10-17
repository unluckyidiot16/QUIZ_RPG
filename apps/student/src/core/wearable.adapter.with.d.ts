import type { Equipped } from './wearable.types';
import type { WearableItem } from './wearable.types';
import type { Layer } from '../shared/ui/AvatarRenderer';
export declare function equippedToLayersWith(equipped: Equipped, catalog: Record<string, WearableItem>): Layer[];
