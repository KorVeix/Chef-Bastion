import {
  AchievementDef,
  ArmorId,
  BiomeConfig,
  BiomeId,
  BossPuzzleType,
  BossTier,
  BugEnemy,
  BugType,
  GameSettings,
  HatId,
  KillStarRating,
  LevelForecast,
  PlayerProgress,
  RangePreviewCell,
  SmartComboHint,
  SpecialWeaponId,
  TacticalOnboardingCardData,
  UtensilPiece,
  UtensilType,
  WorldId,
} from './types';

export const GRID_RAILS = 4;
export const GRID_ROWS = 7; // Row 0 = top (near conduits), Row 6 = bottom playable row (plates sit 1 step below at z = +4.2)
export const MIN_PLACEABLE_ROW = 2; // Filas 3 a 7 únicamente (prohibido colocar en Filas 1 y 2)
export const MAX_CAMPAIGN_LEVELS = 60;
export const LEVEL_DURATION_SECONDS = 120; // 2 minutos (120s) por nivel a partir del Nivel 5
export const DEV_UNLOCK_ALL_WORLDS = false;

export const WORLD_UNLOCK_LEVELS: Record<WorldId, number> = {
  sunny_counter: 1,
  fridge_vault: 11,
  iron_stoves: 21,
  pastry_marble: 31,
};

export const STRATEGIC_BOOST_ULTIMATE_COST = 60;
export const STRATEGIC_BOOST_SHIELD_COST = 80;

export interface CircuitLink {
  fromRail: number;
  fromRow: number;
  toRail: number;
  toRow: number;
  kind: 'line_foam' | 'bridge_uv' | 'slip_vortex' | 'deflect_90';
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
    icon: '⚡',
    accentHex: '#a855f7',
    roleHint: 'Une 2 en la misma fila para láser UV funde-chapas',
    comboRecipe: '⚡ + ⚡ en raíles vecinos = Láser UV Violeta',
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
  corner_square: {
    type: 'corner_square',
    name: 'Escuadra Deflectora 90°',
    shortName: 'Escuadra 90°',
    icon: '📐',
    accentHex: '#facc15',
    roleHint: '0 daño propio: rebota 90° a los bichos laterales hacia tu carril',
    comboRecipe: '📐 intercepta invasión lateral ➔ redirige directo a ⚡/🧽',
  },
};

/**
 * <= 4-word micro-summary shown on 350ms long-press over any tray card.
 */
export const UTENSIL_MICRO_TIPS: Record<UtensilType, string> = {
  spray_flus: 'Pulveriza recto al frente',
  scourer_nanas: 'Divide disparos en ×5',
  aerosol_torch: 'Láser UV funde-chapas',
  soap_bar: 'Desvía al carril vecino',
  mop_vortex: 'Vórtice espiral 360°',
  wc_shield: 'Rebota ácido enemigo',
  bleach_cannon: 'Chorro corrosivo pesado',
  corner_square: 'Gira laterales a 90°',
};

// ============================================================================
// BIOME PROGRESSION MANAGER (CICLO DE 19 NIVELES + LOOP INFINITO NIVEL 96+)
// ============================================================================

const BIOME_DEFINITIONS: Omit<
  BiomeConfig,
  'rawBiomeIndex' | 'biomeIndex' | 'cycleCount' | 'cycleSpeedMultiplier'
>[] = [
  {
    id: 'main_kitchen',
    name: 'Bioma 0: La Cocina Principal',
    shortName: 'Cocina Principal',
    subtitle: 'Azulejos blancos industriales, acero inoxidable y encimera de arce (Fricción 1.0)',
    zoneBanner: '¡Nueva Zona: La Cocina Principal!',
    wallHex: '#ffffff',
    counterHex: '#ffffff',
    sideCounterHex: '#925226',
    floorHex: '#4d2b14',
    trimHex: '#b4692c',
    friction: 1.0,
    bounciness: 1.0,
    lateralWindForce: 0,
  },
  {
    id: 'dining_hall',
    name: 'Bioma 1: El Comedor / Sala',
    shortName: 'El Comedor',
    subtitle: 'Manteles elegantes de alta fricción (1.4f), copas de cristal y carritos de postre',
    zoneBanner: '¡Nueva Zona: El Comedor!',
    wallHex: '#fef3c7',
    counterHex: '#fff1f2',
    sideCounterHex: '#7c2d12',
    floorHex: '#451a03',
    trimHex: '#9f1239',
    friction: 1.4,
    bounciness: 1.0,
    lateralWindForce: 0,
  },
  {
    id: 'tavern_bar',
    name: 'Bioma 2: El Bar / Taberna',
    shortName: 'El Bar',
    subtitle: 'Barra húmeda deslizante (Fricción 0.35f) y taburetes elásticos (Rebote 0.6f)',
    zoneBanner: '¡Nueva Zona: El Bar!',
    wallHex: '#7f1d1d',
    counterHex: '#d97706',
    sideCounterHex: '#451a03',
    floorHex: '#1c1917',
    trimHex: '#78350f',
    friction: 0.35,
    bounciness: 0.6,
    lateralWindForce: 0,
  },
  {
    id: 'freezer_vault',
    name: 'Bioma 3: Cámara Frigorífica / Despensa',
    shortName: 'Cámara Frigorífica',
    subtitle: 'Paneles térmicos helados, hielo con fricción casi nula (0.08f) y ganchos oscilantes',
    zoneBanner: '¡Nueva Zona: Cámara Frigorífica!',
    wallHex: '#bae6fd',
    counterHex: '#7dd3fc',
    sideCounterHex: '#0369a1',
    floorHex: '#0c4a6e',
    trimHex: '#0284c7',
    friction: 0.08,
    bounciness: 0.9,
    lateralWindForce: 0.12,
  },
  {
    id: 'rooftop_terrace',
    name: 'Bioma 4: Terraza / Azotea Gourmet',
    shortName: 'Azotea Gourmet',
    subtitle: 'Atardecer urbano, sombrillas elásticas (Rebote 0.85f) y brisa lateral en trayectorias',
    zoneBanner: '¡Nueva Zona: Terraza Gourmet!',
    wallHex: '#c4b5fd',
    counterHex: '#fde68a',
    sideCounterHex: '#3f6212',
    floorHex: '#1e1b4b',
    trimHex: '#ca8a04',
    friction: 0.9,
    bounciness: 0.85,
    lateralWindForce: 0.32,
  },
];

/**
 * Evaluates `currentLevel` and dynamically selects visual context, obstacles, and physics
 * every 19 levels: `rawBiomeIndex = Math.floor((currentLevel - 1) / 19)`.
 * If `rawBiomeIndex >= 5` (Level 96+), loops with `rawBiomeIndex % 5` and adds +10% speed per cycle.
 */
export function getBiomeForLevel(currentLevel: number): BiomeConfig {
  const safeLevel = Math.max(1, Math.floor(currentLevel));
  const rawBiomeIndex = Math.floor((safeLevel - 1) / 19);
  const biomeIndex = rawBiomeIndex % 5;
  const cycleCount = Math.floor(rawBiomeIndex / 5);
  const cycleSpeedMultiplier = Number((1 + cycleCount * 0.1).toFixed(2));
  const base = BIOME_DEFINITIONS[biomeIndex];

  return {
    ...base,
    rawBiomeIndex,
    biomeIndex,
    cycleCount,
    cycleSpeedMultiplier,
  };
}

/**
 * Returns true on levels 1, 20, 39, 58, 77, 96... when a new Biome transition occurs.
 */
export function isBiomeTransitionLevel(currentLevel: number): boolean {
  const safeLevel = Math.max(1, Math.floor(currentLevel));
  return (safeLevel - 1) % 19 === 0;
}

/**
 * Returns the establishment name every 10 levels for the 60-level campaign selector.
 */
export function getEstablishmentForLevel(currentLevel: number): string {
  const idx = Math.floor((Math.max(1, currentLevel) - 1) / 10);
  const names = [
    '1. Bistró La Encimera (Nv. 1-10)',
    '2. Trattoria Vapor & Acero (Nv. 11-20)',
    '3. Gran Comedor Imperial (Nv. 21-30)',
    '4. Taberna Neón & Conductos (Nv. 31-40)',
    '5. Bastión de Brasas Nocturno (Nv. 41-50)',
    '6. Cámara Frigorífica Suprema (Nv. 51-60)',
  ];
  return names[Math.min(names.length - 1, idx)];
}

/**
 * Returns Zelda-style Boss Puzzle type on milestone levels (every 5 levels: 5, 10, 15... 60).
 */
export function getBossTierForLevel(currentLevel: number): BossTier | null {
  if (currentLevel < 5 || currentLevel % 5 !== 0) return null;
  return currentLevel % 10 === 0 ? 'grand' : 'mini';
}

/**
 * Returns Boss mechanic archetype on milestone levels (every 5 levels: 5, 10, 15... 60).
 */
export function getBossPuzzleTypeForLevel(currentLevel: number): BossPuzzleType | null {
  if (currentLevel < 5 || currentLevel % 5 !== 0) return null;
  if (currentLevel >= 35 && currentLevel % 10 === 5) return 'square_deflect';
  if (currentLevel % 10 === 0) return 'uv_overheat';
  return 'soap_stun';
}

export function getGrandBossPhase(hp: number, maxHp: number): 1 | 2 | 3 {
  const safeMax = Math.max(1, maxHp);
  const pct = (Math.max(0, hp) / safeMax) * 100;
  if (pct > 66) return 1;
  if (pct > 33) return 2;
  return 3;
}

export function getGrandBossPhaseLabel(phase: 1 | 2 | 3, tier: BossTier): string {
  if (tier === 'mini') return 'MINI-JEFE · RESISTENCIA FRONTAL';
  if (phase === 1) return 'FASE 1/3 · CORAZA PESADA (-65% Básico · ×2.5 UV/Explosivo)';
  if (phase === 2) return 'FASE 2/3 · SABOTAJE Y EVASIÓN (Ácido y Cambio de Carril)';
  return 'FASE 3/3 · FRENESÍ FINAL (+30% Velocidad y Emboscada)';
}

/**
 * Non-rigid boss damage multiplier: NO phase is ever 100% immune so the player never hits an unfair soft-lock,
 * while counter mechanics are strongly rewarded (x2.5 thermal/laser/explosive in P1, x1.75 control in P2, x1.5 geometry/ultimate in P3).
 */
export function computeBossDamageMultiplier(opts: {
  tier: BossTier;
  phase: 1 | 2 | 3;
  armorBroken: boolean;
  isThermalOrExplosive: boolean;
  isControlCombo: boolean;
}): number {
  const { tier, phase, armorBroken, isThermalOrExplosive, isControlCombo } = opts;
  if (tier === 'mini') {
    if (!armorBroken) {
      return isThermalOrExplosive || isControlCombo ? 2.2 : 0.5;
    }
    return isThermalOrExplosive || isControlCombo ? 1.8 : 1.0;
  }

  // Grand Boss (3 real-time HP phases)
  if (phase === 1) {
    if (isThermalOrExplosive) return 2.5;
    if (armorBroken) return 1.0;
    return 0.35; // -65% frontal basic damage (never 0!)
  }
  if (phase === 2) {
    if (isControlCombo || isThermalOrExplosive) return 1.75;
    return 1.0;
  }
  // Phase 3: Frenzy / Ambush
  if (isThermalOrExplosive || isControlCombo) return 1.5;
  return 1.1;
}

export function isWorldUnlocked(worldId: WorldId, progress: PlayerProgress): boolean {
  if (DEV_UNLOCK_ALL_WORLDS) return true;
  if (worldId === 'sunny_counter') return true;
  if (progress.unlockedWorlds.includes(worldId)) return true;
  return progress.highestLevel >= WORLD_UNLOCK_LEVELS[worldId];
}

export const ACHIEVEMENTS_CATALOG: AchievementDef[] = [
  {
    id: 'ant_2star',
    bugType: 'speed_ant',
    star: 2,
    title: '¡BARRIDO EN ABANICO! 2★',
    recipeIcons: ['🔫', '➔', '🧽', '↗️', '🐜'],
    description: 'Elimina a la Hormiga Velocista con las burbujas diagonales del Abanico de Espuma ×5.',
    rewardType: 'hat',
    rewardId: 'bucket_helmet',
    rewardLabel: 'Barreño Militar Volcado (-50% duración pringue)',
    unlockCostCoins: 180,
  },
  {
    id: 'beetle_1star',
    bugType: 'cap_beetle',
    star: 1,
    title: '¡DESINFECTADO! 1★',
    recipeIcons: ['⚡', '➕', '⚡', '➔', '🐀'],
    description: 'Funde la chapa de la Rata Blindada con un Puente Láser UV violeta y remátala.',
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
    rewardLabel: 'Traje EPI Amarillo (Absorbe el 1er golpe o ácido de cada nivel)',
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
    id: 'roach_3star',
    bugType: 'shift_roach',
    star: 3,
    title: '¡INTERCEPCIÓN TÁCTICA! 3★',
    recipeIcons: ['📐', '➔', '🧼', '🌪️', '🪳'],
    description: 'Caza a la Cucaracha Saltarraíl redirigiéndola con Escuadra 90° o centrifugándola con Jabón + Fregona.',
    rewardType: 'special_weapon',
    rewardId: 'baking_volcano',
    rewardLabel: 'Volcán de Bicarbonato + Vinagre (Funde Corazas)',
    unlockCostCoins: 320,
  },
  {
    id: 'crab_3star',
    bugType: 'king_crab',
    star: 3,
    title: '¡INSPECCIÓN SUPERADA! 3★',
    recipeIcons: ['⚡', '➕', '🧼', '➔', '🌪️'],
    description: 'Rompe las fases del Rey Jefe con Láser UV y centrifúgalo con la Fregona Turbo-Spin.',
    rewardType: 'armor',
    rewardId: 'golden_scourer_mail',
    rewardLabel: 'Peto de Estropajos Dorados (+35% Carga Ultimate)',
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
    bonus: 'Absorbe el 1er golpe o ácido de cada nivel',
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
  row: number;  // 0-indexed (2 = Fila 3, 3 = Fila 4, 4 = Fila 5)
  label: string;
  shortTag: string; // Minimal floating tag over target cell (e.g. "⚡ PUENTE UV")
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
 * Levels 1, 2, and 3 skip Strategic Mode pause and start directly in live dynamic onboarding.
 */
export function isDynamicOnboardingLevel(level: number): boolean {
  return level >= 1 && level <= 3;
}

/**
 * Returns the Tactical Onboarding Card visual diagram for Levels 1, 2, 3, and 31.
 */
export function getTacticalOnboardingCard(level: number): TacticalOnboardingCardData | null {
  if (level === 1) {
    return {
      level: 1,
      badge: 'TUTORIAL NIVEL 1 · COMBO EN LÍNEA',
      title: 'Abanico de Espuma ×5',
      subtitle:
        'Coloca el Estropajo delante y el Spray Flus-Flus detrás en el mismo raíl para multiplicar cada disparo en 5 burbujas diagonales.',
      cells: [
        {
          rail: 2,
          row: 3,
          icon: '🧽',
          label: '1º Estropajo [R2, F3]',
          highlightColor: 'green',
        },
        {
          rail: 2,
          row: 5,
          icon: '🔫',
          label: '2º Flus-Flus [R2, F5]',
          highlightColor: 'cyan',
        },
      ],
      flowArrowLabel: '🔫 dispara hacia arriba ➔ choca con 🧽 ➔ ¡5 Burbujas en Abanico!',
      rewardTitle: '🎁 Recompensa 2★: Gorro de Ducha con Patito',
      rewardExplanation:
        'Eliminar Ratas Blindadas por el flanco con espuma diagonal te otorga bajas de 2★ y desbloquea +15% de cadencia.',
    };
  }

  if (level === 2) {
    return {
      level: 2,
      badge: 'TUTORIAL NIVEL 2 · PUENTE LÁSER UV',
      title: 'Haz Láser UV Funde-Chapas',
      subtitle:
        'Las Ratas Blindadas tienen escudo frontal inmune al disparo básico. Coloca 2 Aerosoles UV en la misma fila en raíles vecinos para tender un Puente Láser UV violeta.',
      cells: [
        {
          rail: 2,
          row: 3,
          icon: '⚡',
          label: '1º Aerosol UV [R2, F3]',
          highlightColor: 'cyan',
        },
        {
          rail: 3,
          row: 3,
          icon: '⚡',
          label: '2º Aerosol UV [R3, F3]',
          highlightColor: 'cyan',
        },
        {
          rail: 2,
          row: 5,
          icon: '🔫',
          label: '3º Flus-Flus [R2, F5]',
          highlightColor: 'green',
        },
      ],
      flowArrowLabel: '⚡ + ⚡ en paralelo ➔ ¡Haz UV funde el escudo! ➔ 🔫 remata',
      rewardTitle: '🎁 Recompensa 1★: +150 Monedas Sanitarias',
      rewardExplanation:
        'Fundir el escudo metálico activa "¡Combo x2! Escudo Fundido" y deja a la plaga vulnerable a cualquier disparo.',
    };
  }

  if (level === 3) {
    return {
      level: 3,
      badge: 'TUTORIAL NIVEL 3 · COMBO MAESTRO 3★',
      title: 'Jabón Resbalón + Fregona 360°',
      subtitle:
        'Haz patinar a la plaga con la Pastilla de Jabón a 45° hacia el raíl vecino donde la espera la Fregona Turbo-Spin.',
      cells: [
        {
          rail: 3,
          row: 3,
          icon: '🧼',
          label: '1º Jabón 45° [R3, F3]',
          highlightColor: 'orange',
        },
        {
          rail: 2,
          row: 3,
          icon: '🌪️',
          label: '2º Fregona 360° [R2, F3]',
          highlightColor: 'cyan',
        },
        {
          rail: 2,
          row: 5,
          icon: '🔫',
          label: '3º Flus-Flus [R2, F5]',
          highlightColor: 'green',
        },
      ],
      flowArrowLabel: '🐀 pisa 🧼 en R3 ➔ patina hacia 🌪️ en R2 ➔ ¡Centrifugado 3★!',
      rewardTitle: '🎁 Recompensa 3★: Roomba Kamikaze con Cuchillos',
      rewardExplanation:
        'Las bajas 3★ cargan al máximo el Manómetro Ultimate y desbloquean la Roomba Kamikaze en el Álbum.',
    };
  }

  if (level === 31) {
    return {
      level: 31,
      badge: 'NUEVA HERRAMIENTA NIVEL 31 · INVASIÓN LATERAL',
      title: 'Escuadra Deflectora 90°',
      subtitle:
        '¡Se han abierto conductos laterales! Los bichos laterales cruzan horizontalmente esquivando tus armas. Intercepta su paso con la Escuadra a 90° para obligarlos a bajar rectos por el carril.',
      cells: [
        {
          rail: 2,
          row: 3,
          icon: '📐',
          label: '1º Escuadra 90° [R2, F3]',
          highlightColor: 'yellow',
        },
        {
          rail: 2,
          row: 4,
          icon: '🧽',
          label: '2º Estropajo [R2, F4]',
          highlightColor: 'green',
        },
        {
          rail: 2,
          row: 5,
          icon: '🔫',
          label: '3º Flus-Flus [R2, F5]',
          highlightColor: 'cyan',
        },
      ],
      flowArrowLabel: '➡️ Bicho Lateral choca con 📐 ➔ Gira 90° hacia abajo ➔ Cae en 🧽 + 🔫',
      rewardTitle: '📐 Mecánica Táctica: 0 Daño Propio · Redirección Total',
      rewardExplanation:
        'Al rebotar en la Escuadra Deflectora, el bicho lateral pierde su evasión y baja en línea recta hacia tus trampas.',
    };
  }

  return null;
}

export function isOnboardingHintLevel(level: number): boolean {
  return level <= 4 || level === 31;
}

/**
 * Computes real-time Smart Combo Hints during onboarding levels (Levels 1-4 and Level 31)
 * or according to the user's `smartComboHints` setting ('onboarding' | 'always' | 'off').
 */
export function computeSmartComboHints(
  pieces: UtensilPiece[],
  level = 1,
  hintMode: GameSettings['smartComboHints'] = 'onboarding'
): SmartComboHint[] {
  if (hintMode === 'off') return [];
  if (hintMode === 'onboarding' && !isOnboardingHintLevel(level)) return [];
  const hints: SmartComboHint[] = [];
  const isOccupied = (rail: number, row: number) =>
    pieces.some((p) => p.rail === rail && p.row === row);

  // 1. Solo Aerosol UV placed on board + 2nd Aerosol UV available -> Highlight neighboring rails on same row
  const placedSoloAerosols = pieces.filter(
    (p) =>
      p.type === 'aerosol_torch' &&
      p.rail !== null &&
      p.row !== null &&
      p.comboType === 'none'
  );
  const availableOtherAerosols = pieces.filter(
    (p) =>
      p.type === 'aerosol_torch' &&
      p.comboType === 'none' &&
      (p.rail === null || placedSoloAerosols.length >= 2)
  );

  if (placedSoloAerosols.length >= 1 && availableOtherAerosols.length >= 1) {
    const anchor = placedSoloAerosols[0];
    if (anchor.rail !== null && anchor.row !== null) {
      for (const candidateRail of [anchor.rail - 1, anchor.rail + 1]) {
        if (
          candidateRail >= 0 &&
          candidateRail < GRID_RAILS &&
          !isOccupied(candidateRail, anchor.row)
        ) {
          hints.push({
            rail: candidateRail,
            row: anchor.row,
            pieceType: 'aerosol_torch',
            message: '🔥 ¡Pon el 2º Aerosol aquí al lado para crear el Puente UV!',
            color: 'orange',
          });
        }
      }
    }
  }

  // 2. Solo Estropajo placed on board + Spray Flus-Flus / Lejía available -> Highlight 1-2 cells behind on same rail
  const placedSoloScourers = pieces.filter(
    (p) =>
      p.type === 'scourer_nanas' &&
      p.rail !== null &&
      p.row !== null &&
      p.comboType === 'none'
  );
  const hasAvailableShooter = pieces.some(
    (p) =>
      (p.type === 'spray_flus' || p.type === 'bleach_cannon') &&
      p.comboType === 'none'
  );

  if (placedSoloScourers.length >= 1 && hasAvailableShooter) {
    const anchor = placedSoloScourers[0];
    if (anchor.rail !== null && anchor.row !== null) {
      for (const dRow of [1, 2]) {
        const targetRow = anchor.row + dRow;
        if (targetRow >= MIN_PLACEABLE_ROW && targetRow < GRID_ROWS && !isOccupied(anchor.rail, targetRow)) {
          hints.push({
            rail: anchor.rail,
            row: targetRow,
            pieceType: 'spray_flus',
            message: '🫧 ¡Pon el Flus-Flus aquí detrás para crear el Abanico ×5!',
            color: 'green',
          });
        }
      }
    }
  }

  // 3. Solo Pastilla de Jabón placed on board + Fregona Turbo-Spin available -> Highlight neighboring rails
  const placedSoloSoap = pieces.filter(
    (p) =>
      p.type === 'soap_bar' &&
      p.rail !== null &&
      p.row !== null &&
      p.comboType === 'none'
  );
  const hasAvailableMop = pieces.some(
    (p) => p.type === 'mop_vortex' && p.comboType === 'none'
  );

  if (placedSoloSoap.length >= 1 && hasAvailableMop) {
    const anchor = placedSoloSoap[0];
    if (anchor.rail !== null && anchor.row !== null) {
      for (const candidateRail of [anchor.rail - 1, anchor.rail + 1]) {
        if (
          candidateRail >= 0 &&
          candidateRail < GRID_RAILS &&
          !isOccupied(candidateRail, anchor.row)
        ) {
          hints.push({
            rail: candidateRail,
            row: anchor.row,
            pieceType: 'mop_vortex',
            message: '🌪️ ¡Pon la Fregona aquí al lado para el Vórtice 3★!',
            color: 'cyan',
          });
        }
      }
    }
  }

  return hints;
}

/**
 * Returns the level speed multiplier:
 * - Levels 1-4: 0.55x (-45% human onboarding speed)
 * - Levels 5-60: Scales very gently from 0.60x to a strict ceiling of 0.78x so high levels (e.g. Level 40+)
 *   increase difficulty via HP, shield/lateral composition, and boss puzzles rather than unplayable twitch speed.
 */
export function getLevelSpeedMultiplier(level: number): number {
  if (level <= 4) return 0.55; // -45% human speed on onboarding levels 1, 2, 3, 4
  const biome = getBiomeForLevel(level);
  const baseProgression = Math.min(0.78, 0.6 + (level - 5) * 0.0032);
  return Number((baseProgression * biome.cycleSpeedMultiplier).toFixed(3));
}

/**
 * Returns the exact number of utensils for a given level:
 * - Level 1: 2 pieces ONLY (1 Estropajo + 1 Flus-Flus)
 * - Level 2: 3 pieces ONLY (2 Aerosoles UV + 1 Flus-Flus)
 * - Level 3: 3 pieces ONLY (1 Jabón 45° + 1 Fregona Turbo-Spin + 1 Flus-Flus)
 * - Level 4: 4 pieces ONLY (combine learned mechanics without pre-marked cells)
 * - Level 31: 3 pieces ONLY (Tutorial Escuadra Deflectora + Estropajo + Flus-Flus)
 * - Level 5+: 5–6 pieces max
 */
export function getMaxPiecesForLevel(level: number): number {
  if (level === 1) return 2;
  if (level === 2) return 3;
  if (level === 3) return 3;
  if (level === 4) return 4;
  if (level === 31) return 3;
  return Math.min(6, 4 + (level - 4));
}

/**
 * Returns step-by-step tutorial cell targets for Levels 1, 2, 3, and 31.
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
        shortTag: '🧽 ESTROPAJO',
      },
      {
        pieceId: 'u-spray-1',
        pieceType: 'spray_flus',
        rail: 1,
        row: 4,
        label: '🔫 Flus-Flus detrás en [Raíl 2, Fila 5]',
        shortTag: '🫧 ABANICO ×5',
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
      stepInstruction: nextTarget?.shortTag ?? '✅ ABANICO ×5',
    };
  }

  if (level === 2) {
    const targets: TutorialTargetCell[] = [
      {
        pieceId: 'u-aerosol-1',
        pieceType: 'aerosol_torch',
        rail: 1,
        row: 2,
        label: '⚡ Aerosol UV 1 en [Raíl 2, Fila 3]',
        shortTag: '⚡ 1º LÁSER UV',
      },
      {
        pieceId: 'u-aerosol-2',
        pieceType: 'aerosol_torch',
        rail: 2,
        row: 2,
        label: '⚡ Aerosol UV 2 al lado en [Raíl 3, Fila 3]',
        shortTag: '⚡ PUENTE UV',
      },
      {
        pieceId: 'u-spray-1',
        pieceType: 'spray_flus',
        rail: 1,
        row: 4,
        label: '🔫 Flus-Flus detrás en [Raíl 2, Fila 5]',
        shortTag: '🔫 REMATAR',
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
      stepInstruction: nextTarget?.shortTag ?? '✅ PUENTE UV',
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
        shortTag: '🧼 DESVÍO 45°',
      },
      {
        pieceId: 'u-mop-1',
        pieceType: 'mop_vortex',
        rail: 1,
        row: 2,
        label: '🌪️ Fregona 360° al lado en [Raíl 2, Fila 3]',
        shortTag: '🌪️ VÓRTICE 3★',
      },
      {
        pieceId: 'u-spray-1',
        pieceType: 'spray_flus',
        rail: 1,
        row: 4,
        label: '🔫 Flus-Flus de apoyo en [Raíl 2, Fila 5]',
        shortTag: '🔫 APOYO',
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
      stepInstruction: nextTarget?.shortTag ?? '✅ VÓRTICE 3★',
    };
  }

  if (level === 31) {
    const targets: TutorialTargetCell[] = [
      {
        pieceId: 'u-square-1',
        pieceType: 'corner_square',
        rail: 1,
        row: 2,
        label: '📐 Escuadra 90° en [Raíl 2, Fila 3]',
        shortTag: '📐 GIRO 90°',
      },
      {
        pieceId: 'u-scourer-1',
        pieceType: 'scourer_nanas',
        rail: 1,
        row: 3,
        label: '🧽 Estropajo debajo en [Raíl 2, Fila 4]',
        shortTag: '🧽 ESTROPAJO',
      },
      {
        pieceId: 'u-spray-1',
        pieceType: 'spray_flus',
        rail: 1,
        row: 5,
        label: '🔫 Flus-Flus en [Raíl 2, Fila 6]',
        shortTag: '🫧 ABANICO ×5',
      },
    ];
    const nextTarget =
      targets.find((t) => {
        const found = pieces.find((p) => p.id === t.pieceId || p.type === t.pieceType);
        return !found || found.rail !== t.rail || found.row !== t.row;
      }) ?? null;

    return {
      level: 31,
      mechanicTitle: 'TUTORIAL NIVEL 31 · ESCUADRA DEFLECTORA 90° (INVASIÓN LATERAL)',
      targets,
      nextTarget,
      allTargetsPlaced: nextTarget === null,
      stepInstruction: nextTarget?.shortTag ?? '✅ ESCUADRA 90°',
    };
  }

  return null;
}

/**
 * Evaluates spatial combos on the 4x7 rail grid and returns updated pieces + glowing circuit links.
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

    // 5. ESCUADRA DEFLECTORA 90° (Activa cuando hay trampa o arma en el mismo raíl más abajo)
    if (piece.type === 'corner_square') {
      const trapBelow = nextPieces.find(
        (other) =>
          other.id !== piece.id &&
          other.rail === piece.rail &&
          other.row !== null &&
          other.row > piece.row!
      );
      if (trapBelow && trapBelow.rail !== null && trapBelow.row !== null) {
        piece.comboType = 'deflect_90';
        links.push({
          fromRail: piece.rail,
          fromRow: piece.row,
          toRail: trapBelow.rail,
          toRow: trapBelow.row,
          kind: 'deflect_90',
        });
      }
    }
  }

  return { updatedPieces: nextPieces, links };
}

/**
 * Computes the exact board cells where a weapon deals damage, covers area, or deflects bugs.
 */
export function computeWeaponRangeCells(
  type: UtensilType,
  rail: number,
  row: number,
  pieces: UtensilPiece[]
): RangePreviewCell[] {
  const cells: RangePreviewCell[] = [];
  const pushUnique = (r: number, rw: number, role: RangePreviewCell['role']) => {
    if (r < 0 || r >= GRID_RAILS || rw < 0 || rw >= GRID_ROWS) return;
    if (!cells.some((c) => c.rail === r && c.row === rw)) {
      cells.push({ rail: r, row: rw, role });
    }
  };

  if (type === 'spray_flus' || type === 'bleach_cannon') {
    const scourerAhead = pieces.find(
      (p) =>
        p.type === 'scourer_nanas' &&
        p.rail === rail &&
        p.row !== null &&
        (p.row === row - 1 || p.row === row - 2)
    );
    if (scourerAhead && scourerAhead.row !== null) {
      for (let rw = row - 1; rw >= scourerAhead.row; rw--) {
        pushUnique(rail, rw, 'damage');
      }
      for (let dRow = 1; dRow <= 2; dRow++) {
        pushUnique(rail - 1, scourerAhead.row - dRow, 'area');
        pushUnique(rail, scourerAhead.row - dRow, 'damage');
        pushUnique(rail + 1, scourerAhead.row - dRow, 'area');
      }
    } else {
      for (let rw = row - 1; rw >= 0; rw--) {
        pushUnique(rail, rw, 'damage');
      }
    }
  } else if (type === 'scourer_nanas') {
    pushUnique(rail, row, 'area');
    for (let dRow = 1; dRow <= 2; dRow++) {
      pushUnique(rail - 1, row - dRow, 'area');
      pushUnique(rail, row - dRow, 'damage');
      pushUnique(rail + 1, row - dRow, 'area');
    }
  } else if (type === 'aerosol_torch') {
    pushUnique(rail, row, 'damage');
    pushUnique(rail - 1, row, 'area');
    pushUnique(rail + 1, row, 'area');
  } else if (type === 'soap_bar') {
    pushUnique(rail, row, 'deflect');
    const mopNeighbor = pieces.find(
      (p) =>
        p.type === 'mop_vortex' &&
        p.rail !== null &&
        Math.abs(p.rail - rail) === 1 &&
        p.row !== null &&
        Math.abs(p.row - row) <= 1
    );
    const destRail =
      mopNeighbor && mopNeighbor.rail !== null
        ? mopNeighbor.rail
        : rail < GRID_RAILS - 1
        ? rail + 1
        : rail - 1;
    pushUnique(destRail, row, 'deflect');
    pushUnique(destRail, Math.min(GRID_ROWS - 1, row + 1), 'deflect');
  } else if (type === 'mop_vortex') {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dw = -1; dw <= 1; dw++) {
        pushUnique(rail + dr, row + dw, dr === 0 && dw === 0 ? 'damage' : 'area');
      }
    }
  } else if (type === 'wc_shield') {
    pushUnique(rail, row, 'deflect');
    pushUnique(rail, row - 1, 'deflect');
    pushUnique(rail, row - 2, 'deflect');
  } else if (type === 'corner_square') {
    pushUnique(rail, row, 'deflect');
    for (let rw = row + 1; rw < GRID_ROWS; rw++) {
      pushUnique(rail, rw, 'deflect');
    }
  }

  return cells;
}

/**
 * Simulates placing `draggedPieceId` onto `(candidateRail, candidateRow)` BEFORE finger release
 * and returns any active synergy links formed with already-placed pieces.
 */
export function computeDragComboPreviewLinks(
  pieces: UtensilPiece[],
  draggedPieceId: string,
  candidateRail: number,
  candidateRow: number
): CircuitLink[] {
  if (candidateRow < MIN_PLACEABLE_ROW || candidateRail < 0 || candidateRail >= GRID_RAILS) {
    return [];
  }
  const simulated = moveOrSwapUtensil(pieces, draggedPieceId, candidateRail, candidateRow);
  const { links } = evaluateBoardCombos(simulated);
  return links.filter(
    (l) =>
      (l.fromRail === candidateRail && l.fromRow === candidateRow) ||
      (l.toRail === candidateRail && l.toRow === candidateRow)
  );
}

/**
 * Computes full enemy & conduit forecast across Phases 1-3 for Strategic Mode (Level 4+).
 */
export function getLevelForecast(level: number): LevelForecast {
  const safeLvl = Math.max(1, Math.floor(level));
  if (safeLvl === 1) {
    return {
      bugTypes: ['speed_ant'],
      activeRails: [1, 2],
      hasLateralConduits: false,
      bossTier: 'none',
    };
  }
  if (safeLvl === 2 || safeLvl === 3) {
    return {
      bugTypes: ['speed_ant', 'cap_beetle'],
      activeRails: [1, 2],
      hasLateralConduits: false,
      bossTier: 'none',
    };
  }
  if (safeLvl === 31) {
    return {
      bugTypes: ['speed_ant', 'shift_roach'],
      activeRails: [1, 2],
      hasLateralConduits: true,
      bossTier: 'none',
    };
  }

  const bossTier = getBossTierForLevel(safeLvl) ?? 'none';
  const bugTypes: BugType[] = ['speed_ant', 'cap_beetle', 'acid_wasp', 'shift_roach'];
  if (bossTier !== 'none' || safeLvl >= 6) {
    bugTypes.push('king_crab');
  }
  return {
    bugTypes,
    activeRails: [0, 1, 2, 3],
    hasLateralConduits: safeLvl >= 31 || (safeLvl >= 30 && bossTier === 'grand'),
    bossTier,
  };
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
  // 3★ Master Kill: Slipped on soap bar AND centrifuged by Mop Vortex (or redirected by Square)
  if (
    (bug.isSlidingFromSoap && bug.hitByVortexSpin) ||
    (bug.redirectedBySquare && (bug.hitByDiagonalFoam || bug.type === 'shift_roach'))
  ) {
    const achId =
      bug.type === 'cap_beetle'
        ? 'beetle_3star'
        : bug.type === 'acid_wasp'
        ? 'wasp_3star'
        : bug.type === 'shift_roach'
        ? 'roach_3star'
        : bug.type === 'king_crab'
        ? 'crab_3star'
        : null;
    return {
      stars: 3,
      comicTitle: bug.redirectedBySquare ? '¡ESCUADRA LETAL 3★!' : '¡LIMPIEZA PROFUNDA 3★!',
      comicSubtitle: bug.redirectedBySquare
        ? '¡Redirigido 90° directo a la trampa!'
        : '¡DING! Jabón + Centrifugado Maestro',
      achievementId: achId,
    };
  }

  // 2★ Tactical Kill: Flanked by diagonal foam from Scourer, reflected acid, or square redirection
  if (bug.hitByDiagonalFoam || bug.redirectedBySquare) {
    const achId =
      bug.type === 'speed_ant'
        ? 'ant_2star'
        : bug.type === 'cap_beetle'
        ? 'beetle_2star'
        : bug.type === 'acid_wasp'
        ? 'wasp_2star'
        : null;
    return {
      stars: 2,
      comicTitle: '¡EXFOLIACIÓN LETAL 2★!',
      comicSubtitle: bug.redirectedBySquare
        ? 'Intercepción Lateral a 90°'
        : 'Espuma en abanico por el flanco',
      achievementId: achId,
    };
  }

  // 1★ Direct / Bridge Kill
  const achId = bug.type === 'cap_beetle' && bug.hitByBridgeBurn ? 'beetle_1star' : null;
  return {
    stars: 1,
    comicTitle: '¡DESINFECTADO! 1★',
    comicSubtitle: bug.hitByBridgeBurn ? 'Chapa fundida con Láser UV' : 'Plaga eliminada',
    achievementId: achId,
  };
}

/**
 * Calculates deterministic phase transitions (Fase 1 -> Fase 2 -> Fase 3) based on kills.
 * On Levels 1-4 and 31, we never dump extra random weapons mid-level so the tutorial piece count stays strict!
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
  // Levels 1-4 & 31: short tutorial waves (3-4 kills/phase).
  // Levels 5+: calibrated for ~120s (2-minute) wave duration across 3 phases (~12-16 kills/phase).
  const baseTarget =
    level <= 3 || level === 31
      ? 3
      : level === 4
      ? 4
      : Math.min(11 + Math.floor((level - 5) * 0.15), 16);
  const targetForPhase =
    currentPhase === 1 ? baseTarget : currentPhase === 2 ? baseTarget + 2 : baseTarget + 3;

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
      unlockedUtensilOnAdvance: level >= 5 && level !== 31 ? 'aerosol_torch' : null,
    };
  }

  if (currentPhase === 2) {
    return {
      shouldAdvance: true,
      nextPhase: 3,
      targetKillsForCurrentPhase: targetForPhase,
      unlockedUtensilOnAdvance: level >= 5 && level !== 31 ? 'mop_vortex' : null,
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
 * - Level 31 (ONLY 3 PIECES): 1 Escuadra Deflectora 90° + 1 Estropajo + 1 Flus-Flus (Tutorial Invasión Lateral)
 * - Level 32+ (6 pieces): Full tactical toolkit + Escuadra Deflectora 90°
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
  } else if (level === 31) {
    initial = [
      {
        id: 'u-square-1',
        type: 'corner_square',
        level: 1,
        rail: null,
        row: null,
        gunkTimer: 0,
        cooldown: 0,
        fireTimer: 0,
        comboType: 'none',
      },
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
    ];
  } else if (level >= 32) {
    initial = [
      {
        id: 'u-square-1',
        type: 'corner_square',
        level: 1,
        rail: null,
        row: null,
        gunkTimer: 0,
        cooldown: 0,
        fireTimer: 0,
        comboType: 'none',
      },
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

export const DEFAULT_SETTINGS: GameSettings = {
  masterVolume: 80,
  sfxVolume: 90,
  bgmVolume: 70,
  muted: false,
  gameSpeedMultiplier: 1.0,
  tacticalSlowMo: true,
  screenShake: true,
  smartComboHints: 'onboarding',
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
    detail = '⚡ Puente Láser UV';
    color = 'pink';
  } else if (moved.comboType === 'slip_vortex') {
    detail = '🌪️ Vórtice 360° 3★';
    color = 'cyan';
  } else if (moved.comboType === 'deflect_90') {
    detail = '📐 Escuadra 90° Lista';
    color = 'yellow';
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
