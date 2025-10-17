// src/core/inv.bus.ts
const EVT = 'inv:changed';
export const notifyInventoryChanged = () => window.dispatchEvent(new Event(EVT));
export const onInventoryChanged = (cb) => {
    window.addEventListener(EVT, cb);
    return () => window.removeEventListener(EVT, cb);
};
