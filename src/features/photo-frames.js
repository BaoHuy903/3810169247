const SLOTS = [
    { key: 'photoFrame1', x: 0.035, y: 0.12, tilt: -0.025 },
    { key: 'photoFrame2', x: 0.79, y: 0.16, tilt: 0.022 },
    { key: 'photoFrame3', x: 0.055, y: 0.62, tilt: 0.018 }
];

function roundedRect(g, x, y, w, h, radius) {
    const r = Math.min(radius, w * 0.5, h * 0.5);
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
}

function drawCover(g, image, x, y, w, h) {
    const scale = Math.max(w / image.naturalWidth, h / image.naturalHeight);
    const sw = w / scale;
    const sh = h / scale;
    const sx = (image.naturalWidth - sw) * 0.5;
    const sy = (image.naturalHeight - sh) * 0.5;
    g.drawImage(image, sx, sy, sw, sh, x, y, w, h);
}

function imageSource(source) {
    return /^(?:data:|blob:|https?:|file:)/i.test(source) ? source : 'file:///' + source;
}

export function createPhotoFrames({ config, viewport }) {
    const frames = SLOTS.map(slot => ({ ...slot, source: '', image: null, ready: false }));

    function syncImages() {
        for (const frame of frames) {
            const source = typeof config[frame.key] === 'string' ? config[frame.key].trim() : '';
            if (source === frame.source) continue;
            frame.source = source;
            frame.image = null;
            frame.ready = false;
            if (!source) continue;
            const image = new Image();
            image.onload = () => {
                if (frame.image === image) frame.ready = true;
            };
            image.onerror = () => {
                if (frame.image === image) frame.ready = false;
            };
            frame.image = image;
            image.src = imageSource(source);
        }
    }

    function drawFrame(g, frame, index) {
        if (!frame.ready || !frame.image?.naturalWidth || !frame.image?.naturalHeight) return;

        const landscape = viewport.width >= viewport.height;
        const outerW = Math.max(150, Math.min(landscape ? viewport.width * 0.165 : viewport.width * 0.27, 330));
        const outerH = outerW * 0.72;
        const x = Math.min(viewport.width - outerW - 18, Math.max(18, frame.x * viewport.width));
        const y = Math.min(viewport.height - outerH - 18, Math.max(18, frame.y * viewport.height));
        const border = Math.max(9, outerW * 0.052);
        const innerX = border;
        const innerY = border;
        const innerW = outerW - border * 2;
        const innerH = outerH - border * 2;

        g.save();
        g.translate(x + outerW * 0.5, y + outerH * 0.5);
        g.rotate(frame.tilt);
        g.translate(-outerW * 0.5, -outerH * 0.5);

        g.shadowColor = 'rgba(0, 18, 20, 0.48)';
        g.shadowBlur = Math.max(12, outerW * 0.07);
        g.shadowOffsetY = Math.max(5, outerW * 0.025);
        const wood = g.createLinearGradient(0, 0, outerW, outerH);
        wood.addColorStop(0, 'rgba(68, 43, 25, 0.94)');
        wood.addColorStop(0.48, 'rgba(34, 23, 17, 0.96)');
        wood.addColorStop(1, 'rgba(82, 50, 27, 0.94)');
        roundedRect(g, 0, 0, outerW, outerH, border * 0.55);
        g.fillStyle = wood;
        g.fill();

        g.shadowColor = 'transparent';
        g.lineWidth = Math.max(1.2, outerW * 0.008);
        g.strokeStyle = 'rgba(212, 174, 92, 0.72)';
        roundedRect(g, border * 0.36, border * 0.36, outerW - border * 0.72, outerH - border * 0.72, border * 0.35);
        g.stroke();

        g.save();
        roundedRect(g, innerX, innerY, innerW, innerH, border * 0.22);
        g.clip();
        drawCover(g, frame.image, innerX, innerY, innerW, innerH);
        const glass = g.createLinearGradient(innerX, innerY, innerX + innerW, innerY + innerH);
        glass.addColorStop(0, 'rgba(255,255,255,0.13)');
        glass.addColorStop(0.35, 'rgba(255,255,255,0.015)');
        glass.addColorStop(1, 'rgba(2,28,35,0.10)');
        g.fillStyle = glass;
        g.fillRect(innerX, innerY, innerW, innerH);
        g.restore();

        g.lineWidth = Math.max(1, outerW * 0.006);
        g.strokeStyle = 'rgba(6, 14, 12, 0.72)';
        roundedRect(g, innerX, innerY, innerW, innerH, border * 0.22);
        g.stroke();

        g.globalAlpha = 0.13;
        g.strokeStyle = index % 2 ? '#d5b26f' : '#9d733d';
        g.lineWidth = Math.max(1, outerW * 0.004);
        for (let line = border * 0.55; line < outerH - border * 0.4; line += border * 0.45) {
            g.beginPath();
            g.moveTo(border * 0.2, line);
            g.quadraticCurveTo(outerW * 0.5, line + Math.sin(line) * 2, outerW - border * 0.2, line);
            g.stroke();
        }
        g.restore();
    }

    syncImages();
    return {
        update: syncImages,
        layers: {
            hud: g => {
                if (!config.photoFramesShow) return;
                for (let i = 0; i < frames.length; i++) drawFrame(g, frames[i], i);
            }
        },
        inspect: () => frames.map(frame => ({ key: frame.key, source: frame.source, ready: frame.ready })),
        dispose() {
            for (const frame of frames) {
                if (frame.image) frame.image.onload = frame.image.onerror = null;
                frame.image = null;
                frame.ready = false;
            }
        }
    };
}
