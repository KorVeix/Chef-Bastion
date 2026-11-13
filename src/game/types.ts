export type GameState = 'title' | 'playing' | 'paused' | 'gameover';
export type GameMode = 'rush' | 'strategic';

export type WorldId = 'sunny_counter' | 'fridge_vault' | 'iron_stoves' | 'pastry_marble';

export type BiomeId =
  | 'main_kitchen'    // Bioma 0 (Niveles 1-19): La Cocina Principal
  | 'dining_hall'     // Bioma 1 (Niveles 20-38): El Comedor / Sala
  | 'tavern_bar'      // Bioma 2 (Niveles 39-57): El Bar / Taberna
  | 'freezer_vault'   // Bioma 3 (Niveles 58-76): Cámara Frigorífica / Despensa
  | 'rooftop_terrace';// Bioma 4 (Niveles 77-95): Terraza / Azotea Gourmet

export interface BiomeConfig {
  rawBiomeIndex: number;
  biomeIndex: number; // 0..4
  cycleCount: number; // 0 for levels 1-95, +1 per 95-level loop
  id: BiomeId;
  name: string;
  shortName: string;
  subtitle: string;
  zoneBanner: string;
  wallHex: string;
  counterHex: string;
  sideCounterHex: string;
  floorHex: string;
  trimHex: string;
  friction: number;        // 1.0 standard, 1.4 tablecloth, 0.35 wet bar, 0.08 ice
  bounciness: number;      // 1.0 standard, 0.6 barstools, 0.85 rooftop umbrellas
  lateralWindForce: number;// > 0 on rooftop_terrace
  cycleSpeedMultiplier: number; // 1 + cycleCount * 0.10
}

export type UtensilType =
  | 'spray_flus'      // Emisor rápido de gotas cian/verdes presurizadas hacia delante
  | 'bleach_cannon'   // Cañón pesado de lejía amarilla corrosiva
  | 'scourer_nanas'   // Estropajo amarillo/verde (Multiplicador en Línea -> 5 burbujas en abanico)
  | 'aerosol_torch'   // Aerosol Mata-Todo / UV (Puente Horizontal láser violeta neón -> funde chapas)
  | 'soap_bar'        // Pastilla de Jabón rosa a 45° (Desvía al bicho patinando al raíl vecino)
  | 'mop_vortex'      // Fregona Turbo-Spin 3000 RPM (Centrifuga y lanza espiral Bullet Hell 360°)
  | 'wc_shield'       // Pastilla WC Reflectora (Bloquea y devuelve proyectiles enemigos)
  | 'corner_square';  // Escuadra Deflectora 90° (Nivel 31+: redirige bichos laterales en ángulo recto hacia el carril)

export type BugType =
  | 'speed_ant'       // Hormiga Velocista (Canica negra rápida con casco de miga)
  | 'cap_beetle'      // Escarabajo Chapa / Rata Blindada (Blindado frontal con chapa -> ¡CLINK!)
  | 'acid_wasp'       // Avispa Bombardera (Dispara gotas de miel ácida morada que pringan piezas)
  | 'shift_roach'     // Cucaracha Saltarraíl (Esquiva cambiando de raíl si no la atrapas en combo)
  | 'king_crab';      // Rey Cangrejo / Rey Rata de Olla (Mini-Jefe X5 o Gran Jefe 3 Fases X0)

export type BossPuzzleType = 'soap_stun' | 'uv_overheat' | 'square_deflect';
export type BossTier = 'mini' | 'grand';

export type KillStarRating = 1 | 2 | 3;

export type HatId = 'classic_toque' | 'duck_shower_cap' | 'bucket_helmet' | 'tp_gasmask';
export type ArmorId = 'white_apron' | 'hazmat_epi' | 'golden_scourer_mail';
export type SpecialWeaponId = 'karcher_blast' | 'baking_volcano' | 'knife_roomba';

export type SupremeEvolutionId =
  | 'centrifuge_vortex'   // Jabón 45° (Nv.3) + Fregona (Nv.3)
  | 'plasma_uv_cannon'    // Aerosol UV (Nv.3) + Estropajo (Nv.3)
  | 'ricochet_washer'     // Flus-Flus (Nv.3) + Escuadra (Nv.3)
  | 'tesla_sanitary_coil' // Aerosol UV (Nv.3) + Aerosol UV (Nv.3)
  | 'foam_mortar';        // Flus-Flus (Nv.3) + Jabón 45° (Nv.3)

export interface UtensilPiece {
  id: string;
  type: UtensilType;
  level: number;       // 1 = Base, 2 = Plata, 3 = Oro, 4 = Evolución Suprema
  evolutionId?: SupremeEvolutionId;
  rail: number | null; // 0..3 when on board, null when in tray
  row: number | null;  // 0..6 when on board (0 = top near bugs, 6 = bottom near Chef)
  gunkTimer: number;   // > 0 means "Pringada de Mugre" (disabled until tapped/moved or timer expires)
  cooldown: number;    // 0.3s snap cooldown after moving, then firing timer
  fireTimer: number;
  comboType: 'none' | 'line_foam' | 'bridge_uv' | 'slip_vortex' | 'shield_reflect' | 'deflect_90';
  ammo?: number;       // Remaining charges for aerosol_torch in Rush
  maxAmmo?: number;    // Max charges for current tier
  depleteTimer?: number; // > 0 when ammo === 0: blinks for 3.0s then disappears
  wearRemaining?: number; // Rush only: seconds of service left before the weapon wears out
  wearMax?: number;       // Rush only: full service time for its current level
}

export interface BugEnemy {
  id: string;
  type: BugType;
  rail: number;        // 0..3 (current rail, or -0.85 / 3.85 when entering laterally)
  targetRail: number;  // for smooth sliding when hitting soap_bar or shifting
  yProgress: number;   // -0.4 (warning in vent) to 6.85 (Bastion border)
  hp: number;
  maxHp: number;
  hasShield: boolean;  // Bottle cap frontal shield on cap_beetle / mini-boss
  isSlidingFromSoap: boolean;
  hitByDiagonalFoam: boolean;
  hitByBridgeBurn: boolean;
  hitByVortexSpin: boolean;
  slowTimer: number;
  flashTimer: number;
  attackWindup: number; // 0..1 telegraph before shooting acid or ramming
  koTimer: number;      // > 0 when defeated and flying/spinning out
  koStar: KillStarRating;
  // Level 31+ Lateral Invasion mechanics
  isLateralInvasion?: boolean;
  lateralDir?: -1 | 0 | 1; // 1 = entering from left toward right, -1 = entering from right toward left
  redirectedBySquare?: boolean;
  // Boss Architecture: Mini-Bosses (X5) & 3-Phase Grand Bosses (X0)
  isPuzzleBoss?: boolean;
  bossTier?: BossTier;
  bossPuzzleType?: BossPuzzleType;
  bossPhase?: 1 | 2 | 3;       // Real-time 100-67% (1), 66-34% (2), 33-0% (3) for Grand Bosses
  bossArmorBroken?: boolean;   // True when UV/explosive melts Phase 1 heavy carapace
  bossEvadeTimer?: number;     // Rail-shift / sabotage timer in Phase 2+
  bossFrenzyTriggered?: boolean; // Escort/lateral ambush trigger in Phase 3
  bossPhaseFlashTimer?: number;  // 300ms visual flash on phase break
  bossStunTimer?: number;      // > 0 when boss mechanic is countered
  // Emergent Countertop Chemistry, Knockback & Active Chef Stun
  wetTimer?: number;           // > 0 when soaked/soaped (conducts UV electric arcs)
  coldTimer?: number;          // > 0 when chilled/slowed (triggers Thermal Shock on fire/UV)
  knockbackCooldown?: number;  // Prevents infinite frame-by-frame knockback pinning
  roachShiftTimer?: number;    // Cucaracha de guion: segundos hasta el próximo cambio de carril
  roachShiftDir?: 1 | -1;      // Cucaracha de guion: sentido del próximo cambio (zigzag)
  isFlying?: boolean;          // Avispa de guion: vuela, Jabón y Fregona no la tocan
  chainArcCooldown?: number;   // Cooldown between conductive UV chain zaps
  thermalShockCooldown?: number; // Cooldown between Thermal Shock shrapnel bursts
  chefStunTimer?: number;      // 1.0s stun from Chef's active "Trapazo de cocina"
}

export type TileStateKind = 'wet_soap' | 'acid_pool';

export interface TileChemicalState {
  rail: number;
  row: number;
  kind: TileStateKind;
  timer: number; // 4.0s temporary countertop state
}

export interface LiveMenuBuffs {
  thermalRateMult: number;     // Plate 1 (Pizza): +15% fire/tick rate on thermal & UV
  controlDurationMult: number; // Plate 2 (Queso/Uvas): +15% slow & control duration
  frontalDamageMult: number;   // Plate 3 (Principal): +15% direct frontal projectile damage
  ultChargeMult: number;       // Plate 4 (Postre): +20% Ultimate charge speed per kill
}

export interface ActiveBossHudInfo {
  id: string;
  tier: BossTier;
  name: string;
  hpPct: number;        // 0..100
  phase: 1 | 2 | 3;
  phaseLabel: string;
  armorMelted: boolean;
  phaseJustBroke: boolean;
}

export interface RangePreviewCell {
  rail: number;
  row: number;
  role: 'damage' | 'deflect' | 'area';
}

export interface LevelForecast {
  bugTypes: BugType[];
  activeRails: number[]; // 0..3
  hasLateralConduits: boolean;
  bossTier: 'none' | BossTier;
}

export interface SmartComboHint {
  rail: number;
  row: number;
  pieceType: UtensilType;
  message: string;
  color: 'orange' | 'green' | 'cyan' | 'yellow';
}

export interface TacticalOnboardingDiagramCell {
  rail: number; // 1..4 human-readable
  row: number;  // 3..6 human-readable
  icon: string;
  label: string;
  highlightColor: 'green' | 'orange' | 'cyan' | 'yellow';
}

export interface TacticalOnboardingCardData {
  level: number;
  badge: string;
  title: string;
  subtitle: string;
  cells: TacticalOnboardingDiagramCell[];
  flowArrowLabel: string;
  rewardTitle: string;
  rewardExplanation: string;
}

export interface Projectile {
  id: string;
  x: number;           // continuous rail coordinate (0..3)
  y: number;           // continuous row coordinate (0..6)
  vx: number;
  vy: number;
  damage: number;
  isEnemy: boolean;
  flavor:
    | 'water_drop'
    | 'bleach_glob'
    | 'foam_fan'
    | 'vortex_soap'
    | 'enemy_acid'
    | 'reflected_bubble'
    | 'roomba_blade'
    | 'volcano_foam'
    | 'plasma_wave'
    | 'ricochet_jet'
    | 'mortar_shell';
  pierceShield: boolean;
  isExplosiveOrThermal?: boolean;
  fromDiagonalFoam: boolean;
  fromVortex: boolean;
  bouncesLeft?: number;
  aoeRadius?: number;
  life: number;
}

export interface ComicPopEvent {
  id: string;
  title: string;
  subtitle: string;
  stars?: KillStarRating;
  color: 'yellow' | 'cyan' | 'orange' | 'pink' | 'green';
  createdAt: number;
}

export interface FloatingComboEvent {
  id: string;
  multiplier: number;
  label: string;
  detail: string;
  color: 'yellow' | 'cyan' | 'orange' | 'pink' | 'green';
  /** Larger text for the big moments (3★ combo supply, boss). */
  emphasis?: boolean;
  xPct: number;
  yPct: number;
  createdAt: number;
}

export interface AchievementDef {
  id: string;
  bugType: BugType;
  star: KillStarRating;
  title: string;
  recipeIcons: string[];
  description: string;
  rewardType: 'coins' | 'hat' | 'armor' | 'special_weapon' | 'world_unlock';
  rewardId: string;
  rewardLabel: string;
  unlockCostCoins: number;
}

export type KitchenUpgradeId =
  | 'acidResistance'
  | 'streakCoinBonus'
  | 'whipCooldown'
  | 'ultBaseCharge';

export type KitchenUpgradeLevel = 0 | 1 | 2 | 3;

export interface KitchenUpgrades {
  acidResistance: KitchenUpgradeLevel;
  streakCoinBonus: KitchenUpgradeLevel;
  whipCooldown: KitchenUpgradeLevel;
  ultBaseCharge: KitchenUpgradeLevel;
}

export interface PlayerProgress {
  currentLevel: number;         // 1..60+ (auto-saved!)
  highestLevel: number;
  currentWorld: WorldId;
  unlockedWorlds: WorldId[];
  coins: number;
  unlockedAchievements: string[]; // achievement IDs
  unlockedHats: HatId[];
  unlockedArmors: ArmorId[];
  unlockedSpecials: SpecialWeaponId[];
  equippedHat: HatId;
  equippedArmor: ArmorId;
  equippedSpecial: SpecialWeaponId;
  bestScore: number;
  totalBugsCleaned: number;
  bestRushSeconds?: number;
  unlockedRushMilestones?: string[];
  kitchenUpgrades?: KitchenUpgrades;
}

export interface GameSettings {
  masterVolume: number; // 0..100
  sfxVolume: number;    // 0..100
  bgmVolume: number;    // 0..100
  muted: boolean;
  gameSpeedMultiplier: 0.75 | 1.0 | 1.25;
  tacticalSlowMo: boolean;
  screenShake: boolean;
  hapticsEnabled: boolean;
  smartComboHints: 'onboarding' | 'always' | 'off';
  prioritize60Fps?: boolean;
}

export type TacticalInspectionTarget =
  | {
      kind: 'piece';
      pieceId: string;
      pieceType?: UtensilType;
      level?: number;
      evolutionId?: SupremeEvolutionId;
    }
  | { kind: 'plate'; rail: number }
  | { kind: 'ultimate' };

export interface TacticalInspectorCardData {
  title: string;
  badge: string;
  whatItDoes: string;
  combineOrMerge: string;
  accent: 'cyan' | 'yellow' | 'pink' | 'green';
}

export interface BoardPartnerHighlight {
  pieceId: string;
  rail: number;
  row: number;
  kind: 'merge' | 'evolve' | 'synergy';
}

