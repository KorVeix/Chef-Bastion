import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTION_LOWPASS_HZ,
  PREP_LOWPASS_HZ,
  SLOWMO_LOWPASS_HZ,
  computeDangerLevel,
  computeSemitoneShift,
  computeTargetBpm,
  computeTargetLowPassHz,
  getCycleSectionABAC,
  getEstablishmentHarmony,
} from './musicEngine';
import { DEFAULT_SETTINGS } from './rules';

test('getCycleSectionABAC alternates 4-bar A-B-A-C phrasing cleanly', () => {
  assert.equal(getCycleSectionABAC(0), 'A');
  assert.equal(getCycleSectionABAC(1), 'B');
  assert.equal(getCycleSectionABAC(2), 'A');
  assert.equal(getCycleSectionABAC(3), 'C');
  assert.equal(getCycleSectionABAC(4), 'A');
  assert.equal(getCycleSectionABAC(7), 'C');
});

test('getEstablishmentHarmony shifts harmonic scale identity every 10 levels', () => {
  const est0 = getEstablishmentHarmony(1);
  const est0End = getEstablishmentHarmony(10);
  const est1 = getEstablishmentHarmony(11);
  const est2 = getEstablishmentHarmony(21);
  const est3 = getEstablishmentHarmony(31);
  const est4 = getEstablishmentHarmony(41);
  const est5 = getEstablishmentHarmony(51);

  assert.equal(est0.index, est0End.index);
  const modes = new Set([
    est0.modeName,
    est1.modeName,
    est2.modeName,
    est3.modeName,
    est4.modeName,
    est5.modeName,
  ]);
  assert.equal(modes.size, 6);
});

test('computeTargetLowPassHz applies 450Hz in prep, 12000Hz in action, and 400Hz in Salvada In Extremis & Tactical Slow-Mo', () => {
  // Strategic preparation
  assert.equal(
    computeTargetLowPassHz({
      inPlacementPhase: true,
      lastStandActive: false,
      tacticalSlowMoActive: false,
    }),
    PREP_LOWPASS_HZ
  );
  assert.equal(PREP_LOWPASS_HZ, 450);

  // Live action
  assert.equal(
    computeTargetLowPassHz({
      inPlacementPhase: false,
      lastStandActive: false,
      tacticalSlowMoActive: false,
    }),
    ACTION_LOWPASS_HZ
  );
  assert.equal(ACTION_LOWPASS_HZ, 12000);

  // 1.2s Salvada In Extremis ducks to 400Hz
  assert.equal(
    computeTargetLowPassHz({
      inPlacementPhase: false,
      lastStandActive: true,
      tacticalSlowMoActive: false,
    }),
    SLOWMO_LOWPASS_HZ
  );
  assert.equal(SLOWMO_LOWPASS_HZ, 400);

  // Lifting/moving a piece with Tactical Slow-Mo ON ducks to 400Hz
  assert.equal(
    computeTargetLowPassHz({
      inPlacementPhase: false,
      lastStandActive: false,
      tacticalSlowMoActive: true,
    }),
    400
  );
});

test('computeTargetBpm scales Strategic (112 -> 124 -> 136, +8 critical, +-10% speed) and Rush (126 -> 172)', () => {
  // Strategic Phase 1 -> 2 -> 3
  assert.equal(
    computeTargetBpm({
      gameMode: 'strategic',
      phase: 1,
      hasBoss: false,
      inPlacementPhase: false,
      liveBugCount: 2,
      maxBugYProgress: 2.0,
      rushElapsedSec: 0,
      gameSpeedMultiplier: 1.0,
    }),
    112
  );
  assert.equal(
    computeTargetBpm({
      gameMode: 'strategic',
      phase: 2,
      hasBoss: false,
      inPlacementPhase: false,
      liveBugCount: 3,
      maxBugYProgress: 2.5,
      rushElapsedSec: 0,
      gameSpeedMultiplier: 1.0,
    }),
    124
  );
  assert.equal(
    computeTargetBpm({
      gameMode: 'strategic',
      phase: 3,
      hasBoss: false,
      inPlacementPhase: false,
      liveBugCount: 4,
      maxBugYProgress: 3.0,
      rushElapsedSec: 0,
      gameSpeedMultiplier: 1.0,
    }),
    136
  );

  // +8 BPM in critical zone + 1.25x Turbo (+10%) / 0.75x Relajado (-10%)
  assert.equal(
    computeTargetBpm({
      gameMode: 'strategic',
      phase: 3,
      hasBoss: true,
      inPlacementPhase: false,
      liveBugCount: 3,
      maxBugYProgress: 5.1,
      rushElapsedSec: 0,
      gameSpeedMultiplier: 1.0,
    }),
    144
  );
  assert.equal(
    computeTargetBpm({
      gameMode: 'strategic',
      phase: 1,
      hasBoss: false,
      inPlacementPhase: false,
      liveBugCount: 1,
      maxBugYProgress: 1.5,
      rushElapsedSec: 0,
      gameSpeedMultiplier: 1.25,
    }),
    123.2
  );
  assert.equal(
    computeTargetBpm({
      gameMode: 'strategic',
      phase: 1,
      hasBoss: false,
      inPlacementPhase: false,
      liveBugCount: 1,
      maxBugYProgress: 1.5,
      rushElapsedSec: 0,
      gameSpeedMultiplier: 0.75,
    }),
    100.8
  );

  // Survival Rush: starts at 126 BPM and scales up to 172 BPM
  assert.equal(
    computeTargetBpm({
      gameMode: 'rush',
      phase: 1,
      hasBoss: false,
      inPlacementPhase: false,
      liveBugCount: 2,
      maxBugYProgress: 1.2,
      rushElapsedSec: 0,
      gameSpeedMultiplier: 1.0,
    }),
    126
  );
  assert.equal(
    computeTargetBpm({
      gameMode: 'rush',
      phase: 3,
      hasBoss: true,
      inPlacementPhase: false,
      liveBugCount: 12,
      maxBugYProgress: 5.4,
      rushElapsedSec: 300,
      gameSpeedMultiplier: 1.0,
    }),
    172
  );
});

test('computeDangerLevel scales from 0 in prep to medium and high danger on Phase 3, Boss, or critical proximity', () => {
  assert.equal(
    computeDangerLevel({
      inPlacementPhase: true,
      gameMode: 'strategic',
      phase: 1,
      liveBugCount: 0,
      maxBugYProgress: 0,
      hasBoss: false,
    }),
    0
  );

  const low = computeDangerLevel({
    inPlacementPhase: false,
    gameMode: 'strategic',
    phase: 1,
    liveBugCount: 1,
    maxBugYProgress: 1.1,
    hasBoss: false,
  });
  assert.ok(low > 0 && low < 0.38);

  const med = computeDangerLevel({
    inPlacementPhase: false,
    gameMode: 'strategic',
    phase: 2,
    liveBugCount: 3,
    maxBugYProgress: 2.2,
    hasBoss: false,
  });
  assert.ok(med >= 0.38 && med < 0.68);

  const high = computeDangerLevel({
    inPlacementPhase: false,
    gameMode: 'strategic',
    phase: 1,
    liveBugCount: 2,
    maxBugYProgress: 5.2,
    hasBoss: false,
  });
  assert.ok(high >= 0.8);
});

test('computeSemitoneShift adds +1 semitone per Rush minute and on Grand Boss <= 33% HP, capped at +4', () => {
  assert.equal(
    computeSemitoneShift({ gameMode: 'rush', rushElapsedSec: 0, grandBossFinalPhase: false }),
    0
  );
  assert.equal(
    computeSemitoneShift({ gameMode: 'rush', rushElapsedSec: 61, grandBossFinalPhase: false }),
    1
  );
  assert.equal(
    computeSemitoneShift({ gameMode: 'rush', rushElapsedSec: 125, grandBossFinalPhase: true }),
    3
  );
  assert.equal(
    computeSemitoneShift({ gameMode: 'rush', rushElapsedSec: 400, grandBossFinalPhase: true }),
    4
  );
  assert.equal(
    computeSemitoneShift({ gameMode: 'strategic', rushElapsedSec: 0, grandBossFinalPhase: true }),
    1
  );
});

test('DEFAULT_SETTINGS enables smartComboHints = always and hapticsEnabled = true by default', () => {
  assert.equal(DEFAULT_SETTINGS.smartComboHints, 'always');
  assert.equal(DEFAULT_SETTINGS.hapticsEnabled, true);
});
