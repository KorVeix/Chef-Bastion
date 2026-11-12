import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AEROSOL_DEPLETE_BLINK_SECONDS,
  buildActiveRushPool,
  buildThermalReceipt,
  COMANDA_AUTO_PICK_SECONDS,
  COMANDAS_POOL,
  computeRushAdaptivePressureMultiplier,
  computeRushArsenalMetrics,
  computeRushBoardWeaponCap,
  computeRushDeployCostForBoard,
  computeRushDirectorParams,
  computeRushEscalatedCost,
  computeRushSupplyMax,
  consumeAerosolAmmo,
  countActiveRushBoardWeapons,
  ensureRushTrayHasSprayFlus,
  executeRushDropOrMerge,
  findSupremeEvolutionPartners,
  formatSurvivalMMSS,
  getChaosDirectorEventForMinute,
  getFrenzyThermometer,
  getInitialAerosolAmmo,
  MERGE_SHOCKWAVE_PUSH_CELLS,
  pickRushSpawnRail,
  rollLiveComandaTriplet,
  rollRushTrayBatch,
  rollRushTraySlot,
  RUSH_ADAPTIVE_POWER_RATIO,
  RUSH_BASE_POOL,
  RUSH_CENTRAL_RAIL_ONLY_SECONDS,
  RUSH_SUPPLY_BASE_PER_SEC,
  RUSH_SUPPLY_DEPLOY_COST,
  SUPREME_EVOLUTION_HITSTOP_SECONDS,
  tickDepletingAerosol,
} from './roguelite';
import { createInitialBoardPieces, ensureTrayHasSprayFlus, evaluateBoardCombos } from './rules';
import { UtensilPiece, UtensilType } from './types';

function makePiece(
  id: string,
  type: UtensilType,
  level: number,
  rail: number | null,
  row: number | null
): UtensilPiece {
  return {
    id,
    type,
    level,
    rail,
    row,
    gunkTimer: 0,
    cooldown: 0,
    fireTimer: 0,
    comboType: 'none',
  };
}

test('RUSH_BASE_POOL starts with 5 agile base weapons', () => {
  assert.equal(RUSH_BASE_POOL.length, 5);
  assert.deepEqual(RUSH_BASE_POOL, [
    'spray_flus',
    'aerosol_torch',
    'soap_bar',
    'mop_vortex',
    'scourer_nanas',
  ]);
});

test('Hot-Merge upgrades Nv.1 -> Nv.2 Plata -> Nv.3 Oro in 1 cell with 1-cell shockwave and frees origin', () => {
  const p1 = makePiece('p1', 'spray_flus', 1, 1, 4);
  const p2 = makePiece('p2', 'spray_flus', 1, 2, 5);

  const mergeToSilver = executeRushDropOrMerge([p1, p2], p2, 1, 4);
  assert.equal(mergeToSilver.outcome, 'merged');
  assert.equal(mergeToSilver.newLevel, 2);
  assert.equal(mergeToSilver.shockwavePushCells, MERGE_SHOCKWAVE_PUSH_CELLS);
  assert.deepEqual(mergeToSilver.freedOriginCell, { rail: 2, row: 5 });
  assert.equal(mergeToSilver.updatedPieces.length, 1);
  assert.equal(mergeToSilver.updatedPieces[0].level, 2);

  const traySilver = makePiece('p3', 'spray_flus', 2, null, null);
  const mergeToGold = executeRushDropOrMerge(mergeToSilver.updatedPieces, traySilver, 1, 4);
  assert.equal(mergeToGold.outcome, 'merged');
  assert.equal(mergeToGold.newLevel, 3);
  assert.equal(mergeToGold.updatedPieces.length, 1);
  assert.equal(mergeToGold.updatedPieces[0].level, 3);
});

test('All 5 Supreme Evolutions fuse Nv.3 Oro + Nv.3 Oro into 1 cell with 50ms hitstop', () => {
  const recipes: [UtensilType, UtensilType, string][] = [
    ['soap_bar', 'mop_vortex', 'centrifuge_vortex'],
    ['aerosol_torch', 'scourer_nanas', 'plasma_uv_cannon'],
    ['spray_flus', 'corner_square', 'ricochet_washer'],
    ['aerosol_torch', 'aerosol_torch', 'tesla_sanitary_coil'],
    ['spray_flus', 'soap_bar', 'foam_mortar'],
  ];

  for (const [typeA, typeB, expectedEvoId] of recipes) {
    const a = makePiece('a', typeA, 3, 0, 3);
    const b = makePiece('b', typeB, 3, 2, 4);

    const partners = findSupremeEvolutionPartners(a, [a, b]);
    assert.equal(partners.length, 1);
    assert.equal(partners[0].evolution.id, expectedEvoId);

    const res = executeRushDropOrMerge([a, b], a, 2, 4);
    assert.equal(res.outcome, 'evolved');
    assert.equal(res.newLevel, 4);
    assert.equal(res.evolution?.id, expectedEvoId);
    assert.equal(res.hitstopSeconds, SUPREME_EVOLUTION_HITSTOP_SECONDS);
    assert.deepEqual(res.freedOriginCell, { rail: 0, row: 3 });
    assert.equal(res.updatedPieces.length, 1);
    assert.equal(res.updatedPieces[0].evolutionId, expectedEvoId);
    assert.equal(res.updatedPieces[0].rail, 2);
    assert.equal(res.updatedPieces[0].row, 4);
  }
});

test('Frenzy Thermometer scales supply pool and eliminates Nv.1 in Overdrive (4:00+)', () => {
  const f1 = getFrenzyThermometer(10);
  assert.equal(f1.tier, 1);
  assert.equal(f1.silverChance, 0);
  assert.equal(buildActiveRushPool({ elapsedSeconds: 10 }).length, 5);

  const f2 = getFrenzyThermometer(75);
  assert.equal(f2.tier, 2);
  assert.equal(f2.silverChance, 0.2);
  assert.ok(buildActiveRushPool({ elapsedSeconds: 75 }).includes('corner_square'));

  const f3 = getFrenzyThermometer(150);
  assert.equal(f3.tier, 3);
  assert.ok(buildActiveRushPool({ elapsedSeconds: 150 }).includes('bleach_cannon'));

  const f4 = getFrenzyThermometer(245);
  assert.equal(f4.tier, 4);
  assert.equal(f4.allowTier1InTray, false);

  // Sample 50 rolls in Overdrive: 0% Nv.1!
  for (let i = 0; i < 50; i++) {
    const roll = rollRushTraySlot(0, {
      elapsedSeconds: 250,
      rng: () => (i % 2 === 0 ? 0.1 : 0.85),
    });
    assert.ok(roll.level === 2 || roll.level === 3);
  }

  // Veto removes weapon from pool without starving merges below 3 types
  const vetoedPool = buildActiveRushPool({
    elapsedSeconds: 10,
    vetoedTypes: ['scourer_nanas'],
  });
  assert.equal(vetoedPool.includes('scourer_nanas'), false);
  assert.equal(vetoedPool.length, 4);
});

test('Chaos Director triggers minute events and opens lateral conduits at 2:00-2:30 and 4:00+', () => {
  assert.equal(getChaosDirectorEventForMinute(1)?.id, 'rush_hour');
  assert.equal(getChaosDirectorEventForMinute(2)?.id, 'lateral_breach');
  assert.equal(getChaosDirectorEventForMinute(3)?.id, 'boss_invasion');
  assert.equal(getChaosDirectorEventForMinute(4)?.id, 'overdrive');

  assert.equal(computeRushDirectorParams(60).lateralConduitsOpen, false);
  assert.equal(computeRushDirectorParams(130).lateralConduitsOpen, true);
  assert.equal(computeRushDirectorParams(170).lateralConduitsOpen, false);
  assert.equal(computeRushDirectorParams(245).lateralConduitsOpen, true);
});

test('Live Comandas enforce <= 4 words for 0.4s reading and center auto-slot is never a plate sacrifice', () => {
  for (const cmd of COMANDAS_POOL) {
    const wordCount = cmd.title.trim().split(/\s+/).length;
    assert.ok(wordCount <= 4, `Comanda "${cmd.title}" exceeds 4 words (${wordCount})`);
  }

  for (let i = 0; i < 20; i++) {
    const triplet = rollLiveComandaTriplet({
      intactPlates: [true, false, true, true],
      activePool: ['spray_flus', 'aerosol_torch', 'soap_bar', 'mop_vortex', 'scourer_nanas'],
      roombaActive: false,
    });
    assert.equal(triplet.length, 3);
    assert.notEqual(triplet[1].effectId, 'pact_sacrifice_plate');
    for (const t of triplet) {
      assert.ok(t.title.trim().split(/\s+/).length <= 4);
    }
  }
});

test('Thermal Receipt formats MM:SS, flags new records, and sums global coins accurately', () => {
  assert.equal(formatSurvivalMMSS(195), '03:15');
  const receipt = buildThermalReceipt({
    survivedSeconds: 195,
    previousBestSeconds: 120,
    bugsCleaned: 40,
    mergesCount: 5,
    evolutionsCount: 1,
    comandasPicked: 4,
    milestonesCoins: 80,
    score: 4250,
  });
  assert.equal(receipt.survivedFormatted, '03:15');
  assert.equal(receipt.isNewRecord, true);
  assert.equal(receipt.frenzyReached, 3);
  const sumLines = receipt.lines.reduce((acc, l) => acc + l.amountCoins, 0);
  assert.equal(receipt.totalCoinsEarned, sumLines);
  assert.ok(receipt.totalCoinsEarned > 300);
});

test('Rush Rebalance 1: +30% compounded cost per placed weapon; merging does NOT increase cost', () => {
  assert.equal(computeRushEscalatedCost(0), RUSH_SUPPLY_DEPLOY_COST); // 24
  assert.equal(computeRushEscalatedCost(1), Math.round(24 * 1.3)); // 31
  assert.equal(computeRushEscalatedCost(2), Math.round(24 * 1.3 * 1.3)); // 41
  assert.equal(computeRushEscalatedCost(3), Math.round(24 * Math.pow(1.3, 3))); // 53
  assert.equal(computeRushEscalatedCost(6), Math.round(24 * Math.pow(1.3, 6))); // 116
  assert.equal(computeRushSupplyMax(computeRushEscalatedCost(6)), 116);

  // Simulate placement vs merge using active weapons on board: merging does NOT increase active count or cost
  const placeRes = executeRushDropOrMerge([], makePiece('t1', 'spray_flus', 1, null, null), 1, 5, 2, 4);
  assert.equal(placeRes.outcome, 'placed');
  const costAfterFirstPlace = computeRushDeployCostForBoard(placeRes.updatedPieces);
  assert.equal(costAfterFirstPlace, computeRushEscalatedCost(1));

  const mergeRes = executeRushDropOrMerge(
    placeRes.updatedPieces,
    makePiece('t2', 'spray_flus', 1, null, null),
    1,
    5,
    2,
    4
  );
  assert.equal(mergeRes.outcome, 'merged');
  assert.equal(computeRushDeployCostForBoard(mergeRes.updatedPieces), costAfterFirstPlace);
});

test('Rush Rebalance 2: Board weapon cap starts at 4, +1 per XP level up to max 8, and still permits merges at cap', () => {
  assert.equal(computeRushBoardWeaponCap(1), 4);
  assert.equal(computeRushBoardWeaponCap(2), 5);
  assert.equal(computeRushBoardWeaponCap(3), 6);
  assert.equal(computeRushBoardWeaponCap(4), 7);
  assert.equal(computeRushBoardWeaponCap(5), 8);
  assert.equal(computeRushBoardWeaponCap(9), 8);

  const fourBoardPieces = [
    makePiece('b1', 'spray_flus', 1, 0, 5),
    makePiece('b2', 'spray_flus', 1, 1, 5),
    makePiece('b3', 'mop_vortex', 1, 2, 5),
    makePiece('b4', 'scourer_nanas', 1, 3, 5),
  ];

  // Placing a 5th weapon onto an empty cell at Lv.1 (cap = 4) is blocked with 'cap_reached'
  const blocked = executeRushDropOrMerge(
    fourBoardPieces,
    makePiece('tray-new', 'soap_bar', 1, null, null),
    1,
    4,
    2,
    computeRushBoardWeaponCap(1)
  );
  assert.equal(blocked.outcome, 'cap_reached');
  assert.equal(blocked.updatedPieces.length, 4);

  // Merging onto an occupied compatible weapon IS allowed even when at full 4/4 cap!
  const mergedAtCap = executeRushDropOrMerge(
    fourBoardPieces,
    makePiece('tray-merge', 'spray_flus', 1, null, null),
    0,
    5,
    2,
    computeRushBoardWeaponCap(1)
  );
  assert.equal(mergedAtCap.outcome, 'merged');
  assert.equal(mergedAtCap.newLevel, 2);
});

test('Rush Rebalance 3: Aerosols have limited charges, shut off UV bridge on empty, blink and vanish at 3.0s', () => {
  const placedRes = executeRushDropOrMerge(
    [],
    makePiece('uv1', 'aerosol_torch', 1, null, null),
    0,
    4,
    2,
    4
  );
  const uvA = placedRes.updatedPieces[0];
  assert.equal(uvA.ammo, getInitialAerosolAmmo(1));
  assert.equal(uvA.maxAmmo, 10);

  const uvB: UtensilPiece = { ...makePiece('uv2', 'aerosol_torch', 1, 1, 4), ammo: 2, maxAmmo: 10 };
  assert.equal(evaluateBoardCombos([uvA, uvB]).links.length, 1);

  // Consume remaining 2 charges -> ammo hits 0, starts 3.0s blink countdown, and shuts off UV bridge!
  const emptied = consumeAerosolAmmo(uvB, 2);
  assert.equal(emptied.ammo, 0);
  assert.equal(emptied.depleteTimer, AEROSOL_DEPLETE_BLINK_SECONDS);
  assert.equal(evaluateBoardCombos([uvA, emptied]).links.length, 0);

  // Tick 1.5s -> still blinking, not expired; tick another 1.5s (total 3.0s) -> expired!
  const midBlink = tickDepletingAerosol(emptied, 1.5);
  assert.equal(midBlink.expired, false);
  assert.equal(midBlink.piece.depleteTimer, 1.5);

  const vanished = tickDepletingAerosol(midBlink.piece, 1.5);
  assert.equal(vanished.expired, true);
  assert.equal(vanished.piece.depleteTimer, 0);
});

test('Rush Rebalance 4 & 5: First 15s spawn central rail ONLY, adaptive scaling uses (weapons * avgLevel), and average player loses in 90-120s', () => {
  assert.equal(RUSH_CENTRAL_RAIL_ONLY_SECONDS, 15.0);
  assert.equal(COMANDA_AUTO_PICK_SECONDS, 10.0);

  // Rule 5: First 15s strictly spawn on central rail (rail === 1) regardless of RNG
  for (const t of [0, 3.5, 9.9, 14.99]) {
    for (const r of [0.0, 0.25, 0.5, 0.75, 0.99]) {
      assert.equal(pickRushSpawnRail(t, () => r), 1);
    }
  }
  // After 15s, all 4 rails can spawn
  const post15Rails = new Set([0.05, 0.3, 0.6, 0.9].map((r) => pickRushSpawnRail(15.0, () => r)));
  assert.equal(post15Rails.size, 4);

  // Rule 4 (Fine-tuned): Adaptive difficulty scales at 75% of (weapons * avgLevel) growth; time adds the rest
  assert.equal(RUSH_ADAPTIVE_POWER_RATIO, 0.75);
  assert.equal(computeRushAdaptivePressureMultiplier(1), 1);
  assert.equal(computeRushAdaptivePressureMultiplier(5), 4); // 1 + 0.75 * (5 - 1) = 4.0
  assert.equal(computeRushAdaptivePressureMultiplier(9), 7); // 1 + 0.75 * (9 - 1) = 7.0

  const metrics = computeRushArsenalMetrics([
    makePiece('w1', 'spray_flus', 2, 1, 5),
    makePiece('w2', 'mop_vortex', 1, 2, 4),
    makePiece('w3', 'scourer_nanas', 3, 0, 5),
    { ...makePiece('w-empty', 'aerosol_torch', 2, 3, 4), ammo: 0, depleteTimer: 1.8 }, // excluded when empty!
  ]);
  assert.equal(metrics.weaponCount, 3);
  assert.equal(metrics.averageLevel, 2);
  assert.equal(metrics.arsenalPower, 6);

  const lowPowerAt60 = computeRushDirectorParams(60, 1);
  const highPowerAt60 = computeRushDirectorParams(60, 10);
  const laterTimeSamePower = computeRushDirectorParams(105, 1);
  assert.ok(highPowerAt60.hpMultiplier > lowPowerAt60.hpMultiplier);
  assert.ok(highPowerAt60.spawnIntervalSec < lowPowerAt60.spawnIntervalSec);
  // Elapsed time provides additional pressure even at identical arsenalPower
  assert.ok(laterTimeSamePower.hpMultiplier > lowPowerAt60.hpMultiplier);
  assert.ok(laterTimeSamePower.spawnIntervalSec < lowPowerAt60.spawnIntervalSec);

  // Deterministic Average-Player Rush Pacing Simulation -> must lose between 90s and 120s!
  let simSec = 0;
  const dt = 0.25;
  let supply = 48;
  let xp = 0;
  let xpNext = 55;
  let rushLvl = 1;
  let seals = 3; // 3 seals + 1 final leak = 4 plate breaches to lose
  let rngState = 1337;
  const nextRng = () => {
    rngState = (rngState * 1664525 + 1013904223) >>> 0;
    return rngState / 0x100000000;
  };

  interface SimTower {
    rail: number;
    level: number;
    dps: number;
  }
  interface SimBug {
    rail: number;
    y: number;
    hp: number;
    speed: number;
  }

  const towers: SimTower[] = [];
  let bugs: SimBug[] = [{ rail: 1, y: -0.35, hp: 32, speed: 0.5 }];
  let spawnCd = 1.4;
  let lostAtSec = -1;

  while (simSec < 180) {
    simSec = Number((simSec + dt).toFixed(2));
    const avgLvl =
      towers.length === 0
        ? 0
        : towers.reduce((acc, t) => acc + t.level, 0) / towers.length;
    const power = towers.length * avgLvl;
    const dir = computeRushDirectorParams(simSec, power);
    // Escalated cost counts ACTIVE weapons currently on board (`towers.length`)
    const curCost = computeRushEscalatedCost(towers.length);
    const supMax = computeRushSupplyMax(curCost);
    supply = Math.min(supMax, supply + RUSH_SUPPLY_BASE_PER_SEC * dt);

    if (xp >= xpNext) {
      xp -= xpNext;
      rushLvl += 1;
      xpNext = Math.round(55 + rushLvl * 24);
    }

    // Average player action: places onto under-defended rails up to cap, or merges (~45% efficiency) when at cap
    const cap = computeRushBoardWeaponCap(rushLvl);
    if (supply >= curCost) {
      if (towers.length < cap) {
        supply -= curCost;
        const targetRail = towers.length === 0 ? 1 : (towers.length + 1) % 4;
        towers.push({ rail: targetRail, level: 1, dps: 13.5 });
      } else {
        const upgradable = towers.find((t) => t.level < 3);
        if (upgradable && nextRng() < 0.45) {
          supply -= curCost;
          upgradable.level += 1;
          upgradable.dps = upgradable.level === 2 ? 19.5 : 27;
        }
      }
    }

    spawnCd -= dt;
    if (spawnCd <= 0 && bugs.length < dir.maxConcurrentBugs) {
      spawnCd = dir.spawnIntervalSec;
      const rail = pickRushSpawnRail(simSec, nextRng);
      const r = nextRng();
      const baseHp = simSec < 35 ? (r < 0.75 ? 38 : 78) : r < 0.45 ? 38 : r < 0.8 ? 78 : 60;
      const baseSpd = baseHp === 38 ? 0.68 : baseHp === 78 ? 0.48 : 0.52;
      bugs.push({
        rail,
        y: -0.35,
        hp: baseHp * dir.hpMultiplier,
        speed: baseSpd * dir.speedMultiplier,
      });
    }

    // Towers deal DPS primarily in their lane (+25% splash/diagonal spill)
    for (const t of towers) {
      const inLane = bugs.filter((b) => b.rail === t.rail && b.hp > 0);
      if (inLane.length > 0) {
        inLane.sort((a, b) => b.y - a.y);
        inLane[0].hp -= t.dps * dt;
      } else if (bugs.length > 0) {
        bugs[0].hp -= t.dps * 0.25 * dt;
      }
    }

    const nextBugs: SimBug[] = [];
    let railCleared: number | null = null;
    for (const b of bugs) {
      if (b.hp <= 0) {
        supply = Math.min(supMax, supply + 4);
        xp += 14;
        continue;
      }
      b.y += b.speed * dt;
      if (b.y >= 6.85) {
        if (seals > 0) {
          seals -= 1;
          railCleared = b.rail; // Bleach wave clears that rail on plate break
          continue;
        } else {
          lostAtSec = simSec;
          break;
        }
      }
      nextBugs.push(b);
    }
    if (lostAtSec > 0) break;
    bugs = railCleared !== null ? nextBugs.filter((b) => b.rail !== railCleared) : nextBugs;
  }

  assert.ok(
    lostAtSec >= 90 && lostAtSec <= 120,
    `Expected average player to lose between 90s and 120s, but lost at ${lostAtSec}s`
  );
});

test('reponer un aerosol agotado no cuesta más que el que se gastó', () => {
  // Start with 2 active weapons on the board
  const baseBoard: UtensilPiece[] = [
    makePiece('w1', 'spray_flus', 1, 0, 5),
    makePiece('w2', 'mop_vortex', 1, 1, 5),
  ];
  assert.equal(countActiveRushBoardWeapons(baseBoard), 2);
  const costPaidForAerosol = computeRushDeployCostForBoard(baseBoard); // 41 (24 * 1.3^2)

  // Deploy an aerosol onto (2, 4) -> active weapons rises to 3, next deploy cost steps up to 53
  const deployAerosol = executeRushDropOrMerge(
    baseBoard,
    makePiece('uv-1', 'aerosol_torch', 1, null, null),
    2,
    4,
    2,
    4
  );
  assert.equal(deployAerosol.outcome, 'placed');
  assert.equal(countActiveRushBoardWeapons(deployAerosol.updatedPieces), 3);
  const costWhileAerosolActive = computeRushDeployCostForBoard(deployAerosol.updatedPieces);
  assert.ok(costWhileAerosolActive > costPaidForAerosol);

  // Exhaust all charges on `uv-1` -> enters 3.0s blinking depleted state (`ammo === 0`, `depleteTimer === 3.0`)
  const boardWhenDepleted = deployAerosol.updatedPieces.map((p) =>
    p.id === 'uv-1' ? consumeAerosolAmmo(p, p.ammo ?? 10) : p
  );
  // Immediately upon depletion, active count drops back to 2 and replacement cost drops back down!
  assert.equal(countActiveRushBoardWeapons(boardWhenDepleted), 2);
  const costRightWhenDepleted = computeRushDeployCostForBoard(boardWhenDepleted);
  assert.ok(
    costRightWhenDepleted <= costPaidForAerosol,
    `Replacement cost on depletion (${costRightWhenDepleted}) must not exceed original aerosol cost (${costPaidForAerosol})`
  );
  assert.equal(costRightWhenDepleted, costPaidForAerosol);

  // After the 3.0s blink finishes and the aerosol vanishes from the board, replacement cost still never exceeds it
  const boardAfterVanish = boardWhenDepleted.flatMap((p) => {
    if (p.id !== 'uv-1') return [p];
    const ticked = tickDepletingAerosol(p, AEROSOL_DEPLETE_BLINK_SECONDS);
    return ticked.expired ? [] : [ticked.piece];
  });
  assert.equal(boardAfterVanish.length, 2);
  const replacementCost = computeRushDeployCostForBoard(boardAfterVanish);
  assert.ok(
    replacementCost <= costPaidForAerosol,
    `Replacement cost after vanish (${replacementCost}) must not exceed original aerosol cost (${costPaidForAerosol})`
  );
  assert.equal(replacementCost, costPaidForAerosol);

  // Verify replacement aerosol actually deploys cleanly at that stepped-down cost
  const replaceRes = executeRushDropOrMerge(
    boardAfterVanish,
    makePiece('uv-2', 'aerosol_torch', 1, null, null),
    2,
    4,
    2,
    4
  );
  assert.equal(replaceRes.outcome, 'placed');
  assert.equal(countActiveRushBoardWeapons(replaceRes.updatedPieces), 3);
});

test('en 1.000 bandejas aleatorias siempre hay al menos 1 Flus-Flus', () => {
  let seed = 20261111;
  const seededRng = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x100000000;
  };

  // 1) 1,000 random Rush 4-slot trays across all Frenzy tiers (0..300s), random vetoes (even attempting to veto spray_flus),
  // and random active weapon counts (0..7). Also checks cost & level scaling parity!
  const milestonesVariants: string[][] = [[], ['rush_streak_25'], ['rush_streak_25', 'rush_overdrive_4min']];
  const vetoCandidates: UtensilType[][] = [
    [],
    ['spray_flus'], // even if caller tries to veto spray_flus, guarantee must hold!
    ['scourer_nanas', 'mop_vortex'],
    ['spray_flus', 'aerosol_torch', 'soap_bar'],
  ];

  for (let i = 0; i < 1000; i++) {
    const elapsedSeconds = Math.floor(seededRng() * 320);
    const activeBoardWeapons = Math.floor(seededRng() * 8);
    const unlockedMilestones = milestonesVariants[i % milestonesVariants.length];
    const vetoedTypes = vetoCandidates[i % vetoCandidates.length];

    const tray = rollRushTrayBatch({
      elapsedSeconds,
      unlockedMilestones,
      vetoedTypes,
      activeBoardWeapons,
      rng: seededRng,
    });

    assert.equal(tray.length, 4);
    const spraySlots = tray.filter((slot) => slot.type === 'spray_flus');
    assert.ok(
      spraySlots.length >= 1,
      `Rush tray #${i} (t=${elapsedSeconds}s) lacked Flus-Flus: ${tray.map((s) => s.type).join(', ')}`
    );

    // Flus-Flus costs and scales in level identically to any other weapon
    const expectedCost = computeRushEscalatedCost(activeBoardWeapons);
    for (const slot of tray) {
      assert.equal(slot.cost, expectedCost);
      if (elapsedSeconds >= 240) {
        assert.ok(slot.level === 2 || slot.level === 3, 'Overdrive Flus-Flus/slot must scale to Lv.2 or Lv.3');
      }
    }
  }

  // 2) Single-slot live rotation in Rush: when the other 3 slots in tray lack Flus-Flus, 1,000/1,000 rotations roll Flus-Flus
  for (let i = 0; i < 1000; i++) {
    const rotated = rollRushTraySlot(i % 4, {
      elapsedSeconds: Math.floor(seededRng() * 300),
      otherTrayTypes: ['mop_vortex', 'aerosol_torch', 'soap_bar'],
      activeBoardWeapons: i % 6,
      rng: seededRng,
    });
    assert.equal(rotated.type, 'spray_flus');
    assert.equal(rotated.cost, computeRushEscalatedCost(i % 6));
  }

  // 3) Strategic Mode + arbitrary tray invariant across 1,000 trays (campaign levels + randomized trays)
  const nonSprayPool: UtensilType[] = [
    'aerosol_torch',
    'soap_bar',
    'mop_vortex',
    'scourer_nanas',
    'corner_square',
    'wc_shield',
    'bleach_cannon',
  ];
  for (let i = 0; i < 1000; i++) {
    const pieces =
      i < 120
        ? createInitialBoardPieces(i + 1)
        : ensureTrayHasSprayFlus(
            [
              makePiece(`s0-${i}`, nonSprayPool[Math.floor(seededRng() * nonSprayPool.length)], 1, null, null),
              makePiece(`s1-${i}`, nonSprayPool[Math.floor(seededRng() * nonSprayPool.length)], 1, null, null),
              makePiece(`s2-${i}`, nonSprayPool[Math.floor(seededRng() * nonSprayPool.length)], 1, null, null),
              makePiece(`b0-${i}`, 'mop_vortex', 1, 1, 5), // board piece doesn't count as tray
            ],
            seededRng
          );
    const trayPieces = pieces.filter((p) => p.rail === null || p.row === null);
    assert.ok(
      trayPieces.some((p) => p.type === 'spray_flus'),
      `Strategic tray #${i} lacked Flus-Flus`
    );
    // ensureRushTrayHasSprayFlus also guarantees >= 1 spray_flus on any arbitrary Rush piece list
    const rushGuarded = ensureRushTrayHasSprayFlus(
      [
        makePiece(`r0-${i}`, nonSprayPool[Math.floor(seededRng() * nonSprayPool.length)], 1, null, null),
        makePiece(`r1-${i}`, nonSprayPool[Math.floor(seededRng() * nonSprayPool.length)], 2, null, null),
      ],
      seededRng
    );
    assert.ok(rushGuarded.filter((p) => p.rail === null).some((p) => p.type === 'spray_flus'));
  }
});


