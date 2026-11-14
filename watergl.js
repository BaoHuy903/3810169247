/* ===========================================================================
 * WaterGL —— 光感(caustics)与涟漪的 WebGL 生成器
 * ---------------------------------------------------------------------------
 * 为什么是这样接的:壁纸的 ctx 已经把【光感】和【涟漪】画在鱼【之上】
 * (render() 里 drawCausticsEx → 远场压暗 → ripples[].draw → overlay)。
 * 所以不需要拆画布分层 —— 只要把这两个绘制函数换成"WebGL 生成一张图,
 * 再 drawImage 合成回同一条流水线",池塘/鱼/饲料/时间/水面扰动一律不动。
 * 风险面因此很小,而且两个开关(useGpuCaustics / useGpuRipples)就能整段回退。
 *
 * 参数 = 用户认可的那版基线(见知识库 projects/koi-wallpaper-WebGL试验页基线参数):
 *   光感  CausticTriTwist: netScale 1.8  netPow 11  netGain 0.90  netSpeed 0.25
 *   涟漪  解析环:N' 光向 232°/仰角 55°、陡度 1.05、高光锐度 250、ks 0.90、kd 0.40
 *        λ = 0.25R、波脊 σ=0.16λ、两侧波谷 ±0.50λ(σ=0.18λ、深 0.45)
 *   renderScale 0.5(半分辨率,实测省 68%)
 *
 * 算法出处:caustics 三法见《中级Shader教程26 水专题03》,源头 shadertoy MdKXDm / MdlXz8。
 * =========================================================================== */
const WaterGL = (function () {
    let gl = null, why = '', causAttempted = false, ripAttempted = false;
    const dpr = () => Math.min(2, window.devicePixelRatio || 1);

    /* ---------- 基线参数(改这里 = 改观感) ---------- */
    const P = {
        rs: 0.5,                 // 渲染比例(半分辨率)
        // —— 光感 ——
        /* ★ cGain 从实验页的 0.90 压到 0.32(实测:0.90 时安静水面 +9%,0.45 时 +5%,0.32 ≈ +2):实验页是【平色水面】调的,
         *   搬到池塘上实测把安静水面整体抬亮 +9%(96.0→104.8),整片水发灰发糊。
         *   用户之前就是因为"光感更差了"才把它整段关掉,所以这里按
         *   "别动池塘的整体亮度"来压;想要更明显把 cGain 调回去即可。 */
        cScale: 1.8, cPow: 11.0, cGain: 0.32, cSpeed: 0.25,
        // —— 涟漪 ——
        az: 232, elev: 55, steep: 1.05, shiny: 250, ks: 0.90, kd: 0.40,
        lamRatio: 0.25,
        ridgeA: 0.16, ridgeB: 0.50, ridgeC: 0.18, ridgeD: 0.45,
        // —— 颜色(和 theme.js 的 water.ripple 一致) ——
        crest: [1.00, 0.984, 0.949],
        trough: [0.086, 0.204, 0.212]
    };
    /* ★ 光向【每次现算】,不在加载时固化。
     *   原来是 `const LIGHT_H = [...]` —— 加载时算一次,之后改 P.az 对涟漪高光完全无效
     *   (和 ripples.js/fish-renderer.js/clock.js 里 LIGHT_DX 那个坑是同一个)。
     *   允许 P.az 运行时变,才能让"光随时间走"(experiments/day-phase)照到涟漪上。 */
    const lightH = () => { const r = P.az * Math.PI / 180; return [Math.cos(r), Math.sin(r)]; };

    /* ---------- 着色器 ---------- */
    const VS = `#version 300 es
in vec2 aPos; out vec2 vUV;
void main(){ vUV = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

    /* 光感:CausticTriTwist(多层三角函数扭动叠加)。time 作为向量的第三维参与运算,
     * 所以图案【自己就在变】,不需要额外做漂移。 */
    const FS_CAUSTIC = `#version 300 es
precision highp float;
in vec2 vUV; out vec4 outColor;
uniform vec2  uRes;
uniform float uTime, uScale, uPow, uGain;
void main(){
    vec2 uv = vec2(vUV.x, 1.0 - vUV.y) * uRes;
    vec2 p = mod(uv / uRes.y * uScale * 6.28318, 6.28318) - 250.0;
    vec2 i = p; float c = 1.0; float inten = 0.005;
    for (int n = 0; n < 5; n++) {
        float t = uTime * (1.0 - (3.5 / float(n + 1)));
        i = p + vec2(cos(t - i.x) + sin(t + i.y), sin(t - i.y) + cos(t + i.x));
        c += 1.0 / length(vec2(p.x / (sin(i.x + t) / inten), p.y / (cos(i.y + t) / inten)));
    }
    c /= 5.0;
    c = 1.17 - pow(c, 1.4);
    float v = pow(abs(c), uPow) * uGain;
    outColor = vec4(vec3(1.0), clamp(v, 0.0, 1.0));      // 只出"要加的光",颜色交给合成
}`;

    /* 涟漪:解析环 —— 径向剖面(波脊 + 两侧波谷)算出来,再按光向做法线光照。
     * uPass 0 = 亮脊(screen 合成),1 = 两侧暗带(source-over 压暗)。
     * 坐标原点 = 环心,单位 px(已按 renderScale 缩放)。 */
    const FS_RIPPLE = `#version 300 es
precision highp float;
in vec2 vUV; out vec4 outColor;
uniform vec2  uRes, uCenter, uLightH;
uniform float uR, uLam, uAmp, uSteep, uShiny, uKs, uKd, uElev;
uniform float uRidgeA, uRidgeB, uRidgeC, uRidgeD;
uniform int   uPass;
uniform vec3  uColor;

/* 波形剖面:一圈波脊 + 两侧浅波谷(和实验页同一套) */
float ridge(float u){
    float a = exp(-(u / uRidgeA) * (u / uRidgeA));
    float b = exp(-((u - uRidgeB) / uRidgeC) * ((u - uRidgeB) / uRidgeC));
    float c = exp(-((u + uRidgeB) / uRidgeC) * ((u + uRidgeB) / uRidgeC));
    return a - uRidgeD * (b + c);
}
float dridge(float u){
    float a = -2.0 * u / (uRidgeA * uRidgeA) * exp(-(u / uRidgeA) * (u / uRidgeA));
    float b = -2.0 * (u - uRidgeB) / (uRidgeC * uRidgeC) * exp(-((u - uRidgeB) / uRidgeC) * ((u - uRidgeB) / uRidgeC));
    float c = -2.0 * (u + uRidgeB) / (uRidgeC * uRidgeC) * exp(-((u + uRidgeB) / uRidgeC) * ((u + uRidgeB) / uRidgeC));
    return a - uRidgeD * (b + c);
}
const float DMAX = 2.42;      // |dridge| 的峰值(归一化用)

void main(){
    vec2 pos = vec2(vUV.x, 1.0 - vUV.y) * uRes;
    vec2 d = pos - uCenter;
    float dist = length(d) + 1e-4;
    float u = (dist - uR) / uLam;
    if (abs(u) > 1.7) { outColor = vec4(0.0); return; }

    /* 环的强度:时间+扩散衰减(和 Canvas2D 版同一套) */
    float prof = ridge(u);
    /* ★ 亮脊必须【收窄】。直接用完整高斯(σ=0.16λ)会把环附近整段都抬亮,
     *   量出来就是"宽亮晕"——原本该是暗带的地方(环内侧 r≈105~120)都被抬了 +16~+26。
     *   取幂次把亮带压细;暗带保持原样(它是两侧的浅波谷)。 */
    float band = (uPass == 0) ? pow(max(prof, 0.0), 2.6)
                              : pow(max(-prof, 0.0), 1.2) * (uRidgeD / 0.45);

    /* 法线光照:沿半径方向的斜率,投影到全局光向 */
    vec2 rhat = d / dist;
    float slope = uSteep * dridge(u) / DMAX;
    vec3 n = normalize(vec3(-slope * rhat, 1.0));
    vec3 L = normalize(vec3(uLightH * cos(uElev), sin(uElev)));
    float ndl = max(dot(n, L), 0.0);
    vec3 Hv = normalize(L + vec3(0.0, 0.0, 1.0));
    float spec = pow(max(dot(n, Hv), 0.0), uShiny);
    float shade = uKd * ndl + uKs * spec;

    /* 角向包络:和 Canvas2D 版一致 —— 迎光侧显形、背光侧淡出(暗带保留一点) */
    float cosA = dot(rhat, uLightH);
    float env = (uPass == 0) ? max(cosA, 0.0) : (0.35 + 0.65 * max(cosA, 0.0));

    /* 暗带那一趟补一档强度:它的 shade 主要来自漫反射(比高光弱得多),
     *   实测压不过原版 Canvas2D 的暗带(环内侧还亮 +6~9)。 */
    float boost = (uPass == 0) ? 1.0 : 1.9;
    float a = clamp(band * shade * env * uAmp * 3.4 * boost, 0.0, 1.0);
    outColor = vec4(uColor, a);
}`;

    /* ---------- 起手 ----------
     * ★ 两个 WebGL 上下文(光感一个、涟漪一个)【不能共用 buffer / program】——
     *   顶点缓冲、着色器程序都绑定在各自的 context 上。第一版写成一个 quadBuf
     *   共用,涟漪那趟会直接画不出来(而且不报错,最难查)。 */
    function makeCtx(canvas, fsSrc, uniforms) {
        let g = null;
        try { g = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: false, antialias: false }); }
        catch (e) { g = null; }
        if (!g) { why = '没有 WebGL2'; return null; }
        const mk = (type, src) => {
            const s = g.createShader(type);
            g.shaderSource(s, src); g.compileShader(s);
            if (!g.getShaderParameter(s, g.COMPILE_STATUS)) why = gl_src_info(src) + g.getShaderInfoLog(s);
            return s;
        };
        const pr = g.createProgram();
        const vs = mk(g.VERTEX_SHADER, VS), fs = mk(g.FRAGMENT_SHADER, fsSrc);
        g.attachShader(pr, vs); g.attachShader(pr, fs);
        g.linkProgram(pr);
        g.deleteShader(vs); g.deleteShader(fs);
        if (!g.getProgramParameter(pr, g.LINK_STATUS)) why = g.getProgramInfoLog(pr);
        const qb = g.createBuffer();
        g.bindBuffer(g.ARRAY_BUFFER, qb);
        g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), g.STATIC_DRAW);
        const loc = {};
        uniforms.forEach(n => { loc[n] = g.getUniformLocation(pr, n); });
        return { g, pr, qb, loc };
    }
    function gl_src_info(src) {
        const lines = String(src).split('\n').slice(0, 6).join(' | ');
        return '着色器编译失败(前几行: ' + lines.slice(0, 120) + ') ';
    }
    function drawQuad(ctx, setU) {
        const { g, pr, qb } = ctx;
        g.useProgram(pr);
        g.bindBuffer(g.ARRAY_BUFFER, qb);
        const a = g.getAttribLocation(pr, 'aPos');
        g.enableVertexAttribArray(a);
        g.vertexAttribPointer(a, 2, g.FLOAT, false, 0, 0);
        setU(g, ctx.loc);
        g.drawArrays(g.TRIANGLE_STRIP, 0, 4);
    }

    const CAUS_U = ['uRes', 'uTime', 'uScale', 'uPow', 'uGain'];
    const RIP_U = ['uRes', 'uCenter', 'uLightH', 'uR', 'uLam', 'uAmp', 'uSteep', 'uShiny',
                   'uKs', 'uKd', 'uElev', 'uRidgeA', 'uRidgeB', 'uRidgeC', 'uRidgeD', 'uPass', 'uColor'];
    const causCanvas = document.createElement('canvas');
    const ripCanvas = document.createElement('canvas');
    let ctxCaus = null, ctxRip = null;

    function init() {
        if (causAttempted) return !!ctxCaus && !ctxCaus.g.isContextLost();
        causAttempted = true;
        ctxCaus = makeCtx(causCanvas, FS_CAUSTIC, CAUS_U);
        return !!ctxCaus && !why;
    }
    function initRipple() {
        if (ripAttempted) return !!ctxRip && !ctxRip.g.isContextLost();
        ripAttempted = true;
        ctxRip = makeCtx(ripCanvas, FS_RIPPLE, RIP_U);
        return !!ctxRip && !why;
    }

    /* ---------- 对外:光感 ---------- */
    function causticsCanvas(w, h, time) {
        if (!init()) return null;
        const W = Math.max(2, Math.round(w * P.rs)), H = Math.max(2, Math.round(h * P.rs));
        if (causCanvas.width !== W || causCanvas.height !== H) { causCanvas.width = W; causCanvas.height = H; }
        const g = ctxCaus.g;
        g.viewport(0, 0, W, H);
        g.clearColor(0, 0, 0, 0); g.clear(g.COLOR_BUFFER_BIT);
        drawQuad(ctxCaus, (gg, u) => {
            gg.uniform2f(u.uRes, W, H);
            gg.uniform1f(u.uTime, time * P.cSpeed);
            gg.uniform1f(u.uScale, P.cScale);
            gg.uniform1f(u.uPow, P.cPow);
            gg.uniform1f(u.uGain, P.cGain);
        });
        return causCanvas;
    }

    /* ---------- 对外:一层涟漪(亮脊 / 暗带各渲一趟,合成模式不同) ---------- */
    function rippleCanvas(r, pass) {
        if (!initRipple()) return null;
        const lam = Math.max(2, r.radius * P.lamRatio);
        const size = Math.ceil((r.radius + lam * 1.8) * 2);
        const W = Math.max(4, Math.round(size * P.rs)), H = W;
        if (ripCanvas.width !== W || ripCanvas.height !== H) { ripCanvas.width = W; ripCanvas.height = H; }
        const g = ctxRip.g;
        g.viewport(0, 0, W, H);
        g.clearColor(0, 0, 0, 0); g.clear(g.COLOR_BUFFER_BIT);
        drawQuad(ctxRip, (gg, u) => {
            gg.uniform2f(u.uRes, W, H);
            gg.uniform2f(u.uCenter, W / 2, H / 2);
            const LH = lightH();
            gg.uniform2f(u.uLightH, LH[0], LH[1]);
            gg.uniform1f(u.uR, r.radius * P.rs);
            gg.uniform1f(u.uLam, lam * P.rs);
            gg.uniform1f(u.uAmp, (typeof r.intensity === 'function') ? r.intensity() : 1);
            gg.uniform1f(u.uSteep, P.steep);
            gg.uniform1f(u.uShiny, P.shiny);
            gg.uniform1f(u.uKs, P.ks);
            gg.uniform1f(u.uKd, P.kd);
            gg.uniform1f(u.uElev, P.elev * Math.PI / 180);
            gg.uniform1f(u.uRidgeA, P.ridgeA);
            gg.uniform1f(u.uRidgeB, P.ridgeB);
            gg.uniform1f(u.uRidgeC, P.ridgeC);
            gg.uniform1f(u.uRidgeD, P.ridgeD);
            gg.uniform1i(u.uPass, pass);
            const col = pass === 0 ? P.crest : P.trough;
            gg.uniform3f(u.uColor, col[0], col[1], col[2]);
        });
        return { canvas: ripCanvas, x: r.x - size / 2, y: r.y - size / 2, size: size };
    }

    function dispose() {
        for (const ctx of [ctxCaus, ctxRip]) {
            if (!ctx) continue;
            ctx.g.deleteBuffer(ctx.qb); ctx.g.deleteProgram(ctx.pr);
        }
        ctxCaus = ctxRip = null;
        causCanvas.width = causCanvas.height = ripCanvas.width = ripCanvas.height = 1;
        causAttempted = ripAttempted = false; why = '';
    }

    return {
        dispose,
        P,
        get ready() { return !!ctxCaus && !ctxCaus.g.isContextLost(); },
        get error() { return why; },
        init,
        causticsCanvas,
        rippleCanvas
    };
})();

// Full-surface height-field ripples, adapted from BichiPond's damped wave solver.
WaterGL.createWaveField = function createWaveField(viewport) {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false });
    if (!gl || !gl.getExtension('EXT_color_buffer_float')) return null;
    const sceneCanvas = document.createElement('canvas');
    const sceneCtx = sceneCanvas.getContext('2d', { alpha: false });
    let lost = false, warned = false;
    const onContextLost = event => { event.preventDefault(); lost = true; };
    canvas.addEventListener('webglcontextlost', onContextLost, false);
    const VS = `#version 300 es
in vec2 p; out vec2 uv; void main(){uv=p*.5+.5;gl_Position=vec4(p,0,1);}`;
    const DROP = `#version 300 es
precision highp float; uniform sampler2D state; uniform vec4 hit; uniform float aspect;
in vec2 uv; out vec4 o; void main(){o=texture(state,uv);float d=length((uv-hit.xy)*vec2(aspect,1.))/hit.z;if(d<1.)o.r+=(.5+.5*cos(d*3.14159265))*hit.w;}`;
    const STEP = `#version 300 es
precision highp float; uniform sampler2D state; uniform vec2 texel; uniform float aspect; in vec2 uv; out vec4 o;
void main(){vec4 s=texture(state,uv);float avg=.25*(texture(state,uv+vec2(texel.x,0.)).r+texture(state,uv-vec2(texel.x,0.)).r+texture(state,uv+vec2(0.,texel.y)).r+texture(state,uv-vec2(0.,texel.y)).r);s.g+=(avg-s.r)*1.9;vec2 e=min(uv,1.-uv);float edge=smoothstep(0.,.04,min(e.x*aspect,e.y));s.g*=mix(.9,.994,edge);s.r+=s.g;s.r=mix(s.r,avg,.012)*mix(.95,.9993,edge);o=s;}`;
    const SHOW = `#version 300 es
precision highp float; uniform sampler2D state, scene; uniform vec2 texel, view; in vec2 uv; out vec4 o;
void main(){vec2 st=texel*1.5;float l=texture(state,uv-vec2(st.x,0)).r,r=texture(state,uv+vec2(st.x,0)).r,d=texture(state,uv-vec2(0,st.y)).r,u=texture(state,uv+vec2(0,st.y)).r;vec2 g=vec2(r-l,u-d)*9.;g/=1.+length(g)*.8;float a=smoothstep(.002,.022,length(g));vec3 N=normalize(vec3(-g,1.));vec3 col=texture(scene,clamp(uv+N.xy*14./view,.001,.999)).rgb;col*=1.+dot(-g,normalize(vec2(-.72,.69)))*.3;o=vec4(col*a,a);}`;
    const shader = (type, src) => { const s=gl.createShader(type); gl.shaderSource(s,src); gl.compileShader(s); if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(s)); return s; };
    const program = src => { const p=gl.createProgram(); gl.attachShader(p,shader(gl.VERTEX_SHADER,VS)); gl.attachShader(p,shader(gl.FRAGMENT_SHADER,src)); gl.linkProgram(p); if(!gl.getProgramParameter(p,gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(p)); return p; };
    let dropP, stepP, showP;
    try { dropP=program(DROP); stepP=program(STEP); showP=program(SHOW); } catch { return null; }
    const quad=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,quad); gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
    let w=0,h=0,simW=0,simH=0,front=0,targets=[],pending=[],acc=0;
    const sceneTex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,sceneTex);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    const makeTarget=()=>{const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA16F,simW,simH,0,gl.RGBA,gl.HALF_FLOAT,null);const fb=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,fb);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,tex,0);if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE){gl.deleteTexture(tex);gl.deleteFramebuffer(fb);return null;}return{tex,fb};};
    const resize=()=>{const nw=Math.max(1,viewport.width|0),nh=Math.max(1,viewport.height|0);if(nw===w&&nh===h)return;w=nw;h=nh;simW=Math.min(900,Math.ceil(w/3));simH=Math.min(900,Math.ceil(h/3));canvas.width=sceneCanvas.width=simW;canvas.height=sceneCanvas.height=simH;for(const t of targets){if(t){gl.deleteTexture(t.tex);gl.deleteFramebuffer(t.fb);}}targets=[makeTarget(),makeTarget()];if(!targets[0]||!targets[1])throw Error('Ripple framebuffer is unavailable');gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,sceneTex);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,simW,simH,0,gl.RGBA,gl.UNSIGNED_BYTE,null);for(const t of targets){gl.bindFramebuffer(gl.FRAMEBUFFER,t.fb);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);}front=0;};
    const drawQuad=p=>{gl.useProgram(p);gl.bindBuffer(gl.ARRAY_BUFFER,quad);const a=gl.getAttribLocation(p,'p');gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,2,gl.FLOAT,false,0,0);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);};
    const pass=(p,setup)=>{gl.viewport(0,0,simW,simH);gl.bindTexture(gl.TEXTURE_2D,targets[front].tex);gl.bindFramebuffer(gl.FRAMEBUFFER,targets[1-front].fb);gl.useProgram(p);gl.uniform1i(gl.getUniformLocation(p,'state'),0);setup?.(p);drawQuad(p);front=1-front;};
    const api={
      drop(x,y,radius,strength){if(!lost&&pending.length<96)pending.push([x,y,radius,strength]);},
      update(dt){if(lost)return;try{resize();while(pending.length){const [x,y,r,s]=pending.shift();pass(dropP,pr=>{const minR=2.6*h/simH,rr=Math.max(r,minR);gl.uniform4f(gl.getUniformLocation(pr,'hit'),x/w,1-y/h,rr/h,s*Math.min(1,r/rr+.25));gl.uniform1f(gl.getUniformLocation(pr,'aspect'),w/h);});}acc=Math.min(4,acc+dt*90);while(acc>=1){acc--;pass(stepP,pr=>{gl.uniform2f(gl.getUniformLocation(pr,'texel'),1/simW,1/simH);gl.uniform1f(gl.getUniformLocation(pr,'aspect'),w/h);});}}catch(error){lost=true;if(!warned){warned=true;console.warn('[koi] Ripple simulation disabled:',error);}}},
      draw(ctx){if(lost)return;try{resize();sceneCtx.setTransform(1,0,0,1,0,0);sceneCtx.drawImage(ctx.canvas,0,0,simW,simH);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,sceneTex);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,gl.RGBA,gl.UNSIGNED_BYTE,sceneCanvas);gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,simW,simH);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,targets[front].tex);gl.useProgram(showP);gl.uniform1i(gl.getUniformLocation(showP,'state'),0);gl.uniform1i(gl.getUniformLocation(showP,'scene'),1);gl.uniform2f(gl.getUniformLocation(showP,'texel'),1/simW,1/simH);gl.uniform2f(gl.getUniformLocation(showP,'view'),w,h);drawQuad(showP);ctx.drawImage(canvas,0,0,w,h);}catch(error){lost=true;if(!warned){warned=true;console.warn('[koi] Ripple rendering disabled:',error);}}},
      dispose(){canvas.removeEventListener('webglcontextlost',onContextLost,false);if(!lost){for(const t of targets){if(t){gl.deleteTexture(t.tex);gl.deleteFramebuffer(t.fb);}}gl.deleteTexture(sceneTex);gl.deleteBuffer(quad);for(const p of [dropP,stepP,showP])gl.deleteProgram(p);}canvas.width=canvas.height=sceneCanvas.width=sceneCanvas.height=1;WaterGL.waveImpact=null;}
    };
    try { resize(); } catch { api.dispose(); return null; }
    WaterGL.waveImpact=api.drop.bind(api);
    return api;
};
