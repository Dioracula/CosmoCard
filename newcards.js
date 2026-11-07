/* CosmoCards — 14 cartas comuns novas (ofensivas e defensivas/utilidade) */
(function () {
  const D = window.GAMEDATA, base = D.cards[0];
  const mk = o => {
    const c = JSON.parse(JSON.stringify(base));
    c.tittle = o.n; c.description = o.d; c.cardRarity = o.r; c.cardType = o.off ? 0 : 1; c.cardSpriteName = o.s; c.cardAction = o.a;
    c.unlocked = 1; c.isCounterable = o.off ? 1 : 0; c.isDodgeble = o.off ? 1 : 0; c.isNew = 1;
    c.statsRequired.cosmo = -o.c; c.statsDamage.life = -(o.dmg || 0); c.statsEffect.cosmo = o.cosmo || 0;
    c.statsRequired.resistance = c.statsRequired.focus = 0; c.statsRequired.stance = 0;
    c.cardsToDraw = 0; c.drawExtraCards = 0; c.hasDebuffEffect = o.deb ? 1 : 0; c.selfDebuff = o.self ? 1 : 0;
    c.hits = o.hits || 0; c.selfLife = o.sl || 0; c.guardBreak = o.gb ? 1 : 0; c.debuffRequireDamage = 0;
    if (o.deb) Object.assign(c.debuff, { debuffName: o.n, turnDuration: 2, isPassivePersistentDebuff: 1, negativeDebuff: o.neg ? 1 : 0 }, o.deb);
    D.cards.push(c);
  };
  // ofensivas
  mk({ n: 'Golpe Duplo', d: 'Dois ataques de 12 de dano cada.\nA guarda do oponente precisa acertar duas vezes.', r: 2, off: 1, s: '40_golpe_duplo', a: 'DoubleStrike', c: 30, dmg: 12, hits: 2 });
  mk({ n: 'Investida', d: 'Ataque de 25 de dano. Você perde 5 de vida.\nContra postura defensiva: +10 de dano.', r: 2, off: 1, s: '41_investida', a: 'Charge', c: 20, dmg: 25, sl: 5 });
  mk({ n: 'Quebra-Guarda', d: 'Ataque de 15 de dano que ignora Esquiva e Bloqueio e remove a Armadilha do inimigo.', r: 3, off: 1, s: '42_quebra_guarda', a: 'GuardBreak', c: 30, dmg: 15, gb: 1 });
  mk({ n: 'Golpe Oportuno', d: 'Ataque de 10 de dano.\nEfeito: +20 de dano se o inimigo usou uma defesa no turno anterior.', r: 2, off: 1, s: '43_golpe_oportuno', a: 'Opportune', c: 20, dmg: 10 });
  mk({ n: 'Ataque Sacrifício', d: 'Gasta 20 de vida para causar o dobro da Força em dano (mínimo 10 de base).', r: 3, off: 1, s: '44_ataque_sacrificio', a: 'Sacrifice', c: 10, dmg: 10, sl: 20 });
  mk({ n: 'Rajada de Cosmo', d: 'Ataque de 5 de dano +1 a cada 5 de cosmo que sobrar depois de pagar a carta (máx. +40).', r: 3, off: 1, s: '45_rajada_de_cosmo', a: 'CosmoBurst', c: 20, dmg: 5 });
  // defensivas e utilidade
  mk({ n: 'Postura de Combate', d: 'Troca de postura (Ofensiva/Defensiva) sem gastar a ação de postura do turno.', r: 2, s: '46_postura_de_combate', a: 'StanceShift', c: 10 });
  mk({ n: 'Espelho de Cosmo', d: 'Copia o último efeito de buff que o oponente usou.', r: 3, s: '47_espelho_de_cosmo', a: 'CosmoMirror', c: 30 });
  mk({ n: 'Armadura Reforçada', d: '+15 de Defesa até você sofrer 3 golpes.', r: 2, s: '48_armadura_reforcada', a: 'ReinforcedArmor', c: 25, deb: { isStaticStatsChangerDebuff: 1, turnDuration: 99, armorHits: 3, debuffDescription: '+15 de Defesa até sofrer 3 golpes.', debuffStatsChange: { life: 0, maxLife: 0, cosmo: 0, maxCosmo: 0, attPower: 0, defPower: 15, cosmoGainedPerTurn: 0, cosmoMultiplierPerTurn: 0 } }, self: 1 });
  mk({ n: 'Respiração do Cosmo', d: 'Ganha +30 de cosmo agora, mas no próximo turno você gera metade do cosmo.', r: 1, s: '49_respiracao_do_cosmo', a: 'CosmoBreath', c: 0, cosmo: 30, deb: { halfCosmo: 1, debuffDescription: 'Gera metade do cosmo no próximo turno.' }, self: 1, neg: 1 });
  mk({ n: 'Provocação', d: 'O inimigo é obrigado a usar um ataque no próximo turno.', r: 3, s: '50_provocacao', a: 'Taunt', c: 20, deb: { isTaunt: 1, debuffDescription: 'Só pode usar cartas de ataque neste turno.' }, neg: 1 });
  mk({ n: 'Pausa Tática', d: 'Saca 2 cartas e descarta 1 (a que você menos pode usar).', r: 2, s: '51_pausa_tatica', a: 'TacticalPause', c: 15 });
  mk({ n: 'Troca de Destino', d: 'Troca uma carta comum da sua mão por uma carta comum aleatória da mão do oponente. Não pega cartas especiais.', r: 3, s: '52_troca_de_destino', a: 'FateSwap', c: 25 });
  mk({ n: 'Vínculo de Cosmo', d: 'Cura 10 de vida por cada carta de ataque que você jogou neste turno.', r: 2, s: '53_vinculo_de_cosmo', a: 'CosmoBond', c: 25 });
  mk({ n: 'Reflexos Aguçados', d: 'Nos próximos 2 ataques do inimigo, o anel da guarda fica maior e mais fácil de acertar.', r: 2, s: '54_reflexos_agucados', a: 'SharpReflexes', c: 15, self: 1, deb: { easyGuard: 2, turnDuration: 3, debuffDescription: 'Guarda mais fácil nos próximos 2 ataques do inimigo.' } });
  mk({ n: 'Mira Aguçada', d: 'O próximo Golpe Preciso causa +30% de dano em vez de +15%.', r: 2, s: '55_mira_agucada', a: 'SharpAim', c: 15, self: 1, deb: { precBoost: 1, turnDuration: 3, debuffDescription: 'Próximo Golpe Preciso: +30% de dano.' } });
})();
