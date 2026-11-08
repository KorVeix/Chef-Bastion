import {
  AchievementDef,
  ArmorId,
  BugEnemy,
  BugType,
  HatId,
  KillStarRating,
  PlayerProgress,
  SpecialWeaponId,
  UtensilPiece,
  UtensilType,
  WorldId,
} from './types';

export const GRID_RAILS = 4;
export const GRID_ROWS = 7; // Row 0 = top (near conduits), Row 6 = bottom playable row (plates sit 1 step below at z = +4.2)
export const MIN_PLACEABLE_ROW = 2; // Filas 3 a 7 únicamente (prohibido colocar en Filas 1 y 2)

export interface CircuitLink {
  fromRail: number;
  fromRow: number;
  toRail: number;
  toRow: number;
  kind: 'line_foam' | 'bridge_uv' | 'slip_vortex';
}

export interface UtensilMeta {
  type: UtensilType;
  name: string;
  shortName: string;
  icon: string;
  accentHex: string;
  roleHint: string;
  comboRecipe: string;
}

export const UTENSIL_CATALOG: Record<UtensilType, UtensilMeta> = {
  spray_flus: {
    type: 'spray_flus',
    name: 'Spray "Flus-Flus" Táctico',
    shortName: 'Flus-Flus',
    icon: '🔫',
    accentHex: '#00d2ff',
    roleHint: 'Dispara recto por su raíl (Lento sin combo)',
    comboRecipe: 'Ponlo detrás de 🧽 = Abanico ×5 Burbujas',
  },
  scourer_nanas: {
    type: 'scourer_nanas',
    name: 'Estropajo Doble Cara',
    shortName: 'Estropajo',
    icon: '🧽',
    accentHex: '#a3e635',
    roleHint: 'Divide disparos de 🔫 en 5 burbujas diagonales',
    comboRecipe: 'Ponlo 1 casilla delante de 🔫',
  },
  aerosol_torch: {
    type: 'aerosol_torch',
    name: 'Aerosol "Mata-Todo" UV',
    shortName: 'Aerosol UV',
    icon: '🔥',
    accentHex: '#f97316',
    roleHint: 'Une 2 en la misma fila para fundir chapas',
    comboRecipe: '🔥 + 🔥 en raíles vecinos = Arco UV Funde-Chapas',
  },
  soap_bar: {
    type: 'soap_bar',
    name: 'Pastilla Jabón Resbalón',
    shortName: 'Jabón 45°',
    icon: '🧼',
    accentHex: '#f472b6',
    roleHint: 'Hace patinar al bicho al raíl vecino',
    comboRecipe: '🧼 desvía hacia 🌪️ en raíl vecino = ¡Muerte 3★!',
  },
  mop_vortex: {
    type: 'mop_vortex',
    name: 'Fregona "Turbo-Spin" 360°',
    shortName: 'Fregona 360°',
    icon: '🌪️',
    accentHex: '#2dd4bf',
    roleHint: 'Vórtice espiral 360° en casillas cercanas',
    comboRecipe: 'Ponla al lado de 🧼 para centrifugar 3★',
  },
  wc_shield: {
    type: 'wc_shield',
    name: 'Pastilla WC Reflectora',
    shortName: 'Gel WC',
    icon: '🛡️',
    accentHex: '#38bdf8',
    roleHint: 'Bloquea y rebota escupitajos ácidos',
    comboRecipe: 'Devuelve proyectiles de Moscas Ácidas',
  },
  bleach_cannon: {
    type: 'bleach_cannon',
    name: 'Garrafa "Lejía Nuclear"',
    shortName: 'Lejía',
    icon: '🧪',
    accentHex: '#facc15',
    roleHint: 'Chorro pesado corrosivo por su raíl',
    comboRecipe: '🧪 detrás de 🧽 = Súper Espuma Corrosiva',
  },
};

export const ACHIEVEMENTS_CATALOG: AchievementDef[] = [
  {
    id: 'beetle_1star',
    bugType: 'cap_beetle',
    star: 1,
    title: '¡DESINFECTADO! 1★',
    recipeIcons: ['🔥', '➕', '🔥', '➔', '🐀'],
    description: 'Funde la chapa de la Rata Blindada con un Puente de Aerosoles UV y remátala.',
    rewardType: 'coins',
    rewardId: 'coins_150',
    rewardLabel: '+150 Monedas Sanitarias',
    unlockCostCoins: 100,
  },
  {
    id: 'beetle_2star',
    bugType: 'cap_beetle',
    star: 2,
    title: '¡EXFOLIACIÓN LETAL! 2★',
    recipeIcons: ['🔫', '➔', '🧽', '↗️', '🐀'],
    description: 'Elimina a la Rata Blindada con espuma diagonal del Estropajo rodeando su chapa frontal.',
    rewardType: 'hat',
    rewardId: 'duck_shower_cap',
    rewardLabel: 'Gorro de Ducha + Patito (+15% Cadencia)',
    unlockCostCoins: 220,
  },
  {
    id: 'beetle_3star',
    bugType: 'cap_beetle',
    star: 3,
    title: '¡LIMPIEZA PROFUNDA! 3★',
    recipeIcons: ['🧼', '➔', '🌪️', '💥', '👑'],
    description: 'Haz patinar a la Rata Blindada en la Pastilla de Jabón directo hacia la Fregona Turbo-Spin.',
    rewardType: 'special_weapon',
    rewardId: 'knife_roomba',
    rewardLabel: 'Roomba Kamikaze con Cuchillos + Mundo Nevera',
    unlockCostCoins: 350,
  },
  {
    id: 'wasp_2star',
    bugType: 'acid_wasp',
    star: 2,
    title: '¡DEVOLUCIÓN HIGIÉNICA! 2★',
    recipeIcons: ['🪰', '➔', '🛡️', '↩️', '💥'],
    description: 'Rebota el escupitajo ácido de la Mosca Bombardera con la Pastilla WC Reflectora.',
    rewardType: 'armor',
    rewardId: 'hazmat_epi',
    rewardLabel: 'Traje EPI Amarillo Químico (+1 Sello Escudo)',
    unlockCostCoins: 260,
  },
  {
    id: 'wasp_3star',
    bugType: 'acid_wasp',
    star: 3,
    title: '¡CENTRIFUGADO AÉREO! 3★',
    recipeIcons: ['🧼', '➔', '🌪️', '➕', '🧽'],
    description: 'Limpia a la Mosca Bombardera combinando espuma de Estropajo y espiral de Fregona 360°.',
    rewardType: 'hat',
    rewardId: 'tp_gasmask',
    rewardLabel: 'Máscara Antigás con Rollos WC (+25% Daño Espuma)',
    unlockCostCoins: 380,
  },
  {
    id: 'crab_3star',
    bugType: 'king_crab',
    star: 3,
    title: '¡INSPECCIÓN SUPERADA! 3★',
    recipeIcons: ['🔥', '➕', '🧼', '➔', '🌪️'],
    description: 'Funde el escudo del Rey Rata y centrifúgalo con la Fregona Turbo-Spin.',
    rewardType: 'armor',
    rewardId: 'golden_scourer_mail',
    rewardLabel: 'Peto de Estropajos Dorados (+30% Presión Ultimate)',
    unlockCostCoins: 450,
  },
];

export const HATS_CATALOG: Record<HatId, { name: string; bonus: string; color: string }> = {
  classic_toque: {
    name: 'Gorro de Chef Clásico',
    bonus: 'Equilibrio culinario base',
    color: '#ffffff',
  },
  duck_shower_cap: {
    name: 'Gorro de Ducha con Patito',
    bonus: '+15% Cadencia de Spray Flus-Flus',
    color: '#38bdf8',
  },
  bucket_helmet: {
    name: 'Barreño Militar Volcado',
    bonus: 'Tus piezas duran 50% menos pringadas',
    color: '#94a3b8',
  },
  tp_gasmask: {
    name: 'Máscara Antigás con Rollos WC',
    bonus: '+25% Daño en abanicos de espuma',
    color: '#a3e635',
  },
};

export const ARMORS_CATALOG: Record<ArmorId, { name: string; bonus: string; color: string }> = {
  white_apron: {
    name: 'Delantal Blanco Impoluto',
    bonus: 'Velocidad de Swap estándar',
    color: '#f8fafc',
  },
  hazmat_epi: {
    name: 'Traje EPI Amarillo ("Cocinando Limpieza")',
    bonus: 'Inmune al primer pringue ácido por oleada',
    color: '#facc15',
  },
  golden_scourer_mail: {
    name: 'Peto de Estropajos Dorados',
    bonus: '+35% Carga del Manómetro Ultimate',
    color: '#f59e0b',
  },
};

export const SPECIAL_WEAPONS_CATALOG: Record<
  SpecialWeaponId,
  { name: string; icon: string; desc: string }
> = {
  karcher_blast: {
    name: 'Hidrolimpiadora "Kärcher" Alta Presión',
    icon: '🌊',
    desc: 'Empuja hacia atrás y blanquea a todos los bichos de los 4 raíles.',
  },
  baking_volcano: {
    name: 'Volcán de Bicarbonato + Vinagre',
    icon: '🌋',
    desc: 'Inunda el tablero de espuma ácida que funde todas las chapas.',
  },
  knife_roomba: {
    name: 'Roomba Kamikaze con Cuchillos',
    icon: '🔪',
    desc: 'Cruza los 4 raíles rebotando a toda pastilla y triturando todo a su paso.',
  },
};

export const WORLDS_CATALOG: Record<
  WorldId,
  { name: string; subtitle: string; woodColor: string; tileColor: string; speedMult: number }
> = {
  sunny_counter: {
    name: '1. La Estación del Chef',
    subtitle: 'Encimera de piedra pulida crema y acero inoxidable',
    woodColor: '#f5efe6',
    tileColor: '#fffbeb',
    speedMult: 1.0,
  },
  fridge_vault: {
    name: '2. El Interior de la Nevera (Especial)',
    subtitle: 'Baldas de cristal helado: ¡los desvíos con jabón son ×2 rápidos!',
    woodColor: '#38bdf8',
    tileColor: '#e0f2fe',
    speedMult: 1.15,
  },
  iron_stoves: {
    name: '3. Los Fogones de Hierro',
    subtitle: 'Plancha de fundición: sobrecarga los puentes de calor (+35% daño)',
    woodColor: '#334155',
    tileColor: '#ffedd5',
    speedMult: 1.1,
  },
  pastry_marble: {
    name: '4. El Obrador de Pastelería',
    subtitle: 'Mármol blanco y caramelo: frena enjambres rápidos un 25%',
    woodColor: '#f1f5f9',
    tileColor: '#fce7f3',
    speedMult: 0.92,
  },
};

export interface TutorialTargetCell {
  pieceId: string;
  pieceType: UtensilType;
  rail: number; // 0-indexed (0 = Raíl 1, 1 = Raíl 2, 2 = Raíl 3, 3 = Raíl 4)
  row: number;  // 0-indexed (0 = Fila 1, 2 = Fila 3, 4 = Fila 5)
  label: string;
}

export interface TutorialLevelGuide {
  level: number;
  mechanicTitle: string;
  targets: TutorialTargetCell[];
  nextTarget: TutorialTargetCell | null;
  allTargetsPlaced: boolean;
  stepInstruction: string;
}

/**
 * Returns the level speed multiplier:
 * Reduces bug walking speed by 45% (0.55x) on Levels 1, 2, 3, and 4 so the player has plenty
 * of time to watch them advance cell-by-cell, think, and move pieces with their finger!
 */
export function getLevelSpeedMultiplier(level: number): number {
  if (level <= 4) return 0.55; // -45% human speed on onboarding levels 1, 2, 3, 4
  return Math.min(1.15, 0.75 + (level - 5) * 0.06);
}

/**
 * Returns the exact number of utensils for a given level:
 * - Level 1: 2 pieces ONLY (1 Estropajo + 1 Flus-Flus)
 * - Level 2: 3 pieces ONLY (2 Aerosoles UV + 1 Flus-Flus)
 * - Level 3: 3 pieces ONLY (1 Jabón 45° + 1 Fregona Turbo-Spin + 1 Flus-Flus)
 * - Level 4: 4 pieces ONLY (combine learned mechanics without pre-marked cells)
 * - Level 5+: 5–6 pieces max (never 8 or 9!)
 */
export function getMaxPiecesForLevel(level: number): number {
  if (level === 1) return 2;
  if (level === 2) return 3;
  if (level === 3) return 3;
  if (level === 4) return 4;
  return Math.min(6, 4 + (level - 4));
}

/**
 * Returns step-by-step tutorial cell targets for Levels 1, 2, and 3.
 * Note: 0-indexed (rail: 1, row: 2) corresponds to human-readable [Raíl 2, Fila 3],
 * and (rail: 1, row: 4) corresponds to [Raíl 2, Fila 5].
 */
export function getTutorialGuideForLevel(
  level: number,
  pieces: UtensilPiece[]
): TutorialLevelGuide | null {
  if (level === 1) {
    const targets: TutorialTargetCell[] = [
      {
        pieceId: 'u-scourer-1',
        pieceType: 'scourer_nanas',
        rail: 1,
        row: 2,
        label: '🧽 Estropajo en [Raíl 2, Fila 3]',
      },
      {
        pieceId: 'u-spray-1',
        pieceType: 'spray_flus',
        rail: 1,
        row: 4,
        label: '🔫 Flus-Flus detrás en [Raíl 2, Fila 5]',
      },
    ];
    const nextTarget =
      targets.find((t) => {
        const found = pieces.find((p) => p.id === t.pieceId || p.type === t.pieceType);
        return !found || found.rail !== t.rail || found.row !== t.row;
      }) ?? null;

    return {
      level: 1,
      mechanicTitle: 'TUTORIAL NIVEL 1 · COMBO EN LÍNEA (ABANICO ×5)',
      targets,
      nextTarget,
      allTargetsPlaced: nextTarget === null,
      stepInstruction:
        nextTarget?.pieceType === 'scourer_nanas'
          ? '👆 PASO 1/2: Toca la casilla brillante [Raíl 2, Fila 3] para colocar el 🧽 Estropajo delante'
          : nextTarget?.pieceType === 'spray_flus'
          ? '👆 PASO 2/2: Ahora toca [Raíl 2, Fila 5] para poner el 🔫 Flus-Flus detrás y crear el Abanico ×5'
          : '✅ ¡COMBO EN LÍNEA LISTO! Pulsa "¡EMPEZAR OLEADA!" o mueve el combo si cambian de raíl',
    };
  }

  if (level === 2) {
    const targets: TutorialTargetCell[] = [
      {
        pieceId: 'u-aerosol-1',
        pieceType: 'aerosol_torch',
        rail: 1,
        row: 2,
        label: '🔥 Aerosol UV 1 en [Raíl 2, Fila 3]',
      },
      {
        pieceId: 'u-aerosol-2',
        pieceType: 'aerosol_torch',
        rail: 2,
        row: 2,
        label: '🔥 Aerosol UV 2 al lado en [Raíl 3, Fila 3]',
      },
      {
        pieceId: 'u-spray-1',
        pieceType: 'spray_flus',
        rail: 1,
        row: 4,
        label: '🔫 Flus-Flus detrás en [Raíl 2, Fila 5]',
      },
    ];
    const nextTarget =
      targets.find((t) => {
        const found = pieces.find((p) => p.id === t.pieceId);
        return !found || found.rail !== t.rail || found.row !== t.row;
      }) ?? null;

    return {
      level: 2,
      mechanicTitle: 'TUTORIAL NIVEL 2 · PUENTE LÁSER UV (FUNDE-CHAPAS)',
      targets,
      nextTarget,
      allTargetsPlaced: nextTarget === null,
      stepInstruction:
        nextTarget?.pieceId === 'u-aerosol-1'
          ? '👆 PASO 1/3: Coloca el primer 🔥 Aerosol UV en [Raíl 2, Fila 3]'
          : nextTarget?.pieceId === 'u-aerosol-2'
          ? '👆 PASO 2/3: Coloca el segundo 🔥 Aerosol UV al lado en [Raíl 3, Fila 3] para unir el Puente UV'
          : nextTarget?.pieceId === 'u-spray-1'
          ? '👆 PASO 3/3: Coloca el 🔫 Flus-Flus en [Raíl 2, Fila 5] para rematar a las Ratas sin chapa'
          : '✅ ¡PUENTE UV ACTIVO! Fundirá el escudo 100% blindado de las Ratas al cruzar',
    };
  }

  if (level === 3) {
    const targets: TutorialTargetCell[] = [
      {
        pieceId: 'u-soap-1',
        pieceType: 'soap_bar',
        rail: 2,
        row: 2,
        label: '🧼 Jabón 45° en [Raíl 3, Fila 3]',
      },
      {
        pieceId: 'u-mop-1',
        pieceType: 'mop_vortex',
        rail: 1,
        row: 2,
        label: '🌪️ Fregona 360° al lado en [Raíl 2, Fila 3]',
      },
      {
        pieceId: 'u-spray-1',
        pieceType: 'spray_flus',
        rail: 1,
        row: 4,
        label: '🔫 Flus-Flus de apoyo en [Raíl 2, Fila 5]',
      },
    ];
    const nextTarget =
      targets.find((t) => {
        const found = pieces.find((p) => p.id === t.pieceId);
        return !found || found.rail !== t.rail || found.row !== t.row;
      }) ?? null;

    return {
      level: 3,
      mechanicTitle: 'TUTORIAL NIVEL 3 · DESVÍO 3★ (JABÓN + FREGONA 360°)',
      targets,
      nextTarget,
      allTargetsPlaced: nextTarget === null,
      stepInstruction:
        nextTarget?.pieceId === 'u-soap-1'
          ? '👆 PASO 1/3: Pon la 🧼 Pastilla de Jabón en [Raíl 3, Fila 3] por donde baja la Rata Blindada'
          : nextTarget?.pieceId === 'u-mop-1'
          ? '👆 PASO 2/3: Pon la 🌪️ Fregona Turbo-Spin al lado en [Raíl 2, Fila 3] para centrifugarla 3★'
          : nextTarget?.pieceId === 'u-spray-1'
          ? '👆 PASO 3/3: Coloca el 🔫 Flus-Flus en [Raíl 2, Fila 5] para rematar'
          : '✅ ¡TRAMPA 3★ LISTA! El jabón hará patinar a la plaga directo a la Fregona',
    };
  }

  return null;
}

/**
 * Evaluates spatial combos on the 4x6 rail grid and returns updated pieces + glowing circuit links.
 */
export function evaluateBoardCombos(pieces: UtensilPiece[]): {
  updatedPieces: UtensilPiece[];
  links: CircuitLink[];
} {
  const links: CircuitLink[] = [];
  const nextPieces = pieces.map((p) => ({ ...p, comboType: 'none' as UtensilPiece['comboType'] }));

  const findAt = (rail: number, row: number) =>
    nextPieces.find((p) => p.rail === rail && p.row === row);

  for (const piece of nextPieces) {
    if (piece.rail === null || piece.row === null) continue;

    // 1. COMBO EN LÍNEA: [Spray o Lejía] + [Estropajo] a 1 o 2 casillas en el mismo raíl
    if (piece.type === 'spray_flus' || piece.type === 'bleach_cannon') {
      const front1 = findAt(piece.rail, piece.row - 1);
      const front2 = findAt(piece.rail, piece.row - 2);
      const back1 = findAt(piece.rail, piece.row + 1);
      const back2 = findAt(piece.rail, piece.row + 2);
      const scourer =
        front1?.type === 'scourer_nanas'
          ? front1
          : front2?.type === 'scourer_nanas'
          ? front2
          : back1?.type === 'scourer_nanas'
          ? back1
          : back2?.type === 'scourer_nanas'
          ? back2
          : null;

      if (scourer && scourer.rail !== null && scourer.row !== null) {
        piece.comboType = 'line_foam';
        scourer.comboType = 'line_foam';
        links.push({
          fromRail: piece.rail,
          fromRow: piece.row,
          toRail: scourer.rail,
          toRow: scourer.row,
          kind: 'line_foam',
        });
      }
    }

    // 2. COMBO PUENTE HORIZONTAL: Dos [Aerosol UV] en la misma fila en raíles vecinos (rail y rail + 1)
    if (piece.type === 'aerosol_torch') {
      const neighbor = findAt(piece.rail + 1, piece.row);
      if (neighbor && neighbor.type === 'aerosol_torch') {
        piece.comboType = 'bridge_uv';
        neighbor.comboType = 'bridge_uv';
        links.push({
          fromRail: piece.rail,
          fromRow: piece.row,
          toRail: piece.rail + 1,
          toRow: piece.row,
          kind: 'bridge_uv',
        });
      }
    }

    // 3. COMBO DESVÍO A VÓRTICE (3★): [Pastilla de Jabón] en un raíl + [Fregona Turbo-Spin] en el raíl vecino (misma fila o ±1)
    if (piece.type === 'soap_bar') {
      for (const dRail of [-1, 1]) {
        for (const dRow of [-1, 0, 1]) {
          const target = findAt(piece.rail + dRail, piece.row + dRow);
          if (target && target.type === 'mop_vortex' && target.rail !== null && target.row !== null) {
            piece.comboType = 'slip_vortex';
            target.comboType = 'slip_vortex';
            links.push({
              fromRail: piece.rail,
              fromRow: piece.row,
              toRail: target.rail,
              toRow: target.row,
              kind: 'slip_vortex',
            });
          }
        }
      }
    }

    // 4. MURO REFLECTOR
    if (piece.type === 'wc_shield') {
      piece.comboType = 'shield_reflect';
    }
  }

  return { updatedPieces: nextPieces, links };
}

/**
 * Moves a utensil piece to (targetRail, targetRow).
 * If another piece already occupies (targetRail, targetRow), performs an instant Direct Swap!
 * Also clears any gunkTimer ("Pringue de Mugre") and sets the 0.3s magnetic snap cooldown.
 */
export function moveOrSwapUtensil(
  pieces: UtensilPiece[],
  pieceId: string,
  targetRail: number | null,
  targetRow: number | null
): UtensilPiece[] {
  // Prohibido colocar piezas en Fila 1 y Fila 2 (0-indexed row 0 y row 1)
  if (targetRow !== null && targetRow < MIN_PLACEABLE_ROW) {
    return pieces;
  }
  const moving = pieces.find((p) => p.id === pieceId);
  if (!moving) return pieces;

  const prevRail = moving.rail;
  const prevRow = moving.row;

  // Check if destination on board is occupied by another piece
  const occupant =
    targetRail !== null && targetRow !== null
      ? pieces.find(
          (p) => p.id !== pieceId && p.rail === targetRail && p.row === targetRow
        )
      : undefined;

  const updated = pieces.map((p) => {
    if (p.id === pieceId) {
      return {
        ...p,
        rail: targetRail,
        row: targetRow,
        cooldown: 0.3,
        gunkTimer: 0, // Moving/shaking cleans gunk immediately!
      };
    }
    if (occupant && p.id === occupant.id) {
      return {
        ...p,
        rail: prevRail,
        row: prevRow,
        cooldown: 0.3,
        gunkTimer: 0,
      };
    }
    return p;
  });

  return evaluateBoardCombos(updated).updatedPieces;
}

/**
 * Classifies how a bug was defeated into 1★, 2★, or 3★ for the Comic Pop-up & Achievement system.
 */
export function classifyBugElimination(bug: BugEnemy): {
  stars: KillStarRating;
  comicTitle: string;
  comicSubtitle: string;
  achievementId: string | null;
} {
  // 3★ Master Kill: Slipped on soap bar AND centrifuged by Mop Vortex (or full combo on Wasp/Crab)
  if (bug.isSlidingFromSoap && bug.hitByVortexSpin) {
    const achId =
      bug.type === 'cap_beetle'
        ? 'beetle_3star'
        : bug.type === 'acid_wasp'
        ? 'wasp_3star'
        : bug.type === 'king_crab'
        ? 'crab_3star'
        : null;
    return {
      stars: 3,
      comicTitle: '¡LIMPIEZA PROFUNDA 3★!',
      comicSubtitle: '¡DING! Jabón + Centrifugado Maestro',
      achievementId: achId,
    };
  }

  // 2★ Tactical Kill: Flanked by diagonal foam from Scourer without breaking shield by brute force, or reflected acid
  if (bug.hitByDiagonalFoam) {
    const achId =
      bug.type === 'cap_beetle'
        ? 'beetle_2star'
        : bug.type === 'acid_wasp'
        ? 'wasp_2star'
        : null;
    return {
      stars: 2,
      comicTitle: '¡EXFOLIACIÓN LETAL 2★!',
      comicSubtitle: 'Espuma en abanico por el flanco',
      achievementId: achId,
    };
  }

  // 1★ Direct / Bridge Kill
  const achId = bug.type === 'cap_beetle' && bug.hitByBridgeBurn ? 'beetle_1star' : null;
  return {
    stars: 1,
    comicTitle: '¡DESINFECTADO! 1★',
    comicSubtitle: bug.hitByBridgeBurn ? 'Chapa fundida con Aerosol UV' : 'Plaga eliminada',
    achievementId: achId,
  };
}

/**
 * Calculates deterministic phase transitions (Fase 1 -> Fase 2 -> Fase 3) based on kills.
 * On Levels 1-4, we never dump extra random weapons mid-level so the tutorial piece count stays strict!
 */
export function checkPhaseTransition(
  currentPhase: 1 | 2 | 3,
  phaseKills: number,
  level: number
): {
  shouldAdvance: boolean;
  nextPhase: 1 | 2 | 3 | 'victory';
  targetKillsForCurrentPhase: number;
  unlockedUtensilOnAdvance: UtensilType | null;
} {
  const baseTarget = level <= 3 ? 3 : Math.min(4 + Math.floor(level * 0.5), 7);
  const targetForPhase =
    currentPhase === 1 ? baseTarget : currentPhase === 2 ? baseTarget + 1 : baseTarget + 1;

  if (phaseKills < targetForPhase) {
    return {
      shouldAdvance: false,
      nextPhase: currentPhase,
      targetKillsForCurrentPhase: targetForPhase,
      unlockedUtensilOnAdvance: null,
    };
  }

  if (currentPhase === 1) {
    return {
      shouldAdvance: true,
      nextPhase: 2,
      targetKillsForCurrentPhase: targetForPhase,
      unlockedUtensilOnAdvance: level >= 5 ? 'aerosol_torch' : null,
    };
  }

  if (currentPhase === 2) {
    return {
      shouldAdvance: true,
      nextPhase: 3,
      targetKillsForCurrentPhase: targetForPhase,
      unlockedUtensilOnAdvance: level >= 5 ? 'mop_vortex' : null,
    };
  }

  return {
    shouldAdvance: true,
    nextPhase: 'victory',
    targetKillsForCurrentPhase: targetForPhase,
    unlockedUtensilOnAdvance: null,
  };
}

/**
 * Progressive Onboarding Loadout per Level:
 * CRITICAL RULE 1: THE BOARD STARTS EMPTY (`rail: null, row: null` in the bottom tray)
 * so pieces never start firing on their own before the player places them!
 * - Level 1 (ONLY 2 PIECES): 1 Estropajo + 1 Flus-Flus (Tutorial Combo en Línea)
 * - Level 2 (ONLY 3 PIECES): 2 Aerosoles UV + 1 Flus-Flus (Tutorial Puente UV contra Ratas Blindadas)
 * - Level 3 (ONLY 3 PIECES): 1 Jabón 45° + 1 Fregona Turbo-Spin + 1 Flus-Flus (Tutorial Desvío 3★)
 * - Level 4 (ONLY 4 PIECES): 1 Flus-Flus + 1 Estropajo + 1 Jabón 45° + 1 Fregona Turbo-Spin
 * - Level 5+ (5 pieces, max 6): Full tactical toolkit
 */
export function createInitialBoardPieces(level = 1): UtensilPiece[] {
  let initial: UtensilPiece[];

  if (level === 1) {
    initial = [
      {
        id: 'u-scourer-1',
        type: 'scourer_nanas',
        level: 1,
        rail: null,
        row: null,
        gunkTimer: 0,
        cooldown: 0,
        fireTimer: 0,
        comboType: 'none',
      },
      {
        id: 'u-spray-1',
        type: 'spray_flus',
        level: 1,
        rail: null,
        row: null,
        gunkTimer: 0,
        cooldown: 0,
        fireTimer: 0.35,
        comboType: 'none',
      },
    ];
  } else if (level === 2) {
    initial = [
      {
        id: 'u-aerosol-1',
        type: 'aerosol_torch',
        level: 1,
        rail: null,
        row: null,
        gunkTimer: 0,
        cooldown: 0,
        fireTimer: 0,
        comboType: 'none',
      },
      {
        id: 'u-aerosol-2',
        type: 'aerosol_torch',
        level: 1,
        rail: null,
        row: null,
        gunkTimer: 0,
        cooldown: 0,
        fireTimer: 0,
        comboType: 'none',
      },
      {
        id: 'u-spray-1',
        type: 'spray_flus',
        level: 1,
        rail: null,
        row: null,
        gunkTimer: 0,
        cooldown: 0,
        fireTimer: 0.35,
        comboType: 'none',
      },
    ];
  } else if (level === 3) {
    initial = [
      {
        id: 'u-soap-1',
        type: 'soap_bar',
        level: 1,
        rail: null,
        row: null,
        gunkTimer: 0,
        cooldown: 0,
        fireTimer: 0,
        comboType: 'none',
      },
      {
        id: 'u-mop-1',
        type: 'mop_vortex',
        level: 1,
        rail: null,
        row: null,
        gunkTimer: 0,
        cooldown: 0,
        fireTimer: 0.3,
        comboType: 'none',
      },
      {
        id: 'u-spray-1',
        type: 'spray_flus',
        level: 1,
        rail: null,
        row: null,
        gunkTimer: 0,
        cooldown: 0,
        fireTimer: 0.35,
        comboType: 'none',
      },
    ];
  } else if (level === 4) {
    initial = [
      {
        id: 'u-scourer-1',
        type: 'scourer_nanas',
        level: 1,
        rail: null,
        row: null,
        gunkTimer: 0,
        cooldown: 0,
        fireTimer: 0,
        comboType: 'none',
      },
      {
        id: 'u-spray-1',
        type: 'spray_flus',
        level: 1,
        rail: null,
        row: null,
        gunkTimer: 0,
        cooldown: 0,
        fireTimer: 0.3,
        comboType: 'none',
      },
      {
        id: 'u-soap-1',
        type: 'soap_bar',
        level: 1,
        rail: null,
        row: null,
        gunkTimer: 0,
        cooldown: 0,
        fireTimer: 0,
        comboType: 'none',
      },
      {
        id: 'u-mop-1',
        type: 'mop_vortex',
        level: 1,
        rail: null,
        row: null,
        gunkTimer: 0,
        cooldown: 0,
        fireTimer: 0.3,
        comboType: 'none',
      },
    ];
  } else {
    initial = [
      {
        id: 'u-scourer-1',
        type: 'scourer_nanas',
        level: 1,
        rail: null,
        row: null,
        gunkTimer: 0,
        cooldown: 0,
        fireTimer: 0,
        comboType: 'none',
      },
      {
        id: 'u-spray-1',
        type: 'spray_flus',
        level: 1,
        rail: null,
        row: null,
        gunkTimer: 0,
        cooldown: 0,
        fireTimer: 0.25,
        comboType: 'none',
      },
      {
        id: 'u-aerosol-1',
        type: 'aerosol_torch',
        level: 1,
        rail: null,
        row: null,
        gunkTimer: 0,
        cooldown: 0,
        fireTimer: 0,
        comboType: 'none',
      },
      {
        id: 'u-aerosol-2',
        type: 'aerosol_torch',
        level: 1,
        rail: null,
        row: null,
        gunkTimer: 0,
        cooldown: 0,
        fireTimer: 0,
        comboType: 'none',
      },
      {
        id: 'u-soap-1',
        type: 'soap_bar',
        level: 1,
        rail: null,
        row: null,
        gunkTimer: 0,
        cooldown: 0,
        fireTimer: 0,
        comboType: 'none',
      },
    ];
  }

  return evaluateBoardCombos(initial).updatedPieces;
}

export const DEFAULT_PROGRESS: PlayerProgress = {
  currentLevel: 1,
  highestLevel: 1,
  currentWorld: 'sunny_counter',
  unlockedWorlds: ['sunny_counter'],
  coins: 240,
  unlockedAchievements: [],
  unlockedHats: ['classic_toque'],
  unlockedArmors: ['white_apron'],
  unlockedSpecials: ['karcher_blast'],
  equippedHat: 'classic_toque',
  equippedArmor: 'white_apron',
  equippedSpecial: 'karcher_blast',
  bestScore: 0,
  totalBugsCleaned: 0,
};

/**
 * Pure helper that builds floating combo notification metadata when a placed/moved
 * utensil connects a valid spatial combo on the countertop.
 */
export function buildPlacementComboNotification(
  pieces: UtensilPiece[],
  movedPieceId: string,
  chainBonus = 0
): {
  multiplier: number;
  label: string;
  detail: string;
  color: 'yellow' | 'cyan' | 'orange' | 'pink' | 'green';
  comboType: UtensilPiece['comboType'];
  rail: number;
  row: number;
} | null {
  const { updatedPieces, links } = evaluateBoardCombos(pieces);
  const moved = updatedPieces.find((p) => p.id === movedPieceId);
  if (!moved || moved.comboType === 'none' || moved.rail === null || moved.row === null) {
    return null;
  }

  const activeComboLinks = Math.max(1, links.length);
  const multiplier = Math.max(2, activeComboLinks + 1 + Math.max(0, chainBonus));
  const label = `¡Combo x${multiplier}!`;

  let detail = '⚡ Sinergia Activa';
  let color: 'yellow' | 'cyan' | 'orange' | 'pink' | 'green' = 'yellow';

  if (moved.comboType === 'line_foam') {
    detail = '🫧 Abanico Espuma ×5';
    color = 'green';
  } else if (moved.comboType === 'bridge_uv') {
    detail = '🔥 Puente Fuego UV';
    color = 'orange';
  } else if (moved.comboType === 'slip_vortex') {
    detail = '🌪️ Vórtice 360° 3★';
    color = 'cyan';
  }

  return {
    multiplier,
    label,
    detail,
    color,
    comboType: moved.comboType,
    rail: moved.rail,
    row: moved.row,
  };
}

