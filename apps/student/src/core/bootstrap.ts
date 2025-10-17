// apps/student/src/shared/ui/AvatarRenderer.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';

export type Layer = {
  id: string;
  slot: string;              // 'body' | 'eyes' | ...
  src: string;               // 이미지 URL (필수)
  name?: string;
  z: number;                 // 그리기 순서 (작을수록 먼저)
};

type Props = {
  layers: Layer[];
  size?: number;             // 렌더 크기(px) – 기본 160
  playing?: boolean;         // 애니메이션 루프 유지 여부 (없어도 동작)
  pixelRatio?: number;       // 고해상도 캔버스 배율 (기본 devicePixelRatio)
  corsMode?: 'none' | 'anonymous'; // 교차출처 이미지일 때 'anonymous' 권장
};

type Loaded = { layer: Layer; img: HTMLImageElement };

export default function AvatarRenderer({
                                         layers,
                                         size = 160,
                                         playing = false,
                                         pixelRatio,
                                         corsMode = 'none',
                                       }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [loaded, setLoaded] = useState<Loaded[]>([]);
  const rafRef = useRef<number | null>(null);

  // z 오름차순 정렬(안전)
  const sorted = useMemo(
    () => [...(layers || [])].filter(l => !!l?.src).sort((a, b) => a.z - b.z),
    [layers]
  );

  // 이미지 로드
  useEffect(() => {
    let cancelled = false;
    setLoaded([]);

    async function loadAll() {
      const entries = await Promise.all(
        sorted.map(
          (layer) =>
            new Promise<Loaded | null>((resolve) => {
              const img = new Image();
              if (corsMode === 'anonymous') img.crossOrigin = 'anonymous';
              // 이미지가 크면 해상도 향상
              (img as any).decoding = 'async';
              img.onload = () => resolve({ layer, img });
              img.onerror = () => resolve(null);
              img.src = layer.src;
            })
        )
      );

      if (!cancelled) {
        setLoaded(entries.filter((e): e is Loaded => !!e));
      }
    }

    if (sorted.length) loadAll();
    else setLoaded([]);

    return () => { cancelled = true; };
  }, [sorted, corsMode]);

  // 캔버스 그리기
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr =
      typeof window !== 'undefined'
        ? Math.max(1, Math.min(3, pixelRatio ?? (window.devicePixelRatio || 1)))
        : (pixelRatio ?? 1);

    const w = Math.round(size * dpr);
    const h = Math.round(size * dpr);

    // 캔버스 리사이즈(고해상도)
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      canvas.style.width = `${size}px`;
      canvas.style.height = `${size}px`;
    }

    function drawOnce() {
      ctx.clearRect(0, 0, w, h);
      // 모든 레이어를 동일 크기로 합성 (이미지 자체가 정사이즈 시 정확히 겹침)
      for (const { img } of loaded) {
        // 필요 시 개별 레이어 오프셋/스케일이 있으면 여기서 반영
        ctx.drawImage(img, 0, 0, w, h);
      }
    }

    function loop() {
      drawOnce();
      if (playing) rafRef.current = requestAnimationFrame(loop);
    }

    // 첫 프레임
    if (playing) {
      rafRef.current && cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(loop);
    } else {
      drawOnce();
    }

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [loaded, size, pixelRatio, playing]);

  // 로딩/비어있는 상태 가드
  const isEmpty = !sorted.length || !loaded.length;

  return (
    <div
      className="avatar-renderer"
  style={{ display: 'inline-block', width: size, height: size }}
  aria-label="avatar"
  >
  <canvas ref={canvasRef} />
  {isEmpty && (
    <div
      style={{
    position: 'relative',
      marginTop: -size,
      width: size,
      height: size,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 12,
      color: '#888',
      userSelect: 'none',
  }}
  >
    loading…
        </div>
  )}
  </div>
);
}
