import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACHIEVEMENTS_CATALOG,
  ARMORS_CATALOG,
  buildPlacementComboNotification,
  classifyBugElimination,
  checkPhaseTransition,
  computeBossDamageMultiplier,
  computeDragComboPreviewLinks,
  computeSmartComboHints,
  computeWeaponRangeCells,
  createInitialBoardPieces,
  DEFAULT_PROGRESS,
  DEV_UNLOCK_ALL_WORLDS,
  evaluateBoardCombos,
  getBiomeForLevel,
  getBossPuzzleTypeForLevel,
  getBossTierForLevel,
  getGrandBossPhase,
  getLevelForecast,
  getLevelSpeedMultiplier,
  getMaxPiecesForLevel,
  getTacticalOnboardingCard,
  getTutorialGuideForLevel,
  isBiomeTransitionLevel,
  isDynamicOnboardingLevel,
  isWorldUnlocked,
  moveOrSwapUtensil,
  UTENSIL_MICRO_TIPS,
} from './rules';
import { BugEnemy, BugType, UtensilPiece, UtensilType } from './types';

test('evaluateBoardCombos detects Line Foam, Horizontal UV Bridge, Slip Vortex, and Deflect 90 combos', () => {
  const pieces: UtensilPiece[] = [
    {
      id: 'p1',
      type: 'spray_flus',
      level: 1,
      rail: 0,
      row: 4,
      gunkTimer: 0,
      cooldown: 0,
      fireTimer: 0,
      comboType: 'none',
    },
    {
      id: 'p2',
      type: 'scourer_nanas',
      level: 1,
      rail: 0,
      row: 3,
      gunkTimer: 0,
      cooldown: 0,
      fireTimer: 0,
      comboType: 'none',
    },
    {
      id: 'p3',
      type: 'aerosol_torch',
      level: 1,
      rail: 1,
      row: 2,
      gunkTimer: 0,
      cooldown: 0,
      fireTimer: 0,
      comboType: 'none',
    },
    {
      id: 'p4',
      type: 'aerosol_torch',
      level: 1,
      rail: 2,
      row: 2,
      gunkTimer: 0,
      cooldown: 0,
      fireTimer: 0,
      comboType: 'none',
    },
    {
      id: 'p5',
      type: 'soap_bar',
      level: 1,
      rail: 2,
      row: 1,
      gunkTimer: 0,
      cooldown: 0,
      fireTimer: 0,
      comboType: 'none',
    },
    {
      id: 'p6',
      type: 'mop_vortex',
      level: 1,
      rail: 3,
      row: 1,
      gunkTimer: 0,
      cooldown: 0,
      fireTimer: 0,
      comboType: 'none',
    },
    {
      id: 'p7',
      type: 'corner_square',
      level: 1,
      rail: 0,
      row: 2,
      gunkTimer: 0,
      cooldown: 0,
      fireTimer: 0,
      comboType: 'none',
    },
  ];

  const { updatedPieces, links } = evaluateBoardCombos(pieces);
  assert.equal(updatedPieces.find((p) => p.id === 'p1')?.comboType, 'line_foam');
  assert.equal(updatedPieces.find((p) => p.id === 'p2')?.comboType, 'line_foam');
  assert.equal(updatedPieces.find((p) => p.id === 'p3')?.comboType, 'bridge_uv');
  assert.equal(updatedPieces.find((p) => p.id === 'p4')?.comboType, 'bridge_uv');
  assert.equal(updatedPieces.find((p) => p.id === 'p5')?.comboType, 'slip_vortex');
  assert.equal(updatedPieces.find((p) => p.id === 'p6')?.comboType, 'slip_vortex');
  assert.equal(updatedPieces.find((p) => p.id === 'p7')?.comboType, 'deflect_90');
  assert.equal(links.length, 4);
});

test('createInitialBoardPieces starts 100% empty on the countertop (all pieces inTray) and moveOrSwapUtensil enforces MIN_PLACEABLE_ROW >= 2', () => {
  const initial = createInitialBoardPieces(1);
  assert.equal(initial.length, 2);
  assert.ok(initial.every((p) => p.rail === null && p.row === null));

  const first = initial[0];
  const second = initial[1];

  // Placing on row 0 or row 1 (Filas 1 y 2) must be rejected
  const rejected = moveOrSwapUtensil(initial, first.id, 1, 0);
  assert.equal(rejected.find((p) => p.id === first.id)?.rail, null);

  // Place first on (rail 1, row 2) and second on (rail 1, row 4) -> Line Foam Combo!
  const step1 = moveOrSwapUtensil(initial, first.id, 1, 2);
  const step2 = moveOrSwapUtensil(step1, second.id, 1, 4);
  assert.equal(step2.find((p) => p.id === first.id)?.comboType, 'line_foam');
  assert.equal(step2.find((p) => p.id === second.id)?.comboType, 'line_foam');

  // Direct swap between two occupied valid cells and clear gunkTimer
  step2[0].gunkTimer = 3.5;
  const afterSwap = moveOrSwapUtensil(step2, first.id, 1, 4);
  assert.equal(afterSwap.find((p) => p.id === first.id)?.row, 4);
  assert.equal(afterSwap.find((p) => p.id === first.id)?.gunkTimer, 0);
  assert.equal(afterSwap.find((p) => p.id === second.id)?.row, 2);
});

test('progressive onboarding loadouts give 2 pieces on L1, 3 on L2, 3 on L3, 4 on L4, 3 on L31 (with corner_square), and -45% speed (0.55x) on L1-4', () => {
  assert.equal(createInitialBoardPieces(1).length, 2);
  assert.equal(createInitialBoardPieces(2).length, 3);
  assert.equal(createInitialBoardPieces(3).length, 3);
  assert.equal(createInitialBoardPieces(4).length, 4);
  const lvl31 = createInitialBoardPieces(31);
  assert.equal(lvl31.length, 3);
  assert.ok(lvl31.some((p) => p.type === 'corner_square'));
  assert.equal(getMaxPiecesForLevel(1), 2);
  assert.equal(getMaxPiecesForLevel(2), 3);
  assert.equal(getMaxPiecesForLevel(3), 3);
  assert.equal(getMaxPiecesForLevel(4), 4);
  assert.equal(getMaxPiecesForLevel(31), 3);
  assert.equal(getLevelSpeedMultiplier(1), 0.55);
  assert.equal(getLevelSpeedMultiplier(4), 0.55);
});

test('BiomeProgressionManager follows floor((currentLevel - 1) / 19) across 5 biomes and loops at Level 96+ with +10% speed', () => {
  const b1 = getBiomeForLevel(1);
  assert.equal(b1.biomeIndex, 0);
  assert.equal(b1.id, 'main_kitchen');
  assert.equal(b1.friction, 1.0);
  assert.equal(isBiomeTransitionLevel(1), true);
  assert.equal(isBiomeTransitionLevel(19), false);

  const b20 = getBiomeForLevel(20);
  assert.equal(b20.biomeIndex, 1);
  assert.equal(b20.id, 'dining_hall');
  assert.equal(b20.friction, 1.4);
  assert.equal(isBiomeTransitionLevel(20), true);

  const b39 = getBiomeForLevel(39);
  assert.equal(b39.biomeIndex, 2);
  assert.equal(b39.id, 'tavern_bar');
  assert.equal(b39.friction, 0.35);
  assert.equal(b39.bounciness, 0.6);
  assert.equal(isBiomeTransitionLevel(39), true);

  const b58 = getBiomeForLevel(58);
  assert.equal(b58.biomeIndex, 3);
  assert.equal(b58.id, 'freezer_vault');
  assert.equal(b58.friction, 0.08);
  assert.equal(isBiomeTransitionLevel(58), true);

  const b77 = getBiomeForLevel(77);
  assert.equal(b77.biomeIndex, 4);
  assert.equal(b77.id, 'rooftop_terrace');
  assert.equal(b77.bounciness, 0.85);
  assert.equal(isBiomeTransitionLevel(77), true);

  const b96 = getBiomeForLevel(96);
  assert.equal(b96.rawBiomeIndex, 5);
  assert.equal(b96.biomeIndex, 0);
  assert.equal(b96.cycleCount, 1);
  assert.equal(b96.cycleSpeedMultiplier, 1.1);
  assert.equal(isBiomeTransitionLevel(96), true);
});

test('computeSmartComboHints suggests neighbor cells when 1 Aerosol UV or 1 Estropajo is placed solo', () => {
  const lvl2Pieces = createInitialBoardPieces(2);
  const afterOneAerosol = moveOrSwapUtensil(lvl2Pieces, 'u-aerosol-1', 1, 2);
  const hints = computeSmartComboHints(afterOneAerosol);
  assert.ok(hints.length >= 2);
  assert.ok(hints.some((h) => h.rail === 0 && h.row === 2 && h.pieceType === 'aerosol_torch'));
  assert.ok(hints.some((h) => h.rail === 2 && h.row === 2 && h.pieceType === 'aerosol_torch'));

  const lvl1Pieces = createInitialBoardPieces(1);
  const afterOneScourer = moveOrSwapUtensil(lvl1Pieces, 'u-scourer-1', 1, 2);
  const scourerHints = computeSmartComboHints(afterOneScourer, 1);
  assert.ok(scourerHints.some((h) => h.rail === 1 && h.row === 3 && h.pieceType === 'spray_flus'));
  assert.ok(scourerHints.some((h) => h.rail === 1 && h.row === 4 && h.pieceType === 'spray_flus'));

  // On non-onboarding levels (e.g. Level 8), smart combo hints stay silent
  assert.equal(computeSmartComboHints(afterOneAerosol, 8).length, 0);
});

test('getTacticalOnboardingCard and getTutorialGuideForLevel support Levels 1, 2, 3, and 31', () => {
  assert.ok(getTacticalOnboardingCard(1) !== null);
  assert.ok(getTacticalOnboardingCard(2) !== null);
  assert.ok(getTacticalOnboardingCard(3) !== null);
  assert.ok(getTacticalOnboardingCard(31) !== null);
  assert.equal(getTacticalOnboardingCard(5), null);

  const g31 = getTutorialGuideForLevel(31, createInitialBoardPieces(31));
  assert.ok(g31 !== null);
  assert.equal(g31?.nextTarget?.pieceType, 'corner_square');

  assert.equal(getBossPuzzleTypeForLevel(5), 'soap_stun');
  assert.equal(getBossPuzzleTypeForLevel(10), 'uv_overheat');
  assert.equal(getBossPuzzleTypeForLevel(35), 'square_deflect');
});

test('classifyBugElimination awards 1★, 2★, and 3★ accurately including corner_square redirection', () => {
  const baseBug: BugEnemy = {
    id: 'b1',
    type: 'cap_beetle',
    rail: 1,
    targetRail: 1,
    yProgress: 2.5,
    hp: 0,
    maxHp: 100,
    hasShield: false,
    isSlidingFromSoap: true,
    hitByDiagonalFoam: false,
    hitByBridgeBurn: false,
    hitByVortexSpin: true,
    slowTimer: 0,
    flashTimer: 0,
    attackWindup: 0,
    koTimer: 0.4,
    koStar: 1,
  };

  const res3 = classifyBugElimination(baseBug);
  assert.equal(res3.stars, 3);
  assert.equal(res3.achievementId, 'beetle_3star');

  const resSquare3 = classifyBugElimination({
    ...baseBug,
    isSlidingFromSoap: false,
    hitByVortexSpin: false,
    redirectedBySquare: true,
    hitByDiagonalFoam: true,
  });
  assert.equal(resSquare3.stars, 3);
});

test('checkPhaseTransition advances phases without dumping random weapons on onboarding levels 1-4 and 31', () => {
  const p1 = checkPhaseTransition(1, 3, 1);
  assert.equal(p1.shouldAdvance, true);
  assert.equal(p1.nextPhase, 2);
  assert.equal(p1.unlockedUtensilOnAdvance, null);

  const p31 = checkPhaseTransition(1, 3, 31);
  assert.equal(p31.shouldAdvance, true);
  assert.equal(p31.unlockedUtensilOnAdvance, null);
});

test('buildPlacementComboNotification returns floating combo metadata when a combo is connected', () => {
  const initial = createInitialBoardPieces(1);
  const step1 = moveOrSwapUtensil(initial, initial[0].id, 1, 2);
  assert.equal(buildPlacementComboNotification(step1, initial[0].id), null);

  const step2 = moveOrSwapUtensil(step1, initial[1].id, 1, 4);
  const notif = buildPlacementComboNotification(step2, initial[1].id, 0);
  assert.ok(notif !== null);
  assert.equal(notif.label, '¡Combo x2!');
  assert.equal(notif.comboType, 'line_foam');
  assert.equal(notif.color, 'green');
});

test('isDynamicOnboardingLevel is active ONLY on Levels 1-3 and tutorial targets carry minimal shortTag', () => {
  assert.equal(isDynamicOnboardingLevel(1), true);
  assert.equal(isDynamicOnboardingLevel(2), true);
  assert.equal(isDynamicOnboardingLevel(3), true);
  assert.equal(isDynamicOnboardingLevel(4), false);
  assert.equal(isDynamicOnboardingLevel(5), false);
  assert.equal(isDynamicOnboardingLevel(31), false);

  const l1Init = createInitialBoardPieces(1);
  const g1Step1 = getTutorialGuideForLevel(1, l1Init);
  assert.equal(g1Step1?.nextTarget?.shortTag, '🧽 ESTROPAJO');
  const g1Step2 = getTutorialGuideForLevel(1, moveOrSwapUtensil(l1Init, 'u-scourer-1', 1, 2));
  assert.equal(g1Step2?.nextTarget?.shortTag, '🫧 ABANICO ×5');

  const l2Init = createInitialBoardPieces(2);
  const g2Step1 = getTutorialGuideForLevel(2, l2Init);
  assert.equal(g2Step1?.nextTarget?.shortTag, '⚡ 1º LÁSER UV');
  const g2Step2 = getTutorialGuideForLevel(2, moveOrSwapUtensil(l2Init, 'u-aerosol-1', 1, 2));
  assert.equal(g2Step2?.nextTarget?.shortTag, '⚡ PUENTE UV');
});

test('UTENSIL_MICRO_TIPS summarizes every utensil in maximum 4 words for 350ms long-press', () => {
  const types = Object.keys(UTENSIL_MICRO_TIPS) as UtensilType[];
  assert.equal(types.length, 8);
  for (const t of types) {
    const words = UTENSIL_MICRO_TIPS[t].trim().split(/\s+/);
    assert.ok(words.length >= 1 && words.length <= 4, `${t} exceeded 4 words: ${UTENSIL_MICRO_TIPS[t]}`);
  }
});

test('Parity check: ACHIEVEMENTS_CATALOG covers all 5 bug types, unlocks bucket_helmet & baking_volcano, and aligns hazmat_epi', () => {
  const allBugs: BugType[] = ['speed_ant', 'cap_beetle', 'acid_wasp', 'shift_roach', 'king_crab'];
  for (const b of allBugs) {
    assert.ok(ACHIEVEMENTS_CATALOG.some((a) => a.bugType === b), `Missing album page for ${b}`);
  }

  const bucketAch = ACHIEVEMENTS_CATALOG.find((a) => a.rewardId === 'bucket_helmet');
  const volcanoAch = ACHIEVEMENTS_CATALOG.find((a) => a.rewardId === 'baking_volcano');
  const hazmatAch = ACHIEVEMENTS_CATALOG.find((a) => a.rewardId === 'hazmat_epi');
  assert.ok(bucketAch && bucketAch.bugType === 'speed_ant');
  assert.ok(volcanoAch && volcanoAch.bugType === 'shift_roach');
  assert.ok(hazmatAch && hazmatAch.rewardLabel.includes(ARMORS_CATALOG.hazmat_epi.bonus));

  // Verify classifyBugElimination maps speed_ant 2★ -> ant_2star and shift_roach 3★ -> roach_3star
  const baseBug: BugEnemy = {
    id: 'b-parity',
    type: 'speed_ant',
    rail: 1,
    targetRail: 1,
    yProgress: 3,
    hp: 0,
    maxHp: 30,
    hasShield: false,
    isSlidingFromSoap: false,
    hitByDiagonalFoam: true,
    hitByBridgeBurn: false,
    hitByVortexSpin: false,
    slowTimer: 0,
    flashTimer: 0,
    attackWindup: 0,
    koTimer: 0.4,
    koStar: 2,
  };
  assert.equal(classifyBugElimination(baseBug).achievementId, 'ant_2star');
  assert.equal(
    classifyBugElimination({
      ...baseBug,
      type: 'shift_roach',
      isSlidingFromSoap: true,
      hitByVortexSpin: true,
    }).achievementId,
    'roach_3star'
  );
});

test('World unlock parity: DEV_UNLOCK_ALL_WORLDS is false and worlds 2-4 stay locked at Level 1 until real progression', () => {
  assert.equal(DEV_UNLOCK_ALL_WORLDS, false);
  assert.equal(isWorldUnlocked('sunny_counter', DEFAULT_PROGRESS), true);
  assert.equal(isWorldUnlocked('fridge_vault', DEFAULT_PROGRESS), false);
  assert.equal(isWorldUnlocked('iron_stoves', DEFAULT_PROGRESS), false);
  assert.equal(isWorldUnlocked('pastry_marble', DEFAULT_PROGRESS), false);

  assert.equal(
    isWorldUnlocked('fridge_vault', { ...DEFAULT_PROGRESS, highestLevel: 11 }),
    true
  );
  assert.equal(
    isWorldUnlocked('iron_stoves', { ...DEFAULT_PROGRESS, highestLevel: 21 }),
    true
  );
  assert.equal(
    isWorldUnlocked('pastry_marble', { ...DEFAULT_PROGRESS, highestLevel: 31 }),
    true
  );
});

test('computeWeaponRangeCells, computeDragComboPreviewLinks, and getLevelForecast compute accurate tactical previews', () => {
  const lvl2 = createInitialBoardPieces(2);
  const placedFirst = moveOrSwapUtensil(lvl2, 'u-aerosol-1', 1, 2);

  // Dragging 2nd Aerosol UV over adjacent cell (rail 2, row 2) previews bridge_uv BEFORE release!
  const previewLinks = computeDragComboPreviewLinks(placedFirst, 'u-aerosol-2', 2, 2);
  assert.equal(previewLinks.length, 1);
  assert.equal(previewLinks[0].kind, 'bridge_uv');

  // Invalid row (< MIN_PLACEABLE_ROW) produces zero preview links
  assert.equal(computeDragComboPreviewLinks(placedFirst, 'u-aerosol-2', 2, 1).length, 0);

  // Range cells for spray_flus fire forward toward row 0
  const sprayRange = computeWeaponRangeCells('spray_flus', 1, 4, placedFirst);
  assert.ok(sprayRange.some((c) => c.rail === 1 && c.row === 3 && c.role === 'damage'));
  assert.ok(sprayRange.some((c) => c.rail === 1 && c.row === 0 && c.role === 'damage'));

  // Forecast on Level 10 includes Grand Boss, Level 15 includes Mini-Boss, Level 35 includes Lateral conduits
  assert.equal(getLevelForecast(10).bossTier, 'grand');
  assert.equal(getLevelForecast(15).bossTier, 'mini');
  assert.equal(getLevelForecast(35).hasLateralConduits, true);
});

test('Boss Architecture: X5 Mini-Bosses and X0 3-Phase Grand Bosses enforce 66%/33% thresholds with zero hard-locks', () => {
  assert.equal(getBossTierForLevel(4), null);
  assert.equal(getBossTierForLevel(5), 'mini');
  assert.equal(getBossTierForLevel(10), 'grand');
  assert.equal(getBossTierForLevel(15), 'mini');
  assert.equal(getBossTierForLevel(20), 'grand');
  assert.equal(getBossTierForLevel(60), 'grand');

  // Phase thresholds: 100-67% -> P1, 66-34% -> P2, 33-0% -> P3
  assert.equal(getGrandBossPhase(100, 100), 1);
  assert.equal(getGrandBossPhase(67, 100), 1);
  assert.equal(getGrandBossPhase(66, 100), 2);
  assert.equal(getGrandBossPhase(34, 100), 2);
  assert.equal(getGrandBossPhase(33, 100), 3);
  assert.equal(getGrandBossPhase(5, 100), 3);

  // Non-rigid damage: basic frontal in Phase 1 deals 0.35x (-65%, NEVER 0), while UV/explosive deals 2.5x
  assert.equal(
    computeBossDamageMultiplier({
      tier: 'grand',
      phase: 1,
      armorBroken: false,
      isThermalOrExplosive: false,
      isControlCombo: false,
    }),
    0.35
  );
  assert.equal(
    computeBossDamageMultiplier({
      tier: 'grand',
      phase: 1,
      armorBroken: false,
      isThermalOrExplosive: true,
      isControlCombo: false,
    }),
    2.5
  );
  assert.ok(
    computeBossDamageMultiplier({
      tier: 'grand',
      phase: 2,
      armorBroken: true,
      isThermalOrExplosive: false,
      isControlCombo: true,
    }) > 1.0
  );
  assert.ok(
    computeBossDamageMultiplier({
      tier: 'grand',
      phase: 3,
      armorBroken: true,
      isThermalOrExplosive: false,
      isControlCombo: false,
    }) > 0
  );
});

