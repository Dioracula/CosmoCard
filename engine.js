/* CosmoCards — motor do jogo (regras reconstruídas do Assembly-CSharp original) */
(function () {
  const D = window.GAMEDATA;
  const OFFENSIVE = new Set(['ContinuousAttack', 'OpressiveAttack', 'IntensePunch', 'IntenseKick', 'CosmicPunch',
    'CosmicKick', 'DefensiveAttack', 'AgonizingAttack', 'DrillAttack', 'BleedingAttack', 'QuickAttack',
    'DespairAttacks', 'SensesDestruction', 'DoubleStrike', 'Charge', 'GuardBreak', 'Opportune', 'Sacrifice', 'CosmoBurst']);
  const ID = { SEIYA: 0, SHIRYU: 1, SHUN: 2, HYOGA: 3, IKKI: 4, MU: 5, ALDEBARAN: 6, DEATHMASK: 7, CAMUS: 8,
    AIORIA: 9, SHAKA: 11, MIRO: 12, SHURA: 13, AFRODITE: 15, SAGA: 16, SEIYASAG: 18, AIOROS: 19, MESTRE: 20, SEIYACAP: 21 };
  const meteorHits = id => id === ID.SEIYACAP ? 6 : (id === ID.SEIYA || id === ID.SEIYASAG) ? 5 : 0;
  const MAX_HAND = 10, FIRST_DRAW = 5, DRAWS_PER_TURN = 2, SPECIAL_INTERVAL = 7;

  const isBoss = p => p.charId === ID.MESTRE && !!p.boss;
  const clone = o => JSON.parse(JSON.stringify(o));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rint = (a, b) => a + Math.floor(Math.random() * (b - a + 1)); // inclusive
  const charById = {}; D.chars.forEach(c => { charById[c.id] = c; });

  // cartas que podem sair no baralho
  const ALL = [], OFF = [], DEF = [];
  D.cards.forEach((c, i) => {
    c.idx = i;
    c.offensive = OFFENSIVE.has(c.cardAction);
    if (c.cardRarity < 1) return;
    ALL.push(i); (c.cardType === 0 ? OFF : DEF).push(i);
  });
  const SEVENTH = D.cards.findIndex(c => c.cardAction === 'SeventhSense');

  // pequenos ajustes onde o dado original contradiz o texto da carta
  D.chars.forEach(c => {
    const s = c.special;
    if (c.id === ID.SEIYA) { s.statsDamage.life = -10; }
    if (c.id === ID.SEIYACAP) { s.statsDamage.life = -8; s.description = 'Causa +8 de dano 6 vezes'; }
    if (c.id === ID.SEIYASAG) { s.statsDamage.life = -20; s.description = 'Causa 5 golpes de +20 de dano. Ganha Benção de Atena.'; }
    if (c.id === ID.AIOROS) { s.debuff.debuffName = 'Benção de Atena'; }
    if (c.id === ID.HYOGA) { s.debuff.drawCardBuff = -1; s.debuff.isPassivePersistentDebuff = 0; }
    if (c.id === ID.CAMUS && !s.debuff.drawCardBuff) { s.debuff.drawCardBuff = -2; }
    if (c.id === ID.SHUN) { s.description = 'Ataque +20 usando a Defesa no lugar da Força. +5 de Defesa permanente.'; }
    s.cardType = (c.id === ID.MU || c.id === ID.ALDEBARAN) ? 1 : 0;
    s.offensive = !(c.id === ID.MU || c.id === ID.ALDEBARAN);
    s.special = true;
  });
  const DESC_FIX = { 'Elevar o Cosmo': 'Ganha +30 de cosmo.', 'Sangramento': 'Causa 5 de dano.\nEfeito: por dois turnos o cavaleiro afetado sofre 15 de dano no final do turno dele.' };

  function cardOf(p, ref) { return ref === 'S' ? charById[p.charId].special : D.cards[ref]; }
  function cardDesc(card) { return DESC_FIX[card.tittle] || card.description; }

  let UID = 1;
  function newPlayer(charId, idx) {
    const c = charById[charId];
    return {
      idx, charId, stats: clone(c.stats), stance: 0, stanceChanged: false, hand: [], debuffs: [], invalid: [],
      specialProb: c.specialProb, specialInterval: SPECIAL_INTERVAL, specialCounter: SPECIAL_INTERVAL,
      camusApplied: false, cosmoMult: 1,
    };
  }

  // bônus de Torre / escala de inimigo / eventos de batalha
  function applyBonus(p, b) {
    if (!b) return;
    const st = p.stats;
    if (b.life) { st.maxLife += b.life; st.life += b.life; }
    if (b.att) st.attPower += b.att;
    if (b.def) st.defPower += b.def;
    if (b.startCosmo) st.cosmo = Math.min(st.maxCosmo, st.cosmo + b.startCosmo);
    if (b.cosmoRate) p.cosmoMult *= 1 + b.cosmoRate;
    if (b.draw) p.extraDraw = (p.extraDraw || 0) + b.draw;
    if (b.vamp) p.vamp = (p.vamp || 0) + b.vamp;
    if (b.crit) p.crit = (p.crit || 0) + b.crit;
    if (b.relics) p.relics = (p.relics || []).concat(b.relics);
  }
  // ---- equipes: sinergias e reservas
  const BRONZE = [0, 1, 2, 3, 4, 21], GOLD = [5, 6, 7, 8, 9, 11, 12, 13, 15, 16, 18, 19];
  const SWAP_COST = 10, TRAP_COST = 10, DISCARD_COSMO = 15, ASSIST = 6;
  function synergies(ids) {
    const out = [];
    if (ids.length < 2) return out;
    const allB = ids.every(i => BRONZE.includes(i)), allG = ids.every(i => GOLD.includes(i));
    if (allB) out.push({ name: 'Amizade dos Bronzeiros', desc: '+15 Vida e +5 Defesa para todos', b: { life: 15, def: 5 } });
    else if (allG) out.push({ name: 'Armadura de Ouro', desc: '+5 Força e +5 Defesa para todos', b: { att: 5, def: 5 } });
    else if (ids.some(i => BRONZE.includes(i)) && ids.some(i => GOLD.includes(i))) out.push({ name: 'Aliança do Santuário', desc: '+10 Vida e +3 Força para todos', b: { life: 10, att: 3 } });
    const has = i => ids.includes(i);
    if (has(4) && has(2)) out.push({ name: 'Irmãos de Sangue', desc: 'Ikki e Shun: ao entrar em campo, recuperam 12 de vida', swapHeal: 12 });
    if (has(8) && has(3)) out.push({ name: 'Mestre e Discípulo', desc: 'Camus e Hyoga: +4 Força para todos', b: { att: 4 } });
    if ((has(0) || has(21)) && has(1) && has(3)) out.push({ name: 'Os Três Heróis', desc: 'Seiya, Shiryu e Hyoga: +3 Força, +3 Defesa e +10 Vida', b: { att: 3, def: 3, life: 10 } });
    return out;
  }
  const REC = ['charId', 'stats', 'stance', 'stanceChanged', 'debuffs', 'invalid', 'specialProb', 'specialInterval', 'specialCounter', 'camusApplied', 'cosmoMult'];
  function takeRec(p) { const r = {}; REC.forEach(k => { r[k] = p[k]; }); return r; }
  function putRec(p, r) { REC.forEach(k => { p[k] = r[k]; }); }
  function buildTeam(G, p, ids, syn) {
    const mk = id => { const q = newPlayer(id, p.idx); syn.forEach(sy => { if (sy.b) applyBonus(q, sy.b); }); return q; };
    const lead = mk(ids[0]); putRec(p, takeRec(lead));
    p.bench = ids.slice(1).map(id => takeRec(mk(id)));
    p.teamIds = ids.slice();
    p.swapHeal = syn.reduce((a, sy) => a + (sy.swapHeal || 0), 0);
    G.syn[p.idx] = syn.map(sy => sy.name);
  }
  function newGame(c0, c1, first, opts) {
    opts = opts || {};
    const G = { p: [newPlayer(c0, 0), newPlayer(c1, 1)], turn: first == null ? rint(0, 1) : first, totalTurn: 1,
      over: false, winner: null, ev: [], seq: 0, mod: opts.mod || null, norage: !!opts.norage, syn: [[], []],
      tr: Object.assign({ swap: 'free', assist: true, syn: true, last: false }, opts.tr || {}) };
    G.wx = opts.wx || null;
    [opts.t0, opts.t1].forEach((t, i) => { if (t && t.length) buildTeam(G, G.p[i], [i ? c1 : c0].concat(t), G.tr.syn ? synergies([i ? c1 : c0].concat(t)) : []); });
    if (opts.hp >= 50) G.p.forEach(p => { [p.stats].concat((p.bench || []).map(b => b.stats)).forEach(st => { st.maxLife = st.life = Math.round(opts.hp); }); });   // vida escolhida (de 50 em 50)
    applyBonus(G.p[0], opts.b0); applyBonus(G.p[1], opts.b1);
    if (G.wx === 'eclipse') G.p.forEach(p => { p.specialDisc = 25; });
    if (G.mod === 'fragil') G.p.forEach(p => { p.stats.life = Math.max(1, Math.round(p.stats.maxLife * 0.6)); });
    if (G.mod === 'furia') G.p.forEach(p => { p.stats.attPower += 10; });
    if (G.mod === 'reserva') G.p.forEach(p => { p.stats.cosmo = Math.min(p.stats.maxCosmo, p.stats.cosmo + 60); });
    { const n = Math.max((G.p[0].bench || []).length, (G.p[1].bench || []).length) + 1; G.dmgMult = n >= 3 ? 4 : n === 2 ? 2.8 : 0; }
    emit(G, { t: 'start' });
    G.p.forEach(p => { (G.syn[p.idx] || []).forEach(n => emit(G, { t: 'text', p: p.idx, txt: 'SINERGIA: ' + n, kind: 'good' })); });
    draw(G, G.p[0], FIRST_DRAW, true); draw(G, G.p[1], FIRST_DRAW, true);
    emit(G, { t: 'turn', p: G.turn });
    return G;
  }

  // ------------------------------------------------------------------ helpers
  function hud(G) {
    return G.p.map(p => {
      const s = cur(p);
      return { life: p.stats.life, maxLife: p.stats.maxLife, cosmo: p.stats.cosmo, maxCosmo: p.stats.maxCosmo,
        att: s.attPower, def: s.defPower, stance: p.stance, hand: p.hand.length, rage: Math.round(p.rage || 0), ult: !!p.ultUsed, sense: !!p.senseUsed, senseOn: !!p.senseOn, trap: !!p.trap, sig: sigInfo(p) };
    });
  }
  function emit(G, e) { e.hud = hud(G); e.n = ++G.seq; G.ev.push(e); }
  function other(G, p) { return G.p[1 - p.idx]; }

  // estatísticas atuais = base + buffs (DebuffManager.BuffStats)
  function cur(p) {
    const s = clone(p.stats);
    for (const d of p.debuffs) {
      if (d.isStaticStatsChangerDebuff) { s.attPower += d.debuffStatsChange.attPower; s.defPower += d.debuffStatsChange.defPower; }
      if (d.isDamageConversion) s.attPower += d.conversionDamageTotal || 0;
    }
    for (const d of p.debuffs) if (d.isTemerity) { s.attPower += s.defPower; s.defPower = 0; }
    for (const d of p.debuffs) if (d.staticStatsMultiplier) {
      s.attPower *= d.debuffStatsMultiplierChange.attPower; s.defPower *= d.debuffStatsMultiplierChange.defPower;
    }
    s.attPower = Math.max(0, s.attPower); s.defPower = Math.max(0, s.defPower);
    return s;
  }

  // PlayerManager.UpdateStats
  function updateStats(G, p, s, show) {
    const st = p.stats;
    st.maxLife = Math.max(0, st.maxLife + (s.maxLife || 0));
    st.maxCosmo = Math.max(0, st.maxCosmo + (s.maxCosmo || 0));
    const oldLife = st.life;
    st.life = clamp(st.life + (s.life || 0), 0, st.maxLife);
    if (st.life <= 0 && oldLife > 0) araSave(G, p);
    st.cosmo = clamp(st.cosmo + (s.cosmo || 0), 0, st.maxCosmo);
    st.attPower = Math.max(0, st.attPower + (s.attPower || 0));
    st.defPower = Math.max(0, st.defPower + (s.defPower || 0));
    if (show) {
      const dl = st.life - oldLife;
      if (dl < 0) emit(G, { t: 'dmg', p: p.idx, v: -dl, direct: true });
      else if (dl > 0) emit(G, { t: 'heal', p: p.idx, v: dl });
      statText(G, p, s);
    }
  }
  function statText(G, p, s) {
    const parts = [];
    if (s.cosmo) parts.push([(s.cosmo > 0 ? '+' : '') + Math.round(s.cosmo) + ' Cosmo', s.cosmo > 0]);
    if (s.attPower) parts.push([(s.attPower > 0 ? '+' : '') + Math.round(s.attPower) + ' Força', s.attPower > 0]);
    if (s.defPower) parts.push([(s.defPower > 0 ? '+' : '') + Math.round(s.defPower) + ' Defesa', s.defPower > 0]);
    for (const [txt, good] of parts) emit(G, { t: 'stat', p: p.idx, txt, good });
  }

  function isUsable(G, p, card) {
    if (G.over || G.turn !== p.idx) return false;
    if (isBoss(p) && card.special && !mestreHalf(p)) return false;
    if (tauntBlock(G, p, card)) return false;
    const req = card.statsRequired;
    if (Math.round(p.stats.cosmo) < costOf(p, card)) return false;
    if (p.stats.attPower < req.attPower) return false;
    if (p.stats.defPower < req.defPower) return false;
    return true;
  }
  function costOf(p, card) {
    const mult = hasDebuff(p, d => d.isCosmicInterference) ? 2 : 1;
    let c = Math.abs(card.statsRequired.cosmo) * mult;
    if (card.special) c = Math.max(0, c - (p.specialDisc || 0) - (hasRelic(p, 'eterno') ? 20 : 0));
    return c;
  }
  const hasRelic = (p, id) => !!(p.relics && p.relics.includes(id));
  // combos: ataques seguidos com cartas diferentes no mesmo turno
  const comboStep = p => (p.comboN || 0) + 1;
  const comboVal = (p, n) => 6 * n * (hasRelic(p, 'combo') ? 2 : 1);
  function comboPeek(p, card) { return card.offensive && !card.special && p.lastOff && p.lastOff !== card.tittle ? comboVal(p, comboStep(p)) : 0; }
  function hasDebuff(p, f) { return p.debuffs.some(f); }

  // dano extra das cartas comuns novas
  function extraDmg(G, p, t, card, pre) {
    const a = card.cardAction;
    if (a === 'Charge') return t.stance === 2 ? 10 : 0;
    if (a === 'Opportune') return t.defPrev ? 20 : 0;
    if (a === 'Sacrifice') return Math.max(0, cur(p).attPower - 10);
    if (a === 'CosmoBurst') return Math.min(40, Math.floor(Math.max(0, p.stats.cosmo - (pre ? costOf(p, card) : 0)) / 5));
    return 0;
  }
  const isCommon = h => h.ref !== 'S' && D.cards[h.ref].cardRarity >= 1;
  function worstCard(G, p) {   // a carta que o jogador menos consegue usar
    const c = p.hand.filter(isCommon); if (!c.length) return null;
    const sc = h => { const cd = D.cards[h.ref], cost = costOf(p, cd); return (cost > p.stats.cosmo ? 1000 : 0) + cost - cd.cardRarity * 5; };
    return c.reduce((b, h) => sc(h) > sc(b) ? h : b, c[0]);
  }
  const tauntBlock = (G, p, card) => p.debuffs.some(d => d.isTaunt) && !card.offensive &&
    p.hand.some(h => { const c = cardOf(p, h.ref); return c.offensive && Math.round(p.stats.cosmo) >= costOf(p, c) && p.stats.attPower >= c.statsRequired.attPower; });

  // estimativa de dano mostrada na carta
  function estimate(G, p, card) {
    if (!card.offensive) return null;
    const t = other(G, p), a = cur(p), b = cur(t);
    const dmg = card.statsDamage;
    let base = Math.abs(dmg.life) * (G.dmgMult || 1);
    if (card.desperateAttackBonus) {
      const r = p.stats.life / p.stats.maxLife; if (r < 0.25) base += 40; else if (r < 0.5) base += 20;
    }
    if (card.drillAttack) base += b.defPower / 2;
    if (card.defensiveAttackBonus) base += a.defPower;
    base += extraDmg(G, p, t, card, true);
    if (card.nonMitagetedDamage) return Math.round(t.charId === ID.MESTRE ? Math.max(0, base - 8) : base);
    let d = base + (card.useDefenseAsAttack ? a.defPower : a.attPower);
    d -= p.charId === ID.SHURA ? clamp(b.defPower - 10, 0, 9999) : b.defPower;
    if (p.charId === ID.AIORIA && d > 0) d *= 1.1;
    if (t.charId === ID.SHIRYU && d <= 10) d = 0;
    if (G.wx === 'vento' && d > 0) d += 4;
    d += comboPeek(p, card);
    if (t.charId === ID.MESTRE && d > 0) d = Math.max(0, d - 8);
    let hits = meteorHits(p.charId) && card.special ? meteorHits(p.charId) : (card.hits || 1);
    return Math.max(0, Math.round(d)) * hits;
  }

  // PlayerManager.DealDamage
  // 8º Sentido (Arayashiki): cruza a fronteira da morte mantendo consciência — sobrevive ao primeiro golpe fatal
  function araSave(G, p, pre) {
    if (!p.senseOn || p.araUsed) return;
    p.araUsed = true;
    if (!pre) p.stats.life = 1;
    p.stats.cosmo = clamp(p.stats.cosmo + ARA_COSMO, 0, p.stats.maxCosmo);
    emit(G, { t: 'text', p: p.idx, txt: 'FRONTEIRA DA MORTE: consciência mantida!', kind: 'good' });
  }

  // ------------------------------------------------------------------ Golpe Assinatura
  // Cada cavaleiro tem um golpe próprio que carrega com uma condição (atacar, apanhar, defender ou gastar cosmo).
  const SIG = {
    seiya:    { n: 'Cometa de Pégaso',          t: 'atk',   g: 5, cost: 85, dmg: 70, d: 'Um único soco devastador: 70 de dano + Força.', fx: 'comet', c1: '#7fe4ff', c2: '#ffffff' },
    seiyacap: { alias: 'seiya' },
    seiyasag: { n: 'Flecha de Ouro',            t: 'spent', g: 6, cost: 95, dmg: 85, heal: 10, d: '85 de dano + Força e cura 10 de vida.', fx: 'arrow', c1: '#ffe49a', c2: '#ffffff' },
    shiryu:   { n: 'Cem Dragões de Rozan',      t: 'hit',   g: 5, cost: 75, dmg: 40, heal: 15, d: '40 de dano + Força e cura 15 de vida.', fx: 'dragons', c1: '#5dff9e', c2: '#d8ffe6' },
    shun:     { n: 'Tempestade Nebulosa',       t: 'def',   g: 5, cost: 75, dmg: 50, sDef: 10, fDef: -10, d: '30 de dano, +10 de Defesa sua e -10 de Defesa do oponente (permanente).', fx: 'storm', c1: '#ff9ad8', c2: '#ffe0f4' },
    hyoga:    { n: 'Trovão Aurora',             t: 'def',   g: 5, cost: 80, dmg: 45, noDraw: 1, d: '45 de dano; o oponente não saca carta no próximo turno.', fx: 'aurora', c1: '#9fe8ff', c2: '#ffffff' },
    ikki:     { n: 'Golpe Fantasma Diabólico',  t: 'hit',   g: 5, cost: 80, dmg: 55, fAtt: -10, fCosmo: -20, d: '35 de dano, -10 de Força e -20 de cosmo do oponente.', fx: 'phantom', c1: '#ff7a2a', c2: '#b07cff' },
    mu:       { n: 'Revolução Estelar',         t: 'def',   g: 5, cost: 75, dmg: 40, fDef: -15, d: '40 de dano e -15 de Defesa do oponente (permanente).', fx: 'stars', c1: '#ffe8a0', c2: '#ffffff' },
    aldebaran:{ n: 'Nova do Titã',              t: 'hit',   g: 5, cost: 80, dmg: 75, d: 'Explosão de cosmo: 75 de dano + Força.', fx: 'nova', c1: '#ffcf70', c2: '#fff3c0' },
    saga:     { n: 'Outra Dimensão',            t: 'spent', g: 6, cost: 85, dmg: 55, fCosmo: -40, d: '55 de dano e drena 40 de cosmo do oponente.', fx: 'portal', c1: '#b07cff', c2: '#6a2cff' },
    deathmask:{ n: 'Fogo Fátuo das Almas',      t: 'atk',   g: 5, cost: 80, dot: [12, 4], dmg: 20, d: '20 de dano + 12 de dano por 4 turnos.', fx: 'souls', c1: '#9a7cff', c2: '#e0d0ff' },
    shaka:    { n: 'Tesouro do Céu',            t: 'def',   g: 5, cost: 85, dmg: 55, fAtt: -10, fDef: -10, d: '55 de dano, -10 de Força e Defesa do oponente.', fx: 'lotus', c1: '#ffe9a0', c2: '#ffffff' },
    miro:     { n: 'Restrição Escarlate',       t: 'atk',   g: 5, cost: 80, dmg: 50, dot: [10, 3], d: '30 de dano + 10 de dano por 3 turnos.', fx: 'needles', c1: '#ff3a4a', c2: '#ffd0d0' },
    aioria:   { n: 'Rugido do Leão',            t: 'spent', g: 6, cost: 80, dmg: 65, sAtt: 5, d: '65 de dano + Força e +5 de Força permanente.', fx: 'lion', c1: '#ffe14a', c2: '#ffffff' },
    shura:    { n: 'Lâmina do Capricórnio',     t: 'atk',   g: 5, cost: 80, dmg: 65, d: 'Corte sagrado: 65 de dano + Força.', fx: 'blade', c1: '#fff2a0', c2: '#ffffff' },
    camus:    { n: 'Caixão de Gelo',            t: 'def',   g: 5, cost: 80, dmg: 40, noDraw: 1, fCosmo: -20, d: '40 de dano, -20 de cosmo e o oponente não saca carta no próximo turno.', fx: 'ice', c1: '#bff6ff', c2: '#ffffff' },
    afrodite: { n: 'Rosa Piranha',              t: 'hit',   g: 5, cost: 75, dmg: 55, dot: [8, 4], d: '35 de dano + 8 de dano por 4 turnos.', fx: 'roses', c1: '#ff4060', c2: '#ffd0e0' },
    aioros:   { n: 'Arco de Sagitário',         t: 'spent', g: 6, cost: 85, dmg: 80, d: 'Flecha celestial: 80 de dano + Força.', fx: 'arrow', c1: '#ffe08a', c2: '#fff3c0' },
  };
  const TRIG_TXT = { atk: 'ataques', hit: 'golpes sofridos', def: 'cartas de defesa', spent: 'cosmo gasto' };
  function sigDef(p) { const k = charById[p.charId].key; let s = SIG[k]; if (s && s.alias) s = SIG[s.alias]; return s || null; }
  function sigSt(p) { p.sigs = p.sigs || {}; return p.sigs[p.charId] || (p.sigs[p.charId] = { prog: 0, uses: 0 }); }
  function sigAdd(p, kind, amt) { const s = sigDef(p); if (!s || s.t !== kind) return; const st = sigSt(p); st.prog = Math.min(s.g, st.prog + amt); }
  function sigReady(p) { const s = sigDef(p); if (!s) return false; const st = sigSt(p); return st.prog >= s.g && st.uses < 2 && p.stats.cosmo >= s.cost; }
  function sigInfo(p) {
    const s = sigDef(p); if (!s) return null; const st = sigSt(p);
    return { name: s.n, desc: s.d, cost: s.cost, goal: s.g, prog: Math.floor(st.prog + 1e-6), uses: st.uses, t: s.t, trig: TRIG_TXT[s.t], ready: st.prog >= s.g && st.uses < 2, can: sigReady(p), fx: s.fx, c1: s.c1, c2: s.c2, key: charById[p.charId].key };
  }
  function signature(G, pi) {
    const p = G.p[pi], t = other(G, p), s = sigDef(p);
    if (G.over || G.turn !== pi || !s || !sigReady(p)) return false;
    const st = sigSt(p); st.prog = 0; st.uses++;
    updateStats(G, p, { cosmo: -s.cost }, false);
    emit(G, { t: 'sig', p: pi, charId: p.charId, title: s.n, fx: s.fx, c1: s.c1, c2: s.c2 });
    if (s.dmg) dealDamage(G, t, p, { life: -s.dmg }, false);
    if (!G.over) {
      if (s.heal) updateStats(G, p, { life: s.heal }, true);
      if (s.sDef || s.sAtt) updateStats(G, p, { defPower: s.sDef || 0, attPower: s.sAtt || 0 }, true);
      if (s.fDef || s.fAtt || s.fCosmo) {
        if (t.senseOn && (s.fDef || s.fAtt)) emit(G, { t: 'text', p: t.idx, txt: 'IMUNE às leis de Hades', kind: 'block' });
        else updateStats(G, t, { defPower: s.fDef || 0, attPower: s.fAtt || 0, cosmo: s.fCosmo || 0 }, true);
      }
      if (s.noDraw || s.dot) {
        if (t.senseOn) emit(G, { t: 'text', p: t.idx, txt: 'IMUNE às leis de Hades', kind: 'block' });
        else {
          if (s.noDraw) t.debuffs.push(mkDebuff({ debuffName: 'Congelado', negativeDebuff: 1, isPassivePersistentDebuff: 1, turnDuration: 1, drawCardBuff: -2, debuffDescription: 'Não saca cartas no próximo turno.' }));
          if (s.dot) { const z = { life: -s.dot[0], maxLife: 0, cosmo: 0, maxCosmo: 0, attPower: 0, defPower: 0, cosmoGainedPerTurn: 0, cosmoMultiplierPerTurn: 0 };
            t.debuffs.push(mkDebuff({ debuffName: s.n, negativeDebuff: 1, isEndTurnDebuff: 1, isStaticStatsChangerDebuff: 1, turnDuration: s.dot[1], debuffStatsChange: z, debuffDescription: s.dot[0] + ' de dano por ' + s.dot[1] + ' turnos.' })); }
          emit(G, { t: 'debuff', p: t.idx, name: s.n, good: false });
        }
      }
    }
    checkOver(G);
    return true;
  }

  // ------------------------------------------------------------------ Reações por toque (Guarda Perfeita, Aparar, Golpe Preciso)
  // guard: 0 nada · 1 bom (-25% dano) · 2 perfeito (-55%, +Fúria) · 3 perfeito + contra-golpe
  // prec: 1 = golpe preciso (+15% de dano)
  function setReact(G, pi, a) {
    const p = G.p[pi], t = G.p[1 - pi];
    p.precQ = a && a.prec ? 1 : 0; t.guardQ = a && a.guard ? Math.max(0, Math.min(3, a.guard | 0)) : 0;
    t.guardQ2 = a && a.guard2 ? Math.max(0, Math.min(3, a.guard2 | 0)) : 0; t.guardQ1 = 0;
    G.reactMsg = { prec: false, guard: false }; G.reactPrev = 0;
  }
  function clearReact(G, pi) {
    const p = G.p[pi], t = G.p[1 - pi];
    if ((t.guardQ === 3 || t.guardQ1 === 3) && !G.over && p.stats.life > 0) {
      emit(G, { t: 'text', p: t.idx, txt: 'CONTRA-GOLPE!', kind: 'good', combo: true });
      // contra-golpe: dano fixo (sem Força/Defesa), proporcional ao que foi bloqueado, no máximo 12
      updateStats(G, p, { life: -Math.max(2, Math.min(8, Math.round((G.reactPrev || 0) * 0.2))) }, true);
      checkOver(G);
    }
    if (G.pbUsed) { p.debuffs = p.debuffs.filter(x => !x.precBoost); G.pbUsed = false; }
    p.precQ = 0; t.guardQ = 0; t.guardQ1 = 0; t.guardQ2 = 0; G.reactMsg = null; G.reactPrev = 0;
  }
  const RAGE_RATE = 0.5;   // velocidade de carga da Fúria (1 = antigo)
  function dealDamage(G, target, attacker, dmg, useDef) {
    const a = cur(attacker), t = cur(target);
    let d = Math.abs(dmg.life) + (useDef ? a.defPower : a.attPower) + (attacker.comboBonus || 0);
    d -= attacker.charId === ID.SHURA ? clamp(t.defPower - 10, 0, 9999) : t.defPower;
    if (attacker.charId === ID.AIORIA && d > 0) d += d * 0.1;
    if (G.wx === 'vento' && d > 0) d += 4;
    if (target.charId === ID.SHIRYU && d <= 10) { if (d > 0) emit(G, { t: 'text', p: target.idx, txt: 'ESCUDO DO DRAGÃO', kind: 'block' }); d = 0; }
    if (target.charId === ID.MESTRE && d > 0) { d = Math.max(0, d - 8); emit(G, { t: 'passive', p: target.idx }); }
    if (d > 0) {
      const cc = (G.mod === 'critico' ? 0.2 : 0) + (attacker.crit || 0);
      if (cc > 0 && Math.random() < cc) { d = Math.round(d * 1.5); emit(G, { t: 'text', p: target.idx, txt: 'CRÍTICO!', kind: 'good', crit: true }); }
    }
    if (d > 0 && attacker !== target && attacker.precQ) {
      const pb = G.pbUsed || attacker.debuffs.some(x => x.precBoost); if (pb) G.pbUsed = true;
      d = Math.round(d * (pb ? 1.3 : 1.15));
      if (G.reactMsg && !G.reactMsg.prec) { G.reactMsg.prec = true; emit(G, { t: 'text', p: target.idx, txt: pb ? 'MIRA AGUÇADA! +30%' : 'GOLPE PRECISO!', kind: 'good', crit: true }); } }
    if (d > 0 && attacker !== target && target.guardQ) {
      const gq = target.guardQ, d0 = d; d = Math.round(d * (gq >= 2 ? 0.45 : 0.75)); G.reactPrev = (G.reactPrev || 0) + (d0 - d);
      if (G.reactMsg && !G.reactMsg.guard) { G.reactMsg.guard = true; emit(G, { t: 'text', p: target.idx, txt: gq >= 2 ? 'GUARDA PERFEITA!' : 'GUARDA!', kind: 'block' });
        if (gq >= 2 && !G.norage) target.rage = Math.min(100, (target.rage || 0) + 6); }
    }
    if (d > 0 && hasRelic(target, 'ferro')) d = Math.max(0, d - 3);
    if (d > 0 && hasRelic(target, 'ultima') && !target.ultimaUsed && target.stats.life - d <= 0) { d = Math.max(0, target.stats.life - 1); target.ultimaUsed = true; emit(G, { t: 'text', p: target.idx, txt: 'ÚLTIMA CHANCE!', kind: 'good' }); }
    if (d > 0 && target.senseOn && !target.araUsed && target.stats.life - d <= 0) { d = Math.max(0, target.stats.life - 1); araSave(G, target, true); }
    if (d > 0) {
      const ar = target.debuffs.find(x => x.armorHits);
      if (ar && attacker !== target && --ar.armorHits <= 0) { target.debuffs = target.debuffs.filter(x => x !== ar); emit(G, { t: 'text', p: target.idx, txt: 'Armadura Reforçada quebrou!', kind: 'fail' }); }
      for (const db of target.debuffs) if (db.isDamageConversion) db.conversionDamageTotal = (db.conversionDamageTotal || 0) + d;
      target.stats.life = clamp(target.stats.life - d, 0, target.stats.maxLife);
      emit(G, { t: 'dmg', p: target.idx, v: d });
    } else {
      emit(G, { t: 'dmg', p: target.idx, v: 0 });
    }
    const side = { cosmo: dmg.cosmo || 0, attPower: dmg.attPower || 0, defPower: dmg.defPower || 0 };
    target.stats.cosmo = clamp(target.stats.cosmo + side.cosmo, 0, target.stats.maxCosmo);
    target.stats.attPower = Math.max(0, target.stats.attPower + side.attPower);
    target.stats.defPower = Math.max(0, target.stats.defPower + side.defPower);
    statText(G, target, side);
    if (d > 0 && !G.over && !G.norage) {
      target.rage = Math.min(100, (target.rage || 0) + d * RAGE_RATE * (hasRelic(target, 'chama') ? 2 : 1));
      if (attacker !== target) attacker.rage = Math.min(100, (attacker.rage || 0) + d * 0.3 * RAGE_RATE * (hasRelic(attacker, 'chama') ? 2 : 1));
    }
    if (d > 0 && attacker !== target && hasRelic(target, 'espinhos')) updateStats(G, attacker, { life: -Math.max(1, Math.round(d * 0.25)) }, true);
    if (d > 0 && attacker.vamp) updateStats(G, attacker, { life: Math.max(1, Math.round(d * attacker.vamp)) }, true);
    if (d > 0) { if (attacker !== target) sigAdd(target, 'hit', 1); tookDamage(G, target, attacker); doneDamage(G, attacker, target); }
    return d > 0;
  }

  // PassiveAbilitiesManager
  function tookDamage(G, p, attacker) {
    if (p.charId === ID.SEIYA || p.charId === ID.SEIYACAP) { updateStats(G, p, { attPower: 2 }, true); emit(G, { t: 'passive', p: p.idx }); }
    if (p.charId === ID.AFRODITE && attacker.stats.life > 0) {
      emit(G, { t: 'passive', p: p.idx });
      updateStats(G, attacker, { life: -5 }, true);
    }
  }
  function doneDamage(G, p, target) {
    if (p.charId === ID.DEATHMASK) { updateStats(G, p, { attPower: 2 }, true); emit(G, { t: 'passive', p: p.idx }); }
    if (p.charId === ID.CAMUS && !p.camusApplied && target.senseOn) { p.camusApplied = true; emit(G, { t: 'text', p: target.idx, txt: 'IMUNE às leis de Hades', kind: 'block' }); }
    if (p.charId === ID.CAMUS && !p.camusApplied) {
      p.camusApplied = true;
      target.debuffs.push(mkDebuff({ debuffName: 'Ar Congelante', negativeDebuff: 1, isPassivePersistentDebuff: 1,
        turnDuration: 1, drawCardBuff: -1, debuffDescription: 'Saca uma carta a menos no próximo turno.' }));
      emit(G, { t: 'passive', p: p.idx });
    }
  }

  function mkDebuff(o) {
    const zero = { life: 0, maxLife: 0, cosmo: 0, maxCosmo: 0, attPower: 0, defPower: 0, cosmoGainedPerTurn: 0, cosmoMultiplierPerTurn: 0 };
    return Object.assign({ uid: UID++, debuffName: '', negativeDebuff: 0, turnDuration: 1, drawCardBuff: 0,
      debuffStatsChange: clone(zero), debuffStatsMultiplierChange: Object.assign(clone(zero), { attPower: 1, defPower: 1 }) }, o);
  }

  // DebuffManager.AddDebuff
  function addDebuff(G, p, card) {
    const d = clone(card.debuff); d.uid = UID++; d.debuffType = card.cardType; d.src = card.tittle;
    if (p.purify && d.negativeDebuff) { emit(G, { t: 'text', p: p.idx, txt: 'PUREZA DE ESPÍRITO: efeito anulado!', kind: 'block' }); return; }
    if (p.senseOn && d.negativeDebuff) { emit(G, { t: 'text', p: p.idx, txt: 'IMUNE às leis de Hades', kind: 'block' }); return; }
    if (!d.debuffName) d.debuffName = card.tittle;
    if (!d.debuffDescription) d.debuffDescription = cardDesc(card);
    if (d.aplicateAntares) {
      const ex = p.debuffs.find(x => x.aplicateAntares);
      if (ex) { ex.antaresAplication += d.antaresAplication; emit(G, { t: 'needles', p: p.idx, v: ex.antaresAplication }); return; }
      emit(G, { t: 'needles', p: p.idx, v: d.antaresAplication });
    }
    if (d.randomDuration) { d.turnDuration = rint(0, d.maxRandomDuration); if (!d.turnDuration) return; }
    if (p.charId === ID.MU) {
      if (d.staticStatsMultiplier && d.debuffStatsMultiplierChange.defPower < 1) d.debuffStatsMultiplierChange.defPower += (1 - d.debuffStatsMultiplierChange.defPower) / 2;
      if (d.debuffStatsChange.defPower < 0) d.debuffStatsChange.defPower /= 2;
    }
    if (d.permanentStatsMultiplier) {
      const m = d.debuffStatsMultiplierChange;
      p.cosmoMult *= m.cosmoGainedPerTurn || 1;
      p.stats.attPower *= m.attPower || 1; p.stats.defPower *= m.defPower || 1;
    }
    p.debuffs.push(d);
    emit(G, { t: 'debuff', p: p.idx, name: d.debuffName, good: !d.negativeDebuff });
    // Saga — Inveja: recebe metade dos buffs do adversário
    const o = other(G, p);
    if (o.charId === ID.SAGA && !d.negativeDebuff && d.isStaticStatsChangerDebuff &&
        (d.debuffStatsChange.attPower > 0 || d.debuffStatsChange.defPower > 0)) {
      const c = clone(d); c.uid = UID++;
      c.debuffStatsChange.attPower = Math.max(0, c.debuffStatsChange.attPower / 2);
      c.debuffStatsChange.defPower = Math.max(0, c.debuffStatsChange.defPower / 2);
      c.debuffName = d.debuffName + ' (Inveja)';
      o.debuffs.push(c); emit(G, { t: 'passive', p: o.idx }); emit(G, { t: 'debuff', p: o.idx, name: c.debuffName, good: true });
    }
  }
  function sagaPermanent(G, p, eff) {
    const o = other(G, p);
    if (o.charId !== ID.SAGA) return;
    const s = { attPower: Math.max(0, (eff.attPower || 0) / 2), defPower: Math.max(0, (eff.defPower || 0) / 2) };
    if (s.attPower || s.defPower) { emit(G, { t: 'passive', p: o.idx }); updateStats(G, o, s, true); }
  }

  function removeOneNegative(G, p) {
    const neg = p.debuffs.filter(d => d.negativeDebuff);
    if (!neg.length) return false;
    const d = neg[rint(0, neg.length - 1)];
    p.debuffs = p.debuffs.filter(x => x !== d);
    emit(G, { t: 'text', p: p.idx, txt: 'Removeu: ' + d.debuffName, kind: 'good' });
    return true;
  }

  // ------------------------------------------------------------------ draw (CardPileManager.DrawCard)
  function drawOne(p) {
    const ch = charById[p.charId];
    let prob = p.specialProb;
    if (p.charId === ID.SHUN && p.stance === 2) prob += 5;
    if (isBoss(p) && !mestreHalf(p)) prob = -1;   // o Mestre só saca o especial depois de perder metade da vida
    if (rint(0, 99) <= prob) return 'S';
    let list = p.stance === 1 ? OFF.slice() : p.stance === 2 ? DEF.slice() : ALL.slice();
    const roll = rint(1, 100);
    let rarity = 1;
    for (let i = 0; i < D.rarities.length; i++) { if (roll <= D.rarities[i]) { rarity = i + 1; break; } }
    if (p.stats.life <= p.stats.maxLife * 0.3 && SEVENTH >= 0) list.push(SEVENTH);
    const cand = list.filter(i => (i === SEVENTH ? 5 : D.cards[i].cardRarity) === rarity);
    if (!cand.length) return ALL[0];
    return cand[rint(0, cand.length - 1)];
  }
  function updateSpecialProb(p, drewSpecial) {
    const init = charById[p.charId].specialProb;
    if (drewSpecial) { p.specialProb = init; p.specialInterval = SPECIAL_INTERVAL; p.specialCounter = SPECIAL_INTERVAL; return; }
    if (p.specialProb <= 1) return;
    p.specialCounter--;
    if (p.specialCounter <= 0) {
      p.specialProb += init;
      if (p.specialInterval > 2) p.specialInterval -= 2;
      p.specialCounter = p.specialInterval;
    }
  }
  function draw(G, p, n, silent) {
    let got = 0;
    for (let i = 0; i < n && p.hand.length < MAX_HAND; i++) {
      const ref = drawOne(p);
      updateSpecialProb(p, ref === 'S');
      p.hand.push({ uid: UID++, ref });
      got++;
    }
    if (got) emit(G, { t: 'draw', p: p.idx, v: got, silent: !!silent });
  }

  // ------------------------------------------------------------------ jogar carta
  function playCard(G, pi, uid) {
    const p = G.p[pi], t = other(G, p);
    if (G.over || G.turn !== pi) return false;
    const hi = p.hand.findIndex(h => h.uid === uid);
    if (hi < 0) return false;
    const card = clone(cardOf(p, p.hand[hi].ref));
    if (!isUsable(G, p, card)) return false;
    p.hand.splice(hi, 1);
    p.comboBonus = 0;
    if (card.offensive && !card.special) {
      if (p.lastOff && p.lastOff !== card.tittle) {
        p.comboN = comboStep(p); p.comboBonus = comboVal(p, p.comboN);
        emit(G, { t: 'text', p: pi, txt: 'COMBO x' + p.comboN + '! +' + p.comboBonus, kind: 'good', combo: true });
      } else p.comboN = 0;
      p.lastOff = card.tittle;
    }
    const cost = costOf(p, card);
    p.stats.cosmo = clamp(p.stats.cosmo - cost, 0, p.stats.maxCosmo);
    emit(G, { t: 'play', p: pi, ref: card.special ? 'S' : card.idx, charId: p.charId, title: card.tittle, special: !!card.special, cost });
    if (card.offensive) p.atkCount = (p.atkCount || 0) + 1; else p.defNow = true;
    sigAdd(p, card.offensive ? 'atk' : 'def', 1); sigAdd(p, 'spent', cost / 25);
    if (card.special) {
      emit(G, { t: 'special', p: pi, charId: p.charId, title: card.tittle });
      if (meteorHits(p.charId)) {
        const keep = card.hasDebuffEffect, N = meteorHits(p.charId);
        for (let i = 0; i < N && !G.over; i++) {
          card.hasDebuffEffect = i === N - 1 ? keep : 0;
          const r = offensive(G, p, t, card, i < N - 1);
          if (r === 'stop') break;
          checkOver(G);
        }
      } else if (card.offensive) offensive(G, p, t, card);
      else defensive(G, p, t, card);
    } else if (card.offensive) offensive(G, p, t, card);
    else defensive(G, p, t, card);
    if (!card.offensive && !card.special && !['CosmoMirror', 'FateSwap', 'TacticalPause', 'StanceShift', 'CosmoBond', 'Taunt', 'SeventhSense', 'LightSpeed'].includes(card.cardAction) &&
        ((card.hasDebuffEffect && card.selfDebuff) || card.statsEffect.life || card.statsEffect.cosmo || card.statsEffect.attPower || card.statsEffect.defPower)) p.lastBuff = clone(card);
    p.comboBonus = 0; G.p[0].purify = G.p[1].purify = false;
    if (!card.offensive && hasRelic(p, 'egide') && !G.over) updateStats(G, p, { life: 12 }, true);
    checkOver(G);
    return true;
  }

  // AttacksManager.UpdateOfensiveCardStatsRoutine
  function offensive(G, p, t, card, skipEffect) {
    { const ez = t.debuffs.find(x => x.easyGuard); if (ez && --ez.easyGuard <= 0) t.debuffs = t.debuffs.filter(x => x !== ez); }
    if (card.selfLife && p.stats.life > 1) updateStats(G, p, { life: -Math.min(card.selfLife, p.stats.life - 1) }, true);
    if (card.guardBreak && t.trap) {
      t.trap = null; emit(G, { t: 'trap', p: t.idx, set: false });
      emit(G, { t: 'text', p: t.idx, txt: 'ARMADILHA DESTRUÍDA!', kind: 'fail' });
    }
    if (t.trap) {
      const tc = t.trap.card; t.trap = null;
      emit(G, { t: 'trap', p: t.idx, set: false });
      emit(G, { t: 'text', p: t.idx, txt: 'ARMADILHA: ' + tc.tittle.toUpperCase() + '!', kind: 'counter' });
      if (tc.cardSpriteName === '34_pureza_de_espirito') t.purify = true;   // Pureza de Espírito: anula o efeito negativo deste ataque
      defensive(G, t, p, tc);
    }
    if (card.isCounterable !== 0) {
      const c = t.debuffs.find(d => d.isCounterAttack);
      if (c) {
        t.debuffs = t.debuffs.filter(d => d !== c);
        emit(G, { t: 'text', p: t.idx, txt: c.isGreatHorn ? 'GRANDE CHIFRE!' : 'CONTRA-ATAQUE!', kind: 'counter', sfx: c.isGreatHorn ? 'sfx_golpe_aldebaran' : 'sfx_contra_ataque' });
        dealDamage(G, p, t, c.debuffStatsChange, false);
        return 'stop';
      }
    }
    const blk = card.guardBreak ? null : t.debuffs.find(d => (d.isDodge && card.isDodgeble !== 0) || d.isBlock);
    if (blk) {
      emit(G, { t: 'text', p: t.idx, txt: blk.isDodge ? 'ESQUIVOU!' : 'BLOQUEOU!', kind: 'block', sfx: blk.isDodge ? 'sfx_esquiva' : 'sfx_defesa_perfeita' });
      if (blk.isDodge) t.debuffs = t.debuffs.filter(d => d !== blk);
      return 'stop';
    }
    if (p.invalid.includes(card.tittle)) {
      emit(G, { t: 'text', p: p.idx, txt: 'FALHOU!', kind: 'fail', sfx: 'sfx_lose_power' });
      return;
    }
    // TriggerOnAttackDebuffs (Código do Cavaleiro)
    for (const d of p.debuffs.slice()) {
      if (d.onUseAttackCardDebuff && d.isInvalidateCard) {
        if (!card.special) p.invalid.push(card.tittle);
        p.debuffs = p.debuffs.filter(x => x !== d);
        emit(G, { t: 'text', p: p.idx, txt: 'Código do Cavaleiro: ' + card.tittle + ' bloqueada!', kind: 'fail' });
      }
    }
    const dmg = clone(card.statsDamage);
    if (G.dmgMult) dmg.life *= G.dmgMult;
    if (card.desperateAttackBonus) {
      const r = p.stats.life / p.stats.maxLife;
      if (r < 0.25) dmg.life -= 40; else if (r < 0.5) dmg.life -= 20;
    }
    if (card.drillAttack) dmg.life -= cur(t).defPower / 2;
    if (card.defensiveAttackBonus) dmg.life -= cur(p).defPower;
    dmg.life -= extraDmg(G, p, t, card, false);
    let ok;
    if (card.nonMitagetedDamage) { if (t.charId === ID.MESTRE && dmg.life < 0) { dmg.life = Math.min(0, dmg.life + 8); emit(G, { t: 'passive', p: t.idx }); }
      updateStats(G, t, dmg, true); ok = true; if (Math.abs(dmg.life) > 0) { tookDamageDirectOnly(G, t, p); } }
    else {
      ok = dealDamage(G, t, p, dmg, !!card.useDefenseAsAttack);
      for (let h = 1; h < (card.hits || 1) && t.stats.life > 0 && !G.over; h++) {   // golpes extras: a guarda é testada de novo
        t.guardQ1 = Math.max(t.guardQ1 || 0, t.guardQ || 0); t.guardQ = t.guardQ2 || 0; if (G.reactMsg) G.reactMsg.guard = false;
        if (ok || true) emit(G, { t: 'text', p: p.idx, txt: 'SEGUNDO GOLPE!', kind: 'good' });
        if (dealDamage(G, t, p, dmg, !!card.useDefenseAsAttack)) ok = true;
      }
    }
    if (ok || !card.debuffRequireDamage) {
      if (card.drawExtraCards && card.onlyDrawIfAttackHits) draw(G, p, card.cardsToDraw);
      if (card.hasDebuffEffect) addDebuff(G, card.selfDebuff ? p : t, card);
    }
    if (!skipEffect) applyEffect(G, p, card);
  }
  function tookDamageDirectOnly(G, t, p) { doneDamage(G, p, t); }

  // AttacksManager.UpdateDefensiveCardStatsRoutine
  function defensive(G, p, t, card) {
    const cancel = p.debuffs.find(d => d.isCancelDefense);
    if (cancel) {
      p.debuffs = p.debuffs.filter(d => d !== cancel);
      emit(G, { t: 'text', p: p.idx, txt: 'ANULADA! (Destruição de Armadura)', kind: 'fail', sfx: 'sfx_destruicao_de_armadura' });
      updateStats(G, p, { defPower: cancel.debuffStatsChange.defPower }, true);
      return;
    }
    switch (card.cardAction) {
      case 'StanceShift': {
        if (isBoss(p)) { emit(G, { t: 'text', p: p.idx, txt: 'Sem efeito no Mestre', kind: 'fail' }); return; }
        let want = p.stance === 1 ? 2 : p.stance === 2 ? 1 : (p.hand.filter(h => h.ref !== 'S' && D.cards[h.ref].cardType === 0).length >= p.hand.length / 2 ? 1 : 2);
        applyStance(G, p, want); return; }
      case 'CosmoMirror': {
        const lb = t.lastBuff;
        if (!lb) { emit(G, { t: 'text', p: p.idx, txt: 'Nada para copiar', kind: 'fail' }); return; }
        emit(G, { t: 'text', p: p.idx, txt: 'COPIOU: ' + lb.tittle, kind: 'good' });
        const c2 = clone(lb); c2.tittle = lb.tittle + ' (Espelho)'; defensive(G, p, t, c2); return; }
      case 'TacticalPause': {
        draw(G, p, 2);
        const w = worstCard(G, p);
        if (w) { p.hand = p.hand.filter(h => h !== w); emit(G, { t: 'text', p: p.idx, txt: 'Descartou: ' + D.cards[w.ref].tittle, kind: 'fail' }); emit(G, { t: 'discard', p: p.idx }); }
        emit(G, { t: 'draw', p: p.idx, v: 0, silent: true }); emit(G, { t: 'draw', p: t.idx, v: 0, silent: true }); return; }
      case 'FateSwap': {
        const theirs = t.hand.filter(isCommon), mine = worstCard(G, p);
        if (!theirs.length) { emit(G, { t: 'text', p: p.idx, txt: 'O oponente não tem cartas comuns', kind: 'fail' }); return; }
        const got = theirs[rint(0, theirs.length - 1)];
        t.hand = t.hand.filter(h => h !== got);
        if (mine) { p.hand = p.hand.filter(h => h !== mine); t.hand.push({ uid: UID++, ref: mine.ref }); }
        p.hand.push({ uid: UID++, ref: got.ref });
        emit(G, { t: 'text', p: p.idx, txt: 'TROCA DE DESTINO!', kind: 'counter' });
        emit(G, { t: 'text', p: p.idx, txt: 'Pegou: ' + D.cards[got.ref].tittle, kind: 'good' });
        emit(G, { t: 'draw', p: p.idx, v: 0, silent: true }); emit(G, { t: 'draw', p: t.idx, v: 0, silent: true }); return; }
      case 'CosmoBond': {
        const n = Math.min(6, p.atkCount || 0);
        if (!n) { emit(G, { t: 'text', p: p.idx, txt: 'Nenhum ataque neste turno', kind: 'fail' }); return; }
        updateStats(G, p, { life: 10 * n }, true); return; }
    }
    if (card.removeRandomDebuff) removeOneNegative(G, p);
    if (card.drawExtraCards) draw(G, p, card.cardsToDraw);
    if (card.hasDebuffEffect) addDebuff(G, card.selfDebuff ? p : t, card);
    if (card.cardAction === 'SeventhSense') p.cosmoMult *= 1.5;
    applyEffect(G, p, card);
  }
  function applyEffect(G, p, card) {
    const e = card.statsEffect;
    if (!(e.life || e.cosmo || e.attPower || e.defPower || e.maxLife || e.maxCosmo)) return;
    sagaPermanent(G, p, e);
    updateStats(G, p, e, true);
  }

  function checkOver(G) {
    if (G.over) return;
    G.p.forEach(p => { if (p.stance === 0) mestreAuto(G, p); });
    G.p.forEach(p => {
      if (p.stats.life > 0 || !p.bench) return;
      const bi = p.bench.findIndex(b => b.stats.life > 0);
      if (bi >= 0) {
        emit(G, { t: 'text', p: p.idx, txt: 'DERROTADO!', kind: 'fail' }); doSwap(G, p, bi, true);
        if (G.tr.last && !p.bench.some(b => b.stats.life > 0)) { updateStats(G, p, { attPower: 8, defPower: 8 }, true); emit(G, { t: 'text', p: p.idx, txt: 'ÚLTIMO CAVALEIRO!', kind: 'good' }); }
      }
    });
    const dead = G.p.filter(p => p.stats.life <= 0);
    if (!dead.length) return;
    G.over = true;
    G.winner = dead.length === 2 ? -1 : 1 - dead[0].idx;
    emit(G, { t: 'over', winner: G.winner });
  }

  // ------------------------------------------------------------------ postura
  // restrições do Mestre valem só quando ele é o chefe do Santuário (controlado pela CPU); jogando com ele é tudo livre
  function mestreHalf(p) { return p.stats.life <= p.stats.maxLife * 0.5; }
  // Mestre do Santuário: neutro até perder metade da vida; depois alterna sozinho entre Ofensiva/Defensiva e nunca volta ao neutro
  function mestreAuto(G, p) {
    if (!isBoss(p) || G.over || p.stats.life <= 0 || !mestreHalf(p)) return;
    const o = other(G, p), r = p.stats.life / p.stats.maxLife;
    let want = p.stance;
    if (r < 0.25) want = 2;
    else if (p.stats.cosmo >= 100 || o.stats.life / o.stats.maxLife < 0.4) want = 1;
    else if (p.stance === 0) want = rint(1, 2);
    else if (Math.random() < 0.35) want = 3 - p.stance;
    if (want === 0) want = 1;
    if (want !== p.stance) applyStance(G, p, want, p.stance === 0 ? { reveal: true } : null);
  }
  function setStance(G, pi, s) {
    const p = G.p[pi];
    if (G.over || G.turn !== pi || p.stanceChanged || p.stance === s) return false;
    if (isBoss(p)) return false;   // postura automática do chefe
    applyStance(G, p, s); p.stanceChanged = true;
    return true;
  }
  function applyStance(G, p, s, extra) {
    const pi = p.idx, c = charById[p.charId];
    if (p.stance === 1) { p.stats.attPower -= c.off.attPower; p.stats.defPower -= c.off.defPower; }
    if (p.stance === 2) { p.stats.attPower -= c.deff.attPower; p.stats.defPower -= c.deff.defPower; }
    p.stance = s;
    if (s === 1) { p.stats.attPower += c.off.attPower; p.stats.defPower += c.off.defPower; }
    if (s === 2) { p.stats.attPower += c.deff.attPower; p.stats.defPower += c.deff.defPower; }
    emit(G, Object.assign({ t: 'stance', p: pi, s }, extra || {}));
  }

  // ------------------------------------------------------------------ passar turno (GameManager.PassTurn)
  function turnDebuffs(G, p, start) {
    const list = p.debuffs.filter(d => start ? d.isStartTurnDebuff : d.isEndTurnDebuff);
    for (const d of list) {
      if (d.aplicateAntares) {
        const lethal = d.antaresAplication >= 15;
        emit(G, { t: 'text', p: p.idx, txt: lethal ? 'ANTARES!' : 'Agulhas Escarlates x' + d.antaresAplication, kind: 'counter', sfx: 'sfx_golpe_milo' });
        updateStats(G, p, { life: lethal ? -p.stats.maxLife : -d.antaresAplication }, true);
      } else if (d.isStaticStatsChangerDebuff) {
        if (d.debuffStatsChange.life) { emit(G, { t: 'text', p: p.idx, txt: d.debuffName, kind: 'fail' }); updateStats(G, p, { life: d.debuffStatsChange.life }, true); }
      } else {
        const ch = d.debuffStatsChange;
        if (ch.life || ch.cosmo || ch.attPower || ch.defPower) { emit(G, { t: 'text', p: p.idx, txt: d.debuffName, kind: d.negativeDebuff ? 'fail' : 'good' }); updateStats(G, p, ch, true); }
      }
      d.turnDuration--;
      if (d.turnDuration === 0) p.debuffs = p.debuffs.filter(x => x !== d);
      checkOver(G); if (G.over) return;
    }
  }
  function updatePassiveDurations(p) {
    for (const d of p.debuffs) if (d.isPassivePersistentDebuff) d.turnDuration--;
    p.debuffs = p.debuffs.filter(d => {
      if (d.isStartTurnDebuff || d.isEndTurnDebuff) return true;
      if (d.isPassivePersistentDebuff) return d.turnDuration > 0;
      return false;
    });
  }

  function endTurn(G, pi) {
    if (G.over || G.turn !== pi) return false;
    const p = G.p[pi];
    if (p.debuffs.some(d => d.isTaunt) && p.hand.some(h => { const c = cardOf(p, h.ref); return c.offensive && isUsable(G, p, c); })) {
      emit(G, { t: 'text', p: pi, txt: 'PROVOCADO! Use um ataque', kind: 'fail' }); return false;
    }
    p.defPrev = !!p.defNow; p.defNow = false;
    turnDebuffs(G, p, false); if (G.over) return true;
    if (p.senseOn && p.sense <= 0) { p.senseOn = false; updateStats(G, p, { attPower: -SENSE_BONUS, defPower: -SENSE_BONUS }, false); emit(G, { t: 'text', p: p.idx, txt: '8º Sentido acabou', kind: 'fail' }); }
    if (p.charId === ID.SHAKA) { if (removeOneNegative(G, p)) emit(G, { t: 'passive', p: p.idx }); }
    const extra = p.debuffs.some(d => d.isGetExtraTurn);
    if (!extra) G.turn = 1 - G.turn; else emit(G, { t: 'text', p: p.idx, txt: 'TURNO EXTRA!', kind: 'good', sfx: 'sfx_velocidade_da_luz2' });
    const n = G.p[G.turn];
    n.lastOff = null; n.comboN = 0; n.atkCount = 0; n.discarded = false; n.swapped = false; n.stanceChanged = false; n.camusApplied = false; G.p[1 - G.turn].camusApplied = false;
    emit(G, { t: 'turn', p: G.turn });
    const round = Math.floor(G.totalTurn / 2);
    if (n.sense > 0) n.sense--;
    if (round > 0) {
      if (n.debuffs.some(d => d.isCancelCosmoGeneration)) emit(G, { t: 'text', p: n.idx, txt: 'Sem geração de cosmo!', kind: 'fail' });
      else {
        const st = n.stats;
        let gain = st.cosmoGainedPerTurn * st.maxCosmo * st.cosmoMultiplierPerTurn * round * n.cosmoMult;
        if (n.charId === ID.HYOGA) gain *= 1.2;
        if (n.debuffs.some(d => d.halfCosmo)) gain *= 0.5;
        if (G.mod === 'dobro') gain *= 2;
        updateStats(G, n, { cosmo: gain }, false);
        emit(G, { t: 'cosmo', p: n.idx, v: gain });
      }
    }
    turnDebuffs(G, n, true); if (G.over) return true;
    mestreAuto(G, n);
    if (n.charId === ID.IKKI && n.stats.life < n.stats.maxLife) { emit(G, { t: 'passive', p: n.idx }); updateStats(G, n, { life: 10 }, true); }
    if (G.wx === 'estrelas') { updateStats(G, n, { cosmo: 8 }, false); emit(G, { t: 'cosmo', p: n.idx, v: 8 }); }
    if (G.wx === 'tempestade' && G.totalTurn > 1 && G.totalTurn % 6 === 0) {
      emit(G, { t: 'weather', wx: 'tempestade' });
      G.p.forEach(q => updateStats(G, q, { life: -15 }, true)); checkOver(G); if (G.over) return true;
    }
    if (G.mod === 'regen' && n.stats.life < n.stats.maxLife) updateStats(G, n, { life: 8 }, true);
    let draws = DRAWS_PER_TURN + (G.mod === 'compra' ? 1 : 0) + (n.extraDraw || 0) + n.debuffs.reduce((a, d) => a + (d.drawCardBuff || 0), 0);
    if (draws < DRAWS_PER_TURN && !(G.mod === 'compra' || n.extraDraw)) emit(G, { t: 'text', p: n.idx, txt: draws <= 0 ? 'Não saca cartas!' : 'Saca ' + draws + ' carta', kind: 'fail' });
    draw(G, n, Math.max(0, draws));
    updatePassiveDurations(G.p[0]); updatePassiveDurations(G.p[1]);
    G.totalTurn++;
    emit(G, { t: 'ready', p: G.turn });
    return true;
  }

  // troca de cavaleiro (equipe): o cosmo é compartilhado
  function doSwap(G, p, bi, forced) {
    p.debuffs = p.debuffs.filter(d => !d.armorHits);
    const out = takeRec(p), inn = p.bench[bi], cosmo = p.stats.cosmo;
    p.bench[bi] = out; putRec(p, inn);
    p.stats.cosmo = clamp(cosmo, 0, p.stats.maxCosmo);
    emit(G, { t: 'swap', p: p.idx, charId: p.charId, forced: !!forced });
    if (p.swapHeal && !forced && p.stats.life < p.stats.maxLife) updateStats(G, p, { life: p.swapHeal }, true);
  }
  const swapCost = G => (G.tr.swap === 'gratis' ? 0 : SWAP_COST);
  function swapTo(G, pi, bi) {
    const p = G.p[pi], t = other(G, p);
    if (G.over || G.turn !== pi || !p.bench || p.swapped || !p.bench[bi] || p.bench[bi].stats.life <= 0 || G.tr.swap === 'fall') return false;
    const sc = swapCost(G);
    if (Math.round(p.stats.cosmo) < sc) return false;
    p.stats.cosmo = clamp(p.stats.cosmo - sc, 0, p.stats.maxCosmo);
    p.swapped = true;
    doSwap(G, p, bi, false);
    if (G.tr.assist) { emit(G, { t: 'text', p: pi, txt: 'ASSISTÊNCIA!', kind: 'good' }); dealDamage(G, t, p, { life: -ASSIST }, false); }
    checkOver(G);
    return true;
  }
  // armadilha: carta de defesa/utilidade (não ataque, custo > 0) virada pelo DOBRO do custo; quando o inimigo ataca, o efeito da carta é ativado como está escrito
  // Armadilha: só estas cartas; custo = custo da carta + 15
  const TRAP_CARDS = ['05_contra_ataque', '06_esquiva', '07_defesa_perfeita', '19_aprendizado_defensivo', '24_sopro_de_athena', '25_destruicao_de_armadura', '34_pureza_de_espirito'];
  const trapOk = (p, card) => !card.special && !card.offensive && costOf(p, card) > 0 && TRAP_CARDS.includes(card.cardSpriteName);
  const trapCost = (p, card) => costOf(p, card) + 15;
  function setTrap(G, pi, uid) {
    const p = G.p[pi];
    if (G.over || G.turn !== pi || p.trap) return false;
    const hi = p.hand.findIndex(h => h.uid === uid); if (hi < 0 || p.hand[hi].ref === 'S') return false;
    const card = clone(cardOf(p, p.hand[hi].ref));
    if (!trapOk(p, card) || Math.round(p.stats.cosmo) < trapCost(p, card)) return false;
    p.hand.splice(hi, 1);
    p.stats.cosmo = clamp(p.stats.cosmo - trapCost(p, card), 0, p.stats.maxCosmo);
    p.trap = { card, title: card.tittle };
    emit(G, { t: 'trap', p: pi, set: true, title: card.tittle });
    return true;
  }
  function discardCard(G, pi, uid) {
    const p = G.p[pi];
    if (G.over || G.turn !== pi || p.discarded) return false;
    const hi = p.hand.findIndex(h => h.uid === uid); if (hi < 0 || p.hand[hi].ref === 'S') return false;
    p.hand.splice(hi, 1); p.discarded = true;
    emit(G, { t: 'discard', p: pi });
    updateStats(G, p, { cosmo: DISCARD_COSMO }, true);
    return true;
  }

  // Cosmo Final: golpe único por luta, liberado quando a barra de fúria enche
  function ultimate(G, pi) {
    const p = G.p[pi], t = other(G, p);
    if (G.over || G.norage || G.turn !== pi || p.ultUsed || (p.rage || 0) < 100) return false;
    p.ultUsed = true; p.rage = 0;
    emit(G, { t: 'ult', p: pi, charId: p.charId });
    // Cosmo Final: equilibrado com o 8º Sentido — dano alto + drena o cosmo do inimigo + cura leve (e +10 de Força permanente)
    dealDamage(G, t, p, { life: -40, cosmo: -25 }, false);
    updateStats(G, p, { life: 15, attPower: 5 }, true);
    checkOver(G);
    return true;
  }

  // 8º Sentido (Arayashiki): 3 turnos mantendo a consciência além da morte — purifica os efeitos negativos,
  // fica imune a novos efeitos negativos (leis de Hades), sobrevive ao 1º golpe fatal (1 de vida) e ganha Força/Defesa.
  const SENSE_BONUS = 8, ARA_COSMO = 25;
  function seventhSense(G, pi) {
    const p = G.p[pi];
    if (G.over || G.norage || G.turn !== pi || p.senseUsed || p.senseOn || (p.rage || 0) < 100) return false;
    p.senseUsed = true; p.senseOn = true; p.sense = 2; p.rage = 0; p.araUsed = false;
    emit(G, { t: 'sense', p: pi, charId: p.charId });
    if (p.debuffs.some(d => d.negativeDebuff)) { p.debuffs = p.debuffs.filter(d => !d.negativeDebuff); emit(G, { t: 'text', p: pi, txt: 'Purificado das maldições', kind: 'good' }); }
    updateStats(G, p, { attPower: SENSE_BONUS, defPower: SENSE_BONUS }, true);
    return true;
  }

  // ------------------------------------------------------------------ IA (CPU)
  function aiStep(G, pi) {
    const p = G.p[pi], t = other(G, p);
    if (G.over || G.turn !== pi) return null;
    if ((p.rage || 0) >= 100) {
      if (!p.senseUsed && !p.senseOn && (p.ultUsed || (t.stats.life > 75 && Math.random() < 0.4))) return { type: 'sense' };
      if (!p.ultUsed) return { type: 'ult' };
    }
    if (sigReady(p) && Math.random() < 0.85) return { type: 'sig' };
    if (!p.stanceChanged && !isBoss(p)) {
      const lifeR = p.stats.life / p.stats.maxLife;
      let want = p.stance;
      if (lifeR < 0.35) want = 2; else if (p.stats.cosmo >= 60 || t.stats.life / t.stats.maxLife < 0.4) want = 1;
      else if (Math.random() < 0.3) want = rint(0, 2);
      if (want !== p.stance) return { type: 'stance', s: want };
    }
    if (p.bench && !p.swapped && G.tr.swap !== 'fall' && p.stats.life < p.stats.maxLife * 0.3 && p.stats.cosmo >= swapCost(G)) {
      let bi = -1, bl = 0; p.bench.forEach((b, i) => { if (b.stats.life > bl && b.stats.life > b.stats.maxLife * 0.4) { bl = b.stats.life; bi = i; } });
      if (bi >= 0) return { type: 'swap', i: bi };
    }
    const normals = p.hand.filter(h => h.ref !== 'S');
    if (!p.discarded && p.stats.cosmo < 25 && p.hand.length >= 5) {
      const bad = normals.find(h => !isUsable(G, p, cardOf(p, h.ref)));
      if (bad) return { type: 'discard', uid: bad.uid };
    }
    if (!p.trap && p.hand.length >= 5 && Math.random() < 0.3) {
      let lo = null, ls = 1e9; normals.forEach(h => { const c = cardOf(p, h.ref); if (!trapOk(p, c) || p.stats.cosmo < trapCost(p, c) + 20) return; const sc = aiScore(G, p, t, c); if (sc < ls) { ls = sc; lo = h; } });
      if (lo) return { type: 'trap', uid: lo.uid };
    }
    let best = null, bestScore = 0;
    for (const h of p.hand) {
      const c = cardOf(p, h.ref);
      if (!isUsable(G, p, c)) continue;
      const s = aiScore(G, p, t, c);
      if (s > bestScore) { bestScore = s; best = h; }
    }
    if (best) return { type: 'play', uid: best.uid };
    if (p.debuffs.some(d => d.isTaunt)) { const f = p.hand.find(h => isUsable(G, p, cardOf(p, h.ref))); if (f) return { type: 'play', uid: f.uid }; }
    return { type: 'end' };
  }
  function aiScore(G, p, t, c) {
    const has = f => p.debuffs.some(f);
    const tHas = f => t.debuffs.some(f);
    if (p.invalid.includes(c.tittle)) return 0;
    if (!c.offensive && has(d => d.isCancelDefense)) return 0;
    const cost = costOf(p, c);
    if (c.special) return 1000;
    if (c.offensive) {
      if (tHas(d => d.isBlock) && !c.guardBreak) return 0;
      if (c.cardAction === 'Sacrifice' && p.stats.life < p.stats.maxLife * 0.45) return 0;
      const est = estimate(G, p, c) || 0;
      if (est >= t.stats.life) return 900;
      let s = est * 2 + 5 - cost * 0.2;
      if (c.hasDebuffEffect) s += 12;
      if (c.guardBreak && (t.trap || tHas(d => d.isDodge))) s += 20;
      else if (tHas(d => d.isCounterAttack || d.isDodge)) s = Math.min(s, 6);
      return s;
    }
    const a = c.cardAction;
    const lifeR = p.stats.life / p.stats.maxLife;
    switch (a) {
      case 'RaiseCosmo': return p.stats.cosmo < 120 ? 40 : 2;
      case 'AthenaWinds': return p.stats.maxLife - p.stats.life >= 50 ? 55 : (lifeR < 0.9 ? 10 : 0);
      case 'CounterAttack': case 'Dodge': case 'PerfectDefense':
        return has(d => d.isCounterAttack || d.isDodge || d.isBlock) ? 0 : (lifeR < 0.6 ? 45 : 22);
      case 'Agility': case 'SpiritPurifier': return p.hand.length < 6 ? 28 : 6;
      case 'StanceShift': return p.stanceChanged ? 6 : (p.stance !== 1 && lifeR > 0.5 ? 18 : 8);
      case 'CosmoMirror': return t.lastBuff ? 35 : 0;
      case 'ReinforcedArmor': return has(d => d.armorHits) ? 0 : (lifeR < 0.7 ? 38 : 26);
      case 'CosmoBreath': return has(d => d.halfCosmo) ? 0 : (p.stats.cosmo < 70 ? 36 : 4);
      case 'Taunt': return tHas(d => d.isTaunt) ? 0 : 16;
      case 'TacticalPause': return p.hand.length <= 6 ? 26 : 4;
      case 'FateSwap': return t.hand.filter(isCommon).length >= 2 ? 22 : 0;
      case 'CosmoBond': return Math.min(p.stats.maxLife - p.stats.life, 10 * (p.atkCount || 0)) >= 20 ? 42 : 0;
      case 'SeventhSense': return 80;
      case 'LightSpeed': return 70;
      default:
        if (c.hasDebuffEffect && c.selfDebuff && has(d => d.src === c.tittle)) return 0;
        if (c.hasDebuffEffect && !c.selfDebuff && tHas(d => d.src === c.tittle)) return 0;
        return 30 - cost * 0.1;
    }
  }

  window.Engine = { signature, sigInfo, sigReady, setReact, clearReact, trapOk, trapCost, swapCost, synergies, swapTo, setTrap, discardCard, SWAP_COST, TRAP_COST, DISCARD_COSMO, newGame, playCard, setStance, endTurn, ultimate, seventhSense, aiStep, isUsable, costOf, estimate, cardOf, cardDesc, cur,
    charById, ID, MAX_HAND, D };
})();
