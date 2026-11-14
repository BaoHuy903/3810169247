import { mulberry32 } from '../shared/math.js';

export function createWeatherAtmosphere({ viewport, environment }) {
    const rng = mulberry32(0x73a91d2b);
    let haze = document.createElement('canvas');
    let hazeBack = document.createElement('canvas');
    const clouds = Array.from({ length: 16 }, () => ({ x: rng(), y: rng(), r: 0.12 + rng() * 0.22, speed: 0.001 + rng() * 0.0025 }));
    const fogBanks = Array.from({ length: 14 }, () => ({
        x: rng() * 1.35, y: 0.12 + rng() * 0.82,
        rx: 0.16 + rng() * 0.24, ry: 0.055 + rng() * 0.11,
        speed: 0.0008 + rng() * 0.0015, phase: rng() * Math.PI * 2
    }));
    const snow = Array.from({ length: 130 }, () => ({ x: rng(), y: rng(), z: 0.4 + rng() * 0.9, sway: rng() * Math.PI * 2 }));
    let elapsed = 0, hazeClock = 0, hazeBuild = null, snowMix = 0;
    let flash = 0, flashHold = 0, flashEchoDelay = -1, flashX = 0.5, flashDelay = 7 + rng() * 10;

    function prepareHazeBuild(cloud, fog) {
        const strength = Math.max(cloud, fog);
        const cloudMix = strength > 0.001 ? cloud / strength : 0;
        const fogMix = strength > 0.001 ? fog / strength : 0;
        const dpr = Math.max(1, Number(globalThis.devicePixelRatio) || 1);
        const w = Math.max(1, Math.round(viewport.width * dpr));
        const h = Math.max(1, Math.round(viewport.height * dpr));
        if (hazeBack.width !== w || hazeBack.height !== h) {
            hazeBack.width = w;
            hazeBack.height = h;
        }
        const hg = hazeBack.getContext('2d');
        if (hg) {
            hg.imageSmoothingEnabled = true;
            hg.imageSmoothingQuality = 'high';
        }
        hg.clearRect(0, 0, w, h);
        if (cloudMix > 0.01) {
            hg.fillStyle = `rgba(30,43,47,${(0.090 * cloudMix).toFixed(3)})`;
            hg.fillRect(0, 0, w, h);
        }
        if (fogMix > 0.01) {
            hg.fillStyle = `rgba(198,211,210,${(0.035 * fogMix).toFixed(3)})`;
            hg.fillRect(0, 0, w, h);
        }
        hazeBuild = {
            g: hg, w, h, cloud: cloudMix, fog: fogMix, at: elapsed,
            cloudIndex: cloudMix > 0.01 ? 0 : clouds.length,
            fogIndex: fogMix > 0.01 ? 0 : fogBanks.length
        };
    }

    function stepHazeBuild(budget = 3) {
        const b = hazeBuild;
        if (!b) return;
        while (budget-- > 0) {
            if (b.cloudIndex < clouds.length) {
                const c = clouds[b.cloudIndex++];
                const x = ((c.x + b.at * c.speed) % 1.35 - 0.18) * b.w, y = c.y * b.h;
                const r = c.r * b.w;
                const gr = b.g.createRadialGradient(x, y, 0, x, y, r);
                gr.addColorStop(0, `rgba(18,31,36,${(0.38 * b.cloud).toFixed(3)})`);
                gr.addColorStop(0.55, `rgba(29,45,49,${(0.17 * b.cloud).toFixed(3)})`);
                gr.addColorStop(1, 'rgba(20,35,40,0)');
                b.g.fillStyle = gr;
                b.g.fillRect(x - r, y - r, r * 2, r * 2);
                continue;
            }
            if (b.fogIndex < fogBanks.length) {
                const bank = fogBanks[b.fogIndex++];
                const x = ((bank.x + b.at * bank.speed) % 1.55 - 0.18) * b.w;
                const y = (bank.y + Math.sin(b.at * 0.025 + bank.phase) * 0.035) * b.h;
                b.g.save();
                b.g.globalCompositeOperation = 'screen';
                b.g.translate(x, y);
                b.g.scale(bank.rx * b.w, bank.ry * b.h);
                const gr = b.g.createRadialGradient(0, 0, 0, 0, 0, 1);
                gr.addColorStop(0, `rgba(210,224,222,${(0.095 * b.fog).toFixed(3)})`);
                gr.addColorStop(0.52, `rgba(202,219,217,${(0.042 * b.fog).toFixed(3)})`);
                gr.addColorStop(1, 'rgba(195,214,212,0)');
                b.g.fillStyle = gr;
                b.g.fillRect(-1, -1, 2, 2);
                b.g.restore();
                continue;
            }
            const old = haze;
            haze = hazeBack;
            hazeBack = old;
            hazeBuild = null;
            hazeClock = 2;
            return;
        }
    }

    return {
        update(dt) {
            elapsed += dt;
            const effects = environment.effects;
            snowMix += (effects.snow - snowMix) * Math.min(1, dt * 0.8);
            const count = Math.round(snow.length * snowMix);
            for (let i = 0; i < count; i++) {
                const p = snow[i];
                p.y += dt * (0.025 + p.z * 0.045);
                p.x += Math.sin(elapsed * (0.5 + p.z * 0.35) + p.sway) * dt * 0.009;
                if (p.y > 1.03) { p.y = -0.03; p.x = rng(); }
                if (p.x < -0.03) p.x += 1.06;
                if (p.x > 1.03) p.x -= 1.06;
            }
            if (hazeBuild) stepHazeBuild();
            else {
                const hazeStrength = Math.max(effects.cloud, effects.fog);
                if (haze.width > 1 || hazeStrength > 0.01) {
                    hazeClock -= dt;
                    if (hazeClock <= 0) prepareHazeBuild(effects.cloud, effects.fog);
                }
            }
            if (effects.lightning > 0.1) {
                flashDelay -= dt * effects.lightning;
                if (flashDelay <= 0) {
                    flashHold = 0.11 + rng() * 0.07;
                    flashEchoDelay = 0.20 + rng() * 0.08;
                    flashX = 0.2 + rng() * 0.6;
                    flashDelay = 10 + rng() * 14;
                }
            } else flashDelay = Math.min(flashDelay, 8 + rng() * 8);
            if (flashEchoDelay > 0) {
                flashEchoDelay -= dt;
                if (flashEchoDelay <= 0) {
                    flashHold = 0.07 + rng() * 0.05;
                    flashEchoDelay = -1;
                }
            }
            flashHold = Math.max(0, flashHold - dt);
            const flashTarget = flashHold > 0 ? 1 : 0;
            const flashEase = flashTarget > flash ? 13 : 2.8;
            flash += (flashTarget - flash) * Math.min(1, dt * flashEase);
        },
        layers: { weather(g) {
            const effects = environment.effects;
            if (effects.cloud > 0.01 || effects.fog > 0.01) {
                if (haze.width > 1) {
                    g.save();
                    g.globalAlpha = Math.max(effects.cloud, effects.fog);
                    g.drawImage(haze, 0, 0, viewport.width, viewport.height);
                    g.restore();
                }
            }
            const count = Math.round(snow.length * snowMix);
            if (count) {
                g.save(); g.fillStyle = 'rgba(239,248,252,0.78)';
                for (let i = 0; i < count; i++) {
                    const p = snow[i], r = 0.9 + p.z * 2.1;
                    g.globalAlpha = 0.35 + p.z * 0.45;
                    g.beginPath(); g.arc(p.x * viewport.width, p.y * viewport.height, r, 0, Math.PI * 2); g.fill();
                }
                g.restore();
            }
            if (flash > 0 && effects.lightning > 0) {
                const pulse = flash * effects.lightning;
                const w = viewport.width, h = viewport.height;
                const radius = Math.max(w, h) * 0.82;
                const glow = g.createRadialGradient(flashX * w, -h * 0.08, 0, flashX * w, 0, radius);
                glow.addColorStop(0, `rgba(205,224,232,${Math.min(0.130, pulse * 0.130).toFixed(3)})`);
                glow.addColorStop(0.42, `rgba(190,214,223,${Math.min(0.060, pulse * 0.060).toFixed(3)})`);
                glow.addColorStop(1, 'rgba(174,198,207,0)');
                g.save();
                g.globalCompositeOperation = 'screen';
                g.fillStyle = glow;
                g.fillRect(0, 0, w, h);
                g.restore();
            }
        } },
        inspect: () => ({ building: !!hazeBuild, strength: Math.max(environment.effects.cloud, environment.effects.fog), width: haze.width, height: haze.height }),
        dispose() { haze.width = haze.height = hazeBack.width = hazeBack.height = 1; hazeBuild = null; }
    };
}
