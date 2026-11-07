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
    const SAVE_KEYS = ['unlocked', 'santuario', 'wins', 'lastChar', 'mute', 'stars', 'ach', 'stats', 'torreBest', 'missions', 'weekly'];
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
      if (Number.isFinite(o.stars)) { put('stars', Math.max(mem.stars || 0, o.stars)); n++; }
      if (Number.isFinite(o.torreBest)) { put('torreBest', Math.max(mem.torreBest || 0, o.torreBest)); n++; }
      if (o.ach && typeof o.ach === 'object') { put('ach', Object.assign({}, mem.ach || {}, o.ach)); n++; }
      if (o.stats && typeof o.stats === 'object') {
        const a = mem.stats || {}, r = Object.assign({}, a);
        for (const k in o.stats) { const x = o.stats[k]; if (typeof x === 'number') r[k] = Math.max(a[k] || 0, x); else if (x && typeof x === 'object') r[k] = Object.assign({}, a[k] || {}, x); }
        put('stats', r); n++;
      }
      if (o.missions && o.missions.day && (!mem.missions || o.missions.day >= mem.missions.day) && !(mem.missions && mem.missions.day === o.missions.day)) { put('missions', o.missions); n++; }
      if (o.weekly && o.weekly.key && (!mem.weekly || o.weekly.key >= mem.weekly.key)) { put('weekly', o.weekly); n++; }
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
  for (const k in (window.SIGIMG || {})) IMG['sig_' + k] = toBlob(window.SIGIMG[k]);
  for (const k in window.ASSETS.snd) SND[k] = toBlob(window.ASSETS.snd[k]);
  FX.init(document.getElementById('fxc'), IMG, document.getElementById('battle'), document.getElementById('fxdim'));
  window.ASSETS = null;
  const url = k => 'url("' + IMG[k] + '")';
  const CH = {}; D.chars.forEach(c => { CH[c.id] = c; });
  const cardImg = (charId, ref) => ref === 'S' ? IMG['sp_' + CH[charId].key] : IMG['card_' + D.cards[ref].cardSpriteName];
  const GROUP = { 21: 'seiya', 0: 'seiya', 1: 'shiryu', 2: 'shun', 3: 'hyoga', 4: 'ikki' };
  const grp = id => GROUP[id] || 'ouro';
  const HOUSES = [[5, 'Casa de Áries'], [6, 'Casa de Touro'], [16, 'Casa de Gêmeos'], [7, 'Casa de Câncer'], [9, 'Casa de Leão'],
    [11, 'Casa de Virgem'], [12, 'Casa de Escorpião'], [19, 'Casa de Sagitário'], [13, 'Casa de Capricórnio'], [8, 'Casa de Aquário'], [15, 'Casa de Peixes'], [20, 'Salão do Mestre']];
  const BASE_UNLOCK = [0, 1, 2, 3, 4, 21], AIOROS_WINS = 20;
  const unlockedSet = () => new Set(BASE_UNLOCK.concat(store.get('unlocked', [])));
  // com o DEBUG ativo todos aparecem (inclusive no multiplayer); sem ele, só o que cada jogador desbloqueou
  const isUnl = id => !!store.get('debug', false) || unlockedSet().has(id);
  function unlockChar(id) { const u = unlockedSet(); if (u.has(id)) return false; u.add(id); store.set('unlocked', [...u]); return true; }
  const lockDesc = id => id === 19 ? `Vença mais ${Math.max(1, AIOROS_WINS - store.get('wins', 0))} luta(s) em qualquer modo para desbloquear este personagem!`
    : id === 18 ? 'Atravesse todas as casas do Santuário para desbloquear este personagem!' : id === 20 ? 'Finalize o Santuário (Lenda do Santuário) para desbloquear este personagem!' : id === 21 ? 'Derrote o Mestre do Santuário no modo Santuário para desbloquear este personagem!' : 'Vença este cavaleiro no modo Santuário para desbloqueá-lo!';
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
    muted: store.get('mute', false), sfxOff: store.get('sfxoff', false), bgm: null, key: null, base: {},
    play(n, vol = 1, maxSec) {
      if (this.sfxOff || !SND[n]) return;
      if (!maxSec && !/^(game_over|sfx_versus|sfx_unlock|sfx_your_turn|sfx_opponents_turn)/.test(n)) maxSec = /_especial$/.test(n) ? 3.2 : /^sfx_golpe_/.test(n) ? 2.2 : 1.8;
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
    toggleSfx() { this.sfxOff = !this.sfxOff; store.set('sfxoff', this.sfxOff); },
    toggle() {
      this.muted = !this.muted; store.set('mute', this.muted);
      if (this.bgm) { if (this.muted) this.bgm.pause(); else this.bgm.play().catch(() => {}); }
      sndIcons();
    },
  };
  function updOpt() {
    const tm = '🎵 Música: ' + (Snd.muted ? 'desligada' : 'ligada'), ts = '🔊 Efeitos sonoros: ' + (Snd.sfxOff ? 'desligados' : 'ligados'), tf = '⛶ Tela cheia: ' + (document.fullscreenElement ? 'desativar' : 'ativar'), tr = '👆 Reações por toque: ' + (rOn('guard') ? 'ligadas' : 'desligadas');
    [['#optMusic', tm], ['#qMusic', tm], ['#optSfx', ts], ['#qSfx', ts], ['#optFs', tf], ['#qFs', tf]].forEach(([s, t]) => { const el = $(s); if (el) el.textContent = t; });
  }
  document.addEventListener('fullscreenchange', () => { try { updOpt(); } catch (e) {} });
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
    if (id === 'menu') { try { updMenuBadge(); } catch (e) {} }
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
    S.mode = null; S.G = null; S.view = null; S.queue = []; S.race = null; { const r = $('#onRules'); if (r) r.style.display = 'none'; } show('menu');
  }

  // ---------- seleção de personagem
  const order = [0, 1, 2, 3, 4, 5, 6, 16, 7, 11, 12, 9, 13, 8, 15, 18, 19, 20, 21];
  function buildGrid() {
    const g = $('#select .grid'); g.innerHTML = '';
    order.forEach(id => {
      const d = document.createElement('div'); d.className = 'fr'; d.dataset.id = id;
      d.innerHTML = `<div class="face" style='background-image:${url('thumb_' + CH[id].key)}'></div><img src="${IMG.fr_open}" alt=""><img class="s" src="${IMG.fr_sel}" alt=""><img class="e" src="${IMG.fr_en}" alt=""><img class="l" src="${IMG.fr_lock}" alt="" style="display:none">`;
      d.addEventListener('click', () => {
        if (!isUnl(id)) { Snd.play('sfx_info', .6); toast('🔒 ' + lockDesc(id), 3200); return; }
        if (!ruleOk(id)) { Snd.play('sfx_info', .6); toast('Fora das regras desta sala: ' + rulesText(S.rules), 3200); return; }
        S.sel = id; Snd.play('sfx_character_change', .7); renderSelect();
      });
      g.appendChild(d);
    });
  }
  function openSelect() {
    S.selStep = 0; S.myPick = null; S.myTeam = [];
    if (S.mode !== 'host' && S.mode !== 'guest') S.opPick = null;
    S.sel = store.get('lastChar', 0); if (!CH[S.sel] || !isUnl(S.sel)) S.sel = 0;
    if (!ruleOk(S.sel)) { const ok = order.find(i => isUnl(i) && ruleOk(i)); if (ok != null) S.sel = ok; }
    show('select'); renderSelect();
  }
  function plate(side, id) {
    const p = $('#select .selplate.' + side), m = $('#select .selmodel.' + side);
    if (id == null) { p.classList.add('hide'); m.style.opacity = 0; return; }
    p.classList.remove('hide'); m.style.opacity = 1;
    p.querySelector('span').innerHTML = CH[id].title.replace(/ de /i, '<br>de ');
    m.src = IMG['model_' + CH[id].key];
    const bb = SELBB[CH[id].key] || [0, 600], sz = STAT[id] || 1, H = 600, ch = Math.min(690, 585 * sz / .97), hh = ch / ((bb[1] - bb[0]) / H);
    m.style.height = hh + 'px'; { const w = hh * 414 / 600, X0 = 250, off = (X0 - (SELCX[CH[id].key] || .5) * w) + 'px'; m.style.left = side === 'l' ? off : 'auto'; m.style.right = side === 'r' ? off : 'auto'; } m.style.bottom = (26 - (1 - bb[1] / H) * hh) + 'px';
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
      const selCyan = ((S.mode === 'cpu' && S.selStep === 1) ? id === S.myPick : id === (S.myPick != null ? S.myPick : S.sel)) || (S.myTeam || []).includes(id);
      const selRed = (S.mode === 'cpu' && S.selStep === 1 && id === S.sel) || (online && id === S.opPick) || (S.mode === 'sant' && id === right);
      t.classList.toggle('sel', selCyan); t.classList.toggle('en', selRed);
      t.classList.toggle('lock', !isUnl(id) || !ruleOk(id));
    });
    const c = CH[S.sel];
    let status = '';
    const tb = $('#select .teamsel'); tb.style.display = (S.mode === 'cpu' && S.selStep === 0 && !(S.myTeam || []).length) ? '' : 'none';
    tb.textContent = '⚙ Luta: ' + ['', 'Solo', 'Dupla', 'Trio'][tSize()] + (soloT().hp ? ' · ' + soloT().hp + ' HP' : '');
    if (S.mode === 'cpu') status = S.selStep === 0 ? (tSize() > 1 ? 'Monte a equipe: cavaleiro ' + ((S.myTeam || []).length + 1) + ' de ' + tSize() + '. Combinações dão sinergia!' : 'Escolha o seu cavaleiro e toque em Avançar.') : 'Agora escolha o oponente (marcado em vermelho).';
    else if (online && S.rules && S.rules.pick === 'draft' && S.myPick == null && firstPicker() !== S.me && S.opPick == null) status = 'Draft: aguarde o outro jogador escolher primeiro…';
    else if (online) status = S.myPick != null ? (S.opPick != null ? 'Começando…' : 'Aguardando seu amigo escolher…') : (S.opPick != null ? 'Seu amigo já escolheu. Sua vez!' : 'Escolha seu cavaleiro.');
    else status = S.mode === 'weekly' ? 'Chefe da semana: escolha o cavaleiro para o duelo.' : S.mode === 'torre' ? 'Torre: escolha o cavaleiro para subir o mais alto que conseguir.' : 'Santuário: escolha o cavaleiro que vai atravessar as Casas do Zodíaco.';
    $('#select .selinfo').innerHTML = `<b>${esc(c.passive.split('\n')[0])}</b> ${esc(c.passive.split('\n').slice(1).join(' '))}<br>` +
      `Vida ${selHp(c)} · Força ${c.stats.attPower} · Defesa ${c.stats.defPower} · Especial: ${esc(c.special.tittle)}<br><span style="color:#9fe8ff">${esc(status)}</span>`;
    if (online && S.myPick == null && tSize() > 1) $('#select .selinfo').innerHTML += `<br><span style="color:#ffcf40">Monte a equipe: cavaleiro ${S.myTeam.length + 1} de ${tSize()}.</span>`;
    $('#select [data-act=confirm]').disabled = online && (S.myPick != null || (S.rules && S.rules.pick === 'draft' && firstPicker() !== S.me && S.opPick == null));
    if (online && S.rules) { const el = $('#select .selinfo'); el.innerHTML += `<br><span style="color:#ffcf40">Regras: ${esc(rulesText(S.rules))}</span>`; }
  }
  function confirmSelect() {
    Snd.play('sfx_button_click');
    store.set('lastChar', S.sel);
    if (S.mode === 'cpu') {
      if (S.selStep === 0) {
        if (tSize() > 1) {
          if (S.myTeam.includes(S.sel)) { toast('Esse cavaleiro já está na equipe.', 2000); return; }
          S.myTeam.push(S.sel);
          if (S.myTeam.length < tSize()) { const nx = order.find(i => isUnl(i) && !S.myTeam.includes(i)); if (nx != null) S.sel = nx; renderSelect(); return; }
          const syn = soloT().syn ? E.synergies(S.myTeam) : []; if (syn.length) toast('Sinergia: ' + syn.map(x => x.name + ' (' + x.desc + ')').join(' · '), 4200);
        } else S.myTeam = [S.sel];
        S.myPick = S.myTeam[0]; S.selStep = 1;
        const others = order.filter(i => i !== S.myPick && isUnl(i)); S.sel = others[Math.floor(Math.random() * others.length)];
        renderSelect(); return;
      }
      const n = tSize() - 1, pool = order.filter(i => isUnl(i) && i !== 20 && i !== S.sel).sort(() => Math.random() - .5);
      startLocal(S.myPick, S.sel, null, { mod: Mo.rollMod(0.7), wx: Mo.rollWx(0.4), t0: S.myTeam.slice(1), t1: pool.slice(0, n), tr: soloT(), hp: soloT().hp }); return;
    }
    if (S.mode === 'torre') { S.myPick = S.sel; startTower(); return; }
    if (S.mode === 'weekly') { S.myPick = S.sel; startWeekly(); return; }
    if (S.mode === 'sant') { S.myPick = S.sel; openSant(); return; }
    const rl = S.rules || DEF_RULES;
    if ((rl.pick === 'mirror' || rl.pick === 'draft') && S.opPick != null && (S.opTeam || [S.opPick]).includes(S.sel)) { toast('Espelho proibido: escolha um cavaleiro diferente do seu amigo.', 3000); return; }
    if (rl.fmt === 'tower') { S.myPick = S.sel; startRace(); return; }
    if (tSize() > 1) {
      if (S.myTeam.includes(S.sel)) { toast('Esse cavaleiro já está na equipe.', 2000); return; }
      S.myTeam.push(S.sel);
      if (S.myTeam.length < tSize()) { const nx = order.find(i => isUnl(i) && ruleOk(i) && !S.myTeam.includes(i)); if (nx != null) S.sel = nx; renderSelect(); return; }
      S.myPick = S.myTeam[0];
    } else { S.myTeam = [S.sel]; S.myPick = S.sel; }
    S.link.send({ k: 'pick', c: S.myPick, t: S.myTeam }); renderSelect(); maybeStartOnline();
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
  function santFight(i) { S.santCur = i; startLocal(S.myPick, HOUSES[i][0], HOUSES[i][1], { hp: 500, b1: { life: i * 25 }, wx: Mo.WX[i % Mo.WX.length].id }); }

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

  // ---------- missões, conquistas e estatísticas
  const Mo = window.Modes;
  const getStats = () => Object.assign({ wins: 0, specials: 0, dmg: 0, cards: 0, crits: 0, stance: 0, torreBest: 0, combos: 0, ults: 0, weeklyWins: 0, winChars: {}, modsWon: {} }, store.get('stats', {}));
  function missionsToday() { let m = store.get('missions', null); const d = Mo.todayKey(); if (!m || m.day !== d) { m = Mo.rollDaily(d); store.set('missions', m); } return m; }
  const addStars = n => store.set('stars', store.get('stars', 0) + n);
  const qToast = [];
  function pushToast(t) { qToast.push(t); if (qToast.length === 1) (function nx() { toast(qToast[0], 3000); setTimeout(() => { qToast.shift(); if (qToast.length) nx(); }, 3100); })(); }
  function checkAch() {
    const got = store.get('ach', {}), sx = Object.assign(getStats(), { santuario: santReal() }); let ch = false;
    Mo.ACH.forEach(a => { if (!got[a.id] && a.chk(sx)) { got[a.id] = 1; ch = true; addStars(a.stars); pushToast('🏆 Conquista: ' + a.name + ' (+' + a.stars + ' ★)'); } });
    if (ch) store.set('ach', got);
  }
  function track(ev, n = 1, extra) {
    const s = getStats();
    if (ev === 'win') { s.wins++; if (extra && extra.key) s.winChars[extra.key] = 1; if (extra && extra.mod) s.modsWon[extra.mod] = 1; }
    else if (ev === 'special') s.specials++; else if (ev === 'dmg') s.dmg += n; else if (ev === 'cards') s.cards++;
    else if (ev === 'crit') s.crits++; else if (ev === 'stance') s.stance++; else if (ev === 'combo') s.combos++; else if (ev === 'ult') s.ults++; else if (ev === 'weekly') s.weeklyWins++;
    else if (ev === 'floor' && extra && extra.floor > s.torreBest) s.torreBest = extra.floor;
    store.set('stats', s);
    const m = missionsToday(); let ch = false;
    m.list.forEach(q => {
      if (q.done) return; const d = Mo.missionDef(q.id); let add = 0;
      if (d.ev === ev) add = n;
      if (ev === 'win') { if (d.ev === 'winMod' && extra && extra.mod) add = 1; if (d.ev === 'winChar' && extra && extra.key === q.key) add = 1; }
      if (add) { q.prog = Math.min(d.goal, q.prog + add); ch = true; if (q.prog >= d.goal) { q.done = true; addStars(d.stars); pushToast('★ Missão cumprida: ' + Mo.missionText(q) + ' (+' + d.stars + ' ★)'); } }
    });
    if (ch) store.set('missions', m);
    checkAch();
  }
  function updMenuBadge() {
    const m = missionsToday(), left = m.list.filter(q => !q.done).length;
    const b = $('#menu .mbadge'); if (b) b.textContent = left ? left : '';
  }
  function openMis() {
    const m = missionsToday(), stars = store.get('stars', 0), r = Mo.rankOf(stars), got = store.get('ach', {});
    const pct = r.next ? Math.round((stars - r.from) / (r.next - r.from) * 100) : 100;
    $('#mMis .misrank').innerHTML = `<b>${esc(r.name)}</b> · ${stars} ★ · Bônus na Torre: +${Mo.rankBonus(stars).life} de vida`
      + `<div class="bar2"><i style="width:${pct}%"></i></div>` + (r.next ? `<small style="color:#bbb">Próxima patente (${esc(r.nextName)}): ${r.next} ★</small>` : '<small style="color:#bbb">Patente máxima!</small>');
    $('#mMis .mislist').innerHTML = '<div class="mish" style="font-size:16px">Missões de hoje (renovam todo dia)</div>' + m.list.map(q => { const d = Mo.missionDef(q.id); return `<div class="mrow${q.done ? ' done' : ''}"><span>${q.done ? '✔ ' : ''}${esc(Mo.missionText(q))} <small style="color:#aaa">(${Math.min(q.prog, d.goal)}/${d.goal})</small></span><small>+${d.stars} ★</small></div>`; }).join('');
    $('#mMis .achlist').innerHTML = Mo.ACH.map(a => `<div class="mrow${got[a.id] ? ' done' : ''}"><span>${got[a.id] ? '🏆 ' : '🔒 '}<b>${esc(a.name)}</b><br><small style="color:#aaa;font-weight:400">${esc(a.desc)}</small></span><small>+${a.stars} ★</small></div>`).join('');
    modal('mMis');
  }

  // ---------- Duelo de Chefes semanal
  function openWeekly() {
    const w = Mo.weekly(), done = (store.get('weekly', {}) || {}).key === w.key, mm = Mo.modById(w.mod), ww = Mo.wxById(w.wx);
    $('#mTower .ttl').textContent = '👑 Chefe da Semana';
    $('#mTower .twbody').innerHTML = `<div class="vsl">${esc(w.boss === 20 ? '???' : CH[w.boss].title)}</div>`
      + `<div>Vida +${w.scale.life} · Força +${w.scale.att} · Defesa +${w.scale.def} · gera mais cosmo</div>`
      + `<div class="evl">${mm.ic} ${esc(mm.name)} — ${esc(mm.desc)}</div><div class="evl">${ww.ic} ${esc(ww.name)} — ${esc(ww.desc)}</div>`
      + `<div style="color:${done ? '#6fd08a' : '#ffcf40'}">${done ? '✔ Recompensa desta semana já coletada (dá para lutar de novo por diversão)' : 'Primeira vitória da semana: +' + w.reward + ' ★'}</div>`
      + '<div style="color:#aaa;font-size:14px">O chefe, a regra e o clima mudam toda semana.</div>';
    $('#mTower .twbtns').innerHTML = '<button class="btn small" data-act="weeklygo">Escolher cavaleiro</button><button class="btn small ghost" data-act="close">Fechar</button>';
    modal('mTower');
  }
  function startWeekly() {
    const w = Mo.weekly(); S.wk = w;
    startLocal(S.myPick, w.boss, 'Chefe da Semana', { hp: 500, mod: w.mod, wx: w.wx, b0: Mo.rankBonus(store.get('stars', 0)), b1: w.scale });
  }

  // ---------- Torre (modo roguelike)
  const ZOD = [5, 6, 7, 8, 9, 11, 12, 13, 15, 16];
  function towerEnemy(f) {
    if (f % 10 === 0) return 20;
    let pool = f <= 3 ? [0, 1, 2, 3, 4] : f < 9 ? [0, 1, 2, 3, 4, 21, 5, 6, 7, 8, 9, 11, 12, 13] : ZOD.concat([19, 18]);
    if (Mo.isBossFloor(f)) pool = ZOD;
    pool = pool.filter(i => i !== S.run.char); return pool[Math.floor(Math.random() * pool.length)];
  }
  function startTower() {
    S.run = { char: S.myPick, floor: 1, bless: [], relics: [], kind: 'b', rank: Mo.rankBonus(store.get('stars', 0)), opts: [] };
    towerIntro();
  }
  function towerIntro() {
    const R = S.run, f = R.floor; R.enemy = towerEnemy(f); R.mod = Mo.towerMod(f);
    const boss = Mo.isBossFloor(f), e = CH[R.enemy], mm = Mo.modById(R.mod), best = store.get('torreBest', 0);
    const chips = (R.bless.length || R.relics.length) ? R.relics.map(id => { const b = Mo.relicById(id); return `<span class="chip" style="border-color:#9fe8ff">${b.ic} ${esc(b.name)}</span>`; }).concat(R.bless.map(id => { const b = Mo.blessById(id); return `<span class="chip">${b.ic} ${esc(b.name)}</span>`; })).join('') : '<span class="chip">nenhuma bênção ainda</span>';
    $('#mTower .ttl').textContent = 'Torre · Andar ' + f + (boss ? ' — CHEFE' : '');
    $('#mTower .twbody').innerHTML = `<div class="vsl">${esc(CH[R.char].title)} <span style="color:#ff8a6a">×</span> ${esc(R.enemy === 20 ? '???' : e.title)}</div>`
      + (mm ? `<div class="evl">${mm.ic} Evento: ${esc(mm.name)} — ${esc(mm.desc)}</div>` : '<div style="color:#aaa">Sem evento neste andar.</div>')
      + (S.race ? `<div class="racel" style="color:#9fe8ff">👥 Amigo: ${raceTxt()}</div>` : '') + `<div>Seu cavaleiro: Patente +${R.rank.life} de vida</div><div class="chips">${chips}</div><div style="color:#aaa;font-size:14px">Recorde: andar ${best}</div>`;
    $('#mTower .twbtns').innerHTML = '<button class="btn small" data-act="towerfight">Lutar!</button><button class="btn small ghost" data-act="towerquit">Desistir</button>';
    show('menu'); S.mode = 'torre'; Snd.music('character_selection_2'); modal('mTower');
  }
  function towerFight() {
    const R = S.run, f = R.floor; modal('mTower', false);
    const es = Mo.enemyScale(f); if (Mo.isBossFloor(f)) es.life += 120;
    startLocal(R.char, R.enemy, 'Torre · Andar ' + f + (Mo.isBossFloor(f) ? ' · Chefe' : ''), { hp: 450, mod: R.mod, wx: Mo.rollWx(f >= 4 ? 0.45 : 0), b0: Object.assign(Mo.sumBless(R.bless, R.rank), { relics: R.relics.slice() }), b1: es });
  }
  function towerBless() {
    const R = S.run, rel = (R.floor - 1) % 3 === 0 && Mo.pickRelics(R.relics).length > 0;
    R.kind = rel ? 'r' : 'b'; R.opts = rel ? Mo.pickRelics(R.relics) : Mo.pickBless(R.bless);
    $('#mTower .ttl').textContent = 'Andar ' + (R.floor - 1) + ' vencido! Escolha ' + (rel ? 'uma relíquia' : 'uma bênção');
    $('#mTower .twbody').innerHTML = '<div class="blrow">' + R.opts.map((b, i) => `<div class="bl${b.rare || S.run.kind === 'r' ? ' rare' : ''}" data-act="blesspick" data-i="${i}"><div class="ic">${b.ic}</div><b>${esc(b.name)}</b><span>${esc(b.desc)}</span></div>`).join('') + '</div>';
    $('#mTower .twbtns').innerHTML = '';
    show('menu'); S.mode = 'torre'; Snd.music('character_selection_2'); modal('mTower');
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
    const rx = a.type === 'play' || a.type === 'sig'; if (rx) E.setReact(G, pi, a);
    if (a.type === 'play') { ok = E.playCard(G, pi, a.uid); if (!ok && S.mode !== 'host' && pi === 1) E.endTurn(G, pi); }
    else if (a.type === 'stance') ok = E.setStance(G, pi, a.s);
    else if (a.type === 'ult') ok = E.ultimate(G, pi);
    else if (a.type === 'sense') ok = E.seventhSense(G, pi);
    else if (a.type === 'sig') ok = E.signature(G, pi);
    else if (a.type === 'swap') ok = E.swapTo(G, pi, a.i);
    else if (a.type === 'trap') ok = E.setTrap(G, pi, a.uid);
    else if (a.type === 'discard') ok = E.discardCard(G, pi, a.uid);
    else if (a.type === 'end') ok = E.endTurn(G, pi);
    if (rx) E.clearReact(G, pi);
    pump();
  }
  function act(a) {
    if (!S.view || S.view.over || S.running) return;
    if (S.view.turn !== S.me || S.busyR) return;
    if (S.mode === 'guest') {
      if (S.pending) return;
      (async () => {
        if (viewAtk(a) && rOn('prec')) { S.busyR = true; renderControls(); try { a.prec = await mgPrec(1 - S.me); } catch (e) {} S.busyR = false; }
        S.pending = true; S.link.send({ k: 'act', a }); renderControls();
      })(); return;
    }
    applyR(S.me, a);
  }
  // ---------- reações por toque: Guarda Perfeita / Aparar / Contra-golpe (defesa) e Golpe Preciso (ataque)
  const rOn = k => S.mode === 'cpu' ? soloT().react !== false : (S.mode === 'host' || S.mode === 'guest') ? !(S.rules && S.rules.react === false) : true;   // só o Solo (opções da luta) e o anfitrião (regras da sala) podem desligar
  function viewAtk(a) {
    if (a.type !== 'play') return false;   // cartas especiais e Golpe Assinatura não têm reação por toque
    const P = S.view.p[S.me], h = P.hand.find(x => x.uid === a.uid), c = h && E.cardOf(P, h.ref); return !!(c && c.offensive && !c.special);
  }
  function isAtk(G, pi, a) {
    if (a.type !== 'play') return false;
    const p = G.p[pi], h = p.hand.find(x => x.uid === a.uid), c = h && E.cardOf(p, h.ref); return !!(c && c.offensive && !c.special);
  }
  function askRemote() {
    return new Promise(res => { const to = setTimeout(() => { S.askRes = null; res(0); }, 9000); S.askRes = q => { clearTimeout(to); S.askRes = null; res(q); }; S.link.send({ k: 'ask' }); });
  }
  async function applyR(pi, a) {
    const G = S.G; if (!G || !a) return;
    if (isAtk(G, pi, a) && !G.over) {
      S.busyR = true; renderControls();
      try {
        const d = 1 - pi;
        const cpuM = S.mode === 'cpu' || S.mode === 'sant' || S.mode === 'torre' || S.mode === 'weekly', lv = S.mode === 'torre' && S.run ? Math.min(.2, S.run.floor * .01) : 0;
        if (pi === S.me && a.prec == null && rOn('prec')) a.prec = await mgPrec(d);
        else if (cpuM && pi === 1 && a.prec == null) a.prec = rOn('prec') && Math.random() < .3 + lv ? 1 : 0;   // NPC também acerta o ponto fraco
        a.guard = 0; a.guard2 = 0;
        const hc = G.p[pi].hand.find(x => x.uid === a.uid), nh = hc && a.type === 'play' && E.cardOf(G.p[pi], hc.ref).hits > 1 ? 2 : 1;   // Golpe Duplo: a guarda é testada duas vezes
        for (let k = 0; k < nh; k++) {
          let g = 0;
          if (cpuM && d === 1) { if (rOn('guard')) { const r = Math.random(), pp = .1 + lv; g = r < pp ? (Math.random() < .4 ? 3 : 2) : r < pp + .3 ? 1 : 0; } }   // NPC também defende
          else if (d === S.me) { if (rOn('guard')) g = await mgGuard(d, G.p[d].debuffs.some(x => x.easyGuard)); }
          else if (S.mode === 'host' && S.link) g = await askRemote();
          if (k === 0) a.guard = g; else a.guard2 = g;
        }
      } catch (e) { console.error(e); }
      S.busyR = false;
    }
    apply(pi, a);
  }
  function mgRun(build) {
    return new Promise(res => {
      const el = $('#react'); el.innerHTML = ''; el.style.pointerEvents = ''; el.dataset.tok = String((+el.dataset.tok || 0) + 1); el.classList.add('on'); let fin = false, tm;
      const fw = ev => { if (!el.classList.contains('on')) return; if (el.contains(ev.target)) return; const h = el['on' + ev.type]; if (h) { ev.preventDefault(); h(ev); } };
      const evs = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'];
      evs.forEach(n => window.addEventListener(n, fw, true)); document.body.style.touchAction = 'none';
      const unbind = () => { evs.forEach(n => window.removeEventListener(n, fw, true)); document.body.style.touchAction = ''; };
      const done = (v, txt, ok, sub) => { if (fin) return; fin = true; clearTimeout(tm);
        el.onpointerdown = el.onpointerup = el.onpointermove = el.onpointercancel = null; unbind(); el.style.pointerEvents = 'none';
        const lvl = ok ? (v >= 2 ? 'perfect' : 'good') : 'miss';
        el.querySelectorAll('.rg-ring:not(.tgt),.rg-arrow,.rg-weak').forEach(n => n.classList.add('res-' + lvl));
        el.querySelectorAll('.rg-lbl').forEach(n => n.remove());
        const fb = $('#rfb'), fl = document.createElement('div'); fl.className = 'rfl ' + lvl; fb.appendChild(fl); setTimeout(() => fl.remove(), 520);
        if (txt) { const t = mk('rg-res ' + lvl, el.dataset.x, el.dataset.y - 130, txt); if (sub) { const s = document.createElement('small'); s.textContent = sub; t.appendChild(s); } fb.appendChild(t); setTimeout(() => t.remove(), 900); }
        Snd.play(lvl === 'perfect' ? 'sfx_gain_power' : lvl === 'good' ? 'sfx_card_flip' : 'sfx_lose_power', .8);
        if (lvl === 'perfect') FX.shake(6, .25);
        const tok = el.dataset.tok;
        setTimeout(() => { if (el.dataset.tok === tok) { el.classList.remove('on'); el.style.pointerEvents = ''; el.innerHTML = ''; } }, 450);
        setTimeout(() => res(v), txt ? 170 : 20); };
      build(el, done, t => { tm = setTimeout(() => done(0, 'MUITO LENTO', false), t); });
    });
  }
  function mk(cls, x, y, txt) { const d = document.createElement('div'); d.className = cls; d.style.left = x + 'px'; d.style.top = y + 'px'; if (txt) d.textContent = txt; return d; }
  function ripple(el, e, lvl) { const s = stage.getBoundingClientRect(), r = document.createElement('div'); r.className = 'rg-rip ' + lvl; r.style.left = (rot ? (e.clientY - s.top) / scale : (e.clientX - s.left) / scale) + 'px'; r.style.top = (rot ? (s.right - e.clientX) / scale : (e.clientY - s.top) / scale) + 'px'; el.appendChild(r); }
  const toGame = (dx, dy) => rot ? [dy, -dx] : [dx, dy];
  function mgTap(pi) {   // anel que encolhe: toque quando fechar no alvo
    const [x, y] = chest(pi), EZ = S.easy, T = EZ ? 1200 : 950, TW = EZ ? 190 : 120, GW = EZ ? 400 : 280;
    return mgRun((el, done, arm) => {
      el.dataset.x = x; el.dataset.y = y;
      el.appendChild(mk('rg-lbl', x, y - 190, 'DEFENDA! Toque quando o anel fechar'));
      const tgt = mk('rg-ring tgt', x, y); tgt.style.width = tgt.style.height = (EZ ? '150px' : '110px'); el.appendChild(tgt);
      const ring = mk('rg-ring mv', x, y); ring.style.width = ring.style.height = '420px'; el.appendChild(ring);
      let t0 = performance.now() + 40;
      requestAnimationFrame(() => requestAnimationFrame(() => { t0 = performance.now(); ring.style.transition = `transform ${T}ms linear`; ring.style.transform = 'translate(-50%,-50%) scale(' + (EZ ? .357 : .262) + ')'; }));
      Snd.play('sfx_card_zoom', .6);
      el.onpointerdown = ev => { const sg = performance.now() - t0 - T, e = Math.abs(sg), ms = Math.round(sg) + ' ms';
        ripple(el, ev, e <= TW ? 'perfect' : e <= GW ? 'good' : 'miss');
        if (e <= TW) done(2, 'PERFEITO!', true, ms); else if (e <= GW) done(1, 'BOM!', true, sg < 0 ? 'um pouco cedo' : 'um pouco tarde'); else done(0, 'ERROU!', false, sg < 0 ? 'cedo demais' : 'tarde demais'); };
      arm(T + 320);
    });
  }
  function mgSwipe(pi, want, T, lbl) {   // deslize na direção indicada: 'up' | 'left' | 'right'
    const [x, y] = chest(pi), AR = { up: '⬆', left: '⬅', right: '➡' };
    return mgRun((el, done, arm) => {
      el.dataset.x = x; el.dataset.y = y;
      el.appendChild(mk('rg-lbl', x, y - 190, lbl));
      el.appendChild(mk('rg-arrow', x, y, AR[want]));
      const t0 = performance.now(); let sx = 0, sy = 0, td = 0, down = false; Snd.play('sfx_card_zoom', .6);
      const judge = e => { if (!down) return; const [gx, gy] = toGame(e.clientX - sx, e.clientY - sy), len = Math.hypot(gx, gy);
        if (len < 22 * scale) return; down = false; ripple(el, e, 'good');
        const dir = Math.abs(gx) > Math.abs(gy) ? (gx > 0 ? 'right' : 'left') : (gy < 0 ? 'up' : 'down'), t = performance.now() - td;   // duração do gesto (a partir do toque), não do aparecimento da seta
        if (dir !== want) return done(0, 'DIREÇÃO ERRADA', false, 'era ' + ({ up: 'para cima', left: 'para a esquerda', right: 'para a direita' })[want]);
        if (t <= 650) done(2, 'PERFEITO!', true, 'deslize rápido'); else done(1, 'BOM!', true, 'um pouco lento'); };
      el.onpointerdown = e => { down = true; td = performance.now(); sx = e.clientX; sy = e.clientY; }; el.onpointermove = judge; el.onpointerup = judge;
      arm(T);
    });
  }
  async function mgGuard(pi, easy) {
    S.easy = !!easy;
    const swipe = Math.random() < 0.4; let q;
    if (swipe) { const want = ['up', 'left', 'right'][Math.floor(Math.random() * 3)]; q = await mgSwipe(pi, want, S.easy ? 1500 : 1100, 'APARE! Deslize na direção da seta'); }
    else q = await mgTap(pi);
    if (q === 2) { const c = await mgSwipe(pi, 'up', 1000, 'CONTRA-GOLPE! Deslize para cima'); if (c === 2 || c === 1) q = 3; }
    return q;
  }
  function mgPrec(pi) {   // ponto fraco do oponente: toque nele para um golpe preciso
    const [cx, cy] = chest(pi), x = cx + R2(-60, 60), y = cy + R2(-110, 40), T = 900;
    return mgRun((el, done, arm) => {
      el.dataset.x = cx; el.dataset.y = cy;
      el.appendChild(mk('rg-lbl', cx, cy - 190, 'GOLPE PRECISO! Toque no ponto fraco'));
      const w = mk('rg-weak', x, y); el.appendChild(w);
      w.onpointerdown = e => { e.stopPropagation(); done(2, 'PRECISO!', true, '+15% de dano'); };
      el.onpointerdown = ev => { ripple(el, ev, 'miss'); done(0, 'ERROU O PONTO', false, 'dano normal'); };
      arm(T);
    });
  }
  const R2 = (a, b) => a + Math.random() * (b - a);
  async function startLocal(c0, c1, house, opts) {
    if (S.mode !== 'sant' && S.mode !== 'torre' && S.mode !== 'weekly') S.mode = 'cpu';
    S.me = 0; S.house = house || null;
    const sy = ['t0', 't1'].map((k, i) => opts && opts[k] && opts[k].length ? E.synergies([i ? c1 : c0].concat(opts[k])).map(x => x.name) : []);
    const mm = opts && opts.mod ? Mo.modById(opts.mod) : null, ww = opts && opts.wx ? Mo.wxById(opts.wx) : null;
    await vsScreen(c0, c1, [house, mm && ('Evento: ' + mm.name), ww && ('Clima: ' + ww.name), sy[0].length && ('Sua sinergia: ' + sy[0].join(', '))].filter(Boolean).join(' · '));
    S.G = E.newGame(c0, c1, 0, opts); S.G.p[1].boss = true; enterBattle(); pump();
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
    if ((S.mode === 'cpu' || S.mode === 'sant' || S.mode === 'torre' || S.mode === 'weekly') && v.turn === 1) {
      setTimeout(() => { if (S.G && !S.running && S.G.turn === 1 && !S.G.over) applyR(1, E.aiStep(S.G, 1)); }, 650);
    }
  }

  const sideOf = pi => pi === S.me ? 'me' : 'op';
  function fighterEl(pi) { return $('#battle .fighter.' + sideOf(pi)); }
  const chest = pi => [centerOf(pi)[0], 330];
  const dir = pi => sideOf(pi) === 'me' ? 1 : -1;
  // aura de cosmo em volta do personagem: cor por personagem, intensidade pelo cosmo acumulado
  const AURA = { seiya: '235,252,255|140,225,255|50,160,225', seiyacap: '235,252,255|140,225,255|50,160,225', shiryu: '170,255,190|30,215,100|8,120,50', ikki: '255,225,150|255,135,20|190,50,0',
    shun: '255,190,240|205,90,255|110,40,190', hyoga: '70,170,255|20,90,255|8,40,210', gold: '255,243,176|255,200,60|200,135,0', dark: '150,70,230|60,15,110|10,0,20' };
  const auraKey = (p, stance) => { const k = CH[p.charId].key; if (k === 'mestre') return stance ? 'dark' : 'gold'; return AURA[k] ? k : 'gold'; };

  // fumaça de energia + raios verticais do cosmo (canvas atrás do personagem)
  const auraSys = (() => {
    const R = (a, b) => a + Math.random() * (b - a), S = [];
    ['me', 'op'].forEach(side => { const f = document.querySelector('#battle .fighter.' + side), cv = f && f.querySelector('.faura canvas'); if (cv) S.push({ f, cv, g: cv.getContext('2d'), pu: [], st: [], acc: 0, acc2: 0 }); });
    let last = 0;
    const col = (f, n) => (f.style.getPropertyValue(n) || '255,243,176').trim();
    function step(now) {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      S.forEach(s => {
        const { f, g, cv } = s, on = f.classList.contains('c-on'), k = parseFloat(f.style.getPropertyValue('--k')) || 0;
        g.clearRect(0, 0, cv.width, cv.height);
        if (!on && !s.pu.length && !s.st.length) return;
        const ca = col(f, '--ca'), cb = col(f, '--cb'), cd = col(f, '--cd'), W = cv.width, H = cv.height;
        if (on) {
          s.acc += dt * (6 + k * 26); while (s.acc > 1) { s.acc--; s.pu.push({ x: W / 2 + R(-130, 130) * (0.6 + k * 0.5), y: H - R(20, 120), vy: -R(60, 130) * (0.8 + k), r: R(50, 100) * (0.7 + k * 0.5), t: 0, life: R(1.1, 2), c: Math.random() < 0.5 ? ca : cb, d: Math.random() * 6 }); }
          s.acc2 += dt * (3 + k * 16); while (s.acc2 > 1) { s.acc2--; s.st.push({ x: W / 2 + R(-190, 190) * (0.5 + k * 0.6), y: H - R(0, 160), vy: -R(260, 520) * (0.7 + k * 0.6), h: R(120, 340) * (0.6 + k * 0.6), w: R(3, 9), t: 0, life: R(0.5, 1.1), c: 0 });
          }
        }
        for (let i = s.pu.length - 1; i >= 0; i--) {
          const p = s.pu[i]; p.t += dt; if (p.t > p.life) { s.pu.splice(i, 1); continue; }
          p.y += p.vy * dt; p.x += Math.sin(p.t * 2 + p.d) * 20 * dt;
          const u = p.t / p.life, a = Math.sin(Math.PI * u) * (0.55 + k * 0.45), r = p.r * (0.7 + u * 0.7);
          const gr = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
          gr.addColorStop(0, `rgba(${p.c},${a})`); gr.addColorStop(0.55, `rgba(${p.c},${a * 0.55})`); gr.addColorStop(1, `rgba(${cd},0)`);
          g.fillStyle = gr; g.fillRect(p.x - r, p.y - r, r * 2, r * 2);
        }
        for (let i = s.st.length - 1; i >= 0; i--) {
          const p = s.st[i]; p.t += dt; if (p.t > p.life) { s.st.splice(i, 1); continue; }
          p.y += p.vy * dt; const u = p.t / p.life, a = Math.sin(Math.PI * u) * (0.8 + k * 0.4);
          const gr = g.createLinearGradient(0, p.y, 0, p.y + p.h);
          gr.addColorStop(0, `rgba(${ca},0)`); gr.addColorStop(0.5, `rgba(${ca},${a})`); gr.addColorStop(1, `rgba(${cb},${a * 0.3})`);
          g.fillStyle = gr; g.fillRect(p.x - p.w / 2, p.y, p.w, p.h);
          g.fillStyle = `rgba(255,255,255,${a * 0.7})`; g.fillRect(p.x - p.w / 6, p.y + p.h * 0.25, p.w / 3, p.h * 0.5);
        }
      });
      requestAnimationFrame(step);
    }
    requestAnimationFrame(t => { last = t; step(t); });
    return true;
  })();
  function fAura(side, p, h) {
    const f = $('#battle .fighter.' + side); if (!f || !p) return;
    const [a, b, d] = AURA[h.senseOn ? 'gold' : auraKey(p, h.stance)].split('|'), k = h.senseOn ? 1 : (h.maxCosmo > 0 ? Math.max(0, Math.min(1, h.cosmo / h.maxCosmo)) : 0);
    f.style.setProperty('--ca', a); f.style.setProperty('--cb', b); f.style.setProperty('--cd', d); f.style.setProperty('--k', k.toFixed(3));
    f.classList.toggle('c-on', k > 0.04); f.classList.toggle('c-max', k >= 0.995); f.classList.toggle('c-dark', auraKey(p, h.stance) === 'dark');
  }
  const stanceFx = () => {};
  // o Mestre do Santuário aparece como "???" até assumir uma postura; aí revela quem é: Saga de Gêmeos
  const revealed = p => p.charId === 20 && !!p.stance;
  function hudName(p, side) {
    const c = CH[p.charId];
    return (revealed(p) ? 'Saga de Gêmeos' : c.name) + (side === 'me' ? '' : (S.mode === 'host' || S.mode === 'guest') ? ' (amigo)' : ' (CPU)');
  }
  // Mestre do Santuário: primeira troca de postura (revelação)
  async function mestreReveal(pi, st) {
    const f = fighterEl(pi), img = f.querySelector('img'), key = CH[st.p[pi].charId].key, rv = $('#battle .mreveal');
    f.classList.add('charge'); Snd.play('sfx_setimo_sentido', .9, 3.6);
    rv.classList.remove('show'); void rv.offsetWidth; rv.classList.add('show');
    await FX.reveal(chest(pi), dir(pi), () => {
      img.src = IMG['spr2_' + key]; f.classList.remove('charge'); f.classList.add('rise');
      $('#battle .hud.' + sideOf(pi) + ' .nm').textContent = hudName({ charId: st.p[pi].charId, stance: 1 }, sideOf(pi));
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
        if (me) { track('cards'); if (e.special) track('special'); }
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
      case 'sig': {
        const c = CH[e.charId], sp = $('#battle .special'), img = sp.querySelector('img');
        img.src = IMG['vs_' + c.key] || IMG['model_' + c.key];
        const left = sideOf(e.p) === 'me';
        img.style.left = left ? '70px' : 'auto'; img.style.right = left ? 'auto' : '70px';
        img.style.transform = `translateX(${left ? -600 : 600}px)` + (left ? '' : ' scaleX(-1)');
        sp.querySelector('.sname').textContent = e.title.toUpperCase();
        sp.classList.add('show'); Snd.play('sfx_' + c.sfx + '_especial', 1, 3.2);
        await wait(30); img.style.transform = left ? 'translateX(0)' : 'translateX(0) scaleX(-1)';
        await wait(1300); const fl = $('#battle .flash'); fl.classList.remove('go'); void fl.offsetWidth; fl.classList.add('go');
        sp.classList.remove('show'); await wait(200);
        setTimeout(() => Snd.play('sfx_golpe_' + c.sfx, .9, 2.2), 450);
        await FX.sig(e.fx, chest(e.p), chest(1 - e.p), dir(e.p), e.c1, e.c2);
        return;
      }
      case 'ult': {
        const c = CH[e.charId]; if (me) track('ult');
        floatText(e.p, 'COSMO FINAL!', 'good', -40); Snd.play('sfx_' + c.sfx + '_especial'); await wait(700);
        const fl = $('#battle .flash'); fl.classList.remove('go'); void fl.offsetWidth; fl.classList.add('go');
        await FX.special(c.key, chest(e.p), chest(1 - e.p), dir(e.p)); return;
      }
      case 'sense': {
        const c = CH[e.charId]; if (me) track('ult');
        floatText(e.p, '8º SENTIDO · ARAYASHIKI!', 'good', -40); Snd.play('sfx_setimo_sentido', .9, 3.4);
        const f = fighterEl(e.p); f.classList.add('charge'); FX.flash('#fff2b0', 0.9, 0.55); FX.shake(5, 0.6);
        await wait(1500); f.classList.remove('charge'); return;
      }
      case 'weather': { const fl = $('#battle .flash'); fl.classList.remove('go'); void fl.offsetWidth; fl.classList.add('go'); FX.shake(10, 0.5); Snd.play('sfx_golpe_saga', .5, 1.2); floatText(0, '⚡ Raio!', 'bad', -20); floatText(1, '⚡ Raio!', 'bad', -20); await wait(500); return; }
      case 'dmg': {
        if (!me && e.v > 0) track('dmg', Math.round(e.v));
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
      case 'text': if (e.crit && !me) track('crit'); if (e.combo && me) track('combo'); if (e.sfx) Snd.play(e.sfx); floatText(e.p, e.txt, e.kind === 'fail' ? 'bad' : 'good', -10);
        if (e.txt === 'GRANDE CHIFRE!') await FX.horn(chest(e.p), chest(1 - e.p), dir(e.p));
        else if (e.kind === 'counter' || e.kind === 'block') FX.hit(chest(e.p), e.kind === 'block' ? '#9fe8ff' : '#ffb060', 0.7);
        await wait(e.kind === 'counter' || e.kind === 'block' ? 800 : 600); return;
      case 'swap': {
        Snd.play('sfx_character_change'); const f = fighterEl(e.p), key = CH[e.charId].key;
        f.classList.add('charge'); await wait(250);
        f.querySelector('img').src = IMG['spr_' + key]; setSz(sideOf(e.p), e.charId); stanceFx(sideOf(e.p), 0);
        floatText(e.p, CH[e.charId].name + (e.forced ? ' entra!' : ' assume!'), 'good', -10);
        await wait(450); f.classList.remove('charge'); return;
      }
      case 'trap': {
        if (e.set) { Snd.play('sfx_card_in', .7); floatText(e.p, me ? ('Armadilha: ' + e.title) : 'Armadilha armada!', 'good', -10); await wait(650); }
        else await wait(100);
        return;
      }
      case 'discard': Snd.play('sfx_card_out', .7); if (me) renderHand(st); await wait(250); return;
      case 'cosmo': if (e.v > 0) { Snd.play('sfx_cosmo_recharge', .5); floatText(e.p, '+' + Math.round(e.v) + ' Cosmo', 'good', 60); } await wait(420); return;
      case 'draw': if (me && !e.silent) Snd.play('sfx_card_flip', .7); if (me) renderHand(st); await wait(e.silent ? 0 : 200); return;
      case 'stance': {
        if (me && e.s) track('stance');
        // revelação: chefe (CPU) sempre; jogador usando o Mestre só com o DEBUG ativo
        const first = !(S.mReveal && S.mReveal[e.p]);
        if (e.reveal || (first && e.s && store.get('debug', false) && st.p[e.p].charId === 20)) { (S.mReveal = S.mReveal || {})[e.p] = true; await mestreReveal(e.p, st); }
        else Snd.play('sfx_character_change');
        } $('#battle .fighter.' + sideOf(e.p) + ' img').src = IMG[(e.s ? 'spr2_' : 'spr_') + CH[st.p[e.p].charId].key]; stanceFx(sideOf(e.p), e.s); floatText(e.p, ['Postura Neutra', 'Postura Ofensiva', 'Postura Defensiva'][e.s], 'good', -30); await wait(300); return;
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
        if (win) { store.set('wins', store.get('wins', 0) + 1); track('win', 1, { key: CH[st.p[S.me].charId].key, mod: st.mod }); }
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
        if (onl() && S.rules && S.rules.fmt === 'bo3' && S.series) {
          const sr = S.series; if (e.winner >= 0) sr.w[e.winner]++; sr.games++; sr.keep = e.winner;
          const mine = sr.w[S.me], theirs = sr.w[1 - S.me];
          if (sr.w[0] >= 2 || sr.w[1] >= 2 || sr.games >= 5) {
            sr.fin = true; again = 'Nova série';
            m = (mine > theirs ? 'Você venceu a série ' : mine < theirs ? 'Seu amigo venceu a série ' : 'A série terminou empatada ') + mine + ' x ' + theirs + '!';
          } else { m = (win ? 'Vitória!' : draw ? 'Empate!' : 'Derrota!') + ` Placar da série: você ${mine} x ${theirs} amigo. ` + (draw ? 'Os dois mantêm o cavaleiro.' : win ? 'Você mantém o cavaleiro; seu amigo escolhe outro.' : 'Você escolhe outro cavaleiro; seu amigo mantém o dele.'); again = 'Próxima luta'; }
        }
        if (S.mode === 'weekly') {
          const w = S.wk || Mo.weekly();
          if (win) {
            if ((store.get('weekly', {}) || {}).key !== w.key) { store.set('weekly', { key: w.key }); addStars(w.reward); track('weekly'); m = 'Chefe da semana derrotado! +' + w.reward + ' ★'; }
            else m = 'Vitória! (a recompensa desta semana já foi coletada)';
          } else m = 'O chefe foi mais forte desta vez. Tente de novo com outro cavaleiro!';
          again = 'Lutar de novo';
        }
        if (S.mode === 'torre') {
          const f = S.run.floor;
          if (win) {
            track('floor', 1, { floor: f }); if (f > store.get('torreBest', 0)) store.set('torreBest', f);
            S.run.floor++;
            if (S.race) { S.race.me.cleared = f; S.link && S.link.send({ k: 'race', c: f, d: false }); }
          } else if (draw) { m = 'Empate! Este andar será sorteado de novo.'; again = 'Tentar o andar'; S.run.redo = true; }
          else { m = 'Sua jornada terminou no andar ' + f + '. Recorde: andar ' + store.get('torreBest', 0) + '.'; again = 'Nova jornada'; S.run.dead = true;
            if (S.race) { S.race.me = { cleared: f - 1, dead: true }; S.race.pending = true; S.link && S.link.send({ k: 'race', c: f - 1, d: true }); } }
        }
        $('#mEnd .endmsg').textContent = m; $('#mEnd [data-act=again]').textContent = again;
        showUnlocks(unl, () => (S.mode === 'torre' && win) ? towerBless() : (S.race && S.race.pending ? raceResult() : modal('mEnd'))); return;
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
      fAura(side, st.p[pi], h);
      { const rg = el.querySelector('.rage'); rg.style.display = st.norage ? 'none' : ''; const ready = h.rage >= 100 && !(h.ult && h.sense); rg.classList.toggle('ready', ready); rg.classList.toggle('used', !!(h.ult && h.sense)); { const sb = $('#battle .pd.' + side + ' .star'); if (sb) sb.classList.toggle('glow', ready); } rg.querySelector('i').style.width = Math.min(100, h.rage) + '%'; rg.querySelector('b').textContent = (h.ult && h.sense) ? 'PODERES USADOS' : ready ? 'PRONTO' : (h.senseOn ? '8º SENTIDO ✦ ' : 'FÚRIA ') + h.rage + '%'; }
      el.querySelector('.plate span').textContent = ['NEUTRA', 'OFENSIVA', 'DEFENSIVA'][h.stance];
      const pd = $('#battle .pd.' + side);
      pd.querySelector('.att').textContent = Math.round(h.att); pd.querySelector('.def').textContent = Math.round(h.def);
    });
    const oph = $('#battle .ophand'); const n = hud[1 - S.me].hand;
    if (oph.childElementCount !== n) { oph.innerHTML = ''; for (let i = 0; i < n; i++) { const d = document.createElement('div'); d.style.backgroundImage = url('card_back'); oph.appendChild(d); } }
  }
  // proporção dos personagens na batalha: referência = Seiya de Pégaso (V1); cada um mantém a sua estatura
  const SELCX = { afrodite: .493, aioria: .496, aioros: .509, aldebaran: .492, camus: .5, deathmask: .496, hyoga: .489, ikki: .516, mestre: .503, miro: .498, mu: .483, saga: .518, seiya: .527, seiyacap: .505, seiyasag: .607, shaka: .503, shiryu: .509, shun: .504, shura: .464 };
  const SELBB = { afrodite: [83, 587], aioria: [67, 584], aioros: [13, 590], aldebaran: [0, 594], camus: [95, 592], deathmask: [31, 583], hyoga: [112, 598], ikki: [104, 595], mestre: [0, 600], miro: [60, 581], mu: [73, 589], saga: [38, 586], seiya: [125, 600], seiyacap: [1, 600], seiyasag: [0, 600], shaka: [84, 591], shiryu: [108, 597], shun: [136, 596], shura: [46, 585] };
  const STAT = { 21: .92, 0: .92, 1: .94, 2: .9, 3: .95, 4: .96, 5: .97, 6: 1.08, 16: .98, 7: .95, 11: .98, 12: .95, 9: 1, 13: .97, 8: 1, 15: .98, 18: 1, 19: 1.02, 20: 1 };
  const setSz = (side, id) => { const im = $('#battle .fighter.' + side + ' img'); if (im) im.style.setProperty('--sz', STAT[id] || 1); };
  function openUlt() { const P = S.view.p[S.me]; $('#mUlt [data-act=ultgo]').disabled = !!P.ultUsed; $('#mUlt [data-act=sensego]').disabled = !!(P.senseUsed || P.senseOn); modal('mUlt'); }
  function renderSig(v) {
    const el = $('#sigcard'), I = E.sigInfo(v.p[S.me]);
    if (!I || v.over) { el.style.display = 'none'; return; }
    el.style.display = '';
    if (el.dataset.key !== I.key) { el.dataset.key = I.key; el.querySelector('.sf').src = IMG['sig_' + (I.t === 'def' ? 'frame_blue' : 'frame_red')];
      const sa = el.querySelector('.sart'), custom = IMG['sig_art_' + I.key];
      sa.style.backgroundImage = 'url(' + (custom || IMG['model_' + I.key]) + ')';
      if (custom) { sa.style.backgroundSize = 'cover'; sa.style.backgroundPosition = 'center'; }
      else { const bb = SELBB[I.key] || [0, 600], sw = 111, sh = 84, bgH = sh / (0.5 * (bb[1] - bb[0]) / 600), bgW = bgH * 414 / 600;
        sa.style.backgroundSize = bgW + 'px ' + bgH + 'px'; sa.style.backgroundPosition = (sw / 2 - (SELCX[I.key] || .5) * bgW) + 'px ' + (-(bb[0] / 600) * bgH + 2) + 'px'; } }
    el.classList.toggle('ready', !!I.ready); el.classList.toggle('can', !!I.can); el.classList.toggle('spent', I.uses >= 2);
    el.querySelector('.scost').textContent = I.cost;
    el.querySelector('.snm').textContent = I.name;
    el.querySelector('.sbar i').style.width = Math.min(100, I.prog / I.goal * 100) + '%';
    el.querySelector('.sbar b').textContent = I.uses >= 2 ? 'ESGOTADO' : I.ready ? 'PRONTO' : I.prog + '/' + I.goal + ' ' + I.trig;
  }
  function render() {
    const v = S.view; if (!v) return;
    renderSig(v);
    const P = v.p[S.me], O = v.p[1 - S.me];
    ['me', 'op'].forEach(side => {
      const p = side === 'me' ? P : O, c = CH[p.charId], g = grp(p.charId), el = $('#battle .hud.' + side);
      $('#battle .fighter.' + side + ' img').src = IMG[(p.stance ? 'spr2_' : 'spr_') + c.key]; setSz(side, p.charId); stanceFx(side, p.stance);
      el.querySelector('.frame').src = IMG['hp_' + g];
      el.querySelector('.glass img').src = IMG['vidro_' + g];
      el.querySelector('.plate img').src = IMG['sel_' + g];
      el.querySelector('.bar .fill').style.backgroundImage = url('hp_bar');
      el.querySelector('.nm').textContent = hudName(p, side);
      const good = p.debuffs.filter(d => !d.negativeDebuff).length, bad = p.debuffs.filter(d => d.negativeDebuff).length;
      el.querySelector('.effs').innerHTML = (good ? `<div class="eff" data-side="${side}" style='background-image:${url('ic_buff')}'><b>${good}</b></div>` : '') +
        (bad ? `<div class="eff" data-side="${side}" style='background-image:${url('ic_debuff')}'><b>${bad}</b></div>` : '');
    });
    const hud = v.p.map(p => { const c = E.cur(p); return { life: p.stats.life, maxLife: p.stats.maxLife, cosmo: p.stats.cosmo, maxCosmo: p.stats.maxCosmo, att: c.attPower, def: c.defPower, stance: p.stance, hand: p.hand.length, rage: Math.round(p.rage || 0), ult: !!p.ultUsed, sense: !!p.senseUsed, senseOn: !!p.senseOn }; });
    renderHud(hud, v);
    renderBench(v);
    $$('#battle .fighter').forEach(f => f.classList.remove('turn'));
    if (!v.over) fighterEl(v.turn).classList.add('turn');
    renderHand(v);
    renderControls();
  }
  function renderBench(v) {
    ['me', 'op'].forEach(side => {
      const p = v.p[side === 'me' ? S.me : 1 - S.me], el = $('#battle .bench.' + side);
      let html = '';
      if (p.bench && p.bench.length) {
        html += (p.bench).map((b, i) => `<div class="bf${b.stats.life <= 0 ? ' dead' : ''}${side === 'me' && b.stats.life > 0 && !p.swapped && v.turn === S.me && !v.over && v.tr && v.tr.swap !== 'fall' && p.stats.cosmo >= E.swapCost(v) && myFree() ? ' can' : ''}" data-i="${i}" title="${esc(CH[b.charId].name)}" style='background-image:${url('thumb_' + CH[b.charId].key)}'><i><b style="width:${Math.max(0, Math.round(100 * b.stats.life / b.stats.maxLife))}%"></b></i></div>`).join('');
      }
      if (el.innerHTML !== html) el.innerHTML = html;
      const ti = $('#trap' + (side === 'me' ? 'Me' : 'Op')); ti.classList.toggle('on', !!p.trap);
      if (p.trap) { const tx = side === 'me' ? '<small>Armadilha</small>' + esc(p.trap.title) : '<small>Armadilha</small>?'; if (ti.innerHTML !== tx) ti.innerHTML = tx; }
    });
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  const myFree = () => { const v = S.view; return v && v.turn === S.me && !v.over && !S.running && !S.pending && !S.busyR; };
  function renderControls() {
    const v = S.view; if (!v) return;
    const P = v.p[S.me], mine = v.turn === S.me && !v.over, free = myFree();
    $('#battle .hud.me .plate').classList.toggle('can', free && !P.stanceChanged);
    const et = $('#battle .endturn'); et.disabled = !free;
    const usable = P.hand.some(h => E.isUsable(v, P, E.cardOf(P, h.ref)));
    et.classList.toggle('pulse', free && !usable);
    $('#battle .turninfo').textContent = v.over ? '' : 'Rodada ' + Math.ceil(v.totalTurn / 2) + ' · ' + (mine ? 'Seu turno' : 'Turno do oponente');
    { const wt = $('#battle .wxt'), ww = Mo.wxById(v.wx); wt.classList.toggle('on', !!ww); if (ww) wt.textContent = ww.ic + ' ' + ww.name; const wxe = $('#wx'); wxe.className = ww ? 'on w-' + ww.id : ''; }
    { const mt = $('#battle .modtag:not(.wxt)'), mm = Mo.modById(v.mod); mt.classList.toggle('on', !!mm); if (mm) mt.textContent = mm.ic + ' ' + mm.name; }
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
  let zoomAt = 0, armed = null;
  const armBtn = (id, label, run) => {
    if (Date.now() - zoomAt < 700) return;
    const b = $('#' + id);
    if (armed === id) { armed = null; run(); return; }
    armed = id; const old = b.textContent; b.textContent = 'Toque de novo para confirmar';
    setTimeout(() => { if (armed === id) { armed = null; b.textContent = label; } }, 2500);
  };
  function openZoom(uid) {
    const v = S.view; if (!v) return;
    const P = v.p[S.me], h = P.hand.find(x => x.uid === uid); if (!h) return;
    const card = E.cardOf(P, h.ref); zoomUid = uid; zoomRO = false;
    Snd.play('sfx_card_zoom', .6); zoomAt = Date.now(); armed = null;
    const est = E.estimate(v, P, card), cost = Math.round(E.costOf(P, card));
    fillZoom(card, cardImg(P.charId, h.ref), cost, est, E.cardDesc(card), card.special ? CH[P.charId].special.tittle : card.tittle, typeOf(card));
    $('#mZoom .kv').innerHTML = `<span>Custo <b>${cost}</b> cosmo</span>` + (est != null ? `<span>Dano previsto <b>${est}</b></span>` : '') + `<span>Seu cosmo <b>${Math.floor(P.stats.cosmo)}</b></span>`;
    let warn = '';
    if (v.turn !== S.me) warn = 'Espere o seu turno para usar.';
    else if (!E.isUsable(v, P, card)) warn = 'Cosmo insuficiente.';
    if (P.invalid.includes(card.tittle)) warn = 'Esta carta foi bloqueada pelo Código do Cavaleiro: ela vai falhar.';
    $('#mZoom .warn').textContent = warn;
    const use = $('#mZoom [data-act=use]'); use.style.display = ''; use.disabled = !(E.isUsable(v, P, card) && myFree());
    const zt = $('#zTrap'), zd = $('#zDisc'), norm = !card.special && !zoomRO;
    zt.style.display = zd.style.display = norm ? '' : 'none';
    const tOk = E.trapOk(P, card); zt.style.display = norm && tOk ? '' : 'none';
    zt.textContent = '🪤 Armadilha (-' + E.trapCost(P, card) + ')';
    zd.textContent = '♻ Descartar (+' + E.DISCARD_COSMO + ')';
    zt.disabled = !(myFree() && !P.trap && P.stats.cosmo >= E.trapCost(P, card));
    zd.disabled = !(myFree() && !P.discarded);
    if (norm) $('#mZoom .kv').innerHTML += `<span>${tOk ? '🪤 Armadilha (custa +15): ativa o efeito desta carta ANTES do próximo ataque do inimigo · ' : ''}♻ Descartar: ganha ${E.DISCARD_COSMO} de cosmo (1x por turno)</span>`;
    
    modal('mZoom');
  }
  function openInfo(side) {
    const v = S.view; if (!v) return;
    const p = v.p[side === 'me' ? S.me : 1 - S.me], c = CH[p.charId];
    $('#mInfo .ttl').textContent = revealed(p) ? 'Saga de Gêmeos' : c.title;
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
        zoomRO = true; { const a1 = $('#zTrap'), a2 = $('#zDisc'); if (a1) a1.style.display = 'none'; if (a2) a2.style.display = 'none'; } Snd.play('sfx_card_zoom', .6);
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

  // ---------- regras da sala online
  // vida que o cavaleiro tem de verdade na luta, conforme o modo (Santuário 500, Chefe da Semana 500, Torre 450, Solo/online = regra escolhida)
  function selHp(c) {
    if (S.mode === 'sant' || S.mode === 'weekly') return 500;
    if (S.mode === 'torre') return 450;
    if (S.mode === 'cpu') return soloT().hp || c.stats.life;
    if (S.mode === 'host' || S.mode === 'guest') return (S.rules && S.rules.hp) || c.stats.life;
    return c.stats.life;
  }
  const DEF_RULES = { react: true, hp: 0, fmt: 'single', pick: 'free', mod: '', wx: '', epic: false, norage: false, filter: 'all', team: 1, swap: 'free', assist: true, syn: true, last: false };
  const TDEF = { react: true, hp: 0, team: 1, swap: 'free', assist: true, syn: true, last: false };
  const soloT = () => Object.assign({}, TDEF, store.get('teamRules', {}));
  const tSize = () => { if (onl()) { const r = S.rules || DEF_RULES; return r.fmt === 'tower' ? 1 : (r.team || 1); } return soloT().team; };
  const teamTxt = r => { const p = [{ 1: 'Solo', 2: 'Dupla', 3: 'Trio' }[r.team]]; p.push({ free: 'troca 10 cosmo', gratis: 'troca grátis', fall: 'troca só ao cair' }[r.swap]); if (!r.assist) p.push('sem assistência'); if (!r.syn) p.push('sem sinergias'); if (r.last) p.push('Último Cavaleiro'); return p.join(', '); };
  const PRESETS = {
    clas: {}, sorteio: { mod: 'random', wx: 'random' }, epica: { epic: true }, bo3: { fmt: 'bo3' }, draft: { pick: 'draft' },
    semfuria: { norage: true }, zod: { filter: 'zod' }, bronze: { filter: 'bronze' }, torre: { fmt: 'tower' },
    dupla: { team: 2 }, trio: { team: 3 }, trioduro: { team: 3, swap: 'fall', last: true },
  };
  const onl = () => S.mode === 'host' || S.mode === 'guest';
  const ruleOk = id => { const r = S.rules; if (!r || !onl()) return true; if (r.filter === 'zod') return id > 4 && id !== 21; if (r.filter === 'bronze') return id <= 4 || id === 21; return true; };
  function rulesText(r) {
    r = r || DEF_RULES; const p = [{ single: 'Luta única', bo3: 'Melhor de 3', tower: 'Torre a dois' }[r.fmt] || 'Luta única'];
    if (r.mod === 'random') p.push('Evento sorteado'); else if (r.mod) { const m = Mo.modById(r.mod); if (m) p.push('Evento: ' + m.name); }
    if (r.wx === 'random') p.push('Clima sorteado'); else if (r.wx) { const w = Mo.wxById(r.wx); if (w) p.push('Clima: ' + w.name); }
    if (r.react === false) p.push('Sem reações por toque'); if (r.hp) p.push('Vida ' + r.hp); if (r.epic) p.push('Batalha Épica'); if (r.norage) p.push('Sem Fúria');
    if (r.filter === 'zod') p.push('Só Zodíacos'); if (r.filter === 'bronze') p.push('Só Bronzes');
    if (r.pick === 'mirror') p.push('Espelho proibido'); if (r.pick === 'draft') p.push('Draft');
    if ((r.team || 1) > 1 && r.fmt !== 'tower') p.push('Equipe: ' + teamTxt(r));
    return p.join(' · ');
  }
  const hpOpts = '<option value="0">Padrão do personagem (250 a 400)</option>' + Array.from({ length: 59 }, (_, i) => 100 + i * 50).map(v => `<option value="${v}">${v} de vida</option>`).join('');
  function fillRuleSelects() {
    $('#rHp').innerHTML = hpOpts; $('#tHp').innerHTML = hpOpts;
    $('#rMod').innerHTML = '<option value="">Nenhum</option><option value="random">Sorteado a cada luta</option>' + Mo.MODS.map(m => `<option value="${m.id}">${m.ic} ${esc(m.name)}</option>`).join('');
    $('#rWx').innerHTML = '<option value="">Nenhum</option><option value="random">Sorteado a cada luta</option>' + Mo.WX.map(w => `<option value="${w.id}">${w.ic} ${esc(w.name)}</option>`).join('');
  }
  function readRules() {
    S.rules = { react: $('#rReact').value !== '0', hp: +$('#rHp').value, fmt: $('#rFmt').value, pick: $('#rPick').value, mod: $('#rMod').value, wx: $('#rWx').value, epic: $('#rEpic').value === '1', norage: $('#rRage').value === '0', filter: $('#rFilter').value,
      team: +$('#rTeam').value, swap: $('#rSwap').value, assist: $('#rAssist').value === '1', syn: $('#rSyn').value === '1', last: $('#rLast').value === '1' };
    $('#rSum').textContent = rulesText(S.rules);
  }
  function writeRules(r) {
    $('#rReact').value = r.react === false ? '0' : '1'; $('#rHp').value = String(r.hp || 0); $('#rFmt').value = r.fmt; $('#rPick').value = r.pick; $('#rMod').value = r.mod; $('#rWx').value = r.wx; $('#rEpic').value = r.epic ? '1' : '0'; $('#rRage').value = r.norage ? '0' : '1'; $('#rFilter').value = r.filter;
    $('#rTeam').value = r.team || 1; $('#rSwap').value = r.swap || 'free'; $('#rAssist').value = r.assist === false ? '0' : '1'; $('#rSyn').value = r.syn === false ? '0' : '1'; $('#rLast').value = r.last ? '1' : '0';
    readRules();
  }
  fillRuleSelects();
  ['rReact', 'rHp', 'rFmt', 'rPick', 'rMod', 'rWx', 'rEpic', 'rRage', 'rFilter', 'rTeam', 'rSwap', 'rAssist', 'rSyn', 'rLast'].forEach(id => $('#' + id).addEventListener('change', readRules));
  function readSoloT() {
    const t = { react: $('#tReact').value !== '0', hp: +$('#tHp').value, team: +$('#tTeam').value, swap: $('#tSwap').value, assist: $('#tAssist').value === '1', syn: $('#tSyn').value === '1', last: $('#tLast').value === '1' };
    store.set('teamRules', t); $('#tSum').textContent = (t.react === false ? 'Sem reações por toque. ' : '') + (t.hp ? 'Vida de cada cavaleiro: ' + t.hp + '. ' : '') + (t.team > 1 ? 'Equipe: ' + teamTxt(t) : 'Sem equipe: você luta com um cavaleiro só.');
    if ($('#select').classList.contains('on')) renderSelect();
  }
  ['tReact', 'tHp', 'tTeam', 'tSwap', 'tAssist', 'tSyn', 'tLast'].forEach(id => $('#' + id).addEventListener('change', readSoloT));
  function openTeamOpts() {
    const t = soloT(); $('#tReact').value = t.react === false ? '0' : '1'; $('#tHp').value = String(t.hp || 0); $('#tTeam').value = t.team; $('#tSwap').value = t.swap; $('#tAssist').value = t.assist ? '1' : '0'; $('#tSyn').value = t.syn ? '1' : '0'; $('#tLast').value = t.last ? '1' : '0';
    readSoloT(); modal('mTeam');
  }
  // séries (melhor de 3) e escolhas
  const newSeries = () => ({ w: [0, 0], games: 0, chars: [], keep: null });
  const firstPicker = () => (S.gameNo || 0) % 2;
  function trySendKeep() {
    const sr = S.series, r = S.rules;
    if (!(r && r.fmt === 'bo3' && sr && sr.keep != null && sr.games > 0 && !sr.fin)) return;
    if (!S.friendIn || S.keepSent || !$('#select').classList.contains('on') || !S.link) return;
    if (sr.keep === S.me || sr.keep === -1) { S.keepSent = true; S.myPick = sr.chars[S.me]; S.myTeam = (sr.teams && sr.teams[S.me]) || [S.myPick]; S.link.send({ k: 'pick', c: S.myPick, t: S.myTeam }); renderSelect(); maybeStartOnline(); }
  }
  function enterSelectOnline() { S.opPick = null; S.opTeam = null; S.keepSent = false; openSelect(); }
  // corrida da Torre a dois
  const raceTxt = () => { const f = S.race.fr; return f.gone && !f.dead ? 'saiu da partida' : f.dead ? 'caiu no andar ' + (f.cleared + 1) : f.cleared ? 'venceu ' + f.cleared + ' andar(es)' : 'começando…'; };
  const updRace = () => { const el = $('#mTower .racel'); if (el && S.race) el.textContent = '👥 Amigo: ' + raceTxt(); };
  function startRace() {
    S.race = { me: { cleared: 0, dead: false }, fr: { cleared: 0, dead: false }, done: false };
    startTower();
  }
  function raceResult() {
    const R = S.race; if (!R) return; R.pending = false;
    if (!R.fr.dead && !R.fr.gone) {
      $('#mTower .ttl').textContent = 'Sua jornada acabou';
      $('#mTower .twbody').innerHTML = `<div class="vsl">Você venceu ${R.me.cleared} andar(es)</div><div class="racel">👥 Amigo: ${raceTxt()}</div><div>Aguardando seu amigo terminar…</div>`;
      $('#mTower .twbtns').innerHTML = '<button class="btn small ghost" data-act="towerquit">Sair</button>';
      modal('mTower'); R.waiting = true; return;
    }
    R.waiting = false; R.done = true; modal('mTower', false);
    const a = R.me.cleared, b = R.fr.cleared, win = a > b;
    $('#mEnd img').src = IMG[win ? 'win' : 'lose']; Snd.music(null); Snd.play(win ? 'game_over_victory' : 'game_over_fail');
    $('#mEnd .endmsg').textContent = (a > b ? 'Você venceu a corrida!' : a < b ? 'Seu amigo venceu a corrida.' : 'Empate na corrida!') + ` Você: ${a} andar(es) · Amigo: ${b} andar(es).`;
    $('#mEnd [data-act=again]').textContent = 'Revanche'; modal('mEnd');
  }

  // ---------- online
  function netHandlers() {
    return {
      code: c => { $('#codeOut').textContent = c; $('#onChoice').style.display = 'none'; $('#onWait').style.display = 'flex'; $('#onStatus').textContent = 'Aguardando seu amigo entrar…'; S.code = c; },
      open: () => {
        Snd.play('sfx_unlock'); S.opPick = null; S.myPick = null; S.series = newSeries(); S.gameNo = 0; S.friendIn = false; S.keepSent = false; S.race = null;
        if (S.mode === 'host') { if (!S.rules) S.rules = Object.assign({}, DEF_RULES); S.link.send({ k: 'hello', v: 3, rules: S.rules }); $('#onRules').style.display = 'none'; }
        else S.link.send({ k: 'hello', v: 3 });
        openSelect();
        if (S.rules && S.mode === 'host') toast('Regras: ' + rulesText(S.rules), 3500);
      },
      data: onNet,
      close: () => {
        if (S.race) { S.race.fr.gone = true; S.race.fr.dead = true; S.link = null; toast('Seu amigo saiu da partida.'); updRace(); if (S.race.waiting) raceResult(); return; }
        if (S.mode === 'host' || S.mode === 'guest') { S.link = null; msg('A conexão com o seu amigo caiu.', goMenu); } },
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
    if (m.k === 'hello' && S.mode === 'guest') { S.rules = m.rules || Object.assign({}, DEF_RULES); toast('Regras: ' + rulesText(S.rules), 3500); if ($('#select').classList.contains('on')) { if (!ruleOk(S.sel)) S.sel = order.find(i => isUnl(i) && ruleOk(i)); renderSelect(); } }
    else if (m.k === 'race' && S.race) { S.race.fr = { cleared: m.c, dead: !!m.d }; updRace(); if (S.race.waiting && m.d) raceResult(); }
    else if (m.k === 'clash') { S.myPick = null; S.opPick = null; S.myTeam = []; S.opTeam = null; S.keepSent = false; openSelect(); toast('Os dois escolheram o mesmo cavaleiro. Escolham de novo!', 3000); }
    else if (m.k === 'pick') { S.opPick = m.c; S.opTeam = m.t || [m.c]; if ($('#select').classList.contains('on')) renderSelect(); maybeStartOnline(); }
    else if (m.k === 'begin') { S.me = 1; S.queue = []; S.gameNo = (S.gameNo || 0) + 1; S.friendIn = false; S.keepSent = false; if (!S.series) S.series = newSeries(); S.series.chars = [m.c0, m.c1]; S.series.teams = [m.tm0 || [m.c0], m.tm1 || [m.c1]]; vsScreen(m.c1, m.c0, m.info).then(() => { enterBattle(true); if (S.queue.length && !S.running) runQueue(); }); }
    else if (m.k === 'upd' && S.mode === 'guest') {
      if (!$('#battle').classList.contains('on')) { S.queue.push({ ev: m.ev, st: m.st }); return; }
      deliver(m.ev, m.st);
    }
    else if (m.k === 'act' && S.mode === 'host' && S.G) { applyR(1, m.a); }
    else if (m.k === 'ask' && S.mode === 'guest') { (async () => { let q = 0; if (rOn('guard')) { S.busyR = true; try { q = await mgGuard(S.me, !!(S.view && S.view.p[S.me].debuffs.some(x => x.easyGuard))); } catch (e) {} S.busyR = false; } S.link.send({ k: 'ares', q }); })(); }
    else if (m.k === 'ares' && S.mode === 'host' && S.askRes) { S.askRes(m.q | 0); }
    else if (m.k === 'again') {
      S.friendIn = true;
      if (!$('#select').classList.contains('on')) { enterSelectOnline(); toast('Seu amigo quer ' + (S.rules && S.rules.fmt === 'bo3' && S.series && !S.series.fin && S.series.games ? 'continuar a série!' : 'revanche!')); S.link.send({ k: 'again' }); }
      trySendKeep();
    }
  }
  async function maybeStartOnline() {
    if (S.mode !== 'host' || S.myPick == null || S.opPick == null || S.starting) return;
    const rl = S.rules || DEF_RULES;
    const mt = S.myTeam && S.myTeam.length ? S.myTeam : [S.myPick], ot = S.opTeam || [S.opPick];
    if ((rl.pick === 'mirror' || rl.pick === 'draft') && mt.some(x => ot.includes(x))) { S.link.send({ k: 'clash' }); S.myPick = null; S.opPick = null; S.myTeam = []; S.opTeam = null; S.keepSent = false; openSelect(); toast('Os dois escolheram o mesmo cavaleiro. Escolham de novo!', 3000); return; }
    S.starting = true; S.me = 0;
    const opts = { norage: rl.norage, hp: rl.hp || 0 };
    if (rl.fmt !== 'tower' && (rl.team || 1) > 1) { opts.t0 = mt.slice(1); opts.t1 = ot.slice(1); opts.tr = { swap: rl.swap, assist: rl.assist, syn: rl.syn, last: rl.last }; }
    opts.mod = rl.mod === 'random' ? Mo.rollMod(1) : (rl.mod || null); opts.wx = rl.wx === 'random' ? Mo.rollWx(1) : (rl.wx || null);
    if (rl.epic) { opts.b0 = { life: 100, startCosmo: 30 }; opts.b1 = { life: 100, startCosmo: 30 }; }
    const mm = opts.mod && Mo.modById(opts.mod), ww = opts.wx && Mo.wxById(opts.wx);
    const sy = opts.t0 && rl.syn ? E.synergies(mt).map(x => x.name).join(', ') + ' / ' + E.synergies(ot).map(x => x.name).join(', ') : '';
    const info = [opts.t0 ? 'Equipe: ' + (opts.t0.length === 1 ? 'Dupla' : 'Trio') : '', sy.replace(/^ \/ $/, '').replace(/^ \/ | \/ $/g, ''), rl.fmt === 'bo3' && S.series ? 'Melhor de 3 · luta ' + (S.series.games + 1) : '', rl.epic ? 'Batalha Épica' : '', mm && ('Evento: ' + mm.name), ww && ('Clima: ' + ww.name)].filter(Boolean).join(' · ');
    const G = E.newGame(S.myPick, S.opPick, undefined, opts);
    S.gameNo = (S.gameNo || 0) + 1; S.friendIn = false; S.keepSent = false; if (!S.series) S.series = newSeries(); S.series.chars = [S.myPick, S.opPick]; S.series.teams = [mt, ot];
    S.link.send({ k: 'begin', c0: S.myPick, c1: S.opPick, info, tm0: mt, tm1: ot });
    await vsScreen(S.myPick, S.opPick, info);
    S.G = G; enterBattle(); S.starting = false; pump();
  }
  async function hostRoom() {
    $('#onMsg').textContent = 'Criando sala…'; S.mode = 'host'; S.netRole = 'host'; S.series = newSeries(); S.gameNo = 0; S.race = null;
    writeRules(S.rules || DEF_RULES); $('#onRules').style.display = 'flex';
    S.link = new Net.Link(netHandlers());
    try { await S.link.host(); $('#onMsg').textContent = ''; } catch (e) { netHandlers().error('lib'); }
  }
  async function joinRoom() {
    const c = $('#codeIn').value.trim().toUpperCase();
    if (c.length !== 5) { $('#onMsg').textContent = 'Digite o código de 5 letras que seu amigo recebeu.'; return; }
    $('#onMsg').textContent = 'Conectando…'; S.mode = 'guest'; S.netRole = 'guest'; S.rules = null; S.series = newSeries(); S.gameNo = 0; S.race = null;
    S.link = new Net.Link(netHandlers());
    try { await S.link.join(c); } catch (e) { netHandlers().error('lib'); }
  }

  // ---------- ações (delegação)
  let helpI = 0;
  stage.addEventListener('click', e => {
    const bf = e.target.closest('.bench.me .bf.can'); if (bf) { act({ type: 'swap', i: +bf.dataset.i }); return; }
    const st = e.target.closest('.stopt'); if (st) { modal('mStance', false); act({ type: 'stance', s: +st.dataset.st }); return; }
    const b = e.target.closest('[data-act]');
    if (!b) {
      if (e.target.closest('.hud .plate')) { const side = e.target.closest('.plate').dataset.side; if (side === 'me') openStance(); else openInfo('op'); return; }
      if (e.target.closest('.pd.me .star') && myFree() && S.view) { const P = S.view.p[S.me]; if (!S.view.norage && P.rage >= 100 && !(P.ultUsed && P.senseUsed)) { openUlt(); return; } }
      const el = e.target.closest('.eff,.pd,.hud'); if (el) { Snd.play('sfx_info', .5); openInfo(el.dataset.side || el.closest('[data-side]').dataset.side); }
      return;
    }
    const a = b.dataset.act, scr = (b.closest('.screen') || {}).id, mod = (b.closest('.modal') || {}).id;
    if (a !== 'mute') Snd.play('sfx_button_click', .6);
    switch (a) {
      case 'mute': Snd.toggle(); updOpt(); break;
      case 'sfx': Snd.toggleSfx(); updOpt(); break;
      case 'sigopen': { const I = S.view && E.sigInfo(S.view.p[S.me]); if (!I) break; if (!myFree()) { toast('Só no seu turno.'); break; }
        if (!I.ready) { toast(I.name + ': ' + I.prog + '/' + I.goal + ' ' + I.trig + (I.uses >= 2 ? ' · limite de 2 usos' : '')); break; }
        if (!I.can) { toast(I.name + ' pronto, mas custa ' + I.cost + ' de cosmo.'); break; }
        $('#mSig .sgt').textContent = I.name; $('#mSig .sgd').textContent = I.desc + ' (Custo: ' + I.cost + ' de cosmo)'; modal('mSig'); break; }
      case 'siggo': modal('mSig', false); act({ type: 'sig' }); break;
      case 'opt': updOpt(); modal('mOpt'); break;
      case 'fs': fullscreen(); setTimeout(updOpt, 400); break;
      case 'cpu': S.mode = 'cpu'; fullscreen(true); openSelect(); break;
      case 'santuario': S.mode = 'sant'; fullscreen(true); openSelect(); break;
      case 'chefe': openWeekly(); break;
      case 'preset': writeRules(Object.assign({}, DEF_RULES, PRESETS[b.dataset.p] || {})); $$('#onRules .presets .btn').forEach(x => x.classList.toggle('sel', x === b)); break;
      case 'weeklygo': S.mode = 'weekly'; modal('mTower', false); fullscreen(true); openSelect(); break;
      case 'wxinfo': { const ww = S.view && Mo.wxById(S.view.wx); if (ww) msg(ww.ic + ' ' + ww.name + ': ' + ww.desc); break; }
      case 'ult': if (b.closest('.hud.me') && myFree() && b.classList.contains('ready')) openUlt(); break;
      case 'ultgo': modal('mUlt', false); act({ type: 'ult' }); break;
      case 'sensego': modal('mUlt', false); act({ type: 'sense' }); break;
      case 'torre': S.mode = 'torre'; fullscreen(true); openSelect(); break;
      case 'missoes': openMis(); break;
      case 'towerfight': towerFight(); break;
      case 'towerquit': modal('mTower', false); goMenu(); break;
      case 'blesspick': { const bl = S.run.opts[+b.dataset.i]; if (bl) { (S.run.kind === 'r' ? S.run.relics : S.run.bless).push(bl.id); towerIntro(); } break; }
      case 'modinfo': { const mm = S.view && Mo.modById(S.view.mod); if (mm) msg(mm.ic + ' ' + mm.name + ': ' + mm.desc); break; }
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
      case 'teamN': openTeamOpts(); break;
      case 'teamok': modal('mTeam', false); renderSelect(); break;
      case 'end': act({ type: 'end' }); break;
      case 'quit': updOpt(); modal('mQuit'); break;
      case 'yes': goMenu(); break;
      case 'no': modal('mQuit', false); break;
      case 'use': if (Date.now() - zoomAt < 400) break; modal('mZoom', false); if (!zoomRO && zoomUid != null) { const el = $(`.card[data-uid="${zoomUid}"]`); if (el) el.style.opacity = '.3'; act({ type: 'play', uid: zoomUid }); } break;
      case 'trapcard': armBtn('zTrap', b.textContent, () => { modal('mZoom', false); if (zoomUid != null) act({ type: 'trap', uid: zoomUid }); }); break;
      case 'discardcard': armBtn('zDisc', b.textContent, () => { modal('mZoom', false); if (zoomUid != null) act({ type: 'discard', uid: zoomUid }); }); break;
      case 'close': modal(mod, false); break;
      case 'ok': modal('mMsg', false); if (msg.cb) { const cb = msg.cb; msg.cb = null; cb(); } break;
      case 'again':
        modal('mEnd', false);
        if (S.mode === 'sant') { const won = S.view && S.view.winner === S.me; if (won) openSant(Math.min(santProgress(), HOUSES.length - 1)); else santFight(S.santCur); break; }
        if (S.race && S.race.done) { S.mode = S.netRole; S.race = null; if (S.link) { S.friendIn = false; enterSelectOnline(); S.link.send({ k: 'again' }); } else goMenu(); break; }
        if (S.mode === 'weekly') { openSelect(); break; }
        if (S.mode === 'torre') { if (S.run && S.run.redo) { S.run.redo = false; towerIntro(); } else openSelect(); break; }
        if (S.mode === 'cpu') { openSelect(); break; }
        if (S.link) {
          const sr = S.series; if (sr && sr.fin) { S.series = newSeries(); S.gameNo = 0; }
          enterSelectOnline(); S.link.send({ k: 'again' }); trySendKeep();
        } else goMenu();
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
