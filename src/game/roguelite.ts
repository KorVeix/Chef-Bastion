import {
  ArmorId,
  BugEnemy,
  BugType,
  HatId,
  KillStarRating,
  SpecialWeaponId,
  SupremeEvolutionId,
  UtensilPiece,
  UtensilType,
} from './types';

// ============================================================================
// 1. CONSTANTES DE SUPERVIVENCIA RUSH (CERO PAUSAS · ECONOMÍA EN VIVO)
// ============================================================================

export const RUSH_SUPPLY_MAX = 100;
export const RUSH_SUPPLY_DEPLOY_COST = 24;
export const RUSH_COST_ESCALATION_MULT = 1.3; // +30% cumulative per placed weapon (merging does NOT escalate!)
// Supply comes mostly from combo kills: the passive trickle alone cannot keep a static board alive.
export const RUSH_INITIAL_SUPPLY = 30;
export const RUSH_SUPPLY_BASE_PER_SEC = 4;
export const RUSH_TRAY_SLOTS = 4;
// Never enough weapons to wall off the 4 rails: the player must read each wave and reposition.
export const RUSH_INITIAL_BOARD_CAP = 3;
export const RUSH_MAX_BOARD_CAP = 5;
// Flus-Flus is the auto-fire workhorse: with 3+ of them the rails wall themselves off and the run plays
// itself. Two is enough to answer the hot lanes; covering a third means moving one of them.
export const RUSH_MAX_SPRAY_FLUS_ON_BOARD = 2;
// A 4x5 counter only has room to build combos against a handful of bugs at once.
export const RUSH_MAX_CONCURRENT_BUGS_EARLY = 3;
export const RUSH_MAX_CONCURRENT_BUGS = 4;
export const RUSH_EARLY_CONCURRENCY_UNTIL_SEC = 35;
// Past this speed bugs walk through a Flus-Flus before it can react; later difficulty comes from bug types.
export const RUSH_MAX_BUG_SPEED_MULT = 1.3;
export const AEROSOL_DEPLETE_BLINK_SECONDS = 3.0;
export const RUSH_CENTRAL_RAIL_ONLY_SECONDS = 15.0;
export const RUSH_OPENING_CENTER_RAIL = 1;
export const COMANDA_AUTO_PICK_SECONDS = 10.0;
export const SUPREME_EVOLUTION_HITSTOP_SECONDS = 0.05; // 50ms exactos al evolucionar Nv.3 + Nv.3
export const MERGE_SHOCKWAVE_PUSH_CELLS = 1.0;

export const RUSH_ADAPTIVE_POWER_RATIO = 0.75; // 75% of (weapons * avgLevel) growth; time provides the rest

/**
 * Escalating deploy cost: +30% compounded per ACTIVE weapon currently on the board.
 * When an aerosol runs out of charges or a weapon disappears, active count drops by 1 and cost steps back down!
 */
export function computeRushEscalatedCost(
  activeBoardWeapons: number,
  baseCost = RUSH_SUPPLY_DEPLOY_COST
): number {
  const safeCount = Math.max(0, Math.floor(activeBoardWeapons));
  return Math.round(baseCost * Math.pow(RUSH_COST_ESCALATION_MULT, safeCount));
}

/**
 * Counts currently ACTIVE weapons on the countertop (excluding tray cards and empty/depleting aerosols).
 */
export function countActiveRushBoardWeapons(
  pieces: readonly Pick<UtensilPiece, 'rail' | 'row' | 'ammo' | 'depleteTimer'>[]
): number {
  let count = 0;
  for (let i = 0; i < pieces.length; i++) {
    const p = pieces[i];
    if (p.rail === null || p.row === null) continue;
    if (p.depleteTimer !== undefined || (p.ammo !== undefined && p.ammo <= 0)) continue;
    count += 1;
  }
  return count;
}

/**
 * Active (not depleting) board pieces of one weapon type.
 */
export function countActiveRushBoardType(
  pieces: readonly Pick<UtensilPiece, 'type' | 'rail' | 'row' | 'ammo' | 'depleteTimer'>[],
  type: UtensilType
): number {
  return countActiveRushBoardWeapons(pieces.filter((p) => p.type === type));
}

/**
 * True when one more piece of `type` may NOT be deployed on an empty cell (Flus-Flus is capped at 2).
 * Merging into an existing piece and moving pieces already on the board are never limited.
 */
export function isRushTypeAtBoardLimit(
  pieces: readonly Pick<UtensilPiece, 'type' | 'rail' | 'row' | 'ammo' | 'depleteTimer'>[],
  type: UtensilType
): boolean {
  return type === 'spray_flus' && countActiveRushBoardType(pieces, type) >= RUSH_MAX_SPRAY_FLUS_ON_BOARD;
}

/**
 * Computes the current Rush deploy cost directly from active weapons on the board.
 */
export function computeRushDeployCostForBoard(
  pieces: readonly Pick<UtensilPiece, 'rail' | 'row' | 'ammo' | 'depleteTimer'>[],
  baseCost = RUSH_SUPPLY_DEPLOY_COST
): number {
  return computeRushEscalatedCost(countActiveRushBoardWeapons(pieces), baseCost);
}

/**
 * Ensures the supply bar ceiling always accommodates escalated costs (> 100) so next deployments remain payable.
 */
export function computeRushSupplyMax(currentDeployCost: number): number {
  return Math.max(RUSH_SUPPLY_MAX, Math.ceil(currentDeployCost));
}

/**
 * Board weapon cap: 3 at start (rushLevel = 1), +1 per XP level-up, max 5.
 */
export function computeRushBoardWeaponCap(rushLevel: number): number {
  const bonus = Math.max(0, Math.floor(rushLevel) - 1);
  return Math.min(RUSH_MAX_BOARD_CAP, RUSH_INITIAL_BOARD_CAP + bonus);
}

// ============================================================================
// 1b. DESGASTE, SUMINISTRO POR COMBO Y DIRECTOR DE OLEADAS AVISADAS
// ============================================================================

// Service life of a placed weapon before it wears out (blinks 3s and vanishes).
// Aerosols keep using their charges instead. Merging or evolving renews the service life.
export const RUSH_WEAR_SECONDS_BY_LEVEL: Readonly<Record<1 | 2 | 3, number>> = { 1: 22, 2: 30, 3: 40 };
export const RUSH_EVOLUTION_WEAR_SECONDS = 55;

export function getRushWearSeconds(
  type: UtensilType,
  level: number,
  evolutionId?: SupremeEvolutionId
): number | null {
  if (evolutionId) return RUSH_EVOLUTION_WEAR_SECONDS;
  if (type === 'aerosol_torch') return null;
  const tier = Math.min(3, Math.max(1, Math.floor(level))) as 1 | 2 | 3;
  return RUSH_WEAR_SECONDS_BY_LEVEL[tier];
}

function freshWearFields(
  type: UtensilType,
  level: number,
  evolutionId: SupremeEvolutionId | undefined
): Pick<UtensilPiece, 'wearRemaining' | 'wearMax'> {
  const seconds = getRushWearSeconds(type, level, evolutionId);
  return seconds === null
    ? { wearRemaining: undefined, wearMax: undefined }
    : { wearRemaining: seconds, wearMax: seconds };
}

/**
 * Advances a placed weapon's service life. When it runs out the weapon stops firing and starts the same
 * 3.0s blink-and-vanish countdown used by empty aerosols, freeing its slot and lowering the deploy cost.
 */
export function tickRushWear(piece: UtensilPiece, dt: number): { piece: UtensilPiece; wornOut: boolean } {
  if (piece.wearRemaining === undefined || piece.depleteTimer !== undefined) {
    return { piece, wornOut: false };
  }
  const next = Math.max(0, Number((piece.wearRemaining - Math.max(0, dt)).toFixed(4)));
  if (next <= 0) {
    return {
      piece: { ...piece, wearRemaining: 0, comboType: 'none', depleteTimer: AEROSOL_DEPLETE_BLINK_SECONDS },
      wornOut: true,
    };
  }
  return { piece: { ...piece, wearRemaining: next }, wornOut: false };
}

/** 0..1 share of service life left, or null for weapons without wear (aerosols, tray pieces). */
export function getRushWearFraction(piece: Pick<UtensilPiece, 'wearRemaining' | 'wearMax'>): number | null {
  if (piece.wearRemaining === undefined || !piece.wearMax) return null;
  return Math.min(1, Math.max(0, piece.wearRemaining / piece.wearMax));
}

/**
 * Supply earned per kill: combos are the economy. A plain hit barely pays; a 2★ flank or a UV-bridge burn
 * pays for most of a new weapon, and a 3★ master kill pays for one outright.
 */
export function getRushKillSupply(kill: {
  stars: KillStarRating;
  hitByBridgeBurn?: boolean;
  bossTier?: BugEnemy['bossTier'];
}): number {
  if (kill.bossTier) return 40;
  if (kill.stars === 3) return 26;
  if (kill.stars === 2 || kill.hitByBridgeBurn) return 14;
  return 3;
}

export const RUSH_WAVE_WARNING_SECONDS = 3.0;

export type RushWavePatternId =
  | 'ant_trickle'
  | 'ant_swarm'
  | 'armored_column'
  | 'wasp_raid'
  | 'roach_cross'
  | 'pincer';

export interface RushWaveSpawn {
  rail: number;
  type: BugType;
}

export interface RushWavePlan {
  pattern: RushWavePatternId;
  hotRails: number[];
  spawns: RushWaveSpawn[];
  spacingSec: number;
}

export interface RushWaveDirectorState {
  stage: 'calm' | 'warning' | 'active';
  timer: number;
  plan: RushWavePlan | null;
  nextSpawnIndex: number;
  wavesStarted: number;
}

export interface RushWaveTick {
  state: RushWaveDirectorState;
  spawns: RushWaveSpawn[];
  /** Set only on the tick a new wave is announced, so the canvas can pop its warning once. */
  announced: RushWavePlan | null;
  /** Rails to light up while a wave is being announced, with the seconds left until it starts. */
  warning: { rails: number[]; pattern: RushWavePatternId; secondsLeft: number } | null;
}

export const RUSH_WAVE_PATTERN_LABELS: Readonly<Record<RushWavePatternId, string>> = {
  ant_trickle: '🐜',
  ant_swarm: '🐜🐜🐜',
  armored_column: '🛡️🐀',
  wasp_raid: '🦟',
  roach_cross: '🪳',
  pincer: '🐜 + 🛡️🐀',
};

export function createRushWaveDirector(): RushWaveDirectorState {
  // The opening ant is already on the board; the first announced wave arrives a few seconds later.
  return { stage: 'calm', timer: 3.0, plan: null, nextSpawnIndex: 0, wavesStarted: 0 };
}

function pickDistinctRails(count: number, rng: () => number): number[] {
  const rails = [0, 1, 2, 3];
  const picked: number[] = [];
  while (picked.length < count && rails.length > 0) {
    const idx = Math.floor(rng() * rails.length) % rails.length;
    picked.push(rails.splice(idx, 1)[0]);
  }
  return picked.sort((a, b) => a - b);
}

function repeatSpawns(rail: number, type: BugType, count: number): RushWaveSpawn[] {
  return Array.from({ length: count }, () => ({ rail, type }));
}

function interleave<T>(a: readonly T[], b: readonly T[]): T[] {
  const out: T[] = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (i < a.length) out.push(a[i]);
    if (i < b.length) out.push(b[i]);
  }
  return out;
}

/**
 * Guion por tramos de Supervivencia: en cada tramo de tiempo las oleadas siguen un ciclo fijo de patrones
 * (solo el carril sale del `rng`). Cada oleada pide UNA respuesta (abanico, puente UV, Jabón + Fregona o
 * Gel WC) hasta que el cupo de armas permite montar dos a la vez; la pinza (abanico + puente) no aparece
 * antes de `RUSH_PINCER_FROM_SEC`.
 */
export const RUSH_PINCER_FROM_SEC = 65;

export const RUSH_SCRIPT_TRAMOS: readonly { untilSec: number; cycle: readonly RushWavePatternId[] }[] = [
  { untilSec: 35, cycle: ['ant_trickle', 'armored_column', 'ant_trickle'] },
  { untilSec: RUSH_PINCER_FROM_SEC, cycle: ['ant_swarm', 'armored_column', 'ant_trickle', 'wasp_raid', 'armored_column'] },
  { untilSec: 95, cycle: ['ant_swarm', 'pincer', 'armored_column', 'wasp_raid', 'ant_swarm', 'pincer'] },
  { untilSec: Infinity, cycle: ['pincer', 'ant_swarm', 'roach_cross', 'armored_column', 'pincer', 'wasp_raid'] },
];

export function getRushScriptPattern(elapsedSec: number, waveIndex: number): RushWavePatternId {
  const tramo = RUSH_SCRIPT_TRAMOS.find((t) => elapsedSec < t.untilSec) ?? RUSH_SCRIPT_TRAMOS[RUSH_SCRIPT_TRAMOS.length - 1];
  return tramo.cycle[Math.abs(waveIndex) % tramo.cycle.length];
}

/**
 * Plans the next wave: every wave is concentrated on 1-2 rails and asks for a specific answer
 * (fan of foam for swarms, UV bridge or soap for shields, soap + mop or the square for roaches).
 * The pattern comes from the script by tramos (`getRushScriptPattern`); only the rails are random.
 */
export function planRushWave(
  elapsedSec: number,
  rng: () => number = Math.random,
  waveIndex = 0
): RushWavePlan {
  const extra = elapsedSec >= 95 ? Math.min(3, Math.floor((elapsedSec - 95) / 60) + 1) : 0;

  if (elapsedSec < RUSH_CENTRAL_RAIL_ONLY_SECONDS) {
    return {
      pattern: 'ant_trickle',
      hotRails: [RUSH_OPENING_CENTER_RAIL],
      spawns: repeatSpawns(RUSH_OPENING_CENTER_RAIL, 'speed_ant', 3),
      spacingSec: 1.6,
    };
  }

  const pattern = getRushScriptPattern(elapsedSec, waveIndex);

  if (pattern === 'pincer') {
    // Carriles vecinos: el abanico del carril de hormigas y el puente del carril blindado comparten casillas.
    const left = Math.floor(rng() * 3) % 3;
    const swap = rng() < 0.5;
    const antRail = swap ? left + 1 : left;
    const shieldRail = swap ? left : left + 1;
    return {
      pattern,
      hotRails: [left, left + 1],
      spawns: interleave(
        repeatSpawns(antRail, 'speed_ant', 2 + extra),
        repeatSpawns(shieldRail, 'cap_beetle', 1 + Math.floor(extra / 2))
      ),
      spacingSec: 1.0,
    };
  }

  const [rail] = pickDistinctRails(1, rng);
  switch (pattern) {
    case 'ant_trickle':
      return { pattern, hotRails: [rail], spawns: repeatSpawns(rail, 'speed_ant', 3), spacingSec: 1.4 };
    case 'ant_swarm':
      return { pattern, hotRails: [rail], spawns: repeatSpawns(rail, 'speed_ant', 4 + extra), spacingSec: 0.55 };
    case 'armored_column':
      return {
        pattern,
        hotRails: [rail],
        spawns: repeatSpawns(rail, 'cap_beetle', elapsedSec < 35 ? 1 : 2 + Math.floor(extra / 2)),
        spacingSec: 1.6,
      };
    case 'wasp_raid':
      return { pattern, hotRails: [rail], spawns: repeatSpawns(rail, 'acid_wasp', 2 + Math.floor(extra / 2)), spacingSec: 1.3 };
    default:
      return { pattern: 'roach_cross', hotRails: [rail], spawns: repeatSpawns(rail, 'shift_roach', 2 + Math.floor(extra / 2)), spacingSec: 1.2 };
  }
}

/**
 * Advances the wave director: calm -> announced (rails light up for 3s) -> active (spawns only on the
 * announced rails) -> calm. Spawns wait while the board is at its concurrent-bug limit (`canSpawn`).
 * `paceMult` (< 1 later in the run) tightens the spacing inside a wave and the calm between waves.
 */
export function tickRushWaveDirector(
  state: RushWaveDirectorState,
  dt: number,
  elapsedSec: number,
  opts: { canSpawn: boolean; paceMult?: number; rng?: () => number }
): RushWaveTick {
  const rng = opts.rng ?? Math.random;
  const pace = Math.min(1.2, Math.max(0.5, opts.paceMult ?? 1));
  const next: RushWaveDirectorState = { ...state, timer: state.timer - Math.max(0, dt) };
  const spawns: RushWaveSpawn[] = [];
  let announced: RushWavePlan | null = null;

  if (next.stage === 'calm' && next.timer <= 0) {
    next.plan = planRushWave(elapsedSec, rng, state.wavesStarted);
    next.stage = 'warning';
    next.timer = RUSH_WAVE_WARNING_SECONDS;
    next.nextSpawnIndex = 0;
    next.wavesStarted += 1;
    announced = next.plan;
  } else if (next.stage === 'warning' && next.timer <= 0) {
    next.stage = 'active';
    next.timer = 0;
  }

  if (next.stage === 'active' && next.plan) {
    if (next.timer <= 0 && opts.canSpawn) {
      spawns.push(next.plan.spawns[next.nextSpawnIndex]);
      next.nextSpawnIndex += 1;
      next.timer = next.plan.spacingSec * pace;
      if (next.nextSpawnIndex >= next.plan.spawns.length) {
        next.stage = 'calm';
        next.timer = Math.max(1.2, 2.5 - elapsedSec / 120) * pace;
      }
    }
  }

  const warning =
    next.stage === 'warning' && next.plan
      ? { rails: next.plan.hotRails, pattern: next.plan.pattern, secondsLeft: Math.max(0, next.timer) }
      : null;

  return { state: next, spawns, announced, warning };
}

/**
 * Initial aerosol UV charges in Rush by tier.
 */
export function getInitialAerosolAmmo(level: number): number {
  if (level >= 3) return 18;
  if (level === 2) return 14;
  return 10;
}

/**
 * Consumes `charges` from an aerosol piece in Rush; when charges hit 0, starts the 3.0s blink-and-vanish countdown.
 */
export function consumeAerosolAmmo(piece: UtensilPiece, charges: number): UtensilPiece {
  if (piece.type !== 'aerosol_torch' || piece.evolutionId || piece.depleteTimer !== undefined) {
    return piece;
  }
  const initMax = piece.maxAmmo ?? getInitialAerosolAmmo(piece.level);
  const current = piece.ammo ?? initMax;
  const nextAmmo = Math.max(0, Number((current - Math.max(0, charges)).toFixed(3)));
  if (nextAmmo <= 0) {
    return {
      ...piece,
      ammo: 0,
      maxAmmo: initMax,
      comboType: 'none',
      depleteTimer: AEROSOL_DEPLETE_BLINK_SECONDS,
    };
  }
  return {
    ...piece,
    ammo: nextAmmo,
    maxAmmo: initMax,
  };
}

/**
 * Advances the 3.0s blink countdown on an empty aerosol and reports blink visibility + expiration.
 */
export function tickDepletingAerosol(
  piece: UtensilPiece,
  dt: number
): { piece: UtensilPiece; expired: boolean; blinkVisible: boolean } {
  if (piece.depleteTimer === undefined) {
    return { piece, expired: false, blinkVisible: true };
  }
  const nextTimer = Math.max(0, Number((piece.depleteTimer - Math.max(0, dt)).toFixed(4)));
  const freq = nextTimer < 1.0 ? 16 : 9;
  const blinkVisible = Math.floor(nextTimer * freq) % 2 === 0;
  return {
    piece: { ...piece, depleteTimer: nextTimer },
    expired: nextTimer <= 0,
    blinkVisible,
  };
}

// Pool ágil inicial de 5 armas base en Nv.1 para asegurar fusiones rápidas desde el segundo 0
export const RUSH_BASE_POOL: readonly UtensilType[] = [
  'spray_flus',
  'aerosol_torch',
  'soap_bar',
  'mop_vortex',
  'scourer_nanas',
];

export type FrenzyTier = 1 | 2 | 3 | 4;

export interface FrenzyThermometerState {
  tier: FrenzyTier;
  label: string;
  shortBadge: string;
  progressToNext: number; // 0..1
  color: 'cyan' | 'yellow' | 'orange' | 'red';
  allowTier1InTray: boolean;
  silverChance: number;
  goldChance: number;
}

export interface RushTraySlot {
  slotIndex: number;
  id: string;
  type: UtensilType;
  level: 1 | 2 | 3;
  cost: number;
}

// ============================================================================
// 2. CATÁLOGO DE LAS 5 "EVOLUCIONES SUPREMAS" (Nv.3 Oro + Nv.3 Oro = 1 Casilla)
// ============================================================================

export interface SupremeEvolutionDef {
  id: SupremeEvolutionId;
  name: string;
  shortName: string;
  icon: string;
  recipeA: UtensilType;
  recipeB: UtensilType;
  accentHex: number;
  badgeText: string;
  description: string;
}

export const SUPREME_EVOLUTIONS_CATALOG: Record<SupremeEvolutionId, SupremeEvolutionDef> = {
  centrifuge_vortex: {
    id: 'centrifuge_vortex',
    name: 'Vórtice Centrífugo',
    shortName: 'Vórtice Centrífugo',
    icon: '🌀',
    recipeA: 'soap_bar',
    recipeB: 'mop_vortex',
    accentHex: 0x2dd4bf,
    badgeText: '🌀 VÓRTICE CENTRÍFUGO',
    description: 'Remolino que atrae plagas de carriles vecinos, tritura en giro y escupe atrás.',
  },
  plasma_uv_cannon: {
    id: 'plasma_uv_cannon',
    name: 'Cañón de Plasma UV',
    shortName: 'Plasma UV',
    icon: '⚛️',
    recipeA: 'aerosol_torch',
    recipeB: 'scourer_nanas',
    accentHex: 0xe879f9,
    badgeText: '⚛️ CAÑÓN PLASMA UV',
    description: 'Olas anchas violetas que perforan escudos y electrifican baldosas 3s.',
  },
  ricochet_washer: {
    id: 'ricochet_washer',
    name: 'Hidrolimpiadora Ricochet',
    shortName: 'Ricochet ×4',
    icon: '🔫',
    recipeA: 'spray_flus',
    recipeB: 'corner_square',
    accentHex: 0x38bdf8,
    badgeText: '🔫 RICOCHET ×4',
    description: 'Ráfaga metralleta cuyos proyectiles rebotan hasta 4 veces en los bordes.',
  },
  tesla_sanitary_coil: {
    id: 'tesla_sanitary_coil',
    name: 'Bobina Tesla Sanitaria',
    shortName: 'Bobina Tesla',
    icon: '⚡',
    recipeA: 'aerosol_torch',
    recipeB: 'aerosol_torch',
    accentHex: 0xa855f7,
    badgeText: '⚡ BOBINA TESLA',
    description: 'Torre autónoma que dispara rayos encadenados a 4 objetivos sin pareja.',
  },
  foam_mortar: {
    id: 'foam_mortar',
    name: 'Mortero Espumoso',
    shortName: 'Mortero Espuma',
    icon: '💣',
    recipeA: 'spray_flus',
    recipeB: 'soap_bar',
    accentHex: 0xf472b6,
    badgeText: '💣 MORTERO ESPUMOSO',
    description: 'Disparo parabólico explosivo al grupo más denso dejando suelo resbaladizo.',
  },
};

/**
 * Checks if two Gold Lv.3 pieces match one of the 5 Supreme Evolutions.
 */
export function matchSupremeEvolution(
  pieceA: Pick<UtensilPiece, 'type' | 'level' | 'evolutionId'>,
  pieceB: Pick<UtensilPiece, 'type' | 'level' | 'evolutionId'>
): SupremeEvolutionDef | null {
  if (pieceA.level !== 3 || pieceB.level !== 3 || pieceA.evolutionId || pieceB.evolutionId) {
    return null;
  }
  for (const evo of Object.values(SUPREME_EVOLUTIONS_CATALOG)) {
    const direct = pieceA.type === evo.recipeA && pieceB.type === evo.recipeB;
    const reverse = pieceA.type === evo.recipeB && pieceB.type === evo.recipeA;
    if (direct || reverse) {
      return evo;
    }
  }
  return null;
}

/**
 * Finds all placed board pieces that can evolve with `draggedPiece` (both Lv.3 Gold)
 * so the canvas can illuminate partners with a golden "¡EVOLUCIONAR!" arc BEFORE drop!
 */
export function findSupremeEvolutionPartners(
  draggedPiece: Pick<UtensilPiece, 'id' | 'type' | 'level' | 'evolutionId'>,
  boardPieces: readonly UtensilPiece[]
): { partner: UtensilPiece; evolution: SupremeEvolutionDef }[] {
  if (draggedPiece.level !== 3 || draggedPiece.evolutionId) return [];
  const matches: { partner: UtensilPiece; evolution: SupremeEvolutionDef }[] = [];
  for (const other of boardPieces) {
    if (other.id === draggedPiece.id || other.rail === null || other.row === null) continue;
    const evo = matchSupremeEvolution(draggedPiece, other);
    if (evo) {
      matches.push({ partner: other, evolution: evo });
    }
  }
  return matches;
}

export interface RushMergeOrPlaceResult {
  outcome: 'placed' | 'swapped' | 'merged' | 'evolved' | 'cap_reached' | 'type_cap_reached' | 'invalid';
  updatedPieces: UtensilPiece[];
  resultPieceId: string | null;
  newLevel: number;
  evolution: SupremeEvolutionDef | null;
  shockwavePushCells: number;
  hitstopSeconds: number;
  freedOriginCell: { rail: number; row: number } | null;
}

/**
 * Executes Hot-Merge (Nv.1 -> Nv.2 Plata -> Nv.3 Oro) or Supreme Evolution (Nv.3 + Nv.3 -> Super-Turret in 1 cell),
 * or places/swaps on the 4x5 playable grid (rows 2..6).
 * Enforces `maxBoardWeapons` ONLY when placing a new piece from the tray onto an empty cell — merging/evolving
 * onto an occupied compatible piece is always allowed even at cap!
 */
export function executeRushDropOrMerge(
  boardPieces: readonly UtensilPiece[],
  sourcePiece: UtensilPiece,
  targetRail: number,
  targetRow: number,
  minPlaceableRow = 2,
  maxBoardWeapons = Infinity
): RushMergeOrPlaceResult {
  if (targetRow < minPlaceableRow || targetRail < 0 || targetRail > 3 || targetRow > 6) {
    return {
      outcome: 'invalid',
      updatedPieces: [...boardPieces],
      resultPieceId: null,
      newLevel: sourcePiece.level,
      evolution: null,
      shockwavePushCells: 0,
      hitstopSeconds: 0,
      freedOriginCell: null,
    };
  }

  const isFromBoard = boardPieces.some((p) => p.id === sourcePiece.id && p.rail !== null && p.row !== null);
  const freedOriginCell =
    isFromBoard && sourcePiece.rail !== null && sourcePiece.row !== null
      ? { rail: sourcePiece.rail, row: sourcePiece.row }
      : null;

  const occupant = boardPieces.find(
    (p) => p.id !== sourcePiece.id && p.rail === targetRail && p.row === targetRow
  );

  // 1. Empty target cell -> enforce board weapon cap if deploying from tray, else place or move directly
  if (!occupant) {
    const activeOnBoard = countActiveRushBoardWeapons(boardPieces);
    if (!isFromBoard && activeOnBoard >= maxBoardWeapons) {
      return {
        outcome: 'cap_reached',
        updatedPieces: [...boardPieces],
        resultPieceId: null,
        newLevel: sourcePiece.level,
        evolution: null,
        shockwavePushCells: 0,
        hitstopSeconds: 0,
        freedOriginCell: null,
      };
    }
    if (!isFromBoard && isRushTypeAtBoardLimit(boardPieces, sourcePiece.type)) {
      return {
        outcome: 'type_cap_reached',
        updatedPieces: [...boardPieces],
        resultPieceId: null,
        newLevel: sourcePiece.level,
        evolution: null,
        shockwavePushCells: 0,
        hitstopSeconds: 0,
        freedOriginCell: null,
      };
    }

    const initAmmoFields =
      sourcePiece.type === 'aerosol_torch' && !sourcePiece.evolutionId
        ? {
            ammo: sourcePiece.ammo ?? getInitialAerosolAmmo(sourcePiece.level),
            maxAmmo: sourcePiece.maxAmmo ?? getInitialAerosolAmmo(sourcePiece.level),
          }
        : {};

    const nextPieces = isFromBoard
      ? boardPieces.map((p) =>
          p.id === sourcePiece.id
            ? { ...p, rail: targetRail, row: targetRow, gunkTimer: 0, cooldown: 0.15 }
            : { ...p }
        )
      : [
          ...boardPieces.map((p) => ({ ...p })),
          {
            ...sourcePiece,
            ...initAmmoFields,
            ...freshWearFields(sourcePiece.type, sourcePiece.level, sourcePiece.evolutionId),
            rail: targetRail,
            row: targetRow,
            gunkTimer: 0,
            cooldown: 0.15,
            fireTimer: 0.1,
          },
        ];

    return {
      outcome: 'placed',
      updatedPieces: nextPieces,
      resultPieceId: sourcePiece.id,
      newLevel: sourcePiece.level,
      evolution: null,
      shockwavePushCells: 0,
      hitstopSeconds: 0,
      freedOriginCell,
    };
  }

  // 2. Check Supreme Evolution FIRST (Nv.3 Oro + Nv.3 Oro compatibles -> Súper-Torreta Nv.4 en 1 sola casilla!)
  const evo = matchSupremeEvolution(sourcePiece, occupant);
  if (evo) {
    const nextPieces = boardPieces
      .filter((p) => p.id !== sourcePiece.id)
      .map((p) =>
        p.id === occupant.id
          ? {
              ...p,
              level: 4,
              evolutionId: evo.id,
              ammo: undefined,
              maxAmmo: undefined,
              depleteTimer: undefined,
              ...freshWearFields(p.type, 4, evo.id),
              gunkTimer: 0,
              cooldown: 0.08,
              fireTimer: 0.05,
            }
          : { ...p }
      );
    return {
      outcome: 'evolved',
      updatedPieces: nextPieces,
      resultPieceId: occupant.id,
      newLevel: 4,
      evolution: evo,
      shockwavePushCells: 1.65,
      hitstopSeconds: SUPREME_EVOLUTION_HITSTOP_SECONDS, // 50ms hitstop!
      freedOriginCell,
    };
  }

  // 3. Check Tactical Merge (identical weapon & identical level 1 or 2, non-evolved -> Nv.2 Plata / Nv.3 Oro!)
  if (
    sourcePiece.type === occupant.type &&
    sourcePiece.level === occupant.level &&
    sourcePiece.level < 3 &&
    !sourcePiece.evolutionId &&
    !occupant.evolutionId
  ) {
    const mergedLevel = sourcePiece.level + 1;
    const mergedAmmoFields =
      occupant.type === 'aerosol_torch'
        ? {
            ammo: getInitialAerosolAmmo(mergedLevel),
            maxAmmo: getInitialAerosolAmmo(mergedLevel),
            depleteTimer: undefined,
          }
        : {};
    const nextPieces = boardPieces
      .filter((p) => p.id !== sourcePiece.id)
      .map((p) =>
        p.id === occupant.id
          ? {
              ...p,
              ...mergedAmmoFields,
              ...freshWearFields(p.type, mergedLevel, undefined),
              depleteTimer: undefined,
              level: mergedLevel,
              gunkTimer: 0,
              cooldown: 0.1,
              fireTimer: 0.05,
            }
          : { ...p }
      );
    return {
      outcome: 'merged',
      updatedPieces: nextPieces,
      resultPieceId: occupant.id,
      newLevel: mergedLevel,
      evolution: null,
      shockwavePushCells: MERGE_SHOCKWAVE_PUSH_CELLS, // 1 cell shockwave knockback!
      hitstopSeconds: 0.03,
      freedOriginCell,
    };
  }

  // 4. Otherwise: if dragging an already-placed board piece onto a non-compatible piece, swap positions cleanly!
  if (isFromBoard && sourcePiece.rail !== null && sourcePiece.row !== null) {
    const origR = sourcePiece.rail;
    const origW = sourcePiece.row;
    const nextPieces = boardPieces.map((p) => {
      if (p.id === sourcePiece.id) {
        return { ...p, rail: targetRail, row: targetRow, gunkTimer: 0, cooldown: 0.18 };
      }
      if (p.id === occupant.id) {
        return { ...p, rail: origR, row: origW, gunkTimer: 0, cooldown: 0.18 };
      }
      return { ...p };
    });
    return {
      outcome: 'swapped',
      updatedPieces: nextPieces,
      resultPieceId: sourcePiece.id,
      newLevel: sourcePiece.level,
      evolution: null,
      shockwavePushCells: 0,
      hitstopSeconds: 0,
      freedOriginCell: null,
    };
  }

  return {
    outcome: 'invalid',
    updatedPieces: [...boardPieces],
    resultPieceId: null,
    newLevel: sourcePiece.level,
    evolution: null,
    shockwavePushCells: 0,
    hitstopSeconds: 0,
    freedOriginCell: null,
  };
}

// ============================================================================
// 3. TERMÓMETRO DE FRENESÍ Y POOL ANTI-DILUCIÓN
// ============================================================================

export function getFrenzyThermometer(elapsedSeconds: number): FrenzyThermometerState {
  if (elapsedSeconds >= 240) {
    return {
      tier: 4,
      label: 'FRENESÍ 4 · OVERDRIVE',
      shortBadge: '🔥 FRENESÍ 4 · OVERDRIVE',
      progressToNext: 1,
      color: 'red',
      allowTier1InTray: false, // Elimina Nv.1 de la bandeja: 100% Nv.2 Plata o Nv.3 Oro!
      silverChance: 0.72,
      goldChance: 0.28,
    };
  }
  if (elapsedSeconds >= 150) {
    return {
      tier: 3,
      label: 'FRENESÍ 3 · EBULLICIÓN',
      shortBadge: '🟠 FRENESÍ 3',
      progressToNext: Math.min(1, (elapsedSeconds - 150) / 90),
      color: 'orange',
      allowTier1InTray: true,
      silverChance: 0.36,
      goldChance: 0.1,
    };
  }
  if (elapsedSeconds >= 75) {
    return {
      tier: 2,
      label: 'FRENESÍ 2 · SERVICIO',
      shortBadge: '⚡ FRENESÍ 2',
      progressToNext: Math.min(1, (elapsedSeconds - 75) / 75),
      color: 'yellow',
      allowTier1InTray: true,
      silverChance: 0.2, // 20% prob. de salir directamente en Nv.2 Plata!
      goldChance: 0,
    };
  }
  return {
    tier: 1,
    label: 'FRENESÍ 1 · APERTURA',
    shortBadge: '💧 FRENESÍ 1',
    progressToNext: Math.min(1, elapsedSeconds / 75),
    color: 'cyan',
    allowTier1InTray: true,
    silverChance: 0,
    goldChance: 0,
  };
}

/**
 * Builds the active anti-dilution weapon pool synchronized with the Frenzy Thermometer:
 * - Frenesí 1 (0:00 - 1:14): strictly the 5 agile base weapons (minus vetoed).
 * - Frenesí 2 (1:15+): injects 1 tactical weapon (Escuadra 90° or Gel WC).
 * - Frenesí 3 (2:30+): injects unlocked heavy weapon (Cañón Lejía / Volcán).
 */
export function buildActiveRushPool(opts: {
  elapsedSeconds: number;
  unlockedMilestones?: readonly string[];
  vetoedTypes?: readonly UtensilType[];
}): UtensilType[] {
  const frenzy = getFrenzyThermometer(opts.elapsedSeconds);
  const pool: UtensilType[] = [...RUSH_BASE_POOL];

  if (frenzy.tier >= 2) {
    const hasWcUnlock = opts.unlockedMilestones?.includes('rush_streak_25');
    // Inject 1 tactical weapon (corner_square enables Ricochet Supreme Evolution!)
    pool.push('corner_square');
    if (hasWcUnlock && frenzy.tier >= 3) {
      pool.push('wc_shield');
    }
  }

  if (frenzy.tier >= 3) {
    pool.push('bleach_cannon');
  }

  // Never allow vetoing `spray_flus` so the shooting guarantee ("al menos 1 Flus-Flus") always holds!
  const vetoSet = new Set<UtensilType>((opts.vetoedTypes ?? []).filter((t) => t !== 'spray_flus'));
  const filtered = pool.filter((t) => !vetoSet.has(t));
  // Safeguard: always keep at least 3 distinct weapon types (including spray_flus) so merges remain dynamic
  if (filtered.length >= 3) {
    return filtered.includes('spray_flus') ? filtered : ['spray_flus', ...filtered.slice(0, 2)];
  }
  return pool.slice(0, 3);
}

/**
 * Rolls a single rotating tray slot respecting Frenzy Tier level probabilities (Silver Lv.2 / Gold Lv.3).
 * If `otherTrayTypes` is passed and contains NO `spray_flus`, guarantees this slot rolls `spray_flus`
 * while costing and scaling in tier identically to any other weapon.
 */
export function rollRushTraySlot(
  slotIndex: number,
  opts: {
    elapsedSeconds: number;
    unlockedMilestones?: readonly string[];
    vetoedTypes?: readonly UtensilType[];
    otherTrayTypes?: readonly UtensilType[];
    activeBoardWeapons?: number;
    rng?: () => number;
  }
): RushTraySlot {
  const rand = opts.rng ?? Math.random;
  const frenzy = getFrenzyThermometer(opts.elapsedSeconds);
  const pool = buildActiveRushPool(opts);
  const mustForceSpray =
    opts.otherTrayTypes !== undefined && !opts.otherTrayTypes.includes('spray_flus');
  const pickedType: UtensilType = mustForceSpray
    ? 'spray_flus'
    : pool[Math.floor(rand() * pool.length) % pool.length];

  let level: 1 | 2 | 3 = 1;
  const lvlRoll = rand();
  if (!frenzy.allowTier1InTray) {
    // Frenesí 4 Overdrive (4:00+): 0% Nv.1! Everything (including Flus-Flus) spawns at Nv.2 Plata or Nv.3 Oro!
    level = lvlRoll < frenzy.goldChance ? 3 : 2;
  } else if (lvlRoll < frenzy.goldChance) {
    level = 3;
  } else if (lvlRoll < frenzy.goldChance + frenzy.silverChance) {
    level = 2;
  }

  return {
    slotIndex,
    id: `rush-slot-${slotIndex}-${Date.now()}-${Math.floor(rand() * 10000)}`,
    type: pickedType,
    level,
    cost: computeRushEscalatedCost(opts.activeBoardWeapons ?? 0),
  };
}

/**
 * Rolls a complete 4-slot Rush tray (`RUSH_TRAY_SLOTS`) guaranteeing at least 1 `spray_flus` ("Flus-Flus")
 * that costs and scales in level identically to any other weapon.
 */
export function rollRushTrayBatch(opts: {
  elapsedSeconds: number;
  unlockedMilestones?: readonly string[];
  vetoedTypes?: readonly UtensilType[];
  activeBoardWeapons?: number;
  slotCount?: number;
  rng?: () => number;
}): RushTraySlot[] {
  const rand = opts.rng ?? Math.random;
  const count = Math.max(1, opts.slotCount ?? RUSH_TRAY_SLOTS);
  const slots: RushTraySlot[] = [];
  for (let i = 0; i < count; i++) {
    slots.push(
      rollRushTraySlot(i, {
        ...opts,
        rng: rand,
      })
    );
  }
  if (!slots.some((s) => s.type === 'spray_flus')) {
    const forcedIdx = Math.floor(rand() * slots.length) % slots.length;
    slots[forcedIdx] = {
      ...slots[forcedIdx],
      type: 'spray_flus',
    };
  }
  return slots;
}

/**
 * Ensures any array of Rush `UtensilPiece` items has at least 1 `spray_flus` among its tray cards (`rail === null`).
 */
export function ensureRushTrayHasSprayFlus(
  pieces: readonly UtensilPiece[],
  rng: () => number = Math.random
): UtensilPiece[] {
  const trayIndices: number[] = [];
  let hasSpray = false;
  for (let i = 0; i < pieces.length; i++) {
    const p = pieces[i];
    if (p.rail === null || p.row === null) {
      trayIndices.push(i);
      if (p.type === 'spray_flus') {
        hasSpray = true;
      }
    }
  }
  if (hasSpray || trayIndices.length === 0) {
    return pieces.map((p) => ({ ...p }));
  }
  const targetIdx = trayIndices[Math.floor(rng() * trayIndices.length) % trayIndices.length];
  return pieces.map((p, idx) =>
    idx === targetIdx
      ? {
          ...p,
          type: 'spray_flus',
          ammo: undefined,
          maxAmmo: undefined,
          depleteTimer: undefined,
        }
      : { ...p }
  );
}

export function getSupplyKillBonus(rapidStreak: number): number {
  if (rapidStreak >= 10) return 11;
  if (rapidStreak >= 5) return 8;
  if (rapidStreak >= 2) return 6;
  return 4;
}

// ============================================================================
// 4. DIRECTOR DE CAOS (EVENTOS CADA 60s SIN PAUSAR) Y ESCALADO CONTINUO
// ============================================================================

export type ChaosEventId = 'rush_hour' | 'lateral_breach' | 'boss_invasion' | 'overdrive';

export interface ChaosDirectorEvent {
  id: ChaosEventId;
  minuteMark: number;
  title: string;
  subtitle: string;
  color: 'yellow' | 'cyan' | 'pink' | 'orange';
}

export function getChaosDirectorEventForMinute(minuteMark: number): ChaosDirectorEvent | null {
  if (minuteMark === 1) {
    return {
      id: 'rush_hour',
      minuteMark: 1,
      title: '⚡ MIN 1:00 · ¡HORA PUNTA!',
      subtitle: 'Enjambre rápido piñata de XP · ¡Funde y sube de nivel!',
      color: 'yellow',
    };
  }
  if (minuteMark === 2) {
    return {
      id: 'lateral_breach',
      minuteMark: 2,
      title: '📐 MIN 2:00 · ¡FUGA LATERAL!',
      subtitle: 'Conductos laterales abiertos durante 30s',
      color: 'cyan',
    };
  }
  if (minuteMark === 3) {
    return {
      id: 'boss_invasion',
      minuteMark: 3,
      title: '👑 MIN 3:00 · ¡INVASIÓN DE JEFE!',
      subtitle: '¡Abátelo para desplegar la Roomba con Cuchillos!',
      color: 'pink',
    };
  }
  if (minuteMark >= 4) {
    return {
      id: 'overdrive',
      minuteMark,
      title: `🔥 MIN ${minuteMark}:00 · ¡OVERDRIVE!`,
      subtitle: 'Bandeja 100% Plata/Oro · ¡Supervivencia límite!',
      color: 'orange',
    };
  }
  return null;
}

export interface RushArsenalMetrics {
  weaponCount: number;
  averageLevel: number;
  arsenalPower: number; // weaponCount * averageLevel
}

/**
 * Computes `(nº de armas × nivel medio)` for active placed weapons on the countertop.
 * Excludes empty blinking aerosol cans (`depleteTimer !== undefined` or `ammo <= 0`) so adaptive
 * difficulty reflects live combat power accurately.
 */
export function computeRushArsenalMetrics(
  pieces: readonly Pick<UtensilPiece, 'rail' | 'row' | 'level' | 'ammo' | 'depleteTimer'>[]
): RushArsenalMetrics {
  let count = 0;
  let sumLevels = 0;
  for (let i = 0; i < pieces.length; i++) {
    const p = pieces[i];
    if (p.rail === null || p.row === null) continue;
    if (p.depleteTimer !== undefined || (p.ammo !== undefined && p.ammo <= 0)) continue;
    count += 1;
    sumLevels += Math.max(1, p.level);
  }
  if (count === 0) {
    return { weaponCount: 0, averageLevel: 0, arsenalPower: 0 };
  }
  const averageLevel = Number((sumLevels / count).toFixed(2));
  const arsenalPower = Number((count * averageLevel).toFixed(2));
  return { weaponCount: count, averageLevel, arsenalPower };
}

/**
 * Opening 15s spawn rule: during the first 15 seconds, ONLY the central rail (`rail === 1`) spawns bugs.
 */
export function pickRushSpawnRail(
  elapsedSeconds: number,
  rng: () => number = Math.random
): number {
  if (elapsedSeconds < RUSH_CENTRAL_RAIL_ONLY_SECONDS) {
    return RUSH_OPENING_CENTER_RAIL;
  }
  return Math.floor(rng() * 4) % 4;
}

/**
 * Velocidad final de los bichos en Supervivencia: el techo ×1,3 se aplica DESPUÉS de componer el director,
 * los pactos de caos, el mundo y el bioma (antes solo limitaba el valor del director).
 */
export function capRushSpeedMultiplier(
  directorMult: number,
  chaosMult: number,
  worldMult: number,
  frictionFactor: number
): number {
  return Math.min(RUSH_MAX_BUG_SPEED_MULT, directorMult * chaosMult * worldMult * frictionFactor);
}

/**
 * Apariciones especiales (Hora Punta, Fuga Lateral, Invasión de Jefe) respetan el tope de bichos a la vez:
 * salen las que caben y el resto espera en cola.
 */
export function drainPendingSpawnsWithinCap<T>(
  pending: readonly T[],
  aliveCount: number,
  maxConcurrent: number
): { spawnNow: T[]; remaining: T[] } {
  const room = Math.max(0, maxConcurrent - aliveCount);
  return { spawnNow: pending.slice(0, room), remaining: pending.slice(room) };
}

/**
 * Computes the adaptive difficulty multiplier at 75% of `(armas × nivel medio)` growth above baseline 1.
 * E.g. growing arsenalPower from 1 -> 5 (+400% growth) scales adaptive pressure by +300% (4.0x = 1 + 0.75 * 4),
 * leaving the remaining pressure to elapsed time.
 */
export function computeRushAdaptivePressureMultiplier(arsenalPower: number): number {
  const safePower = Math.max(0, arsenalPower);
  const powerGrowth = Math.max(0, safePower - 1);
  return Number((1 + RUSH_ADAPTIVE_POWER_RATIO * powerGrowth).toFixed(4));
}

/**
 * Adaptive Rush Director:
 * Scales adaptive pressure at 75% of `(nº de armas × nivel medio)` growth (`computeRushAdaptivePressureMultiplier`),
 * while `elapsedSeconds` supplies the remaining pressure so an average player loses between 90 and 120 seconds.
 */
export function computeRushDirectorParams(
  elapsedSeconds: number,
  arsenalPower = 0
): {
  speedMultiplier: number;
  spawnIntervalSec: number;
  maxConcurrentBugs: number;
  hpMultiplier: number;
  lateralConduitsOpen: boolean;
} {
  const safePower = Math.max(0, arsenalPower);
  const adaptivePressureMult = computeRushAdaptivePressureMultiplier(safePower);
  // Split adaptivePressureMult cleanly across HP (55% exponent) and Spawn Frequency (45% exponent)
  // so (hpMultiplier * effectiveFreq) scales at exact 1.0x of `adaptivePressureMult` (75% of power growth)!
  const adaptiveHpMult = Math.pow(adaptivePressureMult, 0.55);
  const adaptiveFreqMult = Math.pow(adaptivePressureMult, 0.45);

  // 1. Movement speed: calm 0..15s central-rail opening, steady mid-game, ramping after 72s
  const rawSpeed =
    elapsedSeconds < RUSH_CENTRAL_RAIL_ONLY_SECONDS
      ? 0.64 + elapsedSeconds * 0.004
      : 0.7 +
        Math.min(0.62, (elapsedSeconds - 15) * 0.0038) +
        Math.max(0, elapsedSeconds - 72) * 0.0068 +
        Math.min(0.18, Math.max(0, safePower - 1) * 0.012);
  const speedMultiplier = Number(Math.min(RUSH_MAX_BUG_SPEED_MULT, rawSpeed).toFixed(3));

  // 2. Time-based + Adaptive Spawn Frequency (bugs/sec)
  const timeFreq =
    elapsedSeconds < RUSH_CENTRAL_RAIL_ONLY_SECONDS
      ? 0.28 + elapsedSeconds * 0.002
      : 0.31 +
        (elapsedSeconds - 15) * 0.0018 +
        Math.max(0, elapsedSeconds - 72) * 0.0095;
  const effectiveFreq = timeFreq * adaptiveFreqMult;
  const spawnIntervalSec = Number(Math.max(0.28, 1 / effectiveFreq).toFixed(2));

  // 3. Time-based + Adaptive Plague HP
  const timeHp =
    elapsedSeconds < RUSH_CENTRAL_RAIL_ONLY_SECONDS
      ? 0.58 + elapsedSeconds * 0.002
      : 0.61 +
        (elapsedSeconds - 15) * 0.0028 +
        Math.max(0, elapsedSeconds - 72) * 0.0155;
  const hpMultiplier = Number((timeHp * adaptiveHpMult).toFixed(2));

  // Fixed small ceiling (not tied to time or arsenal power): there must always be room to build combos.
  const maxConcurrentBugs =
    elapsedSeconds < RUSH_EARLY_CONCURRENCY_UNTIL_SEC ? RUSH_MAX_CONCURRENT_BUGS_EARLY : RUSH_MAX_CONCURRENT_BUGS;

  const lateralConduitsOpen =
    (elapsedSeconds >= 120 && elapsedSeconds <= 150) || elapsedSeconds >= 240;

  return {
    speedMultiplier,
    spawnIntervalSec,
    maxConcurrentBugs,
    hpMultiplier,
    lateralConduitsOpen,
  };
}

// ============================================================================
// 5. "COMANDAS AL VUELO" (LECTURA EN 0.4s · <= 4 PALABRAS · CERO PAUSA)
// ============================================================================

export type ComandaColor = 'yellow' | 'blue' | 'red' | 'green';

export type ComandaEffectId =
  | 'double_nozzle'
  | 'wall_ricochet'
  | 'crit_foam'
  | 'electro_tiles'
  | 'upgrade_random_tower'
  | 'deploy_roomba'
  | 'supply_boost'
  | 'veto_weapon'
  | 'pact_sacrifice_plate'
  | 'pact_frenzy_xp'
  | 'regen_plate';

export interface ComandaTicket {
  id: string;
  effectId: ComandaEffectId;
  color: ComandaColor;
  icon: string;
  title: string; // STRICTLY <= 4 words for 0.4s glance reading!
  vetoTarget?: UtensilType;
}

export const COMANDAS_POOL: readonly Omit<ComandaTicket, 'id'>[] = [
  // Amarillo: Mutaciones Bullet Hell
  {
    effectId: 'double_nozzle',
    color: 'yellow',
    icon: '🔫',
    title: 'Doble Chorro Frontal',
  },
  {
    effectId: 'wall_ricochet',
    color: 'yellow',
    icon: '🪃',
    title: 'Rebote En Paredes',
  },
  {
    effectId: 'crit_foam',
    color: 'yellow',
    icon: '💥',
    title: '+35% Daño Total',
  },
  {
    effectId: 'electro_tiles',
    color: 'yellow',
    icon: '⚡',
    title: 'Baldosas Mojadas Electrocutan',
  },
  // Azul: Subir nivel de arma / Autómatas / Vetar 1 arma
  {
    effectId: 'upgrade_random_tower',
    color: 'blue',
    icon: '⬆️',
    title: 'Subir Arma +1Nv',
  },
  {
    effectId: 'deploy_roomba',
    color: 'blue',
    icon: '🔪',
    title: 'Roomba Con Cuchillos',
  },
  {
    effectId: 'supply_boost',
    color: 'blue',
    icon: '🔋',
    title: '+30% Carga Suministro',
  },
  {
    effectId: 'veto_weapon',
    color: 'blue',
    icon: '🚫',
    title: 'Vetar 1 Arma',
  },
  // Rojo Neón: Pacto Maldito
  {
    effectId: 'pact_sacrifice_plate',
    color: 'red',
    icon: '🩸',
    title: '-1Plato +50% Cadencia',
  },
  {
    effectId: 'pact_frenzy_xp',
    color: 'red',
    icon: '🔥',
    title: '+20%Caos Doble XP',
  },
  // Verde: Regenerar 1 Plato
  {
    effectId: 'regen_plate',
    color: 'green',
    icon: '🍽️',
    title: 'Regenerar 1 Plato',
  },
];

/**
 * Generates 3 distinct non-pausing Comanda tickets tailored to live board state:
 * - Slot 0 (Left): Yellow Bullet-Hell Mutation or Red Cursed Pact
 * - Slot 1 (Center — auto-equipped after 6s if untouched!): safe positive Blue/Yellow upgrade (never a cursed sacrifice!)
 * - Slot 2 (Right): Green "Regenerar 1 Plato" if a plate is missing, Blue "Vetar 1 Arma", or Red Cursed Pact
 */
export function rollLiveComandaTriplet(opts: {
  intactPlates: readonly boolean[];
  activePool: readonly UtensilType[];
  roombaActive: boolean;
  rng?: () => number;
}): [ComandaTicket, ComandaTicket, ComandaTicket] {
  const rand = opts.rng ?? Math.random;
  const intactCount = opts.intactPlates.filter(Boolean).length;
  const missingPlate = intactCount < 4;

  const yellows = COMANDAS_POOL.filter((c) => c.color === 'yellow');
  const blues = COMANDAS_POOL.filter(
    (c) =>
      c.color === 'blue' &&
      (c.effectId !== 'deploy_roomba' || !opts.roombaActive) &&
      (c.effectId !== 'veto_weapon' || opts.activePool.length > 3)
  );
  const reds = COMANDAS_POOL.filter(
    (c) => c.color === 'red' && (c.effectId !== 'pact_sacrifice_plate' || intactCount >= 2)
  );
  const greenRegen = COMANDAS_POOL.find((c) => c.effectId === 'regen_plate')!;

  const pickFrom = <T,>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length) % arr.length];

  const leftBase = pickFrom(yellows);
  const centerCandidates = [...blues.filter((b) => b.effectId !== 'veto_weapon'), ...yellows].filter(
    (c) => c.effectId !== leftBase.effectId
  );
  const centerBase = pickFrom(centerCandidates.length > 0 ? centerCandidates : yellows);

  let rightBase: Omit<ComandaTicket, 'id'>;
  if (missingPlate && rand() < 0.72) {
    rightBase = greenRegen;
  } else if (opts.activePool.length > 3 && rand() < 0.48) {
    rightBase = COMANDAS_POOL.find((c) => c.effectId === 'veto_weapon')!;
  } else if (reds.length > 0) {
    rightBase = pickFrom(reds);
  } else {
    rightBase = greenRegen;
  }

  const stamp = Date.now();
  const assignVetoIfNeeded = (base: Omit<ComandaTicket, 'id'>, idx: number): ComandaTicket => {
    const vetoablePool = opts.activePool.filter((t) => t !== 'spray_flus');
    if (base.effectId === 'veto_weapon' && opts.activePool.length > 3 && vetoablePool.length > 0) {
      const candidateVeto = vetoablePool[vetoablePool.length - 1];
      const shortWeapon =
        candidateVeto === 'aerosol_torch'
          ? 'Aerosol'
          : candidateVeto === 'scourer_nanas'
          ? 'Estropajo'
          : candidateVeto === 'soap_bar'
          ? 'Jabón'
          : candidateVeto === 'mop_vortex'
          ? 'Fregona'
          : candidateVeto === 'corner_square'
          ? 'Escuadra'
          : candidateVeto === 'wc_shield'
          ? 'GelWC'
          : 'Lejía';
      return {
        ...base,
        id: `cmd-${stamp}-${idx}`,
        title: `Vetar ${shortWeapon}`,
        vetoTarget: candidateVeto,
      };
    }
    return {
      ...base,
      id: `cmd-${stamp}-${idx}`,
    };
  };

  return [
    assignVetoIfNeeded(leftBase, 0),
    assignVetoIfNeeded(centerBase, 1),
    assignVetoIfNeeded(rightBase, 2),
  ];
}

// ============================================================================
// 6. HITOS DE ADRENALINA PERMANENTES Y "TICKET TÉRMICO DE RESTAURANTE"
// ============================================================================

export interface RushAdrenalineMilestone {
  id: string;
  title: string;
  subtitle: string;
  coinsBonus: number;
  unlockHat?: HatId;
  unlockArmor?: ArmorId;
  unlockSpecial?: SpecialWeaponId;
}

export const RUSH_ADRENALINE_MILESTONES: readonly RushAdrenalineMilestone[] = [
  {
    id: 'rush_frenzy_2',
    title: '⚡ ¡HITO: FRENESÍ 2 (1:15)!',
    subtitle: 'Escuadra 90° añadida al Suministro + 80 🪙',
    coinsBonus: 80,
  },
  {
    id: 'rush_streak_25',
    title: '🔥 ¡HITO: RACHA ×25!',
    subtitle: 'Gorro Patito desbloqueado + 120 🪙',
    coinsBonus: 120,
    unlockHat: 'duck_shower_cap',
  },
  {
    id: 'rush_boss_3min',
    title: '👑 ¡HITO: JEFE MIN 3:00 ABATIDO!',
    subtitle: 'Roomba Kamikaze + Traje EPI permanentes + 200 🪙',
    coinsBonus: 200,
    unlockArmor: 'hazmat_epi',
    unlockSpecial: 'knife_roomba',
  },
  {
    id: 'rush_overdrive_4min',
    title: '☢️ ¡HITO: OVERDRIVE 4:00!',
    subtitle: 'Volcán Químico + Malla Dorada permanentes + 300 🪙',
    coinsBonus: 300,
    unlockArmor: 'golden_scourer_mail',
    unlockSpecial: 'baking_volcano',
  },
];

export function formatSurvivalMMSS(totalSeconds: number): string {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export interface ThermalReceiptLine {
  qty: string;
  label: string;
  amountCoins: number;
}

export interface ThermalReceiptSummary {
  orderNumber: string;
  survivedSeconds: number;
  survivedFormatted: string;
  isNewRecord: boolean;
  frenzyReached: FrenzyTier;
  lines: ThermalReceiptLine[];
  totalCoinsEarned: number;
  totalScore: number;
}

export function buildThermalReceipt(input: {
  survivedSeconds: number;
  previousBestSeconds: number;
  bugsCleaned: number;
  mergesCount: number;
  evolutionsCount: number;
  comandasPicked: number;
  milestonesCoins: number;
  score: number;
}): ThermalReceiptSummary {
  const sec = Math.max(0, Math.floor(input.survivedSeconds));
  const frenzy = getFrenzyThermometer(sec).tier;
  const timeCoins = Math.max(25, Math.round(sec * 0.85));
  const killCoins = Math.round(input.bugsCleaned * 2.5);
  const mergeCoins = input.mergesCount * 8 + input.evolutionsCount * 45;
  const comandaCoins = input.comandasPicked * 10;

  const lines: ThermalReceiptLine[] = [
    {
      qty: formatSurvivalMMSS(sec),
      label: 'TIEMPO EN COCINA (RUSH)',
      amountCoins: timeCoins,
    },
    {
      qty: `${input.bugsCleaned}x`,
      label: 'PLAGAS DESINFECTADAS',
      amountCoins: killCoins,
    },
    {
      qty: `${input.mergesCount + input.evolutionsCount}x`,
      label: `FUSIONES (${input.evolutionsCount} SUPREMAS)`,
      amountCoins: mergeCoins,
    },
    {
      qty: `${input.comandasPicked}x`,
      label: 'COMANDAS AL VUELO',
      amountCoins: comandaCoins,
    },
  ];

  if (input.milestonesCoins > 0) {
    lines.push({
      qty: '★',
      label: 'BONUS HITOS ADRENALINA',
      amountCoins: input.milestonesCoins,
    });
  }

  const totalCoinsEarned = lines.reduce((acc, item) => acc + item.amountCoins, 0);
  const orderCode = `#${String(1000 + ((sec * 17 + input.bugsCleaned * 3) % 8999))}`;

  return {
    orderNumber: orderCode,
    survivedSeconds: sec,
    survivedFormatted: formatSurvivalMMSS(sec),
    isNewRecord: sec > input.previousBestSeconds,
    frenzyReached: frenzy,
    lines,
    totalCoinsEarned,
    totalScore: input.score,
  };
}
