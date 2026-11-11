import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { soundEngine } from '../game/audio';
import {
  addInkOutline,
  buildBugMesh,
  buildChefBastionMesh,
  buildGhostUtensilMesh,
  buildOvercookedKitchenProps,
  buildUtensilMesh,
  createBacksplashTileTexture,
  createKitchenFloorTileTexture,
  createOuterTableWoodTexture,
  createToonMaterial,
  createWoodGrainTexture,
} from '../game/models3d';
import {
  buildPlacementComboNotification,
  checkPhaseTransition,
  classifyBugElimination,
  computeBossDamageMultiplier,
  computeDragComboPreviewLinks,
  computeSmartComboHints,
  computeWeaponRangeCells,
  createInitialBoardPieces,
  DEFAULT_SETTINGS,
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
  isBiomeTransitionLevel,
  isDynamicOnboardingLevel,
  LEVEL_DURATION_SECONDS,
  MIN_PLACEABLE_ROW,
  moveOrSwapUtensil,
  WORLDS_CATALOG,
} from '../game/rules';
import {
  ActiveBossHudInfo,
  ArmorId,
  BiomeConfig,
  BugEnemy,
  BugType,
  ComicPopEvent,
  FloatingComboEvent,
  GameSettings,
  GameState,
  HatId,
  KillStarRating,
  LevelForecast,
  Projectile,
  SpecialWeaponId,
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
  hoveredCell: { rail: number; row: number } | null;
  activeWarningRails: (BugType | null)[];
  pieces: UtensilPiece[];
  hazmatShieldReady: boolean;
  armoredPlates: number;
  lastStandActive: boolean;
  forecast: LevelForecast;
  bossHud: ActiveBossHudInfo | null;
  tutorialTargetScreen: {
    xPct: number;
    yPct: number;
    shortTag: string;
    pieceId: string;
  } | null;
}

interface ChefBastionCanvasProps {
  gameState: GameState;
  wardrobeOpen?: boolean;
  worldId: WorldId;
  level: number;
  hatId: HatId;
  armorId: ArmorId;
  specialWeaponId: SpecialWeaponId;
  settings?: GameSettings;
  piecesRef: React.MutableRefObject<UtensilPiece[]>;
  selectedPieceIdRef: React.MutableRefObject<string | null>;
  triggerUltimateRef: React.MutableRefObject<boolean>;
  startWaveRef: React.MutableRefObject<boolean>;
  dragPointerRef?: React.MutableRefObject<DragPointerState>;
  boostUltimateRef?: React.MutableRefObject<boolean>;
  boostPlateShieldRef?: React.MutableRefObject<boolean>;
  resetSignal: number;
  onHudUpdate: (snap: HudSnapshot) => void;
  onComicPop: (pop: ComicPopEvent) => void;
  onFloatingCombo?: (evt: FloatingComboEvent) => void;
  onUnlockUtensil: (uType: UtensilType) => void;
  onAchievementKill: (achId: string, stars: KillStarRating, coinsEarned: number) => void;
  onGameEnd: (victory: boolean, finalStats: {
    score: number;
    phaseReached: number;
    remainingKillsToNext: number;
    bugsCleaned: number;
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

export const ChefBastionCanvas: React.FC<ChefBastionCanvasProps> = ({
  gameState,
  wardrobeOpen = false,
  worldId,
  level,
  hatId,
  armorId,
  specialWeaponId,
  settings = DEFAULT_SETTINGS,
  piecesRef,
  selectedPieceIdRef,
  triggerUltimateRef,
  startWaveRef,
  dragPointerRef,
  boostUltimateRef,
  boostPlateShieldRef,
  resetSignal,
  onHudUpdate,
  onComicPop,
  onFloatingCombo,
  onUnlockUtensil,
  onAchievementKill,
  onGameEnd,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);

  // Store latest props/callbacks in refs so the 60fps WebGL loop never tears down the canvas
  const stateRef = useRef({
    gameState,
    wardrobeOpen,
    worldId,
    level,
    hatId,
    armorId,
    specialWeaponId,
    settings,
    dragPointerRef,
    boostUltimateRef,
    boostPlateShieldRef,
    onHudUpdate,
    onComicPop,
    onFloatingCombo,
    onUnlockUtensil,
    onAchievementKill,
    onGameEnd,
  });
  useEffect(() => {
    stateRef.current = {
      gameState,
      wardrobeOpen,
      worldId,
      level,
      hatId,
      armorId,
      specialWeaponId,
      settings,
      dragPointerRef,
      boostUltimateRef,
      boostPlateShieldRef,
      onHudUpdate,
      onComicPop,
      onFloatingCombo,
      onUnlockUtensil,
      onAchievementKill,
      onGameEnd,
    };
  }, [
    gameState,
    wardrobeOpen,
    worldId,
    level,
    hatId,
    armorId,
    specialWeaponId,
    settings,
    dragPointerRef,
    boostUltimateRef,
    boostPlateShieldRef,
    onHudUpdate,
    onComicPop,
    onFloatingCombo,
    onUnlockUtensil,
    onAchievementKill,
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

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
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
    // 9:16 FULL-SCREEN KITCHEN PERSPECTIVE CAMERA (MATCHING 1794109185461.jpg)
    // =========================================================================
    const camera = new THREE.PerspectiveCamera(44, initW / initH, 0.1, 80);
    function updateCameraProjection(w: number, h: number) {
      const aspect = w / h;
      camera.aspect = aspect;
      if (aspect < 0.85) {
        // Ensure full horizontal table fit AND full vertical fit (including Chef & table legs above the bottom dock)
        const halfVFovByWidth = Math.atan(0.232 / aspect);
        const minVFovDeg = 47;
        camera.fov = THREE.MathUtils.clamp(
          Math.max(minVFovDeg, THREE.MathUtils.radToDeg(halfVFovByWidth * 2)),
          47,
          54
        );
      } else {
        camera.fov = 46;
      }
      camera.updateProjectionMatrix();
    }
    updateCameraProjection(initW, initH);
    camera.position.set(0, 9.5, 10.2);
    camera.lookAt(0, -0.46, 0.16);

    // 3-Point Warm Cel-Shading Lighting Rig + 2048x2048 Crisp Shadows
    const hemiLight = new THREE.HemisphereLight(0xfffbeb, 0xfde68a, 1.05);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfff7ed, 1.9);
    sunLight.position.set(-5.2, 12.8, 5.2);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(2048, 2048);
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
    slab.receiveShadow = true;
    addInkOutline(slab, 0.055);
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

    // Invisible Raycast Targets + Subtle Wood-Engraved Placement Spots + Live Range / Dim Pads + Holographic Frames
    const interactableCells: THREE.Mesh[] = [];
    const cellHighlights: THREE.Mesh[][] = [];
    const cellRangePads: THREE.Mesh[][] = [];
    const cellSpots: (THREE.Mesh | null)[][] = [];
    const invisibleHitMat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });

    for (let r = 0; r < GRID_RAILS; r++) {
      cellHighlights[r] = [];
      cellRangePads[r] = [];
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

    // Crisp Neon Violet UV Laser / Electric Beam (#A855F7 / #E879F9 + #F5D0FE core) between Aerosol UV cans
    function createNeonUvLaserStream(): THREE.Group {
      const uvStream = new THREE.Group();
      uvStream.name = 'fire_stream';

      const outerVioletMat = new THREE.MeshBasicMaterial({
        color: 0xa855f7,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      });
      const neonMagentaMat = new THREE.MeshBasicMaterial({
        color: 0xe879f9,
        depthTest: false,
      });
      const electricCoreMat = new THREE.MeshBasicMaterial({
        color: 0xf5d0fe,
        depthTest: false,
      });

      // Continuous crisp laser core beam spanning nozzle-to-nozzle (-0.5..+0.5 along Z)
      const laserOuter = new THREE.Mesh(
        new THREE.CylinderGeometry(0.09, 0.09, 1.0, 14),
        outerVioletMat
      );
      laserOuter.rotation.x = Math.PI / 2;
      laserOuter.renderOrder = 10;

      const laserCore = new THREE.Mesh(
        new THREE.CylinderGeometry(0.036, 0.036, 1.02, 12),
        electricCoreMat
      );
      laserCore.rotation.x = Math.PI / 2;
      laserCore.renderOrder = 12;
      uvStream.add(laserOuter, laserCore);

      const nodeCount = 11;
      for (let k = 0; k < nodeCount; k++) {
        const u = k / (nodeCount - 1);
        const t = u - 0.5;
        const env = Math.sin(u * Math.PI);
        const radiusScale = 0.34 + env * 0.62;

        const nodeGroup = new THREE.Group();
        nodeGroup.name = `flame_node_${k}`;
        nodeGroup.position.set(0, 0, t);

        const plasmaOrb = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.095 * radiusScale, 0),
          k % 2 === 0 ? neonMagentaMat : outerVioletMat
        );
        plasmaOrb.scale.set(1.15, 1.15, 1.5);
        plasmaOrb.renderOrder = 11;

        const sparkCore = new THREE.Mesh(
          new THREE.SphereGeometry(0.048 * radiusScale, 10, 10),
          electricCoreMat
        );
        sparkCore.renderOrder = 12;

        nodeGroup.add(plasmaOrb, sparkCore);
        uvStream.add(nodeGroup);
      }

      return uvStream;
    }

    // Pre-Drop Synergy Electric Arc Pool (connects hovered drag target to already-placed combo partner BEFORE finger release)
    const synergyArcPool: THREE.Group[] = [];
    for (let aIdx = 0; aIdx < 4; aIdx++) {
      const arcGroup = new THREE.Group();
      arcGroup.visible = false;
      for (let s = 0; s < 7; s++) {
        const seg = new THREE.Mesh(
          new THREE.CylinderGeometry(0.035, 0.035, 0.16, 8),
          new THREE.MeshBasicMaterial({
            color: s % 2 === 0 ? 0xe879f9 : 0x22d3ee,
            depthTest: false,
          })
        );
        seg.rotation.x = Math.PI / 2;
        seg.name = `arc_seg_${s}`;
        seg.renderOrder = 15;
        arcGroup.add(seg);
      }
      worldGroup.add(arcGroup);
      synergyArcPool.push(arcGroup);
    }

    // =========================================================================
    // 3D COMBO VISUALS:
    // 1. Neon Violet Laser / Electric UV Beam (#A855F7 / #E879F9) between Aerosol UV cans
    // 2. Upward (-Z) Translucent Cyan-White Spray Cone + 3D Glossy Soap Bubbles in front of Estropajo (line_foam)
    // =========================================================================
    const circuitPool: THREE.Group[] = [];
    for (let i = 0; i < 12; i++) {
      const linkGroup = new THREE.Group();
      linkGroup.visible = false;

      // 1. Neon Violet UV Laser Stream for bridge_uv
      const fireStream = createNeonUvLaserStream();
      linkGroup.add(fireStream);

      // 2. Upward (-Z, toward plagues!) Translucent Cyan-Green Spray Cone + Glossy Soap Bubbles for line_foam
      const foamSpray = new THREE.Group();
      foamSpray.name = 'foam_spray';
      const sprayCone = new THREE.Mesh(
        new THREE.ConeGeometry(0.95, 2.3, 24, 1, true),
        new THREE.MeshBasicMaterial({
          color: 0x67e8f9,
          transparent: true,
          opacity: 0.32,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      );
      sprayCone.rotation.x = Math.PI / 2;
      sprayCone.scale.set(1.05, 1.0, 0.26);
      sprayCone.position.set(0, 0.36, -1.15);
      foamSpray.add(sprayCone);

      const bubbleSpecs = [
        [0.0, 0.38, -0.62, 0.16],
        [-0.32, 0.42, -0.92, 0.2],
        [0.34, 0.4, -0.98, 0.18],
        [-0.58, 0.38, -1.32, 0.25],
        [0.06, 0.44, -1.38, 0.28],
        [0.6, 0.38, -1.44, 0.24],
        [-0.36, 0.36, -1.78, 0.31],
        [0.38, 0.36, -1.84, 0.29],
      ];
      const bubbleShellMat = createToonMaterial(0xccfbf1, {
        transparent: true,
        opacity: 0.86,
      });
      const bubbleSpecMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      bubbleSpecs.forEach(([bx, by, bz, br], bIdx) => {
        const bGroup = new THREE.Group();
        bGroup.position.set(bx, by, bz);
        bGroup.userData = { baseX: bx, baseY: by, baseZ: bz };
        bGroup.name = `soap_bubble_${bIdx}`;
        const sphere = new THREE.Mesh(new THREE.SphereGeometry(br, 24, 24), bubbleShellMat);
        const glint = new THREE.Mesh(new THREE.SphereGeometry(br * 0.28, 16, 16), bubbleSpecMat);
        glint.position.set(-br * 0.35, br * 0.45, -br * 0.25);
        glint.userData.skipOutline = true;
        bGroup.add(sphere, glint);
        addInkOutline(bGroup, 0.025, 0x06b6d4);
        foamSpray.add(bGroup);
      });
      linkGroup.add(foamSpray);

      // Default floor bar for slip_vortex / deflect_90
      const floorBar = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.04, 1.0),
        new THREE.MeshBasicMaterial({ color: 0x2dd4bf, transparent: true, opacity: 0.85 })
      );
      floorBar.name = 'floor_bar';
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
    scene.add(
      utensilsGroup,
      ghostTutorialGroup,
      dragGhostGroup,
      bugsGroup,
      projectilesGroup,
      chefAnchor
    );

    // Zero-GC Pooled Particle Ring Buffer (InstancedMesh for flour puffs, foam splashes & sparkles)
    const particleGeo = new THREE.SphereGeometry(0.1, 8, 8);
    const particleMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const particleInstanced = new THREE.InstancedMesh(particleGeo, particleMat, PARTICLE_POOL_SIZE);
    particleInstanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    particleInstanced.frustumCulled = false;
    scene.add(particleInstanced);

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
    const _dummyObj = new THREE.Object3D();

    function spawnParticles(
      wx: number,
      wy: number,
      wz: number,
      count: number,
      hex: number,
      speed = 2.4
    ) {
      for (let i = 0; i < count; i++) {
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
      for (let i = 0; i < 6; i++) {
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

    // Build Chef Mesh and rebuild when equipped Hat or Armor changes
    let currentChefKey = '';
    function syncChefModel() {
      const key = `${stateRef.current.hatId}_${stateRef.current.armorId}`;
      if (key === currentChefKey) return;
      currentChefKey = key;
      chefAnchor.clear();
      const chefMesh = buildChefBastionMesh(stateRef.current.hatId, stateRef.current.armorId);
      chefAnchor.add(chefMesh);
    }
    syncChefModel();

    // Map of UtensilPiece.id -> THREE.Group
    const utensilMeshes = new Map<string, { group: THREE.Group; type: UtensilType; bounce: number }>();
    let currentGhostType: UtensilType | null = null;
    let currentGhostMesh: THREE.Group | null = null;
    let currentDragGhostType: UtensilType | null = null;
    const bugMeshes = new Map<string, THREE.Group>();
    const projMeshes = new Map<string, THREE.Object3D>();

    // Active Simulation State
    let bugs: BugEnemy[] = [];
    let projectiles: Projectile[] = [];
    let phase: 1 | 2 | 3 = 1;
    let inPlacementPhase = !isDynamicOnboardingLevel(stateRef.current.level);
    let phaseKills = 0;
    let totalBugsCleaned = 0;
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
    const _projVec = new THREE.Vector3();
    const _dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.72);
    const _dragWorldPt = new THREE.Vector3();

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

    function spawnBossForMilestone(lvl: number) {
      const tier = getBossTierForLevel(lvl);
      if (!tier || bossSpawnedForLevel) return;
      bossSpawnedForLevel = true;
      const puzzle = getBossPuzzleTypeForLevel(lvl) ?? 'uv_overheat';
      const maxHp = tier === 'grand' ? Math.round(340 + lvl * 12) : Math.round(210 + lvl * 8);
      const spawnRail = puzzle === 'soap_stun' ? 2 : 1;
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
        if (m) bugsGroup.remove(m);
      });
      bugMeshes.clear();
      projectiles.forEach((p) => {
        const m = projMeshes.get(p.id);
        if (m) projectilesGroup.remove(m);
      });
      projMeshes.clear();
      utensilMeshes.forEach((entry) => {
        utensilsGroup.remove(entry.group);
      });
      utensilMeshes.clear();

      // CRITICAL RULE 1: Ensure board starts 100% EMPTY (all pieces in tray) on every level start/reset!
      if (piecesRef.current.some((p) => p.rail !== null || p.row !== null) || piecesRef.current.length === 0) {
        piecesRef.current = createInitialBoardPieces(stateRef.current.level);
      }

      const currentLvl = stateRef.current.level;
      const dynamicOnboarding = isDynamicOnboardingLevel(currentLvl);

      bugs = [];
      projectiles = [];
      phase = 1;
      // Levels 1-3 skip Strategic Mode pause and start directly with live plague advance!
      inPlacementPhase = !dynamicOnboarding;
      startWaveRef.current = false;
      phaseKills = 0;
      totalBugsCleaned = 0;
      score = 0;
      sanitationSeals = 3;
      armoredPlates = 0;
      hazmatShieldAvailable = stateRef.current.armorId === 'hazmat_epi';
      lastStandTriggered = false;
      lastStandTimer = 0;
      bossSpawnedForLevel = false;
      pressurePct = 45;
      spawnTimer = dynamicOnboarding ? 3.2 : 2.4;
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
      isDraggingOnCanvas = false;
      if (stateRef.current.dragPointerRef) {
        stateRef.current.dragPointerRef.current.active = false;
        stateRef.current.dragPointerRef.current.pieceId = null;
      }

      const forecast = getLevelForecast(currentLvl);
      kitchenProps.lateralVents.forEach((lv) => {
        lv.visible = currentLvl >= 31 || forecast.hasLateralConduits;
      });

      if (isBiomeTransitionLevel(currentLvl) && lastAnnouncedBiomeLevel !== currentLvl) {
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

      kitchenProps.bastionPlates.forEach((plate) => {
        plate.visible = true;
        plate.scale.setScalar(0.86);
        const food = plate.getObjectByName('food_content');
        if (food) food.visible = true;
      });

      spawnWavePreviewBugs(currentLvl, 1);
      selectNextTrayPieceIfAny();
    }

    resetSimulation();

    // Pointer / Touch Raycasting for Drag & Drop (with -45px Y finger offset) + Tap-to-Swap
    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();

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

    function handlePostPlacementSelection() {
      if (inPlacementPhase) {
        selectNextTrayPieceIfAny();
      } else {
        selectedPieceIdRef.current = null;
      }
    }

    function commitDropOntoCell(pieceId: string, cell: { rail: number; row: number }) {
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
    }

    const onPointerDown = (e: PointerEvent) => {
      if (stateRef.current.gameState !== 'playing') return;
      if (simResetRef.current !== lastKnownReset) {
        lastKnownReset = simResetRef.current;
        resetSimulation();
      }
      lastPointerClientX = e.clientX;
      lastPointerClientY = e.clientY;
      const cell = getCellUnderPointer(e.clientX, e.clientY, false);
      if (!cell) return;

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
          soundEngine.playSlowMoEnter();
          return;
        }

        if (cell.row < MIN_PLACEABLE_ROW) {
          soundEngine.playShieldClink();
          return;
        }

        commitDropOntoCell(currentSelected, cell);
        isDraggingOnCanvas = false;
      } else if (occupant) {
        selectedPieceIdRef.current = occupant.id;
        isDraggingOnCanvas = true;
        hoveredCell = cell;
        soundEngine.playSlowMoEnter();
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (stateRef.current.gameState !== 'playing') return;
      lastPointerClientX = e.clientX;
      lastPointerClientY = e.clientY;
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

    // ResizeObserver for crisp viewport scaling (95% board width fill on mobile portrait)
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        const h = entry.contentRect.height;
        if (w > 0 && h > 0) {
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
    let hudEmitTimer = 0;

    function tick() {
      if (disposed) return;
      const rawDt = clock.getDelta();
      const dt = Math.min(rawDt, 0.05);
      const elapsed = clock.getElapsedTime();

      if (simResetRef.current !== lastKnownReset) {
        lastKnownReset = simResetRef.current;
        resetSimulation();
      }

      syncChefModel();

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
      const levelForecast = getLevelForecast(stateRef.current.level);
      kitchenProps.lateralVents.forEach((lv) => {
        lv.visible = stateRef.current.level >= 31 || levelForecast.hasLateralConduits;
      });

      const gState = stateRef.current.gameState;

      if (stateRef.current.wardrobeOpen) {
        const previewSway = Math.sin(elapsed * 1.4) * 0.45;
        camera.position.x = THREE.MathUtils.damp(camera.position.x, previewSway, 6, dt);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, 3.5, 6, dt);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, 9.1, 6, dt);
        camera.lookAt(0, -0.1, 4.72);
      } else if (gState === 'title') {
        const tourX = Math.sin(elapsed * 0.45) * 1.1;
        const tourZ = 10.1 + Math.cos(elapsed * 0.35) * 0.35;
        camera.position.x = THREE.MathUtils.damp(camera.position.x, tourX, 3, dt);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, 9.5, 3, dt);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, tourZ, 3, dt);
        camera.lookAt(0, -0.46, 0.16);
      } else {
        const cfg = stateRef.current.settings ?? DEFAULT_SETTINGS;
        cameraTrauma = Math.max(0, cameraTrauma - dt * 2.4);
        const shake = cfg.screenShake ? cameraTrauma * cameraTrauma * 0.32 : 0;
        const shakeX = (Math.random() - 0.5) * shake;
        const shakeZ = (Math.random() - 0.5) * shake;
        camera.position.x = THREE.MathUtils.damp(camera.position.x, shakeX, 10, dt);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, 9.5, 8, dt);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, 10.2 + shakeZ, 10, dt);
        camera.lookAt(0, -0.46, 0.16);
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
            }
          }
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

      const timeScale =
        gState !== 'playing'
          ? 0
          : hitstopTimer > 0
          ? 0.04
          : isPieceSelected && !inPlacementPhase && activeSettings.tacticalSlowMo
          ? 0.2
          : lastStandTimer > 0
          ? 0.35 // Salvada In Extremis: 1.2s at 0.35x timeScale!
          : activeSettings.gameSpeedMultiplier;

      const simDt = dt * timeScale;

      // Evaluate combos & update 3D Combo Visuals (Neon Violet UV Laser at y=0.78, Cyan Soap Bubble Fan, or Vortex Bar)
      const comboEval = evaluateBoardCombos(piecesRef.current);
      piecesRef.current = comboEval.updatedPieces;

      circuitPool.forEach((linkGroup, idx) => {
        const link = comboEval.links[idx];
        if (!link) {
          linkGroup.visible = false;
          return;
        }
        linkGroup.visible = true;
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
            for (let k = 0; k < 11; k++) {
              const node = fireStream.getObjectByName(`flame_node_${k}`);
              if (node) {
                const waveX = Math.sin(elapsed * 34 + k * 1.4 + idx) * 0.032;
                const waveY = Math.cos(elapsed * 40 + k * 1.1 + idx) * 0.032;
                const pulseScale = 0.86 + Math.sin(elapsed * 32 + k * 1.6 + idx) * 0.22;
                node.position.x = waveX;
                node.position.y = waveY;
                node.rotation.z = elapsed * 10 + k;
                node.scale.set(pulseScale, pulseScale, 1.0);
              }
            }
          }
          if (foamSpray) foamSpray.visible = false;
          if (floorBar) floorBar.visible = false;
          linkGroup.position.set((x1 + x2) / 2, 0.78, (z1 + z2) / 2 - 0.08);
          linkGroup.rotation.y = Math.atan2(x2 - x1, z2 - z1);
        } else if (link.kind === 'line_foam') {
          if (fireStream) fireStream.visible = false;
          if (foamSpray) {
            foamSpray.visible = true;
            for (let bIdx = 0; bIdx < 8; bIdx++) {
              const bObj = foamSpray.getObjectByName(`soap_bubble_${bIdx}`);
              if (bObj) {
                const s = 0.92 + Math.sin(elapsed * 5.5 + bIdx * 1.3) * 0.14;
                bObj.scale.setScalar(s);
              }
            }
          }
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
      });

      // =======================================================================
      // SINGLE-FOCUS ONBOARDING (55% DIM) + LIVE RANGE PADS + PRE-DROP COMBO ARCS
      // =======================================================================
      const tutorialGuide =
        gState === 'playing'
          ? getTutorialGuideForLevel(stateRef.current.level, piecesRef.current)
          : null;
      const smartComboHints =
        gState === 'playing'
          ? computeSmartComboHints(
              piecesRef.current,
              stateRef.current.level,
              activeSettings.smartComboHints
            )
          : [];
      const pulse = 0.58 + Math.sin(elapsed * 8) * 0.32;
      const singleFocusOnboarding =
        gState === 'playing' &&
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
        if (currentDragGhostType !== selPiece.type) {
          dragGhostGroup.clear();
          const dg = buildGhostUtensilMesh(selPiece.type, isSoftwareGl);
          dragGhostGroup.add(dg);
          currentDragGhostType = selPiece.type;
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

      // Pre-Drop Combo Synergy Electric Arcs BEFORE releasing finger!
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
        const pl = preDropLinks[aIdx];
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
            padMat.opacity = 0.22 + Math.sin(elapsed * 6) * 0.05;
          } else {
            padMat.opacity = 0;
          }

          // 2. Update Cell Ring Highlights (STRICT SINGLE FOCUS when tutorialGuide.nextTarget exists!)
          const smartHintHere =
            !tutorialGuide?.nextTarget
              ? smartComboHints.find((h) => h.rail === r && h.row === row)
              : undefined;

          if (row < MIN_PLACEABLE_ROW) {
            if (isHovered && isPieceSelected) {
              hlMat.color.setHex(0xef4444);
              hlMat.opacity = 0.65;
            } else {
              hlMat.opacity = 0;
            }
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

      // Update 3D Tactical Preview Group (vectors & deflection arrows) when dragging or touching a placed weapon
      const activePreviewTarget =
        previewCell ??
        (tutorialGuide?.nextTarget && isPieceSelected
          ? { rail: tutorialGuide.nextTarget.rail, row: tutorialGuide.nextTarget.row }
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
          for (let k = 0; k < 11; k++) {
            const node = previewBridgeBar.getObjectByName(`flame_node_${k}`);
            if (node) {
              node.position.x = Math.sin(elapsed * 32 + k * 1.2) * 0.03;
              node.position.y = Math.cos(elapsed * 38 + k * 0.9) * 0.03;
              const pulseScale = 0.85 + Math.sin(elapsed * 30 + k * 1.5) * 0.2;
              node.scale.set(pulseScale, pulseScale, 1.0);
            }
          }
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

      if (waveSimDt > 0 && stateRef.current.level >= 5 && !gameEndedLock) {
        levelTimer = Math.max(0, levelTimer - waveSimDt);
      }

      // Sync 3D Utensil Meshes on the board
      const activePieceIds = new Set<string>();
      for (const piece of piecesRef.current) {
        if (piece.rail === null || piece.row === null) continue;
        activePieceIds.add(piece.id);

        let entry = utensilMeshes.get(piece.id);
        if (!entry || entry.type !== piece.type) {
          if (entry) utensilsGroup.remove(entry.group);
          const group = buildUtensilMesh(piece.type, isSoftwareGl);
          utensilsGroup.add(group);
          entry = { group, type: piece.type, bounce: 0.8 };
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
          if (piece.type === 'mop_vortex') {
            animPart.rotation.y += dt * (piece.comboType === 'slip_vortex' ? 18 : 10);
          } else if (piece.type === 'aerosol_torch') {
            animPart.visible = piece.comboType !== 'bridge_uv';
            animPart.rotation.y += dt * 4.5;
          } else if (piece.type === 'scourer_nanas') {
            animPart.rotation.y += dt * 3.5;
          }
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

          piece.fireTimer -= waveSimDt;
          const isInCombo = piece.comboType !== 'none';
          const fireInterval =
            piece.type === 'spray_flus'
              ? isInCombo
                ? stateRef.current.hatId === 'duck_shower_cap'
                  ? 0.52
                  : 0.6
                : 1.65
              : piece.type === 'bleach_cannon'
              ? isInCombo
                ? 0.85
                : 1.7
              : piece.type === 'mop_vortex'
              ? isInCombo
                ? 0.85
                : 1.65
              : 999;

          if (piece.fireTimer <= 0 && fireInterval < 100) {
            piece.fireTimer = fireInterval;

            if (piece.type === 'spray_flus' || piece.type === 'bleach_cannon') {
              soundEngine.playSprayShot();
              if (piece.type === 'spray_flus') {
                // Directional cyan/emerald mist forward (-Z) in its own rail!
                spawnForwardSprayMist(targetX, 0.52, targetZ);
              }
              projectiles.push({
                id: `proj-${piece.id}-${Date.now()}-${Math.random()}`,
                x: piece.rail,
                y: piece.row - 0.25,
                vx: 0,
                vy: -4.8,
                damage: piece.type === 'bleach_cannon' ? 30 : isInCombo ? 19 : 12,
                isEnemy: false,
                flavor: piece.type === 'bleach_cannon' ? 'bleach_glob' : 'water_drop',
                pierceShield: false,
                isExplosiveOrThermal: piece.type === 'bleach_cannon',
                fromDiagonalFoam: false,
                fromVortex: false,
                life: 2.2,
              });
            } else if (piece.type === 'mop_vortex') {
              const dirs = isInCombo ? 8 : 4;
              for (let dIdx = 0; dIdx < dirs; dIdx++) {
                const ang = (dIdx / dirs) * Math.PI * 2 + elapsed * 2;
                projectiles.push({
                  id: `proj-vortex-${piece.id}-${dIdx}-${Date.now()}`,
                  x: piece.rail,
                  y: piece.row,
                  vx: Math.cos(ang) * 2.4,
                  vy: Math.sin(ang) * 2.4,
                  damage: isInCombo ? 24 : 13,
                  isEnemy: false,
                  flavor: 'vortex_soap',
                  pierceShield: true,
                  fromDiagonalFoam: false,
                  fromVortex: true,
                  life: 0.85,
                });
              }
            }
          }
        }
      }

      for (const [id, entry] of utensilMeshes.entries()) {
        if (!activePieceIds.has(id)) {
          utensilsGroup.remove(entry.group);
          utensilMeshes.delete(id);
        }
      }

      // Ensure Milestone Mini-Boss (X5) or Grand Boss (X0) spawns reliably when Phase 3 begins!
      if (
        waveSimDt > 0 &&
        phase === 3 &&
        !bossSpawnedForLevel &&
        getBossTierForLevel(stateRef.current.level) !== null
      ) {
        spawnBossForMilestone(stateRef.current.level);
      }

      // Spawn new bugs according to current Level & Phase
      const ventsClosed =
        waveQuotaCompleted || (stateRef.current.level >= 5 && levelTimer <= 0);
      if (waveSimDt > 0 && !gameEndedLock && !ventsClosed) {
        spawnTimer -= waveSimDt;
        const maxBugsOnScreen = stateRef.current.level <= 3 ? 3 : 5;
        if (spawnTimer <= 0 && bugs.length < maxBugsOnScreen) {
          const baseInterval =
            stateRef.current.level <= 3
              ? 3.4
              : Math.max(2.1, 3.0 - stateRef.current.level * 0.1);
          spawnTimer = baseInterval;

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

          const hpMap: Record<BugType, number> = {
            speed_ant: 40,
            cap_beetle: 84,
            acid_wasp: 64,
            shift_roach: 60,
            king_crab: 145,
          };
          const maxHp = hpMap[bType] * (1 + Math.max(0, lvl - 3) * 0.08);

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

      // Helper for real-time 3-phase Grand Boss transitions (66% and 33%) with mandatory 300ms micro-freeze & flash!
      const evaluateGrandBossTransition = (bug: BugEnemy) => {
        if (bug.bossTier !== 'grand' || bug.hp <= 0) return;
        const nextPhase = getGrandBossPhase(bug.hp, bug.maxHp);
        const prevPhase = bug.bossPhase ?? 1;
        if (nextPhase <= prevPhase) return;

        bug.bossPhase = nextPhase;
        bug.bossArmorBroken = true;
        bug.hasShield = false;
        bug.bossPhaseFlashTimer = 0.35;
        hitstopTimer = 0.3; // Mandatory 300ms impact micro-freeze!
        cameraTrauma = 0.85;
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

      // Update Projectiles & Check Scourer Multiplication + hazmat_epi Acid Immunity + Boss Non-Rigid Resistances
      const survivingProjectiles: Projectile[] = [];
      for (const proj of projectiles) {
        if (waveSimDt > 0) {
          if (activeBiome.lateralWindForce > 0 && !proj.isEnemy) {
            proj.vx += Math.sin(elapsed * 2.2) * activeBiome.lateralWindForce * waveSimDt;
          }
          proj.x += proj.vx * waveSimDt;
          proj.y += proj.vy * waveSimDt;
          proj.life -= waveSimDt;

          if (!proj.isEnemy && (proj.flavor === 'water_drop' || proj.flavor === 'bleach_glob')) {
            const scourer = piecesRef.current.find(
              (p) =>
                p.type === 'scourer_nanas' &&
                p.gunkTimer <= 0 &&
                p.rail !== null &&
                p.row !== null &&
                Math.abs(p.rail - proj.x) < 0.35 &&
                Math.abs(p.row - proj.y) < 0.32
            );
            if (scourer && scourer.rail !== null && scourer.row !== null) {
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
              const dmgBonus = stateRef.current.hatId === 'tp_gasmask' ? 1.25 : 1.0;
              angles.forEach((ang, aIdx) => {
                survivingProjectiles.push({
                  id: `foam-${proj.id}-${aIdx}`,
                  x: scourer.rail!,
                  y: scourer.row! - 0.38,
                  vx: Math.sin(ang) * 3.2,
                  vy: -Math.cos(ang) * 4.5,
                  damage: Math.round(16 * dmgBonus),
                  isEnemy: false,
                  flavor: 'foam_fan',
                  pierceShield: Math.abs(ang) > 0.2,
                  isExplosiveOrThermal: proj.flavor === 'bleach_glob',
                  fromDiagonalFoam: Math.abs(ang) > 0.2,
                  fromVortex: false,
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
                proj.damage = 45;
                soundEngine.playFoamSplit();
              } else if (hazmatShieldAvailable) {
                // Traje EPI Amarillo (hazmat_epi): absorbs the 1st acid gunk of the level with visual feedback!
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
                hitPiece.gunkTimer = stateRef.current.hatId === 'bucket_helmet' ? 1.8 : 3.5;
                proj.life = 0;
                continue;
              }
            }
          } else {
            // Allied projectile vs Bugs
            for (const bug of bugs) {
              if (bug.koTimer > 0 || bug.yProgress < -0.15) continue;
              if (
                Math.abs(bug.rail - proj.x) < 0.48 &&
                Math.abs(bug.yProgress - proj.y) < 0.48
              ) {
                if (bug.bossTier) {
                  // Bosses NEVER have 100%-immunity hard locks: use computeBossDamageMultiplier!
                  const isThermalOrExplosive = Boolean(
                    proj.isExplosiveOrThermal ||
                      proj.flavor === 'volcano_foam' ||
                      proj.flavor === 'roomba_blade' ||
                      proj.flavor === 'bleach_glob'
                  );
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
                  bug.flashTimer = 0.08;
                  if (proj.fromDiagonalFoam) bug.hitByDiagonalFoam = true;
                  if (proj.fromVortex) {
                    bug.hitByVortexSpin = true;
                    bug.slowTimer = Math.max(bug.slowTimer, 1.8);
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
                  if (shieldWarnCooldown <= 0) {
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
                  if (proj.isExplosiveOrThermal) {
                    bug.hasShield = false;
                  }
                  bug.hp -= proj.damage;
                  bug.flashTimer = 0.08;
                  if (proj.fromDiagonalFoam) bug.hitByDiagonalFoam = true;
                  if (proj.fromVortex) bug.hitByVortexSpin = true;
                }
                if (proj.flavor !== 'roomba_blade' && proj.flavor !== 'volcano_foam') {
                  proj.life = 0;
                }
                break;
              }
            }
          }
        }

        if (proj.life > 0 && proj.y > -1.2 && proj.y < 7.2 && proj.x > -0.6 && proj.x < 3.6) {
          survivingProjectiles.push(proj);
        }
      }
      projectiles = survivingProjectiles;

      // Sync Projectile Meshes (orange/red reserved strictly for real fire volcano_foam / roomba_blade!)
      const activeProjIds = new Set<string>();
      for (const proj of projectiles) {
        activeProjIds.add(proj.id);
        let mesh = projMeshes.get(proj.id);
        if (!mesh) {
          const isHeavyUlt =
            proj.flavor === 'roomba_blade' || proj.flavor === 'volcano_foam';
          const geo = isHeavyUlt
            ? new THREE.CylinderGeometry(0.36, 0.36, 0.14, 24)
            : new THREE.SphereGeometry(proj.isEnemy ? 0.14 : 0.12, 20, 20);
          const colorHex =
            proj.flavor === 'enemy_acid'
              ? 0xa855f7
              : proj.flavor === 'volcano_foam'
              ? 0xf97316 // Real chemical volcano fire = orange!
              : proj.flavor === 'foam_fan'
              ? 0x34d399
              : proj.flavor === 'vortex_soap'
              ? 0x2dd4bf
              : proj.flavor === 'bleach_glob'
              ? 0xfacc15
              : proj.flavor === 'roomba_blade'
              ? 0xef4444
              : 0x00d2ff; // Flus-Flus = crisp cyan!
          const projGroup = new THREE.Group();
          const coreMesh = new THREE.Mesh(geo, createToonMaterial(colorHex));
          projGroup.add(coreMesh);
          addInkOutline(projGroup, 0.032, 0x141013);
          mesh = projGroup;
          projectilesGroup.add(mesh);
          projMeshes.set(proj.id, mesh);
        }
        mesh.position.set(gridToWorldX(proj.x), 0.45, gridToWorldZ(proj.y));
      }
      for (const [id, m] of projMeshes.entries()) {
        if (!activeProjIds.has(id)) {
          projectilesGroup.remove(m);
          projMeshes.delete(id);
        }
      }

      // Update Bugs & Check Traps + Boss Phase 2/3 Behaviors + KO Transitions
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
                bugMeshes.delete(bug.id);
              }
            }
            continue;
          }

          if (bug.slowTimer > 0) {
            bug.slowTimer = Math.max(0, bug.slowTimer - waveSimDt);
          }

          if (bug.bossStunTimer && bug.bossStunTimer > 0) {
            bug.bossStunTimer = Math.max(0, bug.bossStunTimer - waveSimDt);
          }

          const biomeFrictionSpeedFactor =
            activeBiome.friction > 1.1
              ? 0.88
              : activeBiome.friction < 0.2
              ? 1.06
              : activeBiome.friction < 0.5
              ? 1.04
              : 1.0;

          const speedMap: Record<BugType, number> = {
            speed_ant: 0.68,
            cap_beetle: 0.48,
            acid_wasp: 0.44,
            shift_roach: 0.6,
            king_crab: 0.36,
          };
          const worldMult = WORLDS_CATALOG[stateRef.current.worldId].speedMult;
          const levelMult = getLevelSpeedMultiplier(stateRef.current.level);
          // Level 1 Wave 1 ONLY: 35% slower (0.65x) so live dynamic onboarding feels calm and intuitive!
          const lvl1Wave1Factor =
            stateRef.current.level === 1 && phase === 1 ? 0.65 : 1.0;
          // Grand Boss Phase 3 Frenzy: +30% speed!
          const bossFrenzyFactor =
            bug.bossTier === 'grand' && (bug.bossPhase ?? 1) === 3 ? 1.3 : 1.0;
          const controlSlowFactor = bug.slowTimer > 0 ? 0.55 : 1.0;
          const isStunnedBoss = Boolean(bug.bossStunTimer && bug.bossStunTimer > 0);
          const effectiveSpeed = isStunnedBoss
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
          if (bug.type === 'acid_wasp' && bug.yProgress > 0.5 && bug.yProgress < 3.6 && !isStunnedBoss) {
            bug.attackWindup += waveSimDt * 0.45;
            if (bug.attackWindup >= 1.0) {
              bug.attackWindup = 0;
              projectiles.push({
                id: `acid-${bug.id}-${Date.now()}`,
                x: Math.round(bug.rail),
                y: bug.yProgress + 0.3,
                vx: 0,
                vy: 3.1,
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
              label: bug.bossTier ? '💫 ¡JEFE FRENADO!' : '📐 ¡REDIRIGIDO AL CARRIL!',
              detail: '¡Giro 90° directo a tus trampas!',
              color: 'yellow',
              xPct: sqPos.xPct,
              yPct: sqPos.yPct,
              createdAt: Date.now(),
            });
          }

          // 1. Check Horizontal Aerosol Neon Violet UV Bridge at (currentRowInt)
          const bridgeLink = comboEval.links.find(
            (l) =>
              l.kind === 'bridge_uv' &&
              l.fromRow === currentRowInt &&
              (l.fromRail === currentRailInt || l.toRail === currentRailInt)
          );
          if (bridgeLink && Math.abs(bug.yProgress - currentRowInt) < 0.3) {
            if (bug.hasShield || (bug.bossTier && !bug.bossArmorBroken)) {
              bug.hasShield = false;
              bug.bossArmorBroken = true;
              bug.hitByBridgeBurn = true;
              if (bug.bossTier === 'mini' && bug.bossPuzzleType === 'uv_overheat') {
                bug.bossStunTimer = 3.2;
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
                label: bug.bossTier ? '⚡ ¡CORAZA FUNDIDA ×2.5!' : '¡Combo x2!',
                detail: '⚡ ¡Láser UV Funde-Chapas!',
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
            bug.hp -= 48 * uvMult * waveSimDt;
            bug.hitByBridgeBurn = true;
            evaluateGrandBossTransition(bug);
          }

          // 2. Check Soap Bar ("Pastilla de Jabón Resbalón") on current cell
          const soapHere = piecesRef.current.find(
            (p) =>
              p.type === 'soap_bar' &&
              p.gunkTimer <= 0 &&
              p.rail === currentRailInt &&
              p.row === currentRowInt &&
              Math.abs(bug.yProgress - currentRowInt) < 0.32
          );
          if (soapHere && !bug.isSlidingFromSoap) {
            bug.isSlidingFromSoap = true;
            bug.slowTimer = Math.max(bug.slowTimer, 2.6);
            if (bug.bossTier === 'mini' && bug.bossPuzzleType === 'soap_stun') {
              bug.bossStunTimer = 3.5;
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
              const slipPos = projectWorldToScreenPct(
                gridToWorldX(bug.rail),
                0.8,
                gridToWorldZ(bug.yProgress)
              );
              stateRef.current.onFloatingCombo?.({
                id: `combo-slip-${bug.id}-${Date.now()}`,
                multiplier: 2,
                label: bug.bossTier ? '🧼 ¡JEFE CONTROLADO!' : '¡Combo x2!',
                detail: '🧼 ¡Desvío al Vórtice!',
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

          // 3. Check if bug enters a Mop Vortex cell
          const vortexHere = piecesRef.current.find(
            (p) =>
              p.type === 'mop_vortex' &&
              p.gunkTimer <= 0 &&
              p.rail === currentRailInt &&
              p.row === currentRowInt &&
              Math.abs(bug.yProgress - currentRowInt) < 0.45
          );
          if (vortexHere) {
            bug.hitByVortexSpin = true;
            bug.slowTimer = Math.max(bug.slowTimer, 2.2);
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
                ? 88
                : 46
              : bug.isSlidingFromSoap
              ? 240
              : 65;
            bug.hp -= rawVortexDps * vortexMult * waveSimDt;
            evaluateGrandBossTransition(bug);
          }

          // Check if Bug is defeated!
          if (bug.hp <= 0) {
            const elim = classifyBugElimination(bug);
            bug.koTimer = bug.bossTier ? 0.55 : 0.38;
            bug.koStar = elim.stars;
            phaseKills += bug.bossTier ? 3 : 1;
            totalBugsCleaned += 1;
            const ptsAwarded =
              (elim.stars === 3 ? 350 : elim.stars === 2 ? 180 : 100) *
              (bug.bossTier === 'grand' ? 3 : bug.bossTier === 'mini' ? 2 : 1);
            score += ptsAwarded;
            const pressureGain =
              stateRef.current.armorId === 'golden_scourer_mail' ? 24 : 18;
            pressurePct = Math.min(100, pressurePct + pressureGain);

            soundEngine.playStarKill(elim.stars);
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
              (p) => p.rail !== null && p.row !== null && p.comboType !== 'none'
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
                  ? Math.min(9, combatComboStreak + 1)
                  : Math.max(2, elim.stars);
              combatComboWindowTimer = 6.0;

              const killPos = projectWorldToScreenPct(
                gridToWorldX(bug.rail),
                0.85,
                gridToWorldZ(bug.yProgress)
              );
              stateRef.current.onFloatingCombo?.({
                id: `combo-kill-${bug.id}-${nowMs}`,
                multiplier: combatComboStreak,
                label: bug.bossTier ? '👑 ¡JEFE ABATIDO!' : `¡Combo x${combatComboStreak}!`,
                detail: `+${ptsAwarded} PTS · ${'★'.repeat(elim.stars)}`,
                color: elim.stars === 3 ? 'cyan' : elim.stars === 2 ? 'green' : 'yellow',
                xPct: killPos.xPct,
                yPct: killPos.yPct,
                createdAt: nowMs,
              });

              if (nowMs - lastKillComicPopAt >= 6000 || bug.bossTier) {
                lastKillComicPopAt = nowMs;
                stateRef.current.onComicPop({
                  id: `kill-${bug.id}`,
                  title: bug.bossTier ? '👑 ¡JEFE DESINFECTADO!' : elim.comicTitle,
                  subtitle: elim.comicSubtitle,
                  stars: elim.stars,
                  color: elim.stars === 3 ? 'cyan' : elim.stars === 2 ? 'green' : 'yellow',
                  createdAt: nowMs,
                });
              }
            }

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
              const plateGroup = kitchenProps.bastionPlates[currentRailInt];
              if (plateGroup) {
                const food = plateGroup.getObjectByName('food_content');
                if (food) food.visible = false;
              }
              sanitationSeals -= 1;
              soundEngine.playBleachWave();
              cameraTrauma = 0.7;
              stateRef.current.onComicPop({
                id: `seal-${Date.now()}`,
                title: '🍽️ ¡PLATO ARRUINADO!',
                subtitle: `Ola de Lejía de Emergencia (${sanitationSeals}/3 Sellos restantes)`,
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
              gameEndedLock = true;
              const trans = checkPhaseTransition(phase, phaseKills, stateRef.current.level);
              const remaining = Math.max(1, trans.targetKillsForCurrentPhase - phaseKills);
              setTimeout(() => {
                stateRef.current.onGameEnd(false, {
                  score,
                  phaseReached: phase,
                  remainingKillsToNext: remaining,
                  bugsCleaned: totalBugsCleaned,
                });
              }, 450);
            }
          }
        }

        survivingBugs.push(bug);
      }
      bugs = survivingBugs;

      // Trigger Level Victory ONLY when vents are closed AND 0 live enemies (including Boss) remain on the countertop!
      const liveBugsCount = bugs.filter((b) => b.koTimer <= 0).length;
      const bossPending =
        getBossTierForLevel(stateRef.current.level) !== null && !bossSpawnedForLevel;
      const readyForVictory =
        (waveQuotaCompleted || (stateRef.current.level >= 5 && levelTimer <= 0)) && !bossPending;
      if (waveSimDt > 0 && !gameEndedLock && readyForVictory && liveBugsCount === 0) {
        gameEndedLock = true;
        setTimeout(() => {
          stateRef.current.onGameEnd(true, {
            score: score + (stateRef.current.level >= 5 ? 250 : 0),
            phaseReached: 3,
            remainingKillsToNext: 0,
            bugsCleaned: totalBugsCleaned,
          });
        }, 450);
      }

      // Sync 3D Bug Meshes (0.75 normal scale; 1.02 Mini-Boss; 1.24 Grand Boss + phase-break flash!)
      const activeBugIds = new Set<string>();
      for (const bug of bugs) {
        activeBugIds.add(bug.id);
        let mesh = bugMeshes.get(bug.id);
        if (!mesh) {
          mesh = buildBugMesh(bug.type);
          bugsGroup.add(mesh);
          bugMeshes.set(bug.id, mesh);
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
            bug.bossPhaseFlashTimer && bug.bossPhaseFlashTimer > 0 ? 1.15 : 1.0;
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
          bugMeshes.delete(id);
        }
      }

      // Update Warning Beacons at top of rails (in Strategic Mode Lv.4+, mark all forecast conduits!)
      warningBeacons.forEach((b, rIdx) => {
        const mat = b.material as THREE.MeshBasicMaterial;
        if (inPlacementPhase && stateRef.current.level >= 4 && levelForecast.activeRails.includes(rIdx)) {
          mat.color.setHex(levelForecast.bossTier !== 'none' ? 0xf97316 : 0x38bdf8);
          mat.opacity = 0.36 + Math.sin(elapsed * 7 + rIdx) * 0.2;
        } else if (warningRails[rIdx]) {
          mat.color.setHex(0xef4444);
          mat.opacity = 0.48 + Math.sin(elapsed * 12) * 0.32;
        } else {
          mat.opacity = 0;
        }
      });

      // Subtle pulse on gourmet plates if armoredPlates > 0
      kitchenProps.bastionPlates.forEach((plate) => {
        plate.scale.setScalar(armoredPlates > 0 ? 0.9 + Math.sin(elapsed * 6) * 0.03 : 0.86);
      });

      // Animate 3D Chef Bastion at z = +4.72, y = -0.24 (kept 100% untouched in mesh/scale!)
      const targetChefX = stateRef.current.wardrobeOpen ? 0 : chefTargetX * 0.42;
      chefAnchor.position.x = THREE.MathUtils.damp(chefAnchor.position.x, targetChefX, 6, dt);
      chefAnchor.position.z = 4.72;
      chefAnchor.scale.setScalar(stateRef.current.wardrobeOpen ? 1.85 : 1.08);
      const targetRotY = stateRef.current.wardrobeOpen ? 0 : Math.PI;
      chefAnchor.rotation.y = THREE.MathUtils.damp(chefAnchor.rotation.y, targetRotY, 12, dt);
      const chefInner = chefAnchor.getObjectByName('chef_inner');
      if (chefInner) {
        chefInner.rotation.x = stateRef.current.wardrobeOpen ? 0 : -0.22;
      }
      const baseChefY = stateRef.current.wardrobeOpen ? 0.15 : -0.24;
      if (chefCelebrateTimer > 0) {
        chefCelebrateTimer = Math.max(0, chefCelebrateTimer - dt);
        chefAnchor.position.y = baseChefY + Math.abs(Math.sin(elapsed * 18)) * 0.22;
      } else {
        chefAnchor.position.y = baseChefY + Math.sin(elapsed * 3.2) * 0.03;
      }
      const armL = chefAnchor.getObjectByName('chef_arm_l');
      const armR = chefAnchor.getObjectByName('chef_arm_r');
      const armWave =
        chefCelebrateTimer > 0 ? Math.sin(elapsed * 22) * 0.65 : Math.sin(elapsed * 4.5) * 0.14;
      if (armL) armL.rotation.z = -0.42 + armWave;
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

      // Throttle React HUD state updates to <= 10Hz
      hudEmitTimer += dt;
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
                hpPct: Math.max(0, Math.min(100, (liveBoss.hp / liveBoss.maxHp) * 100)),
                phase: liveBoss.bossPhase ?? 1,
                phaseLabel: getGrandBossPhaseLabel(liveBoss.bossPhase ?? 1, liveBoss.bossTier),
                armorMelted: Boolean(liveBoss.bossArmorBroken || !liveBoss.hasShield),
                phaseJustBroke: Boolean((liveBoss.bossPhaseFlashTimer ?? 0) > 0),
              }
            : null;

        let tutorialTargetScreen: HudSnapshot['tutorialTargetScreen'] = null;
        if (tutorialGuide?.nextTarget) {
          const tScr = projectWorldToScreenPct(
            gridToWorldX(tutorialGuide.nextTarget.rail),
            0.45,
            gridToWorldZ(tutorialGuide.nextTarget.row)
          );
          tutorialTargetScreen = {
            xPct: tScr.xPct,
            yPct: tScr.yPct,
            shortTag: tutorialGuide.nextTarget.shortTag,
            pieceId: tutorialGuide.nextTarget.pieceId,
          };
        }

        stateRef.current.onHudUpdate({
          phase,
          inPlacementPhase,
          phaseKills,
          phaseTargetKills: trans.targetKillsForCurrentPhase,
          sanitationSeals,
          score,
          pressurePct: Math.round(pressurePct),
          slowMoActive: isPieceSelected && !inPlacementPhase,
          prepTimer,
          levelTimer: Math.ceil(levelTimer),
          biome: activeBiome,
          smartComboHintMessage: null, // Top floating orange tutorial banners removed so vents stay 100% clear!
          selectedPieceId: activePieceId,
          hoveredCell,
          activeWarningRails: warningRails,
          pieces: piecesRef.current,
          hazmatShieldReady: hazmatShieldAvailable,
          armoredPlates,
          lastStandActive: lastStandTimer > 0,
          forecast: levelForecast,
          bossHud,
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
