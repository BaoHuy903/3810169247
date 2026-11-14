export const SEASON_AUTO = 0;
export const SEASON_IDS = ['spring', 'summer', 'autumn', 'winter'];
const NAMES = { spring: 'Spring', summer: 'Summer', autumn: 'Autumn', winter: 'Winter' };
export function seasonName(id) { return NAMES[id] || String(id); }
export function seasonOfMonth(month) {
    const m = Math.round(Number(month));
    return Number.isFinite(m) ? (m >= 3 && m <= 5 ? 'spring' : m >= 6 && m <= 8 ? 'summer' : m >= 9 && m <= 11 ? 'autumn' : 'winter') : 'summer';
}
export function seasonFromSetting(value, now = new Date()) {
    const v = Math.round(Number(value));
    return Number.isFinite(v) && v >= 1 && v <= SEASON_IDS.length ? { id: SEASON_IDS[v - 1], auto: false } : { id: seasonOfMonth(now.getMonth() + 1), auto: true };
}
export function seasonAsset(id) {
    return id === 'spring' ? 'assets/pond-background-spring.webp' : id === 'autumn' ? 'assets/pond-background-autumn.webp' : id === 'winter' ? 'assets/pond-background-winter.webp' : 'assets/pond-background-summer.webp';
}
export function fallKindOfSeason(id) { return id === 'spring' ? 'petal' : id === 'autumn' ? 'leaf' : id === 'winter' ? 'snow' : null; }
export const FALL_LEVEL_MUL = [0, 0.45, 1, 1.8];
export const FALL_LEVEL_AUTO = 2;
export function fallLevelMul(value) { const lv = Math.round(Number(value)); return FALL_LEVEL_MUL[Number.isFinite(lv) && lv >= 0 && lv < FALL_LEVEL_MUL.length ? lv : FALL_LEVEL_AUTO]; }
