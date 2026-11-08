import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPlacementComboNotification,
  classifyBugElimination,
  checkPhaseTransition,
  createInitialBoardPieces,
  evaluateBoardCombos,
  getLevelSpeedMultiplier,
  getMaxPiecesForLevel,
  moveOrSwapUtensil,
} from './rules';
import { BugEnemy, UtensilPiece } from './types';

test('evaluateBoardCombos detects Line Foam, Horizontal UV Bridge, and Slip Vortex combos', () => {
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
  ];

  const { updatedPieces, links } = evaluateBoardCombos(pieces);
  assert.equal(updatedPieces.find((p) => p.id === 'p1')?.comboType, 'line_foam');
  assert.equal(updatedPieces.find((p) => p.id === 'p2')?.comboType, 'line_foam');
  assert.equal(updatedPieces.find((p) => p.id === 'p3')?.comboType, 'bridge_uv');
  assert.equal(updatedPieces.find((p) => p.id === 'p4')?.comboType, 'bridge_uv');
  assert.equal(updatedPieces.find((p) => p.id === 'p5')?.comboType, 'slip_vortex');
  assert.equal(updatedPieces.find((p) => p.id === 'p6')?.comboType, 'slip_vortex');
  assert.equal(links.length, 3);
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

test('progressive onboarding loadouts give 2 pieces on L1, 3 on L2, 3 on L3, 4 on L4, and -45% speed (0.55x) on L1-4', () => {
  assert.equal(createInitialBoardPieces(1).length, 2);
  assert.equal(createInitialBoardPieces(2).length, 3);
  assert.equal(createInitialBoardPieces(3).length, 3);
  assert.equal(createInitialBoardPieces(4).length, 4);
  assert.equal(getMaxPiecesForLevel(1), 2);
  assert.equal(getMaxPiecesForLevel(2), 3);
  assert.equal(getMaxPiecesForLevel(3), 3);
  assert.equal(getMaxPiecesForLevel(4), 4);
  assert.equal(getLevelSpeedMultiplier(1), 0.55);
  assert.equal(getLevelSpeedMultiplier(4), 0.55);
});

test('classifyBugElimination awards 1★, 2★, and 3★ accurately', () => {
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

  const res2 = classifyBugElimination({
    ...baseBug,
    isSlidingFromSoap: false,
    hitByVortexSpin: false,
    hitByDiagonalFoam: true,
  });
  assert.equal(res2.stars, 2);
  assert.equal(res2.achievementId, 'beetle_2star');
});

test('checkPhaseTransition advances phases without dumping random weapons on onboarding levels 1-4', () => {
  const p1 = checkPhaseTransition(1, 3, 1);
  assert.equal(p1.shouldAdvance, true);
  assert.equal(p1.nextPhase, 2);
  assert.equal(p1.unlockedUtensilOnAdvance, null);

  const p2 = checkPhaseTransition(2, 4, 1);
  assert.equal(p2.shouldAdvance, true);
  assert.equal(p2.nextPhase, 3);
  assert.equal(p2.unlockedUtensilOnAdvance, null);
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

