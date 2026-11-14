import {
  AchievementDef,
  ArmorId,
  BiomeConfig,
  BiomeId,
  BoardPartnerHighlight,
  BossPuzzleType,
  BossTier,
  BugEnemy,
  BugType,
  FloatingComboEvent,
  GameSettings,
  GameState,
  HatId,
  KillStarRating,
  KitchenUpgradeId,
  KitchenUpgradeLevel,
  KitchenUpgrades,
  LevelForecast,
  LiveMenuBuffs,
  PlayerProgress,
  RangePreviewCell,
  SmartComboHint,
  SpecialWeaponId,
  SupremeEvolutionId,
  TacticalInspectionTarget,
  TacticalInspectorCardData,
  TacticalOnboardingCardData,
  TileChemicalState,
  UtensilPiece,
  UtensilType,
  WorldId,
} from './types';
import {
  matchSupremeEvolution,
  SUPREME_EVOLUTIONS_CATALOG,
} from './roguelite';
import { getStrategicScript, type StrategicScript } from './strategicScripts';

const SCRIPT_TUTORIAL_KEY: Record<NonNullable<StrategicScript['tutorial']>, 1 | 2 | 3 | 11 | 31> = {
  line_foam: 1,
  bridge_uv: 2,
  slip_vortex: 3,
  duct_square: 11,
  corner_square: 31,
};

/**
 * Qué tutorial (por mecánica) corresponde a un nivel. Los niveles con guion eligen su tutorial
 * (`StrategicScript.tutorial`); el resto conserva el tutorial por número de nivel.
 * Claves: 1 abanico, 2 puente UV, 3 Jabón + Fregona, 11 Escuadra + puente (conducto), 31 Escuadra (antiguo).
 */
function getTutorialKeyForLevel(level: number): 1 | 2 | 3 | 11 | 31 | null {
  const script = getStrategicScript(level);
  if (script) return script.tutorial ? SCRIPT_TUTORIAL_KEY[script.tutorial] : null;
  return level === 1 || level === 2 || level === 3 || level === 31 ? level : null;
}

export const GRID_RAILS = 4;
export const GRID_ROWS = 7; // Row 0 = top (near conduits), Row 6 = bottom playable row (plates sit 1 step below at z = +4.2)
export const MIN_PLACEABLE_ROW = 2; // Filas 3 a 7 únicamente (prohibido colocar en Filas 1 y 2)
export const MAX_CAMPAIGN_LEVELS = 60;
export const LEVEL_DURATION_SECONDS = 120; // 2 minutos (120s) por nivel a partir del Nivel 5
export const DEV_UNLOCK_ALL_WORLDS = false;

export const STRATEGIC_BOOST_ULTIMATE_COST = 60;
export const STRATEGIC_BOOST_SHIELD_COST = 80;

// Emergent Chemistry, Menú Vivo & Active Chef Constants
export const TILE_TRAIL_DURATION = 4.0;
export const CHEF_WHIP_COOLDOWN = 18.0;
export const CHEF_WHIP_PUSH_CELLS = 2.0;
export const CHEF_WHIP_STUN_SECONDS = 1.0;
export const BOSS_PHASE_BREAK_HITSTOP_SECONDS = 0.06; // 60ms physical hitstop
export const BOSS_PHASE_BREAK_FLASH_SECONDS = 0.30;   // 300ms visual flash

export const WORLD_UNLOCK_LEVELS: Record<WorldId, number> = {
  sunny_counter: 1,
  fridge_vault: 11,
  iron_stoves: 21,
  pastry_marble: 31,
};

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

/**
 * Ultra-short 1-2 word micro-role displayed under every weapon name in the 4-slot bottom tray.
 */
export const UTENSIL_ROLE_TAGS: Record<UtensilType, string> = {
  spray_flus: 'Disparo',
  scourer_nanas: 'Frena',
  aerosol_torch: 'Rayo Par',
  soap_bar: 'Rebote 45°',
  mop_vortex: 'Empuje 360°',
  wc_shield: 'Escudo',
  bleach_cannon: 'Ola',
  corner_square: 'Rebote 90°',
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
    rewardLabel: 'Barreño Militar Volcado (-50% duración de pringue ácido en tus armas)',
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
    rewardLabel: 'Gorro de Ducha con Patito (+15% cadencia en Spray Flus-Flus)',
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
    rewardId: 'knife_robot',
    rewardLabel: 'Robot Aspirador Kamikaze con Cuchillos',
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
    bonus: '+10% Monedas al salvar los 4 platos',
    color: '#ffffff',
  },
  duck_shower_cap: {
    name: 'Gorro de Ducha con Patito',
    bonus: '+15% cadencia en Spray Flus-Flus',
    color: '#38bdf8',
  },
  bucket_helmet: {
    name: 'Barreño Militar Volcado',
    bonus: '-50% duración de pringue ácido en tus armas',
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
  hydro_blast: {
    name: 'Hidrolimpiadora Industrial',
    icon: '🌊',
    desc: 'Empuja hacia atrás y blanquea a todos los bichos de los 4 raíles.',
  },
  baking_volcano: {
    name: 'Volcán de Bicarbonato + Vinagre',
    icon: '🌋',
    desc: 'Inunda el tablero de espuma ácida que funde todas las chapas.',
  },
  knife_robot: {
    name: 'Robot Aspirador Kamikaze con Cuchillos',
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
  const key = getTutorialKeyForLevel(level);
  if (key === null) return null;
  if (key === 1) {
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

  if (key === 2) {
    return {
      level,
      badge: `TUTORIAL NIVEL ${level} · PUENTE LÁSER UV`,
      title: 'Haz Láser UV Funde-Chapas',
      subtitle:
        'Las Ratas Blindadas entran por el carril 4, fuera del abanico, y su escudo para el disparo básico. Pon 2 Aerosoles UV en la misma fila en carriles vecinos para tender un Puente Láser UV.',
      cells: [
        {
          rail: 2,
          row: 4,
          icon: '🧽',
          label: '1º Estropajo [R2, F4]',
          highlightColor: 'green',
        },
        {
          rail: 2,
          row: 6,
          icon: '🔫',
          label: '2º Flus-Flus [R2, F6]',
          highlightColor: 'green',
        },
        {
          rail: 3,
          row: 3,
          icon: '⚡',
          label: '3º Aerosol UV [R3, F3]',
          highlightColor: 'cyan',
        },
        {
          rail: 4,
          row: 3,
          icon: '⚡',
          label: '4º Aerosol UV [R4, F3]',
          highlightColor: 'cyan',
        },
      ],
      flowArrowLabel: '🧽 + 🔫 limpian las hormigas · ⚡ + ⚡ en paralelo ➔ ¡Haz UV funde el escudo!',
      rewardTitle: '🎁 Recompensa 1★: +150 Monedas Sanitarias',
      rewardExplanation:
        'Fundir el escudo metálico activa "¡Combo x2! Escudo Fundido" y deja a la plaga vulnerable a cualquier disparo.',
    };
  }

  if (key === 3) {
    return {
      level,
      badge: `TUTORIAL NIVEL ${level} · COMBO MAESTRO 3★`,
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
      flowArrowLabel: '🪳 pisa 🧼 en R3 ➔ deja de esquivar y patina hacia 🌪️ en R2 ➔ ¡Centrifugado 3★!',
      rewardTitle: '🎁 Recompensa 3★: Robot Aspirador Kamikaze con Cuchillos',
      rewardExplanation:
        'Las bajas 3★ cargan al máximo el Manómetro Ultimate y desbloquean el Robot Aspirador Kamikaze en el Álbum.',
    };
  }

  if (key === 11) {
    return {
      level,
      badge: `NUEVA HERRAMIENTA NIVEL ${level} · HORMIGAS DE CONDUCTO`,
      title: 'Escuadra Deflectora 90° + Puente UV',
      subtitle:
        'Las hormigas de conducto entran por los dos laterales en la fila 5 y cruzan corriendo. La Escuadra en esa fila las frena y las manda por su carril; el puente UV justo debajo las funde.',
      cells: [
        { rail: 2, row: 5, icon: '📐', label: '1º Escuadra [R2, F5]', highlightColor: 'yellow' },
        { rail: 2, row: 6, icon: '⚡', label: '2º Aerosol UV [R2, F6]', highlightColor: 'cyan' },
        { rail: 3, row: 6, icon: '⚡', label: '3º Aerosol UV [R3, F6]', highlightColor: 'cyan' },
        { rail: 2, row: 7, icon: '🔫', label: '4º Flus-Flus [R2, F7]', highlightColor: 'green' },
      ],
      flowArrowLabel: '➡️ Hormiga cruza corriendo ➔ choca con 📐 ➔ baja por tu carril ➔ ⚡⚡ la funde',
      rewardTitle: '📐 Mecánica Táctica: 0 Daño Propio · Redirección Total',
      rewardExplanation:
        'La Escuadra no hace daño: decide por dónde baja el bicho. Ponla en la fila por la que entran y tu trampa debajo.',
    };
  }

  if (key === 31) {
    return {
      level,
      badge: `NUEVA HERRAMIENTA NIVEL ${level} · INVASIÓN LATERAL`,
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
            message: '⚡ ¡Pon el 2º Aerosol aquí al lado para crear el Puente UV!',
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
  const script = getStrategicScript(level);
  if (script) return script.loadout.length;
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
  const isInTray = (pieceId: string, pieceType: UtensilType) => {
    const found = pieces.find((p) => p.id === pieceId) ?? pieces.find((p) => p.type === pieceType);
    return !found || found.rail === null || found.row === null;
  };
  const key = getTutorialKeyForLevel(level);
  if (key === null) return null;

  if (key === 1) {
    const placedScourer = pieces.find(
      (p) => (p.id === 'u-scourer-1' || p.type === 'scourer_nanas') && p.rail !== null && p.row !== null
    );
    const sprayRail = placedScourer?.rail ?? 1;
    const sprayRow =
      placedScourer && placedScourer.row !== null
        ? Math.min(GRID_ROWS - 1, placedScourer.row + (placedScourer.row <= 4 ? 2 : 1))
        : 4;

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
        rail: sprayRail,
        row: sprayRow,
        label: '🔫 Flus-Flus detrás en el mismo raíl',
        shortTag: '🫧 ABANICO ×5',
      },
    ];
    const nextTarget = targets.find((t) => isInTray(t.pieceId, t.pieceType)) ?? null;

    return {
      level: 1,
      mechanicTitle: 'TUTORIAL NIVEL 1 · COMBO EN LÍNEA (ABANICO ×5)',
      targets,
      nextTarget,
      allTargetsPlaced: nextTarget === null,
      stepInstruction: nextTarget?.shortTag ?? '✅ ABANICO ×5',
    };
  }

  if (key === 2) {
    // Puente UV en los carriles 3-4 (fuera del abanico) + abanico en el carril 2.
    const firstUv = pieces.find((p) => p.id === 'u-aerosol-1' && p.rail !== null && p.row !== null);
    const bridgeRail =
      firstUv && firstUv.rail !== null ? (firstUv.rail < GRID_RAILS - 1 ? firstUv.rail + 1 : firstUv.rail - 1) : 3;
    const bridgeRow = firstUv?.row ?? 2;

    const targets: TutorialTargetCell[] = [
      {
        pieceId: 'u-scourer-1',
        pieceType: 'scourer_nanas',
        rail: 1,
        row: 3,
        label: '🧽 Estropajo en [Raíl 2, Fila 4]',
        shortTag: '🧽 ESTROPAJO',
      },
      {
        pieceId: 'u-spray-1',
        pieceType: 'spray_flus',
        rail: 1,
        row: 5,
        label: '🔫 Flus-Flus detrás en [Raíl 2, Fila 6]',
        shortTag: '🫧 ABANICO ×5',
      },
      {
        pieceId: 'u-aerosol-1',
        pieceType: 'aerosol_torch',
        rail: 2,
        row: 2,
        label: '⚡ Aerosol UV 1 en [Raíl 3, Fila 3]',
        shortTag: '⚡ 1º LÁSER UV',
      },
      {
        pieceId: 'u-aerosol-2',
        pieceType: 'aerosol_torch',
        rail: bridgeRail,
        row: bridgeRow,
        label: '⚡ Aerosol UV 2 al lado, misma fila',
        shortTag: '⚡ PUENTE UV',
      },
    ];
    const nextTarget = targets.find((t) => isInTray(t.pieceId, t.pieceType)) ?? null;

    return {
      level,
      mechanicTitle: `TUTORIAL NIVEL ${level} · PUENTE LÁSER UV (FUNDE-CHAPAS)`,
      targets,
      nextTarget,
      allTargetsPlaced: nextTarget === null,
      stepInstruction: nextTarget?.shortTag ?? '✅ PUENTE UV',
    };
  }

  if (key === 3) {
    const placedSoap = pieces.find((p) => p.id === 'u-soap-1' && p.rail !== null && p.row !== null);
    const mopRail =
      placedSoap && placedSoap.rail !== null ? (placedSoap.rail > 0 ? placedSoap.rail - 1 : placedSoap.rail + 1) : 1;
    const mopRow = placedSoap?.row ?? 2;

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
        rail: mopRail,
        row: mopRow,
        label: '🌪️ Fregona 360° al lado en [Raíl 2, Fila 3]',
        shortTag: '🌪️ VÓRTICE 3★',
      },
      {
        pieceId: 'u-spray-1',
        pieceType: 'spray_flus',
        rail: mopRail,
        row: Math.min(GRID_ROWS - 1, mopRow + 2),
        label: '🔫 Flus-Flus de apoyo en [Raíl 2, Fila 5]',
        shortTag: '🔫 APOYO',
      },
    ];
    const nextTarget = targets.find((t) => isInTray(t.pieceId, t.pieceType)) ?? null;

    return {
      level,
      mechanicTitle: `TUTORIAL NIVEL ${level} · DESVÍO 3★ (JABÓN + FREGONA 360°)`,
      targets,
      nextTarget,
      allTargetsPlaced: nextTarget === null,
      stepInstruction: nextTarget?.shortTag ?? '✅ VÓRTICE 3★',
    };
  }

  if (key === 11) {
    const targets: TutorialTargetCell[] = [
      {
        pieceId: 'u-square-1',
        pieceType: 'corner_square',
        rail: 1,
        row: 4,
        label: '📐 Escuadra en la fila del conducto [Raíl 2, Fila 5]',
        shortTag: '📐 GIRO 90°',
      },
      {
        pieceId: 'u-aerosol-1',
        pieceType: 'aerosol_torch',
        rail: 1,
        row: 5,
        label: '⚡ Aerosol UV debajo [Raíl 2, Fila 6]',
        shortTag: '⚡ 1º LÁSER UV',
      },
      {
        pieceId: 'u-aerosol-2',
        pieceType: 'aerosol_torch',
        rail: 2,
        row: 5,
        label: '⚡ Aerosol UV al lado [Raíl 3, Fila 6]',
        shortTag: '⚡ PUENTE UV',
      },
      {
        pieceId: 'u-spray-1',
        pieceType: 'spray_flus',
        rail: 1,
        row: 6,
        label: '🔫 Flus-Flus [Raíl 2, Fila 7]',
        shortTag: '🔫 APOYO',
      },
    ];
    const nextTarget = targets.find((t) => isInTray(t.pieceId, t.pieceType)) ?? null;
    return {
      level,
      mechanicTitle: `TUTORIAL NIVEL ${level} · ESCUADRA 90° + PUENTE UV (HORMIGAS DE CONDUCTO)`,
      targets,
      nextTarget,
      allTargetsPlaced: nextTarget === null,
      stepInstruction: nextTarget?.shortTag ?? '✅ ESCUADRA + PUENTE',
    };
  }

  if (key === 31) {
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
    const nextTarget = targets.find((t) => isInTray(t.pieceId, t.pieceType)) ?? null;

    return {
      level,
      mechanicTitle: `TUTORIAL NIVEL ${level} · ESCUADRA DEFLECTORA 90° (INVASIÓN LATERAL)`,
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

  const isDepletedCan = (p?: UtensilPiece | null) =>
    Boolean(p && ((p.ammo !== undefined && p.ammo <= 0) || p.depleteTimer !== undefined));

  const findAt = (rail: number, row: number) =>
    nextPieces.find((p) => p.rail === rail && p.row === row && !isDepletedCan(p));

  for (const piece of nextPieces) {
    if (piece.rail === null || piece.row === null || isDepletedCan(piece)) continue;

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

    // 2. COMBO PUENTE HORIZONTAL: Dos [Aerosol UV] con carga en la misma fila en raíles vecinos
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
  const script = getStrategicScript(safeLvl);
  if (script) {
    return {
      bugTypes: [...new Set(script.spawns.map((s) => s.type))],
      activeRails: [...new Set(script.spawns.map((s) => s.rail))].sort((a, b) => a - b),
      hasLateralConduits: script.spawns.some((s) => Boolean(s.entry)),
      bossTier: script.spawns.find((s) => s.boss)?.boss?.tier ?? 'none',
    };
  }
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
const LOADOUT_ID_PREFIX: Record<UtensilType, string> = {
  spray_flus: 'spray',
  scourer_nanas: 'scourer',
  aerosol_torch: 'aerosol',
  soap_bar: 'soap',
  mop_vortex: 'mop',
  wc_shield: 'wcshield',
  bleach_cannon: 'bleach',
  corner_square: 'square',
};

/** Piezas en bandeja a partir del reparto de un guion (ids estables para los tutoriales: u-aerosol-1…). */
function piecesFromLoadout(loadout: readonly UtensilType[]): UtensilPiece[] {
  const seen = new Map<UtensilType, number>();
  return loadout.map((type) => {
    const n = (seen.get(type) ?? 0) + 1;
    seen.set(type, n);
    return {
      id: `u-${LOADOUT_ID_PREFIX[type]}-${n}`,
      type,
      level: 1,
      rail: null,
      row: null,
      gunkTimer: 0,
      cooldown: 0,
      fireTimer: type === 'spray_flus' ? 0.35 : type === 'mop_vortex' ? 0.3 : 0,
      comboType: 'none',
    };
  });
}

export function createInitialBoardPieces(level = 1): UtensilPiece[] {
  const script = getStrategicScript(level);
  if (script) {
    return evaluateBoardCombos(ensureTrayHasSprayFlus(piecesFromLoadout(script.loadout))).updatedPieces;
  }
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

  return evaluateBoardCombos(ensureTrayHasSprayFlus(initial)).updatedPieces;
}

/**
 * Guarantees that a tray (`rail === null || row === null`) ALWAYS contains at least 1 `spray_flus` ("Flus-Flus"),
 * preserving piece level and standard weapon behavior.
 */
export function ensureTrayHasSprayFlus(
  pieces: readonly UtensilPiece[],
  rng: () => number = Math.random
): UtensilPiece[] {
  const trayIndices: number[] = [];
  let hasSprayInTray = false;
  for (let i = 0; i < pieces.length; i++) {
    const p = pieces[i];
    if (p.rail === null || p.row === null) {
      trayIndices.push(i);
      if (p.type === 'spray_flus') {
        hasSprayInTray = true;
      }
    }
  }
  if (hasSprayInTray || trayIndices.length === 0) {
    return pieces.map((p) => ({ ...p }));
  }
  const replaceIdx = trayIndices[Math.floor(rng() * trayIndices.length) % trayIndices.length];
  return pieces.map((p, idx) =>
    idx === replaceIdx
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

export const DEFAULT_KITCHEN_UPGRADES: KitchenUpgrades = {
  acidResistance: 0,
  streakCoinBonus: 0,
  whipCooldown: 0,
  ultBaseCharge: 0,
};

/**
 * Nota de un nivel del Estratégico por los sellos perdidos (cada fuga arruina un plato):
 * 0 → 3 estrellas, 1 → 2, 2 o 3 → 1. Pasar sin recolocar es posible perdiendo platos;
 * la nota perfecta exige el guion bien jugado.
 */
export function computeLevelStars(sealsLost: number): 1 | 2 | 3 {
  const lost = Math.max(0, Math.floor(Number.isFinite(sealsLost) ? sealsLost : 3));
  return lost === 0 ? 3 : lost === 1 ? 2 : 1;
}

/** Guarda la mejor nota de cada nivel (nunca baja). */
export function mergeBestLevelStars(
  prev: Record<number, 1 | 2 | 3> | undefined,
  level: number,
  stars: 1 | 2 | 3
): Record<number, 1 | 2 | 3> {
  const current = prev?.[level] ?? 0;
  return { ...(prev ?? {}), [level]: (Math.max(current, stars) as 1 | 2 | 3) };
}

/** Limpia las notas guardadas (partida local o código de copia): niveles ≥ 1 y notas 1-3. */
export function sanitizeLevelStars(raw: unknown): Record<number, 1 | 2 | 3> {
  const out: Record<number, 1 | 2 | 3> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const level = Number(k);
    if (Number.isInteger(level) && level >= 1 && (v === 1 || v === 2 || v === 3)) out[level] = v;
  }
  return out;
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
  unlockedSpecials: ['hydro_blast'],
  equippedHat: 'classic_toque',
  equippedArmor: 'white_apron',
  equippedSpecial: 'hydro_blast',
  bestScore: 0,
  totalBugsCleaned: 0,
  kitchenUpgrades: { ...DEFAULT_KITCHEN_UPGRADES },
};

export function detectDefaultPrioritize60Fps(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const coarse =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(pointer: coarse)').matches;
    const touchPoints =
      typeof navigator !== 'undefined' && (navigator.maxTouchPoints ?? 0) > 0;
    const narrow = window.innerWidth <= 900;
    return Boolean(coarse || touchPoints || narrow);
  } catch {
    return true;
  }
}

export const DEFAULT_SETTINGS: GameSettings = {
  masterVolume: 80,
  sfxVolume: 90,
  bgmVolume: 70,
  muted: false,
  gameSpeedMultiplier: 1.0,
  tacticalSlowMo: true,
  screenShake: true,
  hapticsEnabled: true,
  smartComboHints: 'always',
  prioritize60Fps: detectDefaultPrioritize60Fps(),
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

// ============================================================================
// EMERGENT CHEMISTRY, PHYSICAL KNOCKBACK, "MENÚ VIVO" & TIME SAFEGUARDS
// ============================================================================

export const MENU_PLATE_BUFF_META: readonly {
  rail: number;
  icon: string;
  shortTag: string;
  name: string;
  desc: string;
  accentHex: number;
}[] = [
  {
    rail: 0,
    icon: '🍕',
    shortTag: '🍕+15%⚡',
    name: 'Plato 1 (Pizza)',
    desc: '+15% cadencia en armas térmicas y UV',
    accentHex: 0xa855f7,
  },
  {
    rail: 1,
    icon: '🧀',
    shortTag: '🧀+15%❄️',
    name: 'Plato 2 (Queso/Uvas)',
    desc: '+15% duración de ralentización y control',
    accentHex: 0x38bdf8,
  },
  {
    rail: 2,
    icon: '🍖',
    shortTag: '🍖+15%🎯',
    name: 'Plato 3 (Principal)',
    desc: '+15% daño directo de proyectiles frontales',
    accentHex: 0x22c55e,
  },
  {
    rail: 3,
    icon: '🧁',
    shortTag: '🧁+20%Ult',
    name: 'Plato 4 (Postre)',
    desc: '+20% velocidad de carga de Ultimate por baja',
    accentHex: 0xf59e0b,
  },
];

/**
 * Computes live passive buffs granted by the 4 bottom gourmet plates while intact.
 * Devouring a plate immediately turns off ONLY that plate's passive buff.
 */
export function computeLiveMenuBuffs(intactPlates: readonly boolean[]): LiveMenuBuffs {
  return {
    thermalRateMult: intactPlates[0] ? 1.15 : 1.0,
    controlDurationMult: intactPlates[1] ? 1.15 : 1.0,
    frontalDamageMult: intactPlates[2] ? 1.15 : 1.0,
    ultChargeMult: intactPlates[3] ? 1.2 : 1.0,
  };
}

/**
 * Doubles victory coins if Level 6+ VIP Critic's Plate ("Plato del Crítico VIP") survives intact.
 */
export function computeVipVictoryCoins(
  baseVictoryCoins: number,
  vipPlateRail: number | null,
  intactPlates: readonly boolean[]
): { coinsEarned: number; vipSaved: boolean } {
  const vipSaved =
    vipPlateRail !== null &&
    vipPlateRail >= 0 &&
    vipPlateRail < intactPlates.length &&
    Boolean(intactPlates[vipPlateRail]);
  return {
    coinsEarned: vipSaved ? baseVictoryCoins * 2 : baseVictoryCoins,
    vipSaved,
  };
}

/**
 * Computes final Strategic Mode match coins, applying:
 * - VIP Critic Plate ×2 bonus on victory when VIP plate survived
 * - Gorro de Chef Clásico (`classic_toque`) +10% bonus when all 4 plates survived intact on victory!
 */
export function computeStrategicMatchCoins(opts: {
  victory: boolean;
  vipSaved: boolean;
  allFourPlatesIntact: boolean;
  equippedHat: HatId;
  baseVictoryCoins?: number;
  baseDefeatCoins?: number;
}): { coinsEarned: number; classicToqueBonusApplied: boolean } {
  const {
    victory,
    vipSaved,
    allFourPlatesIntact,
    equippedHat,
    baseVictoryCoins = 120,
    baseDefeatCoins = 25,
  } = opts;
  if (!victory) {
    return { coinsEarned: baseDefeatCoins, classicToqueBonusApplied: false };
  }
  const vipAdjusted = vipSaved ? baseVictoryCoins * 2 : baseVictoryCoins;
  const classicToqueBonusApplied = allFourPlatesIntact && equippedHat === 'classic_toque';
  const coinsEarned = classicToqueBonusApplied
    ? Math.round(vipAdjusted * 1.1)
    : vipAdjusted;
  return { coinsEarned, classicToqueBonusApplied };
}

export interface StackedTrayGroup {
  groupKey: string;
  representative: UtensilPiece;
  pieces: UtensilPiece[];
  count: number;
}

/**
 * Groups identical unplaced utensils in the bottom tray (`rail === null`) into a single stacked card
 * with a `count` badge (`x2`, `x3`), freeing horizontal thumb width and preventing label truncation.
 * Placed utensils stay on the 3D countertop where they can be moved/swapped/cleaned directly.
 */
export function groupTrayPiecesForDisplay(pieces: readonly UtensilPiece[]): StackedTrayGroup[] {
  const groups = new Map<string, UtensilPiece[]>();
  for (const p of pieces) {
    if (p.rail !== null || p.row !== null) continue;
    const key = `${p.type}_lv${p.level}_${p.evolutionId ?? 'base'}`;
    const list = groups.get(key);
    if (list) {
      list.push(p);
    } else {
      groups.set(key, [p]);
    }
  }
  const out: StackedTrayGroup[] = [];
  for (const [groupKey, groupPieces] of groups.entries()) {
    out.push({
      groupKey,
      representative: groupPieces[0],
      pieces: groupPieces,
      count: groupPieces.length,
    });
  }
  return out;
}

/**
 * Returns true iff the achievement can be purchased with coins in the 3★ Album
 * (never allow buying an achievement whose reward is coins, preventing 100🪙 -> +150🪙 arbitrage).
 */
export function isAchievementPurchasableWithCoins(ach: AchievementDef): boolean {
  return ach.rewardType !== 'coins';
}

/**
 * Returns true iff the player still has at least one locked non-coin equipment/weapon achievement
 * available to unlock in the 3★ Album.
 */
export function hasRemainingShopUnlocks(progress: PlayerProgress): boolean {
  return ACHIEVEMENTS_CATALOG.some(
    (ach) =>
      isAchievementPurchasableWithCoins(ach) &&
      !progress.unlockedAchievements.includes(ach.id)
  );
}

/**
 * Formats grammatically natural singular/plural near-miss defeat copy using "la Fase X/3".
 */
export function formatDefeatNearMissCopy(remainingKills: number, phaseReached: number): string {
  const safeKills = Math.max(1, Math.round(remainingKills));
  if (safeKills === 1) {
    return `¡Casi lo logras! Te faltó solo 1 plaga para superar la Fase ${phaseReached}/3.`;
  }
  return `¡Casi lo logras! Te faltaron solo ${safeKills} plagas para superar la Fase ${phaseReached}/3.`;
}

/**
 * Combines active timeScales using Math.min() so Tactical Slow-Mo (0.20x) and
 * Salvada In Extremis (0.35x) NEVER multiply together (0.20x wins cleanly, never 0.07x).
 */
export function combineActiveTimeScales(
  baseSpeed: number,
  opts: {
    isPlaying: boolean;
    hitstopActive: boolean;
    tacticalSlowMoActive: boolean;
    lastStandActive: boolean;
    inspectorSlowMoActive?: boolean;
    comandaSlowMoActive?: boolean;
  }
): number {
  if (!opts.isPlaying) return 0;
  if (opts.hitstopActive) return 0.04;
  const candidates: number[] = [baseSpeed];
  if (opts.inspectorSlowMoActive) candidates.push(0.08);
  if (opts.tacticalSlowMoActive || opts.comandaSlowMoActive) candidates.push(0.2);
  if (opts.lastStandActive) candidates.push(0.35);
  return Math.min(...candidates);
}

// Static scratch buffers for zero-GC 4x7 Conductive UV flood-fill
const WET_GRID_SCRATCH = new Uint8Array(GRID_RAILS * GRID_ROWS);
const VISITED_GRID_SCRATCH = new Uint8Array(GRID_RAILS * GRID_ROWS);
const BFS_QUEUE_R = new Int8Array(GRID_RAILS * GRID_ROWS);
const BFS_QUEUE_W = new Int8Array(GRID_RAILS * GRID_ROWS);

/**
 * Conductive UV Chain Reaction (Zero-GC static typed-array BFS):
 * When a wet/soaped bug touches an electric/UV beam, propagates an electric arc
 * across contiguous wet/soaped countertop cells (8-way adjacent) to other live bugs.
 */
export function computeConductiveUvChainTargets(
  sourceBugId: string,
  bugs: readonly BugEnemy[],
  chemTiles: readonly TileChemicalState[]
): string[] {
  let source: BugEnemy | undefined;
  for (let i = 0; i < bugs.length; i++) {
    const b = bugs[i];
    if (b.id === sourceBugId && b.koTimer <= 0) {
      source = b;
      break;
    }
  }
  if (!source) return [];

  WET_GRID_SCRATCH.fill(0);
  VISITED_GRID_SCRATCH.fill(0);

  for (let i = 0; i < chemTiles.length; i++) {
    const t = chemTiles[i];
    if (t.kind === 'wet_soap' && t.timer > 0) {
      if (t.rail >= 0 && t.rail < GRID_RAILS && t.row >= 0 && t.row < GRID_ROWS) {
        WET_GRID_SCRATCH[t.row * GRID_RAILS + t.rail] = 1;
      }
    }
  }

  const isBugWetFast = (b: BugEnemy): boolean => {
    if ((b.wetTimer ?? 0) > 0 || b.isSlidingFromSoap) return true;
    const br = Math.round(b.rail);
    const bw = Math.round(b.yProgress);
    if (br < 0 || br >= GRID_RAILS || bw < 0 || bw >= GRID_ROWS) return false;
    return WET_GRID_SCRATCH[bw * GRID_RAILS + br] === 1;
  };

  if (!isBugWetFast(source)) return [];

  const srcRail = Math.max(0, Math.min(GRID_RAILS - 1, Math.round(source.rail)));
  const srcRow = Math.max(0, Math.min(GRID_ROWS - 1, Math.round(source.yProgress)));
  WET_GRID_SCRATCH[srcRow * GRID_RAILS + srcRail] = 1;

  for (let i = 0; i < bugs.length; i++) {
    const b = bugs[i];
    if (b.koTimer <= 0 && isBugWetFast(b)) {
      const br = Math.max(0, Math.min(GRID_RAILS - 1, Math.round(b.rail)));
      const bw = Math.max(0, Math.min(GRID_ROWS - 1, Math.round(b.yProgress)));
      WET_GRID_SCRATCH[bw * GRID_RAILS + br] = 1;
    }
  }

  let head = 0;
  let tail = 0;
  const startIdx = srcRow * GRID_RAILS + srcRail;
  VISITED_GRID_SCRATCH[startIdx] = 1;
  BFS_QUEUE_R[tail] = srcRail;
  BFS_QUEUE_W[tail] = srcRow;
  tail++;

  while (head < tail) {
    const cr = BFS_QUEUE_R[head];
    const cw = BFS_QUEUE_W[head];
    head++;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dw = -1; dw <= 1; dw++) {
        if (dr === 0 && dw === 0) continue;
        const nr = cr + dr;
        const nw = cw + dw;
        if (nr < 0 || nr >= GRID_RAILS || nw < 0 || nw >= GRID_ROWS) continue;
        const nIdx = nw * GRID_RAILS + nr;
        if (VISITED_GRID_SCRATCH[nIdx] === 0 && WET_GRID_SCRATCH[nIdx] === 1) {
          VISITED_GRID_SCRATCH[nIdx] = 1;
          BFS_QUEUE_R[tail] = nr;
          BFS_QUEUE_W[tail] = nw;
          tail++;
        }
      }
    }
  }

  const targetIds: string[] = [];
  for (let i = 0; i < bugs.length; i++) {
    const b = bugs[i];
    if (b.id === sourceBugId || b.koTimer > 0) continue;
    const br = Math.max(0, Math.min(GRID_RAILS - 1, Math.round(b.rail)));
    const bw = Math.max(0, Math.min(GRID_ROWS - 1, Math.round(b.yProgress)));
    if (VISITED_GRID_SCRATCH[bw * GRID_RAILS + br] === 1) {
      targetIds.push(b.id);
    }
  }
  return targetIds;
}

/**
 * Thermal Shock ("Choque Térmico"):
 * When a bug slowed by cold/control receives thermal/fire/UV damage, shatters an extra 50%
 * of carapace/armor and blasts shrapnel to live bugs within 1 cell.
 */
export function computeThermalShockResult(
  bug: BugEnemy,
  allBugs: readonly BugEnemy[],
  isColdEnvironment = false
): {
  triggered: boolean;
  bonusCarapaceDamage: number;
  shrapnelTargetIds: string[];
} {
  const isChilledOrSlowed =
    bug.slowTimer > 0 || (bug.coldTimer ?? 0) > 0 || (isColdEnvironment && bug.yProgress > 0);
  if (!isChilledOrSlowed || (bug.thermalShockCooldown ?? 0) > 0) {
    return { triggered: false, bonusCarapaceDamage: 0, shrapnelTargetIds: [] };
  }

  // Breaks 50% extra carapace (50% of maxHp on standard bugs; 50% of Phase-1 carapace segment on Grand Bosses)
  const bonusCarapaceDamage =
    bug.bossTier === 'grand'
      ? Math.round(bug.maxHp * 0.17)
      : bug.bossTier === 'mini'
      ? Math.round(bug.maxHp * 0.25)
      : Math.round(bug.maxHp * 0.5);

  const shrapnelTargetIds: string[] = [];
  for (const other of allBugs) {
    if (other.id === bug.id || other.koTimer > 0) continue;
    if (
      Math.abs(other.rail - bug.rail) <= 1.25 &&
      Math.abs(other.yProgress - bug.yProgress) <= 1.25
    ) {
      shrapnelTargetIds.push(other.id);
    }
  }

  return {
    triggered: true,
    bonusCarapaceDamage,
    shrapnelTargetIds,
  };
}

/**
 * Physical Knockback ("Empuje físico"):
 * Sweep or explosion weapons (Fregona 360° / Volcán / Hidrolimpiadora) physically push light/medium
 * plagues 1 cell backward (or deflect to a neighboring rail), allowing re-pushing into an active UV Bridge.
 */
export function applyPhysicalKnockback(
  bug: BugEnemy,
  opts: { pushCells?: number; deflectToNeighbor?: boolean } = {}
): {
  applied: boolean;
  nextYProgress: number;
  nextTargetRail: number;
} {
  // Grand Bosses resist standard knockback; Mini-Bosses take reduced push; light/medium take full 1-cell push
  if (bug.bossTier === 'grand' || (bug.knockbackCooldown ?? 0) > 0 || bug.koTimer > 0) {
    return {
      applied: false,
      nextYProgress: bug.yProgress,
      nextTargetRail: bug.targetRail,
    };
  }

  const rawPush = opts.pushCells ?? 1.0;
  const effectivePush = bug.bossTier === 'mini' ? rawPush * 0.45 : rawPush;
  const nextYProgress = Math.max(-0.2, Number((bug.yProgress - effectivePush).toFixed(3)));

  let nextTargetRail = bug.targetRail;
  if (opts.deflectToNeighbor && !bug.bossTier) {
    const curR = Math.max(0, Math.min(GRID_RAILS - 1, Math.round(bug.rail)));
    nextTargetRail = curR < GRID_RAILS - 1 ? curR + 1 : curR - 1;
  }

  return {
    applied: true,
    nextYProgress,
    nextTargetRail,
  };
}

// ============================================================================
// APK PRODUCTION POLISH: META-PROGRESSION ("MEJORAS DE COCINA"), STREAK COINS,
// 20:9 CAMERA PROJECTION, THERMAL THROTTLE, ANDROID BACK & BASE64 BACKUP
// ============================================================================

export const HEAVY_IMPACT_HITSTOP_SECONDS = 0.04; // 40ms micro-hitstop on heavy carapace melt / Ultimate hit
export const ENEMY_WHITE_FLASH_SECONDS = 0.14;    // Crisp white flash duration on enemy mesh

export interface KitchenUpgradeMeta {
  id: KitchenUpgradeId;
  icon: string;
  title: string;
  shortDesc: string;
  costs: [number, number, number];
  levelLabels: [string, string, string, string];
}

export const KITCHEN_UPGRADES_CATALOG: Record<KitchenUpgradeId, KitchenUpgradeMeta> = {
  acidResistance: {
    id: 'acidResistance',
    icon: '🧪',
    title: 'Resistencia al Ácido',
    shortDesc: 'Reduce la duración del pringue ácido sobre tus armas.',
    costs: [140, 260, 420],
    levelLabels: ['Base (0%)', '-15% pringue', '-30% pringue', '-45% pringue'],
  },
  streakCoinBonus: {
    id: 'streakCoinBonus',
    icon: '🔥',
    title: 'Bonus Monedas en Rachas',
    shortDesc: 'Multiplica las monedas extra al superar rachas x8 y x15.',
    costs: [150, 280, 440],
    levelLabels: ['Base (+0%)', '+25% monedas', '+50% monedas', '+80% monedas'],
  },
  whipCooldown: {
    id: 'whipCooldown',
    icon: '🧣',
    title: 'Recarga del Trapazo',
    shortDesc: 'Reduce el enfriamiento del Trapazo defensivo del Chef.',
    costs: [160, 300, 460],
    levelLabels: ['18s recarga', '16s (-2s)', '14s (-4s)', '12s (-6s)'],
  },
  ultBaseCharge: {
    id: 'ultBaseCharge',
    icon: '⚡',
    title: 'Carga Inicial Ultimate',
    shortDesc: 'Empieza cada partida con más presión base en el Ultimate.',
    costs: [180, 320, 480],
    levelLabels: ['45% inicial', '57% (+12%)', '69% (+24%)', '81% (+36%)'],
  },
};

function clampUpgradeLvl(val: unknown): KitchenUpgradeLevel {
  if (typeof val !== 'number' || !Number.isFinite(val)) return 0;
  const n = Math.max(0, Math.min(3, Math.floor(val)));
  return n as KitchenUpgradeLevel;
}

export function normalizeKitchenUpgrades(
  raw?: Partial<KitchenUpgrades> | null
): KitchenUpgrades {
  return {
    acidResistance: clampUpgradeLvl(raw?.acidResistance),
    streakCoinBonus: clampUpgradeLvl(raw?.streakCoinBonus),
    whipCooldown: clampUpgradeLvl(raw?.whipCooldown),
    ultBaseCharge: clampUpgradeLvl(raw?.ultBaseCharge),
  };
}

export function computeKitchenUpgradeEffects(raw?: Partial<KitchenUpgrades> | null): {
  acidDurationMult: number;
  streakCoinMult: number;
  effectiveWhipCooldownSec: number;
  initialUltimatePct: number;
} {
  const u = normalizeKitchenUpgrades(raw);
  const acidMultTable = [1.0, 0.85, 0.7, 0.55] as const;
  const streakMultTable = [1.0, 1.25, 1.5, 1.8] as const;
  const whipCdTable = [18.0, 16.0, 14.0, 12.0] as const;
  const ultInitTable = [45, 57, 69, 81] as const;
  return {
    acidDurationMult: acidMultTable[u.acidResistance],
    streakCoinMult: streakMultTable[u.streakCoinBonus],
    effectiveWhipCooldownSec: whipCdTable[u.whipCooldown],
    initialUltimatePct: ultInitTable[u.ultBaseCharge],
  };
}

export function purchaseKitchenUpgrade(
  progress: PlayerProgress,
  upgradeId: KitchenUpgradeId
): {
  ok: boolean;
  updatedProgress: PlayerProgress;
  costPaid: number;
  newLevel: KitchenUpgradeLevel;
} {
  const current = normalizeKitchenUpgrades(progress.kitchenUpgrades);
  const curLvl = current[upgradeId];
  if (curLvl === 3) {
    return { ok: false, updatedProgress: progress, costPaid: 0, newLevel: curLvl };
  }
  const meta = KITCHEN_UPGRADES_CATALOG[upgradeId];
  const cost = meta.costs[curLvl];
  if (progress.coins < cost) {
    return { ok: false, updatedProgress: progress, costPaid: 0, newLevel: curLvl };
  }
  const nextLvl = (curLvl + 1) as KitchenUpgradeLevel;
  const nextUpgrades: KitchenUpgrades = {
    ...current,
    [upgradeId]: nextLvl,
  };
  return {
    ok: true,
    costPaid: cost,
    newLevel: nextLvl,
    updatedProgress: {
      ...progress,
      coins: Math.max(0, progress.coins - cost),
      kitchenUpgrades: nextUpgrades,
    },
  };
}

/**
 * Grants a coin bonus when an active combo/kill streak crosses x8 or x15.
 */
export function computeStreakMilestoneReward(
  prevStreak: number,
  nextStreak: number,
  upgrades?: Partial<KitchenUpgrades> | null
): { crossedThreshold: 8 | 15 | null; bonusCoins: number } {
  const { streakCoinMult } = computeKitchenUpgradeEffects(upgrades);
  if (prevStreak < 15 && nextStreak >= 15) {
    return {
      crossedThreshold: 15,
      bonusCoins: Math.round(35 * streakCoinMult),
    };
  }
  if (prevStreak < 8 && nextStreak >= 8) {
    return {
      crossedThreshold: 8,
      bonusCoins: Math.round(15 * streakCoinMult),
    };
  }
  return { crossedThreshold: null, bonusCoins: 0 };
}

/**
 * Responsive 3D camera projection & pullback for ultra-tall 20:9 / 21:9 APK viewports (aspect < 0.5)
 * so the leftmost (Rail 0) and rightmost (Rail 3) gourmet plates never clip off-screen.
 */
export function computeResponsiveCameraParams(
  width: number,
  height: number
): {
  aspect: number;
  fov: number;
  camY: number;
  camZ: number;
  lookY: number;
  lookZ: number;
} {
  const safeW = Math.max(1, width);
  const safeH = Math.max(1, height);
  const aspect = safeW / safeH;
  const lookY = -0.46;
  const lookZ = 0.16;

  if (aspect >= 0.85) {
    return { aspect, fov: 46, camY: 9.5, camZ: 10.2, lookY, lookZ };
  }

  if (aspect >= 0.5) {
    const halfVFov = Math.atan(0.24 / aspect);
    const rawFov = (halfVFov * 2 * 180) / Math.PI;
    const fov = Number(Math.min(55, Math.max(47, rawFov)).toFixed(2));
    return { aspect, fov, camY: 9.5, camZ: 10.2, lookY, lookZ };
  }

  // Ultra-narrow mobile / 20:9 / 21:9 aspect (< 0.5): widen FOV & pull camera back so outer plates never clip
  const narrowT = Math.min(1, Math.max(0, (0.5 - aspect) / 0.08));
  const halfVFov = Math.atan(0.285 / Math.max(0.38, aspect));
  const rawFov = (halfVFov * 2 * 180) / Math.PI;
  const fov = Number(Math.min(62, Math.max(56.5, rawFov)).toFixed(2));
  const camY = Number((9.5 + narrowT * 1.65).toFixed(3));
  const camZ = Number((10.2 + narrowT * 2.35).toFixed(3));
  return { aspect, fov, camY, camZ, lookY, lookZ };
}

/**
 * Thermal & FPS safeguard for Survival Rush:
 * Automatically halves decorative particle spawns (0.5x) if sustained frame time exceeds 24ms,
 * with clean hysteresis recovery below 19.5ms.
 */
export function computeThermalParticleBudgetFactor(
  isRushMode: boolean,
  sustainedFrameMs: number,
  currentlyReduced = false
): number {
  if (!isRushMode) return 1.0;
  if (sustainedFrameMs > 24) return 0.5;
  if (currentlyReduced && sustainedFrameMs > 19.5) return 0.5;
  return 1.0;
}

export type AndroidBackResolution =
  | 'close_quick_guide'
  | 'close_onboarding'
  | 'close_codex'
  | 'close_wardrobe'
  | 'close_settings'
  | 'close_upgrades'
  | 'close_strategic'
  | 'open_pause'
  | 'resume_from_pause'
  | 'exit_gameover_to_title'
  | 'noop';

/**
 * Resolves Android hardware/gesture "Back" (`popstate` / `backbutton`) so it closes any open modal
 * or opens the Pause menu in-game instead of abruptly exiting the APK.
 */
export function resolveAndroidBackAction(ui: {
  gameState: GameState;
  showQuickGuide?: boolean;
  showOnboardingModal: boolean;
  showCodex: boolean;
  showWardrobe: boolean;
  showSettings: boolean;
  showKitchenUpgrades: boolean;
  showStrategicModal: boolean;
}): AndroidBackResolution {
  if (ui.showQuickGuide) return 'close_quick_guide';
  if (ui.showOnboardingModal) return 'close_onboarding';
  if (ui.showCodex) return 'close_codex';
  if (ui.showWardrobe) return 'close_wardrobe';
  if (ui.showSettings) return 'close_settings';
  if (ui.showKitchenUpgrades) return 'close_upgrades';
  if (ui.showStrategicModal) return 'close_strategic';
  if (ui.gameState === 'playing') return 'open_pause';
  if (ui.gameState === 'paused') return 'resume_from_pause';
  if (ui.gameState === 'gameover') return 'exit_gameover_to_title';
  return 'noop';
}

function fnv1aHex(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function utf8ToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  if (typeof btoa === 'function') {
    return btoa(binary);
  }
  return Buffer.from(bytes).toString('base64');
}

function base64ToUtf8(b64: string): string {
  if (typeof atob === 'function') {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  }
  return Buffer.from(b64, 'base64').toString('utf8');
}

const VALID_WORLDS: readonly WorldId[] = [
  'sunny_counter',
  'fridge_vault',
  'iron_stoves',
  'pastry_marble',
];
const VALID_HATS: readonly HatId[] = [
  'classic_toque',
  'duck_shower_cap',
  'bucket_helmet',
  'tp_gasmask',
];
const VALID_ARMORS: readonly ArmorId[] = [
  'white_apron',
  'hazmat_epi',
  'golden_scourer_mail',
];
/** Ids de Ultimate retirados → id actual (partidas guardadas y códigos de copia antiguos). */
const LEGACY_SPECIAL_IDS: Record<string, SpecialWeaponId> = {
  karcher_blast: 'hydro_blast',
  knife_roomba: 'knife_robot',
};

/** Traduce un id de Ultimate antiguo al actual; deja igual cualquier otro valor. */
export function migrateSpecialId(id: unknown): unknown {
  return typeof id === 'string' && id in LEGACY_SPECIAL_IDS ? LEGACY_SPECIAL_IDS[id] : id;
}

/** Aplica `migrateSpecialId` a los campos de Ultimate de un progreso guardado. */
export function migrateLegacyProgressIds<T extends { equippedSpecial?: unknown; unlockedSpecials?: unknown }>(
  prog: T
): T {
  return {
    ...prog,
    ...(prog.equippedSpecial !== undefined ? { equippedSpecial: migrateSpecialId(prog.equippedSpecial) } : {}),
    ...(Array.isArray(prog.unlockedSpecials)
      ? { unlockedSpecials: Array.from(new Set(prog.unlockedSpecials.map(migrateSpecialId))) }
      : {}),
  };
}

export const VALID_SPECIALS: readonly SpecialWeaponId[] = [
  'hydro_blast',
  'baking_volcano',
  'knife_robot',
];

/**
 * Encodes account progress (and optional settings) into a checksummed Base64 backup code
 * (`CB1:<checksum>:<base64>`) for serverless device-to-device transfer.
 */
export function exportProgressToBase64(
  progress: PlayerProgress,
  settings?: GameSettings
): string {
  const payload = JSON.stringify({
    v: 1,
    app: 'chef_bastion',
    progress: {
      ...progress,
      kitchenUpgrades: normalizeKitchenUpgrades(progress.kitchenUpgrades),
    },
    ...(settings ? { settings } : {}),
  });
  const encoded = utf8ToBase64(payload);
  const checksum = fnv1aHex(payload);
  return `CB1:${checksum}:${encoded}`;
}

/**
 * Strictly validates and decodes a Base64 backup string (`CB1:<checksum>:<base64>`).
 * Rejects empty, malformed, tampered, or out-of-schema payloads without silent fallbacks.
 */
export function importProgressFromBase64(
  rawCode: string
):
  | { ok: true; progress: PlayerProgress; settings?: GameSettings }
  | { ok: false; error: string } {
  const trimmed = (rawCode ?? '').trim();
  if (!trimmed) {
    return { ok: false, error: 'Pega un código de respaldo Base64 antes de importar.' };
  }
  const parts = trimmed.split(':');
  if (parts.length !== 3 || parts[0] !== 'CB1' || !/^[0-9a-f]{8}$/i.test(parts[1]) || !parts[2]) {
    return { ok: false, error: 'Formato inválido: el código debe empezar por CB1:.' };
  }

  let jsonStr = '';
  try {
    jsonStr = base64ToUtf8(parts[2]);
  } catch {
    return { ok: false, error: 'El código Base64 está corrupto o incompleto.' };
  }

  const expectedHash = fnv1aHex(jsonStr);
  if (expectedHash.toLowerCase() !== parts[1].toLowerCase()) {
    return { ok: false, error: 'Código alterado o incompleto (fallo de verificación).' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    return { ok: false, error: 'Datos internos no válidos en el respaldo.' };
  }

  if (
    !parsed ||
    typeof parsed !== 'object' ||
    (parsed as { app?: string }).app !== 'chef_bastion' ||
    !(parsed as { progress?: unknown }).progress ||
    typeof (parsed as { progress?: unknown }).progress !== 'object'
  ) {
    return { ok: false, error: 'El código no pertenece a una partida de Chef Bastion.' };
  }

  const rawProg = (parsed as { progress: Record<string, unknown> }).progress;
  if (
    typeof rawProg.coins !== 'number' ||
    !Number.isFinite(rawProg.coins) ||
    rawProg.coins < 0 ||
    typeof rawProg.currentLevel !== 'number' ||
    !Number.isFinite(rawProg.currentLevel) ||
    rawProg.currentLevel < 1
  ) {
    return { ok: false, error: 'Datos de nivel o monedas inválidos en el código.' };
  }

  const filterList = <T extends string>(arr: unknown, allowed: readonly T[], fallback: T[]): T[] => {
    if (!Array.isArray(arr)) return fallback;
    const valid = arr.filter((x): x is T => typeof x === 'string' && allowed.includes(x as T));
    return valid.length > 0 ? Array.from(new Set(valid)) : fallback;
  };

  const unlockedWorlds = filterList(rawProg.unlockedWorlds, VALID_WORLDS, ['sunny_counter']);
  const unlockedHats = filterList(rawProg.unlockedHats, VALID_HATS, ['classic_toque']);
  const unlockedArmors = filterList(rawProg.unlockedArmors, VALID_ARMORS, ['white_apron']);
  const migratedSpecials = migrateLegacyProgressIds({
    equippedSpecial: rawProg.equippedSpecial,
    unlockedSpecials: rawProg.unlockedSpecials,
  });
  const unlockedSpecials = filterList(migratedSpecials.unlockedSpecials, VALID_SPECIALS, ['hydro_blast']);

  const currentWorld = VALID_WORLDS.includes(rawProg.currentWorld as WorldId)
    ? (rawProg.currentWorld as WorldId)
    : 'sunny_counter';
  const equippedHat = VALID_HATS.includes(rawProg.equippedHat as HatId)
    ? (rawProg.equippedHat as HatId)
    : 'classic_toque';
  const equippedArmor = VALID_ARMORS.includes(rawProg.equippedArmor as ArmorId)
    ? (rawProg.equippedArmor as ArmorId)
    : 'white_apron';
  const equippedSpecial = VALID_SPECIALS.includes(migratedSpecials.equippedSpecial as SpecialWeaponId)
    ? (migratedSpecials.equippedSpecial as SpecialWeaponId)
    : 'hydro_blast';

  const currentLevel = Math.max(1, Math.floor(rawProg.currentLevel));
  const highestLevel =
    typeof rawProg.highestLevel === 'number' && Number.isFinite(rawProg.highestLevel)
      ? Math.max(currentLevel, Math.floor(rawProg.highestLevel))
      : currentLevel;

  const validatedProgress: PlayerProgress = {
    currentLevel,
    highestLevel,
    currentWorld,
    unlockedWorlds,
    coins: Math.max(0, Math.floor(rawProg.coins)),
    unlockedAchievements: Array.isArray(rawProg.unlockedAchievements)
      ? rawProg.unlockedAchievements.filter((x): x is string => typeof x === 'string')
      : [],
    unlockedHats,
    unlockedArmors,
    unlockedSpecials,
    equippedHat,
    equippedArmor,
    equippedSpecial,
    bestScore:
      typeof rawProg.bestScore === 'number' && Number.isFinite(rawProg.bestScore)
        ? Math.max(0, Math.floor(rawProg.bestScore))
        : 0,
    totalBugsCleaned:
      typeof rawProg.totalBugsCleaned === 'number' && Number.isFinite(rawProg.totalBugsCleaned)
        ? Math.max(0, Math.floor(rawProg.totalBugsCleaned))
        : 0,
    bestRushSeconds:
      typeof rawProg.bestRushSeconds === 'number' && Number.isFinite(rawProg.bestRushSeconds)
        ? Math.max(0, Math.floor(rawProg.bestRushSeconds))
        : 0,
    unlockedRushMilestones: Array.isArray(rawProg.unlockedRushMilestones)
      ? rawProg.unlockedRushMilestones.filter((x): x is string => typeof x === 'string')
      : [],
    kitchenUpgrades: normalizeKitchenUpgrades(
      rawProg.kitchenUpgrades as Partial<KitchenUpgrades> | undefined
    ),
    levelStars: sanitizeLevelStars(rawProg.levelStars),
  };

  let validatedSettings: GameSettings | undefined;
  const rawSet = (parsed as { settings?: Record<string, unknown> }).settings;
  if (rawSet && typeof rawSet === 'object') {
    const clampVol = (v: unknown, def: number) =>
      typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(100, Math.round(v))) : def;
    const speed =
      rawSet.gameSpeedMultiplier === 0.75 ||
      rawSet.gameSpeedMultiplier === 1.0 ||
      rawSet.gameSpeedMultiplier === 1.25
        ? rawSet.gameSpeedMultiplier
        : DEFAULT_SETTINGS.gameSpeedMultiplier;
    const hints =
      rawSet.smartComboHints === 'onboarding' ||
      rawSet.smartComboHints === 'always' ||
      rawSet.smartComboHints === 'off'
        ? rawSet.smartComboHints
        : DEFAULT_SETTINGS.smartComboHints;
    validatedSettings = {
      masterVolume: clampVol(rawSet.masterVolume, DEFAULT_SETTINGS.masterVolume),
      sfxVolume: clampVol(rawSet.sfxVolume, DEFAULT_SETTINGS.sfxVolume),
      bgmVolume: clampVol(rawSet.bgmVolume, DEFAULT_SETTINGS.bgmVolume),
      muted: typeof rawSet.muted === 'boolean' ? rawSet.muted : DEFAULT_SETTINGS.muted,
      gameSpeedMultiplier: speed,
      tacticalSlowMo:
        typeof rawSet.tacticalSlowMo === 'boolean'
          ? rawSet.tacticalSlowMo
          : DEFAULT_SETTINGS.tacticalSlowMo,
      screenShake:
        typeof rawSet.screenShake === 'boolean' ? rawSet.screenShake : DEFAULT_SETTINGS.screenShake,
      hapticsEnabled:
        typeof rawSet.hapticsEnabled === 'boolean'
          ? rawSet.hapticsEnabled
          : DEFAULT_SETTINGS.hapticsEnabled,
      smartComboHints: hints,
      prioritize60Fps:
        typeof rawSet.prioritize60Fps === 'boolean'
          ? rawSet.prioritize60Fps
          : DEFAULT_SETTINGS.prioritize60Fps,
    };
  }

  return {
    ok: true,
    progress: validatedProgress,
    settings: validatedSettings,
  };
}

// ============================================================================
// TACTICAL INSPECTOR (0.08x), LOGICAL TITLE ONBOARDING & FLOATING POOL
// ============================================================================

/**
 * Recommends Strategic Mode first on the Title Screen until the player clears Level 2 (reaches Level 3),
 * so new players learn each weapon step-by-step before diving into frantic Survival Rush.
 */
export function shouldRecommendStrategicFirst(
  progress: Pick<PlayerProgress, 'highestLevel'>
): boolean {
  return (progress.highestLevel ?? 1) < 3;
}

const PLAIN_WEAPON_INSPECTOR_COPY: Record<
  UtensilType,
  { whatItDoes: string; combineOrMerge: string; accent: TacticalInspectorCardData['accent'] }
> = {
  spray_flus: {
    whatItDoes: 'Disparo rápido frontal que moja plagas.',
    combineOrMerge: 'Pon detrás de Estropajo para abanico ×5 · Arrastra sobre otra igual para Plata/Oro.',
    accent: 'cyan',
  },
  scourer_nanas: {
    whatItDoes: 'Espuma que frena a los bichos y divide disparos en ×5.',
    combineOrMerge: 'Pon delante de Flus-Flus o Lejía · Arrastra sobre otra igual para Plata/Oro.',
    accent: 'green',
  },
  aerosol_torch: {
    whatItDoes: 'Conecta un rayo eléctrico con otro Aerosol UV en la misma fila.',
    combineOrMerge: 'Pon 2 en la misma fila para fundir chapas · Arrastra sobre otro igual para Plata/Oro.',
    accent: 'pink',
  },
  soap_bar: {
    whatItDoes: 'Desvía tus disparos y plagas en diagonal hacia otro carril.',
    combineOrMerge: 'Pon al lado de Fregona para centrifugar 3★ · Arrastra sobre otra igual para Plata/Oro.',
    accent: 'pink',
  },
  mop_vortex: {
    whatItDoes: 'Gira en 360° mojando y empujando plagas 1 casilla atrás.',
    combineOrMerge: 'Recibe plagas desviadas por Jabón 45° · Arrastra sobre otra igual para Plata/Oro.',
    accent: 'cyan',
  },
  wc_shield: {
    whatItDoes: 'Escudo frontal que bloquea y rebota escupitajos ácidos.',
    combineOrMerge: 'Pon en carriles con Moscas Ácidas · Arrastra sobre otro igual para Plata/Oro.',
    accent: 'cyan',
  },
  bleach_cannon: {
    whatItDoes: 'Chorro pesado corrosivo que arrasa su carril.',
    combineOrMerge: 'Pon detrás de Estropajo para súper espuma · Arrastra sobre otro igual para Plata/Oro.',
    accent: 'yellow',
  },
  corner_square: {
    whatItDoes: 'Gira 90° hacia abajo a bichos laterales y rebota disparos.',
    combineOrMerge: 'Pon arriba de Estropajo o Flus-Flus · En Oro + Flus-Flus Oro = Ricochet ×4.',
    accent: 'yellow',
  },
};

/**
 * Builds the 2-line plain-language Tactical Inspector Card shown during 0.08x reading slow-mo.
 */
export function getTacticalInspectorCard(
  target: TacticalInspectionTarget | null,
  opts: {
    pieces: readonly UtensilPiece[];
    intactPlates: readonly boolean[];
    vipPlateRail: number | null;
    equippedSpecial: SpecialWeaponId;
    ultimateCharge: number;
    isRushMode: boolean;
  }
): TacticalInspectorCardData | null {
  if (!target) return null;

  if (target.kind === 'plate') {
    const meta = MENU_PLATE_BUFF_META[target.rail] ?? MENU_PLATE_BUFF_META[0];
    const intact = Boolean(opts.intactPlates[target.rail]);
    const isVip = opts.vipPlateRail === target.rail;
    return {
      title: `${meta.icon} ${meta.name}${isVip ? ' · ⭐ VIP ×2' : ''}`,
      badge: intact ? 'MENÚ VIVO ACTIVO' : 'PLATO DEVORADO',
      whatItDoes: intact
        ? `Intacto te da ${meta.desc}.`
        : `Devorado: perdiste ${meta.desc}.`,
      combineOrMerge: isVip
        ? '¡Protégelo hasta el final para duplicar tus monedas (×2)!'
        : 'Si pierdes los 4 platos termina la partida · Protégelo con combos.',
      accent: intact ? 'green' : 'pink',
    };
  }

  if (target.kind === 'ultimate') {
    const spec = SPECIAL_WEAPONS_CATALOG[opts.equippedSpecial] ?? SPECIAL_WEAPONS_CATALOG.hydro_blast;
    const pct = Math.min(100, Math.max(0, Math.round(opts.ultimateCharge)));
    return {
      title: `${spec.icon} ${spec.name}`,
      badge: pct >= 100 ? '¡LISTO PARA LANZAR!' : `CARGA ${pct}%`,
      whatItDoes: spec.desc,
      combineOrMerge:
        pct >= 100
          ? '¡Toca el botón amarillo 100% para limpiar la encimera al instante!'
          : 'Carga rápido logrando bajas de combo 2★/3★ y protegiendo el Plato 4 (Postre).',
      accent: 'yellow',
    };
  }

  // Piece target (from board or bottom tray)
  const found = opts.pieces.find((p) => p.id === target.pieceId);
  const pieceType: UtensilType = found?.type ?? target.pieceType ?? 'spray_flus';
  const level = found?.level ?? target.level ?? 1;
  const evolutionId: SupremeEvolutionId | undefined = found?.evolutionId ?? target.evolutionId;

  if (evolutionId && SUPREME_EVOLUTIONS_CATALOG[evolutionId]) {
    const evo = SUPREME_EVOLUTIONS_CATALOG[evolutionId];
    return {
      title: `${evo.icon} ${evo.name}`,
      badge: 'EVOLUCIÓN SUPREMA NV.4',
      whatItDoes: evo.description,
      combineOrMerge: 'Súper-torreta definitiva en 1 sola casilla · Arrástrala libremente si necesitas reubicarla.',
      accent: 'yellow',
    };
  }

  const meta = UTENSIL_CATALOG[pieceType];
  const copy = PLAIN_WEAPON_INSPECTOR_COPY[pieceType];
  const tierLabel =
    level >= 3 ? 'NV.3 ORO' : level === 2 ? 'NV.2 PLATA' : 'NV.1 BASE';

  let combineLine = copy.combineOrMerge;
  if (opts.isRushMode && level === 3) {
    const evoRecipes = Object.values(SUPREME_EVOLUTIONS_CATALOG).filter(
      (e) => e.recipeA === pieceType || e.recipeB === pieceType
    );
    if (evoRecipes.length > 0) {
      const partnerNames = evoRecipes
        .map((e) => {
          const other = e.recipeA === pieceType ? e.recipeB : e.recipeA;
          return `${UTENSIL_CATALOG[other].shortName} Oro ➔ ${e.shortName}`;
        })
        .join(' · ');
      combineLine = `¡Une con ${partnerNames}!`;
    }
  } else if (!opts.isRushMode) {
    // Strategic Mode focuses on positional combos without merge clutter
    combineLine = meta.comboRecipe;
  }

  const ammoSuffix =
    opts.isRushMode && pieceType === 'aerosol_torch' && found
      ? found.depleteTimer !== undefined
        ? ` · VACÍO (${found.depleteTimer.toFixed(1)}s)`
        : found.ammo !== undefined && found.maxAmmo !== undefined
        ? ` · ${Math.ceil(found.ammo)}/${found.maxAmmo}`
        : ''
      : '';

  return {
    title: `${meta.icon} ${meta.shortName}`,
    badge: `${UTENSIL_ROLE_TAGS[pieceType].toUpperCase()} · ${tierLabel}${ammoSuffix}`,
    whatItDoes: copy.whatItDoes,
    combineOrMerge: combineLine,
    accent: copy.accent,
  };
}

/**
 * Computes which placed board pieces should pulse Gold ('merge' / 'evolve') or Green ('synergy')
 * while a weapon is selected in the tray or on the countertop.
 */
export function computeBoardPartnerHighlights(
  selectedPiece: Pick<UtensilPiece, 'id' | 'type' | 'level' | 'evolutionId'> | null,
  boardPieces: readonly UtensilPiece[],
  isRushMode: boolean
): BoardPartnerHighlight[] {
  if (!selectedPiece) return [];
  const out: BoardPartnerHighlight[] = [];

  const isSynergyPair = (a: UtensilType, b: UtensilType): boolean => {
    if (
      ((a === 'spray_flus' || a === 'bleach_cannon') && b === 'scourer_nanas') ||
      (a === 'scourer_nanas' && (b === 'spray_flus' || b === 'bleach_cannon'))
    ) {
      return true;
    }
    if (a === 'aerosol_torch' && b === 'aerosol_torch') return true;
    if ((a === 'soap_bar' && b === 'mop_vortex') || (a === 'mop_vortex' && b === 'soap_bar')) {
      return true;
    }
    if (a === 'corner_square' || b === 'corner_square') return true;
    return false;
  };

  for (let i = 0; i < boardPieces.length; i++) {
    const other = boardPieces[i];
    if (other.id === selectedPiece.id || other.rail === null || other.row === null) continue;

    if (isRushMode && matchSupremeEvolution(selectedPiece, other)) {
      out.push({
        pieceId: other.id,
        rail: other.rail,
        row: other.row,
        kind: 'evolve',
      });
      continue;
    }

    if (
      isRushMode &&
      selectedPiece.type === other.type &&
      selectedPiece.level === other.level &&
      selectedPiece.level < 3 &&
      !selectedPiece.evolutionId &&
      !other.evolutionId
    ) {
      out.push({
        pieceId: other.id,
        rail: other.rail,
        row: other.row,
        kind: 'merge',
      });
      continue;
    }

    if (isSynergyPair(selectedPiece.type, other.type)) {
      out.push({
        pieceId: other.id,
        rail: other.rail,
        row: other.row,
        kind: 'synergy',
      });
    }
  }

  return out;
}

export const MAX_FLOATING_COMBO_POOL = 6;

/**
 * Inserts a floating "+180 · x4" event into a fixed-size pool (`<= 6`) while separating `yPct`
 * so two simultaneous floating texts NEVER share the same vertical Y band or overlap.
 */
export function pushFloatingComboNonOverlapping(
  existing: readonly FloatingComboEvent[],
  incoming: FloatingComboEvent,
  maxPool = MAX_FLOATING_COMBO_POOL
): FloatingComboEvent[] {
  const trimmed =
    existing.length >= maxPool ? existing.slice(existing.length - (maxPool - 1)) : [...existing];

  let adjustedY = Math.max(22, Math.min(68, incoming.yPct));
  const minGapPct = 7.5;
  for (let attempt = 0; attempt < 6; attempt++) {
    const collides = trimmed.some((ev) => Math.abs(ev.yPct - adjustedY) < minGapPct);
    if (!collides) break;
    adjustedY -= 8;
    if (adjustedY < 22) {
      adjustedY = 66 - (attempt % 3) * 8;
    }
  }

  trimmed.push({
    ...incoming,
    yPct: Number(adjustedY.toFixed(1)),
  });
  return trimmed;
}



