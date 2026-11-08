/* CosmoCards — efeitos de golpes (partículas em canvas com as texturas originais do jogo) */
window.FX = (function () {
  const GAIN = 1.8;
  let dimEl = null, cv, ctx, IMG, W = 1280, H = 720, parts = [], raf = 0, last = 0, shakeT = 0, shakeA = 0, shakeEl = null;
  const imgs = {}, tintCache = {};
  const SHEETS = { impact6: [4, 4, 16], hitice: [4, 4, 16], firehit: [4, 4, 16], core01: [4, 4, 16], core03: [4, 4, 16], proj03: [4, 4, 16],
    proj07: [4, 4, 16], lightsub: [4, 4, 16], icesmoke: [4, 4, 16], dust: [4, 4, 16], wind05: [4, 4, 16], spark1: [4, 4, 16],
    elec: [7, 1, 7], fireball: [2, 1, 2], shieldbr: [2, 1, 2], flare02: [4, 2, 8], dragonsheet: [4, 2, 8] };
  const R = (a, b) => a + Math.random() * (b - a);
  const wait = ms => new Promise(r => setTimeout(r, ms));

  function init(canvas, img, shakeTarget, dim) {
    dimEl = dim; cv = canvas; ctx = cv.getContext('2d'); IMG = img; shakeEl = shakeTarget;
    for (const k in IMG) if (k.startsWith('fx_')) im(k.slice(3));
  }
  function im(k) {
    if (!imgs[k]) { const i = new Image(); i.src = IMG['fx_' + k] || IMG[k]; imgs[k] = i; }
    return imgs[k];
  }
  function tinted(k, color) {
    const i = im(k);
    if (!color || !i.naturalWidth) return i;
    const key = k + color;
    if (tintCache[key]) return tintCache[key];
    const c = document.createElement('canvas'); c.width = i.naturalWidth; c.height = i.naturalHeight;
    const g = c.getContext('2d');
    g.drawImage(i, 0, 0); g.globalCompositeOperation = 'multiply'; g.fillStyle = color; g.fillRect(0, 0, c.width, c.height);
    g.globalCompositeOperation = 'destination-in'; g.drawImage(i, 0, 0);
    tintCache[key] = c; return c;
  }
  function resize(w, h) { W = w; H = h; if (cv) { cv.width = w; cv.height = h; } }

  // p: {k, x, y, vx, vy, ax, ay, rot, vr, w, h, s, s1, sx, a, life, delay, fin, fout, color, blend, fps, loop, frame}
  function add(p) {
    p = Object.assign({ x: 0, y: 0, vx: 0, vy: 0, ax: 0, ay: 0, rot: 0, vr: 0, s: 1, s1: null, sx: 1, a: 1, life: 1, t: 0, delay: 0,
      fin: 0.08, fout: 0.35, blend: 'lighter', fps: 30, loop: false }, p);
    p.t = -p.delay; parts.push(p);
    if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
    return p;
  }
  function tick(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, H);
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.t += dt;
      if (p.t < 0) continue;
      if (p.t >= p.life) { parts.splice(i, 1); if (p.done) p.done(); continue; }
      p.vx += p.ax * dt; p.vy += p.ay * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      if (p.onUpdate) p.onUpdate(p, dt);
      draw(p);
    }
    if (shakeT > 0 && shakeEl) {
      shakeT -= dt; const a = shakeA * Math.max(0, shakeT) * 4;
      shakeEl.style.transform = shakeT > 0 ? `translate(${R(-a, a)}px,${R(-a, a)}px)` : '';
    }
    if (parts.length || shakeT > 0) raf = requestAnimationFrame(tick); else { raf = 0; ctx.clearRect(0, 0, W, H); }
  }
  function draw(p) {
    const f = p.t / p.life;
    let a = p.a;
    if (f < p.fin) a *= f / p.fin;
    if (f > 1 - p.fout) a *= (1 - f) / p.fout;
    if (a <= 0.003) return;
    if (p.type === 'flash') { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a; ctx.fillStyle = p.color; ctx.fillRect(0, 0, W, H); return; }
    if (p.type === 'wall') {
      const f2 = p.t / p.life, grow = 1 - Math.pow(1 - Math.min(1, f2 / 0.16), 3);
      const w = p.w, h = p.h * grow, x = p.x - w / 2, y = p.y + p.h / 2 - h;
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(1, a);
      const g = ctx.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, 'rgba(255,236,150,.62)'); g.addColorStop(0.5, 'rgba(255,196,70,.42)'); g.addColorStop(1, 'rgba(255,150,30,.55)');
      ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
      ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
      for (let k = 0; k < 7; k++) {   // faixas de energia subindo
        const yy = y + h - ((p.t * 230 + k * (p.h / 7)) % Math.max(1, h));
        const gg = ctx.createLinearGradient(0, yy - 14, 0, yy + 14); gg.addColorStop(0, 'rgba(255,255,255,0)'); gg.addColorStop(0.5, 'rgba(255,250,210,.55)'); gg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = gg; ctx.fillRect(x, yy - 14, w, 28);
      }
      ctx.restore();
      ctx.shadowColor = '#ffb000'; ctx.shadowBlur = 38; ctx.strokeStyle = '#fff1b0'; ctx.lineWidth = 7; ctx.strokeRect(x, y, w, h);
      ctx.shadowBlur = 0; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.strokeRect(x + 7, y + 7, w - 14, h - 14);
      ctx.globalAlpha = 1; return;
    }
    const img = tinted(p.k, p.color);
    if (!img || !(img.naturalWidth || img.width)) return;
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    let sx = 0, sy = 0, sw = iw, sh = ih;
    const sheet = SHEETS[p.k];
    if (sheet && !p.whole) {
      const [cols, rows, n] = sheet; sw = iw / cols; sh = ih / rows;
      let fr = p.frame != null ? p.frame : Math.floor(p.t * p.fps);
      fr = p.loop ? fr % n : Math.min(n - 1, fr);
      sx = (fr % cols) * sw; sy = Math.floor(fr / cols) * sh;
    }
    const sc = p.s1 != null ? p.s + (p.s1 - p.s) * f : p.s;
    const w = (p.w || sw) * sc, h = (p.h || (p.w ? p.w * sh / sw : sh)) * sc;
    ctx.globalCompositeOperation = p.blend; ctx.globalAlpha = Math.min(1, a);
    ctx.setTransform(1, 0, 0, 1, p.x, p.y); ctx.rotate(p.rot); if (p.sx !== 1) ctx.scale(p.sx, 1);
    ctx.drawImage(img, sx, sy, sw, sh, -w * (p.ox != null ? p.ox : 0.5), -h / 2, w, h);
    if (p.blend === 'lighter' && GAIN > 1) { ctx.globalAlpha = Math.min(1, a * (GAIN - 1)); ctx.drawImage(img, sx, sy, sw, sh, -w * (p.ox != null ? p.ox : 0.5), -h / 2, w, h); }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
  function shake(px, sec) { shakeA = Math.max(shakeA, px); shakeT = Math.max(shakeT, sec); if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); } }
  function flash(color, life = 0.35, a = 0.6) { add({ type: 'flash', color, life, a, fin: 0.05, fout: 0.9 }); }

  // ---------------- blocos de construção
  const ang = (A, B) => Math.atan2(B[1] - A[1], B[0] - A[0]);
  const dist = (A, B) => Math.hypot(B[0] - A[0], B[1] - A[1]);
  function proj(k, A, B, dur, o = {}) {
    return add(Object.assign({ k, x: A[0], y: A[1], vx: (B[0] - A[0]) / dur, vy: (B[1] - A[1]) / dur, life: dur, rot: o.rot != null ? o.rot : ang(A, B), fin: 0.05, fout: 0.15 }, o));
  }
  function streak(A, B, life, color, h = 30, delay = 0) {
    add({ k: 'flareline', x: (A[0] + B[0]) / 2, y: (A[1] + B[1]) / 2, rot: ang(A, B), w: dist(A, B), h, life, color, delay, fin: 0.1, fout: 0.7, whole: true });
  }
  function glow(at, color, w = 200, life = 0.5, delay = 0) { add({ k: 'glow', x: at[0], y: at[1], w, life, color, delay, s: 0.5, s1: 1.4, fout: 0.7 }); }
  function hit(at, color, big = 1) {
    add({ k: 'impact6', x: at[0], y: at[1], w: 300 * big, life: 0.55, color, fps: 30, fin: 0.01, fout: 0.3 });
    glow(at, color || '#fff2c0', 260 * big, 0.35);
    for (let i = 0; i < 8 * big; i++) add({ k: 'star4', x: at[0], y: at[1], vx: R(-420, 420), vy: R(-420, 260), ay: 500, w: R(16, 34), vr: R(-6, 6), life: R(0.35, 0.7), color: color || '#ffe9a8' });
  }
  function aura(at, color, life = 1.1) {
    add({ k: 'aura', x: at[0], y: at[1] + 40, w: 300, h: 460, life, color, a: 0.9, s: 0.85, s1: 1.1, fin: 0.25, fout: 0.45 });
    glow([at[0], at[1] + 120], color, 380, life * 0.8);
    for (let i = 0; i < 26; i++) add({ k: 'star4', x: at[0] + R(-110, 110), y: at[1] + R(40, 220), vy: R(-260, -120), w: R(10, 26), vr: R(-4, 4), life: R(0.6, 1.1), delay: R(0, 0.5), color });
  }
  function ring(k, at, s0, s1, life, color, o = {}) { add(Object.assign({ k, x: at[0], y: at[1], w: 300, s: s0, s1, life, color, fout: 0.6 }, o)); }
  // explosão de cosmo no peito: clarão branco + feixes de luz em leque (como no jogo original)
  function burst(A, col, d = 1) {
    const C = [A[0], A[1] - 40];
    glow(C, '#ffffff', 300, 0.55); glow(C, col, 460, 0.8, 0.05);
    add({ k: 'star4', x: C[0], y: C[1], w: 260, life: 0.45, color: '#ffffff', fin: 0.05, fout: 0.7, s: 0.4, s1: 1.3 });
    for (let i = 0; i < 7; i++) { const r = (-0.55 + i * 0.18) + (Math.random() - 0.5) * 0.12, L = 220 + Math.random() * 160;
      add({ k: 'flareline', x: C[0] + d * Math.cos(r) * L / 2, y: C[1] + Math.sin(r) * L / 2, rot: d > 0 ? r : Math.PI - r, w: L, h: 26 + Math.random() * 18, life: 0.6, delay: i * 0.025, color: i % 2 ? col : '#e8ffff', whole: true, fin: 0.08, fout: 0.65 }); }
    sparks(C, col, 14, 260);
  }
  function sparks(at, color, n = 16, sp = 300) {
    for (let i = 0; i < n; i++) add({ k: 'glow', x: at[0], y: at[1], vx: R(-sp, sp), vy: R(-sp, sp), w: R(14, 30), life: R(0.3, 0.7), color });
  }

  // ---------------- golpes especiais
  const SPECIALS = {
    async seiya(A, B, d, gold) {
      const col = '#7fe4ff', acc = gold ? '#ffe49a' : '#ffffff';
      aura(A, col, 1.7); if (gold) ring('circle2', A, 0.3, 1.5, 1.3, '#ffd66b', { vr: 2 });
      const N = gold ? 46 : 38;
      for (let i = 0; i < N; i++) {
        setTimeout(() => {
          const e = [B[0] + R(-90, 90), B[1] + R(-120, 90)];
          const s0 = [A[0] + d * R(30, 80), A[1] + R(-70, 50)];   // só horizontal, saindo do Seiya
          const dur = R(0.24, 0.34), sz = R(130, 230);
          streak(s0, e, dur * 2.2, '#3f9cff', R(18, 32));
          proj('glow', s0, e, dur, { w: sz * 1.25, color: '#2f86ff', a: 0.95 });   // fundo azul do punho
          proj('glow', s0, e, dur, { w: sz * 0.7, color: '#7fd0ff', a: 0.8 });
          proj('star4', s0, e, dur, { w: R(26, 46), vr: 14, color: acc, fout: 0.1 });
          proj('soco', s0, e, dur, { w: sz, sx: d, rot: 0, color: '#9fe0ff', s: 0.8, s1: 1.1, done: () => {
            add({ k: 'impact6', x: e[0], y: e[1], w: 170, life: 0.4, color: col, fin: 0.01 });
            add({ k: 'star4', x: e[0], y: e[1], w: R(50, 80), vr: 8, life: 0.3, color: acc }); sparks(e, col, 6, 260); } });
        }, i * 52);
      }
      await wait(N * 52 + 420);
      proj('glow', [A[0] + d * 60, A[1] - 30], [B[0], B[1] - 20], 0.38, { w: 520, color: '#2f86ff', a: 0.95, s: 0.7, s1: 1.7 });
      proj('soco', [A[0] + d * 60, A[1] - 30], [B[0], B[1] - 20], 0.38, { w: 300, sx: d, rot: 0, color: '#9fe0ff', s: 0.7, s1: 1.7, fin: 0.1, fout: 0.1 });
      streak([A[0] + d * 60, A[1] - 30], [B[0], B[1] - 20], 0.5, '#5fb8ff', 70);
      await wait(380); hit(B, col, 1.7); ring('shock', B, 0.3, 2.4, 0.7, col); shake(10, 0.5); flash(col, 0.35, 0.5);
      await wait(300);
    },
    async seiyasag(A, B, d) { return SPECIALS.seiya(A, B, d, true); },
    async seiyacap(A, B, d) { return SPECIALS.seiya(A, B, d); },
    async shiryu(A, B, d) {
      aura(A, '#5dff9e', 1.2); await wait(300);
      // o dragão nasce no chão do inimigo e sobe, crescendo (8 quadros da folha original)
      const fy = B[1] + 480, cw = 384, ch = 512, life = 1.5, sc0 = 1.0, sc1 = 1.3;
      ring('circlelight', [B[0], B[1] + 250], 0.2, 1.4, 0.9, '#5dff9e', { vr: 2 });
      glow([B[0], B[1] + 240], '#5dff9e', 420, 1.1);
      // folha sobre fundo preto: mistura aditiva (preto = transparente)
      add({ k: 'dragonsheet', x: B[0], y: fy, w: cw, h: ch, s: sc0, s1: sc1, life, fps: 8 / (life * 0.8), blend: 'lighter', fin: 0.12, fout: 0.3,
        onUpdate: p => { const f = Math.min(1, Math.max(0, p.t / p.life)); const s = sc0 + (sc1 - sc0) * f; p.y = fy - 40 - (ch * s) / 2 - 200 * f * f; } });
      for (let i = 0; i < 22; i++) setTimeout(() => sparks([B[0] + R(-80, 80), fy - 40 - i * 26], '#7dffb0', 3, 140), i * 45);
      await wait(900); hit([B[0], B[1] - 40], '#7dffb0', 1.5); ring('shock', B, 0.3, 2.4, 0.7, '#7dffb0'); shake(10, 0.5); flash('#3dff8a', 0.3, 0.45);
      await wait(700);
    },
    async shun(A, B, d) {
      glow(A, '#ff8be0', 260, 0.9);
      const n = 16, pts = [];
      for (let i = 0; i <= n; i++) { const t = i / n; pts.push([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t - Math.sin(t * Math.PI * 2) * 70 * (1 - t)]); }
      for (let i = 1; i <= n; i++) {
        const p = pts[i], q = pts[i - 1];
        add({ k: 'chain', x: p[0], y: p[1], w: 54, rot: ang(q, p) + (i % 2 ? 0.6 : -0.6), life: 1.25 - i * 0.03, delay: i * 0.035, color: '#ff9ee8', fin: 0.02, fout: 0.3 });
      }
      await wait(n * 35 + 120);
      ring('circlelight', B, 0.2, 1.3, 0.8, '#ff9ee8', { vr: 3 });
      add({ k: 'lightsub', x: B[0], y: B[1], w: 360, life: 0.6, color: '#c7a0ff', fps: 26 });
      hit(B, '#ffb3ee', 1.1); shake(6, 0.3); await wait(450);
    },
    async hyoga(A, B, d) {
      aura(A, '#bfeaff', 1.4);
      for (let i = 0; i < 70; i++) {
        const t0 = R(0, 0.9), sp = R(0.6, 1), ph = R(0, 6.28);
        add({ k: 'glow', x: A[0], y: A[1], w: R(14, 30), life: 1.0, delay: t0, color: '#dff6ff', onUpdate: (p) => {
          const f = p.t / p.life; p.x = A[0] + (B[0] - A[0]) * f * sp + Math.cos(ph + f * 12) * 40 * (1 - f); p.y = A[1] + (B[1] - A[1]) * f + Math.sin(ph + f * 12) * 60 * (1 - f); } });
      }
      await wait(800);
      add({ k: 'icesmoke', x: B[0], y: B[1], w: 520, life: 1.0, fps: 18, color: '#cfefff' });
      for (let i = 0; i < 5; i++) add({ k: 'spike', x: B[0] + R(-120, 120), y: B[1] + 160, w: R(110, 170), vy: -140, life: 0.9, delay: i * 0.05, fin: 0.1, fout: 0.4, blend: 'source-over', a: 0.9 });
      add({ k: 'hitice', x: B[0], y: B[1], w: 360, life: 0.6, fps: 28 });
      shake(6, 0.3); flash('#bfeaff', 0.3, 0.35); await wait(500);
    },
    async ikki(A, B, d) {
      aura(A, '#ff8a2a', 1.2); await wait(300);
      proj('fenix', [A[0], A[1] - 30], [B[0], B[1] - 20], 0.8, { w: 640, s: 0.5, s1: 1.2, sx: d, rot: 0, fin: 0.12, fout: 0.15 });
      for (let i = 0; i < 16; i++) setTimeout(() => add({ k: 'fireball', x: A[0] + (B[0] - A[0]) * i / 16, y: A[1] - 20 + R(-30, 30), w: 200, frame: i % 2, life: 0.5, vy: -60, fout: 0.8 }), i * 45);
      await wait(760);
      add({ k: 'firehit', x: B[0], y: B[1], w: 420, life: 0.6, fps: 28 }); hit(B, '#ffb060', 1.3);
      shake(10, 0.45); flash('#ff7a1a', 0.4, 0.45); await wait(350);
    },
    async mu(A, B, d) {
      const P = [A[0] + d * 170, A[1] + 30];
      glow([A[0], A[1] + 100], '#ffd34d', 320, 0.8);
      add({ type: 'wall', x: P[0], y: P[1], w: 170, h: 560, life: 2.1, fout: 0.25 });
      for (let i = 0; i < 34; i++) add({ k: 'glow', x: P[0] + R(-85, 85), y: P[1] + R(80, 280), vy: R(-200, -80), w: R(14, 30), life: R(0.8, 1.4), delay: R(0, 1.1), color: '#ffe27a' });
      await wait(1700);
    },
    async aldebaran(A, B, d) {
      add({ k: 'horn', x: A[0] + d * 60, y: A[1] - 40, w: 520, life: 1.3, sx: d, s: 0.7, s1: 1.05, fin: 0.2, fout: 0.4 });
      ring('shock', A, 0.3, 1.8, 0.9, '#7ff0ff'); aura(A, '#7ff0ff', 1.2); await wait(1200);
    },
    async horn(A, B, d) {
      proj('horn', A, B, 0.45, { w: 560, sx: d, rot: 0, s: 0.6, s1: 1.1 });
      await wait(420); ring('shock', B, 0.3, 2, 0.6, '#7ff0ff'); hit(B, '#9ff6ff', 1.4); shake(12, 0.5); flash('#5fe8ff', 0.35, 0.5); await wait(300);
    },
    async saga(A, B, d) {
      ring('circle2', B, 0.3, 1.5, 1.6, '#c9a8ff', { vr: 1.5, a: 0.8 });
      for (let i = 0; i < 50; i++) {
        const r0 = R(220, 380), a0 = R(0, 6.28), sp = R(2, 4);
        add({ k: 'star4', x: B[0], y: B[1], w: R(20, 50), life: 1.2, delay: R(0, 0.4), color: i % 3 ? '#ffffff' : '#c39bff', vr: 4, onUpdate: (p) => {
          const f = p.t / p.life, r = r0 * (1 - f); p.x = B[0] + Math.cos(a0 + f * sp * 6) * r; p.y = B[1] + Math.sin(a0 + f * sp * 6) * r * 0.6; } });
      }
      add({ k: 'core03', x: B[0], y: B[1], w: 420, life: 1.5, fps: 14, loop: true, s: 0.4, s1: 1.4 });
      await wait(1200); hit(B, '#e6d4ff', 1.6); ring('shock', B, 0.4, 2.6, 0.7, '#ffffff'); shake(14, 0.6); flash('#ffffff', 0.5, 0.7); await wait(450);
    },
    async deathmask(A, B, d) {
      for (let i = 0; i < 8; i++) add({ k: 'smoke', x: A[0] + d * 60, y: A[1] + R(-40, 40), vx: d * R(250, 420), vy: R(-30, 30), w: 360, life: 1.3, delay: i * 0.07, color: '#6a2cff', a: 0.6, s: 0.5, s1: 1.4, frame: i % 2 });
      proj('skull', [A[0], A[1] - 60], [B[0], B[1] - 40], 1.0, { w: 320, rot: 0, s: 0.4, s1: 1.2, fin: 0.2 });
      await wait(950); add({ k: 'wind05', x: B[0], y: B[1], w: 420, life: 0.8, color: '#b37dff' });
      hit(B, '#c08aff', 1.2); shake(8, 0.4); flash('#5a1fb0', 0.4, 0.45); await wait(350);
    },
    async shaka(A, B, d) {
      const C = [A[0] + d * 120, A[1] - 10];
      ['circle1', 'circle2', 'circle3', 'circle4'].forEach((k, i) => add({ k, x: C[0] + d * i * 40, y: C[1], w: 360 - i * 50, life: 1.9, s: 0.2, s1: 1, vr: (i % 2 ? -1 : 1) * 1.6, color: '#ffeab0', fin: 0.2, fout: 0.25, delay: i * 0.08 }));
      await wait(700);
      add({ k: 'flareblue', x: (C[0] + B[0]) / 2, y: (C[1] + B[1]) / 2, rot: ang(C, B), w: dist(C, B) + 200, h: 240, life: 1.0, color: '#fff0b0', whole: true, fin: 0.1, fout: 0.5 });
      add({ k: 'flareblue', x: (C[0] + B[0]) / 2, y: (C[1] + B[1]) / 2, rot: ang(C, B), w: dist(C, B) + 200, h: 120, life: 1.0, color: '#ffffff', whole: true, fin: 0.1, fout: 0.5 });
      await wait(450); hit(B, '#fff0b0', 1.5); shake(12, 0.5); flash('#ffe28a', 0.5, 0.6); await wait(500);
    },
    async miro(A, B, d) {
      glow(A, '#ff3b3b', 220, 1.4);
      for (let i = 0; i < 15; i++) {
        const e = [B[0] + R(-70, 70), B[1] + R(-120, 100)], s = [A[0] + d * 50, A[1] - 30];
        setTimeout(() => { streak(s, e, 0.22, '#ff3030', 14); add({ k: 'star4', x: e[0], y: e[1], w: 46, life: 0.5, vr: 5, color: '#ff4040' }); glow(e, '#ff2020', 90, 0.4); }, i * 75);
      }
      await wait(15 * 75 + 150); hit(B, '#ff5050', 1.1); shake(6, 0.3); flash('#ff1a1a', 0.3, 0.35); await wait(300);
    },
    async aioria(A, B, d) {
      aura(A, '#fff1a0', 1.6);
      for (let i = 0; i < 16; i++) setTimeout(() => {
        const s = [A[0] + d * 40, A[1] + R(-60, 40)], e = [B[0] + R(-50, 50), B[1] + R(-110, 90)];
        add({ k: 'bolt', x: (s[0] + e[0]) / 2, y: (s[1] + e[1]) / 2, rot: ang(s, e), w: dist(s, e), h: R(50, 90), life: 0.18, color: '#fff7c0', whole: true, sx: Math.random() < .5 ? 1 : -1, fin: 0.01, fout: 0.6 });
        add({ k: 'elec', x: e[0], y: e[1], w: 160, life: 0.25, fps: 28, color: '#fff3a0' });
        if (i % 4 === 0) flash('#fff6c0', 0.12, 0.25);
      }, i * 80);
      await wait(16 * 80 + 120); hit(B, '#fff3a0', 1.4); shake(10, 0.4); await wait(300);
    },
    async shura(A, B, d) {
      glow(A, '#bff9ff', 240, 0.6); await wait(250);
      [[-0.75, 0], [0.6, 0.12]].forEach(([r, del]) => add({ k: 'flareline', x: B[0], y: B[1] - 20, rot: r * d, w: 720, h: 120, life: 0.6, delay: del, color: '#e8ffff', whole: true, fin: 0.05, fout: 0.6 }));
      add({ k: 'slash', x: B[0], y: B[1], w: 420, rot: -0.7 * d, life: 0.4, fps: 22, color: '#d0ffff' });
      await wait(250); hit(B, '#d8ffff', 1.3); ring('shock', B, 0.2, 1.8, 0.5, '#ffffff'); shake(11, 0.4); flash('#e8ffff', 0.3, 0.5); await wait(350);
    },
    async camus(A, B, d) {
      aura(A, '#c5f2ff', 1.4); await wait(350);
      const C = [A[0] + d * 60, A[1] - 20];
      add({ k: 'flareblue', x: (C[0] + B[0]) / 2, y: (C[1] + B[1]) / 2, rot: ang(C, B), w: dist(C, B) + 160, h: 260, life: 1.1, color: '#d6f6ff', whole: true, fin: 0.12, fout: 0.45 });
      for (let i = 0; i < 40; i++) add({ k: 'glow', x: C[0], y: C[1] + R(-60, 60), vx: d * R(500, 900), vy: R(-40, 40), w: R(14, 30), life: 0.8, delay: R(0, 0.6), color: '#e8fbff' });
      await wait(700); add({ k: 'icesmoke', x: B[0], y: B[1], w: 520, life: 0.9, fps: 20, color: '#d6f6ff' }); add({ k: 'hitice', x: B[0], y: B[1], w: 380, life: 0.6, fps: 28 });
      shake(8, 0.4); flash('#c5f2ff', 0.4, 0.45); await wait(400);
    },
    async afrodite(A, B, d) {
      for (let i = 0; i < 12; i++) {
        const s = [A[0] + d * 40, A[1] + R(-50, 30)], e = [B[0] + R(-60, 60), B[1] + R(-100, 80)];
        proj('rose', s, e, 0.5, { w: 70, rot: R(0, 6), vr: d * 10, delay: i * 0.07, color: '#ff4060', fin: 0.1, fout: 0.1 });
        for (let j = 0; j < 3; j++) add({ k: 'glow', x: s[0], y: s[1], vx: (e[0] - s[0]) / 0.6 + R(-60, 60), vy: (e[1] - s[1]) / 0.6 + R(-60, 60), w: 20, life: 0.6, delay: i * 0.07 + j * 0.05, color: '#ff5070' });
      }
      await wait(12 * 70 + 450); hit(B, '#ff6080', 1.2); sparks(B, '#ff3050', 30, 380); shake(6, 0.3); await wait(350);
    },
    async aioros(A, B, d) {
      aura(A, '#ffe08a', 1.0); await wait(450);
      const s = [A[0] + d * 40, A[1] - 30];
      streak(s, B, 0.6, '#fff0b0', 40);
      proj('arrow', s, B, 0.28, { w: 380, sx: 1, color: '#ffe9a0' });
      await wait(270); add({ k: 'flare1', x: B[0], y: B[1], w: 520, life: 0.6, color: '#fff3c0' }); hit(B, '#ffe9a0', 1.5);
      ring('shock', B, 0.3, 2.2, 0.6, '#fff3c0'); shake(12, 0.5); flash('#fff0b0', 0.4, 0.6); await wait(400);
    },
  };


  // ---------------- Golpe Assinatura: padrões de animação por estilo
  const SIGFX = {
    async comet(A, B, d, c1, c2) {   // um único soco gigante, cometa
      aura(A, c1, 1.1); await wait(550);
      const s = [A[0] + d * 50, A[1] - 30], e = [B[0], B[1] - 20];
      for (let i = 0; i < 9; i++) streak([s[0] - d * R(80, 240), s[1] + R(-110, 110)], e, 0.35, c1, R(14, 30), i * 0.03);
      proj('glow', s, e, 0.42, { w: 600, color: c1, a: 0.95, s: 0.6, s1: 1.8 });
      proj('soco', s, e, 0.42, { w: 340, sx: d, rot: 0, color: c2, s: 0.6, s1: 1.8, fin: 0.1, fout: 0.1 });
      proj('star4', s, e, 0.42, { w: 120, vr: 10, color: c2 });
      await wait(420); hit(B, c1, 2.2); ring('shock', B, 0.3, 2.8, 0.7, c1); shake(14, 0.6); flash(c1, 0.4, 0.55); await wait(450);
    },
    async arrow(A, B, d, c1, c2) {
      aura(A, c1, 1.0); ring('circle2', A, 0.3, 1.4, 1.0, c1, { vr: 2 }); await wait(550);
      const s = [A[0] + d * 40, A[1] - 30]; streak(s, B, 0.6, c2, 40);
      proj('arrow', s, B, 0.26, { w: 420, sx: 1, color: c1 }); await wait(260);
      add({ k: 'flare1', x: B[0], y: B[1], w: 560, life: 0.6, color: c2 }); hit(B, c1, 1.7); ring('shock', B, 0.3, 2.4, 0.6, c2); shake(12, 0.5); flash(c1, 0.35, 0.5); await wait(400);
    },
    async dragons(A, B, d, c1, c2) {   // cem dragões subindo em espiral
      aura(A, c1, 1.0); ring('circle1', [A[0], A[1] + 150], 0.3, 1.5, 1.0, c1, { vr: 1.5 }); await wait(450);
      for (let i = 0; i < 18; i++) setTimeout(() => {
        const s = [A[0] + d * R(20, 90), A[1] + R(60, 200)], e = [B[0] + R(-70, 70), B[1] + R(-150, 20)];
        streak(s, e, 0.5, c1, R(24, 46)); proj('proj07', s, e, 0.4, { w: R(140, 230), color: c1, loop: true });
        proj('glow', s, e, 0.4, { w: 120, color: c2 }); setTimeout(() => { hit(e, c1, 0.7); }, 380);
      }, i * 70);
      await wait(1600); ring('shock', B, 0.3, 2.6, 0.7, c1); shake(12, 0.6); flash(c1, 0.3, 0.45); await wait(300);
    },
    async storm(A, B, d, c1, c2) {   // corrente em redemoinho
      aura(A, c1, 0.9); await wait(350);
      for (let i = 0; i < 4; i++) ring('circle3', B, 0.3, 1.8, 1.2, i % 2 ? c1 : c2, { vr: i % 2 ? 3 : -3, delay: i * 0.12 });
      for (let i = 0; i < 26; i++) { const a = R(0, 6.28), r = R(80, 260), s = [B[0] + Math.cos(a) * r, B[1] + Math.sin(a) * r * 0.7];
        setTimeout(() => { streak(s, B, 0.35, i % 2 ? c1 : c2, 18); sparks(B, c1, 2, 140); }, i * 45); }
      await wait(1300); hit(B, c1, 2); shake(10, 0.5); flash(c1, 0.3, 0.4); await wait(350);
    },
    async aurora(A, B, d, c1, c2) {   // raio frio + anéis de aurora
      aura(A, c1, 1.0); await wait(400);
      add({ k: 'lightsub', x: B[0], y: B[1] - 20, w: 520, life: 1.0, fps: 24, color: c1, loop: true });
      for (let i = 0; i < 3; i++) ring('circlelight', [B[0], B[1] + 160], 0.3, 1.6, 1.1, i ? c1 : c2, { vr: 1, h: 160, delay: i * 0.18 });
      for (let i = 0; i < 12; i++) streak([A[0] + d * 40, A[1] - 30], [B[0] + R(-60, 60), B[1] + R(-110, 60)], 0.4, c2, 14, i * 0.04);
      await wait(900); hit(B, c1, 2); ring('shock', B, 0.3, 2.4, 0.7, c2); shake(10, 0.5); flash(c1, 0.3, 0.5); await wait(350);
    },
    async phantom(A, B, d, c1, c2) {   // fantasma: fumaça roxa + fogo
      aura(A, c1, 0.9); await wait(300);
      for (let i = 0; i < 6; i++) add({ k: 'smoke', x: B[0] + R(-70, 70), y: B[1] + R(-70, 70), w: 420, life: 1.2, delay: i * 0.08, color: c2, a: 0.6, frame: i % 2 });
      add({ k: 'firehit', x: B[0], y: B[1] + 20, w: 460, life: 0.9, fps: 24, delay: 0.3 });
      ring('circle4', B, 0.3, 1.6, 1.2, c2, { vr: -2.5, delay: 0.1 });
      await wait(900); hit(B, c1, 1.8); shake(9, 0.5); flash(c2, 0.3, 0.4); await wait(350);
    },
    async stars(A, B, d, c1, c2) {   // explosão de poeira de estrelas
      aura(A, c1, 0.8); await wait(350);
      for (let i = 0; i < 40; i++) { const s = [A[0] + d * 40, A[1] - 20];
        setTimeout(() => { const e = [B[0] + R(-120, 120), B[1] + R(-150, 120)]; proj('star4', s, e, R(0.25, 0.4), { w: R(30, 70), vr: 12, color: i % 2 ? c1 : c2 }); sparks(e, c1, 3, 200); }, i * 28); }
      await wait(1300); ring('shock', B, 0.3, 3, 0.8, c1); hit(B, c2, 2); shake(12, 0.6); flash(c1, 0.4, 0.5); await wait(350);
    },
    async nova(A, B, d, c1, c2) {   // supernova
      aura(A, c1, 1.1); await wait(500);
      add({ k: 'core03', x: A[0] + d * 120, y: A[1], w: 360, life: 0.7, fps: 14, s: 0.3, s1: 1.2, color: c1 });
      proj('glow', [A[0] + d * 120, A[1]], B, 0.45, { w: 520, color: c1, s: 0.5, s1: 1.6 }); await wait(450);
      add({ k: 'core03', x: B[0], y: B[1], w: 640, life: 1.0, fps: 14, s: 0.4, s1: 1.7, color: c1 });
      ring('shock', B, 0.2, 3.4, 0.8, c2); ring('shock', B, 0.2, 2.6, 0.9, c1, { delay: 0.12 }); hit(B, c2, 2.4); shake(20, 0.9); flash(c2, 0.5, 0.7); await wait(600);
    },
    async portal(A, B, d, c1, c2) {   // outra dimensão
      aura(A, c1, 0.9); await wait(300);
      ring('circle2', B, 0.2, 1.6, 1.6, c1, { vr: 3 }); ring('circle3', B, 0.2, 1.3, 1.6, c2, { vr: -3, delay: 0.1 });
      for (let i = 0; i < 5; i++) add({ k: 'smoke', x: B[0], y: B[1], w: 460, life: 1.2, delay: i * 0.1, color: c2, a: 0.7, frame: i % 2 });
      for (let i = 0; i < 28; i++) { const a = R(0, 6.28); setTimeout(() => streak([B[0] + Math.cos(a) * 320, B[1] + Math.sin(a) * 220], B, 0.4, c1, 14), i * 40); }
      await wait(1300); hit(B, c1, 2.2); shake(14, 0.7); flash(c2, 0.4, 0.5); await wait(400);
    },
    async souls(A, B, d, c1, c2) {   // almas / fogo fátuo
      aura(A, c1, 0.8); await wait(350);
      for (let i = 0; i < 14; i++) setTimeout(() => { const s = [B[0] + R(-160, 160), B[1] + 200], e = [B[0] + R(-40, 40), B[1] - 60];
        proj('glow', s, e, 0.9, { w: R(60, 110), color: i % 2 ? c1 : c2, fin: 0.2 }); streak(s, e, 0.8, c1, 10); }, i * 70);
      for (let i = 0; i < 4; i++) add({ k: 'smoke', x: B[0] + R(-60, 60), y: B[1] + 40, w: 380, life: 1.3, delay: i * 0.12, color: c1, a: 0.5, frame: i % 2 });
      await wait(1300); hit(B, c1, 1.7); shake(9, 0.5); flash(c1, 0.3, 0.4); await wait(300);
    },
    async lotus(A, B, d, c1, c2) {   // flor de lótus / mandala
      aura(A, c1, 1.0); ring('circle1', [A[0], A[1] + 160], 0.3, 1.6, 1.3, c1, { vr: 1.5 }); await wait(500);
      for (let i = 0; i < 3; i++) ring('circle4', B, 0.2, 1.8 + i * 0.3, 1.4, i % 2 ? c1 : c2, { vr: i % 2 ? 2 : -2, delay: i * 0.15 });
      for (let i = 0; i < 16; i++) { const a = (i / 16) * 6.283; streak(B, [B[0] + Math.cos(a) * 340, B[1] + Math.sin(a) * 340], 0.6, c1, 20, 0.2 + i * 0.015); }
      await wait(1000); hit(B, c2, 2); shake(10, 0.6); flash(c1, 0.5, 0.6); await wait(400);
    },
    async needles(A, B, d, c1, c2) {   // agulhas escarlates
      aura(A, c1, 0.8); await wait(350);
      for (let i = 0; i < 15; i++) setTimeout(() => { const s = [A[0] + d * 60, A[1] - 30], e = [B[0] + R(-40, 40), B[1] + R(-130, 90)];
        streak(s, e, 0.3, c1, 12); proj('proj07', s, e, 0.2, { w: 150, color: c1, loop: true }); setTimeout(() => { add({ k: 'star4', x: e[0], y: e[1], w: 60, life: 0.3, color: c2 }); sparks(e, c1, 4, 200); }, 190); }, i * 60);
      await wait(1300); hit(B, c1, 1.7); shake(8, 0.4); flash(c1, 0.25, 0.4); await wait(300);
    },
    async lion(A, B, d, c1, c2) {   // relâmpagos dourados
      aura(A, c1, 0.9); await wait(350);
      for (let i = 0; i < 6; i++) setTimeout(() => { add({ k: 'lightsub', x: B[0] + R(-80, 80), y: B[1] - 20, w: 360, life: 0.5, fps: 28, color: i % 2 ? c1 : c2 }); streak([A[0] + d * 50, A[1] - 30], [B[0] + R(-60, 60), B[1] + R(-80, 60)], 0.3, c1, 26); hit(B, c1, 0.7); }, i * 130);
      await wait(1000); hit(B, c2, 2.2); ring('shock', B, 0.3, 2.6, 0.7, c1); shake(14, 0.6); flash(c1, 0.35, 0.55); await wait(350);
    },
    async blade(A, B, d, c1, c2) {   // corte sagrado
      aura(A, c1, 0.8); await wait(350);
      streak([A[0] + d * 40, A[1] - 120], [B[0] - d * 40, B[1] + 90], 0.25, c2, 40);
      [[-0.9, 0], [0.8, 0.12], [-0.2, 0.22]].forEach(([r, del]) => add({ k: 'flareline', x: B[0], y: B[1] - 20, rot: r, w: 520, h: 80, life: 0.5, delay: del, color: c1, whole: true, fin: 0.1, fout: 0.6 }));
      await wait(500); hit(B, c2, 2); ring('shock', B, 0.3, 2.2, 0.6, c1); shake(12, 0.5); flash(c2, 0.3, 0.55); await wait(350);
    },
    async ice(A, B, d, c1, c2) {   // caixão de gelo
      aura(A, c1, 0.9); await wait(350);
      add({ k: 'shieldbr', frame: 0, x: B[0], y: B[1], w: 520, life: 1.6, color: c1 });
      ring('barrier', B, 0.3, 1.4, 1.6, c1, { w: 520 }); for (let i = 0; i < 24; i++) setTimeout(() => sparks([B[0] + R(-90, 90), B[1] + R(-150, 120)], c2, 3, 160), i * 45);
      await wait(1300); hit(B, c2, 2); shake(9, 0.5); flash(c1, 0.4, 0.5); await wait(350);
    },
    async roses(A, B, d, c1, c2) {   // chuva de rosas
      aura(A, c1, 0.8); await wait(350);
      for (let i = 0; i < 22; i++) setTimeout(() => { const s = [A[0] + d * 40, A[1] - 60], e = [B[0] + R(-90, 90), B[1] + R(-130, 90)];
        proj('rose', s, e, 0.45, { w: 70, rot: R(0, 6), vr: d * 10, color: i % 2 ? c1 : c2, fin: 0.1, fout: 0.1 }); setTimeout(() => sparks(e, c1, 3, 160), 440); }, i * 60);
      await wait(1700); hit(B, c1, 1.7); shake(8, 0.4); flash(c1, 0.3, 0.4); await wait(300);
    },
  };
  async function sigFx(kind, A, B, d, c1, c2) { const f = SIGFX[kind] || SIGFX.comet; dim(true); try { await f(A, B, d, c1 || '#ffe08a', c2 || '#ffffff'); } catch (e) { console.error(e); } dim(false); }
  // ---------------- efeitos das cartas comuns
  const C_ATT = {
    '01_soco_intenso': ['soco', '#ff6a5a'], '03_soco_cosmico': ['soco', '#7fe4ff'], '02_chute_intenso': ['streak', '#ffb070'],
    '04_chute_cosmico': ['orb', '#7fe4ff'], '22_ataque_rapido': ['multi', '#ffffff'], '29_ataque_desesperado': ['orb', '#ff4040'],
    '30_ataque_defensivo': ['orb', '#7fb2ff'], '36_ataques_continuos': ['multi', '#ffd080'], '37_ataques_opressivos': ['orb', '#c080ff'],
    '14_golpe_agonizante': ['orb', '#9a55ff'], '15_sangramento': ['slash', '#ff2a2a'], '20_ataque_perfurante': ['pierce', '#fff2a0'],
    '21_destruicao_de_sentidos': ['zap', '#a9b8ff'],
    '40_golpe_duplo': ['multi', '#ffd080'], '41_investida': ['streak', '#ff8a5a'], '42_quebra_guarda': ['pierce', '#ffe08a'],
    '43_golpe_oportuno': ['slash', '#ffb070'], '44_ataque_sacrificio': ['orb', '#ff3030'], '45_rajada_de_cosmo': ['multi', '#7fe4ff'],
  };
  const C_DEF = {
    '05_contra_ataque': ['shield', '#ffb060'], '06_esquiva': ['wind', '#bff6ff'], '07_defesa_perfeita': ['barrier', '#8fe9ff'],
    '08_temeridade': ['aura', '#ff4a3a'], '09_elevar_cosmo': ['aura', '#7fe4ff'], '10_agilidade': ['wind', '#ffffff'],
    '11_bencao_de_athena': ['circle', '#ffe9a0'], '12_tormenta_astral': ['aura', '#c080ff'], '13_poder_do_cosmo': ['aura', '#ff7050'],
    '16_furia': ['fire', '#ff7a2a'], '17_concentracao_defensiva': ['aura', '#7fb2ff'], '19_aprendizado_defensivo': ['curse', '#ffe08a'],
    '23_defesa_do_cosmo': ['barrier', '#7fb2ff'], '24_sopro_de_athena': ['heal', '#8dffb0'], '25_destruicao_de_armadura': ['break', '#ff8a6a'],
    '26_velocidade_da_luz': ['light', '#fff6c0'], '27_tenacidade': ['aura', '#ffb040'], '28_sentidos_ampliados': ['circle', '#bff6ff'],
    '31_setimo_sentido': ['seventh', '#ffe08a'], '34_pureza_de_espirito': ['heal', '#ffffff'], '35_desespero': ['dark', '#6a2cff'],
    '38_afinidade_com_o_signo': ['circle', '#ffb0e0'], '18_interferencia_cosmica': ['zapT', '#c080ff'],
    '46_postura_de_combate': ['aura', '#ffe08a'], '47_espelho_de_cosmo': ['circle', '#bff6ff'], '48_armadura_reforcada': ['shield', '#9fb8ff'],
    '49_respiracao_do_cosmo': ['aura', '#7fe4ff'], '50_provocacao': ['curse', '#ff6a5a'], '51_pausa_tatica': ['wind', '#ffffff'],
    '52_troca_de_destino': ['circle', '#c080ff'], '54_reflexos_agucados': ['aura', '#bff6ff'], '55_mira_agucada': ['aura', '#ffe08a'], '53_vinculo_de_cosmo': ['heal', '#8dffb0'],
  };
  async function card(sprite, A, B, d) {
    const att = C_ATT[sprite];
    if (att) {
      const [t, col] = att, s = [A[0] + d * 70, A[1] - 20];
      if (t === 'soco') { proj('soco', s, B, 0.28, { w: 130, sx: d, rot: 0, color: col }); streak(s, B, 0.35, col, 26); await wait(260); }
      else if (t === 'streak') { streak(s, B, 0.35, col, 34); proj('glow', s, B, 0.22, { w: 70, color: col }); await wait(220); }
      else if (t === 'orb') { proj('core01', s, B, 0.32, { w: 150, color: col, fps: 30, loop: true, rot: 0 }); streak(s, B, 0.4, col, 22); await wait(300); }
      else if (t === 'multi') { for (let i = 0; i < 5; i++) { const e = [B[0] + R(-40, 40), B[1] + R(-70, 60)]; setTimeout(() => { streak(s, e, 0.25, col, 18); add({ k: 'star4', x: e[0], y: e[1], w: 50, life: 0.25, color: col }); }, i * 70); } await wait(380); }
      else if (t === 'slash') { [[-0.6, 0], [0.5, 0.1], [-0.1, 0.2]].forEach(([r, del]) => add({ k: 'flareline', x: B[0], y: B[1] - 20, rot: r, w: 380, h: 70, life: 0.45, delay: del, color: col, whole: true })); await wait(250); }
      else if (t === 'pierce') { proj('proj07', s, B, 0.18, { w: 220, color: col, loop: true }); streak(s, [B[0] + d * 150, B[1]], 0.4, col, 18); await wait(180); }
      else if (t === 'zap') { add({ k: 'lightsub', x: B[0], y: B[1] - 20, w: 340, life: 0.6, fps: 26, color: col }); proj('glow', s, B, 0.25, { w: 60, color: col }); await wait(250); }
      return;
    }
    const df = C_DEF[sprite]; if (!df) return;
    const [t, col] = df;
    burst(A, col, d);
    if (t === 'aura') aura(A, col, 1.0);
    else if (t === 'shield') { add({ k: 'shieldbr', frame: 0, x: A[0] + d * 120, y: A[1], w: 360, life: 0.9, color: col }); aura(A, col, 0.8); }
    else if (t === 'barrier') { ring('barrier', A, 0.7, 1.15, 1.1, col, { w: 440 }); glow(A, col, 340, 0.8); }
    else if (t === 'wind') { add({ k: 'wind05', x: A[0], y: A[1] + 40, w: 380, life: 0.8, color: col, fps: 22 }); for (let i = 0; i < 8; i++) streak([A[0] - 160, A[1] + R(-120, 140)], [A[0] + 160, A[1] + R(-120, 140)], 0.4, col, 10, i * 0.04); }
    else if (t === 'circle') { ring('circlelight', [A[0], A[1] + 180], 0.3, 1.3, 1.1, col, { vr: 2, h: 120 }); aura(A, col, 0.9); }
    else if (t === 'fire') { add({ k: 'firehit', x: A[0], y: A[1] + 40, w: 360, life: 0.7, fps: 24 }); aura(A, col, 0.9); }
    else if (t === 'heal') { aura(A, col, 1.0); sparks(A, col, 20, 160); }
    else if (t === 'curse') ring('circle4', B, 0.3, 1.1, 1.0, col, { vr: -2 });
    else if (t === 'break') { add({ k: 'shieldbr', frame: 1, x: B[0], y: B[1], w: 380, life: 0.9, color: col }); sparks(B, col, 20, 260); }
    else if (t === 'light') { for (let i = 0; i < 14; i++) streak([A[0] - 260, A[1] + R(-160, 160)], [A[0] + 260, A[1] + R(-160, 160)], 0.3, col, 14, i * 0.05); aura(A, col, 1.0); }
    else if (t === 'seventh') { aura(A, col, 1.4); ring('circle1', A, 0.2, 1.4, 1.4, col, { vr: 1.5 }); flash(col, 0.4, 0.35); }
    else if (t === 'dark') { for (let i = 0; i < 5; i++) add({ k: 'smoke', x: B[0] + R(-60, 60), y: B[1] + R(-60, 60), w: 380, life: 1.1, delay: i * 0.08, color: col, a: 0.55, frame: i % 2 }); }
    else if (t === 'zapT') add({ k: 'lightsub', x: B[0], y: B[1] - 20, w: 380, life: 0.8, fps: 22, color: col, loop: true });
    await wait(150);
  }

  // Mestre do Santuário: primeira troca de postura
  async function reveal(A, d, onSwap) {
    dim(true, 0.88);
    ring('circle2', A, 2.2, 0.2, 1.7, '#ffd34d', { a: 0.9, vr: 2.5 });
    ring('circle3', A, 2.8, 0.3, 1.9, '#c39bff', { a: 0.8, vr: -2.5, delay: 0.25 });
    ring('circle1', A, 3.2, 0.3, 1.9, '#ffffff', { a: 0.6, vr: 1.5, delay: 0.55 });
    for (let i = 0; i < 80; i++) {
      const r0 = R(260, 560), a0 = R(0, 6.28), sp = R(1.5, 3.5);
      add({ k: 'star4', x: A[0], y: A[1], w: R(16, 46), life: 1.7, delay: R(0, 0.9), color: i % 3 ? '#ffe27a' : '#d3b0ff', vr: 4, onUpdate: (p) => {
        const f = p.t / p.life, r = r0 * (1 - f); p.x = A[0] + Math.cos(a0 + f * sp * 6) * r; p.y = A[1] + Math.sin(a0 + f * sp * 6) * r * 0.7; } });
    }
    aura(A, '#ffd34d', 2.0); shake(5, 1.6);
    await wait(1750);
    flash('#ffffff', 0.9, 0.95); if (onSwap) onSwap();
    ring('shock', A, 0.3, 3.4, 0.8, '#ffffff'); ring('shock', A, 0.2, 2.6, 0.9, '#ffd34d', { delay: 0.1 });
    ring('circle1', A, 0.2, 2.4, 1.2, '#ffd34d', { vr: 2 });
    hit(A, '#fff0b0', 2.2); sparks(A, '#ffe27a', 40, 520);
    for (let i = 0; i < 16; i++) { const a = (i / 16) * 6.283; streak(A, [A[0] + Math.cos(a) * 700, A[1] + Math.sin(a) * 700], 0.5, '#ffe27a', 26, i * 0.015); }
    add({ k: 'core03', x: A[0], y: A[1], w: 520, life: 1.0, fps: 14, s: 0.4, s1: 1.5, color: '#ffd34d' });
    shake(22, 1.0);
    await wait(900);
    aura(A, '#b07cff', 1.4); await wait(700);
    dim(false);
  }
  function dim(on, a = 0.55) { if (dimEl) { dimEl.style.opacity = on ? a : 0; } }
  async function special(key, A, B, d) { const f = SPECIALS[key === 'mestre' ? 'saga' : key]; if (!f) return; dim(true); try { await f(A, B, d); } catch (e) { console.error(e); } dim(false); }
  async function cardFx(sprite, A, B, d) { dim(true, 0.3); try { await card(sprite, A, B, d); } finally { setTimeout(() => dim(false), 350); } }
  return { init, resize, reveal, special, sig: sigFx, card: cardFx, hit, horn: async (A, B, d) => { dim(true); await SPECIALS.horn(A, B, d); dim(false); }, add, shake, flash };
})();
