import { THEME } from '../shared/legacy-assets.js';
import { CLOCK_ANCHORS, clockRect, clockPos, clampRect } from './clock-pos.js';

export { CLOCK_ANCHORS, clockRect, clockPos, clampRect };

const WEATHER_NAMES = {
    clear: '晴天', cloudy: '多云', overcast: '阴天', fog: '有雾',
    lightRain: '小雨', heavyRain: '大雨', thunderstorm: '雷雨',
    lightSnow: '小雪', heavySnow: '大雪'
};
const WEATHER_NAMES_EN = {
    clear: 'Clear', cloudy: 'Cloudy', overcast: 'Overcast', fog: 'Fog',
    lightRain: 'Light Rain', heavyRain: 'Heavy Rain', thunderstorm: 'Thunderstorm',
    lightSnow: 'Light Snow', heavySnow: 'Heavy Snow'
};
const OBSERVED_WEATHER_EN = {
    0: 'Clear', 1: 'Mainly Clear', 2: 'Partly Cloudy', 3: 'Overcast', 45: 'Fog', 48: 'Rime Fog',
    51: 'Light Drizzle', 53: 'Drizzle', 55: 'Dense Drizzle', 56: 'Freezing Drizzle', 57: 'Dense Freezing Drizzle',
    61: 'Light Rain', 63: 'Rain', 65: 'Heavy Rain', 66: 'Freezing Rain', 67: 'Heavy Freezing Rain',
    71: 'Light Snow', 73: 'Snow', 75: 'Heavy Snow', 77: 'Snow Grains', 80: 'Light Rain Showers',
    81: 'Rain Showers', 82: 'Heavy Rain Showers', 85: 'Light Snow Showers', 86: 'Heavy Snow Showers',
    95: 'Thunderstorm', 96: 'Thunderstorm with Hail', 99: 'Thunderstorm with Heavy Hail'
};
const lx = () => THEME.light.dir[0];
const ly = () => THEME.light.dir[1];
const finite = (v, fallback) => typeof v === 'number' && Number.isFinite(v) ? v : fallback;

function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    if (g.roundRect) { g.roundRect(x, y, w, h, r); return; }
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + r, y, r);
    g.closePath();
}

export function createClock({ viewport, config = {}, environment, save = null }) {
    let clockTime = '', clockDate = '', clockStamp = '', lastRect = null, actionBar = null;

    function refreshClockText() {
        const d = new Date();
        const english = Number(config.englishMode) === 1;
        const stamp = d.getFullYear() + '/' + d.getMonth() + '/' + d.getDate() + ' ' + d.getHours() + ':' + d.getMinutes() + '/' + english;
        if (stamp === clockStamp) return;
        clockStamp = stamp;
        clockTime = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
        clockDate = english
            ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', weekday: 'short' }).format(d)
            : (d.getMonth() + 1) + '月' + d.getDate() + '日  星期' + ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
    }

    function weatherText() {
        const observed = typeof config.weatherLabel === 'string' && config.weatherLabel.trim();
        const english = Number(config.englishMode) === 1;
        const name = config.weatherSource === 'network' && observed
            ? (english ? OBSERVED_WEATHER_EN[config.weatherCode] || 'Unknown Weather' : observed)
            : (english ? WEATHER_NAMES_EN[environment?.name] || 'Clear' : WEATHER_NAMES[environment?.name] || '晴天');
        const temperature = Number(config.weatherTemperature);
        return config.weatherSource === 'network' && Number.isFinite(temperature)
            ? name + '  ' + Math.round(temperature) + '°C'
            : name;
    }

    function position() {
        return {
            anchor: CLOCK_ANCHORS[Math.round(finite(config.clockAnchor, NaN))] ||
                (CLOCK_ANCHORS.includes(THEME.clock.anchor) ? THEME.clock.anchor : 'top-right'),
            x: finite(config.clockX, THEME.clock.marginX),
            y: finite(config.clockY, THEME.clock.marginY)
        };
    }

    const shown = () => config.clockShow !== false;
    const editing = () => config.clockEdit === true;

    function draw(g) {
        const T = THEME.clock;
        if (!shown()) { lastRect = actionBar = null; return; }
        refreshClockText();
        const short = Math.min(viewport.width, viewport.height);
        const timeSize = short * T.timeSize;
        const dateSize = timeSize * T.dateSize;
        const weatherSize = dateSize * 0.92;
        const gap = timeSize * T.gap;
        const pos = position();
        const horiz = pos.anchor.split('-')[1];

        g.save();
        g.textBaseline = 'middle';
        g.textAlign = horiz === 'left' ? 'left' : 'right';
        g.font = '600 ' + Math.round(timeSize) + 'px ' + T.font;
        const timeW = g.measureText(clockTime).width;
        g.font = '400 ' + Math.round(dateSize) + 'px ' + T.font;
        const dateW = g.measureText(clockDate).width;
        g.font = '500 ' + Math.round(weatherSize) + 'px ' + T.font;
        const weatherW = g.measureText(weatherText()).width;
        const blockH = timeSize + gap * 0.68 + dateSize + gap * 0.34 + weatherSize;
        const rect = clockRect(pos, viewport, { w: Math.max(timeW, dateW, weatherW), h: blockH });
        lastRect = rect;

        const cx = horiz === 'left' ? rect.x : rect.x + rect.w;
        const timeY = rect.y + timeSize / 2;
        const dateY = rect.y + timeSize + gap * 0.68 + dateSize / 2;
        const weatherY = rect.y + timeSize + gap * 0.68 + dateSize + gap * 0.34 + weatherSize / 2;
        const off = short * T.shadowOffset;
        g.shadowColor = T.shadow + T.shadowAlpha + ')';
        g.shadowBlur = short * T.shadowBlur;
        g.shadowOffsetX = -lx() * off;
        g.shadowOffsetY = -ly() * off;

        const rf = short * 0.0022;
        g.save();
        g.shadowColor = 'transparent';
        g.fillStyle = 'rgba(150,220,215,0.20)';
        g.font = '600 ' + Math.round(timeSize) + 'px ' + T.font;
        g.fillText(clockTime, cx - lx() * rf, timeY - ly() * rf);
        g.font = '400 ' + Math.round(dateSize) + 'px ' + T.font;
        g.fillText(clockDate, cx - lx() * rf, dateY - ly() * rf);
        g.font = '500 ' + Math.round(weatherSize) + 'px ' + T.font;
        g.fillText(weatherText(), cx - lx() * rf, weatherY - ly() * rf);
        g.restore();

        g.fillStyle = T.color;
        g.font = '600 ' + Math.round(timeSize) + 'px ' + T.font;
        g.fillText(clockTime, cx, timeY);
        g.font = '400 ' + Math.round(dateSize) + 'px ' + T.font;
        g.fillText(clockDate, cx, dateY);
        g.fillStyle = 'rgba(229,242,238,0.88)';
        g.font = '500 ' + Math.round(weatherSize) + 'px ' + T.font;
        g.fillText(weatherText(), cx, weatherY);
        g.restore();

        actionBar = null;
        if (!editing()) return;
        const box = { x: rect.x - 10, y: rect.y - 10, w: rect.w + 20, h: rect.h + 20 };
        g.save();
        g.setLineDash([7, 5]);
        g.strokeStyle = 'rgba(216,135,150,0.95)';
        g.lineWidth = 1.6;
        roundRect(g, box.x, box.y, box.w, box.h, 10);
        g.stroke();
        g.setLineDash([]);

        const barH = 34, barW = 296;
        const bx = Math.max(8, Math.min(viewport.width - barW - 8, box.x + box.w - barW));
        const below = box.y + box.h + 10;
        const by = below + barH < viewport.height - 8 ? below : Math.max(8, box.y - barH - 10);
        g.fillStyle = 'rgba(9,30,29,0.88)';
        roundRect(g, bx, by, barW, barH, 10);
        g.fill();
        g.strokeStyle = 'rgba(216,135,150,0.55)';
        g.lineWidth = 1;
        g.stroke();
        g.textAlign = 'left';
        g.textBaseline = 'middle';
        g.font = '12px ' + T.font;
        g.fillStyle = 'rgba(240,246,242,0.92)';
        g.fillText(Number(config.englishMode) === 1 ? 'Drag clock' : '拖动时间组件', bx + 12, by + barH / 2);
        const buttonW = 56, buttonH = 24;
        const buttonX = bx + barW - buttonW - 8;
        const buttonY = by + (barH - buttonH) / 2;
        g.fillStyle = 'rgba(216,135,150,0.95)';
        roundRect(g, buttonX, buttonY, buttonW, buttonH, 7);
        g.fill();
        g.fillStyle = '#34252b';
        g.font = '600 12px ' + T.font;
        g.textAlign = 'center';
        g.fillText(Number(config.englishMode) === 1 ? 'Save' : '保存', buttonX + buttonW / 2, buttonY + buttonH / 2);
        g.restore();
        actionBar = { x: bx, y: by, w: barW, h: barH };
    }

    return {
        draw,
        rect: () => shown() && lastRect ? { ...lastRect } : null,
        box: () => shown() && editing() && lastRect
            ? { x: lastRect.x - 6, y: lastRect.y - 6, w: lastRect.w + 12, h: lastRect.h + 12 }
            : null,
        saveBox: () => actionBar,
        commit() {
            const pos = position();
            save?.({ clockAnchor: CLOCK_ANCHORS.indexOf(pos.anchor), clockX: pos.x, clockY: pos.y,
                clockEdit: false, clockEditConsumed: true });
            config.clockEdit = false;
            config.clockEditConsumed = true;
            return pos;
        },
        moveTo(x, y) {
            if (!lastRect) return null;
            const next = clockRect(clockPos(clampRect({ x, y, w: lastRect.w, h: lastRect.h }, viewport), viewport),
                viewport, { w: lastRect.w, h: lastRect.h });
            const pos = clockPos(next, viewport);
            config.clockAnchor = CLOCK_ANCHORS.indexOf(pos.anchor);
            config.clockX = pos.x;
            config.clockY = pos.y;
            save?.({ clockAnchor: config.clockAnchor, clockX: pos.x, clockY: pos.y });
            return pos;
        },
        inspect: () => ({ rect: lastRect && { ...lastRect }, editing: editing(), weather: weatherText() })
    };
}
