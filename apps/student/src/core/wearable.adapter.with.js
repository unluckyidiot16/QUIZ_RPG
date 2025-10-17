import { SLOT_Z } from './wearable.types';
export function equippedToLayersWith(equipped, catalog) {
    const layers = [];
    const order = ['Body', 'Face', 'BodySuit', 'Pants', 'Shoes', 'Clothes', 'Sleeves', 'Necklace', 'Bag', 'Scarf', 'Bowtie', 'Hair', 'Hat'];
    for (const slot of order) {
        const id = equipped[slot];
        if (!id)
            continue;
        const item = catalog[id];
        if (!item)
            continue;
        layers.push({
            id: item.id, src: item.src, z: SLOT_Z[slot],
            opacity: item.opacity, scale: item.scale, offset: item.offset,
            atlas: item.atlas ? { ...item.atlas, fps: item.atlas.fps ?? 6 } : undefined,
        });
    }
    return layers.sort((a, b) => a.z - b.z);
}
