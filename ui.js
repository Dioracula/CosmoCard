/* CosmoCards — interface (visual baseado nas telas originais) */
(function () {
  const E = window.Engine, D = window.GAMEDATA;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  // armazenamento em camadas: localStorage -> IndexedDB -> memória + window.name (sobrevive a recarregar a aba).
  // Além disso há exportar/importar (código ou arquivo) para guardar o progresso mesmo quando o navegador não salva nada.
  const store = (() => {
    let mem = {}, ls = false, idb = null;
    const API = {};
    try { const n = JSON.parse(window.name || '{}'); if (n && n.__cc) mem = n.__cc; } catch (e) {}
    try {
      const t = '__cc_test'; localStorage.setItem(t, '1'); localStorage.removeItem(t); ls = true;
      for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('cosmocards.')) { try { mem[k.slice(11)] = JSON.parse(localStorage.getItem(k)); } catch (e) {} } }
    } catch (e) { ls = false; }
    const sync = () => { try { window.name = JSON.stringify({ __cc: mem }); } catch (e) {} };
    const SAVE_KEYS = ['unlocked', 'santuario', 'wins', 'lastChar', 'mute'];
    const snapshot = () => { const o = {}; SAVE_KEYS.forEach(k => { if (mem[k] != null) o[k] = mem[k]; }); return o; };
    const idbWrite = () => { if (!idb) return; try { idb.transaction('kv', 'readwrite').objectStore('kv').put(snapshot(), 'save'); } catch (e) {} };
    const put = (k, v) => { mem[k] = v; if (ls) { try { localStorage.setItem('cosmocards.' + k, JSON.stringify(v)); } catch (e) {} } };
    // mescla um save recebido: une personagens liberados, mantém o maior progresso
    function merge(o) {
      if (!o || typeof o !== 'object') return false;
      let n = 0;
      if (Array.isArray(o.unlocked)) { put('unlocked', [...new Set([...(mem.unlocked || [0, 1, 2, 3, 4]), ...o.unlocked.filter(x => Number.isInteger(x))])]); n++; }
      if (Number.isFinite(o.santuario)) { put('santuario', Math.max(mem.santuario || 0, o.santuario)); n++; }
      if (Number.isFinite(o.wins)) { put('wins', Math.max(mem.wins || 0, o.wins)); n++; }
      if (n) { sync(); idbWrite(); }
      return n > 0;
    }
    try {
      const r = indexedDB.open('cosmocards', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => {
        idb = r.result;
        try {
          const q = idb.transaction('kv').objectStore('kv').get('save');
          q.onsuccess = () => { if (q.result) merge(q.result); idbWrite(); if (API.onload) API.onload(); };
        } catch (e) {}
      };
    } catch (e) {}
    Object.assign(API, {
      get persistent() { return ls || !!idb; },
      get(k, d) { return Object.prototype.hasOwnProperty.call(mem, k) && mem[k] != null ? mem[k] : d; },
      set(k, v) { put(k, v); sync(); idbWrite(); },
      merge,
      exportCode() { return 'CC1-' + btoa(unescape(encodeURIComponent(JSON.stringify(snapshot())))); },
      exportJSON() { return JSON.stringify({ game: 'CosmoCards', version: 1, data: snapshot() }, null, 1); },
      importText(t) {
        t = String(t || '').trim(); if (!t) return false;
        try {
          if (/^CC1-/i.test(t)) return merge(JSON.parse(decodeURIComponent(escape(atob(t.slice(4).replace(/\s+/g, ''))))));
          const o = JSON.parse(t); return merge(o && o.data ? o.data : o);
        } catch (e) { return false; }
      },
    });
    return API;
  })();

  // ---------- assets -> blob URLs
  const IMG = {}, SND = {};
  function toBlob(uri) {
    const i = uri.indexOf(','), mime = uri.slice(5, uri.indexOf(';'));
    const bin = atob(uri.slice(i + 1)); const u = new Uint8Array(bin.length);
    for (let k = 0; k < bin.length; k++) u[k] = bin.charCodeAt(k);
    return URL.createObjectURL(new Blob([u], { type: mime }));
  }
  for (const k in window.ASSETS.img) IMG[k] = toBlob(window.ASSETS.img[k]);
  for (const k in window.ASSETS.snd) SND[k] = toBlob(window.ASSETS.snd[k]);
  FX.init(document.getElementById('fxc'), IMG, document.getElementById('battle'), document.getElementById('fxdim'));
  window.ASSETS = null;
  const url = k => 'url("' + IMG[k] + '")';
  const CH = {}; D.chars.forEach(c => { CH[c.id] = c; });
  const cardImg = (charId, ref) => ref === 'S' ? IMG['sp_' + CH[charId].key] : IMG['card_' + D.cards[ref].cardSpriteName];
  const GROUP = { 0: 'seiya', 1: 'shiryu', 2: 'shun', 3: 'hyoga', 4: 'ikki' };
  const grp = id => GROUP[id] || 'ouro';
  const HOUSES = [[5, 'Casa de Áries'], [6, 'Casa de Touro'], [16, 'Casa de Gêmeos'], [7, 'Casa de Câncer'], [9, 'Casa de Leão'],
    [11, 'Casa de Virgem'], [12, 'Casa de Escorpião'], [19, 'Casa de Sagitário'], [13, 'Casa de Capricórnio'], [8, 'Casa de Aquário'], [15, 'Casa de Peixes'], [20, 'Salão do Mestre']];
  const BASE_UNLOCK = [0, 1, 2, 3, 4], AIOROS_WINS = 20;
  const unlockedSet = () => new Set(store.get('unlocked', BASE_UNLOCK));
  // com o DEBUG ativo todos aparecem (inclusive no multiplayer); sem ele, só o que cada jogador desbloqueou
  const isUnl = id => !!store.get('debug', false) || unlockedSet().has(id);
  function unlockChar(id) { const u = unlockedSet(); if (u.has(id)) return false; u.add(id); store.set('unlocked', [...u]); return true; }
  const lockDesc = id => id === 19 ? `Vença mais ${Math.max(1, AIOROS_WINS - store.get('wins', 0))} luta(s) em qualquer modo para desbloquear este personagem!`
    : id === 18 ? 'Atravesse todas as casas do Santuário para desbloquear este personagem!' : id === 20 ? 'Finalize o Santuário (Lenda do Santuário) para desbloquear este personagem!' : 'Vença este cavaleiro no modo Santuário para desbloqueá-lo!';
  const santReal = () => Math.min(store.get('santuario', 0), HOUSES.length);
  const santProgress = () => store.get('debug', false) ? HOUSES.length : santReal();

  // ---------- layout / escala
  const stage = $('#stage');
  let scale = 1, rot = false, SW = 1280;
  function fit() {
    const W = innerWidth, H = innerHeight;
    rot = H > W * 1.15;
    const aspect = rot ? H / W : W / H;
    SW = Math.round(Math.min(1700, Math.max(1280, 720 * aspect)));
    stage.style.width = SW + 'px'; FX.resize(SW, 720);
    if (!rot) {
      scale = Math.min(W / SW, H / 720);
      stage.style.transform = `translate(${(W - SW * scale) / 2}px,${(H - 720 * scale) / 2}px) scale(${scale})`;
    } else {
      scale = Math.min(H / SW, W / 720);
      stage.style.transform = `translate(${(W + 720 * scale) / 2}px,${(H - SW * scale) / 2}px) rotate(90deg) scale(${scale})`;
    }
    if (S.view) render();
  }
  addEventListener('resize', () => fit());
  function toStageDelta(dx, dy) { return rot ? [dy / scale, -dx / scale] : [dx / scale, dy / scale]; }
  $$('[data-bg]').forEach(el => { el.style.backgroundImage = url(el.dataset.bg); });
  $$('[data-img]').forEach(el => { el.style.backgroundImage = url(el.dataset.img); });
  $$('[data-src]').forEach(el => { el.src = IMG[el.dataset.src]; });
  $$('.borda').forEach(el => { el.style.backgroundImage = url('borda'); });
  $('.endturn').style.backgroundImage = url('btn_turn');
  $$('.selplate').forEach(el => { el.style.backgroundImage = url('plate'); });

  // ---------- som
  const Snd = {
    muted: store.get('mute', false), bgm: null, key: null, base: {},
    play(n, vol = 1, maxSec) {
      if (this.muted || !SND[n]) return;
      let b = this.base[n]; if (!b) { b = this.base[n] = new Audio(SND[n]); b.preload = 'auto'; }
      const a = b.paused ? b : b.cloneNode(); a.volume = vol; try { a.currentTime = 0; } catch (e) {}
      a.play().catch(() => {});
      if (maxSec) {   // corta o som depois de maxSec, com fade-out de 0,5 s
        const fade = Math.min(0.5, maxSec * 0.4);
        setTimeout(() => { const t0 = performance.now(); const iv = setInterval(() => {
          const f = (performance.now() - t0) / (fade * 1000);
          if (f >= 1) { clearInterval(iv); a.pause(); } else a.volume = Math.max(0, vol * (1 - f)); }, 40); }, (maxSec - fade) * 1000);
      }
      return a;
    },
    music(k) {
      if (this.key === k && this.bgm) return;
      this.key = k; if (this.bgm) this.bgm.pause(); this.bgm = null; if (!k) return;
      this.bgm = new Audio(SND[k]); this.bgm.loop = true; this.bgm.volume = 0.4;
      if (!this.muted) this.bgm.play().catch(() => {});
    },
    toggle() {
      this.muted = !this.muted; store.set('mute', this.muted);
      if (this.bgm) { if (this.muted) this.bgm.pause(); else this.bgm.play().catch(() => {}); }
      sndIcons();
    },
  };
  function sndIcons() {
    $$('.icon[data-act=mute]').forEach(b => b.textContent = Snd.muted ? '✕♪' : '♪');
    $$('.imgbtn.snd').forEach(b => b.classList.toggle('off', Snd.muted));
  }
  sndIcons();
  addEventListener('pointerdown', () => { if (Snd.bgm && Snd.bgm.paused && !Snd.muted) Snd.bgm.play().catch(() => {}); }, true);

  // ---------- telas
  function show(id) {
    $$('.screen').forEach(s => s.classList.toggle('on', s.id === id));
    $$('.modal').forEach(m => m.classList.remove('on'));
    if (id === 'menu' || id === 'online' || id === 'help' || id === 'cards') Snd.music('menu');
    if (id === 'select') Snd.music('character_selection_2');
  }
  function modal(id, on = true) { $('#' + id).classList.toggle('on', on); }
  function toast(t, ms = 2200) { const el = $('#toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('on'), ms); }
  function msg(t, cb) { $('#mMsg .msg').textContent = t; modal('mMsg'); msg.cb = cb; }

  const S = { mode: null, me: 0, link: null, G: null, view: null, queue: [], running: false, pending: false,
    myPick: null, opPick: null, selStep: 0, sel: 0 };

  function goMenu() {
    if (S.link) { S.link.close(); S.link = null; }
    S.mode = null; S.G = null; S.view = null; S.queue = []; show('menu');
  }

  // ---------- seleção de personagem
  const order = [0, 1, 2, 3, 4, 5, 6, 16, 7, 11, 12, 9, 13, 8, 15, 18, 19, 20];
  function buildGrid() {
    const g = $('#select .grid'); g.innerHTML = '';
    order.forEach(id => {
      const d = document.createElement('div'); d.className = 'fr'; d.dataset.id = id;
      d.innerHTML = `<div class="face" style='background-image:${url('thumb_' + CH[id].key)}'></div><img src="${IMG.fr_open}" alt=""><img class="s" src="${IMG.fr_sel}" alt=""><img class="e" src="${IMG.fr_en}" alt=""><img class="l" src="${IMG.fr_lock}" alt="" style="display:none">`;
      d.addEventListener('click', () => {
        if (!isUnl(id)) { Snd.play('sfx_info', .6); toast('🔒 ' + lockDesc(id), 3200); return; }
        S.sel = id; Snd.play('sfx_character_change', .7); renderSelect();
      });
      g.appendChild(d);
    });
  }
  function openSelect() {
    S.selStep = 0; S.myPick = null;
    if (S.mode !== 'host' && S.mode !== 'guest') S.opPick = null;
    S.sel = store.get('lastChar', 0); if (!CH[S.sel] || !isUnl(S.sel)) S.sel = 0;
    show('select'); renderSelect();
  }
  function plate(side, id) {
    const p = $('#select .selplate.' + side), m = $('#select .selmodel.' + side);
    if (id == null) { p.classList.add('hide'); m.style.opacity = 0; return; }
    p.classList.remove('hide'); m.style.opacity = 1;
    p.querySelector('span').innerHTML = CH[id].title.replace(/ de /i, '<br>de ');
    m.src = IMG['model_' + CH[id].key];
  }
  function renderSelect() {
    const online = S.mode === 'host' || S.mode === 'guest';
    let left, right;
    if (S.mode === 'cpu') { left = S.selStep === 0 ? S.sel : S.myPick; right = S.selStep === 1 ? S.sel : null; }
    else if (online) { left = S.myPick != null ? S.myPick : S.sel; right = S.opPick; }
    else { left = S.sel; right = null; }
    plate('l', left); plate('r', right);
    $$('#select .fr').forEach(t => {
      const id = +t.dataset.id;
      const selCyan = (S.mode === 'cpu' && S.selStep === 1) ? id === S.myPick : id === (S.myPick != null ? S.myPick : S.sel);
      const selRed = (S.mode === 'cpu' && S.selStep === 1 && id === S.sel) || (online && id === S.opPick) || (S.mode === 'sant' && id === right);
      t.classList.toggle('sel', selCyan); t.classList.toggle('en', selRed);
      t.classList.toggle('lock', !isUnl(id));
    });
    const c = CH[S.sel];
    let status = '';
    if (S.mode === 'cpu') status = S.selStep === 0 ? 'Escolha o seu cavaleiro e toque em Avançar.' : 'Agora escolha o oponente (marcado em vermelho).';
    else if (online) status = S.myPick != null ? (S.opPick != null ? 'Começando…' : 'Aguardando seu amigo escolher…') : (S.opPick != null ? 'Seu amigo já escolheu. Sua vez!' : 'Escolha seu cavaleiro.');
    else status = 'Santuário: escolha o cavaleiro que vai atravessar as Casas do Zodíaco.';
    $('#select .selinfo').innerHTML = `<b>${esc(c.passive.split('\n')[0])}</b> ${esc(c.passive.split('\n').slice(1).join(' '))}<br>` +
      `Vida ${c.stats.life} · Força ${c.stats.attPower} · Defesa ${c.stats.defPower} · Especial: ${esc(c.special.tittle)}<br><span style="color:#9fe8ff">${esc(status)}</span>`;
    $('#select [data-act=confirm]').disabled = online && S.myPick != null;
  }
  function confirmSelect() {
    Snd.play('sfx_button_click');
    store.set('lastChar', S.sel);
    if (S.mode === 'cpu') {
      if (S.selStep === 0) {
        S.myPick = S.sel; S.selStep = 1;
        const others = order.filter(i => i !== S.myPick && isUnl(i)); S.sel = others[Math.floor(Math.random() * others.length)];
        renderSelect(); return;
      }
      startLocal(S.myPick, S.sel); return;
    }
    if (S.mode === 'sant') { S.myPick = S.sel; openSant(); return; }
    S.myPick = S.sel; S.link.send({ k: 'pick', c: S.myPick }); renderSelect(); maybeStartOnline();
  }
  // ---------- Santuário (carrossel das casas)
  function openSant(idx) {
    S.santIdx = idx != null ? idx : Math.min(santProgress(), HOUSES.length - 1);
    show('sant'); Snd.music('character_selection_2'); renderSant();
  }
  function renderSant() {
    const car = $('#sant .carousel'); const prog = santProgress();
    if (!car.childElementCount) HOUSES.forEach(([id, name], i) => {
      const h = document.createElement('div'); h.className = 'house'; h.dataset.i = i;
      h.innerHTML = `<div class="face"></div><img src="${IMG.block}" alt=""><img class="on" src="${IMG.block_on}" alt=""><div class="ok">✓</div>`;
      h.addEventListener('click', () => { if (+h.dataset.i !== S.santIdx) { S.santIdx = +h.dataset.i; Snd.play('sfx_card_out', .6); renderSant(); } });
      car.appendChild(h);
    });
    $$('.house', car).forEach(h => {
      const i = +h.dataset.i, id = HOUSES[i][0], lock = i > prog;
      h.style.left = `calc(50% + ${(i - S.santIdx) * 400}px)`;
      h.classList.toggle('c', i === S.santIdx); h.classList.toggle('lock', lock);
      h.classList.toggle('done', i < prog); h.classList.toggle('open', !lock);
      h.style.display = Math.abs(i - S.santIdx) > 2 ? 'none' : '';
      h.querySelector('.face').style.backgroundImage = lock ? 'none' : url('face_' + CH[id].key);
    });
    const [id, name] = HOUSES[S.santIdx], lock = S.santIdx > prog;
    $('#sant .santinfo').innerHTML = `${name}<small>${lock ? '??? — vença a casa anterior para chegar aqui' : (id === 20 && !isUnl(20) ? '???' : CH[id].title) + (S.santIdx < prog ? ' — casa conquistada (pode lutar de novo)' : ' — próxima batalha')}<br>Seu cavaleiro: ${CH[S.myPick].title} · ${prog} de ${HOUSES.length} casas</small>`;
    $('#sant [data-act=santgo]').disabled = lock;
  }
  (function swipe() {
    const car = $('#sant .carousel'); let sx = null, sy = 0;
    car.addEventListener('pointerdown', e => { sx = e.clientX; sy = e.clientY; });
    car.addEventListener('pointerup', e => {
      if (sx == null) return; const [dx] = toStageDelta(e.clientX - sx, e.clientY - sy); sx = null;
      if (Math.abs(dx) > 60) { S.santIdx = Math.max(0, Math.min(HOUSES.length - 1, S.santIdx + (dx < 0 ? 1 : -1))); Snd.play('sfx_card_out', .6); renderSant(); }
    });
  })();
  function santFight(i) { S.santCur = i; startLocal(S.myPick, HOUSES[i][0], HOUSES[i][1]); }

  // ---------- desbloqueio
  function showUnlocks(ids, done) {
    if (!ids.length) return done();
    const id = ids.shift(), c = CH[id];
    $('#mUnlock .um').src = IMG['model_' + c.key];
    $('#mUnlock .utx').textContent = 'Você agora pode jogar com ' + c.title + '!';
    Snd.play('sfx_unlock'); modal('mUnlock');
    showUnlocks.next = () => { modal('mUnlock', false); showUnlocks(ids, done); };
  }

  // ---------- VS
  async function vsScreen(c0, c1, house) {
    const a = CH[c0], b = CH[c1];
    $('#vs .vsbox.l .por').src = IMG['vs_' + a.key]; $('#vs .vsbox.r .por').src = IMG['vs_' + b.key];
    $('#vs').style.setProperty('--plate', url('plate'));
    $('#vs .vsplate.l span').innerHTML = esc(a.title).replace(/ de /i, '<br>de '); $('#vs .vsplate.r span').innerHTML = esc(b.title).replace(/ de /i, '<br>de ');
    $('#vs .vshouse').textContent = house || '';
    $('#vs').classList.remove('go'); show('vs'); Snd.music(null);
    await wait(60); $('#vs').classList.add('go'); Snd.play('sfx_versus_1');
    await wait(500); Snd.play('sfx_versus_2');
    await wait(1700);
  }

  // ---------- controle da partida
  function snap(G) { const ev = G.ev; G.ev = []; const st = JSON.parse(JSON.stringify(G)); G.ev = ev; return st; }
  function pump() {
    const ev = S.G.ev.splice(0);
    const st = snap(S.G);
    if (S.mode === 'host' && S.link) S.link.send({ k: 'upd', ev, st });
    deliver(ev, st);
  }
  function apply(pi, a) {
    const G = S.G; if (!G || !a) return;
    let ok = false;
    if (a.type === 'play') { ok = E.playCard(G, pi, a.uid); if (!ok && S.mode !== 'host' && pi === 1) E.endTurn(G, pi); }
    else if (a.type === 'stance') ok = E.setStance(G, pi, a.s);
    else if (a.type === 'end') ok = E.endTurn(G, pi);
    pump();
  }
  function act(a) {
    if (!S.view || S.view.over || S.running) return;
    if (S.view.turn !== S.me) return;
    if (S.mode === 'guest') { if (S.pending) return; S.pending = true; S.link.send({ k: 'act', a }); renderControls(); return; }
    apply(S.me, a);
  }
  async function startLocal(c0, c1, house) {
    if (S.mode !== 'sant') S.mode = 'cpu';
    S.me = 0; S.house = house || null;
    await vsScreen(c0, c1, house);
    S.G = E.newGame(c0, c1, 0); S.G.p[1].boss = true; enterBattle(); pump();
  }
  function enterBattle(keep) {
    S.mReveal = {};
    if (!keep) S.queue = []; S.running = false; S.view = null; S.pending = false;
    $('#battle .hand').innerHTML = ''; show('battle'); fit(); Snd.music('ingame_editado');
  }

  // ---------- fila de animações
  function deliver(ev, st) { S.queue.push({ ev, st }); if (!S.running) runQueue(); }
  async function runQueue() {
    S.running = true; renderControls();
    while (S.queue.length) {
      const { ev, st } = S.queue.shift();
      if (!S.view) { S.view = st; render(); }
      for (const e of ev) { try { await anim(e, st); } catch (err) { console.error(err); } }
      S.view = st; render();
    }
    S.running = false; S.pending = false; render();
    onIdle();
  }
  function onIdle() {
    const v = S.view; if (!v || v.over) return;
    if ((S.mode === 'cpu' || S.mode === 'sant') && v.turn === 1) {
      setTimeout(() => { if (S.G && !S.running && S.G.turn === 1 && !S.G.over) apply(1, E.aiStep(S.G, 1)); }, 650);
    }
  }

  const sideOf = pi => pi === S.me ? 'me' : 'op';
  function fighterEl(pi) { return $('#battle .fighter.' + sideOf(pi)); }
  const chest = pi => [centerOf(pi)[0], 330];
  const dir = pi => sideOf(pi) === 'me' ? 1 : -1;
  // Mestre do Santuário: primeira troca de postura (revelação)
  async function mestreReveal(pi, st) {
    const f = fighterEl(pi), img = f.querySelector('img'), key = CH[st.p[pi].charId].key, rv = $('#battle .mreveal');
    f.classList.add('charge'); Snd.play('sfx_setimo_sentido', .9, 3.6);
    rv.classList.remove('show'); void rv.offsetWidth; rv.classList.add('show');
    await FX.reveal(chest(pi), dir(pi), () => {
      img.src = IMG['spr2_' + key]; f.classList.remove('charge'); f.classList.add('rise');
      Snd.play('sfx_helmet', 1, 1.6); Snd.play('sfx_golpe_saga', .9, 2.2);
    });
    f.classList.remove('rise', 'charge'); rv.classList.remove('show');
  }
  function centerOf(pi) { const r = fighterEl(pi).getBoundingClientRect(), s = stage.getBoundingClientRect(); const cx = rot ? ((r.top + r.bottom) / 2 - s.top) / scale : ((r.left + r.right) / 2 - s.left) / scale; return [Math.round(cx) || (sideOf(pi) === 'me' ? 400 : SW - 400), 330]; }
  function floatText(pi, txt, cls, dy = 0) {
    const [x, y] = centerOf(pi);
    const d = document.createElement('div'); d.className = 'float ' + cls; d.textContent = txt;
    d.style.left = x + 'px'; d.style.top = (y - 60 + dy) + 'px';
    $('#battle').appendChild(d); setTimeout(() => d.remove(), 1300);
  }
  function fx(pi, key) {
    const [x, y] = centerOf(pi);
    const d = document.createElement('div'); d.className = 'fx'; d.style.left = x + 'px'; d.style.top = (y - 20) + 'px';
    d.style.backgroundImage = url(key); $('#battle').appendChild(d); setTimeout(() => d.remove(), 600);
  }
  async function banner(mine, txt, ms = 900) {
    const b = $('#battle .banner'), tt = b.querySelector('.tt'), sp = b.querySelector('span');
    if (txt) { tt.style.display = 'none'; sp.textContent = txt; } else { tt.style.display = ''; tt.src = IMG[mine ? 't_player' : 't_enemy']; sp.textContent = ''; }
    requestAnimationFrame(() => b.classList.add('show'));
    await wait(ms); b.classList.remove('show'); await wait(200);
  }
  let statStack = { 0: 0, 1: 0 };
  async function anim(e, st) {
    if (e.hud) renderHud(e.hud, st);
    const me = e.p === S.me;
    switch (e.t) {
      case 'play': {
        statStack = { 0: 0, 1: 0 };
        const card = e.ref === 'S' ? CH[e.charId].special : D.cards[e.ref];
        const off = card.offensive;
        Snd.play('sfx_card_in', .8);
        const p = $('#battle .play'); p.className = 'play'; p.style.backgroundImage = 'url("' + cardImg(e.charId, e.ref) + '")';
        await wait(20); p.classList.add('show');
        if (!e.special) Snd.play(CARD_SFX[card.cardSpriteName] || 'sfx_card_flip', .9);
        await wait(e.special ? 700 : 750);
        p.classList.add('away');
        if (off) { const f = fighterEl(e.p); f.classList.add(sideOf(e.p) === 'me' ? 'lunge-r' : 'lunge-l'); setTimeout(() => f.classList.remove('lunge-r', 'lunge-l'), 380); }
        if (e.special) { await wait(100); return; }
        await wait(120); await FX.card(card.cardSpriteName, chest(e.p), chest(1 - e.p), dir(e.p));
        return;
      }
      case 'special': {
        const c = CH[e.charId], sp = $('#battle .special'), img = sp.querySelector('img');
        img.src = IMG['vs_' + c.key] || IMG['model_' + c.key];
        const left = sideOf(e.p) === 'me';
        img.style.left = left ? '70px' : 'auto'; img.style.right = left ? 'auto' : '70px';
        img.style.transform = `translateX(${left ? -600 : 600}px)` + (left ? '' : ' scaleX(-1)');
        sp.querySelector('.sname').textContent = e.title.toUpperCase();
        sp.classList.add('show'); Snd.play('sfx_' + c.sfx + '_especial'); setTimeout(() => Snd.play('sfx_golpe_' + c.sfx, .9), 500);
        await wait(30); img.style.transform = left ? 'translateX(0)' : 'translateX(0) scaleX(-1)';
        await wait(1500); const fl = $('#battle .flash'); fl.classList.remove('go'); void fl.offsetWidth; fl.classList.add('go');
        sp.classList.remove('show'); await wait(200);
        await FX.special(c.key, chest(e.p), chest(1 - e.p), dir(e.p));
        return;
      }
      case 'dmg': {
        const f = fighterEl(e.p);
        if (e.v > 0) {
          f.classList.remove('hit'); void f.offsetWidth; f.classList.add('hit');
          FX.hit(chest(e.p), null, 0.8);
          Snd.play('sfx_damage', .9);
          floatText(e.p, '-' + Math.round(e.v), 'dmg');
        } else floatText(e.p, '0', 'bad');
        await wait(520); f.classList.remove('hit');
        return;
      }
      case 'heal': floatText(e.p, '+' + Math.round(e.v), 'heal'); await wait(350); return;
      case 'stat': floatText(e.p, e.txt, e.good ? 'good' : 'bad', 40 + (statStack[e.p]++ % 3) * 34); Snd.play(e.good ? 'sfx_gain_power' : 'sfx_lose_power', .5); await wait(260); return;
      case 'debuff': floatText(e.p, (e.good ? '▲ ' : '▼ ') + e.name, e.good ? 'good' : 'bad', 70); await wait(320); return;
      case 'passive': floatText(e.p, '★ ' + CH[st.p[e.p].charId].passive.split(':')[0], 'good', -50); await wait(260); return;
      case 'needles': floatText(e.p, '✶ Agulhas: ' + e.v, 'bad', 20); await wait(300); return;
      case 'text': if (e.sfx) Snd.play(e.sfx); floatText(e.p, e.txt, e.kind === 'fail' ? 'bad' : 'good', -10);
        if (e.txt === 'GRANDE CHIFRE!') await FX.horn(chest(e.p), chest(1 - e.p), dir(e.p));
        else if (e.kind === 'counter' || e.kind === 'block') FX.hit(chest(e.p), e.kind === 'block' ? '#9fe8ff' : '#ffb060', 0.7);
        await wait(e.kind === 'counter' || e.kind === 'block' ? 800 : 600); return;
      case 'cosmo': if (e.v > 0) { Snd.play('sfx_cosmo_recharge', .5); floatText(e.p, '+' + Math.round(e.v) + ' Cosmo', 'good', 60); } await wait(420); return;
      case 'draw': if (me && !e.silent) Snd.play('sfx_card_flip', .7); if (me) renderHand(st); await wait(e.silent ? 0 : 200); return;
      case 'stance': {
        // revelação: chefe (CPU) sempre; jogador usando o Mestre só com o DEBUG ativo
        const first = !(S.mReveal && S.mReveal[e.p]);
        if (e.reveal || (first && e.s && store.get('debug', false) && st.p[e.p].charId === 20)) { (S.mReveal = S.mReveal || {})[e.p] = true; await mestreReveal(e.p, st); }
        else Snd.play('sfx_character_change');
        } $('#battle .fighter.' + sideOf(e.p) + ' img').src = IMG[(e.s ? 'spr2_' : 'spr_') + CH[st.p[e.p].charId].key]; floatText(e.p, ['Postura Neutra', 'Postura Ofensiva', 'Postura Defensiva'][e.s], 'good', -30); await wait(300); return;
      case 'turn': {
        const mine = e.p === S.me;
        $$('#battle .fighter').forEach(f => f.classList.remove('turn')); fighterEl(e.p).classList.add('turn');
        Snd.play(mine ? 'sfx_your_turn' : 'sfx_opponents_turn');
        await banner(mine, null, 850);
        return;
      }
      case 'over': {
        await wait(700);
        const win = e.winner === S.me, draw = e.winner === -1;
        Snd.music(null); Snd.play(win ? 'game_over_victory' : 'game_over_fail');
        $('#mEnd img').src = IMG[win ? 'win' : 'lose'];
        if (win) store.set('wins', store.get('wins', 0) + 1);
        let m = draw ? 'Empate!' : win ? 'Atena agradece, cavaleiro!' : 'Não desista. Eleve o seu cosmo e tente de novo!';
        let again = 'Jogar de novo';
        const unl = [];
        if (S.mode === 'sant') {
          if (win) {
            const opId = st.p[1 - S.me].charId;
            if (unlockChar(opId)) unl.push(opId);
            if (S.santCur === santReal()) store.set('santuario', santReal() + 1);
            const n = santReal();
            if (n >= HOUSES.length) { m = 'Você atravessou todas as Casas do Zodíaco! Atena está salva.'; again = 'Santuário'; if (unlockChar(18)) unl.push(18); }
            else { m = 'Casa conquistada! Próxima: ' + HOUSES[n][1] + '.'; again = 'Próxima casa'; }
          } else again = 'Tentar de novo';
        }
        if (win && store.get('wins', 0) >= AIOROS_WINS && unlockChar(19)) unl.push(19);
        $('#mEnd .endmsg').textContent = m; $('#mEnd [data-act=again]').textContent = again;
        showUnlocks(unl, () => modal('mEnd')); return;
      }
      default: return;
    }
  }

  // ---------- render
  function renderHud(hud, st) {
    [0, 1].forEach(pi => {
      const h = hud[pi], side = sideOf(pi), el = $('#battle .hud.' + side);
      const pct = Math.max(0, Math.min(100, h.life / h.maxLife * 100));
      el.querySelector('.bar .fill').style.width = pct + '%';
      el.querySelector('.bar span').textContent = Math.ceil(h.life);
      el.querySelector('.glass span').textContent = Math.floor(h.cosmo + 1e-6);
      el.querySelector('.plate span').textContent = ['NEUTRA', 'OFENSIVA', 'DEFENSIVA'][h.stance];
      const pd = $('#battle .pd.' + side);
      pd.querySelector('.att').textContent = Math.round(h.att); pd.querySelector('.def').textContent = Math.round(h.def);
    });
    const oph = $('#battle .ophand'); const n = hud[1 - S.me].hand;
    if (oph.childElementCount !== n) { oph.innerHTML = ''; for (let i = 0; i < n; i++) { const d = document.createElement('div'); d.style.backgroundImage = url('card_back'); oph.appendChild(d); } }
  }
  function render() {
    const v = S.view; if (!v) return;
    const P = v.p[S.me], O = v.p[1 - S.me];
    ['me', 'op'].forEach(side => {
      const p = side === 'me' ? P : O, c = CH[p.charId], g = grp(p.charId), el = $('#battle .hud.' + side);
      $('#battle .fighter.' + side + ' img').src = IMG[(p.stance ? 'spr2_' : 'spr_') + c.key];
      el.querySelector('.frame').src = IMG['hp_' + g];
      el.querySelector('.glass img').src = IMG['vidro_' + g];
      el.querySelector('.plate img').src = IMG['sel_' + g];
      el.querySelector('.bar .fill').style.backgroundImage = url('hp_bar');
      el.querySelector('.nm').textContent = c.name + (side === 'me' ? '' : (S.mode === 'host' || S.mode === 'guest') ? ' (amigo)' : ' (CPU)');
      const good = p.debuffs.filter(d => !d.negativeDebuff).length, bad = p.debuffs.filter(d => d.negativeDebuff).length;
      el.querySelector('.effs').innerHTML = (good ? `<div class="eff" data-side="${side}" style='background-image:${url('ic_buff')}'><b>${good}</b></div>` : '') +
        (bad ? `<div class="eff" data-side="${side}" style='background-image:${url('ic_debuff')}'><b>${bad}</b></div>` : '');
    });
    const hud = v.p.map(p => { const c = E.cur(p); return { life: p.stats.life, maxLife: p.stats.maxLife, cosmo: p.stats.cosmo, maxCosmo: p.stats.maxCosmo, att: c.attPower, def: c.defPower, stance: p.stance, hand: p.hand.length }; });
    renderHud(hud, v);
    $$('#battle .fighter').forEach(f => f.classList.remove('turn'));
    if (!v.over) fighterEl(v.turn).classList.add('turn');
    renderHand(v);
    renderControls();
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  const myFree = () => { const v = S.view; return v && v.turn === S.me && !v.over && !S.running && !S.pending; };
  function renderControls() {
    const v = S.view; if (!v) return;
    const P = v.p[S.me], mine = v.turn === S.me && !v.over, free = myFree();
    $('#battle .hud.me .plate').classList.toggle('can', free && !P.stanceChanged);
    const et = $('#battle .endturn'); et.disabled = !free;
    const usable = P.hand.some(h => E.isUsable(v, P, E.cardOf(P, h.ref)));
    et.classList.toggle('pulse', free && !usable);
    $('#battle .turninfo').textContent = v.over ? '' : 'Rodada ' + Math.ceil(v.totalTurn / 2) + ' · ' + (mine ? 'Seu turno' : 'Turno do oponente');
    $('#battle .logline').textContent = free ? (usable ? 'Toque numa carta para ver, ou arraste para cima para usar.' : 'Sem cosmo para mais cartas. Finalize o turno.') : '';
  }
  const sgn = n => (n >= 0 ? '+' : '') + n;

  function renderHand(v) {
    const P = v.p[S.me], hand = $('#battle .hand');
    const free = myFree();
    const els = {}; $$('.card', hand).forEach(el => { els[el.dataset.uid] = el; });
    const n = P.hand.length, W = 118, avail = Math.min(980, SW - 520), x0 = (SW - avail) / 2;
    const step = n > 1 ? Math.min(W + 10, (avail - W) / (n - 1)) : 0;
    const start = x0 + (avail - (step * (n - 1) + W)) / 2;
    const keep = new Set();
    P.hand.forEach((h, i) => {
      keep.add(String(h.uid));
      let el = els[h.uid];
      const card = E.cardOf(P, h.ref);
      if (!el) {
        el = document.createElement('div'); el.className = 'card new'; el.dataset.uid = h.uid;
        el.style.backgroundImage = 'url("' + cardImg(P.charId, h.ref) + '")';
        el.innerHTML = '<div class="cost"></div><div class="dmg"></div>';
        el.style.left = start + i * step + 'px'; el.style.top = '-34px';
        bindCard(el); hand.appendChild(el);
        setTimeout(() => el.classList.remove('new'), 500);
      }
      el.style.opacity = '';
      el.style.left = start + i * step + 'px'; el.style.top = '-34px'; el.style.zIndex = 10 + i;
      el.querySelector('.cost').textContent = Math.round(E.costOf(P, card));
      const est = E.estimate(v, P, card);
      el.querySelector('.dmg').textContent = est == null ? '' : est;
      const ok = E.isUsable(v, P, card);
      el.classList.toggle('usable', ok && free);
      el.classList.toggle('dim', !ok && v.turn === S.me);
    });
    for (const k in els) if (!keep.has(k)) els[k].remove();
  }

  // ---------- interação com cartas
  let zoomUid = null, zoomRO = false;
  function bindCard(el) {
    let sx, sy, ox, oy, drag = false, id = null;
    el.addEventListener('pointerdown', e => {
      id = e.pointerId; sx = e.clientX; sy = e.clientY; ox = parseFloat(el.style.left); oy = parseFloat(el.style.top); drag = false;
      try { el.setPointerCapture(id); } catch (err) {}
    });
    el.addEventListener('pointermove', e => {
      if (id !== e.pointerId) return;
      const [dx, dy] = toStageDelta(e.clientX - sx, e.clientY - sy);
      if (!drag && Math.hypot(dx, dy) > 12) {
        if (!el.classList.contains('usable')) return;
        drag = true; el.classList.add('drag'); Snd.play('sfx_card_zoom', .6);
      }
      if (drag) { el.style.left = ox + dx + 'px'; el.style.top = oy + dy + 'px'; }
    });
    el.addEventListener('pointerup', e => {
      if (id !== e.pointerId) return; id = null;
      if (drag) {
        el.classList.remove('drag');
        const [dx, dy] = toStageDelta(e.clientX - sx, e.clientY - sy);
        if (dy < -110) { el.style.opacity = '.3'; act({ type: 'play', uid: +el.dataset.uid }); }
        else render();
        drag = false; return;
      }
      openZoom(+el.dataset.uid);
    });
    el.addEventListener('pointercancel', () => { id = null; if (drag) { el.classList.remove('drag'); render(); } });
  }
  function fillZoom(card, img, cost, est, desc, title, type) {
    const z = $('#mZoom .zoom'); z.style.backgroundImage = 'url("' + img + '")';
    z.querySelector('.cost').textContent = cost; z.querySelector('.dmg').textContent = est == null ? '' : est;
    $('#mZoom h3').textContent = title; $('#mZoom .ty').textContent = type; $('#mZoom p').textContent = desc;
  }
  const typeOf = card => card.special ? 'Golpe especial' : card.offensive ? 'Carta de ataque' : card.cardType === 0 ? 'Carta ofensiva' : 'Carta defensiva';
  function openZoom(uid) {
    const v = S.view; if (!v) return;
    const P = v.p[S.me], h = P.hand.find(x => x.uid === uid); if (!h) return;
    const card = E.cardOf(P, h.ref); zoomUid = uid; zoomRO = false;
    Snd.play('sfx_card_zoom', .6);
    const est = E.estimate(v, P, card), cost = Math.round(E.costOf(P, card));
    fillZoom(card, cardImg(P.charId, h.ref), cost, est, E.cardDesc(card), card.special ? CH[P.charId].special.tittle : card.tittle, typeOf(card));
    $('#mZoom .kv').innerHTML = `<span>Custo <b>${cost}</b> cosmo</span>` + (est != null ? `<span>Dano previsto <b>${est}</b></span>` : '') + `<span>Seu cosmo <b>${Math.floor(P.stats.cosmo)}</b></span>`;
    let warn = '';
    if (v.turn !== S.me) warn = 'Espere o seu turno para usar.';
    else if (!E.isUsable(v, P, card)) warn = 'Cosmo insuficiente.';
    if (P.invalid.includes(card.tittle)) warn = 'Esta carta foi bloqueada pelo Código do Cavaleiro: ela vai falhar.';
    $('#mZoom .warn').textContent = warn;
    const use = $('#mZoom [data-act=use]'); use.style.display = ''; use.disabled = !(E.isUsable(v, P, card) && myFree());
    modal('mZoom');
  }
  function openInfo(side) {
    const v = S.view; if (!v) return;
    const p = v.p[side === 'me' ? S.me : 1 - S.me], c = CH[p.charId];
    $('#mInfo .ttl').textContent = c.title;
    let html = `<div class="it good"><b>${esc(c.passive.split('\n')[0])}</b><div>${esc(c.passive.split('\n').slice(1).join('\n'))}</div></div>`;
    html += `<div class="it"><b>Especial: ${esc(c.special.tittle)}</b><div>${esc(c.special.description)} (custo ${Math.abs(c.special.statsRequired.cosmo)})</div></div>`;
    if (!p.debuffs.length) html += '<div class="it"><div>Nenhum efeito ativo.</div></div>';
    for (const d of p.debuffs) {
      const left = d.infinityDebuff || d.turnDuration > 50 ? 'permanente' : d.aplicateAntares ? d.antaresAplication + ' agulhas' : d.turnDuration + ' turno(s)';
      html += `<div class="it ${d.negativeDebuff ? 'bad' : 'good'}"><b>${d.negativeDebuff ? '▼' : '▲'} ${esc(d.debuffName)}</b> <small style="color:#aaa">(${left})</small><div>${esc(d.debuffDescription || '')}</div></div>`;
    }
    if (p.invalid.length) html += `<div class="it bad"><b>Cartas bloqueadas</b><div>${esc(p.invalid.join(', '))}</div></div>`;
    $('#mInfo .dlist').innerHTML = html; modal('mInfo');
  }
  function openStance() {
    const v = S.view; if (!v) return;
    const P = v.p[S.me], c = CH[P.charId], can = myFree() && !P.stanceChanged;
    const opts = [[1, 'Ofensiva', c.off, 'Mais cartas de ataque'], [0, 'Neutra', null, 'Todas as cartas'], [2, 'Defensiva', c.deff, 'Mais cartas de defesa' + (c.id === 2 ? ' · Shun: mais chance de especial' : '')]];
    $('#mStance .stopts').innerHTML = opts.map(([s, n, b, t]) =>
      `<button class="stopt ${P.stance === s ? 'on' : ''}" data-st="${s}" ${!can || P.stance === s ? 'disabled' : ''}><b>${n}</b><small>${b ? `Força ${sgn(b.attPower)} · Defesa ${sgn(b.defPower)}` : 'Sem bônus'}</small><small>${t}</small></button>`).join('');
    const auto = c.id === 20 && P.boss;
    if (auto) $('#mStance .stopts').querySelectorAll('button').forEach(b => { b.disabled = true; });
    $('#mStance .note').textContent = auto ? 'O Mestre (chefe) troca de postura sozinho, só depois de perder metade da vida, e nunca volta ao neutro.' : can ? 'Muda Força/Defesa e o tipo de carta que você mais recebe. Uma troca por turno.' : (P.stanceChanged ? 'Você já trocou de postura neste turno.' : 'Só dá para trocar no seu turno.');
    modal('mStance');
  }

  // ---------- coleção de cartas
  let tab = 'all';
  function openCards() { show('cards'); renderCards(); }
  function renderCards() {
    $$('#cards .tab').forEach(t => { const on = t.dataset.tab === tab; t.style.backgroundImage = url('tab_' + t.dataset.tab + (on ? '_on' : '')); });
    const g = $('#cards .cgrid'); g.innerHTML = '';
    const items = [];
    if (tab !== 'sp') D.cards.forEach((c, i) => {
      if (c.cardRarity < 1 && c.cardAction !== 'SeventhSense') return;
      const isAtt = c.cardType === 0;
      if (tab === 'att' && !isAtt) return; if (tab === 'def' && isAtt) return;
      items.push({ img: IMG['card_' + c.cardSpriteName], card: c, cost: Math.abs(c.statsRequired.cosmo), label: ['', 'Comum', 'Incomum', 'Rara', 'Épica', 'Lendária'][c.cardRarity] || 'Especial' });
    });
    if (tab === 'all' || tab === 'sp') order.forEach(id => { const c = CH[id]; items.push({ img: IMG['sp_' + c.key], card: c.special, cost: Math.abs(c.special.statsRequired.cosmo), label: c.name, ch: c }); });
    items.forEach(it => {
      const d = document.createElement('div'); d.className = 'cc'; d.style.backgroundImage = 'url("' + it.img + '")';
      d.innerHTML = `<span class="cost">${it.cost}</span><small>${esc(it.label)}</small>`;
      d.addEventListener('click', () => {
        zoomRO = true; Snd.play('sfx_card_zoom', .6);
        fillZoom(it.card, it.img, it.cost, null, it.ch ? E.cardDesc(it.card) + '\n\nEspecial de ' + it.ch.title + '.' : E.cardDesc(it.card), it.card.tittle, typeOf(it.card));
        $('#mZoom .kv').innerHTML = `<span>Custo <b>${it.cost}</b> cosmo</span>`; $('#mZoom .warn').textContent = '';
        $('#mZoom [data-act=use]').style.display = 'none'; modal('mZoom');
      });
      g.appendChild(d);
    });
  }
  $$('#cards .tab').forEach(t => t.addEventListener('click', () => { tab = t.dataset.tab; Snd.play('sfx_button_click', .5); renderCards(); }));

  const CARD_SFX = { '01_soco_intenso': 'sfx_chute_intenso', '02_chute_intenso': 'sfx_chute_intenso', '03_soco_cosmico': 'sfx_chute_cosmico',
    '04_chute_cosmico': 'sfx_chute_cosmico', '05_contra_ataque': 'sfx_contra_ataque', '06_esquiva': 'sfx_esquiva', '07_defesa_perfeita': 'sfx_defesa_perfeita',
    '08_temeridade': 'sfx_temeridade', '09_elevar_cosmo': 'sfx_cosmo_recharge', '10_agilidade': 'sfx_card_sort', '11_bencao_de_athena': 'sfx_bencao_de_atena',
    '12_tormenta_astral': 'sfx_tormenta_astral', '13_poder_do_cosmo': 'sfx_gain_power', '14_golpe_agonizante': 'sfx_golpe_agonizante', '15_sangramento': 'sfx_sangramento',
    '16_furia': 'sfx_furia', '17_concentracao_defensiva': 'sfx_concentracao_defensiva', '18_interferencia_cosmica': 'sfx_interferencia_cosmica',
    '19_aprendizado_defensivo': 'sfx_codigo_do_cavaleiro', '20_ataque_perfurante': 'sfx_ataque_perfurante', '21_destruicao_de_sentidos': 'sfx_destruicao_dos_sentidos',
    '22_ataque_rapido': 'sfx_chute_intenso', '23_defesa_do_cosmo': 'sfx_defesa_do_cosmo', '24_sopro_de_athena': 'sfx_sopro_de_athena',
    '25_destruicao_de_armadura': 'sfx_destruicao_de_armadura', '26_velocidade_da_luz': 'sfx_velocidade_da_luz', '27_tenacidade': 'sfx_tenacidade',
    '28_sentidos_ampliados': 'sfx_gain_power', '29_ataque_desesperado': 'sfx_chute_cosmico', '30_ataque_defensivo': 'sfx_chute_intenso',
    '31_setimo_sentido': 'sfx_setimo_sentido', '34_pureza_de_espirito': 'sfx_info', '35_desespero': 'sfx_lose_power', '36_ataques_continuos': 'sfx_chute_intenso',
    '37_ataques_opressivos': 'sfx_chute_cosmico', '38_afinidade_com_o_signo': 'sfx_afinidade_com_signo' };

  // ---------- online
  function netHandlers() {
    return {
      code: c => { $('#codeOut').textContent = c; $('#onChoice').style.display = 'none'; $('#onWait').style.display = 'flex'; $('#onStatus').textContent = 'Aguardando seu amigo entrar…'; S.code = c; },
      open: () => { Snd.play('sfx_unlock'); S.link.send({ k: 'hello', v: 2 }); S.opPick = null; openSelect(); },
      data: onNet,
      close: () => { if (S.mode === 'host' || S.mode === 'guest') { S.link = null; msg('A conexão com o seu amigo caiu.', goMenu); } },
      error: t => {
        const m = { 'peer-unavailable': 'Sala não encontrada. Confira o código.', 'network': 'Sem conexão com o servidor. Verifique a internet.',
          'server-error': 'Servidor de salas indisponível. Tente de novo.', 'timeout': 'Não foi possível conectar. Tentem os dois na mesma rede Wi-Fi ou de novo em instantes.',
          'browser-incompatible': 'Este navegador não suporta jogo online.', 'lib': 'Não consegui carregar o módulo online. Verifique a internet.' }[t] || ('Erro de conexão: ' + t);
        $('#onMsg').textContent = m; if (S.link) { S.link.close(); S.link = null; }
        $('#onChoice').style.display = 'flex'; $('#onWait').style.display = 'none';
      },
    };
  }
  function onNet(m) {
    if (!m || !m.k) return;
    if (m.k === 'pick') { S.opPick = m.c; if ($('#select').classList.contains('on')) renderSelect(); maybeStartOnline(); }
    else if (m.k === 'begin') { S.me = 1; S.queue = []; vsScreen(m.c1, m.c0).then(() => { enterBattle(true); if (S.queue.length && !S.running) runQueue(); }); }
    else if (m.k === 'upd' && S.mode === 'guest') {
      if (!$('#battle').classList.contains('on')) { S.queue.push({ ev: m.ev, st: m.st }); return; }
      deliver(m.ev, m.st);
    }
    else if (m.k === 'act' && S.mode === 'host' && S.G) { apply(1, m.a); }
    else if (m.k === 'again') { if (!$('#select').classList.contains('on')) { S.opPick = null; openSelect(); toast('Seu amigo quer revanche!'); } }
  }
  async function maybeStartOnline() {
    if (S.mode !== 'host' || S.myPick == null || S.opPick == null || S.starting) return;
    S.starting = true; S.me = 0;
    const G = E.newGame(S.myPick, S.opPick);
    S.link.send({ k: 'begin', c0: S.myPick, c1: S.opPick });
    await vsScreen(S.myPick, S.opPick);
    S.G = G; enterBattle(); S.starting = false; pump();
  }
  async function hostRoom() {
    $('#onMsg').textContent = 'Criando sala…'; S.mode = 'host';
    S.link = new Net.Link(netHandlers());
    try { await S.link.host(); $('#onMsg').textContent = ''; } catch (e) { netHandlers().error('lib'); }
  }
  async function joinRoom() {
    const c = $('#codeIn').value.trim().toUpperCase();
    if (c.length !== 5) { $('#onMsg').textContent = 'Digite o código de 5 letras que seu amigo recebeu.'; return; }
    $('#onMsg').textContent = 'Conectando…'; S.mode = 'guest';
    S.link = new Net.Link(netHandlers());
    try { await S.link.join(c); } catch (e) { netHandlers().error('lib'); }
  }

  // ---------- ações (delegação)
  let helpI = 0;
  stage.addEventListener('click', e => {
    const st = e.target.closest('.stopt'); if (st) { modal('mStance', false); act({ type: 'stance', s: +st.dataset.st }); return; }
    const b = e.target.closest('[data-act]');
    if (!b) {
      if (e.target.closest('.hud .plate')) { const side = e.target.closest('.plate').dataset.side; if (side === 'me') openStance(); else openInfo('op'); return; }
      const el = e.target.closest('.eff,.pd,.hud'); if (el) { Snd.play('sfx_info', .5); openInfo(el.dataset.side || el.closest('[data-side]').dataset.side); }
      return;
    }
    const a = b.dataset.act, scr = (b.closest('.screen') || {}).id, mod = (b.closest('.modal') || {}).id;
    if (a !== 'mute') Snd.play('sfx_button_click', .6);
    switch (a) {
      case 'mute': Snd.toggle(); break;
      case 'fs': fullscreen(); break;
      case 'cpu': S.mode = 'cpu'; fullscreen(true); openSelect(); break;
      case 'santuario': S.mode = 'sant'; fullscreen(true); openSelect(); break;
      case 'cards': openCards(); break;
      case 'santgo': santFight(S.santIdx); break;
      case 'debug': {
        const u = unlockedSet(), on = !!store.get('debug', false);
        $('#mDebug .dbginfo').textContent = `Debug: ${on ? 'ATIVO (todos os personagens e casas aparecem, também no multiplayer)' : 'desligado'} · Progresso real: ${u.size} de ${order.length} personagens · Santuário: ${santReal()} de ${HOUSES.length} casas · Vitórias: ${store.get('wins', 0)}`;
        modal('mDebug'); break;
      }
      case 'dbgall':
        store.set('debug', true);
        modal('mDebug', false); dbgState(); toast('Debug ativo: todos os personagens e casas do Santuário aparecem (o seu progresso real não é alterado).', 3500); break;
      case 'dbgoff':
        store.set('debug', false);
        modal('mDebug', false); dbgState(); toast('Debug desligado: valem só os personagens que você desbloqueou.', 3000); break;
      case 'save': openSave(); break;
      case 'savecopy': {
        const ta = $('#saveCode'); ta.value = store.exportCode(); ta.focus(); ta.select();
        let ok = false; try { ok = document.execCommand('copy'); } catch (e) {}
        if (!ok && navigator.clipboard) navigator.clipboard.writeText(ta.value).then(() => toast('Código copiado!'), () => toast('Segure no código e copie.'));
        else toast(ok ? 'Código copiado! Guarde em um lugar seguro (notas, WhatsApp).' : 'Segure no código e copie.', 3000); break;
      }
      case 'saveload': {
        const ok = store.importText($('#saveCode').value); openSave(true);
        toast(ok ? 'Progresso carregado!' : 'Código inválido. Cole o código completo (começa com CC1-).', 3000); break;
      }
      case 'saveexp': {
        const url = URL.createObjectURL(new Blob([store.exportJSON()], { type: 'application/json' }));
        const a = document.createElement('a'); a.href = url; a.download = 'cosmocards-save.json'; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000); toast('Arquivo cosmocards-save.json baixado.', 3000); break;
      }
      case 'saveimp': $('#saveFile').click(); break;
      case 'dbgreset':
        store.set('unlocked', BASE_UNLOCK); store.set('santuario', 0); store.set('wins', 0); store.set('debug', false);
        modal('mDebug', false); dbgState(); toast('Progresso zerado: só os 5 de Bronze liberados.', 3000); break;
      case 'unlockok': showUnlocks.next && showUnlocks.next(); break;
      case 'online': S.mode = null; $('#onChoice').style.display = 'flex'; $('#onWait').style.display = 'none'; $('#onMsg').textContent = ''; show('online'); break;
      case 'help': helpI = 0; $('#help .slides').style.backgroundImage = url('instr1'); show('help'); break;
      case 'next': helpI = (helpI + 1) % 3; $('#help .slides').style.backgroundImage = url('instr' + (helpI + 1)); break;
      case 'host': fullscreen(true); hostRoom(); break;
      case 'join': fullscreen(true); joinRoom(); break;
      case 'share': {
        const t = `Bora jogar CosmoCards! Abre o jogo, toca em "Online" → "Entrar na sala" e digita o código: ${S.code}`;
        if (navigator.share) navigator.share({ text: t }).catch(() => {}); else copy(t); break;
      }
      case 'copy': copy(S.code); break;
      case 'back':
        if (scr === 'select' && S.mode === 'cpu' && S.selStep === 1) { S.selStep = 0; S.sel = S.myPick; renderSelect(); break; }
        if (scr === 'sant') { openSelect(); break; }
        goMenu(); break;
      case 'confirm': confirmSelect(); break;
      case 'end': act({ type: 'end' }); break;
      case 'quit': modal('mQuit'); break;
      case 'yes': goMenu(); break;
      case 'no': modal('mQuit', false); break;
      case 'use': modal('mZoom', false); if (!zoomRO && zoomUid != null) { const el = $(`.card[data-uid="${zoomUid}"]`); if (el) el.style.opacity = '.3'; act({ type: 'play', uid: zoomUid }); } break;
      case 'close': modal(mod, false); break;
      case 'ok': modal('mMsg', false); if (msg.cb) { const cb = msg.cb; msg.cb = null; cb(); } break;
      case 'again':
        modal('mEnd', false);
        if (S.mode === 'sant') { const won = S.view && S.view.winner === S.me; if (won) openSant(Math.min(santProgress(), HOUSES.length - 1)); else santFight(S.santCur); break; }
        if (S.mode === 'cpu') { openSelect(); break; }
        if (S.link) { S.link.send({ k: 'again' }); S.opPick = null; openSelect(); } else goMenu();
        break;
      case 'menu': goMenu(); break;
    }
  });
  function copy(t) { (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => toast('Copiado!'), () => toast(t, 4000)); }
  function fullscreen(soft) {
    const d = document, el = d.documentElement;
    if (d.fullscreenElement) { if (!soft) d.exitFullscreen().catch(() => {}); return; }
    if (soft && !/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)) return;
    const p = el.requestFullscreen ? el.requestFullscreen({ navigationUI: 'hide' }) : null;
    if (p && p.then) p.then(() => { try { screen.orientation.lock('landscape').catch(() => {}); } catch (e) {} }).catch(() => {});
  }
  $('#codeIn').addEventListener('keydown', e => { if (e.key === 'Enter') joinRoom(); });

  function openSave(keepText) {
    const u = unlockedSet();
    $('#mSave .saveinfo').innerHTML = (store.persistent
      ? '✔ Salvamento automático ativo: o progresso fica guardado neste navegador, no seu celular.'
      : '⚠ Este navegador não guarda dados de um arquivo aberto direto da pasta. Para não perder o progresso, copie o código ou baixe o arquivo e carregue de novo quando abrir o jogo. (Abrindo o jogo por um endereço https ele salva sozinho.)')
      + `<br>Progresso: ${u.size} de ${order.length} personagens · ${santReal()} de ${HOUSES.length} casas · ${store.get('wins', 0)} vitórias`;
    if (!keepText) $('#saveCode').value = '';
    updSaveBtn(); modal('mSave');
  }
  function updSaveBtn() { const b = $('.savebtn'); if (b) b.classList.toggle('warn', !store.persistent); }
  $('#saveFile').addEventListener('change', e => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => { const ok = store.importText(r.result); openSave(true); toast(ok ? 'Progresso carregado do arquivo!' : 'Arquivo inválido.', 3000); };
    r.readAsText(f); e.target.value = '';
  });
  store.onload = () => { updSaveBtn(); sndIcons(); dbgState(); };
  function dbgState() { $('.dbgbtn').classList.toggle('on', !!store.get('debug', false)); $('.dbgbtn').textContent = store.get('debug', false) ? 'DEBUG ✓' : 'DEBUG'; }
  dbgState(); updSaveBtn();
  fit();
  buildGrid();
  show('menu');
  window.__cc = { S, E, act, apply };
})();
