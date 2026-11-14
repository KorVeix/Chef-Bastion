import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACHIEVEMENTS_CATALOG,
  applyPhysicalKnockback,
  ARMORS_CATALOG,
  BOSS_PHASE_BREAK_FLASH_SECONDS,
  BOSS_PHASE_BREAK_HITSTOP_SECONDS,
  buildPlacementComboNotification,
  CHEF_WHIP_COOLDOWN,
  CHEF_WHIP_PUSH_CELLS,
  CHEF_WHIP_STUN_SECONDS,
  classifyBugElimination,
  checkPhaseTransition,
  combineActiveTimeScales,
  computeBoardPartnerHighlights,
  computeBossDamageMultiplier,
  computeConductiveUvChainTargets,
  computeDragComboPreviewLinks,
  computeKitchenUpgradeEffects,
  computeLiveMenuBuffs,
  computeResponsiveCameraParams,
  computeSmartComboHints,
  computeStrategicMatchCoins,
  computeStreakMilestoneReward,
  computeThermalParticleBudgetFactor,
  computeThermalShockResult,
  computeVipVictoryCoins,
  computeWeaponRangeCells,
  createInitialBoardPieces,
  DEFAULT_PROGRESS,
  DEFAULT_SETTINGS,
  DEV_UNLOCK_ALL_WORLDS,
  evaluateBoardCombos,
  exportProgressToBase64,
  formatDefeatNearMissCopy,
  getBiomeForLevel,
  getBossPuzzleTypeForLevel,
  getBossTierForLevel,
  getGrandBossPhase,
  getLevelForecast,
  getLevelSpeedMultiplier,
  getMaxPiecesForLevel,
  getTacticalInspectorCard,
  getTacticalOnboardingCard,
  getTutorialGuideForLevel,
  groupTrayPiecesForDisplay,
  hasRemainingShopUnlocks,
  HATS_CATALOG,
  HEAVY_IMPACT_HITSTOP_SECONDS,
  importProgressFromBase64,
  isAchievementPurchasableWithCoins,
  isBiomeTransitionLevel,
  isDynamicOnboardingLevel,
  isWorldUnlocked,
  MAX_FLOATING_COMBO_POOL,
  moveOrSwapUtensil,
  purchaseKitchenUpgrade,
  pushFloatingComboNonOverlapping,
  resolveAndroidBackAction,
  shouldRecommendStrategicFirst,
  TILE_TRAIL_DURATION,
  UTENSIL_MICRO_TIPS,
  UTENSIL_ROLE_TAGS,
} from './rules';
import { soundEngine } from './audio';
import { detectNativeOrStandaloneRuntime } from '../hooks/usePWAInstall';
import { BugEnemy, BugType, FloatingComboEvent, TileChemicalState, UtensilPiece, UtensilType } from './types';

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

test('progressive onboarding loadouts follow the level scripts (L1-2 fan, L3-4 fan + UV bridge), 3 on L31 (with corner_square), and -45% speed (0.55x) on L1-4', () => {
  assert.equal(createInitialBoardPieces(1).length, 2);
  assert.deepEqual(
    createInitialBoardPieces(2).map((p) => p.type).sort(),
    ['scourer_nanas', 'spray_flus']
  );
  assert.equal(createInitialBoardPieces(3).length, 4);
  assert.equal(createInitialBoardPieces(3).filter((p) => p.type === 'aerosol_torch').length, 2);
  assert.equal(createInitialBoardPieces(4).length, 4);
  const lvl31 = createInitialBoardPieces(31);
  assert.equal(lvl31.length, 3);
  assert.ok(lvl31.some((p) => p.type === 'corner_square'));
  assert.equal(getMaxPiecesForLevel(1), 2);
  assert.equal(getMaxPiecesForLevel(2), 2);
  assert.equal(getMaxPiecesForLevel(3), 4);
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
  const lvl3Pieces = createInitialBoardPieces(3);
  const afterOneAerosol = moveOrSwapUtensil(lvl3Pieces, 'u-aerosol-1', 1, 2);
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

test('getTacticalOnboardingCard and getTutorialGuideForLevel follow the mechanic each level teaches (1 fan, 3 UV bridge, 31 square)', () => {
  assert.ok(getTacticalOnboardingCard(1) !== null);
  assert.equal(getTacticalOnboardingCard(2), null);
  assert.ok(getTacticalOnboardingCard(3)?.badge.includes('PUENTE'));
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
  const g1Step2 = getTutorialGuideForLevel(1, moveOrSwapUtensil(l1Init, 'u-scourer-1', 1, 3));
  assert.equal(g1Step2?.nextTarget?.shortTag, '🫧 ABANICO ×5');
  const g1Done = getTutorialGuideForLevel(
    1,
    moveOrSwapUtensil(moveOrSwapUtensil(l1Init, 'u-scourer-1', 1, 3), 'u-spray-1', 1, 4)
  );
  assert.equal(g1Done?.nextTarget, null);
  assert.equal(g1Done?.allTargetsPlaced, true);

  assert.equal(getTutorialGuideForLevel(2, createInitialBoardPieces(2)), null);
  const l3Init = createInitialBoardPieces(3);
  assert.equal(getTutorialGuideForLevel(3, l3Init)?.nextTarget?.shortTag, '🧽 ESTROPAJO');
  const l3Fan = moveOrSwapUtensil(moveOrSwapUtensil(l3Init, 'u-scourer-1', 1, 3), 'u-spray-1', 1, 5);
  assert.equal(getTutorialGuideForLevel(3, l3Fan)?.nextTarget?.shortTag, '⚡ 1º LÁSER UV');
  const g3Step2 = getTutorialGuideForLevel(3, moveOrSwapUtensil(l3Fan, 'u-aerosol-1', 2, 2));
  assert.equal(g3Step2?.nextTarget?.shortTag, '⚡ PUENTE UV');
  assert.equal(g3Step2?.nextTarget?.rail, 3);
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
  const lvl3 = createInitialBoardPieces(3);
  const placedFirst = moveOrSwapUtensil(lvl3, 'u-aerosol-1', 1, 2);

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

test('Emergent Chemistry & Knockback: 4s trails, Conductive UV chain across wet cells, Thermal Shock +50% carapace + shrapnel, and 1-cell Knockback', () => {
  assert.equal(TILE_TRAIL_DURATION, 4.0);

  const makeBug = (id: string, rail: number, yProgress: number, overrides: Partial<BugEnemy> = {}): BugEnemy => ({
    id,
    type: 'speed_ant',
    rail,
    targetRail: rail,
    yProgress,
    hp: 60,
    maxHp: 60,
    hasShield: false,
    isSlidingFromSoap: false,
    hitByDiagonalFoam: false,
    hitByBridgeBurn: false,
    hitByVortexSpin: false,
    slowTimer: 0,
    flashTimer: 0,
    attackWindup: 0,
    koTimer: 0,
    koStar: 1,
    ...overrides,
  });

  // 1. Conductive UV chain across contiguous wet_soap tiles (skips dry isolated bugs)
  const bSrc = makeBug('b-src', 1, 2, { wetTimer: 3.0 });
  const bWetChain = makeBug('b-wet-2', 2, 3);
  const bDryFar = makeBug('b-dry-far', 0, 5);
  const chemTiles: TileChemicalState[] = [
    { rail: 2, row: 2, kind: 'wet_soap', timer: 4.0 },
    { rail: 2, row: 3, kind: 'wet_soap', timer: 3.5 },
  ];
  const chainIds = computeConductiveUvChainTargets('b-src', [bSrc, bWetChain, bDryFar], chemTiles);
  assert.deepEqual(chainIds, ['b-wet-2']);

  // 2. Thermal Shock ("Choque Térmico"): slowed/chilled bug hit by thermal/UV breaks +50% extra carapace & blasts 1-cell shrapnel
  const chilledBeetle = makeBug('b-chilled', 1, 3, {
    type: 'cap_beetle',
    hp: 100,
    maxHp: 100,
    slowTimer: 1.5,
  });
  const nearbyAnt = makeBug('b-near', 2, 3);
  const distantAnt = makeBug('b-far', 3, 6);
  const shock = computeThermalShockResult(chilledBeetle, [chilledBeetle, nearbyAnt, distantAnt], false);
  assert.equal(shock.triggered, true);
  assert.equal(shock.bonusCarapaceDamage, 50);
  assert.deepEqual(shock.shrapnelTargetIds, ['b-near']);

  // 3. Physical Knockback: light/medium bugs pushed 1 cell back (e.g. re-entering UV Bridge), Grand Boss resists
  const pushed = applyPhysicalKnockback(makeBug('b-push', 1, 3.2), {
    pushCells: 1.0,
    deflectToNeighbor: true,
  });
  assert.equal(pushed.applied, true);
  assert.equal(pushed.nextYProgress, 2.2);
  assert.equal(pushed.nextTargetRail, 2);

  const grandBoss = makeBug('b-grand', 1, 3.0, { bossTier: 'grand' });
  assert.equal(applyPhysicalKnockback(grandBoss).applied, false);
});

test('Menú Vivo & Plato VIP: 4 independent passive plate buffs deactivate when devoured and VIP plate doubles victory coins', () => {
  const allIntact = computeLiveMenuBuffs([true, true, true, true]);
  assert.equal(allIntact.thermalRateMult, 1.15);
  assert.equal(allIntact.controlDurationMult, 1.15);
  assert.equal(allIntact.frontalDamageMult, 1.15);
  assert.equal(allIntact.ultChargeMult, 1.2);

  const pizzaAndDessertEaten = computeLiveMenuBuffs([false, true, true, false]);
  assert.equal(pizzaAndDessertEaten.thermalRateMult, 1.0);
  assert.equal(pizzaAndDessertEaten.controlDurationMult, 1.15);
  assert.equal(pizzaAndDessertEaten.frontalDamageMult, 1.15);
  assert.equal(pizzaAndDessertEaten.ultChargeMult, 1.0);

  // Level 6+ VIP Critic Plate doubles coins ONLY if that specific plate survives intact
  assert.deepEqual(computeVipVictoryCoins(120, 2, [false, false, true, false]), {
    coinsEarned: 240,
    vipSaved: true,
  });
  assert.deepEqual(computeVipVictoryCoins(120, 2, [true, true, false, true]), {
    coinsEarned: 120,
    vipSaved: false,
  });
  assert.deepEqual(computeVipVictoryCoins(120, null, [true, true, true, true]), {
    coinsEarned: 120,
    vipSaved: false,
  });
});

test('TimeScale Safeguards, Active Chef Constants & Boss Phase Hitstop: Math.min prevents 0.20x * 0.35x multiplication and Boss freeze is 60ms', () => {
  assert.equal(CHEF_WHIP_COOLDOWN, 18.0);
  assert.equal(CHEF_WHIP_PUSH_CELLS, 2.0);
  assert.equal(CHEF_WHIP_STUN_SECONDS, 1.0);
  assert.equal(BOSS_PHASE_BREAK_HITSTOP_SECONDS, 0.06);
  assert.equal(BOSS_PHASE_BREAK_FLASH_SECONDS, 0.30);

  // Both Tactical Slow-Mo (0.20x) and Salvada In Extremis (0.35x) active -> Math.min = 0.20 (NEVER 0.07!)
  const combined = combineActiveTimeScales(1.0, {
    isPlaying: true,
    hitstopActive: false,
    tacticalSlowMoActive: true,
    lastStandActive: true,
  });
  assert.equal(combined, 0.2);

  const lastStandOnly = combineActiveTimeScales(1.0, {
    isPlaying: true,
    hitstopActive: false,
    tacticalSlowMoActive: false,
    lastStandActive: true,
  });
  assert.equal(lastStandOnly, 0.35);
});

test('Pentatonic Audio SFX: chaining kills < 1.2s apart ascends pentatonic scale and >= 1.2s resets to root note', () => {
  soundEngine.resetKillChain();
  const k0 = soundEngine.registerKillChainStep(1000);
  const k1 = soundEngine.registerKillChainStep(1800); // +800ms (< 1200ms)
  const k2 = soundEngine.registerKillChainStep(2950); // +1150ms (< 1200ms)
  assert.equal(k0.step, 0);
  assert.equal(k1.step, 1);
  assert.equal(k2.step, 2);
  assert.ok(k2.freqHz > k1.freqHz && k1.freqHz > k0.freqHz);

  // Waiting >= 1200ms resets back to root note (step 0)
  const kReset = soundEngine.registerKillChainStep(4200); // +1250ms (>= 1200ms)
  assert.equal(kReset.step, 0);
  assert.equal(kReset.freqHz, k0.freqHz);
});

test('Tanda 4 UI/UX & Economy: tray weapon stacking (x2/x3), coin-reward shop guard, Roomba world-unlock decoupling, classic_toque +10% 4-plate perk, and singular/plural defeat copy', () => {
  // 1. Stacked tray groups identical unplaced weapons and decrements count on placement
  const lvl2Pieces = createInitialBoardPieces(3); // 2x aerosol_torch + Estropajo + Flus-Flus
  const initialGroups = groupTrayPiecesForDisplay(lvl2Pieces);
  assert.equal(initialGroups.length, 3);
  const aerosolGroup = initialGroups.find((g) => g.representative.type === 'aerosol_torch');
  assert.ok(aerosolGroup);
  assert.equal(aerosolGroup.count, 2);

  const afterOnePlaced = moveOrSwapUtensil(lvl2Pieces, aerosolGroup.pieces[0].id, 1, 2);
  const groupsAfterOne = groupTrayPiecesForDisplay(afterOnePlaced);
  assert.equal(
    groupsAfterOne.find((g) => g.representative.type === 'aerosol_torch')?.count,
    1
  );

  // 2. Coin-reward achievements cannot be bought with coins (prevents 100 -> +150 arbitrage)
  const beetle1Star = ACHIEVEMENTS_CATALOG.find((a) => a.id === 'beetle_1star');
  const beetle3Star = ACHIEVEMENTS_CATALOG.find((a) => a.id === 'beetle_3star');
  assert.ok(beetle1Star && beetle3Star);
  assert.equal(isAchievementPurchasableWithCoins(beetle1Star), false);
  assert.equal(isAchievementPurchasableWithCoins(beetle3Star), true);
  assert.equal(beetle3Star.rewardLabel.includes('Mundo Nevera'), false);

  // hasRemainingShopUnlocks ignores coin-only achievements when all equipment achievements are unlocked
  const allEquipIds = ACHIEVEMENTS_CATALOG.filter((a) => a.rewardType !== 'coins').map((a) => a.id);
  assert.equal(hasRemainingShopUnlocks(DEFAULT_PROGRESS), true);
  assert.equal(
    hasRemainingShopUnlocks({ ...DEFAULT_PROGRESS, unlockedAchievements: allEquipIds }),
    false
  );

  // 3. Wardrobe catalog copy & real classic_toque +10% 4-plate victory bonus
  assert.ok(HATS_CATALOG.classic_toque.bonus.includes('+10% Monedas'));
  assert.equal(HATS_CATALOG.duck_shower_cap.name, 'Gorro de Ducha con Patito');
  assert.ok(HATS_CATALOG.bucket_helmet.bonus.includes('-50% duración de pringue ácido'));

  assert.deepEqual(
    computeStrategicMatchCoins({
      victory: true,
      vipSaved: false,
      allFourPlatesIntact: true,
      equippedHat: 'classic_toque',
    }),
    { coinsEarned: 132, classicToqueBonusApplied: true }
  );
  assert.deepEqual(
    computeStrategicMatchCoins({
      victory: true,
      vipSaved: true,
      allFourPlatesIntact: true,
      equippedHat: 'classic_toque',
    }),
    { coinsEarned: 264, classicToqueBonusApplied: true }
  );
  assert.deepEqual(
    computeStrategicMatchCoins({
      victory: true,
      vipSaved: false,
      allFourPlatesIntact: false,
      equippedHat: 'classic_toque',
    }),
    { coinsEarned: 120, classicToqueBonusApplied: false }
  );

  // 4. Defeat near-miss copy handles singular/plural naturally and says "la Fase X/3"
  assert.equal(
    formatDefeatNearMissCopy(1, 2),
    '¡Casi lo logras! Te faltó solo 1 plaga para superar la Fase 2/3.'
  );
  assert.equal(
    formatDefeatNearMissCopy(3, 2),
    '¡Casi lo logras! Te faltaron solo 3 plagas para superar la Fase 2/3.'
  );
});

test('APK Native Runtime Detector: hides PWA install UI in Capacitor, Android/iOS WebViews, and standalone mode', () => {
  assert.equal(
    detectNativeOrStandaloneRuntime({
      protocol: 'https:',
      userAgent:
        'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36',
    }),
    false
  );
  assert.equal(detectNativeOrStandaloneRuntime({ hasCapacitorGlobal: true }), true);
  assert.equal(detectNativeOrStandaloneRuntime({ protocol: 'capacitor:' }), true);
  assert.equal(detectNativeOrStandaloneRuntime({ displayModeStandalone: true }), true);
  assert.equal(
    detectNativeOrStandaloneRuntime({
      protocol: 'https:',
      userAgent:
        'Mozilla/5.0 (Linux; Android 14; SM-S928B Build/UP1A; wv) AppleWebKit/537.36 Version/4.0 Chrome/126.0 Mobile Safari/537.36',
    }),
    true
  );
  assert.equal(
    detectNativeOrStandaloneRuntime({
      protocol: 'https:',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
    }),
    true
  );
});

test('APK 20:9 Camera, Thermal Particle Budget & Android Back Resolution keep outer plates uncut and intercept Back safely', () => {
  const desktopCam = computeResponsiveCameraParams(1440, 900);
  const narrow20x9 = computeResponsiveCameraParams(384, 854); // aspect = 0.4496 < 0.5
  assert.ok(narrow20x9.aspect < 0.5);
  assert.ok(narrow20x9.fov > desktopCam.fov);
  assert.ok(narrow20x9.camZ > desktopCam.camZ && narrow20x9.camY > desktopCam.camY);

  // Outer plate outer rim (x = 2.80, y = 0.2, z = 4.18) must project inside horizontal frustum (|ndcX| < 0.90) on 20:9!
  const dy = narrow20x9.lookY - narrow20x9.camY;
  const dz = narrow20x9.lookZ - narrow20x9.camZ;
  const len = Math.hypot(dy, dz);
  const fwdY = dy / len;
  const fwdZ = dz / len;
  const relY = 0.2 - narrow20x9.camY;
  const relZ = 4.18 - narrow20x9.camZ;
  const depth = relY * fwdY + relZ * fwdZ;
  const tanHalfVFov = Math.tan((narrow20x9.fov * Math.PI) / 360);
  const halfWidthAtPlate = depth * tanHalfVFov * narrow20x9.aspect;
  const ndcRightEdge = 2.8 / halfWidthAtPlate;
  assert.ok(ndcRightEdge > 0 && ndcRightEdge < 0.9, `Expected outer plate inside frustum, got ${ndcRightEdge}`);

  // Thermal Rush particle budget halves at >24ms and recovers below 19.5ms
  assert.equal(computeThermalParticleBudgetFactor(true, 18.0, false), 1.0);
  assert.equal(computeThermalParticleBudgetFactor(true, 26.5, false), 0.5);
  assert.equal(computeThermalParticleBudgetFactor(true, 21.0, true), 0.5);
  assert.equal(computeThermalParticleBudgetFactor(true, 18.5, true), 1.0);
  assert.equal(computeThermalParticleBudgetFactor(false, 29.0, false), 1.0);

  // Android Back closes open modals first, and pauses gameplay instead of closing APK
  const baseUi = {
    gameState: 'playing' as const,
    showOnboardingModal: false,
    showCodex: false,
    showWardrobe: false,
    showSettings: false,
    showKitchenUpgrades: false,
    showStrategicModal: false,
  };
  assert.equal(resolveAndroidBackAction({ ...baseUi, showSettings: true }), 'close_settings');
  assert.equal(resolveAndroidBackAction({ ...baseUi, showKitchenUpgrades: true }), 'close_upgrades');
  assert.equal(resolveAndroidBackAction(baseUi), 'open_pause');
  assert.equal(resolveAndroidBackAction({ ...baseUi, gameState: 'paused' }), 'resume_from_pause');
  assert.equal(resolveAndroidBackAction({ ...baseUi, gameState: 'title' }), 'noop');
});

test('Game Juice, Kitchen Upgrades (4 passives x 3 levels) & Base64 Progress Backup round-trip + tamper rejection', () => {
  assert.equal(HEAVY_IMPACT_HITSTOP_SECONDS, 0.04);

  // Purchase upgrades up to level 3 and verify effects
  let prog = { ...DEFAULT_PROGRESS, coins: 2000 };
  const step1 = purchaseKitchenUpgrade(prog, 'whipCooldown');
  assert.equal(step1.ok, true);
  assert.equal(step1.newLevel, 1);
  assert.ok(step1.updatedProgress.coins < 2000);

  const step2 = purchaseKitchenUpgrade(step1.updatedProgress, 'whipCooldown');
  const step3 = purchaseKitchenUpgrade(step2.updatedProgress, 'whipCooldown');
  assert.equal(step3.newLevel, 3);
  const step4 = purchaseKitchenUpgrade(step3.updatedProgress, 'whipCooldown');
  assert.equal(step4.ok, false); // capped at 3/3

  prog = purchaseKitchenUpgrade(step3.updatedProgress, 'streakCoinBonus').updatedProgress;
  prog = purchaseKitchenUpgrade(prog, 'ultBaseCharge').updatedProgress;
  prog = purchaseKitchenUpgrade(prog, 'acidResistance').updatedProgress;

  const fx = computeKitchenUpgradeEffects(prog.kitchenUpgrades);
  assert.equal(fx.effectiveWhipCooldownSec, 12.0);
  assert.equal(fx.acidDurationMult, 0.85);
  assert.equal(fx.streakCoinMult, 1.25);
  assert.equal(fx.initialUltimatePct, 57);

  // Streak x8 & x15 coin milestones scale with streakCoinBonus
  const r8 = computeStreakMilestoneReward(7, 8, prog.kitchenUpgrades);
  const r15 = computeStreakMilestoneReward(14, 15, prog.kitchenUpgrades);
  assert.equal(r8.crossedThreshold, 8);
  assert.equal(r8.bonusCoins, Math.round(15 * 1.25));
  assert.equal(r15.crossedThreshold, 15);
  assert.equal(r15.bonusCoins, Math.round(35 * 1.25));
  assert.equal(computeStreakMilestoneReward(8, 9, prog.kitchenUpgrades).crossedThreshold, null);

  // Serverless Base64 Export / Import round-trip + tamper/empty validation
  const customSettings = { ...DEFAULT_SETTINGS, masterVolume: 65, hapticsEnabled: false };
  const code = exportProgressToBase64(prog, customSettings);
  assert.ok(code.startsWith('CB1:'));

  const imported = importProgressFromBase64(code);
  assert.equal(imported.ok, true);
  if (imported.ok) {
    assert.equal(imported.progress.coins, prog.coins);
    assert.deepEqual(imported.progress.kitchenUpgrades, prog.kitchenUpgrades);
    assert.equal(imported.settings?.masterVolume, 65);
    assert.equal(imported.settings?.hapticsEnabled, false);
  }

  assert.equal(importProgressFromBase64('   ').ok, false);
  assert.equal(importProgressFromBase64('INVALID_BASE64').ok, false);
  const tampered = code.slice(0, -3) + (code.endsWith('AAA') ? 'BBB' : 'AAA');
  assert.equal(importProgressFromBase64(tampered).ok, false);
});

test('Comprehension & Anti-Overlap Polish: 0.08x Inspector, 0.20x Comanda Slow-Mo, Strategic-first onboarding, partner rings & non-overlapping floating pool', () => {
  // 1. 0.08x Inspector slow-mo & 0.20x Comanda slow-mo never multiply together
  assert.equal(
    combineActiveTimeScales(1.0, {
      isPlaying: true,
      hitstopActive: false,
      tacticalSlowMoActive: false,
      lastStandActive: false,
      inspectorSlowMoActive: true,
      comandaSlowMoActive: true,
    }),
    0.08
  );
  assert.equal(
    combineActiveTimeScales(1.0, {
      isPlaying: true,
      hitstopActive: false,
      tacticalSlowMoActive: false,
      lastStandActive: true,
      inspectorSlowMoActive: false,
      comandaSlowMoActive: true,
    }),
    0.2
  );

  // 2. Title onboarding recommends Strategic first until player reaches Level 3
  assert.equal(shouldRecommendStrategicFirst({ highestLevel: 1 }), true);
  assert.equal(shouldRecommendStrategicFirst({ highestLevel: 2 }), true);
  assert.equal(shouldRecommendStrategicFirst({ highestLevel: 3 }), false);
  assert.equal(shouldRecommendStrategicFirst({ highestLevel: 12 }), false);

  // 3. Every utensil has a concise tray micro-role tag
  const roleKeys = Object.keys(UTENSIL_ROLE_TAGS) as UtensilType[];
  assert.equal(roleKeys.length, 8);
  for (const k of roleKeys) {
    assert.ok(UTENSIL_ROLE_TAGS[k].length >= 3 && UTENSIL_ROLE_TAGS[k].length <= 14);
  }

  // 4. Tactical Inspector builds plain 2-line cards for weapons, Supreme Evolutions, Plates, and Ultimate
  const boardPieces: UtensilPiece[] = [
    {
      id: 'b-spray-1',
      type: 'spray_flus',
      level: 1,
      rail: 1,
      row: 4,
      gunkTimer: 0,
      cooldown: 0,
      fireTimer: 0,
      comboType: 'none',
    },
    {
      id: 'b-scourer-1',
      type: 'scourer_nanas',
      level: 1,
      rail: 1,
      row: 3,
      gunkTimer: 0,
      cooldown: 0,
      fireTimer: 0,
      comboType: 'none',
    },
    {
      id: 'b-soap-gold',
      type: 'soap_bar',
      level: 3,
      rail: 2,
      row: 4,
      gunkTimer: 0,
      cooldown: 0,
      fireTimer: 0,
      comboType: 'none',
    },
  ];

  const mopCard = getTacticalInspectorCard(
    { kind: 'piece', pieceId: 'tray-mop', pieceType: 'mop_vortex', level: 3 },
    {
      pieces: boardPieces,
      intactPlates: [true, true, false, true],
      vipPlateRail: 0,
      equippedSpecial: 'hydro_blast',
      ultimateCharge: 65,
      isRushMode: true,
    }
  );
  assert.ok(mopCard);
  assert.ok(mopCard.whatItDoes.includes('360°'));
  assert.ok(mopCard.combineOrMerge.includes('Vórtice Centrífugo'));

  const plateCard = getTacticalInspectorCard(
    { kind: 'plate', rail: 0 },
    {
      pieces: boardPieces,
      intactPlates: [true, true, false, true],
      vipPlateRail: 0,
      equippedSpecial: 'hydro_blast',
      ultimateCharge: 65,
      isRushMode: false,
    }
  );
  assert.ok(plateCard && plateCard.title.includes('VIP ×2'));

  const ultCard = getTacticalInspectorCard(
    { kind: 'ultimate' },
    {
      pieces: boardPieces,
      intactPlates: [true, true, true, true],
      vipPlateRail: null,
      equippedSpecial: 'hydro_blast',
      ultimateCharge: 100,
      isRushMode: true,
    }
  );
  assert.ok(ultCard && ultCard.badge.includes('LISTO'));

  // 5. Partner highlight rings detect 'merge', 'evolve', and 'synergy' accurately
  const traySprayLv1 = { id: 'tray-s1', type: 'spray_flus' as const, level: 1 };
  const highlightsRush = computeBoardPartnerHighlights(traySprayLv1, boardPieces, true);
  assert.equal(highlightsRush.find((h) => h.pieceId === 'b-spray-1')?.kind, 'merge');
  assert.equal(highlightsRush.find((h) => h.pieceId === 'b-scourer-1')?.kind, 'synergy');

  const trayMopGold = { id: 'tray-m3', type: 'mop_vortex' as const, level: 3 };
  const evoHighlights = computeBoardPartnerHighlights(trayMopGold, boardPieces, true);
  assert.equal(evoHighlights.find((h) => h.pieceId === 'b-soap-gold')?.kind, 'evolve');

  // 6. Floating combo pool caps at <= 6 and separates vertical Y bands so simultaneous texts never overlap
  assert.equal(MAX_FLOATING_COMBO_POOL, 6);
  let pool: FloatingComboEvent[] = [];
  for (let i = 0; i < 9; i++) {
    pool = pushFloatingComboNonOverlapping(pool, {
      id: `fc-${i}`,
      multiplier: 3,
      label: '+180 · x3',
      detail: '',
      xPct: 50,
      yPct: 45, // intentionally identical input Y to test anti-overlap separation
      color: 'yellow',
      createdAt: 1000 + i,
    });
  }
  assert.equal(pool.length, MAX_FLOATING_COMBO_POOL);
  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      assert.ok(
        Math.abs(pool[i].yPct - pool[j].yPct) >= 1 || pool.length === MAX_FLOATING_COMBO_POOL,
        'Pool items separated across vertical slots'
      );
    }
  }
  // Specifically first 5 items at identical yPct=45 must all get strictly distinct yPct values (>= 7.5% apart)
  let pairPool: FloatingComboEvent[] = [];
  pairPool = pushFloatingComboNonOverlapping(pairPool, {
    id: 'a',
    multiplier: 2,
    label: '+120 · x2',
    detail: '',
    xPct: 50,
    yPct: 45,
    color: 'cyan',
    createdAt: 2000,
  });
  pairPool = pushFloatingComboNonOverlapping(pairPool, {
    id: 'b',
    multiplier: 4,
    label: '+240 · x4',
    detail: '',
    xPct: 50,
    yPct: 45,
    color: 'yellow',
    createdAt: 2001,
  });
  assert.ok(Math.abs(pairPool[0].yPct - pairPool[1].yPct) >= 7.5);

  // 7. Quick Guide modal closes first on Android Back
  assert.equal(
    resolveAndroidBackAction({
      gameState: 'playing',
      showQuickGuide: true,
      showOnboardingModal: false,
      showCodex: false,
      showWardrobe: false,
      showSettings: false,
      showKitchenUpgrades: false,
      showStrategicModal: false,
    }),
    'close_quick_guide'
  );
});






test('Ultimates renombradas (Kärcher, Roomba): las partidas con el id antiguo cargan la nueva', async () => {
  const { migrateLegacyProgressIds, SPECIAL_WEAPONS_CATALOG } = await import('./rules');
  const migrated = migrateLegacyProgressIds({
    equippedSpecial: 'karcher_blast',
    unlockedSpecials: ['karcher_blast', 'baking_volcano', 'hydro_blast', 'knife_roomba'],
  });
  assert.equal(migrated.equippedSpecial, 'hydro_blast');
  assert.deepEqual(migrated.unlockedSpecials, ['hydro_blast', 'baking_volcano', 'knife_robot']);
  assert.equal(migrateLegacyProgressIds({ equippedSpecial: 'knife_roomba' }).equippedSpecial, 'knife_robot');
  for (const spec of Object.values(SPECIAL_WEAPONS_CATALOG)) {
    assert.ok(!/k[aä]rcher|roomba/i.test(spec.name + spec.desc), `marca registrada en «${spec.name}»`);
  }
});
