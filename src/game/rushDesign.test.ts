import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AEROSOL_DEPLETE_BLINK_SECONDS,
  computeRushBoardWeaponCap,
  computeRushDirectorParams,
  computeRushEscalatedCost,
  computeRushSupplyMax,
  createRushWaveDirector,
  executeRushDropOrMerge,
  getInitialAerosolAmmo,
  getRushKillSupply,
  getRushWearFraction,
  getRushWearSeconds,
  planRushWave,
  RUSH_EVOLUTION_WEAR_SECONDS,
  RUSH_INITIAL_SUPPLY,
  RUSH_MAX_BUG_SPEED_MULT,
  RUSH_MAX_CONCURRENT_BUGS,
  RUSH_MAX_SPRAY_FLUS_ON_BOARD,
  RUSH_OPENING_CENTER_RAIL,
  RUSH_SUPPLY_BASE_PER_SEC,
  RUSH_WAVE_WARNING_SECONDS,
  RUSH_WEAR_SECONDS_BY_LEVEL,
  RushWavePlan,
  tickRushWaveDirector,
  tickRushWear,
} from './roguelite';
import { BugType, UtensilPiece, UtensilType } from './types';

function makePiece(id: string, type: UtensilType, level: number, rail: number | null, row: number | null): UtensilPiece {
  return { id, type, level, rail, row, gunkTimer: 0, cooldown: 0, fireTimer: 0, comboType: 'none' };
}

function seededRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

// ---------------------------------------------------------------------------
// Desgaste
// ---------------------------------------------------------------------------

test('Desgaste: un arma colocada desde la bandeja sirve 22 s en Nv.1 y luego parpadea y desaparece', () => {
  const placed = executeRushDropOrMerge([], makePiece('s1', 'spray_flus', 1, null, null), 1, 5, 2, 3);
  const spray = placed.updatedPieces[0];
  assert.equal(spray.wearRemaining, RUSH_WEAR_SECONDS_BY_LEVEL[1]);
  assert.equal(spray.wearMax, 22);
  assert.equal(getRushWearFraction(spray), 1);

  const almost = tickRushWear(spray, 21.9);
  assert.equal(almost.wornOut, false);
  assert.ok(Math.abs((almost.piece.wearRemaining ?? 0) - 0.1) < 1e-6);

  const worn = tickRushWear({ ...almost.piece, comboType: 'line_foam' }, 0.2);
  assert.equal(worn.wornOut, true);
  assert.equal(worn.piece.depleteTimer, AEROSOL_DEPLETE_BLINK_SECONDS);
  assert.equal(worn.piece.comboType, 'none');

  // Once blinking, wear no longer ticks (the blink countdown takes over).
  assert.equal(tickRushWear(worn.piece, 5).wornOut, false);
});

test('Desgaste: mover no lo reinicia; fusionar y evolucionar lo renuevan; los aerosoles usan cargas', () => {
  const board = [{ ...makePiece('m1', 'mop_vortex', 1, 2, 5), wearRemaining: 5, wearMax: 22 }];

  const moved = executeRushDropOrMerge(board, board[0], 0, 4, 2, 3);
  assert.equal(moved.outcome, 'placed');
  assert.equal(moved.updatedPieces[0].wearRemaining, 5);

  const merged = executeRushDropOrMerge(board, makePiece('m2', 'mop_vortex', 1, null, null), 2, 5, 2, 3);
  assert.equal(merged.outcome, 'merged');
  assert.equal(merged.updatedPieces[0].level, 2);
  assert.equal(merged.updatedPieces[0].wearRemaining, RUSH_WEAR_SECONDS_BY_LEVEL[2]);

  const gold = [
    { ...makePiece('g1', 'soap_bar', 3, 1, 4), wearRemaining: 2, wearMax: 40 },
  ];
  const evolved = executeRushDropOrMerge(gold, makePiece('g2', 'mop_vortex', 3, null, null), 1, 4, 2, 3);
  assert.equal(evolved.outcome, 'evolved');
  assert.equal(evolved.updatedPieces[0].wearRemaining, RUSH_EVOLUTION_WEAR_SECONDS);

  const aerosol = executeRushDropOrMerge([], makePiece('a1', 'aerosol_torch', 1, null, null), 0, 4, 2, 3);
  assert.equal(aerosol.updatedPieces[0].wearRemaining, undefined);
  assert.equal(aerosol.updatedPieces[0].ammo, getInitialAerosolAmmo(1));
  assert.equal(getRushWearSeconds('aerosol_torch', 1), null);
});

// ---------------------------------------------------------------------------
// Suministro por combo
// ---------------------------------------------------------------------------

test('Suministro: los combos pagan las armas y las bajas normales casi no dan nada', () => {
  assert.equal(RUSH_INITIAL_SUPPLY, 30);
  assert.equal(RUSH_SUPPLY_BASE_PER_SEC, 4);
  assert.equal(getRushKillSupply({ stars: 1 }), 3);
  assert.equal(getRushKillSupply({ stars: 1, hitByBridgeBurn: true }), 14);
  assert.equal(getRushKillSupply({ stars: 2 }), 14);
  assert.equal(getRushKillSupply({ stars: 3 }), 26);
  assert.equal(getRushKillSupply({ stars: 1, bossTier: 'mini' }), 40);
  // A 3★ kill pays for the first weapon on its own.
  assert.ok(getRushKillSupply({ stars: 3 }) >= computeRushEscalatedCost(0));
});

// ---------------------------------------------------------------------------
// Director de oleadas avisadas
// ---------------------------------------------------------------------------

test('Oleadas: cada oleada se avisa 3 s antes y solo sale por sus carriles marcados', () => {
  const rng = seededRng(7);
  let state = createRushWaveDirector();
  let t = 0;
  const dt = 0.05;
  let announcedAt = -1;
  let current: RushWavePlan | null = null;
  let checkedWaves = 0;

  while (t < 200 && checkedWaves < 25) {
    t = Number((t + dt).toFixed(2));
    const tick = tickRushWaveDirector(state, dt, t, { canSpawn: true, rng });
    state = tick.state;
    if (tick.announced) {
      announcedAt = t;
      current = tick.announced;
      checkedWaves += 1;
      if (t < 15) {
        assert.deepEqual(current.hotRails, [RUSH_OPENING_CENTER_RAIL]);
      }
      assert.ok(current.hotRails.length >= 1 && current.hotRails.length <= 2);
    }
    if (tick.warning) {
      assert.deepEqual(tick.warning.rails, current?.hotRails);
      assert.ok(tick.warning.secondsLeft <= RUSH_WAVE_WARNING_SECONDS);
    }
    for (const spawn of tick.spawns) {
      assert.ok(current, 'no spawn may happen before a wave is announced');
      assert.ok(t - announcedAt >= RUSH_WAVE_WARNING_SECONDS - 1e-6, `spawn at ${t}s only ${t - announcedAt}s after warning`);
      assert.ok(current.hotRails.includes(spawn.rail), `spawn on rail ${spawn.rail} outside ${current.hotRails}`);
    }
  }
  assert.equal(checkedWaves, 25);
});

test('Oleadas: si la mesa está llena de bichos, la oleada espera en vez de perder spawns', () => {
  let state = createRushWaveDirector();
  const rng = seededRng(3);
  // Reach the active stage of the first wave.
  for (let i = 0; i < 200 && state.stage !== 'active'; i++) {
    state = tickRushWaveDirector(state, 0.1, 5, { canSpawn: true, rng }).state;
  }
  assert.equal(state.stage, 'active');
  // Let the spacing to the next spawn run out while the board is full: nothing spawns, nothing is lost.
  const blocked = tickRushWaveDirector(state, 5, 10, { canSpawn: false, rng });
  assert.equal(blocked.spawns.length, 0);
  assert.equal(blocked.state.nextSpawnIndex, state.nextSpawnIndex);
  const released = tickRushWaveDirector(blocked.state, 0.1, 10.1, { canSpawn: true, rng });
  assert.equal(released.spawns.length, 1);
  assert.equal(released.state.nextSpawnIndex, state.nextSpawnIndex + 1);
});

test('Oleadas: la variedad crece con el tiempo y cada patrón pide una respuesta concreta', () => {
  const rng = seededRng(11);
  const early = new Set<string>();
  const late = new Set<string>();
  for (let i = 0; i < 300; i++) {
    early.add(planRushWave(25, rng).pattern);
    late.add(planRushWave(140, rng).pattern);
  }
  assert.deepEqual([...early].sort(), ['ant_trickle', 'armored_column']);
  for (const p of ['ant_swarm', 'armored_column', 'pincer', 'roach_cross', 'wasp_raid']) {
    assert.ok(late.has(p), `late game should include ${p}`);
  }
  const pincer = planRushWave(140, () => 0.5);
  assert.equal(pincer.pattern, 'pincer');
  assert.equal(pincer.hotRails.length, 2);
});

// ---------------------------------------------------------------------------
// Simulación de diseño: tapar carriles pierde, leer y combinar gana
// ---------------------------------------------------------------------------
// Modelo abstracto del combate (no el motor real): sirve para calibrar la economía, el desgaste, el
// tope de armas y el director de oleadas. Reglas del modelo, sacadas de ChefBastionCanvas.tsx:
// - Rata con escudo (cap_beetle): inmune a los disparos hasta que cruza la fila de un Puente UV
//   (2 aerosoles en carriles vecinos y la misma fila). Al cruzarlo pierde el escudo para siempre y
//   recibe 48 de daño/s mientras está en contacto; esa baja paga como quemadura de puente.
// - Los aerosoles gastan 0,45 cargas/s con el puente activo y 0,85 más por cada bicho en contacto.
// - Flus-Flus + Estropajo en un carril (abanico): daña a todos los bichos del carril y la baja es 2★.
// - Cualquier otra arma solo daña al bicho más adelantado de su carril (baja 1★).

interface SimTower {
  piece: UtensilPiece;
  lifeLeft?: number; // aerosols: charges drained by the active bridge
}
interface SimBug {
  rail: number;
  y: number;
  hp: number;
  type: BugType;
  shielded: boolean;
  burned?: boolean;
}

const SIM_BUG_HP: Record<BugType, number> = { speed_ant: 38, cap_beetle: 78, acid_wasp: 60, shift_roach: 56, king_crab: 145 };
const SIM_BUG_SPEED: Record<BugType, number> = { speed_ant: 0.68, cap_beetle: 0.48, acid_wasp: 0.52, shift_roach: 0.55, king_crab: 0.4 };
const SIM_DPS: Record<number, number> = { 1: 13.5, 2: 19.5, 3: 27 };
const SIM_SHOOTERS: ReadonlySet<UtensilType> = new Set<UtensilType>(['spray_flus', 'mop_vortex', 'aerosol_torch']);

type Bot = {
  onAnnounce(plan: RushWavePlan, ctx: BotContext): void;
  act(ctx: BotContext): void;
};
interface BotContext {
  towers: SimTower[];
  bugs: () => SimBug[];
  supply: number;
  cap: number;
  cost: number;
  buy(type: UtensilType, rail: number, row: number): boolean;
  move(tower: SimTower, rail: number, row: number): void;
}

function simulateRush(seed: number, bot: Bot, maxSeconds = 180, log?: (msg: string) => void): number {
  const rng = seededRng(seed);
  const dt = 0.1;
  let t = 0;
  let supply = RUSH_INITIAL_SUPPLY;
  let xp = 0;
  let xpNext = 55;
  let rushLevel = 1;
  let breaches = 0;
  let towers: SimTower[] = [];
  let bugs: SimBug[] = [{ rail: RUSH_OPENING_CENTER_RAIL, y: -0.35, hp: SIM_BUG_HP.speed_ant * 0.58, type: 'speed_ant', shielded: false }];
  let director = createRushWaveDirector();
  let nextId = 0;

  const ctx: BotContext = {
    towers,
    bugs: () => bugs,
    supply,
    cap: 3,
    cost: 24,
    buy(type, rail, row) {
      if (towers.length >= ctx.cap || supply < ctx.cost) return false;
      if (towers.some((tw) => tw.piece.rail === rail && tw.piece.row === row)) return false;
      const placed = executeRushDropOrMerge(
        towers.map((tw) => tw.piece),
        makePiece(`t${nextId++}`, type, 1, null, null),
        rail,
        row,
        2,
        ctx.cap
      );
      // Same rules as the game: board cap and the 2 Flus-Flus limit reject the purchase.
      if (placed.outcome !== 'placed') return false;
      supply -= ctx.cost;
      const newPiece = placed.updatedPieces[placed.updatedPieces.length - 1];
      towers.push({
        piece: newPiece,
        lifeLeft: type === 'aerosol_torch' ? getInitialAerosolAmmo(1) / 0.45 : undefined,
      });
      ctx.supply = supply;
      ctx.cost = computeRushEscalatedCost(towers.length);
      return true;
    },
    move(tower, rail, row) {
      const occupant = towers.find((tw) => tw !== tower && tw.piece.rail === rail && tw.piece.row === row);
      if (occupant) {
        occupant.piece = { ...occupant.piece, rail: tower.piece.rail, row: tower.piece.row };
      }
      tower.piece = { ...tower.piece, rail, row };
    },
  };

  while (t < maxSeconds) {
    t = Number((t + dt).toFixed(2));
    const power = towers.length === 0 ? 0 : towers.reduce((acc, tw) => acc + tw.piece.level, 0);
    const dir = computeRushDirectorParams(t, power);
    const cost = computeRushEscalatedCost(towers.length);
    supply = Math.min(computeRushSupplyMax(cost), supply + RUSH_SUPPLY_BASE_PER_SEC * dt);
    while (xp >= xpNext) {
      xp -= xpNext;
      rushLevel += 1;
      xpNext = Math.round(55 + rushLevel * 24);
    }
    Object.assign(ctx, { towers, supply, cap: computeRushBoardWeaponCap(rushLevel), cost });

    const tick = tickRushWaveDirector(director, dt, t, {
      canSpawn: bugs.length < dir.maxConcurrentBugs,
      paceMult: dir.spawnIntervalSec / 2.5,
      rng,
    });
    director = tick.state;
    if (tick.announced) bot.onAnnounce(tick.announced, ctx);
    bot.act(ctx);
    supply = ctx.supply;
    for (const s of tick.spawns) {
      bugs.push({ rail: s.rail, y: -0.35, hp: SIM_BUG_HP[s.type] * dir.hpMultiplier, type: s.type, shielded: s.type === 'cap_beetle' });
    }

    // UV bridges: pairs of aerosols on neighbouring rails and the same row.
    const bridges: { rails: [number, number]; row: number; members: SimTower[] }[] = [];
    const aerosols = towers.filter((tw) => tw.piece.type === 'aerosol_torch');
    for (let i = 0; i < aerosols.length; i++) {
      for (let j = i + 1; j < aerosols.length; j++) {
        const a = aerosols[i].piece;
        const b = aerosols[j].piece;
        if (a.row === b.row && Math.abs((a.rail ?? 0) - (b.rail ?? 0)) === 1) {
          bridges.push({
            rails: [Math.min(a.rail ?? 0, b.rail ?? 0), Math.max(a.rail ?? 0, b.rail ?? 0)],
            row: a.row ?? 0,
            members: [aerosols[i], aerosols[j]],
          });
        }
      }
    }
    for (const br of bridges) {
      for (const m of br.members) m.lifeLeft = (m.lifeLeft ?? 0) - 0.45 * dt;
      for (const b of bugs) {
        const rail = Math.round(b.rail);
        if (b.hp > 0 && rail >= br.rails[0] && rail <= br.rails[1] && Math.abs(b.y - br.row) < 0.5) {
          b.shielded = false;
          b.burned = true;
          b.hp -= 48 * dt;
          for (const m of br.members) m.lifeLeft = (m.lifeLeft ?? 0) - 0.85 * dt;
        }
      }
    }

    // Wear (aerosols use their charges instead).
    towers = towers.filter((tw) => {
      if (tw.lifeLeft !== undefined) return tw.lifeLeft > 0;
      const worn = tickRushWear(tw.piece, dt);
      tw.piece = worn.piece;
      return !worn.wornOut;
    });

    // Weapon fire per rail.
    for (let rail = 0; rail < 4; rail++) {
      const onRail = towers.filter((tw) => tw.piece.rail === rail);
      if (onRail.length === 0) continue;
      const types = new Set(onRail.map((tw) => tw.piece.type));
      const fan = types.has('spray_flus') && types.has('scourer_nanas');
      // Only shooters deal damage (as in the engine): Estropajo and Jabón shape shots/bugs but never fire.
      const dps = onRail
        .filter((tw) => SIM_SHOOTERS.has(tw.piece.type))
        .reduce((acc, tw) => acc + SIM_DPS[Math.min(3, tw.piece.level)], 0);
      const hittable = bugs
        .filter((b) => Math.round(b.rail) === rail && b.y >= 0 && b.hp > 0 && !b.shielded)
        .sort((a, b) => b.y - a.y);
      if (fan) {
        for (const b of hittable) b.hp -= dps * dt;
      } else if (hittable.length > 0) {
        hittable[0].hp -= dps * dt;
      }
      for (const b of hittable) {
        if (b.hp <= 0 && !b.burned) (b as SimBug & { fanned?: boolean }).fanned = fan;
      }
    }

    const survivors: SimBug[] = [];
    for (const b of bugs) {
      if (b.hp <= 0) {
        const fanned = (b as SimBug & { fanned?: boolean }).fanned === true;
        supply = Math.min(
          computeRushSupplyMax(computeRushEscalatedCost(towers.length)),
          supply + getRushKillSupply({ stars: fanned ? 2 : 1, hitByBridgeBurn: b.burned })
        );
        xp += 14;
        continue;
      }
      b.y += SIM_BUG_SPEED[b.type] * dir.speedMultiplier * dt;
      if (b.y >= 6.85) {
        breaches += 1;
        log?.(`${t}s breach ${b.type} rail ${b.rail} shielded=${b.shielded} towers=${towers.map((tw) => `${tw.piece.type}@${tw.piece.rail},${tw.piece.row}`).join(' ')} supply=${supply.toFixed(0)} cap=${ctx.cap}`);
        if (breaches >= 4) return t;
        continue;
      }
      survivors.push(b);
    }
    bugs = survivors;
  }
  return maxSeconds;
}

/**
 * Covers rails with the cheapest weapon and never moves anything (the old dominant strategy). With the
 * 2 Flus-Flus limit it walls the remaining rails with Estropajo instead.
 */
const staticCoverBot: Bot = {
  onAnnounce() {},
  act(ctx) {
    for (const rail of [1, 2, 0, 3]) {
      if (!ctx.towers.some((tw) => tw.piece.rail === rail)) {
        if (!ctx.buy('spray_flus', rail, 5)) ctx.buy('scourer_nanas', rail, 5);
      }
    }
  },
};

/**
 * Reads the board like a player: the announced wave plus the bugs already walking, most advanced first,
 * and builds the answer each rail asks for (UV bridge for shields, foam fan for everything else).
 * Moving a placed piece is free; buying is limited by supply and the board cap; nothing is ever discarded.
 */
function makeTacticalBot(): Bot {
  let announced: RushWavePlan | null = null;
  let liveBugs: () => SimBug[] = () => [];

  const wantedFor = (): { type: UtensilType; rail: number; row: number }[] => {
    const danger = new Map<number, { shield: boolean; other: boolean; y: number }>();
    const note = (rail: number, type: BugType, y: number) => {
      const d = danger.get(rail) ?? { shield: false, other: false, y: -1 };
      if (type === 'cap_beetle') d.shield = true;
      else d.other = true;
      d.y = Math.max(d.y, y);
      danger.set(rail, d);
    };
    for (const b of liveBugs()) note(Math.round(b.rail), b.type, b.y);
    for (const s of announced?.spawns ?? []) note(s.rail, s.type, -0.5);

    const rails = [...danger.entries()].sort((a, b) => b[1].y - a[1].y);
    const wanted: { type: UtensilType; rail: number; row: number }[] = [];
    const add = (type: UtensilType, rail: number, row: number) => {
      if (!wanted.some((w) => w.rail === rail && w.row === row)) wanted.push({ type, rail, row });
    };
    for (const [rail, d] of rails) {
      if (d.shield) {
        const partner = rail === 3 ? 2 : rail + 1;
        add('aerosol_torch', rail, 3);
        add('aerosol_torch', partner, 3);
      }
      if (d.other) {
        add('spray_flus', rail, 5);
        add('scourer_nanas', rail, 4);
      }
    }
    return wanted;
  };

  const fulfil = (ctx: BotContext) => {
    const used = new Set<SimTower>();
    for (const w of wantedFor()) {
      const here = ctx.towers.find(
        (tw) => !used.has(tw) && tw.piece.type === w.type && tw.piece.rail === w.rail && tw.piece.row === w.row
      );
      if (here) {
        used.add(here);
        continue;
      }
      const spare = ctx.towers.find((tw) => !used.has(tw) && tw.piece.type === w.type);
      if (spare) {
        ctx.move(spare, w.rail, w.row);
        used.add(spare);
        continue;
      }
      if (ctx.buy(w.type, w.rail, w.row)) {
        used.add(ctx.towers[ctx.towers.length - 1]);
      }
    }
  };

  return {
    onAnnounce(plan, ctx) {
      announced = plan;
      fulfil(ctx);
    },
    act(ctx) {
      liveBugs = ctx.bugs;
      fulfil(ctx);
    },
  };
}

test('Diseño Supervivencia: tapar carriles y no tocar nada pierde pronto; leer los avisos y combinar aguanta', () => {
  // El bot táctico es un jugador de mínimos: no fusiona, no evoluciona, no usa Jabón + Fregona (3★),
  // ni el Trapazo ni las Comandas. Un jugador real con esas herramientas debería aguantar más.
  const seeds = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89];
  const staticTimes = seeds.map((seed) => simulateRush(seed, staticCoverBot));
  const tacticalTimes = seeds.map((seed) => simulateRush(seed, makeTacticalBot()));

  const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  const staticEarly = staticTimes.filter((s) => s < 75).length;
  const tacticalLong = tacticalTimes.filter((s) => s >= 100).length;

  assert.ok(staticEarly >= 9, `estático: ${staticTimes.join(', ')} s (esperado < 75 s en 9 de 10)`);
  assert.ok(tacticalLong >= 9, `táctico: ${tacticalTimes.join(', ')} s (esperado >= 100 s en 9 de 10)`);
  assert.ok(
    median(tacticalTimes) >= 1.8 * median(staticTimes),
    `jugar bien debe multiplicar la supervivencia: mediana táctica ${median(tacticalTimes)} s vs estática ${median(staticTimes)} s`
  );
});

// ---------------------------------------------------------------------------
// Orquestación: invariantes que mantienen el tablero legible (si Gemini los rompe, la CI se pone en rojo)
// ---------------------------------------------------------------------------

test('Orquestación: como máximo 2 Flus-Flus en la mesa; fusionar y mover siguen permitidos', () => {
  const board = [
    { ...executeRushDropOrMerge([], makePiece('f1', 'spray_flus', 1, null, null), 0, 5, 2, 5).updatedPieces[0] },
  ];
  const two = executeRushDropOrMerge(board, makePiece('f2', 'spray_flus', 1, null, null), 2, 5, 2, 5).updatedPieces;
  assert.equal(two.filter((p) => p.type === 'spray_flus').length, RUSH_MAX_SPRAY_FLUS_ON_BOARD);

  const third = executeRushDropOrMerge(two, makePiece('f3', 'spray_flus', 1, null, null), 3, 5, 2, 5);
  assert.equal(third.outcome, 'type_cap_reached');
  assert.equal(third.updatedPieces.length, 2);

  // Other weapons still fit under the board cap.
  assert.equal(executeRushDropOrMerge(two, makePiece('s1', 'soap_bar', 1, null, null), 3, 5, 2, 5).outcome, 'placed');
  // Fusing the card into a Flus-Flus already on the counter is allowed.
  assert.equal(executeRushDropOrMerge(two, makePiece('f4', 'spray_flus', 1, null, null), 0, 5, 2, 5).outcome, 'merged');
  // Moving a placed Flus-Flus to another rail is the intended play.
  const moved = executeRushDropOrMerge(two, two[0], 1, 4, 2, 5);
  assert.equal(moved.outcome, 'placed');
  assert.equal(moved.updatedPieces.filter((p) => p.type === 'spray_flus').length, 2);
});

test('Orquestación: nunca más de 4 bichos a la vez y velocidad con techo, sea cual sea el tiempo o el arsenal', () => {
  for (let t = 0; t <= 600; t += 5) {
    for (const power of [0, 3, 8, 15, 30]) {
      const dir = computeRushDirectorParams(t, power);
      assert.ok(dir.maxConcurrentBugs <= RUSH_MAX_CONCURRENT_BUGS, `t=${t}s poder=${power}: ${dir.maxConcurrentBugs} bichos`);
      assert.ok(dir.speedMultiplier <= RUSH_MAX_BUG_SPEED_MULT, `t=${t}s poder=${power}: velocidad ${dir.speedMultiplier}`);
    }
  }
  assert.equal(computeRushDirectorParams(10, 0).maxConcurrentBugs, 3);
});
