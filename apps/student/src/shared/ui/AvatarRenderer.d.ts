export type Atlas = {
    cols: number;
    rows: number;
    frames: number;
    fps?: number;
};
export type Layer = {
    id: string;
    src: string;
    z: number;
    opacity?: number;
    scale?: number;
    offset?: {
        x: number;
        y: number;
    };
    atlas?: Atlas;
};
export declare function AvatarRenderer({ layers, size, playing, pixelRatio, corsMode, }: {
    layers: Layer[];
    size?: number;
    playing?: boolean;
    pixelRatio?: number;
    corsMode?: 'none' | 'anonymous';
}): import("react/jsx-runtime").JSX.Element;
