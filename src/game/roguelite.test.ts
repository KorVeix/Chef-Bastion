import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildActiveRushPool,
  buildThermalReceipt,
  COMANDA_AUTO_PICK_SECONDS,
  COMANDAS_POOL,
  computeRushDirectorParams,
  executeRushDropOrMerge,
  findSupremeEvolutionPartners,
  formatSurvivalMMSS,
  getChaosDirectorEventForMinute,
  getFrenzyThermometer,
  MERGE_SHOCKWAVE_PUSH_CELLS,
  rollLiveComandaTriplet,
  rollRushTraySlot,
  RUSH_BASE_POOL,
  SUPREME_EVOLUTION_HITSTOP_SECONDS,
} from './roguelite';
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

test('Breathable Rush Opening (first 90s) applies -35% speed and frequency and Comandas give 10s reading window', () => {
  assert.equal(COMANDA_AUTO_PICK_SECONDS, 10.0);

  const early = computeRushDirectorParams(20);
  const postOpening = computeRushDirectorParams(95);
  assert.ok(early.speedMultiplier < postOpening.speedMultiplier);
  assert.ok(early.spawnIntervalSec > postOpening.spawnIntervalSec);

  // At t=0: baseSpeed = 0.92 * 0.65 = 0.598; baseInterval = 1.95 / 0.65 = 3.00s
  const t0 = computeRushDirectorParams(0);
  assert.equal(t0.speedMultiplier, 0.598);
  assert.equal(t0.spawnIntervalSec, 3.0);
});

