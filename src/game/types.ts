export type GameState = 'title' | 'playing' | 'paused' | 'gameover';

export type WorldId = 'sunny_counter' | 'fridge_vault' | 'iron_stoves' | 'pastry_marble';

export type UtensilType =
  | 'spray_flus'      // Emisor rápido de gotas azules presurizadas
  | 'bleach_cannon'   // Cañón pesado de lejía amarilla corrosiva
  | 'scourer_nanas'   // Estropajo amarillo/verde (Multiplicador en Línea -> 5 burbujas en abanico)
  | 'aerosol_torch'   // Aerosol Mata-Todo / UV (Puente Horizontal entre 2 raíles vecinos -> funde chapas)
  | 'soap_bar'        // Pastilla de Jabón rosa a 45° (Desvía al bicho patinando al raíl vecino)
  | 'mop_vortex'      // Fregona Turbo-Spin 3000 RPM (Centrifuga y lanza espiral Bullet Hell 360°)
  | 'wc_shield';      // Pastilla WC Reflectora (Bloquea y devuelve proyectiles enemigos)

export type BugType =
  | 'speed_ant'       // Hormiga Velocista (Canica negra rápida con casco de miga)
  | 'cap_beetle'      // Escarabajo Chapa (Blindado frontal con chapa de botella -> ¡CLINK!)
  | 'acid_wasp'       // Avispa Bombardera (Dispara gotas de miel ácida morada que pringan piezas)
  | 'shift_roach'     // Cucaracha Saltarraíl (Esquiva cambiando de raíl si no la atrapas en combo)
  | 'king_crab';      // Rey Cangrejo de Olla (Mini-Jefe de Clímax de Fase 3)

export type KillStarRating = 1 | 2 | 3;

export type HatId = 'classic_toque' | 'duck_shower_cap' | 'bucket_helmet' | 'tp_gasmask';
export type ArmorId = 'white_apron' | 'hazmat_epi' | 'golden_scourer_mail';
export type SpecialWeaponId = 'karcher_blast' | 'baking_volcano' | 'knife_roomba';

export interface UtensilPiece {
  id: string;
  type: UtensilType;
  level: number;
  rail: number | null; // 0..3 when on board, null when in tray
  row: number | null;  // 0..5 when on board (0 = top near bugs, 5 = bottom near Chef)
  gunkTimer: number;   // > 0 means "Pringada de Mugre" (disabled until tapped/moved or timer expires)
  cooldown: number;    // 0.3s snap cooldown after moving, then firing timer
  fireTimer: number;
  comboType: 'none' | 'line_foam' | 'bridge_uv' | 'slip_vortex' | 'shield_reflect';
}

export interface BugEnemy {
  id: string;
  type: BugType;
  rail: number;        // 0..3 (current rail)
  targetRail: number;  // for smooth sliding when hitting soap_bar or shifting
  yProgress: number;   // -0.4 (warning in vent) to 6.0 (Bastion border)
  hp: number;
  maxHp: number;
  hasShield: boolean;  // Bottle cap frontal shield on cap_beetle / king_crab
  isSlidingFromSoap: boolean;
  hitByDiagonalFoam: boolean;
  hitByBridgeBurn: boolean;
  hitByVortexSpin: boolean;
  slowTimer: number;
  flashTimer: number;
  attackWindup: number; // 0..1 telegraph before shooting acid or ramming
  koTimer: number;      // > 0 when defeated and flying/spinning out
  koStar: KillStarRating;
}

export interface Projectile {
  id: string;
  x: number;           // continuous rail coordinate (0..3)
  y: number;           // continuous row coordinate (0..6)
  vx: number;
  vy: number;
  damage: number;
  isEnemy: boolean;
  flavor: 'water_drop' | 'bleach_glob' | 'foam_fan' | 'vortex_soap' | 'enemy_acid' | 'reflected_bubble' | 'roomba_blade';
  pierceShield: boolean;
  fromDiagonalFoam: boolean;
  fromVortex: boolean;
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

export interface PlayerProgress {
  currentLevel: number;         // 1..12 (auto-saved!)
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
}
