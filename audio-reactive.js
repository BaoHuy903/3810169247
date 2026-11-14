/* Koi Pond — Wallpaper Engine audio reactive visualizer.
 * Receives actual system audio frequency samples via wallpaperRegisterAudioListener.
 * Does not capture microphone or play any audio.
 */
(() => {
  'use strict';
  const canvas = document.createElement('canvas');
  canvas.id = 'koi-audio-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return;
  const glow = document.createElement('div');
  glow.id = 'koi-audio-glow';
  glow.setAttribute('aria-hidden', 'true');
  document.body.appendChild(glow);

  const opts = { audioEnabled: true, audioBars: true, audioWater: true,
    audioGlow: true, audioSensitivity: 100, audioBarCount: 48,
    audioColor: '0.23 0.82 0.92', audioMove: false, audioPositionX: 50, audioPositionY: 94, audioWidth: 70 };
  // Draggable visualizer anchor. Sliders remain usable when desktop pointer input is disabled.
  const drag = document.createElement('div');
  drag.id = 'koi-audio-drag';
  drag.textContent = '✥ Kéo để di chuyển sóng nhạc';
  drag.title = 'Giữ chuột và kéo để đổi vị trí cột sóng nhạc';
  document.body.appendChild(drag);
  let movedByUser = false;
  try {
    const saved = JSON.parse(localStorage.getItem('koi.audio.position.v1') || 'null');
    if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
      opts.audioPositionX = clampPosition(saved.x);
      opts.audioPositionY = clampPosition(saved.y);
      movedByUser = true;
    }
  } catch (_) {}
  function clampPosition(v) { return Math.min(100, Math.max(0, v)); }
  function placeHandle() {
    drag.style.left = `${opts.audioPositionX}%`;
    drag.style.top = `${opts.audioPositionY}%`;
    drag.style.display = opts.audioEnabled && opts.audioBars && opts.audioMove ? 'block' : 'none';
  }
  let activePointer = null;
  drag.addEventListener('pointerdown', e => {
    if (!opts.audioMove) return;
    activePointer = e.pointerId;
    drag.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  drag.addEventListener('pointermove', e => {
    if (activePointer !== e.pointerId) return;
    opts.audioPositionX = clampPosition(e.clientX / Math.max(1, innerWidth) * 100);
    opts.audioPositionY = clampPosition(e.clientY / Math.max(1, innerHeight) * 100);
    movedByUser = true;
    placeHandle();
    e.preventDefault();
  });
  function finishDrag(e) {
    if (activePointer !== e.pointerId) return;
    activePointer = null;
    try { localStorage.setItem('koi.audio.position.v1', JSON.stringify({ x: opts.audioPositionX, y: opts.audioPositionY })); } catch (_) {}
  }
  drag.addEventListener('pointerup', finishDrag);
  drag.addEventListener('pointercancel', finishDrag);
  placeHandle();
  const bins = new Float32Array(64);
  const smoothed = new Float32Array(64);
  const ripples = [];
  let lastSample = 0, lastFrame = 0, lastRipple = 0, lastBass = 0;
  let width = 1, height = 1, dpr = 1;
  let running = true;
  const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
  const color = () => {
    const parts = String(opts.audioColor).trim().split(/\s+/).map(Number);
    if (parts.length !== 3 || parts.some(v => !Number.isFinite(v))) return [58, 209, 235];
    return parts.map(v => Math.round(clamp(v, 0, 1) * 255));
  };
  const rgba = (alpha) => { const c = color(); return `rgba(${c[0]},${c[1]},${c[2]},${clamp(alpha,0,1)})`; };

  // Wallpaper Engine sends 128 frequency values (left 64, right 64).
  // Average channels; handle other array lengths gracefully.
  function onAudio(samples) {
    if (!samples || !samples.length) return;
    const half = Math.floor(samples.length / 2);
    const stereo = samples.length >= 128;
    for (let i = 0; i < 64; i++) {
      const idx = stereo ? i : Math.floor(i * samples.length / 64);
      const a = Number(samples[idx]) || 0;
      const b = stereo ? (Number(samples[half + i]) || 0) : a;
      bins[i] = clamp((a + b) * 0.5, 0, 2);
    }
    lastSample = performance.now();
    status.textContent='Âm thanh: đang nhận dữ liệu';
  }
  const status = document.createElement('div');
  status.id='koi-audio-status';
  status.textContent='Âm thanh: đang chờ Wallpaper Engine';
  document.body.appendChild(status);
  let registered=false;
  function registerAudio(){
    if(registered || typeof window.wallpaperRegisterAudioListener!=='function')return;
    try{window.wallpaperRegisterAudioListener(onAudio);registered=true;status.textContent='Âm thanh: đã kết nối, chờ nhạc';}
    catch(e){console.warn('[Koi Audio] Không đăng ký được âm thanh',e);}
  }
  registerAudio();
  window.addEventListener('load',registerAudio);
  let retries=0;
  const audioRetry=setInterval(()=>{registerAudio();if(registered||++retries>20)clearInterval(audioRetry);},500);


  function apply(properties) {
    for (const key of Object.keys(opts)) {
      if (!(key in properties)) continue;
      if (movedByUser && (key === 'audioPositionX' || key === 'audioPositionY')) continue;
      const raw = properties[key]?.value ?? properties[key];
      if (typeof opts[key] === 'boolean') opts[key] = raw === true || raw === 1;
      else if (typeof opts[key] === 'number') {
        const v = Number(raw);
        if (Number.isFinite(v)) opts[key] = v;
      } else if (typeof raw === 'string') opts[key] = raw;
    }
    opts.audioSensitivity = clamp(opts.audioSensitivity, 0, 300);
    opts.audioBarCount = Math.round(clamp(opts.audioBarCount, 12, 96));
    opts.audioPositionX = clampPosition(opts.audioPositionX);
    opts.audioPositionY = clampPosition(opts.audioPositionY);
    opts.audioWidth = clamp(opts.audioWidth, 15, 100);
    placeHandle();
    if (!opts.audioEnabled) { ctx.clearRect(0, 0, width, height); glow.style.opacity = '0'; }
  }
  window.addEventListener('koi:audio-properties', event => apply(event.detail || {}));
  if (window.__koiAudioProperties) apply(window.__koiAudioProperties);

  // Use a wrapper instead of overwriting the existing wallpaper listener.
  function hookProperties() {
    const listener = window.wallpaperPropertyListener;
    if (!listener || typeof listener.applyUserProperties !== 'function') return;
    if (listener.applyUserProperties.__koiAudioWrapped) return;
    const original = listener.applyUserProperties;
    const wrapped = function (properties, ...args) {
      apply(properties || {});
      return original.call(this, properties, ...args);
    };
    wrapped.__koiAudioWrapped = true;
    listener.applyUserProperties = wrapped;
  }
  hookProperties();
  // The bundle may register the listener asynchronously; try once after page load.
  window.addEventListener('load', hookProperties, { once: true });

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = Math.max(1, window.innerWidth);
    height = Math.max(1, window.innerHeight);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  function draw(now) {
    if (!running) return;
    requestAnimationFrame(draw);
    const dt = clamp((now - (lastFrame || now)) / 1000, 0, 0.1);
    lastFrame = now;
    ctx.clearRect(0, 0, width, height);
    status.style.display=opts.audioEnabled?'block':'none';
    if (!opts.audioEnabled || document.hidden) { glow.style.opacity = '0'; return; }
    const live = now - lastSample < 1200;
    if(now>3000 && !live && Math.floor(now/3000)!==Math.floor((now-32)/3000)) {
      status.textContent=registered?'Âm thanh: chưa có tín hiệu (kiểm tra Wallpaper Engine)':'Âm thanh: Wallpaper Engine chưa cung cấp API';
    }
    const factor = opts.audioSensitivity / 100;
    let bass = 0, energy = 0;
    for (let i = 0; i < 64; i++) {
      const target = live ? clamp(bins[i] * factor, 0, 1.5) : 0;
      const rate = target > smoothed[i] ? 0.44 : Math.min(1, dt * 7);
      smoothed[i] += (target - smoothed[i]) * rate;
      energy += smoothed[i];
      if (i < 8) bass += smoothed[i];
    }
    bass /= 8; energy /= 64;
    if (opts.audioWater) {
      if (bass > 0.16 && bass > lastBass * 1.12 && now - lastRipple > 240) {
        ripples.push({ x: width * (0.2 + Math.random() * 0.6), y: height * (0.3 + Math.random() * 0.45), age: 0, power: clamp(bass, 0, 1) });
        if (ripples.length > 14) ripples.shift();
        lastRipple = now;
      }
      for (let i = ripples.length - 1; i >= 0; i--) {
        const r = ripples[i]; r.age += dt;
        if (r.age > 2.2) { ripples.splice(i, 1); continue; }
        const alpha = (1 - r.age / 2.2) * r.power * 0.4;
        for (let ring = 0; ring < 3; ring++) {
          ctx.beginPath();
          ctx.ellipse(r.x, r.y, (r.age * 135 + ring * 23), (r.age * 46 + ring * 8), 0, 0, Math.PI * 2);
          ctx.lineWidth = 1.4 + r.power;
          ctx.strokeStyle = rgba(alpha * (1 - ring * 0.2));
          ctx.stroke();
        }
      }
    } else ripples.length = 0;
    lastBass = bass;
    if (opts.audioBars) {
      const count = opts.audioBarCount;
      const maxWidth = Math.min(width * opts.audioWidth / 100, 1400);
      const gap = Math.max(2, maxWidth / count * 0.24);
      const barW = (maxWidth - gap * (count - 1)) / count;
      const x0 = clamp(width * opts.audioPositionX / 100 - maxWidth / 2, 0, Math.max(0, width - maxWidth));
      const base = clamp(height * opts.audioPositionY / 100, 8, height - 5);
      for (let i = 0; i < count; i++) {
        const index = Math.floor(Math.pow(i / Math.max(1, count - 1), 1.25) * 63);
        const magnitude = smoothed[index];
        const h = 3 + Math.min(height * 0.22, Math.pow(magnitude, 0.72) * height * 0.19);
        const x = x0 + i * (barW + gap);
        const gradient = ctx.createLinearGradient(0, base - h, 0, base);
        gradient.addColorStop(0, rgba(0.7));
        gradient.addColorStop(1, rgba(0.1));
        ctx.fillStyle = gradient;
        ctx.fillRect(x, base - h, Math.max(1, barW), h);
      }
    }
    glow.style.opacity = opts.audioGlow ? String(clamp(energy * 1.25 + bass * 0.18, 0, 0.58)) : '0';
    glow.style.background = `radial-gradient(ellipse at 50% 70%, ${rgba(0.34)} 0%, transparent 70%)`;
    document.documentElement.style.setProperty('--koi-audio-frame-glow', opts.audioGlow ? rgba(clamp(energy * 0.65, 0, 0.6)) : 'transparent');
  }
  requestAnimationFrame(draw);
  window.addEventListener('pagehide', () => { running = false; });
})();
