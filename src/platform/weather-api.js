const WEATHER_CODE_RULES = [
    { codes: [0], visual: 0, label: '晴' },
    { codes: [1], visual: 1, label: '大致晴朗' },
    { codes: [2], visual: 1, label: '多云' },
    { codes: [3], visual: 2, label: '阴' },
    { codes: [45], visual: 3, label: '雾' },
    { codes: [48], visual: 3, label: '雾凇' },
    { codes: [51], visual: 4, label: '小毛毛雨' },
    { codes: [53], visual: 4, label: '毛毛雨' },
    { codes: [55], visual: 5, label: '强毛毛雨' },
    { codes: [56], visual: 4, label: '轻微冻毛毛雨' },
    { codes: [57], visual: 5, label: '冻毛毛雨' },
    { codes: [61], visual: 4, label: '小雨' },
    { codes: [63], visual: 4, label: '中雨' },
    { codes: [65], visual: 5, label: '大雨' },
    { codes: [66], visual: 4, label: '轻微冻雨' },
    { codes: [67], visual: 5, label: '冻雨' },
    { codes: [71], visual: 7, label: '小雪' },
    { codes: [73], visual: 7, label: '中雪' },
    { codes: [75], visual: 8, label: '大雪' },
    { codes: [77], visual: 7, label: '米雪' },
    { codes: [80], visual: 4, label: '小阵雨' },
    { codes: [81], visual: 4, label: '阵雨' },
    { codes: [82], visual: 5, label: '强阵雨' },
    { codes: [85], visual: 7, label: '小阵雪' },
    { codes: [86], visual: 8, label: '强阵雪' },
    { codes: [95], visual: 6, label: '雷雨' },
    { codes: [96], visual: 6, label: '雷雨伴小冰雹' },
    { codes: [99], visual: 6, label: '雷雨伴大冰雹' }
];

const WEATHER_BY_CODE = new Map(WEATHER_CODE_RULES.flatMap(rule =>
    rule.codes.map(code => [code, Object.freeze({ code, visual: rule.visual, label: rule.label })])));

export function weatherFromCode(code) {
    const numeric = Math.round(Number(code));
    return WEATHER_BY_CODE.get(numeric) || { code: numeric, visual: 2, label: '未知天气' };
}

// Weather changes are slow; 15 minutes is timely while keeping network traffic negligible.
const UPDATE_INTERVAL = 15 * 60 * 1000;

async function getJson(url, timeoutMs) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, { signal: controller.signal, cache: 'no-store' });
        if (!response.ok) throw Error('HTTP ' + response.status);
        return await response.json();
    } finally {
        window.clearTimeout(timeout);
    }
}

// IP geolocation providers are occasionally blocked or rate-limited. Keep
// several CORS-enabled providers so one failure does not disable auto weather.
async function resolveLocation() {
    const providers = [
        async () => {
            const value = await getJson('https://ipwho.is/', 10000);
            return { latitude: Number(value?.latitude), longitude: Number(value?.longitude) };
        },
        async () => {
            const value = await getJson('https://ipapi.co/json/', 10000);
            return { latitude: Number(value?.latitude), longitude: Number(value?.longitude) };
        },
        async () => {
            const value = await getJson('https://ipinfo.io/json', 10000);
            const [latitude, longitude] = String(value?.loc || '').split(',').map(Number);
            return { latitude, longitude };
        }
    ];
    for (const provider of providers) {
        try {
            const point = await provider();
            if (Number.isFinite(point.latitude) && Number.isFinite(point.longitude)) return point;
        } catch { /* try the next provider */ }
    }
    throw Error('location');
}

// Coarse IP location avoids browser/Wallpaper Engine location permission prompts.
export function attachWeatherApi({ config, setWeather }) {
    if (!globalThis.fetch || !globalThis.AbortController) return () => {};
    let stopped = false, requesting = false, timer = 0;
    let location = null;
    const enabled = () => config.autoWeather !== false;

    async function updateWeather() {
        // Wallpaper Engine renders web wallpapers as background pages. In that
        // host document.hidden can remain true (and navigator.onLine can be
        // false even while fetch works), so neither flag may gate polling.
        if (stopped || requesting || !enabled()) return;
        requesting = true;
        try {
            if (!location) {
                location = await resolveLocation();
            }
            if (stopped || !enabled()) return;
            const url = `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&current=weather_code,temperature_2m&timezone=auto`;
            const data = await getJson(url, 12000);
            if (stopped || !enabled()) return;
            const code = Number(data?.current?.weather_code);
            if (!Number.isFinite(code)) throw Error('weather');
            const weather = weatherFromCode(code);
            setWeather(weather.visual);
            config.weatherCode = weather.code;
            config.weatherLabel = weather.label;
            const temperature = Number(data?.current?.temperature_2m);
            config.weatherTemperature = Number.isFinite(temperature) ? temperature : null;
            config.weatherSource = 'network';
        } catch {
            // Keep the last successful weather during transient network
            // failures. A later interval/online event will retry the request.
            if (!stopped && config.weatherSource !== 'network') {
                setWeather(0);
                config.weatherCode = null;
                config.weatherLabel = null;
                config.weatherTemperature = null;
                config.weatherSource = 'default';
            }
        } finally {
            requesting = false;
        }
    }

    if (enabled()) updateWeather();
    timer = window.setInterval(updateWeather, UPDATE_INTERVAL);
    const onOnline = () => updateWeather();
    const onVisibilityChange = () => { if (!document.hidden) updateWeather(); };
    const onAutoWeatherChange = event => { if (event.detail === true) updateWeather(); };
    window.addEventListener('online', onOnline);
    window.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('koi:auto-weather-change', onAutoWeatherChange);
    return () => {
        stopped = true;
        window.clearInterval(timer);
        window.removeEventListener('online', onOnline);
        window.removeEventListener('visibilitychange', onVisibilityChange);
        window.removeEventListener('koi:auto-weather-change', onAutoWeatherChange);
    };
}
