// src/shared/ui/preload.ts
export function preloadImages(urls) {
    return Promise.all(urls.map(src => new Promise(res => {
        const img = new Image();
        img.src = src;
        img.onload = img.onerror = () => res(null);
    })));
}
