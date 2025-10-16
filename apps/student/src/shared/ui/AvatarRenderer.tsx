import React, { useEffect, useRef } from 'react';

export type Atlas = { cols: number; rows: number; frames: number; fps?: number };
export type Layer = {
  id: string;
  src: string;                     // 절대경로 권장(https GH Pages)
  z: number;                       // 작은 값이 아래
  opacity?: number;
  scale?: number;                  // 1 = 캔버스 size 기준
  offset?: { x: number; y: number }; // px
  atlas?: Atlas;                   // (MVP에선 생략)
};

export function AvatarRenderer({
                                 layers,
                                 size = 460,
                                 playing = true,
                                 pixelRatio = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
                                 corsMode = 'none', // 'none' | 'anonymous'  (GH Pages는 보통 'none' 권장)
                               }: {
  layers: Layer[];
  size?: number;
  playing?: boolean;
  pixelRatio?: number;
  corsMode?: 'none' | 'anonymous';
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const rafRef = useRef<number>();
  const startRef = useRef<number>(0);

  const loadImage = async (src: string) => {
    const cache = cacheRef.current;
    if (cache.has(src)) return cache.get(src)!;
    const img = new Image();
    if (corsMode === 'anonymous') img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.src = src;
    await img.decode();
    cache.set(src, img);
    return img;
  };

  const draw = async (t: number) => {
    const cvs = canvasRef.current; if (!cvs) return;
    const ctx = cvs.getContext('2d'); if (!ctx) return;

    const W = size * pixelRatio;
    const H = size * pixelRatio;
    ctx.clearRect(0, 0, W, H);

    const ordered = [...layers].sort((a, b) => a.z - b.z);

    for (const layer of ordered) {
      const img = await loadImage(layer.src).catch(() => null);
      if (!img) continue;

      const s = layer.scale ?? 1;
      const ox = (layer.offset?.x ?? 0) * pixelRatio;
      const oy = (layer.offset?.y ?? 0) * pixelRatio;
      const w = W * s;
      const h = H * s;

      const prevAlpha = ctx.globalAlpha;
      ctx.globalAlpha = layer.opacity ?? 1;

      if (layer.atlas && playing) {
        const { cols, rows, frames, fps = 6 } = layer.atlas;
        const fw = img.width / cols;
        const fh = img.height / rows;
        const elapsed = (t - startRef.current) / 1000;
        const idx = Math.floor(elapsed * fps) % Math.max(1, frames);
        const cx = idx % cols;
        const cy = Math.floor(idx / cols);

        ctx.drawImage(
          img,
          Math.floor(cx * fw), Math.floor(cy * fh),
          Math.floor(fw), Math.floor(fh),
          Math.floor((W - w) / 2 + ox), Math.floor((H - h) / 2 + oy),
          Math.floor(w), Math.floor(h)
        );
      } else {
        ctx.drawImage(
          img,
          Math.floor((W - w) / 2 + ox), Math.floor((H - h) / 2 + oy),
          Math.floor(w), Math.floor(h)
        );
      }
      ctx.globalAlpha = prevAlpha;
    }
  };

  useEffect(() => {
    const cvs = canvasRef.current; if (!cvs) return;
    cvs.width = size * pixelRatio;
    cvs.height = size * pixelRatio;
    cvs.style.width = `${size}px`;
    cvs.style.height = `${size}px`;

    let mounted = true;
    const hasAnim = layers.some(l => !!l.atlas) && playing;

    const tick = (now: number) => {
      if (!mounted) return;
      draw(now);
      rafRef.current = hasAnim ? requestAnimationFrame(tick) : undefined;
    };

    draw(performance.now());
    if (hasAnim) rafRef.current = requestAnimationFrame(tick);

    return () => {
      mounted = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(layers), size, pixelRatio, playing, corsMode]);

  return <canvas ref={canvasRef} />;
}
