import {
  ArmorId,
  HatId,
  SpecialWeaponId,
  SupremeEvolutionId,
  UtensilPiece,
  UtensilType,
} from './types';

// ============================================================================
// 1. CONSTANTES DE SUPERVIVENCIA RUSH (CERO PAUSAS · ECONOMÍA EN VIVO)
// ============================================================================

export const RUSH_SUPPLY_MAX = 100;
export const RUSH_SUPPLY_DEPLOY_COST = 34;
export const RUSH_SUPPLY_BASE_PER_SEC = 21; // ~1 pieza cada 1.6s + bonus por rachas de bajas
export const RUSH_TRAY_SLOTS = 4;
export const COMANDA_AUTO_PICK_SECONDS = 10.0;
export const SUPREME_EVOLUTION_HITSTOP_SECONDS = 0.05; // 50ms exactos al evolucionar Nv.3 + Nv.3
export const MERGE_SHOCKWAVE_PUSH_CELLS = 1.0;

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
  outcome: 'placed' | 'swapped' | 'merged' | 'evolved' | 'invalid';
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
 * When merging/evolving from another board cell, frees the origin cell automatically!
 */
export function executeRushDropOrMerge(
  boardPieces: readonly UtensilPiece[],
  sourcePiece: UtensilPiece,
  targetRail: number,
  targetRow: number,
  minPlaceableRow = 2
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

  // 1. Empty target cell -> place or move directly
  if (!occupant) {
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
    const nextPieces = boardPieces
      .filter((p) => p.id !== sourcePiece.id)
      .map((p) =>
        p.id === occupant.id
          ? {
              ...p,
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

  const vetoSet = new Set(opts.vetoedTypes ?? []);
  const filtered = pool.filter((t) => !vetoSet.has(t));
  // Safeguard: always keep at least 3 distinct weapon types so merges remain dynamic
  return filtered.length >= 3 ? filtered : pool.slice(0, 3);
}

/**
 * Rolls a single rotating tray slot respecting Frenzy Tier level probabilities (Silver Lv.2 / Gold Lv.3).
 */
export function rollRushTraySlot(
  slotIndex: number,
  opts: {
    elapsedSeconds: number;
    unlockedMilestones?: readonly string[];
    vetoedTypes?: readonly UtensilType[];
    rng?: () => number;
  }
): RushTraySlot {
  const rand = opts.rng ?? Math.random;
  const frenzy = getFrenzyThermometer(opts.elapsedSeconds);
  const pool = buildActiveRushPool(opts);
  const pickedType = pool[Math.floor(rand() * pool.length) % pool.length];

  let level: 1 | 2 | 3 = 1;
  const lvlRoll = rand();
  if (!frenzy.allowTier1InTray) {
    // Frenesí 4 Overdrive (4:00+): 0% Nv.1! Everything spawns at Nv.2 Plata or Nv.3 Oro!
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
    cost: RUSH_SUPPLY_DEPLOY_COST,
  };
}

export function getSupplyKillBonus(rapidStreak: number): number {
  if (rapidStreak >= 10) return 18;
  if (rapidStreak >= 5) return 13;
  if (rapidStreak >= 2) return 9;
  return 6;
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

export function computeRushDirectorParams(elapsedSeconds: number): {
  speedMultiplier: number;
  spawnIntervalSec: number;
  maxConcurrentBugs: number;
  hpMultiplier: number;
  lateralConduitsOpen: boolean;
} {
  const baseSpeed = 0.92 + Math.min(1.35, elapsedSeconds * 0.0038);
  const baseInterval = Math.max(0.52, 1.95 - elapsedSeconds * 0.0052);
  // Breathable opening 90s: -35% plague movement speed and -35% spawn frequency so players can read & build synergies
  const openingPaceFactor = elapsedSeconds < 90 ? 0.65 : 1.0;
  const speedMultiplier = Number((baseSpeed * openingPaceFactor).toFixed(3));
  const spawnIntervalSec = Number((baseInterval / openingPaceFactor).toFixed(2));
  const maxConcurrentBugs =
    elapsedSeconds < 90
      ? Math.min(8, 4 + Math.floor(elapsedSeconds / 30))
      : Math.min(18, 5 + Math.floor(elapsedSeconds / 24));
  const hpMultiplier = Number((0.9 + elapsedSeconds * 0.0075).toFixed(2));
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
    if (base.effectId === 'veto_weapon' && opts.activePool.length > 3) {
      const candidateVeto = opts.activePool[opts.activePool.length - 1];
      const shortWeapon =
        candidateVeto === 'scourer_nanas'
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
