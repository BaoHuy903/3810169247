import { seasonFromSetting, seasonAsset } from '../core/season.js';

export function createSeasonBackground({ config, environment, setSource }) {
    let active = '';
    function update() {
        const selected = seasonFromSetting(config.season, new Date()).id;
        const weather = environment?.name;
        const next = weather === 'lightSnow' || weather === 'heavySnow' ? 'winter' : selected;
        if (next === active) return;
        active = next;
        setSource(seasonAsset(next));
    }
    return { update, inspect: () => ({ season: active, setting: config.season, weather: environment?.name }) };
}
