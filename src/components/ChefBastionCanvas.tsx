import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { soundEngine } from '../game/audio';
import {
  addInkOutline,
  buildBugMesh,
  disposeBugInstance,
  disposeObjectTree,
  buildChefBastionMesh,
  buildGhostUtensilMesh,
  buildKnifeRoombaMesh,
  buildOvercookedKitchenProps,
  buildUtensilMesh,
  buildWardrobeSpecialShowcaseMesh,
  createBacksplashTileTexture,
  createKitchenFloorTileTexture,
  createOuterTableWoodTexture,
  createToonMaterial,
  createWoodGrainTexture,
} from '../game/models3d';
import type { WardrobeTabId } from './GameModals';
import {
  buildActiveRushPool,
  COMANDA_AUTO_PICK_SECONDS,
  ComandaTicket,
  computeRushArsenalMetrics,
  computeRushBoardWeaponCap,
  computeRushDeployCostForBoard,
  computeRushDirectorParams,
  computeRushSupplyMax,
  consumeAerosolAmmo,
  ensureRushTrayHasSprayFlus,
  executeRushDropOrMerge,
  findSupremeEvolutionPartners,
  FrenzyThermometerState,
  getChaosDirectorEventForMinute,
  getFrenzyThermometer,
  getInitialAerosolAmmo,
  createRushWaveDirector,
  getRushKillSupply,
  getRushWearFraction,
  pickRushSpawnRail,
  rollLiveComandaTriplet,
  rollRushTrayBatch,
  rollRushTraySlot,
  RUSH_ADRENALINE_MILESTONES,
  RUSH_INITIAL_SUPPLY,
  RUSH_SUPPLY_BASE_PER_SEC,
  RUSH_MAX_SPRAY_FLUS_ON_BOARD,
  RUSH_WAVE_WARNING_SECONDS,
  RushWaveDirectorState,
  RushWavePlan,
  RushWaveTick,
  tickRushWaveDirector,
  tickRushWear,
  RUSH_TRAY_SLOTS,
  tickDepletingAerosol,
} from '../game/roguelite';
import {
  applyPhysicalKnockback,
  BOSS_PHASE_BREAK_FLASH_SECONDS,
  BOSS_PHASE_BREAK_HITSTOP_SECONDS,
  buildPlacementComboNotification,
  checkPhaseTransition,
  CHEF_WHIP_PUSH_CELLS,
  CHEF_WHIP_STUN_SECONDS,
  classifyBugElimination,
  combineActiveTimeScales,
  computeBoardPartnerHighlights,
  computeBossDamageMultiplier,
  computeConductiveUvChainTargets,
  computeDragComboPreviewLinks,
  computeKitchenUpgradeEffects,
  computeLiveMenuBuffs,
  computeResponsiveCameraParams,
  computeSmartComboHints,
  computeStreakMilestoneReward,
  computeThermalParticleBudgetFactor,
  computeThermalShockResult,
  computeWeaponRangeCells,
  createInitialBoardPieces,
  DEFAULT_SETTINGS,
  ENEMY_WHITE_FLASH_SECONDS,
  evaluateBoardCombos,
  getBiomeForLevel,
  getBossPuzzleTypeForLevel,
  getBossTierForLevel,
  getGrandBossPhase,
  getGrandBossPhaseLabel,
  getLevelForecast,
  GRID_RAILS,
  GRID_ROWS,
  getLevelSpeedMultiplier,
  getTutorialGuideForLevel,
  HEAVY_IMPACT_HITSTOP_SECONDS,
  isBiomeTransitionLevel,
  isDynamicOnboardingLevel,
  LEVEL_DURATION_SECONDS,
  MENU_PLATE_BUFF_META,
  MIN_PLACEABLE_ROW,
  moveOrSwapUtensil,
  TILE_TRAIL_DURATION,
  WORLDS_CATALOG,
} from '../game/rules';
import {
  ROACH_SHIFT_INTERVAL_SEC,
  getScriptPhase,
  getStrategicScript,
  stepRoachZigzag,
  takeDueScriptSpawns,
  type StrategicScript,
} from '../game/strategicScripts';
import { STRATEGIC_BUG_BASE_HP } from '../game/levelAudit';
import { BUG_BASE_HP, BUG_BASE_SPEED, COMBAT } from '../game/combatTuning';
import {
  ActiveBossHudInfo,
  ArmorId,
  BiomeConfig,
  BossPuzzleType,
  BossTier,
  BugEnemy,
  BugType,
  ComicPopEvent,
  FloatingComboEvent,
  GameMode,
  GameSettings,
  GameState,
  HatId,
  KillStarRating,
  KitchenUpgrades,
  LevelForecast,
  Projectile,
  SpecialWeaponId,
  SupremeEvolutionId,
  TacticalInspectionTarget,
  TileChemicalState,
  TileStateKind,
  UtensilPiece,
  UtensilType,
  WorldId,
} from '../game/types';

export interface DragPointerState {
  active: boolean;
  pieceId: string | null;
  clientX: number;
  clientY: number;
}

export interface RushHudSnapshot {
  elapsedSec: number;
  supply: number;
  supplyCost: number;
  supplyMax: number;
  boardWeaponCount: number;
  maxBoardWeapons: number;
  capFlashActive: boolean;
  frenzy: FrenzyThermometerState;
  xpPct: number;
  rushLevel: number;
  activeComandas: [ComandaTicket, ComandaTicket, ComandaTicket] | null;
  comandaTimer: number;
  roombaActive: boolean;
  vetoedTypes: UtensilType[];
  evolutionPreviewScreen: {
    xPct: number;
    yPct: number;
    label: string;
    evoName: string;
  } | null;
}

export interface HudSnapshot {
  phase: 1 | 2 | 3;
  inPlacementPhase: boolean;
  phaseKills: number;
  phaseTargetKills: number;
  sanitationSeals: number;
  score: number;
  pressurePct: number;
  slowMoActive: boolean;
  prepTimer: number;
  levelTimer: number;
  biome: BiomeConfig;
  smartComboHintMessage: string | null;
  selectedPieceId: string | null;
  inspectionTarget?: TacticalInspectionTarget | null;
  hoveredCell: { rail: number; row: number } | null;
  activeWarningRails: (BugType | null)[];
  pieces: UtensilPiece[];
  hazmatShieldReady: boolean;
  armoredPlates: number;
  lastStandActive: boolean;
  forecast: LevelForecast;
  bossHud: ActiveBossHudInfo | null;
  intactPlates: [boolean, boolean, boolean, boolean];
  vipPlateRail: number | null;
  chefWhipCooldown: number;
  chefWhipThreatReady: boolean;
  streakCount: number;
  rushHud?: RushHudSnapshot | null;
  tutorialTargetScreen: {
    xPct: number;
    yPct: number;
    shortTag: string;
    pieceId: string;
  } | null;
}

interface ChefBastionCanvasProps {
  gameState: GameState;
  gameMode?: GameMode;
  wardrobeOpen?: boolean;
  wardrobeTab?: WardrobeTabId;
  wardrobePreviewHat?: HatId;
  wardrobePreviewArmor?: ArmorId;
  wardrobePreviewSpecial?: SpecialWeaponId;
  wardrobeYawRef?: React.MutableRefObject<number>;
  worldId: WorldId;
  level: number;
  hatId: HatId;
  armorId: ArmorId;
  specialWeaponId: SpecialWeaponId;
  kitchenUpgrades?: KitchenUpgrades;
  unlockedRushMilestones?: string[];
  settings?: GameSettings;
  piecesRef: React.MutableRefObject<UtensilPiece[]>;
  selectedPieceIdRef: React.MutableRefObject<string | null>;
  inspectionTargetRef?: React.MutableRefObject<TacticalInspectionTarget | null>;
  triggerUltimateRef: React.MutableRefObject<boolean>;
  startWaveRef: React.MutableRefObject<boolean>;
  pickComandaIndexRef?: React.MutableRefObject<number | null>;
  dragPointerRef?: React.MutableRefObject<DragPointerState>;
  boostUltimateRef?: React.MutableRefObject<boolean>;
  boostPlateShieldRef?: React.MutableRefObject<boolean>;
  resetSignal: number;
  onHudUpdate: (snap: HudSnapshot) => void;
  onComicPop: (pop: ComicPopEvent) => void;
  onFloatingCombo?: (evt: FloatingComboEvent) => void;
  onUnlockUtensil: (uType: UtensilType) => void;
  onAchievementKill: (achId: string, stars: KillStarRating, coinsEarned: number) => void;
  onStreakCoinBonus?: (bonusCoins: number, threshold: 8 | 15) => void;
  onRushMilestoneUnlock?: (milestoneId: string) => void;
  onGameEnd: (victory: boolean, finalStats: {
    score: number;
    phaseReached: number;
    remainingKillsToNext: number;
    bugsCleaned: number;
    vipSaved?: boolean;
    allFourPlatesIntact?: boolean;
    survivedSeconds?: number;
    mergesCount?: number;
    evolutionsCount?: number;
    comandasPicked?: number;
    milestonesCoins?: number;
    killsByStar?: [number, number, number];
    breachesByBug?: Partial<Record<BugType, number>>;
  }) => void;
}

// Convert board (rail 0..3, row 0..6) to 3D world coordinates on the elongated 9:16 countertop:
// Row 0 = -5.00 ... Row 6 (last playable row) = +2.92
// Horizontal Steel Divider Bar sits at z = +3.52
// 4 White Gourmet Plates sit in their dedicated strip at z = +4.18 (yProgress = 6.85)
// Chef Bastion stands at the front edge of the table at z = +4.95 with scale 0.46
const RAIL_SPACING = 1.48;
const ROW_SPACING = 1.32;
const DRAG_OFFSET_Y_PX = 45;
function gridToWorldX(rail: number): number {
  return (rail - (GRID_RAILS - 1) / 2) * RAIL_SPACING;
}
function gridToWorldZ(row: number): number {
  return -5.0 + row * ROW_SPACING;
}

const PARTICLE_POOL_SIZE = 140;
const MAX_PROJECTILE_INSTANCES = 120;

export const ChefBastionCanvas: React.FC<ChefBastionCanvasProps> = ({
  gameState,
  gameMode = 'strategic',
  wardrobeOpen = false,
  wardrobeTab = 'hats',
  wardrobePreviewHat,
  wardrobePreviewArmor,
  wardrobePreviewSpecial,
  wardrobeYawRef,
  worldId,
  level,
  hatId,
  armorId,
  specialWeaponId,
  kitchenUpgrades,
  unlockedRushMilestones = [],
  settings = DEFAULT_SETTINGS,
  piecesRef,
  selectedPieceIdRef,
  inspectionTargetRef,
  triggerUltimateRef,
  startWaveRef,
  pickComandaIndexRef,
  dragPointerRef,
  boostUltimateRef,
  boostPlateShieldRef,
  resetSignal,
  onHudUpdate,
  onComicPop,
  onFloatingCombo,
  onUnlockUtensil,
  onAchievementKill,
  onStreakCoinBonus,
  onRushMilestoneUnlock,
  onGameEnd,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);

  // Store latest props/callbacks in refs so the 60fps WebGL loop never tears down the canvas
  const stateRef = useRef({
    gameState,
    gameMode,
    wardrobeOpen,
    wardrobeTab,
    wardrobePreviewHat,
    wardrobePreviewArmor,
    wardrobePreviewSpecial,
    wardrobeYawRef,
    worldId,
    level,
    hatId,
    armorId,
    specialWeaponId,
    kitchenUpgrades,
    unlockedRushMilestones,
    settings,
    inspectionTargetRef,
    pickComandaIndexRef,
    dragPointerRef,
    boostUltimateRef,
    boostPlateShieldRef,
    onHudUpdate,
    onComicPop,
    onFloatingCombo,
    onUnlockUtensil,
    onAchievementKill,
    onStreakCoinBonus,
    onRushMilestoneUnlock,
    onGameEnd,
  });
  useEffect(() => {
    stateRef.current = {
      gameState,
      gameMode,
      wardrobeOpen,
      wardrobeTab,
      wardrobePreviewHat,
      wardrobePreviewArmor,
      wardrobePreviewSpecial,
      wardrobeYawRef,
      worldId,
      level,
      hatId,
      armorId,
      specialWeaponId,
      kitchenUpgrades,
      unlockedRushMilestones,
      settings,
      inspectionTargetRef,
      pickComandaIndexRef,
      dragPointerRef,
      boostUltimateRef,
      boostPlateShieldRef,
      onHudUpdate,
      onComicPop,
      onFloatingCombo,
      onUnlockUtensil,
      onAchievementKill,
      onStreakCoinBonus,
      onRushMilestoneUnlock,
      onGameEnd,
    };
  }, [
    gameState,
    gameMode,
    wardrobeOpen,
    wardrobeTab,
    wardrobePreviewHat,
    wardrobePreviewArmor,
    wardrobePreviewSpecial,
    wardrobeYawRef,
    worldId,
    level,
    hatId,
    armorId,
    specialWeaponId,
    kitchenUpgrades,
    unlockedRushMilestones,
    settings,
    inspectionTargetRef,
    pickComandaIndexRef,
    dragPointerRef,
    boostUltimateRef,
    boostPlateShieldRef,
    onHudUpdate,
    onComicPop,
    onFloatingCombo,
    onUnlockUtensil,
    onAchievementKill,
    onStreakCoinBonus,
    onRushMilestoneUnlock,
    onGameEnd,
  ]);

  // Reset internal simulation state when resetSignal increments
  const simResetRef = useRef(0);
  useEffect(() => {
    simResetRef.current = resetSignal;
  }, [resetSignal]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Software-WebGL detection per Three.js skill directive
    const isSoftwareGl = (() => {
      const probeCanvas = document.createElement('canvas');
      const gl = probeCanvas.getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const computeTargetPixelRatio = (prio60: boolean) =>
      isSoftwareGl
        ? 1
        : prio60
        ? Math.min(window.devicePixelRatio || 1, 1.35)
        : Math.min(window.devicePixelRatio || 1, 2);

    let lastAppliedPrioritize60 = Boolean(
      (stateRef.current.settings ?? DEFAULT_SETTINGS).prioritize60Fps !== false
    );

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setPixelRatio(computeTargetPixelRatio(lastAppliedPrioritize60));
    renderer.shadowMap.enabled = !isSoftwareGl && !lastAppliedPrioritize60;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const initW = container.clientWidth || window.innerWidth;
    const initH = container.clientHeight || window.innerHeight;
    renderer.setSize(initW, initH);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.touchAction = 'none';
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const horizonHex = 0x4d2b14;
    scene.background = new THREE.Color(horizonHex);

    // Studio Environment Reflection (RoomEnvironment)
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // =========================================================================
    // 9:16 & 20:9 FULL-SCREEN KITCHEN PERSPECTIVE CAMERA (Safe Outer Plate Framing)
    // =========================================================================
    let baseCamY = 9.5;
    let baseCamZ = 10.2;
    let baseLookY = -0.46;
    let baseLookZ = 0.16;
    const camera = new THREE.PerspectiveCamera(44, initW / initH, 0.1, 80);
    function updateCameraProjection(w: number, h: number) {
      const camParams = computeResponsiveCameraParams(w, h);
      camera.aspect = camParams.aspect;
      camera.fov = camParams.fov;
      baseCamY = camParams.camY;
      baseCamZ = camParams.camZ;
      baseLookY = camParams.lookY;
      baseLookZ = camParams.lookZ;
      camera.updateProjectionMatrix();
    }
    updateCameraProjection(initW, initH);
    camera.position.set(0, baseCamY, baseCamZ);
    camera.lookAt(0, baseLookY, baseLookZ);

    // 3-Point Warm Cel-Shading Lighting Rig (Dynamic shadowMap disabled in 60 FPS Mobile mode; actors use flat contact shadow discs)
    const hemiLight = new THREE.HemisphereLight(0xfffbeb, 0xfde68a, 1.05);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfff7ed, 1.9);
    sunLight.position.set(-5.2, 12.8, 5.2);
    sunLight.castShadow = !isSoftwareGl && !lastAppliedPrioritize60;
    sunLight.shadow.mapSize.set(1024, 1024);
    sunLight.shadow.camera.near = 1;
    sunLight.shadow.camera.far = 32;
    const d = 7.4;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.0005;
    sunLight.shadow.normalBias = 0.02;
    scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.45);
    rimLight.position.set(6, 5, -7);
    scene.add(rimLight);

    // =========================================================================
    // FULL 3D KITCHEN ENVIRONMENT (MATCHING 1794109185461.jpg — ZERO CREAM GAPS)
    // 1. Upper White Subway Tile Wall spanning full width behind HUD & vents
    // 2. Left & Right Dark Wood Side Counters holding decorative props
    // 3. Lower Grey Tiled Kitchen Floor under the table legs, Chef & Tray
    // 4. Center 4-Plank Golden Maple Butcher-Block Table
    // =========================================================================
    const worldGroup = new THREE.Group();
    scene.add(worldGroup);

    // 1. Full-Width Upper White Subway Tile Wall
    const wallGroup = new THREE.Group();
    wallGroup.position.set(0, 2.8, -6.58);
    const backsplashTex = createBacksplashTileTexture();
    backsplashTex.repeat.set(3.2, 2.2);
    const wallSlab = new THREE.Mesh(
      new THREE.BoxGeometry(18.0, 6.8, 0.36),
      createToonMaterial(0xffffff, { map: backsplashTex })
    );
    wallGroup.add(wallSlab);
    addInkOutline(wallGroup, 0.045);
    worldGroup.add(wallGroup);

    // 2. Left & Right Dark Brown Wood Side Kitchen Counters
    const outerWoodTex = createOuterTableWoodTexture();
    const outerWoodMat = createToonMaterial(0xffffff, { map: outerWoodTex });
    [-6.1, 6.1].forEach((sx) => {
      const sideCounter = new THREE.Mesh(
        new THREE.BoxGeometry(4.8, 0.9, 12.6),
        outerWoodMat
      );
      sideCounter.position.set(sx, -0.58, -1.1);
      addInkOutline(sideCounter, 0.045);
      worldGroup.add(sideCounter);
    });

    // 3. Lower Grey Tiled Kitchen Floor (visible beneath the table legs, Chef & bottom tray)
    const floorTex = createKitchenFloorTileTexture();
    const floorMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(22, 14),
      createToonMaterial(0xffffff, { map: floorTex })
    );
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.set(0, -2.35, 3.6);
    worldGroup.add(floorMesh);

    // 4. Main 4-Plank Golden Maple Butcher-Block Countertop (z = -6.60 to z = +4.80)
    const counterTex = createWoodGrainTexture(renderer, '#e5a45c');
    const counterBaseMat = createToonMaterial(0xffffff, { map: counterTex });

    const slab = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.72, 11.4), counterBaseMat);
    slab.position.set(0, -0.36, -0.9);
    addInkOutline(slab, 0.055);
    slab.receiveShadow = !isSoftwareGl && !lastAppliedPrioritize60;
    worldGroup.add(slab);

    // Warm Wood Side Rails on the Butcher-Block Table
    const woodTrimMat = createToonMaterial(0xb4692c);
    [-3.66, 3.66].forEach((sx) => {
      const trim = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.76, 11.45), woodTrimMat);
      trim.position.set(sx, -0.34, -0.9);
      addInkOutline(trim, 0.04);
      worldGroup.add(trim);
    });

    // Add Overcooked Kitchen Station 3D Props (4 Rectangular Steel Vent Grates, Divider Bar, Table Legs, 4 Plates)
    const kitchenProps = buildOvercookedKitchenProps(gridToWorldX);
    worldGroup.add(kitchenProps.root);

    // 4 Warning Beacons on the countertop right in front of the 4 rectangular vent grates
    const warningBeacons: THREE.Mesh[] = [];
    for (let r = 0; r < GRID_RAILS; r++) {
      const rx = gridToWorldX(r);
      const beacon = new THREE.Mesh(
        new THREE.CircleGeometry(0.38, 28),
        new THREE.MeshBasicMaterial({
          color: 0xef4444,
          transparent: true,
          opacity: 0,
          depthWrite: false,
        })
      );
      beacon.rotation.x = -Math.PI / 2;
      beacon.position.set(rx, 0.025, -5.5);
      worldGroup.add(beacon);
      warningBeacons.push(beacon);
    }

    // "Menú Vivo": Subtle 3D Passive Buff Micro-Indicators under each plate + Golden VIP Critic Rim (Lv.6+)
    const plateBuffIndicators: THREE.Group[] = [];
    const plateVipHalos: THREE.Mesh[] = [];
    for (let r = 0; r < GRID_RAILS; r++) {
      const rx = gridToWorldX(r);
      const buffMeta = MENU_PLATE_BUFF_META[r];

      const microGroup = new THREE.Group();
      microGroup.position.set(rx, 0.026, 4.66);
      const pipCore = new THREE.Mesh(
        new THREE.CircleGeometry(0.095, 20),
        new THREE.MeshBasicMaterial({
          color: buffMeta.accentHex,
          transparent: true,
          opacity: 0.9,
          depthWrite: false,
        })
      );
      pipCore.rotation.x = -Math.PI / 2;
      pipCore.name = 'pip_core';
      const pipRing = new THREE.Mesh(
        new THREE.RingGeometry(0.12, 0.16, 20),
        new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.65,
          depthWrite: false,
        })
      );
      pipRing.rotation.x = -Math.PI / 2;
      pipRing.name = 'pip_ring';
      microGroup.add(pipCore, pipRing);
      worldGroup.add(microGroup);
      plateBuffIndicators.push(microGroup);

      const vipHalo = new THREE.Mesh(
        new THREE.TorusGeometry(0.56, 0.042, 16, 36),
        createToonMaterial(0xfacc15)
      );
      vipHalo.rotation.x = Math.PI / 2;
      vipHalo.position.set(rx, 0.085, 4.18);
      vipHalo.visible = false;
      addInkOutline(vipHalo, 0.02, 0x78350f);
      worldGroup.add(vipHalo);
      plateVipHalos.push(vipHalo);
    }

    // Invisible Raycast Targets + 4s Tile Chemistry Decals + Subtle Wood-Engraved Spots + Range Pads + Holographic Frames
    const interactableCells: THREE.Mesh[] = [];
    const plateHitMeshes: THREE.Mesh[] = [];
    const cellHighlights: THREE.Mesh[][] = [];
    const cellRangePads: THREE.Mesh[][] = [];
    const cellChemPads: THREE.Mesh[][] = [];
    const cellSpots: (THREE.Mesh | null)[][] = [];
    const invisibleHitMat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });

    for (let r = 0; r < GRID_RAILS; r++) {
      const plateHit = new THREE.Mesh(new THREE.CircleGeometry(0.68, 16), invisibleHitMat);
      plateHit.rotation.x = -Math.PI / 2;
      plateHit.position.set(gridToWorldX(r), 0.09, 4.18);
      plateHit.userData = { plateRail: r };
      worldGroup.add(plateHit);
      plateHitMeshes.push(plateHit);
    }

    for (let r = 0; r < GRID_RAILS; r++) {
      cellHighlights[r] = [];
      cellRangePads[r] = [];
      cellChemPads[r] = [];
      cellSpots[r] = [];
      const rx = gridToWorldX(r);

      for (let row = 0; row < GRID_ROWS; row++) {
        const rz = gridToWorldZ(row);

        // Invisible hit plane for pointer raycasting
        const hitMesh = new THREE.Mesh(
          new THREE.PlaneGeometry(1.38, 1.28),
          invisibleHitMat
        );
        hitMesh.rotation.x = -Math.PI / 2;
        hitMesh.position.set(rx, 0.012, rz);
        hitMesh.userData = { rail: r, row };
        worldGroup.add(hitMesh);
        interactableCells.push(hitMesh);

        // 4s Temporary Countertop Chemistry Decal ('wet_soap' cyan shimmer | 'acid_pool' violet-lime puddle)
        const chemMat = new THREE.MeshBasicMaterial({
          color: 0x38bdf8,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1,
        });
        const chemMesh = new THREE.Mesh(new THREE.CircleGeometry(0.49, 24), chemMat);
        chemMesh.rotation.x = -Math.PI / 2;
        chemMesh.scale.set(1.06, 0.92, 1.0);
        chemMesh.position.set(rx, 0.023, rz);
        worldGroup.add(chemMesh);
        cellChemPads[r][row] = chemMesh;

        // Translucent countertop pad for live weapon range preview AND single-focus 55% tutorial dim
        const padMat = new THREE.MeshBasicMaterial({
          color: 0x22d3ee,
          transparent: true,
          opacity: 0,
          depthWrite: false,
        });
        const padMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.34, 1.22), padMat);
        padMesh.rotation.x = -Math.PI / 2;
        padMesh.position.set(rx, 0.019, rz);
        worldGroup.add(padMesh);
        cellRangePads[r][row] = padMesh;

        // Subtle wood-engraved circular mark on playable rows (opacity 0.12 normally; brightens in Tactical Mode!)
        if (row >= MIN_PLACEABLE_ROW) {
          const spotMat = new THREE.MeshBasicMaterial({
            color: 0x5c3416,
            transparent: true,
            opacity: 0.12,
            depthWrite: false,
          });
          const spotCircle = new THREE.Mesh(
            new THREE.CircleGeometry(0.36, 28),
            spotMat
          );
          spotCircle.rotation.x = -Math.PI / 2;
          spotCircle.scale.set(1.0, 0.84, 1.0);
          spotCircle.position.set(rx, 0.008, rz);
          worldGroup.add(spotCircle);
          cellSpots[r][row] = spotCircle;
        } else {
          cellSpots[r][row] = null;
        }

        // Holographic Grid On-Demand cell frame (opacity = 0 when not selecting!)
        const hlGeo = new THREE.RingGeometry(0.44, 0.54, 28);
        hlGeo.rotateX(-Math.PI / 2);
        const hlMat = new THREE.MeshBasicMaterial({
          color: 0x38bdf8,
          transparent: true,
          opacity: 0,
          depthWrite: false,
        });
        const hlMesh = new THREE.Mesh(hlGeo, hlMat);
        hlMesh.position.set(rx, 0.028, rz);
        worldGroup.add(hlMesh);
        cellHighlights[r][row] = hlMesh;
      }
    }

    // Single reusable Neon Violet UV Beam (1 mesh, zero dynamic shadow/overdraw, cached per link)
    function createNeonUvLaserStream(): THREE.Group {
      const uvStream = new THREE.Group();
      uvStream.name = 'fire_stream';

      const beamMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.068, 0.068, 1.0, 8),
        new THREE.MeshBasicMaterial({
          color: 0xd946ef,
          depthTest: false,
        })
      );
      beamMesh.rotation.x = Math.PI / 2;
      beamMesh.renderOrder = 11;
      beamMesh.castShadow = false;
      beamMesh.receiveShadow = false;
      uvStream.add(beamMesh);

      return uvStream;
    }

    // Pre-Drop Synergy Electric Arc Pool (connects hovered drag target to already-placed combo partner BEFORE finger release)
    const synergyArcPool: THREE.Group[] = [];
    for (let aIdx = 0; aIdx < 4; aIdx++) {
      const arcGroup = new THREE.Group();
      arcGroup.visible = false;
      for (let s = 0; s < 7; s++) {
        const seg = new THREE.Mesh(
          new THREE.CylinderGeometry(0.035, 0.035, 0.16, 6),
          new THREE.MeshBasicMaterial({
            color: s % 2 === 0 ? 0xe879f9 : 0x22d3ee,
            depthTest: false,
          })
        );
        seg.rotation.x = Math.PI / 2;
        seg.name = `arc_seg_${s}`;
        seg.renderOrder = 15;
        seg.castShadow = false;
        seg.receiveShadow = false;
        arcGroup.add(seg);
      }
      worldGroup.add(arcGroup);
      synergyArcPool.push(arcGroup);
    }

    // =========================================================================
    // 3D COMBO VISUALS (Zero Alpha-Overdraw Mobile 60 FPS Geometry):
    // 1. Single Reusable Neon Violet UV Beam (#D946EF) between Aerosol UV cans
    // 2. Max 4 Stylized Opaque Low-Poly Spheres + 1 Flat Floor Ring for Estropajo (line_foam)
    // =========================================================================
    const sharedOpaqueBubbleMat = createToonMaterial(0xccfbf1);
    const sharedFoamFloorRingGeo = new THREE.RingGeometry(0.42, 0.62, 16);
    sharedFoamFloorRingGeo.rotateX(-Math.PI / 2);
    const sharedFoamFloorRingMat = new THREE.MeshBasicMaterial({
      color: 0x2dd4bf,
      depthWrite: false,
    });

    const circuitPool: THREE.Group[] = [];
    for (let i = 0; i < 12; i++) {
      const linkGroup = new THREE.Group();
      linkGroup.visible = false;
      linkGroup.userData.lastLinkKey = '';

      // 1. Single Neon Violet UV Beam for bridge_uv
      const fireStream = createNeonUvLaserStream();
      linkGroup.add(fireStream);

      // 2. Max 4 Stylized Opaque Low-Poly Foam Spheres + 1 Flat Floor Ring (zero alpha overdraw!)
      const foamSpray = new THREE.Group();
      foamSpray.name = 'foam_spray';
      const foamFloorRing = new THREE.Mesh(sharedFoamFloorRingGeo, sharedFoamFloorRingMat);
      foamFloorRing.position.set(0, 0.025, -1.16);
      foamFloorRing.castShadow = false;
      foamFloorRing.receiveShadow = false;
      foamSpray.add(foamFloorRing);

      const bubbleSpecs = [
        [-0.36, 0.28, -0.82, 0.17],
        [0.36, 0.28, -0.88, 0.16],
        [-0.26, 0.3, -1.42, 0.2],
        [0.28, 0.3, -1.48, 0.19],
      ];
      bubbleSpecs.forEach(([bx, by, bz, br], bIdx) => {
        const sphere = new THREE.Mesh(new THREE.SphereGeometry(br, 8, 6), sharedOpaqueBubbleMat);
        sphere.position.set(bx, by, bz);
        sphere.name = `soap_bubble_${bIdx}`;
        sphere.castShadow = false;
        sphere.receiveShadow = false;
        foamSpray.add(sphere);
      });
      linkGroup.add(foamSpray);

      // Default floor bar for slip_vortex / deflect_90
      const floorBar = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.04, 1.0),
        new THREE.MeshBasicMaterial({ color: 0x2dd4bf })
      );
      floorBar.name = 'floor_bar';
      floorBar.castShadow = false;
      floorBar.receiveShadow = false;
      linkGroup.add(floorBar);

      worldGroup.add(linkGroup);
      circuitPool.push(linkGroup);
    }

    // 3D Tactical Action Preview Group (shows firing arrows, 5x foam fan, neon UV laser, or slip vector)
    const previewGroup = new THREE.Group();
    previewGroup.visible = false;
    const previewCones: THREE.Mesh[] = [];
    for (let i = 0; i < 5; i++) {
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(0.18, 0.52, 16),
        new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.88 })
      );
      cone.rotation.x = -Math.PI / 2;
      previewGroup.add(cone);
      previewCones.push(cone);
    }
    const previewBridgeBar = createNeonUvLaserStream();
    previewBridgeBar.rotation.y = Math.PI / 2;
    previewBridgeBar.scale.set(0.85, 0.85, 2.2);
    previewGroup.add(previewBridgeBar);
    const previewVortexRing = new THREE.Mesh(
      new THREE.RingGeometry(0.55, 0.78, 28),
      new THREE.MeshBasicMaterial({
        color: 0x2dd4bf,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
      })
    );
    previewVortexRing.rotation.x = -Math.PI / 2;
    previewGroup.add(previewVortexRing);
    worldGroup.add(previewGroup);

    // Dynamic Actor Containers (+ dragGhostGroup for -45px Y finger-offset weapon ghost)
    const utensilsGroup = new THREE.Group();
    const ghostTutorialGroup = new THREE.Group();
    const dragGhostGroup = new THREE.Group();
    dragGhostGroup.visible = false;
    const bugsGroup = new THREE.Group();
    const projectilesGroup = new THREE.Group();
    const chefAnchor = new THREE.Group();
    chefAnchor.position.set(0, -0.24, 4.72);
    chefAnchor.rotation.y = Math.PI;
    const wardrobeSpecialGroup = new THREE.Group();
    wardrobeSpecialGroup.position.set(1.32, 0.35, 4.88);
    wardrobeSpecialGroup.scale.setScalar(1.18);
    wardrobeSpecialGroup.visible = false;
    let wardrobeLookX = 0;
    let wardrobeLookY = 1.15;
    let wasWardrobeOpen = false;
    scene.add(
      utensilsGroup,
      ghostTutorialGroup,
      dragGhostGroup,
      bugsGroup,
      projectilesGroup,
      chefAnchor,
      wardrobeSpecialGroup
    );

    // Zero-GC Pooled Particle Ring Buffer (InstancedMesh for flour puffs, foam splashes & sparkles)
    const particleGeo = new THREE.SphereGeometry(0.1, 7, 5);
    const particleMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const particleInstanced = new THREE.InstancedMesh(particleGeo, particleMat, PARTICLE_POOL_SIZE);
    particleInstanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    particleInstanced.frustumCulled = false;
    particleInstanced.castShadow = false;
    particleInstanced.receiveShadow = false;
    scene.add(particleInstanced);

    // Zero-GC Pre-Allocated Projectile InstancedMesh (replaces per-shot THREE.Mesh + SphereGeometry(20,20) + outline!)
    const projGeo = new THREE.SphereGeometry(0.15, 7, 5);
    const projMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const projInstanced = new THREE.InstancedMesh(projGeo, projMat, MAX_PROJECTILE_INSTANCES);
    projInstanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    projInstanced.frustumCulled = false;
    projInstanced.castShadow = false;
    projInstanced.receiveShadow = false;
    projInstanced.count = 0;
    projectilesGroup.add(projInstanced);
    const _projColor = new THREE.Color();

    interface PooledParticle {
      active: boolean;
      x: number;
      y: number;
      z: number;
      vx: number;
      vy: number;
      vz: number;
      scale: number;
      life: number;
      maxLife: number;
      color: THREE.Color;
    }
    const particles: PooledParticle[] = Array.from({ length: PARTICLE_POOL_SIZE }, () => ({
      active: false,
      x: 0,
      y: -100,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      scale: 1,
      life: 0,
      maxLife: 0.5,
      color: new THREE.Color(0xffffff),
    }));
    let particleCursor = 0;
    let sustainedFrameMs = 16.6;
    let particleBudgetScale = 1.0;
    const _dummyObj = new THREE.Object3D();

    function spawnParticles(
      wx: number,
      wy: number,
      wz: number,
      count: number,
      hex: number,
      speed = 2.4
    ) {
      const effectiveCount = Math.max(1, Math.round(count * particleBudgetScale));
      for (let i = 0; i < effectiveCount; i++) {
        const p = particles[particleCursor];
        particleCursor = (particleCursor + 1) % PARTICLE_POOL_SIZE;
        p.active = true;
        p.x = wx + (Math.random() - 0.5) * 0.3;
        p.y = wy;
        p.z = wz + (Math.random() - 0.5) * 0.3;
        const angle = Math.random() * Math.PI * 2;
        const spd = (0.4 + Math.random() * 0.8) * speed;
        p.vx = Math.cos(angle) * spd;
        p.vy = 1.2 + Math.random() * 2.2;
        p.vz = Math.sin(angle) * spd;
        p.scale = 0.65 + Math.random() * 0.85;
        p.maxLife = 0.32 + Math.random() * 0.25;
        p.life = p.maxLife;
        p.color.setHex(hex);
      }
    }

    // Directional cyan/emerald forward (-Z, upward along its own rail) mist burst for Flus-Flus
    function spawnForwardSprayMist(wx: number, wy: number, wz: number) {
      const mistCount = Math.max(2, Math.round(6 * particleBudgetScale));
      for (let i = 0; i < mistCount; i++) {
        const p = particles[particleCursor];
        particleCursor = (particleCursor + 1) % PARTICLE_POOL_SIZE;
        p.active = true;
        p.x = wx + (Math.random() - 0.5) * 0.16;
        p.y = wy;
        p.z = wz - 0.18;
        p.vx = (Math.random() - 0.5) * 0.85;
        p.vy = 0.65 + Math.random() * 0.75;
        p.vz = -(3.4 + Math.random() * 2.2); // Strictly forward (-Z) up its own rail!
        p.scale = 0.45 + Math.random() * 0.45;
        p.maxLife = 0.22 + Math.random() * 0.14;
        p.life = p.maxLife;
        p.color.setHex(i % 2 === 0 ? 0x00d2ff : 0x34d399);
      }
    }

    // Build Chef Mesh + External Hat Cooldown Ring (18s) + Sweat Drops (supports live 3D Wardrobe preview!)
    let currentChefKey = '';
    function syncChefModel() {
      const effectiveHat = stateRef.current.wardrobeOpen
        ? stateRef.current.wardrobePreviewHat ?? stateRef.current.hatId
        : stateRef.current.hatId;
      const effectiveArmor = stateRef.current.wardrobeOpen
        ? stateRef.current.wardrobePreviewArmor ?? stateRef.current.armorId
        : stateRef.current.armorId;
      const key = `${effectiveHat}_${effectiveArmor}`;
      if (key === currentChefKey) return;
      currentChefKey = key;
      chefAnchor.clear();
      const chefMesh = buildChefBastionMesh(effectiveHat, effectiveArmor);
      const headPivot = chefMesh.getObjectByName('chef_head_pivot');
      if (headPivot) {
        // 1. Subtle luminous ring around Chef's hat indicating 18s "Trapazo" readiness
        const hatCooldownRing = new THREE.Mesh(
          new THREE.TorusGeometry(0.62, 0.048, 14, 36),
          new THREE.MeshBasicMaterial({
            color: 0xfde047,
            transparent: true,
            opacity: 0.82,
            depthWrite: false,
          })
        );
        hatCooldownRing.rotation.x = Math.PI / 2 - 0.16;
        hatCooldownRing.position.set(0, 2.38, -0.06);
        hatCooldownRing.name = 'chef_hat_cooldown_ring';
        headPivot.add(hatCooldownRing);

        // 2. Reactive 3D Sweat Drops flanking temples when bugs step into the final third
        const sweatGroup = new THREE.Group();
        sweatGroup.name = 'chef_sweat_drops';
        sweatGroup.visible = false;
        const dropMat = createToonMaterial(0x38bdf8);
        [-0.78, 0.78].forEach((sx, idx) => {
          const drop = new THREE.Group();
          drop.name = `sweat_drop_${idx}`;
          drop.position.set(sx, 1.88, -0.05);
          const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 14, 14), dropMat);
          const tip = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.18, 14), dropMat);
          tip.position.y = 0.11;
          drop.add(bulb, tip);
          addInkOutline(drop, 0.02, 0x0c4a6e);
          sweatGroup.add(drop);
        });
        headPivot.add(sweatGroup);
      }
      chefAnchor.add(chefMesh);
    }
    syncChefModel();

    let currentWardrobeSpecialKey = '';
    function syncWardrobeSpecialShowcase() {
      const showSpecial =
        Boolean(stateRef.current.wardrobeOpen) && stateRef.current.wardrobeTab === 'specials';
      wardrobeSpecialGroup.visible = showSpecial;
      if (!showSpecial) return;
      const effectiveSpecial =
        stateRef.current.wardrobePreviewSpecial ?? stateRef.current.specialWeaponId;
      if (effectiveSpecial === currentWardrobeSpecialKey) return;
      currentWardrobeSpecialKey = effectiveSpecial;
      wardrobeSpecialGroup.clear();
      wardrobeSpecialGroup.add(buildWardrobeSpecialShowcaseMesh(effectiveSpecial));
    }
    syncWardrobeSpecialShowcase();

    // Invisible raycast proxy around the 3D Chef for tap / upward swipe ("Trapazo de cocina")
    const chefHitProxy = new THREE.Mesh(
      new THREE.CylinderGeometry(1.05, 1.05, 2.1, 16),
      invisibleHitMat
    );
    chefHitProxy.position.set(0, 0.55, 4.68);
    scene.add(chefHitProxy);

    // 3D Animated Kitchen Towel Whip Arc ("Trapazo de cocina")
    const towelWhipGroup = new THREE.Group();
    towelWhipGroup.visible = false;
    for (let segIdx = 0; segIdx < 6; segIdx++) {
      const clothSeg = new THREE.Mesh(
        new THREE.BoxGeometry(0.24 - segIdx * 0.025, 0.06, 0.36),
        createToonMaterial(segIdx % 2 === 0 ? 0xffffff : 0xef4444)
      );
      clothSeg.name = `towel_seg_${segIdx}`;
      addInkOutline(clothSeg, 0.02);
      towelWhipGroup.add(clothSeg);
    }
    worldGroup.add(towelWhipGroup);

    // 3D Autonomous "Roomba Kamikaze con Cuchillos" patrolling horizontally in front of the 4 gourmet plates!
    const knifeRoombaMesh = buildKnifeRoombaMesh();
    knifeRoombaMesh.visible = false;
    knifeRoombaMesh.position.set(0, 0.04, 3.55);
    worldGroup.add(knifeRoombaMesh);

    // Map of UtensilPiece.id -> THREE.Group (tracks level & evolutionId so merges rebuild 3D tier collars/turrets!)
    const utensilMeshes = new Map<
      string,
      {
        group: THREE.Group;
        type: UtensilType;
        level: number;
        evolutionId?: SupremeEvolutionId;
        bounce: number;
      }
    >();
    let currentGhostType: UtensilType | null = null;
    let currentGhostMesh: THREE.Group | null = null;
    let currentDragGhostKey = '';
    const bugMeshes = new Map<string, THREE.Group>();

    // Active Simulation State
    let bugs: BugEnemy[] = [];
    let projectiles: Projectile[] = [];
    let chemTiles: TileChemicalState[] = [];
    let chemTickAccum = 0;
    let intactPlates: [boolean, boolean, boolean, boolean] = [true, true, true, true];
    let vipPlateRail: number | null =
      stateRef.current.level >= 6 ? Math.floor(Math.random() * GRID_RAILS) : null;
    let chefWhipCooldown = 0;
    let towelWhipAnim = { timer: 0, startX: 0, startZ: 4.5, targetX: 0, targetZ: 3.0 };
    let isSwipingFromChef = false;
    let chefSwipeStartX = 0;
    let chefSwipeStartY = 0;
    let rapidKillStreakCount = 0;
    let lastRapidKillAtMs = -Infinity;

    // Survival Rush ("Supervivencia Rush") State
    let rushElapsedSec = 0;
    let rushSupply = RUSH_INITIAL_SUPPLY;
    let rushWaves: RushWaveDirectorState = createRushWaveDirector();
    let rushWaveWarning: RushWaveTick['warning'] = null;
    let rushCapFlashTimer = 0;
    let rushXp = 0;
    let rushXpNext = 55;
    let rushLevel = 1;
    let activeComandas: [ComandaTicket, ComandaTicket, ComandaTicket] | null = null;
    let comandaTimer = 0;
    let rushAnnouncedMinute = 0;
    let rushMergesCount = 0;
    let rushEvolutionsCount = 0;
    let rushComandasPicked = 0;
    let rushMilestonesCoins = 0;
    let rushSessionMilestones = new Set<string>(stateRef.current.unlockedRushMilestones ?? []);
    let patrolRoombaActive = false;
    let patrolRoombaX = 0;
    let patrolRoombaDir = 1;
    let patrolRoombaSliceCd = 0;
    let rushModifiers = {
      doubleNozzle: 0,
      wallRicochet: false,
      damageMult: 1.0,
      electroTiles: false,
      fireRateMult: 1.0,
      supplyRateMult: 1.0,
      xpMult: 1.0,
      chaosSpeedMult: 1.0,
      vetoedTypes: [] as UtensilType[],
    };

    let phase: 1 | 2 | 3 = 1;
    let inPlacementPhase =
      stateRef.current.gameMode === 'rush'
        ? false
        : !isDynamicOnboardingLevel(stateRef.current.level);
    let phaseKills = 0;
    let totalBugsCleaned = 0;
    // Per-match metrics (kills by star rating and which bug ruined each plate).
    let killsByStar: [number, number, number] = [0, 0, 0];
    let breachesByBug: Partial<Record<BugType, number>> = {};
    let score = 0;
    let sanitationSeals = 3;
    let armoredPlates = 0;
    let hazmatShieldAvailable = stateRef.current.armorId === 'hazmat_epi';
    let lastStandTriggered = false;
    let lastStandTimer = 0;
    let bossSpawnedForLevel = false;
    let pressurePct = 45;
    let spawnTimer = 2.0;
    let prepTimer = 0; // 3-second breather timer between Phase 1 -> 2 -> 3
    let levelTimer = LEVEL_DURATION_SECONDS; // 120s (2-minute) intense wave timer for Level 5+
    // Estratégico con guion fijo (strategicScripts.ts): apariciones por segundo, sin azar.
    let activeScript: StrategicScript | null = null;
    let scriptClock = 0;
    let scriptCursor = 0;
    let lastAnnouncedBiomeLevel = 0;
    let shieldWarnCooldown = 0;
    let lastKillComicPopAt = 0; // 6-second minimum cooldown between kill comic banners!
    let hitstopTimer = 0;
    let cameraTrauma = 0;
    let chefTargetX = 0;
    let chefCelebrateTimer = 0;
    let isDraggingOnCanvas = false;
    let lastPointerClientX = 0;
    let lastPointerClientY = 0;
    let hoveredCell: { rail: number; row: number } | null = null;
    let lastKnownReset = simResetRef.current;
    let gameEndedLock = false;
    let waveQuotaCompleted = false;
    let placementComboChain = 0;
    let combatComboStreak = 1;
    let combatComboWindowTimer = 0;
    let activeStreakCount = 0;
    let activeStreakTimer = 0;
    const _projVec = new THREE.Vector3();
    const _dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.72);
    const _dragWorldPt = new THREE.Vector3();

    function makeRushTrayUtensilPiece(
      slotIdx: number,
      elapsedForRoll: number,
      otherTrayTypes?: readonly UtensilType[]
    ): UtensilPiece {
      const rolled = rollRushTraySlot(slotIdx, {
        elapsedSeconds: elapsedForRoll,
        unlockedMilestones: Array.from(rushSessionMilestones),
        vetoedTypes: rushModifiers.vetoedTypes,
        otherTrayTypes,
        activeBoardWeapons: computeRushArsenalMetrics(piecesRef.current).weaponCount,
      });
      const initAmmo =
        rolled.type === 'aerosol_torch' ? getInitialAerosolAmmo(rolled.level) : undefined;
      return {
        id: rolled.id,
        type: rolled.type,
        level: rolled.level,
        rail: null,
        row: null,
        gunkTimer: 0,
        cooldown: 0,
        fireTimer: 0.1,
        comboType: 'none',
        ammo: initAmmo,
        maxAmmo: initAmmo,
      };
    }

    function makeInitialRushTrayPieces(elapsedForRoll: number): UtensilPiece[] {
      const batch = rollRushTrayBatch({
        elapsedSeconds: elapsedForRoll,
        unlockedMilestones: Array.from(rushSessionMilestones),
        vetoedTypes: rushModifiers.vetoedTypes,
        activeBoardWeapons: 0,
      });
      return batch.map((rolled) => {
        const initAmmo =
          rolled.type === 'aerosol_torch' ? getInitialAerosolAmmo(rolled.level) : undefined;
        return {
          id: rolled.id,
          type: rolled.type,
          level: rolled.level,
          rail: null,
          row: null,
          gunkTimer: 0,
          cooldown: 0,
          fireTimer: 0.1,
          comboType: 'none',
          ammo: initAmmo,
          maxAmmo: initAmmo,
        };
      });
    }

    function drainRushAerosolInPlace(piece: UtensilPiece, charges: number) {
      if (stateRef.current.gameMode !== 'rush') return;
      const updated = consumeAerosolAmmo(piece, charges);
      if (updated === piece) return;
      piece.ammo = updated.ammo;
      piece.maxAmmo = updated.maxAmmo;
      piece.comboType = updated.comboType;
      piece.depleteTimer = updated.depleteTimer;
    }

    const RUSH_BUG_ICONS: Record<BugType, string> = {
      speed_ant: '🐜',
      cap_beetle: '🛡️🐀',
      acid_wasp: '🦟',
      shift_roach: '🪳',
      king_crab: '👑🦀',
    };

    // Pops one bubble per announced rail over its vent grate ("🐜×4 · 3s") so the player can prepare the answer.
    function announceRushWave(plan: RushWavePlan) {
      soundEngine.triggerHaptic('light');
      for (const rail of plan.hotRails) {
        const onRail = plan.spawns.filter((sp) => sp.rail === rail);
        if (onRail.length === 0) continue;
        const counts = new Map<BugType, number>();
        for (const sp of onRail) counts.set(sp.type, (counts.get(sp.type) ?? 0) + 1);
        const label = [...counts.entries()].map(([type, n]) => `${RUSH_BUG_ICONS[type]}×${n}`).join(' ');
        const pos = projectWorldToScreenPct(gridToWorldX(rail), 0.9, -5.5);
        stateRef.current.onFloatingCombo?.({
          id: `rush-wave-${rushWaves.wavesStarted}-${rail}`,
          multiplier: onRail.length,
          label,
          detail: `${Math.round(RUSH_WAVE_WARNING_SECONDS)}s`,
          color: counts.has('cap_beetle') ? 'pink' : 'orange',
          xPct: pos.xPct,
          yPct: pos.yPct,
          createdAt: Date.now(),
        });
      }
    }

    function spawnRushBug(
      rail: number,
      bType: BugType,
      rushDirector: ReturnType<typeof computeRushDirectorParams>
    ) {
      const hpMap: Record<BugType, number> = {
        speed_ant: 38,
        cap_beetle: 78,
        acid_wasp: 60,
        shift_roach: 56,
        king_crab: 145,
      };
      const maxHp = Math.round(hpMap[bType] * rushDirector.hpMultiplier);
      const isLateralSpawn = rushDirector.lateralConduitsOpen && Math.random() < 0.38;
      const lateralFromLeft = Math.random() < 0.5;
      const lateralRow = 2 + Math.floor(Math.random() * 2);

      bugs.push({
        id: `rush-bug-${Date.now()}-${Math.random()}`,
        type: bType,
        rail: isLateralSpawn ? (lateralFromLeft ? -0.75 : 3.75) : rail,
        targetRail: rail,
        yProgress: isLateralSpawn ? lateralRow : -0.35,
        hp: maxHp,
        maxHp,
        hasShield: bType === 'cap_beetle',
        isSlidingFromSoap: false,
        hitByDiagonalFoam: false,
        hitByBridgeBurn: false,
        hitByVortexSpin: false,
        slowTimer: 0,
        flashTimer: 0,
        attackWindup: 0,
        koTimer: 0,
        koStar: 1,
        isLateralInvasion: isLateralSpawn,
        lateralDir: isLateralSpawn ? (lateralFromLeft ? 1 : -1) : 0,
        redirectedBySquare: false,
      });
    }

    // Wear ring at the base of each Rush weapon: drains as its service life runs out (green -> yellow -> red).
    function updateWearRing(group: THREE.Group, fraction: number | null) {
      let ring = group.getObjectByName('wear_ring') as THREE.Mesh | undefined;
      if (fraction === null) {
        if (ring) ring.visible = false;
        return;
      }
      const bucket = Math.max(1, Math.ceil(fraction * 40)) / 40;
      const color = fraction > 0.5 ? 0x4ade80 : fraction > 0.25 ? 0xfacc15 : 0xef4444;
      if (!ring) {
        ring = new THREE.Mesh(
          new THREE.RingGeometry(0.4, 0.53, 40, 1, Math.PI / 2, bucket * Math.PI * 2),
          new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide })
        );
        ring.name = 'wear_ring';
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.03;
        ring.userData.bucket = bucket;
        group.add(ring);
      } else if (ring.userData.bucket !== bucket) {
        ring.geometry.dispose();
        ring.geometry = new THREE.RingGeometry(0.4, 0.53, 40, 1, Math.PI / 2, bucket * Math.PI * 2);
        ring.userData.bucket = bucket;
      }
      ring.visible = true;
      (ring.material as THREE.MeshBasicMaterial).color.setHex(color);
    }

    function unlockRushMilestoneIfNew(milestoneId: string) {
      if (rushSessionMilestones.has(milestoneId)) return;
      rushSessionMilestones.add(milestoneId);
      const def = RUSH_ADRENALINE_MILESTONES.find((m) => m.id === milestoneId);
      if (!def) return;
      rushMilestonesCoins += def.coinsBonus;
      stateRef.current.onRushMilestoneUnlock?.(milestoneId);
      soundEngine.playMergeUpgrade(4);
      stateRef.current.onComicPop({
        id: `rush-ms-${milestoneId}-${Date.now()}`,
        title: def.title,
        subtitle: def.subtitle,
        stars: 3,
        color: 'yellow',
        createdAt: Date.now(),
      });
    }

    function stampChemTile(railFloat: number, rowFloat: number, kind: TileStateKind) {
      const r = THREE.MathUtils.clamp(Math.round(railFloat), 0, GRID_RAILS - 1);
      const rw = THREE.MathUtils.clamp(Math.round(rowFloat), 0, GRID_ROWS - 1);
      const existing = chemTiles.find((t) => t.rail === r && t.row === rw);
      if (existing) {
        existing.kind = kind;
        existing.timer = TILE_TRAIL_DURATION;
      } else {
        chemTiles.push({ rail: r, row: rw, kind, timer: TILE_TRAIL_DURATION });
      }
    }

    function projectWorldToScreenPct(wx: number, wy: number, wz: number): { xPct: number; yPct: number } {
      _projVec.set(wx, wy, wz);
      _projVec.project(camera);
      const rawX = (_projVec.x * 0.5 + 0.5) * 100;
      const rawY = (-_projVec.y * 0.5 + 0.5) * 100;
      return {
        xPct: THREE.MathUtils.clamp(rawX, 14, 86),
        yPct: THREE.MathUtils.clamp(rawY, 16, 78),
      };
    }

    function emitPlacementComboIfAny(pieceId: string) {
      const notif = buildPlacementComboNotification(piecesRef.current, pieceId, placementComboChain);
      if (!notif) return;
      placementComboChain = Math.min(4, placementComboChain + 1);
      const pos = projectWorldToScreenPct(
        gridToWorldX(notif.rail),
        0.95,
        gridToWorldZ(notif.row)
      );
      stateRef.current.onFloatingCombo?.({
        id: `combo-place-${pieceId}-${Date.now()}`,
        multiplier: notif.multiplier,
        label: notif.label,
        detail: notif.detail,
        color: notif.color,
        xPct: pos.xPct,
        yPct: pos.yPct,
        createdAt: Date.now(),
      });
    }

    function spawnBossForMilestone(
      lvl: number,
      scripted?: { tier: BossTier; puzzle: BossPuzzleType; hp: number; rail: number }
    ) {
      const tier = scripted?.tier ?? getBossTierForLevel(lvl);
      if (!tier || bossSpawnedForLevel) return;
      bossSpawnedForLevel = true;
      const puzzle = scripted?.puzzle ?? getBossPuzzleTypeForLevel(lvl) ?? 'uv_overheat';
      const maxHp =
        scripted?.hp ?? (tier === 'grand' ? Math.round(340 + lvl * 12) : Math.round(210 + lvl * 8));
      const spawnRail = scripted?.rail ?? (puzzle === 'soap_stun' ? 2 : 1);
      bugs.push({
        id: `boss-${tier}-${lvl}-${Date.now()}`,
        type: 'king_crab',
        rail: spawnRail,
        targetRail: spawnRail,
        yProgress: -0.35,
        hp: maxHp,
        maxHp,
        hasShield: true,
        isSlidingFromSoap: false,
        hitByDiagonalFoam: false,
        hitByBridgeBurn: false,
        hitByVortexSpin: false,
        slowTimer: 0,
        flashTimer: 0,
        attackWindup: 0,
        koTimer: 0,
        koStar: 1,
        isLateralInvasion: false,
        lateralDir: 0,
        redirectedBySquare: false,
        isPuzzleBoss: true,
        bossTier: tier,
        bossPuzzleType: puzzle,
        bossPhase: 1,
        bossArmorBroken: false,
        bossEvadeTimer: 2.6,
        bossFrenzyTriggered: false,
        bossPhaseFlashTimer: 0,
        bossStunTimer: 0,
      });

      stateRef.current.onComicPop({
        id: `boss-intro-${lvl}-${Date.now()}`,
        title:
          tier === 'grand'
            ? `👑 ¡GRAN JEFE NV.${lvl} EN CAMINO!`
            : `🦀 ¡MINI-JEFE NV.${lvl} EN CAMINO!`,
        subtitle:
          tier === 'grand'
            ? 'Fase 1: Coraza Pesada · Usa Láser UV ⚡ o Explosivos (×2.5)'
            : puzzle === 'square_deflect'
            ? 'Redirígelo con Escuadra 90° 📐 o Combos (×2.2)'
            : 'Desvíalo con Jabón 🧼 o Láser UV ⚡ (×2.2)',
        color: tier === 'grand' ? 'pink' : 'orange',
        createdAt: Date.now(),
      });
    }

    function spawnWavePreviewBugs(currentLvl: number, currentPh: 1 | 2 | 3) {
      if (currentLvl === 1) {
        bugs.push(
          {
            id: `bug-w-${Date.now()}-1`,
            type: 'speed_ant',
            rail: 1,
            targetRail: 1,
            yProgress: -0.35,
            hp: 42,
            maxHp: 42,
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
          },
          {
            id: `bug-w-${Date.now()}-2`,
            type: 'speed_ant',
            rail: 2,
            targetRail: 2,
            yProgress: -0.55,
            hp: 42,
            maxHp: 42,
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
          }
        );
      } else if (currentLvl === 2) {
        bugs.push(
          {
            id: `bug-w-${Date.now()}-1`,
            type: 'cap_beetle',
            rail: 1,
            targetRail: 1,
            yProgress: -0.35,
            hp: 76,
            maxHp: 76,
            hasShield: true,
            isSlidingFromSoap: false,
            hitByDiagonalFoam: false,
            hitByBridgeBurn: false,
            hitByVortexSpin: false,
            slowTimer: 0,
            flashTimer: 0,
            attackWindup: 0,
            koTimer: 0,
            koStar: 1,
          },
          {
            id: `bug-w-${Date.now()}-2`,
            type: currentPh >= 2 ? 'cap_beetle' : 'speed_ant',
            rail: 2,
            targetRail: 2,
            yProgress: -0.45,
            hp: currentPh >= 2 ? 76 : 44,
            maxHp: currentPh >= 2 ? 76 : 44,
            hasShield: currentPh >= 2,
            isSlidingFromSoap: false,
            hitByDiagonalFoam: false,
            hitByBridgeBurn: false,
            hitByVortexSpin: false,
            slowTimer: 0,
            flashTimer: 0,
            attackWindup: 0,
            koTimer: 0,
            koStar: 1,
          }
        );
      } else if (currentLvl === 31) {
        bugs.push(
          {
            id: `bug-w-${Date.now()}-lat1`,
            type: 'shift_roach',
            rail: -0.65,
            targetRail: 1,
            yProgress: 2.0,
            hp: 58,
            maxHp: 58,
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
            isLateralInvasion: true,
            lateralDir: 1,
            redirectedBySquare: false,
          },
          {
            id: `bug-w-${Date.now()}-top2`,
            type: 'speed_ant',
            rail: 1,
            targetRail: 1,
            yProgress: -0.35,
            hp: 52,
            maxHp: 52,
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
          }
        );
      } else {
        bugs.push(
          {
            id: `bug-w-${Date.now()}-1`,
            type: 'cap_beetle',
            rail: 2,
            targetRail: 2,
            yProgress: -0.35,
            hp: 84,
            maxHp: 84,
            hasShield: true,
            isSlidingFromSoap: false,
            hitByDiagonalFoam: false,
            hitByBridgeBurn: false,
            hitByVortexSpin: false,
            slowTimer: 0,
            flashTimer: 0,
            attackWindup: 0,
            koTimer: 0,
            koStar: 1,
          },
          {
            id: `bug-w-${Date.now()}-2`,
            type: currentPh >= 2 ? 'acid_wasp' : 'speed_ant',
            rail: 1,
            targetRail: 1,
            yProgress: -0.35,
            hp: 58,
            maxHp: 58,
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
          }
        );
      }
    }

    function selectNextTrayPieceIfAny() {
      // In Dynamic Onboarding (Levels 1-3), never pre-select in tray so Tactical Slow-Mo stays off
      // and ONLY 1 single tray card lights up via tutorial focus!
      if (!inPlacementPhase) {
        selectedPieceIdRef.current = null;
        return;
      }
      const guide = getTutorialGuideForLevel(stateRef.current.level, piecesRef.current);
      if (guide && guide.nextTarget) {
        const targetPiece = piecesRef.current.find(
          (p) => p.id === guide.nextTarget!.pieceId || (p.type === guide.nextTarget!.pieceType && p.rail === null)
        );
        if (targetPiece) {
          selectedPieceIdRef.current = targetPiece.id;
          return;
        }
      }
      const nextUnplaced = piecesRef.current.find((p) => p.rail === null);
      selectedPieceIdRef.current = nextUnplaced ? nextUnplaced.id : null;
    }

    function resetSimulation() {
      bugs.forEach((b) => {
        const m = bugMeshes.get(b.id);
        if (m) {
          bugsGroup.remove(m);
          disposeBugInstance(m);
        }
      });
      bugMeshes.clear();
      projInstanced.count = 0;
      projInstanced.instanceMatrix.needsUpdate = true;
      chemTickAccum = 0;
      utensilMeshes.forEach((entry) => {
        utensilsGroup.remove(entry.group);
        disposeObjectTree(entry.group);
      });
      utensilMeshes.clear();

      const isRush = stateRef.current.gameMode === 'rush';
      const currentLvl = stateRef.current.level;
      const dynamicOnboarding = isDynamicOnboardingLevel(currentLvl);

      rushElapsedSec = 0;
      rushSupply = RUSH_INITIAL_SUPPLY;
      rushWaves = createRushWaveDirector();
      rushWaveWarning = null;
      rushCapFlashTimer = 0;
      rushXp = 0;
      rushXpNext = 55;
      rushLevel = 1;
      activeComandas = null;
      comandaTimer = 0;
      rushAnnouncedMinute = 0;
      rushMergesCount = 0;
      rushEvolutionsCount = 0;
      rushComandasPicked = 0;
      rushMilestonesCoins = 0;
      rushSessionMilestones = new Set<string>(stateRef.current.unlockedRushMilestones ?? []);
      patrolRoombaActive = false;
      patrolRoombaX = 0;
      patrolRoombaDir = 1;
      patrolRoombaSliceCd = 0;
      knifeRoombaMesh.visible = false;
      rushModifiers = {
        doubleNozzle: 0,
        wallRicochet: false,
        damageMult: 1.0,
        electroTiles: false,
        fireRateMult: 1.0,
        supplyRateMult: 1.0,
        xpMult: 1.0,
        chaosSpeedMult: 1.0,
        vetoedTypes: [],
      };
      if (stateRef.current.pickComandaIndexRef) {
        stateRef.current.pickComandaIndexRef.current = null;
      }

      if (isRush) {
        // Seed 4 agile rotating tray slots guaranteed to contain >= 1 Flus-Flus at 0:00!
        piecesRef.current = makeInitialRushTrayPieces(0);
      } else if (
        piecesRef.current.some((p) => p.rail !== null || p.row !== null) ||
        piecesRef.current.length === 0 ||
        piecesRef.current.some((p) => p.id.startsWith('rush-slot-'))
      ) {
        piecesRef.current = createInitialBoardPieces(currentLvl);
      }

      bugs = [];
      projectiles = [];
      chemTiles = [];
      intactPlates = [true, true, true, true];
      vipPlateRail = isRush
        ? Math.floor(Math.random() * GRID_RAILS)
        : currentLvl >= 6
        ? Math.floor(Math.random() * GRID_RAILS)
        : null;
      chefWhipCooldown = 0;
      towelWhipAnim = { timer: 0, startX: 0, startZ: 4.5, targetX: 0, targetZ: 3.0 };
      towelWhipGroup.visible = false;
      isSwipingFromChef = false;
      rapidKillStreakCount = 0;
      lastRapidKillAtMs = -Infinity;
      soundEngine.resetKillChain();
      soundEngine.musicEngine.resetSession();

      phase = 1;
      activeScript = isRush ? null : getStrategicScript(currentLvl);
      scriptClock = 0;
      scriptCursor = 0;
      // Rush mode starts in 0.0s with ZERO pauses; Strategic Levels 1-3 also start dynamically!
      inPlacementPhase = isRush ? false : !dynamicOnboarding;
      startWaveRef.current = false;
      phaseKills = 0;
      totalBugsCleaned = 0;
      killsByStar = [0, 0, 0];
      breachesByBug = {};
      score = 0;
      sanitationSeals = 3;
      armoredPlates = 0;
      hazmatShieldAvailable = stateRef.current.armorId === 'hazmat_epi';
      lastStandTriggered = false;
      lastStandTimer = 0;
      bossSpawnedForLevel = false;
      const initUpgrades = computeKitchenUpgradeEffects(stateRef.current.kitchenUpgrades);
      pressurePct = initUpgrades.initialUltimatePct;
      spawnTimer = isRush ? 1.4 : dynamicOnboarding ? 3.2 : 2.4;
      prepTimer = 0;
      levelTimer = LEVEL_DURATION_SECONDS;
      shieldWarnCooldown = 0;
      hitstopTimer = 0;
      cameraTrauma = 0;
      gameEndedLock = false;
      waveQuotaCompleted = false;
      placementComboChain = 0;
      combatComboStreak = 1;
      combatComboWindowTimer = 0;
      activeStreakCount = 0;
      activeStreakTimer = 0;
      sustainedFrameMs = 16.6;
      particleBudgetScale = 1.0;
      isDraggingOnCanvas = false;
      if (stateRef.current.dragPointerRef) {
        stateRef.current.dragPointerRef.current.active = false;
        stateRef.current.dragPointerRef.current.pieceId = null;
      }

      const forecast = getLevelForecast(currentLvl);
      kitchenProps.lateralVents.forEach((lv) => {
        lv.visible = isRush ? false : currentLvl >= 31 || forecast.hasLateralConduits;
      });

      if (!isRush && isBiomeTransitionLevel(currentLvl) && lastAnnouncedBiomeLevel !== currentLvl) {
        lastAnnouncedBiomeLevel = currentLvl;
        const biomeCfg = getBiomeForLevel(currentLvl);
        if (currentLvl > 1) {
          stateRef.current.onComicPop({
            id: `biome-trans-${currentLvl}-${Date.now()}`,
            title: biomeCfg.zoneBanner.toUpperCase(),
            subtitle: biomeCfg.subtitle,
            color: 'cyan',
            createdAt: Date.now(),
          });
        }
      }

      kitchenProps.bastionPlates.forEach((plate, rIdx) => {
        plate.visible = true;
        plate.scale.setScalar(0.86);
        const food = plate.getObjectByName('food_content');
        if (food) food.visible = true;
        if (plateBuffIndicators[rIdx]) plateBuffIndicators[rIdx].visible = true;
        if (plateVipHalos[rIdx]) plateVipHalos[rIdx].visible = vipPlateRail === rIdx;
      });

      if (isRush) {
        // Opening 15s: strictly spawn ONLY on the central rail (`rail === 1`)!
        const openingRail = pickRushSpawnRail(0);
        const openingHp = Math.round(38 * computeRushDirectorParams(0, 0).hpMultiplier);
        bugs.push({
          id: `rush-open-${Date.now()}-1`,
          type: 'speed_ant',
          rail: openingRail,
          targetRail: openingRail,
          yProgress: -0.35,
          hp: openingHp,
          maxHp: openingHp,
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
        });
        selectedPieceIdRef.current = null;
      } else {
        if (!activeScript) spawnWavePreviewBugs(currentLvl, 1);
        selectNextTrayPieceIfAny();
      }
    }

    resetSimulation();

    // Pointer / Touch Raycasting for Drag & Drop (with -45px Y finger offset), Tap-to-Swap & Active Chef "Trapazo"
    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();
    let hudEmitTimer = 0;

    function isPointerOverChef(clientX: number, clientY: number): boolean {
      const rect = renderer.domElement.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return false;
      pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      chefHitProxy.position.x = chefAnchor.position.x;
      chefHitProxy.updateMatrixWorld();
      raycaster.setFromCamera(pointerNdc, camera);
      return raycaster.intersectObject(chefHitProxy, false).length > 0;
    }

    function tryTriggerChefTowelWhip(preferredRail: number | null): boolean {
      if (chefWhipCooldown > 0 || inPlacementPhase) return false;
      const criticalBugs = bugs.filter((b) => b.koTimer <= 0 && b.yProgress >= 4.55);
      if (criticalBugs.length === 0) return false;

      criticalBugs.sort((a, b) => {
        if (preferredRail !== null) {
          const da = Math.abs(a.rail - preferredRail);
          const db = Math.abs(b.rail - preferredRail);
          if (Math.abs(da - db) > 0.35) return da - db;
        }
        return b.yProgress - a.yProgress;
      });

      const primary = criticalBugs[0];
      const liveBuffs = computeLiveMenuBuffs(intactPlates);
      const stunDur = CHEF_WHIP_STUN_SECONDS * liveBuffs.controlDurationMult;

      for (const b of criticalBugs) {
        if (
          b.id === primary.id ||
          (Math.abs(b.rail - primary.rail) <= 0.65 && Math.abs(b.yProgress - primary.yProgress) <= 0.85)
        ) {
          b.yProgress = Math.max(0.2, b.yProgress - CHEF_WHIP_PUSH_CELLS);
          b.chefStunTimer = Math.max(b.chefStunTimer ?? 0, stunDur);
          b.slowTimer = Math.max(b.slowTimer, stunDur * 1.4);
          if (b.bossTier) {
            b.bossStunTimer = Math.max(b.bossStunTimer ?? 0, stunDur);
          }
        }
      }

      const whipEffects = computeKitchenUpgradeEffects(stateRef.current.kitchenUpgrades);
      chefWhipCooldown = whipEffects.effectiveWhipCooldownSec;
      chefCelebrateTimer = 0.52;
      cameraTrauma = Math.max(cameraTrauma, 0.42);
      hitstopTimer = Math.max(hitstopTimer, 0.045);
      const targetWX = gridToWorldX(primary.rail);
      const targetWZ = gridToWorldZ(primary.yProgress + 1.1);
      towelWhipAnim = {
        timer: 0.28,
        startX: chefAnchor.position.x,
        startZ: 4.48,
        targetX: targetWX,
        targetZ: targetWZ,
      };
      chefTargetX = targetWX;
      soundEngine.playTowelWhip();
      spawnParticles(targetWX, 0.55, targetWZ, 18, 0xffffff, 3.1);

      const whipScreen = projectWorldToScreenPct(targetWX, 0.85, targetWZ);
      stateRef.current.onFloatingCombo?.({
        id: `chef-whip-${Date.now()}`,
        multiplier: 2,
        label: '🧣 Trapazo',
        detail: '-2 casillas',
        color: 'cyan',
        xPct: whipScreen.xPct,
        yPct: whipScreen.yPct,
        createdAt: Date.now(),
      });
      hudEmitTimer = 1.0;
      return true;
    }

    function getCellUnderPointer(
      clientX: number,
      clientY: number,
      applyDragOffset = false
    ): { rail: number; row: number } | null {
      const rect = renderer.domElement.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return null;
      const effY = applyDragOffset ? clientY - DRAG_OFFSET_Y_PX : clientY;
      pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((effY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNdc, camera);
      const hits = raycaster.intersectObjects(interactableCells, false);
      if (hits.length > 0) {
        const { rail, row } = hits[0].object.userData as { rail: number; row: number };
        return { rail, row };
      }
      return null;
    }

    function projectPointerToDragPlane(clientX: number, clientY: number): boolean {
      const rect = renderer.domElement.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return false;
      const effY = clientY - DRAG_OFFSET_Y_PX;
      pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((effY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNdc, camera);
      return raycaster.ray.intersectPlane(_dragPlane, _dragWorldPt) !== null;
    }

    function setInspectionTarget(next: TacticalInspectionTarget | null) {
      if (stateRef.current.inspectionTargetRef) {
        stateRef.current.inspectionTargetRef.current = next;
      }
    }

    function handlePostPlacementSelection() {
      if (inPlacementPhase) {
        selectNextTrayPieceIfAny();
        const nextSel = piecesRef.current.find((p) => p.id === selectedPieceIdRef.current);
        setInspectionTarget(
          nextSel
            ? {
                kind: 'piece',
                pieceId: nextSel.id,
                pieceType: nextSel.type,
                level: nextSel.level,
                evolutionId: nextSel.evolutionId,
              }
            : null
        );
      } else {
        selectedPieceIdRef.current = null;
        setInspectionTarget(null);
      }
    }

    function commitDropOntoCell(pieceId: string, cell: { rail: number; row: number }) {
      if (stateRef.current.gameMode === 'rush') {
        const sourcePiece = piecesRef.current.find((p) => p.id === pieceId);
        if (!sourcePiece) return;

        const trayList = piecesRef.current.filter((p) => p.rail === null || p.row === null);
        const boardList = piecesRef.current.filter((p) => p.rail !== null && p.row !== null);
        const traySlotIdx = trayList.findIndex((p) => p.id === pieceId);
        const isFromTray = traySlotIdx >= 0;

        const currentDeployCost = computeRushDeployCostForBoard(piecesRef.current);
        const maxBoardWeapons = computeRushBoardWeaponCap(rushLevel);
        const targetOccupied = boardList.some(
          (p) => p.id !== pieceId && p.rail === cell.rail && p.row === cell.row
        );
        const activeBoardCount = boardList.filter(
          (p) => p.depleteTimer === undefined && (p.ammo === undefined || p.ammo > 0)
        ).length;

        // Check board weapon cap FIRST when trying to place onto an empty cell from the tray (merges on occupied cells bypass cap!)
        if (isFromTray && !targetOccupied && activeBoardCount >= maxBoardWeapons) {
          soundEngine.playShieldClink();
          rushCapFlashTimer = 0.9;
          selectedPieceIdRef.current = null;
          setInspectionTarget(null);
          hudEmitTimer = 1.0;
          return;
        }

        if (isFromTray && rushSupply < currentDeployCost) {
          soundEngine.playShieldClink();
          const warnPos = projectWorldToScreenPct(gridToWorldX(cell.rail), 0.75, gridToWorldZ(cell.row));
          stateRef.current.onFloatingCombo?.({
            id: `supply-low-${Date.now()}`,
            multiplier: 1,
            label: '⚡ FALTA SUMINISTRO',
            detail: `${Math.floor(rushSupply)}/${currentDeployCost}`,
            color: 'yellow',
            xPct: warnPos.xPct,
            yPct: warnPos.yPct,
            createdAt: Date.now(),
          });
          selectedPieceIdRef.current = null;
          hudEmitTimer = 1.0;
          return;
        }

        // If deploying from tray, assign a unique board tower ID so tray rotation never collides
        const deployPiece: UtensilPiece = isFromTray
          ? { ...sourcePiece, id: `rush-tower-${Date.now()}-${Math.floor(Math.random() * 9999)}` }
          : sourcePiece;

        const res = executeRushDropOrMerge(
          boardList,
          deployPiece,
          cell.rail,
          cell.row,
          MIN_PLACEABLE_ROW,
          maxBoardWeapons
        );

        if (res.outcome === 'cap_reached') {
          soundEngine.playShieldClink();
          rushCapFlashTimer = 0.9;
          selectedPieceIdRef.current = null;
          setInspectionTarget(null);
          hudEmitTimer = 1.0;
          return;
        }

        if (res.outcome === 'type_cap_reached') {
          // Max 2 Flus-Flus on the counter: fuse the card into one of them or move one to the hot rail.
          soundEngine.playShieldClink();
          const capPos = projectWorldToScreenPct(gridToWorldX(cell.rail), 0.75, gridToWorldZ(cell.row));
          stateRef.current.onFloatingCombo?.({
            id: `flus-cap-${Date.now()}`,
            multiplier: 1,
            label: `MÁX ${RUSH_MAX_SPRAY_FLUS_ON_BOARD} FLUS-FLUS`,
            detail: 'fusiona o muévelo',
            color: 'orange',
            xPct: capPos.xPct,
            yPct: capPos.yPct,
            createdAt: Date.now(),
          });
          selectedPieceIdRef.current = null;
          setInspectionTarget(null);
          hudEmitTimer = 1.0;
          return;
        }

        if (res.outcome === 'invalid') {
          soundEngine.playShieldClink();
          selectedPieceIdRef.current = null;
          hudEmitTimer = 1.0;
          return;
        }

        const comboEvaluatedBoard = evaluateBoardCombos(res.updatedPieces).updatedPieces;
        const nextTray = [...trayList];
        if (isFromTray) {
          rushSupply = Math.max(0, rushSupply - currentDeployCost);
          const otherTrayTypes = nextTray
            .filter((_, idx) => idx !== traySlotIdx)
            .map((p) => p.type);
          nextTray[traySlotIdx] = makeRushTrayUtensilPiece(
            traySlotIdx,
            rushElapsedSec,
            otherTrayTypes
          );
        }

        piecesRef.current = [... ensureRushTrayHasSprayFlus(nextTray), ...comboEvaluatedBoard];

        const dropWX = gridToWorldX(cell.rail);
        const dropWZ = gridToWorldZ(cell.row);

        if (res.outcome === 'merged' || res.outcome === 'evolved') {
          soundEngine.playMergeUpgrade(res.newLevel);
          if (res.hitstopSeconds > 0) {
            hitstopTimer = Math.max(hitstopTimer, res.hitstopSeconds);
          }
          cameraTrauma = Math.max(cameraTrauma, res.outcome === 'evolved' ? 0.75 : 0.36);

          // Cleansing shockwave pushing adjacent bugs back (1.0 cell on Merge, 1.65 cells + damage pulse on Evolution!)
          for (const b of bugs) {
            if (b.koTimer > 0) continue;
            if (
              Math.abs(b.rail - cell.rail) <= 1.35 &&
              Math.abs(b.yProgress - cell.row) <= 1.75
            ) {
              if (!b.bossTier || b.bossTier === 'mini') {
                b.yProgress = Math.max(-0.2, b.yProgress - res.shockwavePushCells);
              }
              b.slowTimer = Math.max(b.slowTimer, 1.4);
              if (res.outcome === 'evolved') {
                b.hasShield = false;
                b.hp -= 55 * rushModifiers.damageMult;
                b.flashTimer = 0.12;
              }
            }
          }
          if (res.outcome === 'evolved') {
            rushEvolutionsCount += 1;
            rushXp += 20 * rushModifiers.xpMult;
            // Cleanse gunk on all towers in cleansing pulse!
            for (const p of piecesRef.current) {
              p.gunkTimer = 0;
            }
          } else {
            rushMergesCount += 1;
            rushXp += 8 * rushModifiers.xpMult;
          }

          const burstHex =
            res.outcome === 'evolved' && res.evolution
              ? res.evolution.accentHex
              : res.newLevel >= 3
              ? 0xfacc15
              : 0xe2e8f0;
          spawnParticles(dropWX, 0.55, dropWZ, res.outcome === 'evolved' ? 28 : 18, burstHex, 3.3);

          const mergePos = projectWorldToScreenPct(dropWX, 0.95, dropWZ);
          stateRef.current.onFloatingCombo?.({
            id: `rush-merge-${Date.now()}`,
            multiplier: res.newLevel,
            label:
              res.outcome === 'evolved' && res.evolution
                ? res.evolution.badgeText
                : res.newLevel === 3
                ? '🥇 Nv.3 Oro'
                : '🥈 Nv.2 Plata',
            detail: res.outcome === 'evolved' ? 'Súper-Torreta' : '+Potencia',
            color: res.outcome === 'evolved' ? 'pink' : res.newLevel === 3 ? 'yellow' : 'cyan',
            xPct: mergePos.xPct,
            yPct: mergePos.yPct,
            createdAt: Date.now(),
          });
        } else {
          const movedPiece = piecesRef.current.find((p) => p.id === res.resultPieceId);
          const hasCombo = movedPiece && movedPiece.comboType !== 'none';
          soundEngine.playSnapPiece(Boolean(hasCombo));
          spawnParticles(dropWX, 0.25, dropWZ, 14, hasCombo ? 0xe879f9 : 0xffffff, 2.7);
          if (hasCombo && res.resultPieceId) {
            emitPlacementComboIfAny(res.resultPieceId);
          }
        }

        if (res.resultPieceId) {
          const entry = utensilMeshes.get(res.resultPieceId);
          if (entry) entry.bounce = 1.0;
        }
        selectedPieceIdRef.current = null;
        setInspectionTarget(null);
        hudEmitTimer = 1.0;
        return;
      }

      piecesRef.current = moveOrSwapUtensil(
        piecesRef.current,
        pieceId,
        cell.rail,
        cell.row
      );
      const movedPiece = piecesRef.current.find((p) => p.id === pieceId);
      const hasCombo = movedPiece && movedPiece.comboType !== 'none';
      soundEngine.playSnapPiece(Boolean(hasCombo));
      spawnParticles(
        gridToWorldX(cell.rail),
        0.25,
        gridToWorldZ(cell.row),
        14,
        hasCombo ? 0xe879f9 : 0xffffff,
        2.7
      );
      const entry = utensilMeshes.get(pieceId);
      if (entry) entry.bounce = 1.0;
      if (hasCombo) {
        emitPlacementComboIfAny(pieceId);
      }
      handlePostPlacementSelection();
      // Immediately flush HUD snapshot on next frame so Level 1 dashed drag-guide clears at t=0!
      hudEmitTimer = 1.0;
    }

    const onPointerDown = (e: PointerEvent) => {
      if (stateRef.current.gameState !== 'playing') return;
      if (simResetRef.current !== lastKnownReset) {
        lastKnownReset = simResetRef.current;
        resetSimulation();
      }
      lastPointerClientX = e.clientX;
      lastPointerClientY = e.clientY;

      // Active Chef ("Trapazo de cocina"): tapping Chef or starting a swipe from Chef toward a plate
      if (!selectedPieceIdRef.current && isPointerOverChef(e.clientX, e.clientY)) {
        if (tryTriggerChefTowelWhip(null)) {
          isSwipingFromChef = false;
          return;
        }
        isSwipingFromChef = true;
        chefSwipeStartX = e.clientX;
        chefSwipeStartY = e.clientY;
      } else {
        isSwipingFromChef = false;
      }

      // Tap on any of the 4 Gourmet Plates -> 0.08x Tactical Plate Inspection
      if (!isDraggingOnCanvas) {
        const rect = renderer.domElement.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
          pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
          raycaster.setFromCamera(pointerNdc, camera);
          const plateHits = raycaster.intersectObjects(plateHitMeshes, false);
          if (plateHits.length > 0) {
            const pRail = (plateHits[0].object.userData as { plateRail: number }).plateRail;
            const currInsp = stateRef.current.inspectionTargetRef?.current;
            selectedPieceIdRef.current = null;
            if (currInsp?.kind === 'plate' && currInsp.rail === pRail) {
              setInspectionTarget(null);
            } else {
              setInspectionTarget({ kind: 'plate', rail: pRail });
              soundEngine.playSlowMoEnter();
            }
            hudEmitTimer = 1.0;
            return;
          }
        }
      }

      const cell = getCellUnderPointer(e.clientX, e.clientY, false);
      if (!cell) {
        if (!selectedPieceIdRef.current && stateRef.current.inspectionTargetRef?.current) {
          setInspectionTarget(null);
          hudEmitTimer = 1.0;
        }
        return;
      }

      chefTargetX = gridToWorldX(cell.rail);
      const occupant = piecesRef.current.find(
        (p) => p.rail === cell.rail && p.row === cell.row
      );

      // If tapping a Gunked piece, clean it immediately!
      if (occupant && occupant.gunkTimer > 0) {
        occupant.gunkTimer = 0;
        spawnParticles(gridToWorldX(cell.rail), 0.5, gridToWorldZ(cell.row), 10, 0xffffff, 2.2);
        soundEngine.playSnapPiece(true);
      }

      const currentSelected = selectedPieceIdRef.current;
      if (currentSelected) {
        if (occupant && occupant.id === currentSelected) {
          isDraggingOnCanvas = true;
          setInspectionTarget({
            kind: 'piece',
            pieceId: occupant.id,
            pieceType: occupant.type,
            level: occupant.level,
            evolutionId: occupant.evolutionId,
          });
          soundEngine.playSlowMoEnter();
          hudEmitTimer = 1.0;
          return;
        }

        if (cell.row < MIN_PLACEABLE_ROW) {
          soundEngine.playShieldClink();
          selectedPieceIdRef.current = null;
          setInspectionTarget(null);
          hudEmitTimer = 1.0;
          return;
        }

        commitDropOntoCell(currentSelected, cell);
        isDraggingOnCanvas = false;
      } else if (occupant) {
        selectedPieceIdRef.current = occupant.id;
        setInspectionTarget({
          kind: 'piece',
          pieceId: occupant.id,
          pieceType: occupant.type,
          level: occupant.level,
          evolutionId: occupant.evolutionId,
        });
        isDraggingOnCanvas = true;
        hoveredCell = cell;
        soundEngine.playSlowMoEnter();
        hudEmitTimer = 1.0;
      } else if (stateRef.current.inspectionTargetRef?.current) {
        setInspectionTarget(null);
        hudEmitTimer = 1.0;
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (stateRef.current.gameState !== 'playing') return;
      lastPointerClientX = e.clientX;
      lastPointerClientY = e.clientY;

      if (isSwipingFromChef) {
        const dy = chefSwipeStartY - e.clientY;
        const dx = e.clientX - chefSwipeStartX;
        if (Math.hypot(dx, dy) > 26 && dy > -10) {
          const targetCell = getCellUnderPointer(e.clientX, e.clientY, false);
          const approxRail = targetCell
            ? targetCell.rail
            : THREE.MathUtils.clamp(Math.round(1.5 + dx / 55), 0, GRID_RAILS - 1);
          tryTriggerChefTowelWhip(approxRail);
          isSwipingFromChef = false;
        }
      }

      const trayDragActive = Boolean(stateRef.current.dragPointerRef?.current.active);
      if (trayDragActive && stateRef.current.dragPointerRef) {
        stateRef.current.dragPointerRef.current.clientX = e.clientX;
        stateRef.current.dragPointerRef.current.clientY = e.clientY;
      }
      const activelyDragging = isDraggingOnCanvas || trayDragActive;
      const cell = getCellUnderPointer(e.clientX, e.clientY, activelyDragging);
      hoveredCell = cell;
      if (cell) {
        chefTargetX = gridToWorldX(cell.rail) * 0.65;
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (isSwipingFromChef) {
        isSwipingFromChef = false;
        const targetCell = getCellUnderPointer(e.clientX, e.clientY, false);
        tryTriggerChefTowelWhip(targetCell ? targetCell.rail : null);
      }

      const trayDrag = stateRef.current.dragPointerRef?.current;
      const wasTrayDragging = Boolean(trayDrag?.active);
      if (!isDraggingOnCanvas && !wasTrayDragging) return;

      const selectedId =
        (wasTrayDragging && trayDrag?.pieceId) ? trayDrag.pieceId : selectedPieceIdRef.current;
      isDraggingOnCanvas = false;
      if (trayDrag) {
        trayDrag.active = false;
        trayDrag.pieceId = null;
      }
      hudEmitTimer = 1.0;
      if (!selectedId) return;

      const cell = getCellUnderPointer(e.clientX, e.clientY, true);
      const origin = piecesRef.current.find((p) => p.id === selectedId);
      if (
        cell &&
        cell.row >= MIN_PLACEABLE_ROW &&
        origin &&
        (cell.rail !== origin.rail || cell.row !== origin.row)
      ) {
        commitDropOntoCell(selectedId, cell);
      } else if (wasTrayDragging && cell && cell.row < MIN_PLACEABLE_ROW) {
        soundEngine.playShieldClink();
      }
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    // ResizeObserver for crisp viewport scaling & thermal DPR cap (1.35x in 60 FPS Mobile mode)
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        const h = entry.contentRect.height;
        if (w > 0 && h > 0) {
          const prio60 = Boolean(
            (stateRef.current.settings ?? DEFAULT_SETTINGS).prioritize60Fps !== false
          );
          renderer.setPixelRatio(computeTargetPixelRatio(prio60));
          updateCameraProjection(w, h);
          renderer.setSize(w, h);
          renderer.render(scene, camera);
        }
      }
    });
    resizeObserver.observe(container);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Software-WebGL safe loop scheduler per Three.js skill directive
    let frameId = 0;
    let disposed = false;
    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
      gl.flush();
      if (!sync) {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const poll = () => {
        if (disposed) return;
        const state = gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    const clock = new THREE.Clock();

    function tick() {
      if (disposed) return;
      const rawDt = clock.getDelta();
      const dt = Math.min(rawDt, 0.05);
      const wallDt = Math.min(rawDt, 0.25);
      const elapsed = clock.getElapsedTime();

      // Track rolling frame time (ms) to auto-halve Rush decorative particles if sustained > 24ms
      if (rawDt > 0 && rawDt < 0.25) {
        sustainedFrameMs = sustainedFrameMs * 0.9 + rawDt * 1000 * 0.1;
      }
      particleBudgetScale = computeThermalParticleBudgetFactor(
        stateRef.current.gameMode === 'rush' && stateRef.current.gameState === 'playing',
        sustainedFrameMs,
        particleBudgetScale < 1.0
      );

      if (simResetRef.current !== lastKnownReset) {
        lastKnownReset = simResetRef.current;
        resetSimulation();
      }

      const desiredPrio60 = Boolean(
        (stateRef.current.settings ?? DEFAULT_SETTINGS).prioritize60Fps !== false
      );
      if (desiredPrio60 !== lastAppliedPrioritize60) {
        lastAppliedPrioritize60 = desiredPrio60;
        const enableShadows = !isSoftwareGl && !desiredPrio60;
        renderer.setPixelRatio(computeTargetPixelRatio(desiredPrio60));
        renderer.shadowMap.enabled = enableShadows;
        sunLight.castShadow = enableShadows;
        slab.receiveShadow = enableShadows;
      }

      syncChefModel();
      syncWardrobeSpecialShowcase();

      // Update Biome & World theme palette smoothly (Bioma 0 + sunny_counter keeps pure white to show full Golden Maple texture)
      const activeBiome = getBiomeForLevel(stateRef.current.level);
      const worldMeta = WORLDS_CATALOG[stateRef.current.worldId];
      const targetCounterHex =
        stateRef.current.worldId !== 'sunny_counter'
          ? worldMeta.woodColor
          : activeBiome.id === 'main_kitchen'
          ? '#ffffff'
          : activeBiome.counterHex;
      slab.material.color.set(targetCounterHex);
      (wallSlab.material as THREE.MeshToonMaterial).color.set(activeBiome.wallHex);
      (floorMesh.material as THREE.MeshToonMaterial).color.set(
        activeBiome.id === 'main_kitchen' ? '#ffffff' : activeBiome.floorHex
      );
      const isRushMode = stateRef.current.gameMode === 'rush';
      if (rushCapFlashTimer > 0) {
        rushCapFlashTimer = Math.max(0, rushCapFlashTimer - dt);
      }
      const rushArsenal = isRushMode
        ? computeRushArsenalMetrics(piecesRef.current)
        : { weaponCount: 0, averageLevel: 0, arsenalPower: 0 };
      const rushDirector = computeRushDirectorParams(rushElapsedSec, rushArsenal.arsenalPower);
      const currentRushCost = computeRushDeployCostForBoard(piecesRef.current);
      const currentRushSupplyMax = computeRushSupplyMax(currentRushCost);
      const levelForecast = getLevelForecast(stateRef.current.level);
      kitchenProps.lateralVents.forEach((lv) => {
        lv.visible = isRushMode
          ? rushDirector.lateralConduitsOpen
          : stateRef.current.level >= 31 || levelForecast.hasLateralConduits;
      });

      const gState = stateRef.current.gameState;

      if (stateRef.current.wardrobeOpen) {
        const activeTab = stateRef.current.wardrobeTab ?? 'hats';
        const targetCamX = activeTab === 'specials' ? 0.45 : Math.sin(elapsed * 1.1) * 0.14;
        const targetCamY = activeTab === 'hats' ? 2.85 : activeTab === 'armors' ? 2.45 : 2.55;
        const targetCamZ = activeTab === 'hats' ? 11.5 : activeTab === 'armors' ? 11.8 : 12.0;
        const targetLookX = activeTab === 'specials' ? 0.42 : 0;
        const targetLookY = activeTab === 'hats' ? 1.15 : activeTab === 'armors' ? 0.75 : 0.85;
        if (!wasWardrobeOpen) {
          wasWardrobeOpen = true;
          camera.position.set(targetCamX, targetCamY, targetCamZ);
          wardrobeLookX = targetLookX;
          wardrobeLookY = targetLookY;
          chefAnchor.position.set(0, 0.35, 4.72);
          chefAnchor.rotation.y = stateRef.current.wardrobeYawRef?.current ?? 0;
        } else {
          camera.position.x = THREE.MathUtils.damp(camera.position.x, targetCamX, 8, dt);
          camera.position.y = THREE.MathUtils.damp(camera.position.y, targetCamY, 8, dt);
          camera.position.z = THREE.MathUtils.damp(camera.position.z, targetCamZ, 8, dt);
          wardrobeLookX = THREE.MathUtils.damp(wardrobeLookX, targetLookX, 9, dt);
          wardrobeLookY = THREE.MathUtils.damp(wardrobeLookY, targetLookY, 9, dt);
        }
        camera.lookAt(wardrobeLookX, wardrobeLookY, 4.72);
        if (wardrobeSpecialGroup.visible) {
          wardrobeSpecialGroup.rotation.y += dt * 1.4;
          wardrobeSpecialGroup.position.y = 0.55 + Math.sin(elapsed * 2.6) * 0.05;
        }
      } else if (gState === 'title') {
        wasWardrobeOpen = false;
        const tourX = Math.sin(elapsed * 0.45) * 0.95;
        const tourZ = baseCamZ - 0.1 + Math.cos(elapsed * 0.35) * 0.3;
        camera.position.x = THREE.MathUtils.damp(camera.position.x, tourX, 3, dt);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, baseCamY, 3, dt);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, tourZ, 3, dt);
        camera.lookAt(0, baseLookY, baseLookZ);
      } else {
        wasWardrobeOpen = false;
        const cfg = stateRef.current.settings ?? DEFAULT_SETTINGS;
        cameraTrauma = Math.max(0, cameraTrauma - dt * 2.4);
        const shake = cfg.screenShake ? cameraTrauma * cameraTrauma * 0.32 : 0;
        const shakeX = (Math.random() - 0.5) * shake;
        const shakeZ = (Math.random() - 0.5) * shake;
        camera.position.x = THREE.MathUtils.damp(camera.position.x, shakeX, 10, dt);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, baseCamY, 8, dt);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, baseCamZ + shakeZ, 10, dt);
        camera.lookAt(0, baseLookY, baseLookZ);
      }

      // Consume Strategic Mode Coin Boosters (Level 15+)
      if (stateRef.current.boostUltimateRef?.current) {
        stateRef.current.boostUltimateRef.current = false;
        pressurePct = Math.min(100, pressurePct + 50);
        spawnParticles(0, 0.65, 4.18, 18, 0xfacc15, 2.9);
      }
      if (stateRef.current.boostPlateShieldRef?.current) {
        stateRef.current.boostPlateShieldRef.current = false;
        armoredPlates += 1;
        spawnParticles(0, 0.65, 4.18, 18, 0x38bdf8, 2.9);
      }

      // Wait for manual "EMPEZAR" button trigger to exit Strategic Placement Mode (Level 4+)
      if (gState === 'playing' && inPlacementPhase) {
        if (startWaveRef.current) {
          startWaveRef.current = false;
          inPlacementPhase = false;
          selectedPieceIdRef.current = null;
        }
      }

      // Check Ultimate trigger (Roomba Kamikaze / Kärcher / Volcano — Volcano uses real chemical orange/red fire!)
      if (triggerUltimateRef.current && gState === 'playing') {
        triggerUltimateRef.current = false;
        inPlacementPhase = false;
        pressurePct = 0;
        cameraTrauma = 0.85;
        hitstopTimer = 0.06;
        chefCelebrateTimer = 0.9;
        soundEngine.playStarKill(3);

        const specId = stateRef.current.specialWeaponId;
        stateRef.current.onComicPop({
          id: `ult-${Date.now()}`,
          title:
            specId === 'knife_roomba'
              ? '¡ROOMBA KAMIKAZE!'
              : specId === 'baking_volcano'
              ? '¡VOLCÁN QUÍMICO!'
              : '¡KÄRCHER A PRESIÓN!',
          subtitle:
            specId === 'baking_volcano'
              ? '¡Fuego Químico Funde-Corazas en los 4 Raíles!'
              : '¡Desinfección Masiva en los 4 Raíles!',
          color: specId === 'baking_volcano' ? 'orange' : 'cyan',
          createdAt: Date.now(),
        });

        if (specId === 'karcher_blast') {
          for (const b of bugs) {
            if (b.koTimer <= 0) {
              b.yProgress = Math.max(-0.2, b.yProgress - 1.35);
              b.slowTimer = 2.0;
              b.flashTimer = Math.max(b.flashTimer, ENEMY_WHITE_FLASH_SECONDS);
            }
          }
          hitstopTimer = Math.max(hitstopTimer, HEAVY_IMPACT_HITSTOP_SECONDS);
        }

        for (let r = 0; r < GRID_RAILS; r++) {
          if (specId === 'baking_volcano') {
            spawnParticles(gridToWorldX(r), 0.55, gridToWorldZ(4.5), 14, 0xf97316, 3.2);
          }
          projectiles.push({
            id: `proj-ult-${r}-${Date.now()}`,
            x: r,
            y: 5.3,
            vx: 0,
            vy: -7.5,
            damage: 145,
            isEnemy: false,
            flavor: specId === 'baking_volcano' ? 'volcano_foam' : 'roomba_blade',
            pierceShield: true,
            isExplosiveOrThermal: true,
            fromDiagonalFoam: false,
            fromVortex: true,
            life: 2.0,
          });
        }
      }

      // Salvada In Extremis (Last Plate): once per match when 1 plate remains and a live bug enters critical zone (yProgress >= 5.25)
      if (
        gState === 'playing' &&
        !inPlacementPhase &&
        !gameEndedLock &&
        !lastStandTriggered &&
        sanitationSeals === 1 &&
        bugs.some((b) => b.koTimer <= 0 && b.yProgress >= 5.25)
      ) {
        lastStandTriggered = true;
        lastStandTimer = 1.2;
        soundEngine.playSlowMoEnter();
      }
      if (lastStandTimer > 0 && gState === 'playing') {
        lastStandTimer = Math.max(0, lastStandTimer - dt);
      }

      // Simulation step (clamped & affected by Hitstop / Salvada In Extremis 0.35x / Tactical Slow-Mo 0.2x)
      if (hitstopTimer > 0) {
        hitstopTimer = Math.max(0, hitstopTimer - dt);
      }

      const activeSettings = stateRef.current.settings ?? DEFAULT_SETTINGS;
      const trayDragState = stateRef.current.dragPointerRef?.current;
      const isActivelyDragging = isDraggingOnCanvas || Boolean(trayDragState?.active);
      const activePieceId =
        (trayDragState?.active && trayDragState.pieceId)
          ? trayDragState.pieceId
          : selectedPieceIdRef.current;
      const isPieceSelected = Boolean(activePieceId);
      const activePieceObj = activePieceId
        ? piecesRef.current.find((p) => p.id === activePieceId)
        : undefined;
      const rawInspection = stateRef.current.inspectionTargetRef?.current ?? null;
      const effectiveInspection: TacticalInspectionTarget | null = activePieceObj
        ? {
            kind: 'piece',
            pieceId: activePieceObj.id,
            pieceType: activePieceObj.type,
            level: activePieceObj.level,
            evolutionId: activePieceObj.evolutionId,
          }
        : rawInspection;
      const isInspectorReadingActive =
        !inPlacementPhase && Boolean(isPieceSelected || effectiveInspection);
      const isComandaSlowMoActive = isRushMode && activeComandas !== null;

      // Safeguard: combine active timeScales via Math.min() (0.08x Inspector, 0.20x Comanda/Tactical, 0.35x Last Stand)
      const timeScale = combineActiveTimeScales(activeSettings.gameSpeedMultiplier, {
        isPlaying: gState === 'playing',
        hitstopActive: hitstopTimer > 0,
        inspectorSlowMoActive: isInspectorReadingActive,
        comandaSlowMoActive: isComandaSlowMoActive,
        tacticalSlowMoActive: isPieceSelected && !inPlacementPhase && activeSettings.tacticalSlowMo,
        lastStandActive: lastStandTimer > 0,
      });

      // Feed live telemetry to pure Web Audio Adaptive Music Sequencer (zero allocations)
      if (gState === 'playing') {
        let liveBugCount = 0;
        let maxBugYProgress = -0.4;
        let hasLiveBoss = false;
        let grandBossPhase3 = false;
        for (let i = 0; i < bugs.length; i++) {
          const b = bugs[i];
          if (b.koTimer <= 0 && b.hp > 0) {
            liveBugCount += 1;
            if (b.yProgress > maxBugYProgress) {
              maxBugYProgress = b.yProgress;
            }
            if (b.bossTier) {
              hasLiveBoss = true;
              if (b.bossTier === 'grand' && (b.bossPhase ?? 1) >= 3) {
                grandBossPhase3 = true;
              }
            }
          }
        }
        soundEngine.updateAdaptiveMusic({
          isPlaying: true,
          gameMode: isRushMode ? 'rush' : 'strategic',
          level: stateRef.current.level,
          phase,
          inPlacementPhase,
          liveBugCount,
          maxBugYProgress,
          hasBoss: hasLiveBoss,
          grandBossFinalPhase: grandBossPhase3,
          lastStandActive: lastStandTimer > 0,
          tacticalSlowMoActive: isInspectorReadingActive || isComandaSlowMoActive,
          rushElapsedSec,
          gameSpeedMultiplier: activeSettings.gameSpeedMultiplier,
        });
      }

      const simDt = dt * timeScale;
      const liveMenuBuffs = computeLiveMenuBuffs(intactPlates);
      const upgradeEffects = computeKitchenUpgradeEffects(stateRef.current.kitchenUpgrades);
      const isColdEnvironment =
        stateRef.current.worldId === 'fridge_vault' || activeBiome.id === 'freezer_vault';

      // Evaluate combos & update 3D Combo Visuals (cached transforms, 1 UV beam mesh, 4 opaque low-poly foam spheres)
      const comboEval = evaluateBoardCombos(piecesRef.current);
      piecesRef.current = comboEval.updatedPieces;

      circuitPool.forEach((linkGroup, idx) => {
        const link = comboEval.links[idx];
        if (!link) {
          if (linkGroup.visible) {
            linkGroup.visible = false;
            linkGroup.userData.lastLinkKey = '';
          }
          return;
        }
        linkGroup.visible = true;
        const linkKey = `${link.kind}_${link.fromRail}_${link.fromRow}_${link.toRail}_${link.toRow}`;
        if (linkGroup.userData.lastLinkKey !== linkKey) {
          linkGroup.userData.lastLinkKey = linkKey;
          const x1 = gridToWorldX(link.fromRail);
          const z1 = gridToWorldZ(link.fromRow);
          const x2 = gridToWorldX(link.toRail);
          const z2 = gridToWorldZ(link.toRow);
          const dist = Math.hypot(x2 - x1, z2 - z1);

          const fireStream = linkGroup.getObjectByName('fire_stream');
          const foamSpray = linkGroup.getObjectByName('foam_spray');
          const floorBar = linkGroup.getObjectByName('floor_bar');

          if (link.kind === 'bridge_uv') {
            if (fireStream) {
              fireStream.visible = true;
              fireStream.scale.set(1, 1, Math.max(0.4, dist - 0.32));
            }
            if (foamSpray) foamSpray.visible = false;
            if (floorBar) floorBar.visible = false;
            linkGroup.position.set((x1 + x2) / 2, 0.78, (z1 + z2) / 2 - 0.08);
            linkGroup.rotation.y = Math.atan2(x2 - x1, z2 - z1);
          } else if (link.kind === 'line_foam') {
            if (fireStream) fireStream.visible = false;
            if (foamSpray) foamSpray.visible = true;
            if (floorBar) floorBar.visible = false;
            linkGroup.position.set(x2, 0.08, z2);
            linkGroup.rotation.y = 0;
          } else {
            if (fireStream) fireStream.visible = false;
            if (foamSpray) foamSpray.visible = false;
            if (floorBar) {
              floorBar.visible = true;
              ((floorBar as THREE.Mesh).material as THREE.MeshBasicMaterial).color.setHex(
                link.kind === 'deflect_90' ? 0xfacc15 : 0x2dd4bf
              );
              floorBar.scale.set(1, 1, dist);
            }
            linkGroup.position.set((x1 + x2) / 2, 0.04, (z1 + z2) / 2);
            linkGroup.rotation.y = Math.atan2(x2 - x1, z2 - z1);
          }
        }

        if (link.kind === 'line_foam') {
          const foamSpray = linkGroup.getObjectByName('foam_spray');
          if (foamSpray) {
            for (let bIdx = 0; bIdx < 4; bIdx++) {
              const bObj = foamSpray.getObjectByName(`soap_bubble_${bIdx}`);
              if (bObj) {
                bObj.scale.setScalar(0.92 + Math.sin(elapsed * 5.2 + bIdx * 1.4) * 0.1);
              }
            }
          }
        }
      });

      // =======================================================================
      // SINGLE-FOCUS ONBOARDING (55% DIM) + LIVE RANGE PADS + PRE-DROP COMBO & EVOLUTION ARCS
      // =======================================================================
      const tutorialGuide =
        gState === 'playing' && !isRushMode
          ? getTutorialGuideForLevel(stateRef.current.level, piecesRef.current)
          : null;
      // Show smart combo hints on board ONLY actively when dragging/touching a piece (`isPieceSelected`)!
      const smartComboHints =
        gState === 'playing' && isPieceSelected
          ? computeSmartComboHints(
              piecesRef.current,
              isRushMode ? 10 : stateRef.current.level,
              activeSettings.smartComboHints
            )
          : [];
      const pulse = 0.58 + Math.sin(elapsed * 8) * 0.32;
      const singleFocusOnboarding =
        gState === 'playing' &&
        !isRushMode &&
        stateRef.current.level <= 2 &&
        Boolean(tutorialGuide?.nextTarget);

      // Render 3D Semi-Transparent Ghost Utensil on the single active Tutorial Target Cell
      if (tutorialGuide && tutorialGuide.nextTarget) {
        const tgt = tutorialGuide.nextTarget;
        if (currentGhostType !== tgt.pieceType || !currentGhostMesh) {
          ghostTutorialGroup.clear();
          currentGhostMesh = buildGhostUtensilMesh(tgt.pieceType, isSoftwareGl);
          currentGhostType = tgt.pieceType;
          ghostTutorialGroup.add(currentGhostMesh);
        }
        ghostTutorialGroup.visible = true;
        ghostTutorialGroup.position.set(
          gridToWorldX(tgt.rail),
          0.08 + Math.sin(elapsed * 5) * 0.08,
          gridToWorldZ(tgt.row)
        );
      } else {
        ghostTutorialGroup.visible = false;
      }

      // Render Floating 3D Weapon Ghost shifted -45px in Y above the finger while dragging!
      const selPiece = piecesRef.current.find((p) => p.id === activePieceId);
      if (isActivelyDragging && selPiece) {
        const ptrX = trayDragState?.active ? trayDragState.clientX : lastPointerClientX;
        const ptrY = trayDragState?.active ? trayDragState.clientY : lastPointerClientY;
        const dragKey = `${selPiece.type}_${selPiece.level}_${selPiece.evolutionId ?? ''}`;
        if (currentDragGhostKey !== dragKey) {
          dragGhostGroup.clear();
          const dg = buildGhostUtensilMesh(
            selPiece.type,
            isSoftwareGl,
            selPiece.level,
            selPiece.evolutionId
          );
          dragGhostGroup.add(dg);
          currentDragGhostKey = dragKey;
        }
        if (projectPointerToDragPlane(ptrX, ptrY)) {
          dragGhostGroup.visible = true;
          dragGhostGroup.position.set(_dragWorldPt.x, 0.72, _dragWorldPt.z);
        } else {
          dragGhostGroup.visible = false;
        }
      } else {
        dragGhostGroup.visible = false;
      }

      const previewCell =
        hoveredCell && hoveredCell.row >= MIN_PLACEABLE_ROW && isPieceSelected
          ? hoveredCell
          : selPiece && selPiece.rail !== null && selPiece.row !== null
          ? { rail: selPiece.rail, row: selPiece.row }
          : null;

      const activeRangeCells =
        selPiece && previewCell
          ? computeWeaponRangeCells(selPiece.type, previewCell.rail, previewCell.row, piecesRef.current)
          : [];

      // Golden "¡EVOLUCIONAR!" Partner Discovery when dragging/selecting a Gold Lv.3 weapon!
      const evolutionPartners =
        isRushMode && selPiece ? findSupremeEvolutionPartners(selPiece, piecesRef.current) : [];

      // Pre-Drop Combo Synergy Electric Arcs + Golden Supreme Evolution Partner Arcs BEFORE releasing finger!
      const preDropLinks =
        isActivelyDragging &&
        activePieceId &&
        hoveredCell &&
        hoveredCell.row >= MIN_PLACEABLE_ROW
          ? computeDragComboPreviewLinks(
              piecesRef.current,
              activePieceId,
              hoveredCell.rail,
              hoveredCell.row
            )
          : [];

      synergyArcPool.forEach((arcGroup, aIdx) => {
        const evoMatch = evolutionPartners[aIdx];
        if (evoMatch && evoMatch.partner.rail !== null && evoMatch.partner.row !== null) {
          arcGroup.visible = true;
          const originX =
            dragGhostGroup.visible
              ? dragGhostGroup.position.x
              : selPiece && selPiece.rail !== null
              ? gridToWorldX(selPiece.rail)
              : gridToWorldX(evoMatch.partner.rail);
          const originZ =
            dragGhostGroup.visible
              ? dragGhostGroup.position.z
              : selPiece && selPiece.row !== null
              ? gridToWorldZ(selPiece.row)
              : gridToWorldZ(Math.min(6, evoMatch.partner.row + 1));
          const ax2 = gridToWorldX(evoMatch.partner.rail);
          const az2 = gridToWorldZ(evoMatch.partner.row);
          const adist = Math.max(0.35, Math.hypot(ax2 - originX, az2 - originZ));
          arcGroup.position.set((originX + ax2) / 2, 0.78, (originZ + az2) / 2);
          arcGroup.rotation.y = Math.atan2(ax2 - originX, az2 - originZ);

          for (let s = 0; s < 7; s++) {
            const seg = arcGroup.getObjectByName(`arc_seg_${s}`) as THREE.Mesh | undefined;
            if (!seg) continue;
            const u = (s + 0.5) / 7 - 0.5;
            const archY = Math.sin(((s + 0.5) / 7) * Math.PI) * 0.45;
            const jitterX = Math.sin(elapsed * 48 + s * 2.3) * 0.06;
            seg.position.set(jitterX, archY, u * adist);
            seg.scale.set(1.25, adist / 1.05, 1.25);
            (seg.material as THREE.MeshBasicMaterial).color.setHex(
              s % 2 === 0 ? 0xfacc15 : 0xffffff
            );
          }
          return;
        }

        const pl = preDropLinks[aIdx - evolutionPartners.length];
        if (!pl) {
          arcGroup.visible = false;
          return;
        }
        arcGroup.visible = true;
        const ax1 = gridToWorldX(pl.fromRail);
        const az1 = gridToWorldZ(pl.fromRow);
        const ax2 = gridToWorldX(pl.toRail);
        const az2 = gridToWorldZ(pl.toRow);
        const adist = Math.max(0.2, Math.hypot(ax2 - ax1, az2 - az1));
        arcGroup.position.set((ax1 + ax2) / 2, 0.62, (az1 + az2) / 2);
        arcGroup.rotation.y = Math.atan2(ax2 - ax1, az2 - az1);

        const arcColor =
          pl.kind === 'bridge_uv'
            ? 0xe879f9
            : pl.kind === 'line_foam'
            ? 0xa3e635
            : pl.kind === 'deflect_90'
            ? 0xfacc15
            : 0x22d3ee;

        for (let s = 0; s < 7; s++) {
          const seg = arcGroup.getObjectByName(`arc_seg_${s}`) as THREE.Mesh | undefined;
          if (!seg) continue;
          const u = (s + 0.5) / 7 - 0.5;
          const jitterX = Math.sin(elapsed * 45 + s * 2.1) * 0.08;
          const jitterY = Math.cos(elapsed * 52 + s * 1.7) * 0.06;
          seg.position.set(jitterX, jitterY, u * adist);
          seg.scale.set(1, adist / 1.1, 1);
          (seg.material as THREE.MeshBasicMaterial).color.setHex(
            s % 2 === 0 ? arcColor : 0xffffff
          );
        }
      });

      const partnerHighlights = selPiece
        ? computeBoardPartnerHighlights(selPiece, piecesRef.current, isRushMode)
        : [];

      for (let r = 0; r < GRID_RAILS; r++) {
        for (let row = 0; row < GRID_ROWS; row++) {
          const hl = cellHighlights[r][row];
          const hlMat = hl.material as THREE.MeshBasicMaterial;
          const pad = cellRangePads[r][row];
          const padMat = pad.material as THREE.MeshBasicMaterial;
          const spot = cellSpots[r][row];
          const isHovered = hoveredCell?.rail === r && hoveredCell?.row === row;
          const pieceAt = piecesRef.current.find((p) => p.rail === r && p.row === row);
          const isSelectedCell = pieceAt && pieceAt.id === activePieceId;

          if (spot) {
            const spotMat = spot.material as THREE.MeshBasicMaterial;
            spotMat.opacity = isPieceSelected ? (isHovered ? 0.24 : 0.12) : 0.08;
          }

          const isNextTutorialTarget =
            tutorialGuide?.nextTarget?.rail === r && tutorialGuide?.nextTarget?.row === row;
          const rangeMatch = activeRangeCells.find((c) => c.rail === r && c.row === row);

          // 1. Update Countertop Pad (55% dim on non-target cells in L1-L2 guided steps, OR live weapon range illumination)
          if (singleFocusOnboarding) {
            if (isNextTutorialTarget) {
              padMat.color.setHex(0x22c55e);
              padMat.opacity = 0.24 + Math.sin(elapsed * 8) * 0.1;
            } else if (rangeMatch && isHovered) {
              padMat.color.setHex(0x22d3ee);
              padMat.opacity = 0.22;
            } else {
              padMat.color.setHex(0x090605);
              padMat.opacity = 0.55; // 55% dim on rest of board so ONLY the exact target cell pops!
            }
          } else if (rangeMatch) {
            padMat.color.setHex(
              rangeMatch.role === 'damage'
                ? 0x22d3ee
                : rangeMatch.role === 'area'
                ? 0xa3e635
                : 0xf472b6
            );
            padMat.opacity = 0.24 + Math.sin(elapsed * 6) * 0.06;
          } else {
            padMat.opacity = 0;
          }

          // 2. Update Cell Ring Highlights (Gold for Merge/Evolution partner, Green for Positional Synergy partner!)
          const smartHintHere =
            !tutorialGuide?.nextTarget
              ? smartComboHints.find((h) => h.rail === r && h.row === row)
              : undefined;

          const partnerRingHere = partnerHighlights.find((ph) => ph.rail === r && ph.row === row);

          if (row < MIN_PLACEABLE_ROW) {
            if (isHovered && isPieceSelected) {
              hlMat.color.setHex(0xef4444);
              hlMat.opacity = 0.65;
            } else {
              hlMat.opacity = 0;
            }
          } else if (partnerRingHere?.kind === 'evolve') {
            hlMat.color.setHex(0xfacc15);
            hlMat.opacity = 0.96;
          } else if (partnerRingHere?.kind === 'merge') {
            hlMat.color.setHex(0xfacc15);
            hlMat.opacity = pulse;
          } else if (partnerRingHere?.kind === 'synergy' && !tutorialGuide?.nextTarget) {
            hlMat.color.setHex(0x4ade80);
            hlMat.opacity = pulse;
          } else if (isNextTutorialTarget) {
            hlMat.color.setHex(0x22c55e);
            hlMat.opacity = pulse;
          } else if (tutorialGuide?.nextTarget) {
            // Single focus: never light secondary green/yellow rings while a guided step is active!
            if (isHovered && isPieceSelected) {
              hlMat.color.setHex(0xfacc15);
              hlMat.opacity = 0.65;
            } else {
              hlMat.opacity = 0;
            }
          } else if (smartHintHere) {
            const hintHex =
              smartHintHere.color === 'orange'
                ? 0xa855f7
                : smartHintHere.color === 'green'
                ? 0xa3e635
                : 0x22d3ee;
            hlMat.color.setHex(hintHex);
            hlMat.opacity = pulse;
          } else if (isSelectedCell) {
            hlMat.color.setHex(0x38bdf8);
            hlMat.opacity = 0.92;
          } else if (isHovered && isPieceSelected) {
            hlMat.color.setHex(preDropLinks.length > 0 ? 0xe879f9 : 0xfacc15);
            hlMat.opacity = 0.9;
          } else if (isPieceSelected || isActivelyDragging) {
            hlMat.color.setHex(0x38bdf8);
            hlMat.opacity = isActivelyDragging ? 0.34 : 0.24;
          } else {
            hlMat.opacity = 0;
          }
        }
      }

      // Update 3D Tactical Preview Group (vectors & deflection arrows) when dragging or touching a placed/tray weapon
      const activePreviewTarget =
        previewCell ??
        (tutorialGuide?.nextTarget && isPieceSelected
          ? { rail: tutorialGuide.nextTarget.rail, row: tutorialGuide.nextTarget.row }
          : selPiece
          ? { rail: 1, row: 4 }
          : null);

      if (selPiece && activePreviewTarget) {
        previewGroup.visible = true;
        previewGroup.position.set(
          gridToWorldX(activePreviewTarget.rail),
          0.14,
          gridToWorldZ(activePreviewTarget.row)
        );
        previewCones.forEach((c) => {
          c.visible = false;
        });
        previewBridgeBar.visible = false;
        previewVortexRing.visible = false;

        if (selPiece.type === 'spray_flus' || selPiece.type === 'bleach_cannon') {
          const hasScourerAhead = piecesRef.current.some(
            (p) =>
              p.type === 'scourer_nanas' &&
              p.rail === activePreviewTarget.rail &&
              (p.row === activePreviewTarget.row - 1 || p.row === activePreviewTarget.row - 2)
          );
          if (hasScourerAhead) {
            const fanAngles = [-0.55, -0.26, 0, 0.26, 0.55];
            fanAngles.forEach((ang, idx) => {
              const cone = previewCones[idx];
              cone.visible = true;
              (cone.material as THREE.MeshBasicMaterial).color.setHex(0xa3e635);
              cone.position.set(Math.sin(ang) * 1.4, 0, -1.6 - Math.cos(ang) * 0.6);
              cone.rotation.set(-Math.PI / 2, 0, -ang);
            });
          } else {
            const cone = previewCones[2];
            cone.visible = true;
            (cone.material as THREE.MeshBasicMaterial).color.setHex(0x00d2ff);
            cone.position.set(0, 0, -1.25);
            cone.rotation.set(-Math.PI / 2, 0, 0);
          }
        } else if (selPiece.type === 'scourer_nanas') {
          const fanAngles = [-0.55, -0.26, 0, 0.26, 0.55];
          fanAngles.forEach((ang, idx) => {
            const cone = previewCones[idx];
            cone.visible = true;
            (cone.material as THREE.MeshBasicMaterial).color.setHex(0xa3e635);
            cone.position.set(Math.sin(ang) * 1.15, 0, -1.1 - Math.cos(ang) * 0.45);
            cone.rotation.set(-Math.PI / 2, 0, -ang);
          });
        } else if (selPiece.type === 'aerosol_torch') {
          previewBridgeBar.visible = true;
          previewBridgeBar.position.set(0, 0.68, -0.24);
        } else if (selPiece.type === 'soap_bar') {
          const cone = previewCones[0];
          cone.visible = true;
          (cone.material as THREE.MeshBasicMaterial).color.setHex(0xf472b6);
          const dir = activePreviewTarget.rail < GRID_RAILS - 1 ? 1 : -1;
          cone.position.set(dir * 0.95, 0, 0);
          cone.rotation.set(-Math.PI / 2, 0, -dir * (Math.PI / 2));
        } else if (selPiece.type === 'mop_vortex') {
          previewVortexRing.visible = true;
          previewVortexRing.rotation.z = elapsed * 4;
        } else if (selPiece.type === 'wc_shield') {
          const cone = previewCones[2];
          cone.visible = true;
          (cone.material as THREE.MeshBasicMaterial).color.setHex(0x38bdf8);
          cone.position.set(0, 0, -1.1);
          cone.rotation.set(-Math.PI / 2, 0, 0);
        } else if (selPiece.type === 'corner_square') {
          const coneIn = previewCones[0];
          const coneDown = previewCones[1];
          coneIn.visible = true;
          coneDown.visible = true;
          (coneIn.material as THREE.MeshBasicMaterial).color.setHex(0xfacc15);
          (coneDown.material as THREE.MeshBasicMaterial).color.setHex(0x22d3ee);
          coneIn.position.set(-0.85, 0.1, 0);
          coneIn.rotation.set(-Math.PI / 2, 0, -Math.PI / 2);
          coneDown.position.set(0, 0.1, 1.05);
          coneDown.rotation.set(Math.PI / 2, 0, 0);
        }
      } else {
        previewGroup.visible = false;
      }

      // Countdown 3-second wave breather between Phase 1 -> 2 -> 3
      if (gState === 'playing' && !inPlacementPhase && prepTimer > 0) {
        prepTimer = Math.max(0, prepTimer - dt);
      }
      if (shieldWarnCooldown > 0) {
        shieldWarnCooldown = Math.max(0, shieldWarnCooldown - dt);
      }

      // Wave simulation is PAUSED during Strategic Mode (Level 4+ inPlacementPhase) and 3s inter-wave pause
      const waveSimDt = inPlacementPhase || prepTimer > 0 ? 0 : simDt;
      if (waveSimDt > 0 && combatComboWindowTimer > 0) {
        combatComboWindowTimer = Math.max(0, combatComboWindowTimer - waveSimDt);
        if (combatComboWindowTimer <= 0) combatComboStreak = 1;
      }

      if (waveSimDt > 0 && !isRushMode && stateRef.current.level >= 5 && !gameEndedLock) {
        levelTimer = Math.max(0, levelTimer - waveSimDt);
      }

      // =======================================================================
      // SURVIVAL RUSH LIVE ECONOMY, COMANDAS AL VUELO, KNIFE ROOMBA & CHAOS DIRECTOR
      // =======================================================================
      if (isRushMode && gState === 'playing' && !gameEndedLock) {
        rushElapsedSec += simDt;
        rushSupply = Math.min(
          currentRushSupplyMax,
          rushSupply + RUSH_SUPPLY_BASE_PER_SEC * rushModifiers.supplyRateMult * simDt
        );

        // Check Time-Based Rush Adrenaline Milestones (1:15 Frenesí 2 & 4:00 Overdrive)
        if (rushElapsedSec >= 75) {
          unlockRushMilestoneIfNew('rush_frenzy_2');
        }
        if (rushElapsedSec >= 240) {
          unlockRushMilestoneIfNew('rush_overdrive_4min');
          // Overdrive 4:00+: eliminate any lingering Nv.1 card from the tray immediately (preserving >= 1 Flus-Flus)!
          let upgradedTray = false;
          const mappedPieces = piecesRef.current.map((p, idx) => {
            if (p.rail === null && p.row === null && p.level === 1) {
              upgradedTray = true;
              return makeRushTrayUtensilPiece(idx % RUSH_TRAY_SLOTS, rushElapsedSec);
            }
            return p;
          });
          if (upgradedTray) {
            piecesRef.current = ensureRushTrayHasSprayFlus(mappedPieces);
            hudEmitTimer = 1.0;
          }
        }

        // Chaos Director: trigger non-pausing live event every 60s!
        const currentMinute = Math.floor(rushElapsedSec / 60);
        if (currentMinute >= 1 && currentMinute > rushAnnouncedMinute) {
          rushAnnouncedMinute = currentMinute;
          const evt = getChaosDirectorEventForMinute(currentMinute);
          if (evt) {
            soundEngine.playChaosSiren();
            stateRef.current.onComicPop({
              id: `chaos-min-${currentMinute}-${Date.now()}`,
              title: evt.title,
              subtitle: evt.subtitle,
              color: evt.color,
              createdAt: Date.now(),
            });

            if (evt.id === 'rush_hour') {
              // Min 1:00 "Hora Punta": fast XP piñata swarm!
              for (let i = 0; i < 4; i++) {
                bugs.push({
                  id: `rush-pinata-${Date.now()}-${i}`,
                  type: 'speed_ant',
                  rail: i % GRID_RAILS,
                  targetRail: i % GRID_RAILS,
                  yProgress: -0.3 - i * 0.28,
                  hp: 36,
                  maxHp: 36,
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
                });
              }
            } else if (evt.id === 'lateral_breach') {
              // Min 2:00 "Fuga Lateral": 2 immediate lateral conduit invaders!
              [-1, 1].forEach((dirSide, lIdx) => {
                const fromLeft = dirSide < 0;
                bugs.push({
                  id: `rush-lat-${Date.now()}-${lIdx}`,
                  type: 'shift_roach',
                  rail: fromLeft ? -0.75 : 3.75,
                  targetRail: fromLeft ? 1 : 2,
                  yProgress: 2 + lIdx,
                  hp: 68,
                  maxHp: 68,
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
                  isLateralInvasion: true,
                  lateralDir: fromLeft ? 1 : -1,
                  redirectedBySquare: false,
                });
              });
            } else if (evt.id === 'boss_invasion') {
              // Min 3:00 "Invasión de Jefe": Grand Boss WITHOUT stopping regular spawns!
              bugs.push({
                id: `rush-grandboss-3m-${Date.now()}`,
                type: 'king_crab',
                rail: 1,
                targetRail: 1,
                yProgress: -0.35,
                hp: 540,
                maxHp: 540,
                hasShield: true,
                isSlidingFromSoap: false,
                hitByDiagonalFoam: false,
                hitByBridgeBurn: false,
                hitByVortexSpin: false,
                slowTimer: 0,
                flashTimer: 0,
                attackWindup: 0,
                koTimer: 0,
                koStar: 3,
                isPuzzleBoss: true,
                bossTier: 'grand',
                bossPuzzleType: 'uv_overheat',
                bossPhase: 1,
                bossArmorBroken: false,
                bossEvadeTimer: 2.5,
                bossFrenzyTriggered: false,
                bossPhaseFlashTimer: 0,
                bossStunTimer: 0,
              });
            }
          }
        }

        // Roll 3 translucent Live Comandas when XP fills (ZERO PAUSE!)
        if (!activeComandas && rushXp >= rushXpNext) {
          rushXp = Math.max(0, rushXp - rushXpNext);
          rushLevel += 1;
          rushXpNext = Math.round(55 + rushLevel * 24);
          const curPool = buildActiveRushPool({
            elapsedSeconds: rushElapsedSec,
            unlockedMilestones: Array.from(rushSessionMilestones),
            vetoedTypes: rushModifiers.vetoedTypes,
          });
          activeComandas = rollLiveComandaTriplet({
            intactPlates,
            activePool: curPool,
            roombaActive: patrolRoombaActive,
          });
          comandaTimer = COMANDA_AUTO_PICK_SECONDS;
          soundEngine.playMergeUpgrade(2);
          hudEmitTimer = 1.0;
        }

        // Tick 6.0s Comanda auto-equip timer or apply user tap immediately!
        if (activeComandas) {
          comandaTimer = Math.max(0, comandaTimer - wallDt);
          const requestedIdx = stateRef.current.pickComandaIndexRef?.current;
          let chosenIdx: number | null = null;
          if (requestedIdx !== null && requestedIdx !== undefined && requestedIdx >= 0 && requestedIdx <= 2) {
            chosenIdx = requestedIdx;
            if (stateRef.current.pickComandaIndexRef) {
              stateRef.current.pickComandaIndexRef.current = null;
            }
          } else if (comandaTimer <= 0) {
            // Auto-equips center ticket (#1) after 6s if untouched!
            chosenIdx = 1;
          }

          if (chosenIdx !== null) {
            const chosen = activeComandas[chosenIdx];
            activeComandas = null;
            comandaTimer = 0;
            rushComandasPicked += 1;
            soundEngine.playMergeUpgrade(3);

            if (chosen.effectId === 'double_nozzle') {
              rushModifiers.doubleNozzle += 1;
            } else if (chosen.effectId === 'wall_ricochet') {
              rushModifiers.wallRicochet = true;
            } else if (chosen.effectId === 'crit_foam') {
              rushModifiers.damageMult = Number((rushModifiers.damageMult * 1.35).toFixed(2));
            } else if (chosen.effectId === 'electro_tiles') {
              rushModifiers.electroTiles = true;
            } else if (chosen.effectId === 'upgrade_random_tower') {
              const upgradable = piecesRef.current.filter(
                (p) => p.rail !== null && p.row !== null && p.level < 3 && !p.evolutionId
              );
              if (upgradable.length > 0) {
                const targetTower = upgradable[Math.floor(Math.random() * upgradable.length)];
                targetTower.level += 1;
                if (targetTower.rail !== null && targetTower.row !== null) {
                  spawnParticles(
                    gridToWorldX(targetTower.rail),
                    0.55,
                    gridToWorldZ(targetTower.row),
                    18,
                    0xfacc15,
                    3.0
                  );
                }
              } else {
                rushSupply = currentRushSupplyMax;
              }
            } else if (chosen.effectId === 'deploy_roomba') {
              patrolRoombaActive = true;
            } else if (chosen.effectId === 'supply_boost') {
              rushModifiers.supplyRateMult = Number((rushModifiers.supplyRateMult * 1.3).toFixed(2));
              rushSupply = currentRushSupplyMax;
            } else if (chosen.effectId === 'veto_weapon' && chosen.vetoTarget) {
              if (!rushModifiers.vetoedTypes.includes(chosen.vetoTarget)) {
                rushModifiers.vetoedTypes = [...rushModifiers.vetoedTypes, chosen.vetoTarget];
              }
              // Replace any vetoed weapon currently sitting in the 4 rotating tray slots (preserving >= 1 Flus-Flus)!
              piecesRef.current = ensureRushTrayHasSprayFlus(
                piecesRef.current.map((p, idx) =>
                  p.rail === null && p.type === chosen.vetoTarget
                    ? makeRushTrayUtensilPiece(idx % RUSH_TRAY_SLOTS, rushElapsedSec)
                    : p
                )
              );
            } else if (chosen.effectId === 'pact_sacrifice_plate') {
              const sacIdx = intactPlates.findIndex(Boolean);
              if (sacIdx >= 0 && intactPlates.filter(Boolean).length >= 2) {
                intactPlates[sacIdx] = false;
                sanitationSeals = Math.max(1, sanitationSeals - 1);
                const plateGroup = kitchenProps.bastionPlates[sacIdx];
                const food = plateGroup?.getObjectByName('food_content');
                if (food) food.visible = false;
              }
              rushModifiers.fireRateMult = Number((rushModifiers.fireRateMult * 1.5).toFixed(2));
            } else if (chosen.effectId === 'pact_frenzy_xp') {
              rushModifiers.chaosSpeedMult = Number((rushModifiers.chaosSpeedMult * 1.2).toFixed(2));
              rushModifiers.xpMult = Number((rushModifiers.xpMult * 2.0).toFixed(2));
            } else if (chosen.effectId === 'regen_plate') {
              const brokenIdx = intactPlates.findIndex((ok) => !ok);
              if (brokenIdx >= 0) {
                intactPlates[brokenIdx] = true;
                sanitationSeals = Math.min(3, sanitationSeals + 1);
                const plateGroup = kitchenProps.bastionPlates[brokenIdx];
                const food = plateGroup?.getObjectByName('food_content');
                if (food) food.visible = true;
                spawnParticles(gridToWorldX(brokenIdx), 0.55, 4.18, 18, 0x4ade80, 2.8);
              } else {
                armoredPlates += 1;
              }
            }

            stateRef.current.onFloatingCombo?.({
              id: `comanda-pick-${Date.now()}`,
              multiplier: rushLevel,
              label: `${chosen.icon} ${chosen.title.toUpperCase()}`,
              detail: '¡Comanda Equipada al Vuelo!',
              color:
                chosen.color === 'red'
                  ? 'pink'
                  : chosen.color === 'green'
                  ? 'green'
                  : chosen.color === 'blue'
                  ? 'cyan'
                  : 'yellow',
              xPct: 50,
              yPct: 28,
              createdAt: Date.now(),
            });
            hudEmitTimer = 1.0;
          }
        }

        // Autonomous Horizontal Patrol: "Roomba Kamikaze con Cuchillos" right in front of the 4 gourmet plates!
        knifeRoombaMesh.visible = patrolRoombaActive;
        if (patrolRoombaActive && waveSimDt > 0) {
          patrolRoombaX += patrolRoombaDir * 3.4 * waveSimDt;
          if (patrolRoombaX > 2.35) {
            patrolRoombaX = 2.35;
            patrolRoombaDir = -1;
          } else if (patrolRoombaX < -2.35) {
            patrolRoombaX = -2.35;
            patrolRoombaDir = 1;
          }
          knifeRoombaMesh.position.set(patrolRoombaX, 0.04, 3.55);
          const blades = knifeRoombaMesh.getObjectByName('anim_blades');
          if (blades) {
            blades.rotation.y += dt * 22;
          }
          patrolRoombaSliceCd = Math.max(0, patrolRoombaSliceCd - waveSimDt);
          if (patrolRoombaSliceCd <= 0) {
            const roombaRail = patrolRoombaX / RAIL_SPACING + (GRID_RAILS - 1) / 2;
            let slicedAny = false;
            for (const b of bugs) {
              if (b.koTimer > 0) continue;
              if (b.yProgress >= 5.15 && Math.abs(b.rail - roombaRail) <= 0.68) {
                b.hasShield = false;
                b.hp -= 62 * rushModifiers.damageMult;
                b.flashTimer = 0.1;
                if (!b.bossTier) {
                  b.yProgress = Math.max(1.0, b.yProgress - 1.15);
                }
                slicedAny = true;
                spawnParticles(gridToWorldX(b.rail), 0.45, 3.55, 10, 0xef4444, 2.8);
              }
            }
            if (slicedAny) {
              patrolRoombaSliceCd = 0.28;
              soundEngine.playShieldClink();
            }
          }
        }
      } else {
        knifeRoombaMesh.visible = false;
      }

      // Sync 3D Utensil Meshes on the board (rebuilds mesh automatically when level 1->2->3 or Supreme Evolution 4!)
      const activePieceIds = new Set<string>();
      for (const piece of piecesRef.current) {
        if (piece.rail === null || piece.row === null) continue;
        activePieceIds.add(piece.id);

        let entry = utensilMeshes.get(piece.id);
        if (
          !entry ||
          entry.type !== piece.type ||
          entry.level !== piece.level ||
          entry.evolutionId !== piece.evolutionId
        ) {
          if (entry) {
            utensilsGroup.remove(entry.group);
            disposeObjectTree(entry.group);
          }
          const group = buildUtensilMesh(
            piece.type,
            isSoftwareGl,
            piece.level,
            piece.evolutionId
          );
          utensilsGroup.add(group);
          entry = {
            group,
            type: piece.type,
            level: piece.level,
            evolutionId: piece.evolutionId,
            bounce: 0.9,
          };
          utensilMeshes.set(piece.id, entry);
        }

        const targetX = gridToWorldX(piece.rail);
        const targetZ = gridToWorldZ(piece.row);
        const isBeingDragged = piece.id === activePieceId && isActivelyDragging;
        entry.bounce = Math.max(0, entry.bounce - dt * 4.5);
        const bounceY = Math.sin(entry.bounce * Math.PI) * 0.35;

        const targetY = isBeingDragged ? 0.38 : bounceY;
        entry.group.position.x = THREE.MathUtils.damp(entry.group.position.x, targetX, 18, dt);
        entry.group.position.y = THREE.MathUtils.damp(entry.group.position.y, targetY, 18, dt);
        entry.group.position.z = THREE.MathUtils.damp(entry.group.position.z, targetZ, 18, dt);

        const gunkOverlay = entry.group.getObjectByName('gunk_overlay');
        if (gunkOverlay) gunkOverlay.visible = piece.gunkTimer > 0;

        const animPart = entry.group.getObjectByName('anim_part');
        if (animPart) {
          if (piece.evolutionId === 'centrifuge_vortex') {
            animPart.rotation.y += dt * 24;
          } else if (piece.evolutionId === 'ricochet_washer') {
            animPart.rotation.z += dt * 20;
          } else if (piece.evolutionId === 'tesla_sanitary_coil') {
            animPart.rotation.y += dt * 9;
            animPart.rotation.x += dt * 6;
          } else if (piece.evolutionId === 'plasma_uv_cannon') {
            animPart.scale.setScalar(0.95 + Math.sin(elapsed * 16) * 0.12);
          } else if (piece.type === 'mop_vortex') {
            animPart.rotation.y += dt * (piece.comboType === 'slip_vortex' ? 18 : 10);
          } else if (piece.type === 'aerosol_torch') {
            animPart.visible = piece.comboType !== 'bridge_uv';
            animPart.rotation.y += dt * 4.5;
          } else if (piece.type === 'scourer_nanas') {
            animPart.rotation.y += dt * 3.5;
          }
        }

        if (isRushMode) {
          if (waveSimDt > 0 && piece.wearRemaining !== undefined && piece.depleteTimer === undefined) {
            const wear = tickRushWear(piece, waveSimDt);
            piece.wearRemaining = wear.piece.wearRemaining;
            if (wear.wornOut) {
              piece.comboType = 'none';
              piece.depleteTimer = wear.piece.depleteTimer;
              hudEmitTimer = 1.0;
            }
          }
          updateWearRing(entry.group, piece.depleteTimer === undefined ? getRushWearFraction(piece) : null);
        }

        if (isRushMode && piece.depleteTimer !== undefined) {
          const dep = tickDepletingAerosol(piece, waveSimDt);
          piece.depleteTimer = dep.piece.depleteTimer;
          entry.group.visible = dep.blinkVisible;
          entry.group.scale.setScalar(dep.blinkVisible ? 0.94 : 0.82);
          if (dep.expired && waveSimDt > 0) {
            soundEngine.playShieldClink();
            spawnParticles(targetX, 0.45, targetZ, 12, 0x94a3b8, 2.2);
            activePieceIds.delete(piece.id);
            piecesRef.current = piecesRef.current.filter((p) => p.id !== piece.id);
            if (selectedPieceIdRef.current === piece.id) {
              selectedPieceIdRef.current = null;
              setInspectionTarget(null);
            }
            hudEmitTimer = 1.0;
          }
          continue;
        } else {
          entry.group.visible = true;
          entry.group.scale.setScalar(1);
        }

        if (waveSimDt > 0) {
          if (piece.gunkTimer > 0) {
            piece.gunkTimer = Math.max(0, piece.gunkTimer - waveSimDt);
            continue;
          }
          if (piece.cooldown > 0) {
            piece.cooldown = Math.max(0, piece.cooldown - waveSimDt);
            continue;
          }

          if (
            isRushMode &&
            piece.type === 'aerosol_torch' &&
            !piece.evolutionId &&
            piece.comboType === 'bridge_uv'
          ) {
            drainRushAerosolInPlace(piece, 0.45 * waveSimDt);
            if (piece.depleteTimer !== undefined) {
              hudEmitTimer = 1.0;
              continue;
            }
          }

          // ===================================================================
          // 1. SUPREME EVOLUTIONS (Level 4 Super-Turrets in 1 single tile!)
          // ===================================================================
          if (piece.evolutionId) {
            const rushRate = isRushMode ? rushModifiers.fireRateMult : 1.0;
            const rushDmg = isRushMode ? rushModifiers.damageMult : 1.0;

            if (piece.evolutionId === 'centrifuge_vortex') {
              // Continuous pull from neighboring rails + high spin shred + periodic backward spit!
              stampChemTile(piece.rail, piece.row, 'wet_soap');
              for (const b of bugs) {
                if (b.koTimer > 0) continue;
                if (
                  Math.abs(b.rail - piece.rail) <= 1.38 &&
                  Math.abs(b.yProgress - piece.row) <= 1.32
                ) {
                  b.targetRail = piece.rail;
                  b.rail = THREE.MathUtils.damp(b.rail, piece.rail, 7, waveSimDt);
                  b.hitByVortexSpin = true;
                  b.isSlidingFromSoap = true;
                  b.wetTimer = Math.max(b.wetTimer ?? 0, 2.5);
                  b.slowTimer = Math.max(b.slowTimer, 1.8);
                  b.hasShield = false;
                  b.hp -= 135 * rushDmg * waveSimDt;
                }
              }
              piece.fireTimer -= waveSimDt * rushRate;
              if (piece.fireTimer <= 0) {
                piece.fireTimer = 1.05;
                for (const b of bugs) {
                  if (
                    b.koTimer <= 0 &&
                    !b.bossTier &&
                    Math.abs(b.rail - piece.rail) <= 0.85 &&
                    Math.abs(b.yProgress - piece.row) <= 1.15
                  ) {
                    b.yProgress = Math.max(-0.1, b.yProgress - 1.35);
                  }
                }
                for (let dIdx = 0; dIdx < 6; dIdx++) {
                  const ang = (dIdx / 6) * Math.PI * 2 + elapsed * 3;
                  projectiles.push({
                    id: `evo-vort-${piece.id}-${dIdx}-${Date.now()}`,
                    x: piece.rail,
                    y: piece.row,
                    vx: Math.cos(ang) * 3.1,
                    vy: Math.sin(ang) * 3.1,
                    damage: Math.round(28 * rushDmg),
                    isEnemy: false,
                    flavor: 'vortex_soap',
                    pierceShield: true,
                    fromDiagonalFoam: false,
                    fromVortex: true,
                    life: 0.9,
                  });
                }
              }
              continue;
            }

            if (piece.evolutionId === 'plasma_uv_cannon') {
              piece.fireTimer -= waveSimDt * rushRate * liveMenuBuffs.thermalRateMult;
              if (piece.fireTimer <= 0) {
                piece.fireTimer = 0.88;
                soundEngine.playChainShock();
                spawnParticles(targetX, 0.55, targetZ - 0.2, 8, 0xe879f9, 2.8);
                projectiles.push({
                  id: `evo-plasma-${piece.id}-${Date.now()}`,
                  x: piece.rail,
                  y: piece.row - 0.3,
                  vx: 0,
                  vy: -5.4,
                  damage: Math.round(54 * rushDmg * liveMenuBuffs.frontalDamageMult),
                  isEnemy: false,
                  flavor: 'plasma_wave',
                  pierceShield: true,
                  isExplosiveOrThermal: true,
                  fromDiagonalFoam: true,
                  fromVortex: false,
                  aoeRadius: 1.15,
                  life: 1.8,
                });
              }
              continue;
            }

            if (piece.evolutionId === 'ricochet_washer') {
              piece.fireTimer -= waveSimDt * rushRate;
              if (piece.fireTimer <= 0) {
                piece.fireTimer = 0.25;
                soundEngine.playSprayShot();
                const spreadSign = Math.sin(elapsed * 19 + piece.rail) >= 0 ? 1 : -1;
                projectiles.push({
                  id: `evo-rico-${piece.id}-${Date.now()}-${Math.random()}`,
                  x: piece.rail,
                  y: piece.row - 0.28,
                  vx: spreadSign * 3.4,
                  vy: -6.2,
                  damage: Math.round(26 * rushDmg * liveMenuBuffs.frontalDamageMult),
                  isEnemy: false,
                  flavor: 'ricochet_jet',
                  pierceShield: true,
                  fromDiagonalFoam: true,
                  fromVortex: false,
                  bouncesLeft: 4,
                  life: 2.8,
                });
              }
              continue;
            }

            if (piece.evolutionId === 'tesla_sanitary_coil') {
              piece.fireTimer -= waveSimDt * rushRate * liveMenuBuffs.thermalRateMult;
              if (piece.fireTimer <= 0) {
                piece.fireTimer = 0.78;
                const candidates = bugs
                  .filter((b) => b.koTimer <= 0 && b.yProgress > -0.2)
                  .sort(
                    (a, b) =>
                      Math.hypot(a.rail - piece.rail!, a.yProgress - piece.row!) -
                      Math.hypot(b.rail - piece.rail!, b.yProgress - piece.row!)
                  )
                  .slice(0, 4);
                if (candidates.length > 0) {
                  soundEngine.playChainShock();
                  spawnParticles(targetX, 0.95, targetZ, 8, 0xa855f7, 2.5);
                  for (const tgt of candidates) {
                    tgt.hasShield = false;
                    tgt.bossArmorBroken = true;
                    tgt.hitByBridgeBurn = true;
                    tgt.hp -= 44 * rushDmg * liveMenuBuffs.thermalRateMult;
                    tgt.flashTimer = 0.1;
                    spawnParticles(
                      gridToWorldX(tgt.rail),
                      0.55,
                      gridToWorldZ(tgt.yProgress),
                      9,
                      0xe879f9,
                      2.8
                    );
                  }
                }
              }
              continue;
            }

            if (piece.evolutionId === 'foam_mortar') {
              piece.fireTimer -= waveSimDt * rushRate;
              if (piece.fireTimer <= 0) {
                piece.fireTimer = 1.32;
                // Aim parabolic shell at the densest live bug cluster (or center rail ahead)
                let bestTarget: BugEnemy | null = null;
                let bestClusterScore = -1;
                for (const b of bugs) {
                  if (b.koTimer > 0 || b.yProgress < -0.1) continue;
                  let count = 0;
                  for (const other of bugs) {
                    if (
                      other.koTimer <= 0 &&
                      Math.abs(other.rail - b.rail) <= 1.2 &&
                      Math.abs(other.yProgress - b.yProgress) <= 1.2
                    ) {
                      count += 1;
                    }
                  }
                  if (count > bestClusterScore) {
                    bestClusterScore = count;
                    bestTarget = b;
                  }
                }
                const aimX = bestTarget ? bestTarget.rail : piece.rail;
                const aimY = bestTarget ? Math.max(0.4, bestTarget.yProgress) : Math.max(0.8, piece.row - 2.4);
                const flightT = 0.55;
                soundEngine.playFoamSplit();
                projectiles.push({
                  id: `evo-mortar-${piece.id}-${Date.now()}`,
                  x: piece.rail,
                  y: piece.row - 0.2,
                  vx: (aimX - piece.rail) / flightT,
                  vy: (aimY - (piece.row - 0.2)) / flightT,
                  damage: Math.round(68 * rushDmg),
                  isEnemy: false,
                  flavor: 'mortar_shell',
                  pierceShield: true,
                  isExplosiveOrThermal: true,
                  fromDiagonalFoam: true,
                  fromVortex: true,
                  aoeRadius: 1.35,
                  life: flightT,
                });
              }
              continue;
            }
          }

          // ===================================================================
          // 2. STANDARD WEAPONS SCALED BY MERGE LEVEL (Nv.1 -> Nv.2 Plata -> Nv.3 Oro)
          // ===================================================================
          const tierRateMult = piece.level >= 3 ? 1.95 : piece.level === 2 ? 1.45 : 1.0;
          const tierDmgMult = piece.level >= 3 ? 1.85 : piece.level === 2 ? 1.4 : 1.0;
          const rushRate = isRushMode ? rushModifiers.fireRateMult : 1.0;
          const rushDmg = isRushMode ? rushModifiers.damageMult : 1.0;

          piece.fireTimer -= waveSimDt * tierRateMult * rushRate;
          const isInCombo = piece.comboType !== 'none';
          const baseFireInterval =
            piece.type === 'spray_flus'
              ? (isInCombo ? COMBAT.flus.comboInterval : isRushMode ? COMBAT.flus.rushInterval : COMBAT.flus.interval) /
                (stateRef.current.hatId === 'duck_shower_cap' ? 1.15 : 1.0)
              : piece.type === 'bleach_cannon'
              ? (isInCombo ? 0.85 : 1.55) / liveMenuBuffs.thermalRateMult
              : piece.type === 'mop_vortex'
              ? isInCombo
                ? COMBAT.mop.comboInterval
                : COMBAT.mop.interval
              : piece.type === 'aerosol_torch' && !isInCombo && (isRushMode || piece.level >= 2)
              ? (isRushMode && piece.level === 1 ? 1.45 : 1.25) / liveMenuBuffs.thermalRateMult
              : 999;

          if (piece.fireTimer <= 0 && baseFireInterval < 100) {
            piece.fireTimer = baseFireInterval;

            if (piece.type === 'spray_flus' || piece.type === 'bleach_cannon') {
              soundEngine.playSprayShot();
              if (piece.type === 'spray_flus') {
                spawnForwardSprayMist(targetX, 0.52, targetZ);
              }
              const rawDmg =
                piece.type === 'bleach_cannon' ? 30 : isInCombo ? COMBAT.flus.comboDamage : COMBAT.flus.damage;
              const shotCount =
                1 +
                (piece.level >= 3 ? 1 : 0) +
                (isRushMode && rushModifiers.doubleNozzle > 0 ? 1 : 0);
              for (let sIdx = 0; sIdx < shotCount; sIdx++) {
                const offsetX =
                  shotCount === 1 ? 0 : (sIdx - (shotCount - 1) / 2) * 0.22;
                projectiles.push({
                  id: `proj-${piece.id}-${sIdx}-${Date.now()}-${Math.random()}`,
                  x: piece.rail + offsetX,
                  y: piece.row - 0.25,
                  vx: offsetX * 0.55,
                  vy: -COMBAT.flus.speed,
                  damage: Math.round(rawDmg * tierDmgMult * rushDmg * liveMenuBuffs.frontalDamageMult),
                  isEnemy: false,
                  flavor: piece.type === 'bleach_cannon' ? 'bleach_glob' : 'water_drop',
                  pierceShield: piece.level >= 3,
                  isExplosiveOrThermal: piece.type === 'bleach_cannon',
                  fromDiagonalFoam: false,
                  fromVortex: false,
                  bouncesLeft: isRushMode && rushModifiers.wallRicochet ? 2 : 0,
                  life: COMBAT.flus.life,
                });
              }
            } else if (piece.type === 'mop_vortex') {
              stampChemTile(piece.rail, piece.row, 'wet_soap');
              const dirs = (isInCombo ? COMBAT.mop.comboShots : COMBAT.mop.shots) + (piece.level >= 2 ? 2 : 0);
              for (let dIdx = 0; dIdx < dirs; dIdx++) {
                const ang = (dIdx / dirs) * Math.PI * 2 + elapsed * 2;
                projectiles.push({
                  id: `proj-vortex-${piece.id}-${dIdx}-${Date.now()}`,
                  x: piece.rail,
                  y: piece.row,
                  vx: Math.cos(ang) * COMBAT.mop.speed,
                  vy: Math.sin(ang) * COMBAT.mop.speed,
                  damage: Math.round((isInCombo ? COMBAT.mop.comboDamage : COMBAT.mop.damage) * tierDmgMult * rushDmg),
                  isEnemy: false,
                  flavor: 'vortex_soap',
                  pierceShield: true,
                  fromDiagonalFoam: false,
                  fromVortex: true,
                  life: COMBAT.mop.life,
                });
              }
            } else if (piece.type === 'aerosol_torch') {
              // Aerosol UV emits a short violet pulse ahead (and spends 1 charge in Rush!)
              projectiles.push({
                id: `proj-uvsolo-${piece.id}-${Date.now()}`,
                x: piece.rail,
                y: piece.row - 0.25,
                vx: 0,
                vy: -5.2,
                damage: Math.round(22 * tierDmgMult * rushDmg),
                isEnemy: false,
                flavor: 'plasma_wave',
                pierceShield: true,
                isExplosiveOrThermal: true,
                fromDiagonalFoam: false,
                fromVortex: false,
                aoeRadius: 0.55,
                life: 0.75,
              });
              if (isRushMode) {
                drainRushAerosolInPlace(piece, 1);
                hudEmitTimer = 1.0;
              }
            }
          }
        }
      }

      for (const [id, entry] of utensilMeshes.entries()) {
        if (!activePieceIds.has(id)) {
          utensilsGroup.remove(entry.group);
          disposeObjectTree(entry.group);
          utensilMeshes.delete(id);
        }
      }

      // Ensure Milestone Mini-Boss (X5) or Grand Boss (X0) spawns reliably when Phase 3 begins in Strategic Mode!
      if (
        !isRushMode &&
        !activeScript &&
        waveSimDt > 0 &&
        phase === 3 &&
        !bossSpawnedForLevel &&
        getBossTierForLevel(stateRef.current.level) !== null
      ) {
        spawnBossForMilestone(stateRef.current.level);
      }

      // Spawn new bugs according to Rush Chaos Director OR Strategic Level & Phase
      const ventsClosed = isRushMode
        ? false
        : waveQuotaCompleted || (stateRef.current.level >= 5 && !activeScript && levelTimer <= 0);
      if (waveSimDt > 0 && !gameEndedLock && isRushMode) {
        // Supervivencia: oleadas concentradas en 1-2 carriles y avisadas 3 s antes (no carriles al azar).
        const waveTick = tickRushWaveDirector(rushWaves, waveSimDt, rushElapsedSec, {
          canSpawn: bugs.length < rushDirector.maxConcurrentBugs,
          paceMult: rushDirector.spawnIntervalSec / 2.5,
        });
        rushWaves = waveTick.state;
        rushWaveWarning = waveTick.warning;
        if (waveTick.announced) announceRushWave(waveTick.announced);
        for (const spawn of waveTick.spawns) {
          spawnRushBug(spawn.rail, spawn.type, rushDirector);
        }
      }

      if (waveSimDt > 0 && !gameEndedLock && !isRushMode && activeScript) {
        // Guion fijo: cada bicho sale en su segundo y carril; la fase del HUD avanza por tercios del guion.
        scriptClock += waveSimDt;
        const due = takeDueScriptSpawns(activeScript, scriptCursor, scriptClock);
        scriptCursor = due.cursor;
        for (const sp of due.spawns) {
          if (sp.boss) {
            spawnBossForMilestone(stateRef.current.level, { ...sp.boss, rail: sp.rail });
            continue;
          }
          const maxHp = STRATEGIC_BUG_BASE_HP[sp.type];
          bugs.push({
            id: `bug-s${stateRef.current.level}-${scriptCursor}-${Date.now()}-${Math.random()}`,
            type: sp.type,
            rail: sp.rail,
            targetRail: sp.rail,
            yProgress: -0.35,
            hp: maxHp,
            maxHp,
            hasShield: sp.type === 'cap_beetle' || sp.type === 'king_crab',
            isSlidingFromSoap: false,
            hitByDiagonalFoam: false,
            hitByBridgeBurn: false,
            hitByVortexSpin: false,
            slowTimer: 0,
            flashTimer: 0,
            attackWindup: 0,
            koTimer: 0,
            koStar: 1,
            isLateralInvasion: false,
            lateralDir: 0,
            redirectedBySquare: false,
            ...(sp.type === 'shift_roach'
              ? { roachShiftTimer: ROACH_SHIFT_INTERVAL_SEC, roachShiftDir: sp.dir ?? (sp.rail <= 1 ? 1 : -1) }
              : {}),
            ...(sp.type === 'acid_wasp' ? { isFlying: true } : {}),
          });
        }
        phase = getScriptPhase(activeScript, scriptCursor);
        if (scriptCursor >= activeScript.spawns.length) waveQuotaCompleted = true;
      }

      if (waveSimDt > 0 && !gameEndedLock && !ventsClosed && !isRushMode && !activeScript) {
        spawnTimer -= waveSimDt;
        const maxBugsOnScreen = stateRef.current.level <= 3 ? 3 : 5;
        if (spawnTimer <= 0 && bugs.length < maxBugsOnScreen) {
          spawnTimer =
            stateRef.current.level <= 3 ? 3.4 : Math.max(2.1, 3.0 - stateRef.current.level * 0.1);

          const lvl = stateRef.current.level;
          const rail =
            lvl === 1
              ? Math.random() < 0.5
                ? 1
                : 2
              : lvl === 2
              ? Math.random() < 0.5
                ? 1
                : 2
              : lvl === 3
              ? Math.random() < 0.65
                ? 2
                : 1
              : Math.floor(Math.random() * GRID_RAILS);

          let bType: BugType = 'speed_ant';
          const roll = Math.random();

          if (lvl === 1) {
            bType = 'speed_ant';
          } else if (lvl === 2) {
            bType = roll < 0.7 ? 'cap_beetle' : 'speed_ant';
          } else if (lvl === 3) {
            bType = roll < 0.65 ? 'cap_beetle' : 'speed_ant';
          } else if (phase === 1) {
            bType = roll < 0.55 ? 'speed_ant' : 'cap_beetle';
          } else if (phase === 2) {
            bType = roll < 0.45 ? 'cap_beetle' : roll < 0.78 ? 'acid_wasp' : 'speed_ant';
          } else {
            bType =
              roll < 0.18 && getBossTierForLevel(lvl) === null
                ? 'king_crab'
                : roll < 0.55
                ? 'cap_beetle'
                : roll < 0.82
                ? 'acid_wasp'
                : 'shift_roach';
          }

          const maxHp = BUG_BASE_HP[bType] * (1 + Math.max(0, lvl - 3) * 0.08);

          const isLateralSpawn =
            lvl === 31
              ? Math.random() < 0.72
              : lvl >= 32
              ? Math.random() < 0.45
              : false;
          const lateralFromLeft = lvl === 31 ? true : Math.random() < 0.5;
          const lateralRow = lvl === 31 ? 2 : 2 + Math.floor(Math.random() * 2);

          bugs.push({
            id: `bug-${Date.now()}-${Math.random()}`,
            type: bType,
            rail: isLateralSpawn ? (lateralFromLeft ? -0.75 : 3.75) : rail,
            targetRail: rail,
            yProgress: isLateralSpawn ? lateralRow : -0.35,
            hp: maxHp,
            maxHp,
            hasShield: bType === 'cap_beetle' || bType === 'king_crab',
            isSlidingFromSoap: false,
            hitByDiagonalFoam: false,
            hitByBridgeBurn: false,
            hitByVortexSpin: false,
            slowTimer: 0,
            flashTimer: 0,
            attackWindup: 0,
            koTimer: 0,
            koStar: 1,
            isLateralInvasion: isLateralSpawn,
            lateralDir: isLateralSpawn ? (lateralFromLeft ? 1 : -1) : 0,
            redirectedBySquare: false,
          });
        }
      }

      // Helper for real-time 3-phase Grand Boss transitions (66% and 33%) with 60ms physical freeze & 300ms visual flash!
      const evaluateGrandBossTransition = (bug: BugEnemy) => {
        if (bug.bossTier !== 'grand' || bug.hp <= 0) return;
        const nextPhase = getGrandBossPhase(bug.hp, bug.maxHp);
        const prevPhase = bug.bossPhase ?? 1;
        if (nextPhase <= prevPhase) return;

        bug.bossPhase = nextPhase;
        bug.bossArmorBroken = true;
        bug.hasShield = false;
        bug.bossPhaseFlashTimer = BOSS_PHASE_BREAK_FLASH_SECONDS; // 300ms visual flash
        hitstopTimer = BOSS_PHASE_BREAK_HITSTOP_SECONDS;          // 60ms physical hitstop (never feels like FPS lag!)
        cameraTrauma = 0.85;
        soundEngine.triggerHaptic('heavy');
        soundEngine.playStarKill(3);
        spawnParticles(
          gridToWorldX(bug.rail),
          0.75,
          gridToWorldZ(bug.yProgress),
          26,
          nextPhase === 2 ? 0xe879f9 : 0xef4444,
          3.5
        );

        if (nextPhase === 2) {
          // Phase 2: Sabotage & Evasion (shift rail + start acid sabotage loop)
          const curR = THREE.MathUtils.clamp(Math.round(bug.rail), 0, GRID_RAILS - 1);
          bug.targetRail = curR < GRID_RAILS - 1 ? curR + 1 : curR - 1;
          bug.bossEvadeTimer = 2.2;
          stateRef.current.onComicPop({
            id: `boss-p2-${bug.id}-${Date.now()}`,
            title: '⚡ ¡CORAZA ROTA · FASE 2/3!',
            subtitle: 'Sabotaje Ácido y Evasión · ¡Frénalo con 🧼+🌪️ o 🛡️!',
            color: 'pink',
            createdAt: Date.now(),
          });
        } else if (nextPhase === 3) {
          // Phase 3: Frenzy (+30% speed) & Level 30+ Lateral Ambush / Fast Escorts
          stateRef.current.onComicPop({
            id: `boss-p3-${bug.id}-${Date.now()}`,
            title: '🔥 ¡FRENESÍ FINAL · FASE 3/3!',
            subtitle:
              stateRef.current.level >= 30
                ? '+30% Velocidad y Emboscada Lateral · ¡Usa 📐 o Ultimate!'
                : '+30% Velocidad · ¡Remátalo con Ultimate o Combos!',
            color: 'orange',
            createdAt: Date.now(),
          });
          if (stateRef.current.level >= 30 && !bug.bossFrenzyTriggered) {
            bug.bossFrenzyTriggered = true;
            const lvl = stateRef.current.level;
            const escortHp = 48 * (1 + Math.max(0, lvl - 3) * 0.06);
            bugs.push(
              {
                id: `boss-escort-lat-${Date.now()}`,
                type: 'shift_roach',
                rail: -0.7,
                targetRail: 1,
                yProgress: 2.0,
                hp: escortHp,
                maxHp: escortHp,
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
                isLateralInvasion: true,
                lateralDir: 1,
                redirectedBySquare: false,
              },
              {
                id: `boss-escort-fast-${Date.now()}`,
                type: 'speed_ant',
                rail: bug.rail < 2 ? 3 : 0,
                targetRail: bug.rail < 2 ? 3 : 0,
                yProgress: -0.2,
                hp: escortHp * 0.85,
                maxHp: escortHp * 0.85,
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
              }
            );
          }
        }
      };

      // Emergent Chemistry Helper: Thermal Shock ("Choque Térmico") when slowed/chilled bug takes fire/thermal/UV damage
      const triggerThermalShockIfEligible = (targetBug: BugEnemy) => {
        const shock = computeThermalShockResult(targetBug, bugs, isColdEnvironment);
        if (!shock.triggered) return;
        targetBug.thermalShockCooldown = 1.25;
        targetBug.hasShield = false;
        targetBug.bossArmorBroken = true;
        targetBug.flashTimer = Math.max(targetBug.flashTimer, ENEMY_WHITE_FLASH_SECONDS);
        hitstopTimer = Math.max(hitstopTimer, HEAVY_IMPACT_HITSTOP_SECONDS);
        targetBug.hp -= shock.bonusCarapaceDamage;
        evaluateGrandBossTransition(targetBug);

        for (const shrapnelId of shock.shrapnelTargetIds) {
          const neighbor = bugs.find((b) => b.id === shrapnelId && b.koTimer <= 0);
          if (neighbor) {
            neighbor.hasShield = false;
            neighbor.hp -= 26;
            neighbor.flashTimer = 0.1;
            spawnParticles(
              gridToWorldX(neighbor.rail),
              0.5,
              gridToWorldZ(neighbor.yProgress),
              10,
              0xf97316,
              2.8
            );
            evaluateGrandBossTransition(neighbor);
          }
        }

        soundEngine.playChainShock();
        spawnParticles(
          gridToWorldX(targetBug.rail),
          0.6,
          gridToWorldZ(targetBug.yProgress),
          18,
          0x38bdf8,
          3.4
        );
        const shockPos = projectWorldToScreenPct(
          gridToWorldX(targetBug.rail),
          0.9,
          gridToWorldZ(targetBug.yProgress)
        );
        stateRef.current.onFloatingCombo?.({
          id: `thermal-shock-${targetBug.id}-${Date.now()}`,
          multiplier: 2,
          label: '💥 ¡CHOQUE TÉRMICO!',
          detail: '+50% Rotura Coraza · Metralla',
          color: 'orange',
          xPct: shockPos.xPct,
          yPct: shockPos.yPct,
          createdAt: Date.now(),
        });
      };

      // Update Projectiles & Check Scourer Multiplication + hazmat_epi Acid Immunity + Emergent Chemistry & Knockback
      const survivingProjectiles: Projectile[] = [];
      for (const proj of projectiles) {
        if (waveSimDt > 0) {
          if (activeBiome.lateralWindForce > 0 && !proj.isEnemy) {
            proj.vx += Math.sin(elapsed * 2.2) * activeBiome.lateralWindForce * waveSimDt;
          }
          proj.x += proj.vx * waveSimDt;
          proj.y += proj.vy * waveSimDt;
          proj.life -= waveSimDt;

          // Ricochet wall bounces (up to 4 bounces for Hidrolimpiadora Ricochet or 2 with wall_ricochet Comanda!)
          if (!proj.isEnemy && (proj.bouncesLeft ?? 0) > 0) {
            if (proj.x < -0.32) {
              proj.x = -0.32;
              proj.vx = Math.abs(proj.vx);
              proj.bouncesLeft = (proj.bouncesLeft ?? 1) - 1;
              spawnParticles(gridToWorldX(proj.x), 0.4, gridToWorldZ(proj.y), 4, 0x38bdf8, 1.8);
            } else if (proj.x > 3.32) {
              proj.x = 3.32;
              proj.vx = -Math.abs(proj.vx);
              proj.bouncesLeft = (proj.bouncesLeft ?? 1) - 1;
              spawnParticles(gridToWorldX(proj.x), 0.4, gridToWorldZ(proj.y), 4, 0x38bdf8, 1.8);
            }
            if (proj.y < -0.32 && (proj.bouncesLeft ?? 0) > 0) {
              proj.y = -0.32;
              proj.vy = Math.abs(proj.vy);
              proj.bouncesLeft = (proj.bouncesLeft ?? 1) - 1;
            } else if (proj.y > 6.35 && (proj.bouncesLeft ?? 0) > 0) {
              proj.y = 6.35;
              proj.vy = -Math.abs(proj.vy);
              proj.bouncesLeft = (proj.bouncesLeft ?? 1) - 1;
            }
          }

          // Parabolic Foam Mortar Shell detonation at target apex!
          if (proj.flavor === 'mortar_shell' && proj.life <= 0) {
            const rad = proj.aoeRadius ?? 1.35;
            soundEngine.playFoamSplit();
            spawnParticles(gridToWorldX(proj.x), 0.55, gridToWorldZ(proj.y), 22, 0xf472b6, 3.2);
            for (let dr = -1; dr <= 1; dr++) {
              for (let dw = -1; dw <= 1; dw++) {
                stampChemTile(proj.x + dr, proj.y + dw, 'wet_soap');
              }
            }
            for (const bug of bugs) {
              if (bug.koTimer > 0) continue;
              if (
                Math.abs(bug.rail - proj.x) <= rad &&
                Math.abs(bug.yProgress - proj.y) <= rad
              ) {
                bug.hasShield = false;
                bug.bossArmorBroken = true;
                bug.wetTimer = Math.max(bug.wetTimer ?? 0, 3.5);
                bug.slowTimer = Math.max(bug.slowTimer, 2.2);
                bug.hp -= proj.damage;
                bug.flashTimer = 0.1;
                if (!bug.bossTier) {
                  bug.yProgress = Math.max(-0.1, bug.yProgress - 1.1);
                }
                evaluateGrandBossTransition(bug);
              }
            }
            continue;
          }

          // Plasma UV Wave stamps 3s electrified wet_soap tiles along its path!
          if (proj.flavor === 'plasma_wave') {
            stampChemTile(proj.x, proj.y, 'wet_soap');
          }

          if (!proj.isEnemy && (proj.flavor === 'water_drop' || proj.flavor === 'bleach_glob')) {
            const scourer = piecesRef.current.find(
              (p) =>
                p.type === 'scourer_nanas' &&
                !p.evolutionId &&
                p.gunkTimer <= 0 &&
                p.rail !== null &&
                p.row !== null &&
                Math.abs(p.rail - proj.x) < 0.35 &&
                Math.abs(p.row - proj.y) < 0.32
            );
            if (scourer && scourer.rail !== null && scourer.row !== null) {
              stampChemTile(scourer.rail, scourer.row, 'wet_soap');
              soundEngine.playFoamSplit();
              spawnParticles(
                gridToWorldX(scourer.rail),
                0.45,
                gridToWorldZ(scourer.row),
                6,
                0x34d399,
                2.0
              );
              const angles = [-0.55, -0.26, 0, 0.26, 0.55];
              const dmgBonus =
                (stateRef.current.hatId === 'tp_gasmask' ? 1.25 : 1.0) *
                (scourer.level >= 3 ? 1.65 : scourer.level === 2 ? 1.3 : 1.0) *
                (isRushMode ? rushModifiers.damageMult : 1.0);
              angles.forEach((ang, aIdx) => {
                const isFrontalCenter = Math.abs(ang) < 0.1;
                const frontalMult = isFrontalCenter ? liveMenuBuffs.frontalDamageMult : 1.0;
                survivingProjectiles.push({
                  id: `foam-${proj.id}-${aIdx}`,
                  x: scourer.rail!,
                  y: scourer.row! - 0.38,
                  vx: Math.sin(ang) * COMBAT.foam.speedX,
                  vy: -Math.cos(ang) * COMBAT.foam.speedY,
                  damage: Math.round(COMBAT.foam.damage * dmgBonus * frontalMult),
                  isEnemy: false,
                  flavor: 'foam_fan',
                  pierceShield: Math.abs(ang) > 0.2,
                  isExplosiveOrThermal: proj.flavor === 'bleach_glob',
                  fromDiagonalFoam: Math.abs(ang) > 0.2,
                  fromVortex: false,
                  bouncesLeft: isRushMode && rushModifiers.wallRicochet ? 1 : 0,
                  life: 1.4,
                });
              });
              proj.life = 0;
              continue;
            }
          }

          if (proj.isEnemy) {
            const hitPiece = piecesRef.current.find(
              (p) =>
                p.rail !== null &&
                p.row !== null &&
                Math.abs(p.rail - proj.x) < 0.42 &&
                Math.abs(p.row - proj.y) < 0.42
            );
            if (hitPiece && hitPiece.rail !== null && hitPiece.row !== null) {
              if (hitPiece.type === 'wc_shield') {
                proj.isEnemy = false;
                proj.vy = -Math.abs(proj.vy) * 1.4;
                proj.flavor = 'reflected_bubble';
                proj.pierceShield = true;
                proj.isExplosiveOrThermal = true;
                proj.fromDiagonalFoam = true;
                proj.damage = COMBAT.gelWc.reflectDamagePerLevel * hitPiece.level;
                soundEngine.playFoamSplit();
              } else if (hazmatShieldAvailable) {
                hazmatShieldAvailable = false;
                proj.life = 0;
                soundEngine.playFoamSplit();
                spawnParticles(
                  gridToWorldX(hitPiece.rail),
                  0.55,
                  gridToWorldZ(hitPiece.row),
                  16,
                  0xfacc15,
                  2.8
                );
                const epiPos = projectWorldToScreenPct(
                  gridToWorldX(hitPiece.rail),
                  0.85,
                  gridToWorldZ(hitPiece.row)
                );
                stateRef.current.onFloatingCombo?.({
                  id: `hazmat-acid-${Date.now()}`,
                  multiplier: 1,
                  label: '☣️ ¡TRAJE EPI!',
                  detail: '1er Ácido Absorbido',
                  color: 'yellow',
                  xPct: epiPos.xPct,
                  yPct: epiPos.yPct,
                  createdAt: Date.now(),
                });
                continue;
              } else {
                stampChemTile(hitPiece.rail, hitPiece.row, 'acid_pool');
                const baseAcidGunk = stateRef.current.hatId === 'bucket_helmet' ? 1.8 : COMBAT.wasp.gunkSec;
                hitPiece.gunkTimer = Number(
                  (baseAcidGunk * upgradeEffects.acidDurationMult).toFixed(2)
                );
                proj.life = 0;
                continue;
              }
            }
          } else {
            // Allied projectile vs Bugs
            const hitWidth = proj.aoeRadius ?? 0.48;
            for (const bug of bugs) {
              if (bug.koTimer > 0 || bug.yProgress < -0.15) continue;
              // Avispa de guion: vuela, el remolino de la Fregona (suelo) no la alcanza.
              if (bug.isFlying && proj.fromVortex) continue;
              if (
                Math.abs(bug.rail - proj.x) < hitWidth &&
                Math.abs(bug.yProgress - proj.y) < 0.5
              ) {
                const isLiquidOrSoap =
                  proj.flavor === 'water_drop' ||
                  proj.flavor === 'foam_fan' ||
                  proj.flavor === 'vortex_soap' ||
                  proj.flavor === 'bleach_glob' ||
                  proj.flavor === 'reflected_bubble' ||
                  proj.flavor === 'ricochet_jet';
                if (isLiquidOrSoap) {
                  stampChemTile(bug.rail, bug.yProgress, 'wet_soap');
                  bug.wetTimer = Math.max(bug.wetTimer ?? 0, 2.8);
                }

                const isThermalOrExplosive = Boolean(
                  proj.isExplosiveOrThermal ||
                    proj.flavor === 'volcano_foam' ||
                    proj.flavor === 'roomba_blade' ||
                    proj.flavor === 'bleach_glob' ||
                    proj.flavor === 'plasma_wave'
                );

                if (isThermalOrExplosive) {
                  triggerThermalShockIfEligible(bug);
                }

                if (
                  proj.fromVortex ||
                  proj.flavor === 'volcano_foam' ||
                  proj.flavor === 'bleach_glob'
                ) {
                  const kb = applyPhysicalKnockback(bug, {
                    pushCells: proj.flavor === 'volcano_foam' ? 1.15 : 1.0,
                  });
                  if (kb.applied) {
                    bug.yProgress = kb.nextYProgress;
                    bug.targetRail = kb.nextTargetRail;
                    bug.knockbackCooldown = 1.15;
                  }
                }

                const isUltimateProjectile =
                  proj.flavor === 'volcano_foam' || proj.flavor === 'roomba_blade';
                if (isUltimateProjectile) {
                  hitstopTimer = Math.max(hitstopTimer, HEAVY_IMPACT_HITSTOP_SECONDS);
                  bug.flashTimer = Math.max(bug.flashTimer, ENEMY_WHITE_FLASH_SECONDS);
                }

                if (bug.bossTier) {
                  const isControlCombo = Boolean(
                    proj.fromDiagonalFoam ||
                      proj.fromVortex ||
                      bug.isSlidingFromSoap ||
                      bug.redirectedBySquare
                  );
                  const mult = computeBossDamageMultiplier({
                    tier: bug.bossTier,
                    phase: bug.bossPhase ?? 1,
                    armorBroken: Boolean(bug.bossArmorBroken),
                    isThermalOrExplosive,
                    isControlCombo,
                  });
                  if (isThermalOrExplosive && !bug.bossArmorBroken) {
                    bug.bossArmorBroken = true;
                    bug.hasShield = false;
                    hitstopTimer = Math.max(hitstopTimer, HEAVY_IMPACT_HITSTOP_SECONDS);
                    bug.flashTimer = Math.max(bug.flashTimer, ENEMY_WHITE_FLASH_SECONDS);
                    spawnParticles(
                      gridToWorldX(bug.rail),
                      0.55,
                      gridToWorldZ(bug.yProgress),
                      14,
                      proj.flavor === 'volcano_foam' ? 0xf97316 : 0xe879f9,
                      2.9
                    );
                  } else if (mult < 0.6) {
                    soundEngine.playShieldClink();
                  }
                  bug.hp -= proj.damage * mult;
                  bug.flashTimer = Math.max(bug.flashTimer, 0.08);
                  if (proj.fromDiagonalFoam) bug.hitByDiagonalFoam = true;
                  if (proj.fromVortex) {
                    bug.hitByVortexSpin = true;
                    bug.slowTimer = Math.max(
                      bug.slowTimer,
                      1.8 * liveMenuBuffs.controlDurationMult
                    );
                  }
                  evaluateGrandBossTransition(bug);
                } else if (bug.hasShield && !proj.pierceShield && !proj.isExplosiveOrThermal) {
                  soundEngine.playShieldClink();
                  spawnParticles(
                    gridToWorldX(bug.rail),
                    0.45,
                    gridToWorldZ(bug.yProgress),
                    6,
                    0xfacc15,
                    2.1
                  );
                  if (shieldWarnCooldown <= 0 && !isRushMode) {
                    shieldWarnCooldown = 6.0;
                    stateRef.current.onComicPop({
                      id: `shield-block-${Date.now()}`,
                      title: '🛡️ ¡BLINDADO! 0 DAÑO',
                      subtitle: 'Une 2 Aerosoles UV ⚡ en paralelo o usa Jabón 🧼 para abrir su escudo',
                      color: 'pink',
                      createdAt: Date.now(),
                    });
                  }
                } else {
                  if (bug.hasShield && (proj.isExplosiveOrThermal || proj.pierceShield)) {
                    bug.hasShield = false;
                    hitstopTimer = Math.max(hitstopTimer, HEAVY_IMPACT_HITSTOP_SECONDS);
                    bug.flashTimer = Math.max(bug.flashTimer, ENEMY_WHITE_FLASH_SECONDS);
                  }
                  bug.hp -= proj.damage;
                  bug.flashTimer = Math.max(bug.flashTimer, 0.08);
                  if (proj.fromDiagonalFoam) bug.hitByDiagonalFoam = true;
                  if (proj.fromVortex) {
                    bug.hitByVortexSpin = true;
                    bug.slowTimer = Math.max(
                      bug.slowTimer,
                      1.4 * liveMenuBuffs.controlDurationMult
                    );
                  }
                }

                if ((proj.bouncesLeft ?? 0) > 0) {
                  proj.bouncesLeft = (proj.bouncesLeft ?? 1) - 1;
                  proj.vx = proj.vx === 0 ? (Math.random() < 0.5 ? -3.4 : 3.4) : -proj.vx;
                } else if (
                  proj.flavor !== 'roomba_blade' &&
                  proj.flavor !== 'volcano_foam' &&
                  proj.flavor !== 'plasma_wave'
                ) {
                  proj.life = 0;
                }
                if (proj.flavor !== 'plasma_wave') {
                  break;
                }
              }
            }
          }
        }

        if (proj.life > 0 && proj.y > -1.2 && proj.y < 7.2 && proj.x > -0.6 && proj.x < 3.6) {
          survivingProjectiles.push(proj);
        }
      }
      if (survivingProjectiles.length > MAX_PROJECTILE_INSTANCES) {
        survivingProjectiles.splice(0, survivingProjectiles.length - MAX_PROJECTILE_INSTANCES);
      }
      projectiles = survivingProjectiles;

      // Zero-GC InstancedMesh Projectile Sync (max 120 low-poly spheres, zero per-shot Mesh/Material allocation!)
      const projCount = Math.min(projectiles.length, MAX_PROJECTILE_INSTANCES);
      projInstanced.count = projCount;
      for (let i = 0; i < projCount; i++) {
        const proj = projectiles[i];
        const colorHex =
          proj.flavor === 'enemy_acid'
            ? 0xa855f7
            : proj.flavor === 'plasma_wave'
            ? 0xe879f9
            : proj.flavor === 'mortar_shell'
            ? 0xf472b6
            : proj.flavor === 'ricochet_jet'
            ? 0x38bdf8
            : proj.flavor === 'volcano_foam'
            ? 0xf97316
            : proj.flavor === 'foam_fan'
            ? 0x34d399
            : proj.flavor === 'vortex_soap'
            ? 0x2dd4bf
            : proj.flavor === 'bleach_glob'
            ? 0xfacc15
            : proj.flavor === 'roomba_blade'
            ? 0xef4444
            : 0x00d2ff;

        const arcLift =
          proj.flavor === 'mortar_shell'
            ? Math.sin(Math.min(1, Math.max(0, proj.life / 0.55)) * Math.PI) * 1.45
            : 0;

        _dummyObj.position.set(gridToWorldX(proj.x), 0.45 + arcLift, gridToWorldZ(proj.y));
        _dummyObj.rotation.set(0, 0, 0);
        if (proj.flavor === 'plasma_wave') {
          _dummyObj.scale.set(3.8, 0.55, 1.15);
        } else if (proj.flavor === 'roomba_blade' || proj.flavor === 'volcano_foam') {
          _dummyObj.scale.set(2.1, 0.65, 2.1);
        } else if (proj.flavor === 'mortar_shell') {
          _dummyObj.scale.set(1.55, 1.55, 1.55);
        } else {
          _dummyObj.scale.set(0.88, 0.88, 1.18);
        }
        _dummyObj.updateMatrix();
        projInstanced.setMatrixAt(i, _dummyObj.matrix);
        _projColor.setHex(colorHex);
        projInstanced.setColorAt(i, _projColor);
      }
      projInstanced.instanceMatrix.needsUpdate = true;
      if (projInstanced.instanceColor) {
        projInstanced.instanceColor.needsUpdate = true;
      }

      // Decay 4s Temporary Countertop Tile Chemistry States IN-PLACE (zero .map/.filter allocations!) & Throttle Chem Tick to ~8.3-10Hz
      let runChemTick = false;
      if (waveSimDt > 0) {
        chemTickAccum += waveSimDt;
        if (chemTickAccum >= 0.12) {
          chemTickAccum = 0;
          runChemTick = true;
        }
        let writeIdx = 0;
        for (let i = 0; i < chemTiles.length; i++) {
          const t = chemTiles[i];
          t.timer -= waveSimDt;
          if (t.timer > 0) {
            chemTiles[writeIdx] = t;
            writeIdx += 1;
          }
        }
        chemTiles.length = writeIdx;

        if (activeStreakTimer > 0) {
          activeStreakTimer = Math.max(0, activeStreakTimer - waveSimDt);
          if (activeStreakTimer <= 0) {
            activeStreakCount = 0;
          }
        }
      }
      if (gState === 'playing' && !inPlacementPhase && chefWhipCooldown > 0) {
        chefWhipCooldown = Math.max(0, chefWhipCooldown - dt);
      }
      for (let r = 0; r < GRID_RAILS; r++) {
        for (let row = 0; row < GRID_ROWS; row++) {
          const chemMesh = cellChemPads[r][row];
          const chemMat = chemMesh.material as THREE.MeshBasicMaterial;
          let stateHere: TileChemicalState | undefined;
          for (let k = 0; k < chemTiles.length; k++) {
            if (chemTiles[k].rail === r && chemTiles[k].row === row) {
              stateHere = chemTiles[k];
              break;
            }
          }
          if (stateHere && stateHere.timer > 0) {
            const lifeRatio = Math.min(1, stateHere.timer / TILE_TRAIL_DURATION);
            chemMat.color.setHex(stateHere.kind === 'acid_pool' ? 0xa855f7 : 0x38bdf8);
            chemMat.opacity = (0.18 + Math.sin(elapsed * 7 + r + row) * 0.05) * lifeRatio;
          } else {
            chemMat.opacity = 0;
          }
        }
      }

      // Update Bugs & Check Traps + Emergent Chemistry + Boss Phase 2/3 Behaviors + KO Transitions
      const warningRails: (BugType | null)[] = [null, null, null, null];
      const survivingBugs: BugEnemy[] = [];

      for (const bug of bugs) {
        if (bug.yProgress < 0.35 && bug.koTimer <= 0) {
          const rWarn = THREE.MathUtils.clamp(Math.round(bug.rail), 0, GRID_RAILS - 1);
          warningRails[rWarn] = bug.type;
        }
        if (bug.bossPhaseFlashTimer && bug.bossPhaseFlashTimer > 0) {
          bug.bossPhaseFlashTimer = Math.max(0, bug.bossPhaseFlashTimer - dt);
        }

        if (waveSimDt > 0) {
          if (bug.koTimer > 0) {
            bug.koTimer -= waveSimDt;
            if (bug.koTimer > 0) {
              survivingBugs.push(bug);
            } else {
              const m = bugMeshes.get(bug.id);
              if (m) {
                bugsGroup.remove(m);
                disposeBugInstance(m);
                bugMeshes.delete(bug.id);
              }
            }
            continue;
          }

          if (bug.slowTimer > 0) bug.slowTimer = Math.max(0, bug.slowTimer - waveSimDt);
          if (bug.wetTimer && bug.wetTimer > 0) bug.wetTimer = Math.max(0, bug.wetTimer - waveSimDt);
          if (bug.coldTimer && bug.coldTimer > 0) bug.coldTimer = Math.max(0, bug.coldTimer - waveSimDt);
          if (bug.knockbackCooldown && bug.knockbackCooldown > 0) {
            bug.knockbackCooldown = Math.max(0, bug.knockbackCooldown - waveSimDt);
          }
          if (bug.chainArcCooldown && bug.chainArcCooldown > 0) {
            bug.chainArcCooldown = Math.max(0, bug.chainArcCooldown - waveSimDt);
          }
          if (bug.thermalShockCooldown && bug.thermalShockCooldown > 0) {
            bug.thermalShockCooldown = Math.max(0, bug.thermalShockCooldown - waveSimDt);
          }
          if (bug.chefStunTimer && bug.chefStunTimer > 0) {
            bug.chefStunTimer = Math.max(0, bug.chefStunTimer - waveSimDt);
          }
          if (bug.bossStunTimer && bug.bossStunTimer > 0) {
            bug.bossStunTimer = Math.max(0, bug.bossStunTimer - waveSimDt);
          }

          // Throttled ~8.3-10Hz Tile Chemistry Check (every 0.12s instead of 60Hz per bug!)
          if (runChemTick) {
            const stepRail = THREE.MathUtils.clamp(Math.round(bug.rail), 0, GRID_RAILS - 1);
            const stepRow = Math.round(bug.yProgress);
            let tileChem: TileChemicalState | undefined;
            for (let k = 0; k < chemTiles.length; k++) {
              const ct = chemTiles[k];
              if (ct.rail === stepRail && ct.row === stepRow && ct.timer > 0) {
                tileChem = ct;
                break;
              }
            }
            if (tileChem?.kind === 'wet_soap') {
              bug.wetTimer = Math.max(bug.wetTimer ?? 0, 1.8);
              if (isRushMode && rushModifiers.electroTiles) {
                bug.hasShield = false;
                bug.hp -= 24 * rushModifiers.damageMult * 0.12;
              }
            } else if (tileChem?.kind === 'acid_pool' && bug.type !== 'acid_wasp') {
              bug.wetTimer = Math.max(bug.wetTimer ?? 0, 1.2);
            }
            if (isColdEnvironment && bug.yProgress > 0) {
              bug.coldTimer = Math.max(bug.coldTimer ?? 0, 0.8);
            }
          }

          const biomeFrictionSpeedFactor =
            activeBiome.friction > 1.1
              ? 0.88
              : activeBiome.friction < 0.2
              ? 1.06
              : activeBiome.friction < 0.5
              ? 1.04
              : 1.0;

          const speedMap = BUG_BASE_SPEED;
          const worldMult = WORLDS_CATALOG[stateRef.current.worldId].speedMult;
          const levelMult = isRushMode
            ? rushDirector.speedMultiplier * rushModifiers.chaosSpeedMult
            : getLevelSpeedMultiplier(stateRef.current.level);
          // Level 1 Wave 1 ONLY (Strategic Mode): 35% slower (0.65x) so live dynamic onboarding feels calm!
          const lvl1Wave1Factor =
            !isRushMode && !activeScript && stateRef.current.level === 1 && phase === 1 ? 0.65 : 1.0;
          // Grand Boss Phase 3 Frenzy: +30% speed!
          const bossFrenzyFactor =
            bug.bossTier === 'grand' && (bug.bossPhase ?? 1) === 3 ? 1.3 : 1.0;
          const controlSlowFactor = bug.slowTimer > 0 ? COMBAT.slowSpeedFactor : 1.0;
          const isChefStunned = Boolean(bug.chefStunTimer && bug.chefStunTimer > 0);
          const isStunnedBoss = Boolean(bug.bossStunTimer && bug.bossStunTimer > 0);
          const effectiveSpeed = isChefStunned
            ? 0
            : isStunnedBoss
            ? 0.08
            : speedMap[bug.type] *
              worldMult *
              levelMult *
              biomeFrictionSpeedFactor *
              lvl1Wave1Factor *
              bossFrenzyFactor *
              controlSlowFactor;

          if (bug.isLateralInvasion && bug.lateralDir) {
            bug.rail += bug.lateralDir * effectiveSpeed * 0.92 * waveSimDt;
            bug.targetRail = bug.rail;
            bug.yProgress += effectiveSpeed * 0.22 * waveSimDt;
            if (bug.lateralDir === 1 && bug.rail >= 3.0) {
              bug.rail = 3;
              bug.targetRail = 3;
              bug.isLateralInvasion = false;
              bug.lateralDir = 0;
            } else if (bug.lateralDir === -1 && bug.rail <= 0.0) {
              bug.rail = 0;
              bug.targetRail = 0;
              bug.isLateralInvasion = false;
              bug.lateralDir = 0;
            }
          } else {
            if (bug.roachShiftTimer !== undefined && !bug.bossTier) {
              const z = stepRoachZigzag(
                {
                  railInt: Math.round(bug.targetRail),
                  timer: bug.roachShiftTimer,
                  dir: bug.roachShiftDir ?? 1,
                  pinned: bug.isSlidingFromSoap,
                  onBoard: bug.yProgress > 0,
                },
                waveSimDt
              );
              bug.roachShiftTimer = z.timer;
              bug.roachShiftDir = z.dir;
              if (z.shiftTo !== null) bug.targetRail = z.shiftTo;
            }
            const slideDamp = activeBiome.friction < 0.5 ? 15 : 9;
            bug.rail = THREE.MathUtils.damp(bug.rail, bug.targetRail, slideDamp, waveSimDt);
            bug.yProgress += effectiveSpeed * waveSimDt;
          }

          // Grand Boss Phase 2+ Sabotage & Evasion: shifts rail & spits acid gunk (countered by control slow / Gel WC / hazmat_epi)
          if (
            bug.bossTier === 'grand' &&
            (bug.bossPhase ?? 1) >= 2 &&
            bug.yProgress > 0.2 &&
            bug.yProgress < 4.6 &&
            !isStunnedBoss
          ) {
            bug.bossEvadeTimer = (bug.bossEvadeTimer ?? 2.6) - waveSimDt * (bug.slowTimer > 0 ? 0.45 : 1.0);
            if (bug.bossEvadeTimer <= 0) {
              bug.bossEvadeTimer = (bug.bossPhase ?? 1) === 3 ? 2.4 : 3.0;
              const curR = THREE.MathUtils.clamp(Math.round(bug.rail), 0, GRID_RAILS - 1);
              const nextR =
                curR === 0
                  ? 1
                  : curR === GRID_RAILS - 1
                  ? GRID_RAILS - 2
                  : Math.random() < 0.5
                  ? curR - 1
                  : curR + 1;
              bug.targetRail = nextR;
              projectiles.push({
                id: `boss-acid-${bug.id}-${Date.now()}`,
                x: curR,
                y: bug.yProgress + 0.35,
                vx: 0,
                vy: 3.2,
                damage: 10,
                isEnemy: true,
                flavor: 'enemy_acid',
                pierceShield: false,
                fromDiagonalFoam: false,
                fromVortex: false,
                life: 2.2,
              });
            }
          }

          // Acid Wasp ranged attack telegraph & acid shot
          if (
            bug.type === 'acid_wasp' &&
            bug.yProgress > COMBAT.wasp.minRow &&
            bug.yProgress < COMBAT.wasp.maxRow &&
            !isStunnedBoss
          ) {
            bug.attackWindup += waveSimDt * COMBAT.wasp.windupPerSec;
            if (bug.attackWindup >= 1.0) {
              bug.attackWindup = 0;
              projectiles.push({
                id: `acid-${bug.id}-${Date.now()}`,
                x: Math.round(bug.rail),
                y: bug.yProgress + 0.3,
                vx: 0,
                vy: COMBAT.wasp.acidSpeed,
                damage: COMBAT.wasp.acidDamage,
                isEnemy: true,
                flavor: 'enemy_acid',
                pierceShield: false,
                fromDiagonalFoam: false,
                fromVortex: false,
                life: COMBAT.wasp.acidLife,
              });
            }
          }

          const currentRailInt = THREE.MathUtils.clamp(Math.round(bug.rail), 0, GRID_RAILS - 1);
          const currentRowInt = Math.round(bug.yProgress);

          // 0. Check ESCUADRA DEFLECTORA 90° (`corner_square`)
          const squareHere = piecesRef.current.find(
            (p) =>
              p.type === 'corner_square' &&
              p.gunkTimer <= 0 &&
              p.rail === currentRailInt &&
              p.row === currentRowInt &&
              Math.abs(bug.rail - currentRailInt) < 0.44 &&
              Math.abs(bug.yProgress - currentRowInt) < 0.44
          );
          if (squareHere && (bug.isLateralInvasion || !bug.redirectedBySquare)) {
            bug.isLateralInvasion = false;
            bug.lateralDir = 0;
            bug.rail = currentRailInt;
            bug.targetRail = currentRailInt;
            bug.redirectedBySquare = true;
            bug.hasShield = false;
            bug.bossArmorBroken = true;
            if (bug.isPuzzleBoss && bug.bossPuzzleType === 'square_deflect') {
              bug.bossStunTimer = 3.5;
            }
            const sqEntry = utensilMeshes.get(squareHere.id);
            if (sqEntry) sqEntry.bounce = 1.0 * activeBiome.bounciness;
            soundEngine.playSnapPiece(true);
            spawnParticles(
              gridToWorldX(currentRailInt),
              0.45,
              gridToWorldZ(currentRowInt),
              14,
              0xfacc15,
              2.9
            );
            const sqPos = projectWorldToScreenPct(
              gridToWorldX(currentRailInt),
              0.85,
              gridToWorldZ(currentRowInt)
            );
            stateRef.current.onFloatingCombo?.({
              id: `combo-square-${bug.id}-${Date.now()}`,
              multiplier: 2,
              label: bug.bossTier ? '💫 Frenado' : '📐 Giro 90°',
              detail: 'x2',
              color: 'yellow',
              xPct: sqPos.xPct,
              yPct: sqPos.yPct,
              createdAt: Date.now(),
            });
          }

          // 1. Check Horizontal Aerosol Neon Violet UV Bridge at (currentRowInt) + Conductive UV Arc & Thermal Shock!
          const bridgeLink = comboEval.links.find(
            (l) =>
              l.kind === 'bridge_uv' &&
              l.fromRow === currentRowInt &&
              (l.fromRail === currentRailInt || l.toRail === currentRailInt)
          );
          if (bridgeLink && Math.abs(bug.yProgress - currentRowInt) < 0.3) {
            triggerThermalShockIfEligible(bug);

            // Chain Reaction (~8.3-10Hz throttled): Wet/Soaped bug touching UV Beam propagates electric arc to bugs on contiguous wet cells!
            if (runChemTick && (bug.chainArcCooldown ?? 0) <= 0) {
              const chainIds = computeConductiveUvChainTargets(bug.id, bugs, chemTiles);
              if (chainIds.length > 0) {
                bug.chainArcCooldown = 0.55;
                soundEngine.playChainShock();
                for (const cid of chainIds) {
                  const chained = bugs.find((b) => b.id === cid && b.koTimer <= 0);
                  if (chained) {
                    chained.hasShield = false;
                    chained.bossArmorBroken = true;
                    chained.hitByBridgeBurn = true;
                    chained.hp -= 28 * liveMenuBuffs.thermalRateMult;
                    chained.flashTimer = 0.1;
                    chained.chainArcCooldown = 0.55;
                    spawnParticles(
                      gridToWorldX(chained.rail),
                      0.55,
                      gridToWorldZ(chained.yProgress),
                      12,
                      0x22d3ee,
                      3.0
                    );
                    evaluateGrandBossTransition(chained);
                  }
                }
                const arcPos = projectWorldToScreenPct(
                  gridToWorldX(bug.rail),
                  0.92,
                  gridToWorldZ(bug.yProgress)
                );
                stateRef.current.onFloatingCombo?.({
                  id: `uv-chain-${bug.id}-${Date.now()}`,
                  multiplier: chainIds.length + 1,
                  label: '⚡ Arco UV',
                  detail: `x${chainIds.length + 1}`,
                  color: 'cyan',
                  xPct: arcPos.xPct,
                  yPct: arcPos.yPct,
                  createdAt: Date.now(),
                });
              }
            }

            if (bug.hasShield || (bug.bossTier && !bug.bossArmorBroken)) {
              bug.hasShield = false;
              bug.bossArmorBroken = true;
              bug.hitByBridgeBurn = true;
              hitstopTimer = Math.max(hitstopTimer, HEAVY_IMPACT_HITSTOP_SECONDS);
              bug.flashTimer = Math.max(bug.flashTimer, ENEMY_WHITE_FLASH_SECONDS);
              if (bug.bossTier === 'mini' && bug.bossPuzzleType === 'uv_overheat') {
                bug.bossStunTimer = COMBAT.bridgeUv.miniBossStunSec * liveMenuBuffs.controlDurationMult;
              }
              spawnParticles(
                gridToWorldX(bug.rail),
                0.55,
                gridToWorldZ(bug.yProgress),
                14,
                0xe879f9, // Neon Violet UV sparks!
                2.8
              );
              const meltPos = projectWorldToScreenPct(
                gridToWorldX(bug.rail),
                0.85,
                gridToWorldZ(bug.yProgress)
              );
              stateRef.current.onFloatingCombo?.({
                id: `combo-melt-${bug.id}-${Date.now()}`,
                multiplier: 2,
                label: bug.bossTier ? '⚡ Coraza ×2.5' : '⚡ Escudo roto',
                detail: 'x2',
                color: 'pink',
                xPct: meltPos.xPct,
                yPct: meltPos.yPct,
                createdAt: Date.now(),
              });
            }
            const uvMult = bug.bossTier
              ? computeBossDamageMultiplier({
                  tier: bug.bossTier,
                  phase: bug.bossPhase ?? 1,
                  armorBroken: Boolean(bug.bossArmorBroken),
                  isThermalOrExplosive: true,
                  isControlCombo: false,
                })
              : 1.0;
            bug.hp -= COMBAT.bridgeUv.dps * liveMenuBuffs.thermalRateMult * uvMult * waveSimDt;
            bug.hitByBridgeBurn = true;
            if (isRushMode) {
              for (const p of piecesRef.current) {
                if (
                  p.type === 'aerosol_torch' &&
                  !p.evolutionId &&
                  p.row === currentRowInt &&
                  (p.rail === bridgeLink.fromRail || p.rail === bridgeLink.toRail)
                ) {
                  drainRushAerosolInPlace(p, 0.85 * waveSimDt);
                }
              }
            }
            evaluateGrandBossTransition(bug);
          }

          // 2. Check Soap Bar ("Pastilla de Jabón Resbalón") on current cell -> leaves 4s wet_soap trail!
          const soapHere = piecesRef.current.find(
            (p) =>
              p.type === 'soap_bar' &&
              p.gunkTimer <= 0 &&
              p.rail === currentRailInt &&
              p.row === currentRowInt &&
              Math.abs(bug.yProgress - currentRowInt) < 0.32
          );
          if (soapHere && !bug.isFlying && !bug.isSlidingFromSoap) {
            bug.isSlidingFromSoap = true;
            bug.wetTimer = Math.max(bug.wetTimer ?? 0, 3.6);
            bug.slowTimer = Math.max(bug.slowTimer, COMBAT.soap.slowSec * liveMenuBuffs.controlDurationMult);
            stampChemTile(currentRailInt, currentRowInt, 'wet_soap');
            if (bug.bossTier === 'mini' && bug.bossPuzzleType === 'soap_stun') {
              bug.bossStunTimer = 3.5 * liveMenuBuffs.controlDurationMult;
              bug.hasShield = false;
              bug.bossArmorBroken = true;
            }
            soundEngine.playSoapSlip();
            const vortexNeighbor = piecesRef.current.find(
              (p) =>
                p.type === 'mop_vortex' &&
                p.rail !== null &&
                Math.abs(p.rail - currentRailInt) === 1
            );
            if (vortexNeighbor && vortexNeighbor.rail !== null) {
              bug.targetRail = vortexNeighbor.rail;
              stampChemTile(vortexNeighbor.rail, currentRowInt, 'wet_soap');
              const slipPos = projectWorldToScreenPct(
                gridToWorldX(bug.rail),
                0.8,
                gridToWorldZ(bug.yProgress)
              );
              stateRef.current.onFloatingCombo?.({
                id: `combo-slip-${bug.id}-${Date.now()}`,
                multiplier: 2,
                label: bug.bossTier ? '🧼 Control' : '🧼 Vórtice',
                detail: 'x2',
                color: 'pink',
                xPct: slipPos.xPct,
                yPct: slipPos.yPct,
                createdAt: Date.now(),
              });
            } else {
              bug.targetRail = currentRailInt < GRID_RAILS - 1 ? currentRailInt + 1 : currentRailInt - 1;
            }
            spawnParticles(
              gridToWorldX(bug.rail),
              0.3,
              gridToWorldZ(bug.yProgress),
              10,
              0xf472b6,
              2.4
            );
          }

          // 3. Check if bug enters a Mop Vortex cell (+ Physical Knockback pushing 1 cell back into UV Bridge!)
          const vortexHere = piecesRef.current.find(
            (p) =>
              p.type === 'mop_vortex' &&
              p.gunkTimer <= 0 &&
              p.rail === currentRailInt &&
              p.row === currentRowInt &&
              Math.abs(bug.yProgress - currentRowInt) < 0.45
          );
          if (vortexHere && !bug.isFlying) {
            bug.hitByVortexSpin = true;
            bug.wetTimer = Math.max(bug.wetTimer ?? 0, 3.0);
            bug.slowTimer = Math.max(bug.slowTimer, 2.2 * liveMenuBuffs.controlDurationMult);
            stampChemTile(currentRailInt, currentRowInt, 'wet_soap');

            // Physical Knockback: sweep pushes light/medium bugs 1 cell backward (e.g. back into an active UV Bridge!)
            if (!bug.isSlidingFromSoap) {
              const kb = applyPhysicalKnockback(bug, { pushCells: 1.0 });
              if (kb.applied) {
                bug.yProgress = kb.nextYProgress;
                bug.knockbackCooldown = 1.25;
                spawnParticles(
                  gridToWorldX(bug.rail),
                  0.4,
                  gridToWorldZ(bug.yProgress),
                  8,
                  0x2dd4bf,
                  2.4
                );
              }
            }

            const vortexMult = bug.bossTier
              ? computeBossDamageMultiplier({
                  tier: bug.bossTier,
                  phase: bug.bossPhase ?? 1,
                  armorBroken: Boolean(bug.bossArmorBroken),
                  isThermalOrExplosive: false,
                  isControlCombo: true,
                })
              : 1.0;
            const rawVortexDps = bug.bossTier
              ? bug.isSlidingFromSoap
                ? COMBAT.mop.bossContactDpsSlipped
                : COMBAT.mop.bossContactDps
              : bug.isSlidingFromSoap
              ? COMBAT.mop.contactDpsSlipped
              : COMBAT.mop.contactDps;
            bug.hp -= rawVortexDps * vortexMult * waveSimDt;
            evaluateGrandBossTransition(bug);
          }

          // Check if Bug is defeated!
          if (bug.hp <= 0) {
            // Acid plagues leave a 4s temporary acid_pool state on that countertop tile upon death!
            if (bug.type === 'acid_wasp') {
              stampChemTile(bug.rail, bug.yProgress, 'acid_pool');
            }

            const elim = classifyBugElimination(bug);
            bug.koTimer = bug.bossTier ? 0.55 : 0.38;
            bug.koStar = elim.stars;
            killsByStar[elim.stars - 1] += 1;
            phaseKills += bug.bossTier ? 3 : 1;
            totalBugsCleaned += 1;
            const ptsAwarded =
              (elim.stars === 3 ? 350 : elim.stars === 2 ? 180 : 100) *
              (bug.bossTier === 'grand' ? 3 : bug.bossTier === 'mini' ? 2 : 1);
            score += ptsAwarded;
            const basePressureGain =
              stateRef.current.armorId === 'golden_scourer_mail' ? 24 : 18;
            pressurePct = Math.min(
              100,
              pressurePct + Math.round(basePressureGain * liveMenuBuffs.ultChargeMult)
            );

            const killNowMs = Date.now();
            if (killNowMs - lastRapidKillAtMs < 1200) {
              rapidKillStreakCount += 1;
            } else {
              rapidKillStreakCount = 1;
            }
            lastRapidKillAtMs = killNowMs;

            // Active Lateral Streak Counter ("Combo xN") + x8 & x15 Coin Milestone Rewards!
            const prevActiveStreak = activeStreakTimer > 0 ? activeStreakCount : 0;
            activeStreakCount = Math.min(99, prevActiveStreak + 1);
            activeStreakTimer = 3.6;
            const streakReward = computeStreakMilestoneReward(
              prevActiveStreak,
              activeStreakCount,
              stateRef.current.kitchenUpgrades
            );
            if (streakReward.crossedThreshold && streakReward.bonusCoins > 0) {
              stateRef.current.onStreakCoinBonus?.(
                streakReward.bonusCoins,
                streakReward.crossedThreshold
              );
              const bonusPos = projectWorldToScreenPct(
                gridToWorldX(bug.rail),
                1.05,
                gridToWorldZ(bug.yProgress)
              );
              stateRef.current.onFloatingCombo?.({
                id: `streak-coins-${streakReward.crossedThreshold}-${killNowMs}`,
                multiplier: streakReward.crossedThreshold,
                label: `+${streakReward.bonusCoins}🪙`,
                detail: `Racha x${streakReward.crossedThreshold}`,
                color: 'yellow',
                xPct: bonusPos.xPct,
                yPct: bonusPos.yPct,
                createdAt: killNowMs,
              });
            }

            // Chef celebrates briefly on chaining 3+ rapid kills!
            if (rapidKillStreakCount >= 3 || activeStreakCount >= 8) {
              chefCelebrateTimer = 0.95;
            }

            if (isRushMode) {
              // Supply kill-streak bonus + XP gain!
              const killSupply =
                getRushKillSupply({
                  stars: elim.stars,
                  hitByBridgeBurn: bug.hitByBridgeBurn,
                  bossTier: bug.bossTier,
                }) * rushModifiers.supplyRateMult;
              rushSupply = Math.min(currentRushSupplyMax, rushSupply + killSupply);
              // Mockup: combo kills pop the supply they pay ("+26 · COMBO 3★") so the economy is readable.
              if (killSupply >= 10) {
                const supplyPos = projectWorldToScreenPct(
                  gridToWorldX(bug.rail),
                  0.85,
                  gridToWorldZ(bug.yProgress)
                );
                stateRef.current.onFloatingCombo?.({
                  id: `rush-supply-${bug.id}-${killNowMs}`,
                  multiplier: elim.stars,
                  label: `+${Math.round(killSupply)}`,
                  detail: bug.bossTier
                    ? '👑 JEFE'
                    : elim.stars === 1
                    ? 'PUENTE UV'
                    : `COMBO ${elim.stars}★`,
                  color: bug.bossTier || elim.stars === 3 ? 'yellow' : 'green',
                  emphasis: Boolean(bug.bossTier) || elim.stars === 3,
                  xPct: supplyPos.xPct,
                  yPct: supplyPos.yPct,
                  createdAt: killNowMs,
                });
              }
              rushXp += (bug.bossTier ? 48 : 14) * rushModifiers.xpMult;
              if (rapidKillStreakCount >= 25) {
                unlockRushMilestoneIfNew('rush_streak_25');
              }
              if (bug.bossTier) {
                // Defeating Min 3:00 Rush Boss deploys the Knife Roomba in front of the 4 plates!
                patrolRoombaActive = true;
                knifeRoombaMesh.visible = true;
                unlockRushMilestoneIfNew('rush_boss_3min');
              }
            }

            soundEngine.playStarKill(elim.stars, killNowMs);
            spawnParticles(
              gridToWorldX(bug.rail),
              0.55,
              gridToWorldZ(bug.yProgress),
              bug.bossTier ? 30 : elim.stars === 3 ? 24 : 14,
              elim.stars === 3 ? 0x2dd4bf : elim.stars === 2 ? 0x34d399 : 0xfacc15,
              3.2
            );

            if (elim.stars >= 2 || bug.bossTier) {
              hitstopTimer = bug.bossTier ? 0.14 : 0.045;
              cameraTrauma = bug.bossTier ? 0.85 : elim.stars === 3 ? 0.65 : 0.35;
              chefCelebrateTimer = 0.85;
            }

            if (elim.achievementId) {
              stateRef.current.onAchievementKill(
                elim.achievementId,
                elim.stars,
                elim.stars * 45
              );
            }

            const playerHasPlacedCombo = piecesRef.current.some(
              (p) =>
                p.rail !== null &&
                p.row !== null &&
                (p.comboType !== 'none' || p.level >= 2 || Boolean(p.evolutionId))
            );
            const killedByComboAction =
              Boolean(bug.bossTier) ||
              elim.stars >= 2 ||
              bug.hitByBridgeBurn ||
              bug.hitByDiagonalFoam ||
              bug.hitByVortexSpin;
            const nowMs = Date.now();
            if (playerHasPlacedCombo && killedByComboAction) {
              combatComboStreak =
                combatComboWindowTimer > 0
                  ? Math.min(99, combatComboStreak + 1)
                  : Math.max(2, elim.stars);
              combatComboWindowTimer = 6.0;
              if (isRushMode && combatComboStreak >= 25) {
                unlockRushMilestoneIfNew('rush_streak_25');
              }

              const killPos = projectWorldToScreenPct(
                gridToWorldX(bug.rail),
                0.85,
                gridToWorldZ(bug.yProgress)
              );
              // Supervivencia already shows the supply popup above; points only matter in campaign.
              if (!isRushMode) stateRef.current.onFloatingCombo?.({
                id: `combo-kill-${bug.id}-${nowMs}`,
                multiplier: combatComboStreak,
                label: bug.bossTier ? '👑 ¡JEFE!' : `+${ptsAwarded}`,
                detail: `x${combatComboStreak}`,
                color: elim.stars === 3 ? 'cyan' : elim.stars === 2 ? 'green' : 'yellow',
                xPct: killPos.xPct,
                yPct: killPos.yPct,
                createdAt: nowMs,
              });

              if (bug.bossTier && isRushMode) {
                lastKillComicPopAt = nowMs;
                stateRef.current.onComicPop({
                  id: `kill-${bug.id}`,
                  title: '👑 ¡ROOMBA DESPLEGADA!',
                  subtitle: 'Roomba Kamikaze patrullando frente a los 4 platos',
                  stars: elim.stars,
                  color: 'cyan',
                  createdAt: nowMs,
                });
              }
            }

            if (!isRushMode && !activeScript) {
              const trans = checkPhaseTransition(phase, phaseKills, stateRef.current.level);
              if (trans.shouldAdvance) {
                if (trans.nextPhase === 'victory') {
                  waveQuotaCompleted = true;
                } else {
                  phase = trans.nextPhase;
                  phaseKills = 0;
                  prepTimer = 3.0;
                  if (phase === 3 && getBossTierForLevel(stateRef.current.level) !== null) {
                    spawnBossForMilestone(stateRef.current.level);
                  } else {
                    spawnWavePreviewBugs(stateRef.current.level, phase);
                  }
                  if (trans.unlockedUtensilOnAdvance) {
                    stateRef.current.onUnlockUtensil(trans.unlockedUtensilOnAdvance);
                  }
                }
              }
            }

            survivingBugs.push(bug);
            continue;
          }

          // Check if Bug reaches the 4 White Gourmet Plates at the Bastion border (z = +4.18 -> yProgress >= 6.85)
          if (bug.yProgress >= 6.85) {
            if (hazmatShieldAvailable) {
              // Traje EPI Amarillo (hazmat_epi): absorbs 1st plate impact of the level!
              hazmatShieldAvailable = false;
              soundEngine.playBleachWave();
              cameraTrauma = 0.45;
              spawnParticles(gridToWorldX(currentRailInt), 0.55, 4.18, 22, 0xfacc15, 3.2);
              stateRef.current.onComicPop({
                id: `hazmat-hit-${Date.now()}`,
                title: '☣️ ¡TRAJE EPI ABSORBIÓ EL GOLPE!',
                subtitle: 'Inmunidad del 1er impacto activada · Platos intactos',
                color: 'yellow',
                createdAt: Date.now(),
              });
              projectiles.push({
                id: `epi-wave-${Date.now()}`,
                x: currentRailInt,
                y: 6.8,
                vx: 0,
                vy: -8.5,
                damage: bug.bossTier ? 160 : 999,
                isEnemy: false,
                flavor: 'bleach_glob',
                pierceShield: true,
                isExplosiveOrThermal: true,
                fromDiagonalFoam: false,
                fromVortex: false,
                life: 1.8,
              });
              if (bug.bossTier) {
                bug.yProgress = 2.4;
              } else {
                continue;
              }
            } else if (armoredPlates > 0) {
              // Coin Booster Plate Armor (Level 15+): absorbs 1 plate hit without losing a Sanitation Seal!
              armoredPlates -= 1;
              soundEngine.playBleachWave();
              cameraTrauma = 0.45;
              spawnParticles(gridToWorldX(currentRailInt), 0.55, 4.18, 20, 0x38bdf8, 3.0);
              stateRef.current.onComicPop({
                id: `armor-plate-${Date.now()}`,
                title: '🛡️ ¡PLATO BLINDADO SALVADO!',
                subtitle: 'El blindaje absorbió el impacto · 3/3 Sellos intactos',
                color: 'cyan',
                createdAt: Date.now(),
              });
              projectiles.push({
                id: `shield-wave-${Date.now()}`,
                x: currentRailInt,
                y: 6.8,
                vx: 0,
                vy: -8.5,
                damage: bug.bossTier ? 160 : 999,
                isEnemy: false,
                flavor: 'bleach_glob',
                pierceShield: true,
                isExplosiveOrThermal: true,
                fromDiagonalFoam: false,
                fromVortex: false,
                life: 1.8,
              });
              if (bug.bossTier) {
                bug.yProgress = 2.4;
              } else {
                continue;
              }
            } else if (sanitationSeals > 0) {
              breachesByBug[bug.type] = (breachesByBug[bug.type] ?? 0) + 1;
              const plateGroup = kitchenProps.bastionPlates[currentRailInt];
              if (plateGroup) {
                const food = plateGroup.getObjectByName('food_content');
                if (food) food.visible = false;
              }
              intactPlates[currentRailInt] = false;
              const lostBuffMeta = MENU_PLATE_BUFF_META[currentRailInt];
              const wasVipLost = vipPlateRail === currentRailInt;
              sanitationSeals -= 1;
              soundEngine.playBleachWave();
              cameraTrauma = 0.7;
              stateRef.current.onComicPop({
                id: `seal-${Date.now()}`,
                title: wasVipLost ? '⭐ ¡PLATO VIP ARRUINADO!' : '🍽️ ¡PLATO ARRUINADO!',
                subtitle: `Buff ${lostBuffMeta.shortTag} apagado (${sanitationSeals}/3 Sellos restantes)`,
                color: 'orange',
                createdAt: Date.now(),
              });
              projectiles.push({
                id: `bleach-wave-${Date.now()}`,
                x: currentRailInt,
                y: 6.8,
                vx: 0,
                vy: -8.5,
                damage: bug.bossTier ? 180 : 999,
                isEnemy: false,
                flavor: 'bleach_glob',
                pierceShield: true,
                isExplosiveOrThermal: true,
                fromDiagonalFoam: false,
                fromVortex: false,
                life: 1.8,
              });
              if (bug.bossTier) {
                bug.yProgress = 2.4; // Push Boss back up the countertop instead of vanishing for free!
              } else {
                continue;
              }
            } else if (!gameEndedLock) {
              breachesByBug[bug.type] = (breachesByBug[bug.type] ?? 0) + 1;
              intactPlates[currentRailInt] = false;
              gameEndedLock = true;
              const trans = checkPhaseTransition(phase, phaseKills, stateRef.current.level);
              const remaining = activeScript
                ? Math.max(1, activeScript.spawns.length - totalBugsCleaned)
                : Math.max(1, trans.targetKillsForCurrentPhase - phaseKills);
              setTimeout(() => {
                stateRef.current.onGameEnd(false, {
                  score,
                  phaseReached: phase,
                  remainingKillsToNext: remaining,
                  bugsCleaned: totalBugsCleaned,
                  killsByStar: [...killsByStar] as [number, number, number],
                  breachesByBug: { ...breachesByBug },
                  vipSaved: false,
                  allFourPlatesIntact: false,
                  survivedSeconds: Math.floor(rushElapsedSec),
                  mergesCount: rushMergesCount,
                  evolutionsCount: rushEvolutionsCount,
                  comandasPicked: rushComandasPicked,
                  milestonesCoins: rushMilestonesCoins,
                });
              }, 450);
            }
          }
        }

        survivingBugs.push(bug);
      }
      bugs = survivingBugs;

      // Trigger Level Victory in Strategic Mode ONLY when vents are closed AND 0 live enemies remain!
      const liveBugsCount = bugs.filter((b) => b.koTimer <= 0).length;
      const bossPending =
        !activeScript && getBossTierForLevel(stateRef.current.level) !== null && !bossSpawnedForLevel;
      const readyForVictory =
        !isRushMode &&
        (waveQuotaCompleted || (stateRef.current.level >= 5 && !activeScript && levelTimer <= 0)) &&
        !bossPending;
      if (waveSimDt > 0 && !gameEndedLock && readyForVictory && liveBugsCount === 0) {
        gameEndedLock = true;
        const vipSaved = vipPlateRail !== null && Boolean(intactPlates[vipPlateRail]);
        const allFourPlatesIntact = intactPlates.every(Boolean);
        setTimeout(() => {
          stateRef.current.onGameEnd(true, {
            score: score + (stateRef.current.level >= 5 ? 250 : 0),
            phaseReached: 3,
            remainingKillsToNext: 0,
            bugsCleaned: totalBugsCleaned,
            killsByStar: [...killsByStar] as [number, number, number],
            breachesByBug: { ...breachesByBug },
            vipSaved,
            allFourPlatesIntact,
          });
        }, 450);
      }

      // Sync 3D Bug Meshes (0.75 normal scale; 1.02 Mini-Boss; 1.24 Grand Boss + crisp white flash & phase-break flash!)
      const activeBugIds = new Set<string>();
      for (const bug of bugs) {
        activeBugIds.add(bug.id);
        if (bug.flashTimer > 0) {
          bug.flashTimer = Math.max(0, bug.flashTimer - dt);
        }

        let mesh = bugMeshes.get(bug.id);
        if (!mesh) {
          mesh = buildBugMesh(bug.type);
          const toonMats: { mat: THREE.MeshToonMaterial; origHex: number }[] = [];
          mesh.traverse((child) => {
            if ((child as THREE.Mesh).isMesh && !child.userData?.isInkOutline) {
              const m = (child as THREE.Mesh).material;
              if (m && (m as THREE.MeshToonMaterial).isMeshToonMaterial) {
                const cloned = (m as THREE.MeshToonMaterial).clone();
                (child as THREE.Mesh).material = cloned;
                toonMats.push({ mat: cloned, origHex: cloned.color.getHex() });
              }
            }
          });
          mesh.userData.toonMats = toonMats;
          mesh.userData.wasWhiteFlashing = false;
          bugsGroup.add(mesh);
          bugMeshes.set(bug.id, mesh);
        }

        const shouldWhiteFlash =
          bug.koTimer <= 0 &&
          (bug.flashTimer > 0 || (bug.bossPhaseFlashTimer ?? 0) > 0);
        if (Boolean(mesh.userData.wasWhiteFlashing) !== shouldWhiteFlash) {
          mesh.userData.wasWhiteFlashing = shouldWhiteFlash;
          const cachedMats = mesh.userData.toonMats as
            | { mat: THREE.MeshToonMaterial; origHex: number }[]
            | undefined;
          if (cachedMats) {
            for (let mIdx = 0; mIdx < cachedMats.length; mIdx++) {
              const entry = cachedMats[mIdx];
              entry.mat.color.setHex(shouldWhiteFlash ? 0xffffff : entry.origHex);
              entry.mat.emissive.setHex(shouldWhiteFlash ? 0x666666 : 0x000000);
            }
          }
        }

        const wx = gridToWorldX(bug.rail);
        const wz = gridToWorldZ(bug.yProgress);
        const gaitBob = bug.koTimer > 0 ? 0 : Math.abs(Math.sin(bug.yProgress * 7)) * 0.1;
        const phaseShake =
          bug.bossPhaseFlashTimer && bug.bossPhaseFlashTimer > 0
            ? Math.sin(elapsed * 75) * 0.16
            : 0;
        mesh.position.set(wx + phaseShake, gaitBob, wz);

        const baseBugScale =
          bug.bossTier === 'grand' ? 1.24 : bug.bossTier === 'mini' ? 1.02 : 0.75;

        if (bug.koTimer > 0) {
          mesh.position.y += (0.4 - bug.koTimer) * 3.8;
          mesh.rotation.y += dt * 18;
          mesh.rotation.x += dt * 12;
          mesh.scale.setScalar(Math.max(0.08, bug.koTimer * 1.8));
        } else {
          mesh.rotation.set(0, Math.sin(bug.yProgress * 5) * 0.09, 0);
          const flashPulse =
            bug.bossPhaseFlashTimer && bug.bossPhaseFlashTimer > 0
              ? 1.15
              : bug.flashTimer > 0
              ? 1.08
              : 1.0;
          mesh.scale.setScalar(baseBugScale * flashPulse);

          const legsObj = mesh.getObjectByName('anim_legs');
          if (legsObj) {
            legsObj.rotation.y = Math.sin(elapsed * 26 + bug.yProgress * 8) * 0.14;
          }
          const tailObj = mesh.getObjectByName('anim_tail');
          if (tailObj) {
            tailObj.rotation.y = Math.sin(elapsed * 12 + bug.yProgress * 6) * 0.35;
          }
          const wingsObj = mesh.getObjectByName('anim_wings');
          if (wingsObj) {
            const leftW = wingsObj.getObjectByName('left_wing');
            const rightW = wingsObj.getObjectByName('right_wing');
            const flap = Math.sin(elapsed * 38) * 0.45;
            if (leftW) leftW.rotation.z = 0.25 + flap;
            if (rightW) rightW.rotation.z = -0.25 - flap;
          }
        }

        const shieldObj = mesh.getObjectByName('bottle_cap_shield');
        if (shieldObj) shieldObj.visible = bug.hasShield;

        const skatesObj = mesh.getObjectByName('foam_skates');
        if (skatesObj) skatesObj.visible = bug.isSlidingFromSoap;
      }
      for (const [id, m] of bugMeshes.entries()) {
        if (!activeBugIds.has(id)) {
          bugsGroup.remove(m);
          disposeBugInstance(m);
          bugMeshes.delete(id);
        }
      }

      // Update Warning Beacons at top of rails (in Strategic Mode Lv.4+, mark all forecast conduits!)
      warningBeacons.forEach((b, rIdx) => {
        const mat = b.material as THREE.MeshBasicMaterial;
        if (isRushMode && gState === 'playing' && rushWaveWarning?.rails.includes(rIdx)) {
          // Wave announced on this rail: fast amber-to-red pulse until it starts.
          const urgent = rushWaveWarning.secondsLeft < 1.2;
          mat.color.setHex(urgent ? 0xef4444 : 0xf59e0b);
          mat.opacity = 0.55 + Math.sin(elapsed * (urgent ? 22 : 12)) * 0.35;
        } else if (inPlacementPhase && stateRef.current.level >= 4 && levelForecast.activeRails.includes(rIdx)) {
          mat.color.setHex(levelForecast.bossTier !== 'none' ? 0xf97316 : 0x38bdf8);
          mat.opacity = 0.36 + Math.sin(elapsed * 7 + rIdx) * 0.2;
        } else if (warningRails[rIdx]) {
          mat.color.setHex(0xef4444);
          mat.opacity = 0.48 + Math.sin(elapsed * 12) * 0.32;
        } else {
          mat.opacity = 0;
        }
      });

      // Sync "Menú Vivo" Plate Micro-Indicators & VIP Critic Golden Rim
      kitchenProps.bastionPlates.forEach((plate, rIdx) => {
        plate.scale.setScalar(armoredPlates > 0 ? 0.9 + Math.sin(elapsed * 6) * 0.03 : 0.86);
        const microInd = plateBuffIndicators[rIdx];
        if (microInd) {
          microInd.visible = gState === 'playing' && intactPlates[rIdx];
          if (microInd.visible) {
            const s = 0.94 + Math.sin(elapsed * 4.2 + rIdx) * 0.08;
            microInd.scale.setScalar(s);
          }
        }
        const vipHalo = plateVipHalos[rIdx];
        if (vipHalo) {
          vipHalo.visible = vipPlateRail === rIdx && intactPlates[rIdx];
          if (vipHalo.visible) {
            vipHalo.rotation.z = elapsed * 1.2;
          }
        }
      });

      // Animate 3D Kitchen Towel Whip Arc ("Trapazo de cocina")
      if (towelWhipAnim.timer > 0) {
        towelWhipAnim.timer = Math.max(0, towelWhipAnim.timer - dt);
        towelWhipGroup.visible = true;
        const progressWhip = 1 - towelWhipAnim.timer / 0.28;
        const snapReach = Math.sin(progressWhip * Math.PI);
        for (let segIdx = 0; segIdx < 6; segIdx++) {
          const seg = towelWhipGroup.getObjectByName(`towel_seg_${segIdx}`);
          if (!seg) continue;
          const u = ((segIdx + 1) / 6) * snapReach;
          const sx = THREE.MathUtils.lerp(towelWhipAnim.startX, towelWhipAnim.targetX, u);
          const sz = THREE.MathUtils.lerp(towelWhipAnim.startZ, towelWhipAnim.targetZ, u);
          const archY = 0.55 + Math.sin(u * Math.PI) * 0.55;
          seg.position.set(sx + Math.sin(progressWhip * 16 + segIdx) * 0.08, archY, sz);
          seg.rotation.y = Math.atan2(
            towelWhipAnim.targetX - towelWhipAnim.startX,
            towelWhipAnim.targetZ - towelWhipAnim.startZ
          );
        }
      } else {
        towelWhipGroup.visible = false;
      }

      // Find closest threat on the countertop for reactive Chef gaze & final-third sweat drops
      let closestThreatBug: BugEnemy | null = null;
      for (const b of bugs) {
        if (b.koTimer <= 0 && (!closestThreatBug || b.yProgress > closestThreatBug.yProgress)) {
          closestThreatBug = b;
        }
      }
      const threatInFinalThird =
        gState === 'playing' &&
        !inPlacementPhase &&
        Boolean(closestThreatBug && closestThreatBug.yProgress >= 4.55);
      const chefWhipThreatReady = threatInFinalThird && chefWhipCooldown <= 0;

      // Animate 3D Chef Bastion at z = +4.72, y = -0.24 (kept 100% untouched in proportions!)
      const threatWorldX = closestThreatBug ? gridToWorldX(closestThreatBug.rail) : chefTargetX;
      const targetChefX = stateRef.current.wardrobeOpen
        ? 0
        : (closestThreatBug ? threatWorldX * 0.34 : chefTargetX * 0.42);
      chefAnchor.position.x = THREE.MathUtils.damp(chefAnchor.position.x, targetChefX, 6, dt);
      chefAnchor.position.z = 4.72;
      chefAnchor.scale.setScalar(stateRef.current.wardrobeOpen ? 1.38 : 1.08);
      const targetRotY = stateRef.current.wardrobeOpen
        ? stateRef.current.wardrobeYawRef?.current ?? 0
        : Math.PI;
      chefAnchor.rotation.y = THREE.MathUtils.damp(chefAnchor.rotation.y, targetRotY, 12, dt);
      const chefInner = chefAnchor.getObjectByName('chef_inner');
      if (chefInner) {
        chefInner.rotation.x = stateRef.current.wardrobeOpen ? 0 : -0.22;
      }

      // Orient Chef head toward the rail with the closest threat + update Hat Cooldown Ring & Sweat Drops
      const headPivot = chefAnchor.getObjectByName('chef_head_pivot');
      if (headPivot) {
        const desiredHeadYaw =
          stateRef.current.wardrobeOpen || gState !== 'playing' || !closestThreatBug
            ? 0
            : THREE.MathUtils.clamp(-(threatWorldX - chefAnchor.position.x) * 0.22, -0.52, 0.52);
        headPivot.rotation.y = THREE.MathUtils.damp(headPivot.rotation.y, desiredHeadYaw, 10, dt);

        const hatRing = headPivot.getObjectByName('chef_hat_cooldown_ring') as THREE.Mesh | undefined;
        if (hatRing) {
          hatRing.visible = gState === 'playing' && !stateRef.current.wardrobeOpen;
          const ringMat = hatRing.material as THREE.MeshBasicMaterial;
          if (chefWhipCooldown <= 0) {
            ringMat.color.setHex(chefWhipThreatReady ? 0x4ade80 : 0xfde047);
            ringMat.opacity = chefWhipThreatReady
              ? 0.78 + Math.sin(elapsed * 12) * 0.2
              : 0.42 + Math.sin(elapsed * 3.5) * 0.1;
            const ringPulse = chefWhipThreatReady ? 1.06 + Math.sin(elapsed * 12) * 0.06 : 1.0;
            hatRing.scale.setScalar(ringPulse);
          } else {
            const maxWhipCd = Math.max(1, upgradeEffects.effectiveWhipCooldownSec);
            const readyFrac = THREE.MathUtils.clamp(1 - chefWhipCooldown / maxWhipCd, 0, 1);
            ringMat.color.setHex(0x38bdf8);
            ringMat.opacity = 0.14 + readyFrac * 0.26;
            hatRing.scale.setScalar(0.86 + readyFrac * 0.14);
          }
        }

        const sweatGroup = headPivot.getObjectByName('chef_sweat_drops');
        if (sweatGroup) {
          sweatGroup.visible = threatInFinalThird && !stateRef.current.wardrobeOpen;
          if (sweatGroup.visible) {
            for (let sIdx = 0; sIdx < 2; sIdx++) {
              const drop = sweatGroup.getObjectByName(`sweat_drop_${sIdx}`);
              if (drop) {
                const cycle = (elapsed * 3.6 + sIdx * 0.5) % 1;
                drop.position.y = 1.96 - cycle * 0.36;
                drop.scale.setScalar(Math.sin(cycle * Math.PI) * 1.15);
              }
            }
          }
        }
      }

      const baseChefY = stateRef.current.wardrobeOpen ? 0.35 : -0.24;
      if (chefCelebrateTimer > 0) {
        chefCelebrateTimer = Math.max(0, chefCelebrateTimer - dt);
        chefAnchor.position.y = baseChefY + Math.abs(Math.sin(elapsed * 18)) * 0.24;
      } else {
        chefAnchor.position.y = baseChefY + Math.sin(elapsed * 3.2) * 0.03;
      }
      const armL = chefAnchor.getObjectByName('chef_arm_l');
      const armR = chefAnchor.getObjectByName('chef_arm_r');
      const armWave =
        towelWhipAnim.timer > 0
          ? 1.15
          : chefCelebrateTimer > 0
          ? Math.sin(elapsed * 22) * 0.68
          : threatInFinalThird
          ? Math.sin(elapsed * 14) * 0.26
          : Math.sin(elapsed * 4.5) * 0.14;
      if (armL) armL.rotation.z = -0.42 + armWave * 0.7;
      if (armR) armR.rotation.z = 0.42 - armWave;

      // Update Pooled InstancedMesh Particles
      for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
        const p = particles[i];
        if (p.active) {
          p.life -= dt;
          if (p.life <= 0) {
            p.active = false;
            _dummyObj.position.set(0, -100, 0);
            _dummyObj.scale.setScalar(0.001);
          } else {
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vy -= 6.5 * dt;
            p.z += p.vz * dt;
            _dummyObj.position.set(p.x, Math.max(0.05, p.y), p.z);
            const s = (p.life / p.maxLife) * p.scale;
            _dummyObj.scale.setScalar(s);
            particleInstanced.setColorAt(i, p.color);
          }
        } else {
          _dummyObj.position.set(0, -100, 0);
          _dummyObj.scale.setScalar(0.001);
        }
        _dummyObj.updateMatrix();
        particleInstanced.setMatrixAt(i, _dummyObj.matrix);
      }
      particleInstanced.instanceMatrix.needsUpdate = true;
      if (particleInstanced.instanceColor) {
        particleInstanced.instanceColor.needsUpdate = true;
      }

      // Throttle React HUD state updates to <= 10Hz (or flush immediately when hudEmitTimer >= 0.1)
      hudEmitTimer += wallDt;
      if (hudEmitTimer >= 0.1) {
        hudEmitTimer = 0;
        const trans = checkPhaseTransition(phase, phaseKills, stateRef.current.level);
        const liveBoss = bugs.find((b) => Boolean(b.bossTier) && b.koTimer <= 0);
        const bossHud: ActiveBossHudInfo | null =
          liveBoss && liveBoss.bossTier
            ? {
                id: liveBoss.id,
                tier: liveBoss.bossTier,
                name:
                  liveBoss.bossTier === 'grand'
                    ? `GRAN JEFE NV.${stateRef.current.level} · REY DE LA OLLA`
                    : `MINI-JEFE NV.${stateRef.current.level} · CAPATAZ BLINDADO`,
                hpPct: Math.round(Math.max(0, Math.min(100, (liveBoss.hp / liveBoss.maxHp) * 100))),
                phase: liveBoss.bossPhase ?? 1,
                phaseLabel: getGrandBossPhaseLabel(liveBoss.bossPhase ?? 1, liveBoss.bossTier),
                armorMelted: Boolean(liveBoss.bossArmorBroken || !liveBoss.hasShield),
                phaseJustBroke: Boolean((liveBoss.bossPhaseFlashTimer ?? 0) > 0),
              }
            : null;

        // Immediately clear tutorialTargetScreen while dragging/selecting OR as soon as target is placed!
        const freshGuide =
          gState === 'playing' && !isRushMode
            ? getTutorialGuideForLevel(stateRef.current.level, piecesRef.current)
            : null;
        let tutorialTargetScreen: HudSnapshot['tutorialTargetScreen'] = null;
        if (freshGuide?.nextTarget && !isActivelyDragging && !isPieceSelected) {
          const tScr = projectWorldToScreenPct(
            gridToWorldX(freshGuide.nextTarget.rail),
            0.45,
            gridToWorldZ(freshGuide.nextTarget.row)
          );
          tutorialTargetScreen = {
            xPct: tScr.xPct,
            yPct: tScr.yPct,
            shortTag: freshGuide.nextTarget.shortTag,
            pieceId: freshGuide.nextTarget.pieceId,
          };
        }

        let evolutionPreviewScreen: RushHudSnapshot['evolutionPreviewScreen'] = null;
        if (
          isRushMode &&
          evolutionPartners.length > 0 &&
          evolutionPartners[0].partner.rail !== null &&
          evolutionPartners[0].partner.row !== null
        ) {
          const epScr = projectWorldToScreenPct(
            gridToWorldX(evolutionPartners[0].partner.rail),
            0.95,
            gridToWorldZ(evolutionPartners[0].partner.row)
          );
          evolutionPreviewScreen = {
            xPct: epScr.xPct,
            yPct: epScr.yPct,
            label: '✨ ¡EVOLUCIONAR!',
            evoName: evolutionPartners[0].evolution.shortName,
          };
        }

        const liveRushArsenal = isRushMode
          ? computeRushArsenalMetrics(piecesRef.current)
          : { weaponCount: 0, averageLevel: 0, arsenalPower: 0 };
        const liveDeployCost = computeRushDeployCostForBoard(piecesRef.current);
        const liveSupplyMax = computeRushSupplyMax(liveDeployCost);
        const rushHud: RushHudSnapshot | null = isRushMode
          ? {
              elapsedSec: Math.floor(rushElapsedSec),
              supply: Math.round(rushSupply),
              supplyCost: liveDeployCost,
              supplyMax: liveSupplyMax,
              boardWeaponCount: liveRushArsenal.weaponCount,
              maxBoardWeapons: computeRushBoardWeaponCap(rushLevel),
              capFlashActive: rushCapFlashTimer > 0,
              frenzy: getFrenzyThermometer(rushElapsedSec),
              xpPct: Math.min(100, Math.round((rushXp / Math.max(1, rushXpNext)) * 100)),
              rushLevel,
              activeComandas,
              comandaTimer: Number(comandaTimer.toFixed(1)),
              roombaActive: patrolRoombaActive,
              vetoedTypes: rushModifiers.vetoedTypes,
              evolutionPreviewScreen,
            }
          : null;

        stateRef.current.onHudUpdate({
          phase,
          inPlacementPhase,
          phaseKills: activeScript ? totalBugsCleaned : phaseKills,
          phaseTargetKills: activeScript ? activeScript.spawns.length : trans.targetKillsForCurrentPhase,
          sanitationSeals,
          score,
          pressurePct: Math.round(pressurePct),
          slowMoActive: !inPlacementPhase && timeScale < 0.5,
          prepTimer,
          levelTimer: Math.ceil(levelTimer),
          biome: activeBiome,
          smartComboHintMessage: null,
          selectedPieceId: activePieceId,
          inspectionTarget: effectiveInspection,
          hoveredCell,
          activeWarningRails: warningRails,
          pieces: piecesRef.current,
          hazmatShieldReady: hazmatShieldAvailable,
          armoredPlates,
          lastStandActive: lastStandTimer > 0,
          forecast: levelForecast,
          bossHud,
          intactPlates: [...intactPlates] as [boolean, boolean, boolean, boolean],
          vipPlateRail,
          chefWhipCooldown: Number(chefWhipCooldown.toFixed(1)),
          chefWhipThreatReady,
          streakCount: activeStreakTimer > 0 ? activeStreakCount : 0,
          rushHud,
          tutorialTargetScreen,
        });
      }

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    frameId = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={mountRef}
      data-testid="chef-bastion-canvas"
      className="fixed inset-0 w-full h-full overflow-hidden select-none"
    />
  );
};
