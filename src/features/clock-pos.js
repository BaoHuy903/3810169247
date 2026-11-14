export const CLOCK_ANCHORS = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];

const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
const finite = (v, fallback) => typeof v === 'number' && Number.isFinite(v) ? v : fallback;

export function clockRect(pos, viewport, size) {
    const [vert, horiz] = String(pos.anchor).split('-');
    const maxX = Math.max(0, viewport.width - size.w);
    const maxY = Math.max(0, viewport.height - size.h);
    const mx = Math.min(clamp01(finite(pos.x, 0)) * viewport.width, maxX);
    const my = Math.min(clamp01(finite(pos.y, 0)) * viewport.height, maxY);
    return {
        x: horiz === 'left' ? mx : viewport.width - mx - size.w,
        y: vert === 'top' ? my : viewport.height - my - size.h,
        w: size.w,
        h: size.h
    };
}

export function clockPos(rect, viewport) {
    const left = rect.x, right = viewport.width - rect.x - rect.w;
    const top = rect.y, bottom = viewport.height - rect.y - rect.h;
    const horiz = left <= right ? 'left' : 'right';
    const vert = top <= bottom ? 'top' : 'bottom';
    return {
        anchor: vert + '-' + horiz,
        x: clamp01((horiz === 'left' ? left : right) / Math.max(1, viewport.width)),
        y: clamp01((vert === 'top' ? top : bottom) / Math.max(1, viewport.height))
    };
}

export function clampRect(rect, viewport) {
    return {
        x: Math.max(0, Math.min(Math.max(0, viewport.width - rect.w), rect.x)),
        y: Math.max(0, Math.min(Math.max(0, viewport.height - rect.h), rect.y)),
        w: rect.w,
        h: rect.h
    };
}
