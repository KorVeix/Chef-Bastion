import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { soundEngine } from '../game/audio';
import {
  addInkOutline,
  buildBugMesh,
  buildChefBastionMesh,
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
  createInitialBoardPieces,
  evaluateBoardCombos,
  GRID_RAILS,
  GRID_ROWS,
  getLevelSpeedMultiplier,
  getTutorialGuideForLevel,
  MIN_PLACEABLE_ROW,
  moveOrSwapUtensil,
  WORLDS_CATALOG,
} from '../game/rules';
import {
  ArmorId,
  BugEnemy,
  BugType,
  ComicPopEvent,
  FloatingComboEvent,
  GameState,
  HatId,
  KillStarRating,
  Projectile,
  SpecialWeaponId,
  UtensilPiece,
  UtensilType,
  WorldId,
} from '../game/types';

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
  selectedPieceId: string | null;
  hoveredCell: { rail: number; row: number } | null;
  activeWarningRails: (BugType | null)[];
  pieces: UtensilPiece[];
}

interface ChefBastionCanvasProps {
  gameState: GameState;
  wardrobeOpen?: boolean;
  worldId: WorldId;
  level: number;
  hatId: HatId;
  armorId: ArmorId;
  specialWeaponId: SpecialWeaponId;
  piecesRef: React.MutableRefObject<UtensilPiece[]>;
  selectedPieceIdRef: React.MutableRefObject<string | null>;
  triggerUltimateRef: React.MutableRefObject<boolean>;
  startWaveRef: React.MutableRefObject<boolean>;
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
  piecesRef,
  selectedPieceIdRef,
  triggerUltimateRef,
  startWaveRef,
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
    renderer.shadowMap.enabled = true;
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

    // Invisible Raycast Targets + Subtle Wood-Engraved Placement Spots (0.12 opacity) + Holographic Grid On-Demand Frames
    const interactableCells: THREE.Mesh[] = [];
    const cellHighlights: THREE.Mesh[][] = [];
    const cellSpots: (THREE.Mesh | null)[][] = [];
    const invisibleHitMat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });

    for (let r = 0; r < GRID_RAILS; r++) {
      cellHighlights[r] = [];
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

    // Helper to build an organic, roaring 3D Flame Jet (overlapping red, orange & bright yellow-white spheres/cones)
    function createOrganicFlameStream(): THREE.Group {
      const fireStream = new THREE.Group();
      fireStream.name = 'fire_stream';

      const redOrangeMat = new THREE.MeshBasicMaterial({
        color: 0xea580c,
      });
      const orangeMat = new THREE.MeshBasicMaterial({
        color: 0xf97316,
        depthTest: false,
      });
      const goldMat = new THREE.MeshBasicMaterial({
        color: 0xfacc15,
        depthTest: false,
      });
      const whiteCoreMat = new THREE.MeshBasicMaterial({
        color: 0xfef08a,
        depthTest: false,
      });

      const nodeCount = 11;
      for (let k = 0; k < nodeCount; k++) {
        const u = k / (nodeCount - 1);
        const t = u - 0.5; // -0.5 (nozzle 1) to +0.5 (nozzle 2)
        const env = Math.sin(u * Math.PI); // pinches cleanly at both nozzles, swells in the middle
        const radiusScale = 0.36 + env * 0.68;

        const nodeGroup = new THREE.Group();
        nodeGroup.name = `flame_node_${k}`;
        nodeGroup.position.set(0, 0, t);

        // 1. Outer red-orange flame mantle + wavy side licks (renderOrder 10)
        const outerMantle = new THREE.Mesh(
          new THREE.SphereGeometry(0.145 * radiusScale, 20, 16),
          redOrangeMat
        );
        outerMantle.scale.set(1.05, 0.95, 1.85);
        outerMantle.renderOrder = 10;

        // Wavy flame tongue licking outward from the outer mantle
        const lick = new THREE.Mesh(
          new THREE.ConeGeometry(0.085 * radiusScale, 0.24 * radiusScale, 14),
          redOrangeMat
        );
        const lickDir = k % 2 === 0 ? 1 : -1;
        lick.position.set(0, lickDir * 0.095 * radiusScale, 0);
        lick.rotation.x = lickDir * 0.55;
        lick.renderOrder = 10;

        // 2. Middle vibrant orange-gold flame body (renderOrder 11)
        const midLobe = new THREE.Mesh(
          new THREE.SphereGeometry(0.105 * radiusScale, 20, 16),
          k % 2 === 0 ? orangeMat : goldMat
        );
        midLobe.scale.set(1.0, 0.9, 1.95);
        midLobe.renderOrder = 11;

        // 3. Inner incandescent yellow-white core (renderOrder 12 — glows crisply down the center!)
        const coreLobe = new THREE.Mesh(
          new THREE.SphereGeometry(0.062 * radiusScale, 16, 14),
          whiteCoreMat
        );
        coreLobe.scale.set(0.95, 0.85, 2.1);
        coreLobe.renderOrder = 12;

        nodeGroup.add(outerMantle, lick, midLobe, coreLobe);
        fireStream.add(nodeGroup);
      }

      return fireStream;
    }

    // =========================================================================
    // 3D COMBO VISUALS MATCHING 1794109185461.jpg:
    // 1. Organic Multi-Layered 3D Flame Jet at nozzle height (y = 0.96) between Aerosol UV cans
    // 2. Upward (-Z) Translucent White Spray Cone + 3D Glossy Soap Bubbles in front of Estropajo (line_foam)
    // =========================================================================
    const circuitPool: THREE.Group[] = [];
    for (let i = 0; i < 12; i++) {
      const linkGroup = new THREE.Group();
      linkGroup.visible = false;

      // 1. Organic Multi-Lobed Fire Stream for bridge_uv
      const fireStream = createOrganicFlameStream();
      linkGroup.add(fireStream);

      // 2. Upward (-Z, toward plagues!) Translucent White Spray Cone + Glossy Soap Bubbles for line_foam
      const foamSpray = new THREE.Group();
      foamSpray.name = 'foam_spray';
      const sprayCone = new THREE.Mesh(
        new THREE.ConeGeometry(0.95, 2.3, 24, 1, true),
        new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.34,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      );
      // Tip (+Y) rotated to +Z (at the Estropajo, z=0) so the wide open mouth (-Y) fans UPWARD toward -Z (toward the bugs)!
      sprayCone.rotation.x = Math.PI / 2;
      sprayCone.scale.set(1.05, 1.0, 0.26);
      sprayCone.position.set(0, 0.36, -1.15);
      foamSpray.add(sprayCone);

      // 8 Glossy 3D Soap Bubbles fanning UPWARD (-Z) from the Estropajo toward the plagues!
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
      const bubbleShellMat = createToonMaterial(0xe0f2fe, {
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
        addInkOutline(bGroup, 0.025, 0x38bdf8);
        foamSpray.add(bGroup);
      });
      linkGroup.add(foamSpray);

      // Default floor bar for slip_vortex
      const floorBar = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.04, 1.0),
        new THREE.MeshBasicMaterial({ color: 0x2dd4bf, transparent: true, opacity: 0.85 })
      );
      floorBar.name = 'floor_bar';
      linkGroup.add(floorBar);

      worldGroup.add(linkGroup);
      circuitPool.push(linkGroup);
    }

    // 3D Tactical Action Preview Group (shows firing arrows, 5x foam fan, organic UV flame jet, or slip vector when touching a piece)
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
    const previewBridgeBar = createOrganicFlameStream();
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

    // Dynamic Actor Containers
    const utensilsGroup = new THREE.Group();
    const bugsGroup = new THREE.Group();
    const projectilesGroup = new THREE.Group();
    const chefAnchor = new THREE.Group();
    chefAnchor.position.set(0, -0.24, 4.72);
    chefAnchor.rotation.y = Math.PI;
    scene.add(utensilsGroup, bugsGroup, projectilesGroup, chefAnchor);

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
    const bugMeshes = new Map<string, THREE.Group>();
    const projMeshes = new Map<string, THREE.Object3D>();

    // Active Simulation State
    let bugs: BugEnemy[] = [];
    let projectiles: Projectile[] = [];
    let phase: 1 | 2 | 3 = 1;
    let inPlacementPhase = true; // Level ALWAYS starts in 'PREP' (paused until player places pieces or taps Start Wave!)
    let autoStartAfterPlacementTimer = 0;
    let phaseKills = 0;
    let totalBugsCleaned = 0;
    let score = 0;
    let sanitationSeals = 3;
    let pressurePct = 45;
    let spawnTimer = 2.0;
    let prepTimer = 0; // 3-second breather timer between Phase 1 -> 2 -> 3
    let shieldWarnCooldown = 0;
    let lastKillComicPopAt = 0; // 6-second minimum cooldown between kill comic banners!
    let slowMoTimer = 0;
    let hitstopTimer = 0;
    let cameraTrauma = 0;
    let chefTargetX = 0;
    let chefCelebrateTimer = 0;
    let isDraggingOnCanvas = false;
    let hoveredCell: { rail: number; row: number } | null = null;
    let lastKnownReset = simResetRef.current;
    let gameEndedLock = false;
    let placementComboChain = 0;
    let combatComboStreak = 1;
    let combatComboWindowTimer = 0;
    const _projVec = new THREE.Vector3();

    function projectWorldToScreenPct(wx: number, wy: number, wz: number): { xPct: number; yPct: number } {
      _projVec.set(wx, wy, wz);
      _projVec.project(camera);
      const rawX = (_projVec.x * 0.5 + 0.5) * 100;
      const rawY = (-_projVec.y * 0.5 + 0.5) * 100;
      return {
        xPct: THREE.MathUtils.clamp(rawX, 18, 82),
        yPct: THREE.MathUtils.clamp(rawY, 22, 66),
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

    function spawnWavePreviewBugs(currentLvl: number, currentPh: 1 | 2 | 3) {
      if (currentLvl === 1) {
        // Level 1 (Learn Line Foam Combo): Cockroaches peeking out on Rails 2 & 3 (0-indexed 1 & 2)
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
          }
        );
      } else if (currentLvl === 2) {
        // Level 2 (Learn Horizontal UV Bridge): Armored Rat on Rail 2 + Roach/Rat on Rail 3
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
            yProgress: -0.35,
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
      } else {
        // Level 3+: Armored Rat on Rail 3 (0-indexed rail 2, aligned with Soap Bar) + Garbage Fly / Roach on Rail 2
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

      bugs = [];
      projectiles = [];
      phase = 1;
      inPlacementPhase = true;
      autoStartAfterPlacementTimer = 0;
      startWaveRef.current = false;
      phaseKills = 0;
      totalBugsCleaned = 0;
      score = 0;
      sanitationSeals = 3;
      pressurePct = 45;
      spawnTimer = 2.4;
      prepTimer = 0;
      shieldWarnCooldown = 0;
      slowMoTimer = 0;
      hitstopTimer = 0;
      cameraTrauma = 0;
      gameEndedLock = false;
      placementComboChain = 0;
      combatComboStreak = 1;
      combatComboWindowTimer = 0;

      // Restore all 4 white gourmet plates & their food_content on the Bastion border (z = +4.18, scale 0.86)
      kitchenProps.bastionPlates.forEach((plate) => {
        plate.visible = true;
        plate.scale.setScalar(0.86);
        const food = plate.getObjectByName('food_content');
        if (food) food.visible = true;
      });

      spawnWavePreviewBugs(stateRef.current.level, 1);
      selectNextTrayPieceIfAny();
    }

    resetSimulation();

    // Pointer / Touch Raycasting for Drag & Drop + Tap-to-Swap
    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();

    function getCellUnderPointer(clientX: number, clientY: number): { rail: number; row: number } | null {
      const rect = renderer.domElement.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return null;
      pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNdc, camera);
      const hits = raycaster.intersectObjects(interactableCells, false);
      if (hits.length > 0) {
        const { rail, row } = hits[0].object.userData as { rail: number; row: number };
        return { rail, row };
      }
      return null;
    }

    function handlePostPlacementSelection() {
      if (inPlacementPhase) {
        selectNextTrayPieceIfAny();
        // If all pieces in the tray have been placed onto the countertop, start a 1.3s grace countdown to launch the wave!
        const allPlaced = piecesRef.current.every((p) => p.rail !== null && p.row !== null);
        if (allPlaced && autoStartAfterPlacementTimer <= 0) {
          autoStartAfterPlacementTimer = 1.35;
        }
      } else {
        selectedPieceIdRef.current = null;
      }
    }

    const onPointerDown = (e: PointerEvent) => {
      if (stateRef.current.gameState !== 'playing') return;
      if (simResetRef.current !== lastKnownReset) {
        lastKnownReset = simResetRef.current;
        resetSimulation();
      }
      const cell = getCellUnderPointer(e.clientX, e.clientY);
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
          // Begin dragging the already-selected piece
          isDraggingOnCanvas = true;
          slowMoTimer = 2.5;
          soundEngine.playSlowMoEnter();
          return;
        }

        // Enforce Filas 3, 4, 5, y 6 ONLY (0-indexed row >= 2)
        if (cell.row < MIN_PLACEABLE_ROW) {
          soundEngine.playShieldClink();
          return;
        }

        // Move or Direct Swap selected piece onto clicked cell!
        piecesRef.current = moveOrSwapUtensil(
          piecesRef.current,
          currentSelected,
          cell.rail,
          cell.row
        );
        const movedPiece = piecesRef.current.find((p) => p.id === currentSelected);
        const hasCombo = movedPiece && movedPiece.comboType !== 'none';
        soundEngine.playSnapPiece(Boolean(hasCombo));
        spawnParticles(
          gridToWorldX(cell.rail),
          0.25,
          gridToWorldZ(cell.row),
          14,
          hasCombo ? 0xfacc15 : 0xffffff,
          2.6
        );
        const entry = utensilMeshes.get(currentSelected);
        if (entry) entry.bounce = 1.0;
        if (hasCombo) {
          emitPlacementComboIfAny(currentSelected);
        }
        isDraggingOnCanvas = false;
        slowMoTimer = 0;
        handlePostPlacementSelection();
      } else if (occupant) {
        // Select piece & activate 20% Tactical Slow-Mo!
        selectedPieceIdRef.current = occupant.id;
        isDraggingOnCanvas = true;
        slowMoTimer = 2.5;
        hoveredCell = cell;
        soundEngine.playSlowMoEnter();
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (stateRef.current.gameState !== 'playing') return;
      const cell = getCellUnderPointer(e.clientX, e.clientY);
      hoveredCell = cell;
      if (cell) {
        chefTargetX = gridToWorldX(cell.rail) * 0.65;
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!isDraggingOnCanvas) return;
      isDraggingOnCanvas = false;
      const selectedId = selectedPieceIdRef.current;
      if (!selectedId) return;

      const cell = getCellUnderPointer(e.clientX, e.clientY);
      const origin = piecesRef.current.find((p) => p.id === selectedId);
      if (
        cell &&
        cell.row >= MIN_PLACEABLE_ROW &&
        origin &&
        (cell.rail !== origin.rail || cell.row !== origin.row)
      ) {
        piecesRef.current = moveOrSwapUtensil(
          piecesRef.current,
          selectedId,
          cell.rail,
          cell.row
        );
        const movedPiece = piecesRef.current.find((p) => p.id === selectedId);
        const hasCombo = movedPiece && movedPiece.comboType !== 'none';
        soundEngine.playSnapPiece(Boolean(hasCombo));
        spawnParticles(
          gridToWorldX(cell.rail),
          0.25,
          gridToWorldZ(cell.row),
          14,
          hasCombo ? 0xfacc15 : 0xffffff,
          2.8
        );
        const entry = utensilMeshes.get(selectedId);
        if (entry) entry.bounce = 1.0;
        if (hasCombo) {
          emitPlacementComboIfAny(selectedId);
        }
        slowMoTimer = 0;
        handlePostPlacementSelection();
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

      // Update World theme countertop color smoothly (keep sunny_counter pure white to show full Canvas2D Cozy Plow cream/maple texture)
      const worldMeta = WORLDS_CATALOG[stateRef.current.worldId];
      slab.material.color.set(
        stateRef.current.worldId === 'sunny_counter' ? '#ffffff' : worldMeta.woodColor
      );

      const gState = stateRef.current.gameState;

      if (stateRef.current.wardrobeOpen) {
        // Frame the full 3D Chef + Tall Toque Hat in the top 42% window of the screen above the Wardrobe bottom sheet!
        const previewSway = Math.sin(elapsed * 1.4) * 0.45;
        camera.position.x = THREE.MathUtils.damp(camera.position.x, previewSway, 6, dt);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, 3.5, 6, dt);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, 9.1, 6, dt);
        camera.lookAt(0, -0.1, 4.72);
      } else if (gState === 'title') {
        // Live World 3/4 Camera Tour on Title Screen!
        const tourX = Math.sin(elapsed * 0.45) * 1.1;
        const tourZ = 10.1 + Math.cos(elapsed * 0.35) * 0.35;
        camera.position.x = THREE.MathUtils.damp(camera.position.x, tourX, 3, dt);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, 9.5, 3, dt);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, tourZ, 3, dt);
        camera.lookAt(0, -0.46, 0.16);
      } else {
        // Full 9:16 Vertical Countertop Framing with decaying trauma*trauma shake
        cameraTrauma = Math.max(0, cameraTrauma - dt * 2.4);
        const shake = cameraTrauma * cameraTrauma * 0.32;
        const shakeX = (Math.random() - 0.5) * shake;
        const shakeZ = (Math.random() - 0.5) * shake;
        camera.position.x = THREE.MathUtils.damp(camera.position.x, shakeX, 10, dt);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, 9.5, 8, dt);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, 10.2 + shakeZ, 10, dt);
        camera.lookAt(0, -0.46, 0.16);
      }

      // Check manual "EMPEZAR OLEADA" button trigger or auto-start after all pieces are placed
      if (gState === 'playing' && inPlacementPhase) {
        if (startWaveRef.current) {
          startWaveRef.current = false;
          inPlacementPhase = false;
          autoStartAfterPlacementTimer = 0;
          selectedPieceIdRef.current = null;
        } else if (autoStartAfterPlacementTimer > 0) {
          autoStartAfterPlacementTimer = Math.max(0, autoStartAfterPlacementTimer - dt);
          if (autoStartAfterPlacementTimer === 0) {
            inPlacementPhase = false;
            selectedPieceIdRef.current = null;
          }
        }
      }

      // Check Ultimate trigger (Roomba Kamikaze / Kärcher / Volcano)
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
          subtitle: '¡Desinfección Masiva en los 4 Raíles!',
          color: 'cyan',
          createdAt: Date.now(),
        });

        for (let r = 0; r < GRID_RAILS; r++) {
          projectiles.push({
            id: `proj-ult-${r}-${Date.now()}`,
            x: r,
            y: 5.3,
            vx: 0,
            vy: -7.5,
            damage: 140,
            isEnemy: false,
            flavor: 'roomba_blade',
            pierceShield: true,
            fromDiagonalFoam: false,
            fromVortex: true,
            life: 2.0,
          });
        }
      }

      // Simulation step (clamped & affected by 20% Tactical Slow-Mo while holding/selecting a piece!)
      if (hitstopTimer > 0) {
        hitstopTimer = Math.max(0, hitstopTimer - dt);
      }

      const isPieceSelected = Boolean(selectedPieceIdRef.current);
      if (isPieceSelected && !inPlacementPhase) {
        slowMoTimer = 0.5;
      } else {
        slowMoTimer = 0;
      }

      const timeScale =
        gState !== 'playing'
          ? 0
          : hitstopTimer > 0
          ? 0.05
          : isPieceSelected && !inPlacementPhase
          ? 0.2 // 20% Tactical Slow-Mo while selecting/moving a piece during active wave!
          : 1.0;

      const simDt = dt * timeScale;

      // Evaluate combos & update 3D Combo Visuals (UV Flame Stream at y=0.96, Soap Bubble Fan, or Vortex Bar)
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
                const waveX = Math.sin(elapsed * 28 + k * 1.2 + idx) * 0.045;
                const waveY = Math.cos(elapsed * 34 + k * 0.9 + idx) * 0.045;
                const pulseScale = 0.84 + Math.sin(elapsed * 30 + k * 1.5 + idx) * 0.24;
                node.position.x = waveX;
                node.position.y = waveY;
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
          // Position the translucent spray cone + soap bubbles right at the Estropajo (toRow), fanning UPWARD (-Z) toward the plagues
          linkGroup.position.set(x2, 0.08, z2);
          linkGroup.rotation.y = 0;
        } else {
          if (fireStream) fireStream.visible = false;
          if (foamSpray) foamSpray.visible = false;
          if (floorBar) {
            floorBar.visible = true;
            floorBar.scale.set(1, 1, dist);
          }
          linkGroup.position.set((x1 + x2) / 2, 0.04, (z1 + z2) / 2);
          linkGroup.rotation.y = Math.atan2(x2 - x1, z2 - z1);
        }
      });

      // =======================================================================
      // GRID ON-DEMAND + SUBTLE WOOD ENGRAVING MARKS (0.12 opacity idle)
      // Circular wood marks remain at 0.12 opacity during normal play and
      // brighten ONLY when the player is in Tactical Mode selecting a cell.
      // =======================================================================
      const tutorialGuide = getTutorialGuideForLevel(stateRef.current.level, piecesRef.current);
      const pulse = 0.55 + Math.sin(elapsed * 8) * 0.35;

      for (let r = 0; r < GRID_RAILS; r++) {
        for (let row = 0; row < GRID_ROWS; row++) {
          const hl = cellHighlights[r][row];
          const hlMat = hl.material as THREE.MeshBasicMaterial;
          const spot = cellSpots[r][row];
          const isHovered = hoveredCell?.rail === r && hoveredCell?.row === row;
          const pieceAt = piecesRef.current.find((p) => p.rail === r && p.row === row);
          const isSelectedCell = pieceAt && pieceAt.id === selectedPieceIdRef.current;

          if (spot) {
            const spotMat = spot.material as THREE.MeshBasicMaterial;
            if (isPieceSelected) {
              spotMat.opacity = isHovered ? 0.24 : 0.12;
            } else {
              spotMat.opacity = 0.08;
            }
          }

          const isNextTutorialTarget =
            tutorialGuide?.nextTarget?.rail === r && tutorialGuide?.nextTarget?.row === row;
          const isOtherTutorialTarget =
            tutorialGuide?.targets.some((t) => t.rail === r && t.row === row) ?? false;

          if (row < MIN_PLACEABLE_ROW) {
            // Rows 0 and 1 (Filas 1 y 2) are forbidden placement zones near the spawn!
            if (isHovered && isPieceSelected) {
              hlMat.color.setHex(0xef4444);
              hlMat.opacity = 0.65;
            } else {
              hlMat.opacity = 0;
            }
          } else if (isNextTutorialTarget) {
            // Bright pulsing emerald/gold target cell for the current tutorial step!
            hlMat.color.setHex(0x22c55e);
            hlMat.opacity = pulse;
          } else if (isOtherTutorialTarget && inPlacementPhase) {
            hlMat.color.setHex(0xfacc15);
            hlMat.opacity = 0.45;
          } else if (isSelectedCell) {
            hlMat.color.setHex(0x38bdf8);
            hlMat.opacity = 0.92;
          } else if (isHovered && isPieceSelected) {
            hlMat.color.setHex(0xfacc15);
            hlMat.opacity = 0.88;
          } else if (isPieceSelected || isDraggingOnCanvas) {
            // GRID ON-DEMAND: Highlight valid cells while in Tactical Mode selecting where to place a piece!
            hlMat.color.setHex(0x38bdf8);
            hlMat.opacity = isDraggingOnCanvas ? 0.36 : 0.26;
          } else {
            // Smooth, clean countertop when no piece is selected!
            hlMat.opacity = 0;
          }
        }
      }

      // Update 3D Tactical Preview Group when a piece is selected/touched!
      const selPiece = piecesRef.current.find((p) => p.id === selectedPieceIdRef.current);
      const previewCell =
        hoveredCell && hoveredCell.row >= MIN_PLACEABLE_ROW
          ? hoveredCell
          : selPiece && selPiece.rail !== null && selPiece.row !== null
          ? { rail: selPiece.rail, row: selPiece.row }
          : tutorialGuide?.nextTarget
          ? { rail: tutorialGuide.nextTarget.rail, row: tutorialGuide.nextTarget.row }
          : null;

      if (selPiece && previewCell) {
        previewGroup.visible = true;
        previewGroup.position.set(
          gridToWorldX(previewCell.rail),
          0.14,
          gridToWorldZ(previewCell.row)
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
              p.rail === previewCell.rail &&
              (p.row === previewCell.row - 1 || p.row === previewCell.row - 2)
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
              node.position.x = Math.sin(elapsed * 28 + k * 1.2) * 0.04;
              node.position.y = Math.cos(elapsed * 34 + k * 0.9) * 0.04;
              const pulseScale = 0.85 + Math.sin(elapsed * 30 + k * 1.5) * 0.22;
              node.scale.set(pulseScale, pulseScale, 1.0);
            }
          }
        } else if (selPiece.type === 'soap_bar') {
          const cone = previewCones[0];
          cone.visible = true;
          (cone.material as THREE.MeshBasicMaterial).color.setHex(0xf472b6);
          const dir = previewCell.rail < GRID_RAILS - 1 ? 1 : -1;
          cone.position.set(dir * 0.95, 0, 0);
          cone.rotation.set(-Math.PI / 2, 0, -dir * (Math.PI / 2));
        } else if (selPiece.type === 'mop_vortex') {
          previewVortexRing.visible = true;
          previewVortexRing.rotation.z = elapsed * 4;
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

      // CRITICAL RULE 2: Wave simulation is PAUSED during 'PREP' (inPlacementPhase) and during 3s inter-wave pause!
      const waveSimDt = inPlacementPhase || prepTimer > 0 ? 0 : simDt;
      if (waveSimDt > 0 && combatComboWindowTimer > 0) {
        combatComboWindowTimer = Math.max(0, combatComboWindowTimer - waveSimDt);
        if (combatComboWindowTimer <= 0) combatComboStreak = 1;
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
        const isBeingDragged = piece.id === selectedPieceIdRef.current;
        entry.bounce = Math.max(0, entry.bounce - dt * 4.5);
        const bounceY = Math.sin(entry.bounce * Math.PI) * 0.35;

        const targetY = isBeingDragged ? 0.68 : bounceY;
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
            animPart.rotation.y += dt * 3.5;
          } else if (piece.type === 'scourer_nanas') {
            animPart.rotation.y += dt * 3.5;
          }
        }

        // Advance piece timers & firing ONLY when waveSimDt > 0 (never during PREP phase!)
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
                : 1.65 // Solo uncombined spray fires slowly so it cannot solo waves!
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

      // Clean up removed utensil meshes
      for (const [id, entry] of utensilMeshes.entries()) {
        if (!activePieceIds.has(id)) {
          utensilsGroup.remove(entry.group);
          utensilMeshes.delete(id);
        }
      }

      // Spawn new bugs according to current Level & Phase (progressive onboarding)
      if (waveSimDt > 0 && !gameEndedLock) {
        spawnTimer -= waveSimDt;
        const maxBugsOnScreen = stateRef.current.level <= 3 ? 3 : 5;
        if (spawnTimer <= 0 && bugs.length < maxBugsOnScreen) {
          const baseInterval =
            stateRef.current.level <= 3
              ? 3.4
              : Math.max(2.1, 3.0 - stateRef.current.level * 0.1);
          spawnTimer = baseInterval;

          const lvl = stateRef.current.level;
          // On Level 1, focus Cockroaches on Rails 2 & 3 (0-indexed 1 & 2) so the player's Line Foam combo hits both!
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
              roll < 0.22
                ? 'king_crab'
                : roll < 0.58
                ? 'cap_beetle'
                : roll < 0.85
                ? 'acid_wasp'
                : 'shift_roach';
          }

          const hpMap: Record<BugType, number> = {
            speed_ant: 40,
            cap_beetle: 84,
            acid_wasp: 64,
            shift_roach: 60,
            king_crab: 150,
          };
          const maxHp = hpMap[bType] * (1 + Math.max(0, lvl - 3) * 0.1);

          bugs.push({
            id: `bug-${Date.now()}-${Math.random()}`,
            type: bType,
            rail,
            targetRail: rail,
            yProgress: -0.35,
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
          });
        }
      }

      // Update Projectiles & Check Scourer Multiplication + Bug Hits
      const survivingProjectiles: Projectile[] = [];
      for (const proj of projectiles) {
        if (waveSimDt > 0) {
          proj.x += proj.vx * waveSimDt;
          proj.y += proj.vy * waveSimDt;
          proj.life -= waveSimDt;

          // Check if an allied straight droplet hits a Scourer ("Estropajo Nanas") to split into a 5-bullet Foam Fan!
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
                0xa3e635,
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
                  fromDiagonalFoam: Math.abs(ang) > 0.2,
                  fromVortex: false,
                  life: 1.4,
                });
              });
              proj.life = 0;
              continue;
            }
          }

          // Check if an Enemy Acid Glob hits a WC Shield or gunks a utensil
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
                proj.fromDiagonalFoam = true;
                proj.damage = 45;
                soundEngine.playFoamSplit();
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
                if (bug.hasShield && !proj.pierceShield) {
                  // 100% Frontal Shield Immunity! Bounces off completely with 0 damage!
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
                      subtitle: 'Une 2 Aerosoles UV 🔥 en paralelo o usa Jabón 🧼 para abrir su escudo',
                      color: 'orange',
                      createdAt: Date.now(),
                    });
                  }
                } else {
                  bug.hp -= proj.damage;
                  bug.flashTimer = 0.08;
                  if (proj.fromDiagonalFoam) bug.hitByDiagonalFoam = true;
                  if (proj.fromVortex) bug.hitByVortexSpin = true;
                }
                if (proj.flavor !== 'roomba_blade') {
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

      // Sync Projectile Meshes
      const activeProjIds = new Set<string>();
      for (const proj of projectiles) {
        activeProjIds.add(proj.id);
        let mesh = projMeshes.get(proj.id);
        if (!mesh) {
          const isBlade = proj.flavor === 'roomba_blade';
          const geo = isBlade
            ? new THREE.CylinderGeometry(0.36, 0.36, 0.12, 28)
            : new THREE.SphereGeometry(proj.isEnemy ? 0.14 : 0.12, 24, 24);
          const colorHex =
            proj.flavor === 'enemy_acid'
              ? 0xa855f7
              : proj.flavor === 'foam_fan'
              ? 0xa3e635
              : proj.flavor === 'vortex_soap'
              ? 0x2dd4bf
              : proj.flavor === 'bleach_glob'
              ? 0xfacc15
              : proj.flavor === 'roomba_blade'
              ? 0xef4444
              : 0x00d2ff;
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

      // Update Bugs & Check Traps (Soap Bar, Horizontal UV Bridge, Mop Vortex) + KO Transitions
      const warningRails: (BugType | null)[] = [null, null, null, null];
      const survivingBugs: BugEnemy[] = [];

      for (const bug of bugs) {
        if (bug.yProgress < 0.35 && bug.koTimer <= 0) {
          warningRails[Math.round(bug.rail)] = bug.type;
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

          // Smooth lateral slide when slipping on Soap Bar or shifting rails
          bug.rail = THREE.MathUtils.damp(bug.rail, bug.targetRail, 9, waveSimDt);

          // Base advance speed reduced by 45% (0.55x) on Levels 1-4 via getLevelSpeedMultiplier!
          const speedMap: Record<BugType, number> = {
            speed_ant: 0.72,
            cap_beetle: 0.5,
            acid_wasp: 0.46,
            shift_roach: 0.64,
            king_crab: 0.4,
          };
          const worldMult = WORLDS_CATALOG[stateRef.current.worldId].speedMult;
          const levelMult = getLevelSpeedMultiplier(stateRef.current.level);
          bug.yProgress += speedMap[bug.type] * worldMult * levelMult * waveSimDt;

          // Acid Wasp ranged attack telegraph & acid shot
          if (bug.type === 'acid_wasp' && bug.yProgress > 0.5 && bug.yProgress < 3.6) {
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

          const currentRailInt = Math.round(bug.rail);
          const currentRowInt = Math.round(bug.yProgress);

          // 1. Check Horizontal Aerosol UV Bridge at (currentRowInt)
          const bridgeLink = comboEval.links.find(
            (l) =>
              l.kind === 'bridge_uv' &&
              l.fromRow === currentRowInt &&
              (l.fromRail === currentRailInt || l.toRail === currentRailInt)
          );
          if (bridgeLink && Math.abs(bug.yProgress - currentRowInt) < 0.28) {
            if (bug.hasShield) {
              bug.hasShield = false; // Melts bottle-cap shield immediately!
              bug.hitByBridgeBurn = true;
              spawnParticles(
                gridToWorldX(bug.rail),
                0.55,
                gridToWorldZ(bug.yProgress),
                12,
                0xf97316,
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
                label: '¡Combo x2!',
                detail: '🔥 ¡Escudo Fundido!',
                color: 'orange',
                xPct: meltPos.xPct,
                yPct: meltPos.yPct,
                createdAt: Date.now(),
              });
            }
            bug.hp -= 48 * waveSimDt;
            bug.hitByBridgeBurn = true;
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
                label: '¡Combo x2!',
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

          // 3. Check if sliding bug enters a Mop Vortex cell -> Instant 3★ Centrifuge!
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
            bug.hp -= (bug.isSlidingFromSoap ? 240 : 65) * waveSimDt;
          }

          // Check if Bug is defeated!
          if (bug.hp <= 0) {
            const elim = classifyBugElimination(bug);
            bug.koTimer = 0.38;
            bug.koStar = elim.stars;
            phaseKills += 1;
            totalBugsCleaned += 1;
            const ptsAwarded = elim.stars === 3 ? 350 : elim.stars === 2 ? 180 : 100;
            score += ptsAwarded;
            const pressureGain =
              stateRef.current.armorId === 'golden_scourer_mail' ? 24 : 18;
            pressurePct = Math.min(100, pressurePct + pressureGain);

            soundEngine.playStarKill(elim.stars);
            spawnParticles(
              gridToWorldX(bug.rail),
              0.55,
              gridToWorldZ(bug.yProgress),
              elim.stars === 3 ? 24 : 14,
              elim.stars === 3 ? 0x2dd4bf : elim.stars === 2 ? 0xa3e635 : 0xfacc15,
              3.2
            );

            if (elim.stars >= 2) {
              hitstopTimer = 0.045;
              cameraTrauma = elim.stars === 3 ? 0.65 : 0.35;
              chefCelebrateTimer = 0.75;
            }

            if (elim.achievementId) {
              stateRef.current.onAchievementKill(
                elim.achievementId,
                elim.stars,
                elim.stars * 45
              );
            }

            // RULE 4: Comic Pop-up + Floating Combo Toast when killed by a player-placed combo!
            const playerHasPlacedCombo = piecesRef.current.some(
              (p) => p.rail !== null && p.row !== null && p.comboType !== 'none'
            );
            const killedByComboAction =
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
                label: `¡Combo x${combatComboStreak}!`,
                detail: `+${ptsAwarded} PTS · ${'★'.repeat(elim.stars)}`,
                color: elim.stars === 3 ? 'cyan' : elim.stars === 2 ? 'green' : 'yellow',
                xPct: killPos.xPct,
                yPct: killPos.yPct,
                createdAt: nowMs,
              });

              if (nowMs - lastKillComicPopAt >= 6000) {
                lastKillComicPopAt = nowMs;
                stateRef.current.onComicPop({
                  id: `kill-${bug.id}`,
                  title: elim.comicTitle,
                  subtitle: elim.comicSubtitle,
                  stars: elim.stars,
                  color: elim.stars === 3 ? 'cyan' : elim.stars === 2 ? 'green' : 'yellow',
                  createdAt: nowMs,
                });
              }
            }

            // Check deterministic Phase Transition (Fase 1 -> Fase 2 -> Fase 3 -> Victory)
            const trans = checkPhaseTransition(phase, phaseKills, stateRef.current.level);
            if (trans.shouldAdvance) {
              if (trans.nextPhase === 'victory') {
                gameEndedLock = true;
                setTimeout(() => {
                  stateRef.current.onGameEnd(true, {
                    score,
                    phaseReached: 3,
                    remainingKillsToNext: 0,
                    bugsCleaned: totalBugsCleaned,
                  });
                }, 450);
              } else {
                phase = trans.nextPhase;
                phaseKills = 0;
                prepTimer = 3.0; // Real 3-second pause between phases showing incoming rails!
                spawnWavePreviewBugs(stateRef.current.level, phase);
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
            if (sanitationSeals > 0) {
              // Bug eats the food on this rail's plate (leaving the empty white porcelain plate, matching Plate 3 in 1794109185461.jpg!)
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
                damage: 999,
                isEnemy: false,
                flavor: 'bleach_glob',
                pierceShield: true,
                fromDiagonalFoam: false,
                fromVortex: false,
                life: 1.8,
              });
              continue;
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

      // Sync 3D Bug Meshes (with mandatory 0.75 scale!)
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
        mesh.position.set(wx, gaitBob, wz);

        if (bug.koTimer > 0) {
          mesh.position.y += (0.4 - bug.koTimer) * 3.8;
          mesh.rotation.y += dt * 18;
          mesh.rotation.x += dt * 12;
          mesh.scale.setScalar(Math.max(0.08, bug.koTimer * 1.8));
        } else {
          mesh.rotation.set(0, Math.sin(bug.yProgress * 5) * 0.09, 0);
          mesh.scale.setScalar(0.75);

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

      // Update Warning Beacons at top of rails
      warningBeacons.forEach((b, rIdx) => {
        const mat = b.material as THREE.MeshBasicMaterial;
        if (warningRails[rIdx]) {
          mat.opacity = 0.48 + Math.sin(elapsed * 12) * 0.32;
        } else {
          mat.opacity = 0;
        }
      });

      // Animate 3D Chef Bastion at z = +4.72, y = -0.24 (standing clearly above the bottom Gunmetal Tray!)
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
          selectedPieceId: selectedPieceIdRef.current,
          hoveredCell,
          activeWarningRails: warningRails,
          pieces: piecesRef.current,
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
