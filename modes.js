/* CosmoCards — dados dos modos novos: eventos de batalha, Torre, missões diárias e conquistas */
window.Modes = (function () {
  // ---------- eventos aleatórios de batalha (a regra é aplicada em engine.js)
  const MODS = [
    { id: 'dobro', name: 'Cosmo em Dobro', ic: '✦', desc: 'Todo cosmo gerado por turno é dobrado.' },
    { id: 'critico', name: 'Golpes Críticos', ic: '⚡', desc: 'Todo ataque tem 20% de chance de causar +50% de dano.' },
    { id: 'regen', name: 'Bênção de Atena', ic: '✚', desc: 'No início do turno, quem joga recupera 8 de vida.' },
    { id: 'fragil', name: 'Batalha Mortal', ic: '☠', desc: 'Os dois começam a luta com 60% da vida.' },
    { id: 'compra', name: 'Mão Cheia', ic: '🂠', desc: 'Todos sacam 1 carta a mais por turno.' },
    { id: 'furia', name: 'Fúria do Cosmo', ic: '🔥', desc: 'Os dois ganham +10 de Força.' },
    { id: 'reserva', name: 'Cosmo Aceso', ic: '☄', desc: 'Os dois começam a luta com +60 de cosmo.' },
  ];
  const modById = id => MODS.find(m => m.id === id) || null;
  const rollMod = (chance) => Math.random() < chance ? MODS[Math.floor(Math.random() * MODS.length)].id : null;

  // ---------- clima do Santuário (regra de ambiente aplicada em engine.js)
  const WX = [
    { id: 'estrelas', name: 'Chuva de Estrelas', ic: '🌠', desc: 'No início do turno, quem joga ganha +8 de cosmo.' },
    { id: 'tempestade', name: 'Tempestade', ic: '⛈', desc: 'A cada 3 rodadas, um raio causa 15 de dano nos dois.' },
    { id: 'eclipse', name: 'Eclipse', ic: '🌑', desc: 'Golpes especiais custam 25 de cosmo a menos.' },
    { id: 'vento', name: 'Vento Cortante', ic: '🌪', desc: 'Todo ataque causa +4 de dano.' },
  ];
  const wxById = id => WX.find(w => w.id === id) || null;
  const rollWx = chance => Math.random() < chance ? WX[Math.floor(Math.random() * WX.length)].id : null;

  // ---------- relíquias da Torre (passivos especiais; ganhas a cada 3 andares)
  const RELICS = [
    { id: 'espinhos', name: 'Manto de Espinhos', ic: '🌹', desc: 'Devolve 25% do dano que você recebe.' },
    { id: 'egide', name: 'Égide Curativa', ic: '🏛', desc: 'Toda carta de defesa também cura 12 de vida.' },
    { id: 'eterno', name: 'Cosmo Eterno', ic: '♾', desc: 'Golpes especiais custam 20 de cosmo a menos.' },
    { id: 'ultima', name: 'Última Chance', ic: '⏳', desc: 'Uma vez por luta, sobrevive a um golpe mortal com 1 de vida.' },
    { id: 'ferro', name: 'Pele de Ferro', ic: '⛓', desc: 'Todo dano que você recebe é reduzido em 3.' },
    { id: 'chama', name: 'Chama Interior', ic: '🔥', desc: 'A barra de Fúria enche duas vezes mais rápido.' },
    { id: 'combo', name: 'Mestre dos Combos', ic: '🥋', desc: 'O bônus de combo é dobrado.' },
  ];
  const relicById = id => RELICS.find(r => r.id === id);
  function pickRelics(taken) {
    const pool = RELICS.filter(r => !(taken || []).includes(r.id)), out = [];
    while (out.length < 3 && pool.length) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    return out;
  }

  // ---------- Duelo de Chefes semanal (mesmo chefe, regra e clima para todo mundo na semana)
  const WBOSS = [6, 7, 8, 9, 11, 12, 13, 15, 16, 5, 20];
  function weekly() {
    const idx = Math.floor((Date.now() / 86400000 + 3) / 7);
    return { key: 'W' + idx, boss: WBOSS[idx % WBOSS.length], mod: MODS[idx % MODS.length].id, wx: WX[(idx >> 1) % WX.length].id,
      scale: { life: 130, att: 8, def: 6, cosmoRate: 0.3 }, reward: 10 };
  }

  // ---------- bênçãos da Torre (o jogador escolhe 1 de 3 depois de cada vitória)
  const BLESS = [
    { id: 'vida', name: 'Coração de Bronze', ic: '❤', desc: '+40 de vida máxima.', b: { life: 40 }, max: 99 },
    { id: 'forca', name: 'Punho Ardente', ic: '✊', desc: '+6 de Força.', b: { att: 6 }, max: 99 },
    { id: 'defesa', name: 'Escudo Resoluto', ic: '🛡', desc: '+6 de Defesa.', b: { def: 6 }, max: 99 },
    { id: 'ouro', name: 'Armadura Dourada', ic: '✧', desc: '+25 de vida e +4 de Defesa.', b: { life: 25, def: 4 }, max: 99 },
    { id: 'cosmo', name: 'Cosmo Crescente', ic: '☄', desc: 'Gera 25% mais cosmo por turno.', b: { cosmoRate: 0.25 }, max: 4 },
    { id: 'reserva', name: 'Reserva de Cosmo', ic: '✦', desc: 'Começa cada luta com +40 de cosmo.', b: { startCosmo: 40 }, max: 3 },
    { id: 'mao', name: 'Mão Cheia', ic: '🂠', desc: 'Saca 1 carta a mais por turno.', b: { draw: 1 }, max: 2, rare: true },
    { id: 'vamp', name: 'Sede de Batalha', ic: '🩸', desc: 'Recupera 15% do dano causado em vida.', b: { vamp: 0.15 }, max: 3, rare: true },
    { id: 'crit', name: 'Olho do Falcão', ic: '🎯', desc: '+12% de chance de golpe crítico (+50% de dano).', b: { crit: 0.12 }, max: 4, rare: true },
  ];
  const blessById = id => BLESS.find(b => b.id === id);
  function pickBless(taken) {
    const cnt = {}; (taken || []).forEach(id => cnt[id] = (cnt[id] || 0) + 1);
    const pool = BLESS.filter(b => (cnt[b.id] || 0) < b.max);
    const out = [];
    while (out.length < 3 && pool.length) {
      // raras pesam menos
      const w = pool.map(b => b.rare ? 0.55 : 1), tot = w.reduce((a, c) => a + c, 0);
      let r = Math.random() * tot, i = 0; while (i < pool.length - 1 && (r -= w[i]) > 0) i++;
      out.push(pool.splice(i, 1)[0]);
    }
    return out;
  }
  const sumBless = (ids, extra) => {
    const b = { life: 0, att: 0, def: 0, startCosmo: 0, cosmoRate: 0, draw: 0, vamp: 0, crit: 0 };
    (ids || []).forEach(id => { const x = blessById(id); if (x) for (const k in x.b) b[k] += x.b[k]; });
    if (extra) for (const k in extra) b[k] = (b[k] || 0) + extra[k];
    return b;
  };
  // inimigo da Torre: fica mais forte a cada andar
  const enemyScale = f => ({ life: Math.round(14 * (f - 1)), att: Math.floor((f - 1) * 1.6), def: Math.floor((f - 1) * 1.2), cosmoRate: Math.min(0.6, 0.04 * (f - 1)) });
  const isBossFloor = f => f % 5 === 0;
  const towerMod = f => f <= 1 ? null : rollMod(f % 5 === 0 ? 0.9 : 0.65);

  // ---------- patentes (estrelas ganhas em missões e conquistas)
  const RANKS = [
    [0, 'Aprendiz'], [8, 'Cavaleiro de Bronze'], [22, 'Cavaleiro de Prata'], [45, 'Cavaleiro de Ouro'],
    [80, 'Cavaleiro Divino'], [130, 'Lenda do Santuário'], [200, 'Escolhido de Atena'],
  ];
  function rankOf(stars) {
    let i = 0; for (let k = 0; k < RANKS.length; k++) if (stars >= RANKS[k][0]) i = k;
    const next = RANKS[i + 1];
    return { lv: i, name: RANKS[i][1], from: RANKS[i][0], next: next ? next[0] : null, nextName: next ? next[1] : null };
  }
  // cada patente dá vida extra no início de toda Torre
  const rankBonus = stars => ({ life: rankOf(stars).lv * 6 });

  // ---------- missões diárias
  const BASE5 = [['seiya', 'Seiya'], ['shiryu', 'Shiryu'], ['shun', 'Shun'], ['hyoga', 'Hyoga'], ['ikki', 'Ikki']];
  const MISSIONS = [
    { id: 'win2', txt: 'Vença 2 batalhas', ev: 'win', goal: 2, stars: 2 },
    { id: 'win3', txt: 'Vença 3 batalhas', ev: 'win', goal: 3, stars: 3 },
    { id: 'spec3', txt: 'Use 3 golpes especiais', ev: 'special', goal: 3, stars: 2 },
    { id: 'dmg300', txt: 'Cause 300 de dano', ev: 'dmg', goal: 300, stars: 2 },
    { id: 'cards15', txt: 'Jogue 15 cartas', ev: 'cards', goal: 15, stars: 1 },
    { id: 'event1', txt: 'Vença uma batalha com evento ativo', ev: 'winMod', goal: 1, stars: 2 },
    { id: 'floor3', txt: 'Suba 3 andares da Torre', ev: 'floor', goal: 3, stars: 3 },
    { id: 'combo3', txt: 'Faça 3 combos', ev: 'combo', goal: 3, stars: 2 },
    { id: 'ult1', txt: 'Use o Cosmo Final', ev: 'ult', goal: 1, stars: 2 },
    { id: 'stance4', txt: 'Troque de postura 4 vezes', ev: 'stance', goal: 4, stars: 1 },
    { id: 'crit3', txt: 'Acerte 3 golpes críticos', ev: 'crit', goal: 3, stars: 2 },
    { id: 'winchar', txt: 'Vença usando {c}', ev: 'winChar', goal: 1, stars: 3, pickChar: true },
  ];
  const todayKey = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  function seeded(seed) { let h = 2166136261; for (const c of seed) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; }; }
  function rollDaily(day) {
    const rnd = seeded('cc' + day), pool = MISSIONS.slice(), out = [];
    while (out.length < 3) {
      const m = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
      if (out.some(o => o.ev === m.ev)) continue;
      const q = { id: m.id, prog: 0, done: false };
      if (m.pickChar) { const c = BASE5[Math.floor(rnd() * BASE5.length)]; q.key = c[0]; q.cn = c[1]; }
      out.push(q);
    }
    return { day, list: out };
  }
  const missionDef = id => MISSIONS.find(m => m.id === id);
  const missionText = q => { const d = missionDef(q.id); return d.txt.replace('{c}', q.cn || ''); };

  // ---------- conquistas permanentes
  const ACH = [
    { id: 'w1', name: 'Primeira Vitória', desc: 'Vença uma batalha.', stars: 1, chk: s => s.wins >= 1 },
    { id: 'w10', name: 'Cavaleiro Esforçado', desc: 'Vença 10 batalhas.', stars: 2, chk: s => s.wins >= 10 },
    { id: 'w50', name: 'Veterano do Santuário', desc: 'Vença 50 batalhas.', stars: 5, chk: s => s.wins >= 50 },
    { id: 'sp20', name: 'Golpe Final', desc: 'Use 20 golpes especiais.', stars: 2, chk: s => s.specials >= 20 },
    { id: 'cr25', name: 'Mira Perfeita', desc: 'Acerte 25 golpes críticos.', stars: 3, chk: s => s.crits >= 25 },
    { id: 'dm2k', name: 'Fúria dos Deuses', desc: 'Cause 2000 de dano no total.', stars: 3, chk: s => s.dmg >= 2000 },
    { id: 't5', name: 'Escalada', desc: 'Chegue ao andar 5 da Torre.', stars: 2, chk: s => s.torreBest >= 5 },
    { id: 't10', name: 'Topo em Vista', desc: 'Chegue ao andar 10 da Torre.', stars: 4, chk: s => s.torreBest >= 10 },
    { id: 't20', name: 'Lenda da Torre', desc: 'Chegue ao andar 20 da Torre.', stars: 8, chk: s => s.torreBest >= 20 },
    { id: 'mods', name: 'Mestre das Regras', desc: 'Vença sob 5 eventos diferentes.', stars: 4, chk: s => Object.keys(s.modsWon || {}).length >= 5 },
    { id: 'five', name: 'Os Cinco Heróis', desc: 'Vença com Seiya, Shiryu, Shun, Hyoga e Ikki.', stars: 4, chk: s => BASE5.every(c => (s.winChars || {})[c[0]]) },
    { id: 'cb10', name: 'Sequência Perfeita', desc: 'Faça 10 combos.', stars: 3, chk: s => s.combos >= 10 },
    { id: 'ult5', name: 'Cosmo no Limite', desc: 'Use o Cosmo Final 5 vezes.', stars: 3, chk: s => s.ults >= 5 },
    { id: 'wk1', name: 'Caçador de Chefes', desc: 'Derrote o chefe da semana.', stars: 5, chk: s => s.weeklyWins >= 1 },
    { id: 'sant', name: 'Atena Está Salva', desc: 'Atravesse as 12 casas do Santuário.', stars: 6, chk: s => s.santuario >= 12 },
  ];

  return { WX, wxById, rollWx, RELICS, relicById, pickRelics, weekly, MODS, modById, rollMod, BLESS, blessById, pickBless, sumBless, enemyScale, isBossFloor, towerMod,
    RANKS, rankOf, rankBonus, MISSIONS, BASE5, todayKey, rollDaily, missionDef, missionText, ACH };
})();
