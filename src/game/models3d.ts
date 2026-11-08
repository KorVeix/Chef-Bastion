import * as THREE from 'three';
import { ArmorId, BugType, HatId, UtensilType } from './types';

// ============================================================================
// 1. MOTOR DE TINTA NEGRA Y CEL-SHADING PURO (ESTILO ILUSTRACIÓN 3D)
// ============================================================================

const INK_COLOR_HEX = 0x141013;
let cachedToonGradientMap: THREE.DataTexture | null = null;

/**
 * Generates a crisp 3-step NearestFilter DataTexture gradientMap for pure Cel-Shading.
 */
export function getToonGradientMap(): THREE.DataTexture {
  if (cachedToonGradientMap) return cachedToonGradientMap;

  const data = new Uint8Array([
    118, 118, 118, 255,
    198, 198, 198, 255,
    255, 255, 255, 255,
  ]);
  const tex = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  cachedToonGradientMap = tex;
  return tex;
}

/**
 * Mandatory Cel-Shaded Toon Material factory with 3-step hard gradient cutoff.
 */
export function createToonMaterial(
  colorHex: number | string,
  options?: {
    map?: THREE.Texture | null;
    emissive?: number;
    emissiveIntensity?: number;
    transparent?: boolean;
    opacity?: number;
  }
): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({
    color: colorHex,
    gradientMap: getToonGradientMap(),
    map: options?.map ?? null,
    emissive:
      options?.emissive !== undefined
        ? new THREE.Color(options.emissive)
        : new THREE.Color(0x000000),
    emissiveIntensity: options?.emissiveIntensity ?? 0,
    transparent: options?.transparent ?? false,
    opacity: options?.opacity ?? 1,
  });
}

/**
 * Traverses all child Meshes in `groupOrMesh` and attaches a clean Inverted-Hull BackSide
 * black ink outline mesh (`0x141013`) using `polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 2`
 * and a uniform scale of `1.028` per individual mesh.
 */
export function addInkOutline(
  groupOrMesh: THREE.Object3D,
  _thickness = 0.028,
  color = INK_COLOR_HEX
): void {
  const outlineMat = new THREE.MeshBasicMaterial({
    color,
    side: THREE.BackSide,
    polygonOffset: true,
    polygonOffsetFactor: 2,
    polygonOffsetUnits: 2,
  });

  const meshesToOutline: THREE.Mesh[] = [];
  groupOrMesh.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      if (
        child.userData.skipOutline ||
        child.userData.isInkOutline ||
        child.name === 'contact_shadow' ||
        child.name === 'gunk_overlay'
      ) {
        return;
      }
      const mat = child.material as THREE.Material;
      if (mat && mat.transparent && (mat as THREE.MeshBasicMaterial).opacity < 0.85) {
        return;
      }
      meshesToOutline.push(child);
    }
  });

  for (const mesh of meshesToOutline) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const scaleFactor =
      typeof mesh.userData.outlineScale === 'number'
        ? mesh.userData.outlineScale
        : 1.028;
    const outlineMesh = new THREE.Mesh(mesh.geometry, outlineMat);
    outlineMesh.scale.setScalar(scaleFactor);
    outlineMesh.userData.isInkOutline = true;
    outlineMesh.castShadow = false;
    outlineMesh.receiveShadow = false;
    mesh.add(outlineMesh);
  }
}

export const addToonOutline = addInkOutline;

/**
 * Creates a smooth stylized comic contact shadow (32 radial segments)
 * placed right under every bug, utensil, and plate.
 */
function createComicContactShadow(radiusX = 0.52, radiusZ = 0.46, offsetX = 0.08): THREE.Mesh {
  const geo = new THREE.CircleGeometry(1, 32);
  geo.rotateX(-Math.PI / 2);
  geo.scale(radiusX, 1, radiusZ);
  const mat = new THREE.MeshBasicMaterial({
    color: 0x3b210e,
    transparent: true,
    opacity: 0.34,
    depthWrite: false,
  });
  const shadow = new THREE.Mesh(geo, mat);
  shadow.position.set(offsetX, 0.014, 0.04);
  shadow.name = 'contact_shadow';
  shadow.userData.skipOutline = true;
  return shadow;
}

// ============================================================================
// 2. TEXTURAS PROCEDURALES RICAS EN CANVAS 2D (FIEL A LA IMAGEN DE REFERENCIA)
// ============================================================================

let cachedCounterTex: THREE.CanvasTexture | null = null;
let cachedOuterTableTex: THREE.CanvasTexture | null = null;
let cachedKitchenFloorTex: THREE.CanvasTexture | null = null;
let cachedBacksplashTex: THREE.CanvasTexture | null = null;
let cachedChefFaceTex: THREE.CanvasTexture | null = null;
let cachedSpongeTex: THREE.CanvasTexture | null = null;
const cachedLabelTextures = new Map<string, THREE.CanvasTexture>();

/**
 * 4-Plank Golden Maple Butcher-Block Table texture (`#e5a45c`):
 * - 4 distinct vertical wooden planks (1 per rail) separated by 3 carved vertical plank seams
 * - Brass/wood corner dowels at the top and bottom of each plank
 * - Soft dark circular cell spots on the playable rows (Filas 3..7)
 */
export function createWoodGrainTexture(
  renderer?: THREE.WebGLRenderer,
  baseHex = '#e5a45c'
): THREE.CanvasTexture {
  if (cachedCounterTex && baseHex === '#e5a45c') return cachedCounterTex;

  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1536;
  const ctx = canvas.getContext('2d')!;

  // Warm golden-honey butcher block base
  const grad = ctx.createLinearGradient(0, 0, 1024, 1536);
  grad.addColorStop(0, baseHex);
  grad.addColorStop(0.55, '#df9a4f');
  grad.addColorStop(1, '#d4893e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 1536);

  // 4 Rail Plank subtle tonal variation
  const plankEdges = [40, 276, 512, 748, 984];
  for (let p = 0; p < 4; p++) {
    ctx.fillStyle = p % 2 === 0 ? 'rgba(255, 235, 200, 0.08)' : 'rgba(160, 88, 28, 0.08)';
    ctx.fillRect(plankEdges[p], 0, plankEdges[p + 1] - plankEdges[p], 1536);
  }

  // Hand-drawn warm wood grain strokes + knots
  ctx.strokeStyle = 'rgba(138, 75, 24, 0.26)';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  for (let i = 0; i < 72; i++) {
    const x = 48 + ((i * 97) % 928);
    const y = (i * 173) % 1460;
    const len = 60 + (i % 6) * 34;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + (i % 2 === 0 ? 8 : -8), y + len * 0.5, x, y + len);
    ctx.stroke();
  }

  // Subtle wood grain only — circular cell marks are rendered via 3D cellSpots at 0.12 opacity
  // (brightening only when selecting a piece in Tactical Mode).

  // Left & Right outer apron trim seams
  [40, 984].forEach((ex) => {
    ctx.fillStyle = '#5c2808';
    ctx.fillRect(ex - 3, 0, 6, 1536);
  });

  // 3 Full-Length Carved Vertical Plank Seams separating Rails 1, 2, 3, and 4
  const dividerXs = [276, 512, 748];
  for (const dx of dividerXs) {
    ctx.fillStyle = '#5c2808';
    ctx.fillRect(dx - 4, 16, 8, 1504);
    ctx.fillStyle = '#f6ad55';
    ctx.fillRect(dx + 4, 16, 3, 1504);
  }

  // Wood/brass dowels at top & bottom corners of the butcher block
  const dowelPositions = [
    [95, 42],
    [929, 42],
    [76, 1168],
    [948, 1168],
    [76, 1465],
    [948, 1465],
  ];
  for (const [cx, cy] of dowelPositions) {
    ctx.fillStyle = '#925226';
    ctx.beginPath();
    ctx.arc(cx, cy, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#3b1804';
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  // Bold comic ink outer border around the cutting board
  ctx.strokeStyle = '#141013';
  ctx.lineWidth = 16;
  ctx.strokeRect(8, 8, 1008, 1520);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  if (renderer) {
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  }
  tex.needsUpdate = true;
  if (baseHex === '#e5a45c') cachedCounterTex = tex;
  return tex;
}

/**
 * Rich Darker Brown Wooden Side Counter Texture (`#925226`) for the left & right side counters.
 */
export function createOuterTableWoodTexture(): THREE.CanvasTexture {
  if (cachedOuterTableTex) return cachedOuterTableTex;

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#925226';
  ctx.fillRect(0, 0, 512, 512);

  ctx.fillStyle = 'rgba(68, 32, 10, 0.22)';
  for (let i = 0; i < 8; i++) {
    if (i % 2 === 0) ctx.fillRect(0, i * 64, 512, 64);
  }
  ctx.strokeStyle = 'rgba(45, 20, 6, 0.35)';
  ctx.lineWidth = 3;
  for (let i = 0; i <= 8; i++) {
    ctx.beginPath();
    ctx.moveTo(0, i * 64);
    ctx.lineTo(512, i * 64);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  tex.needsUpdate = true;
  cachedOuterTableTex = tex;
  return tex;
}

/**
 * Grey Tiled Kitchen Floor Texture visible under the front of the Butcher Block Table
 * (around the wooden table legs, Chef, and bottom tactical tray).
 */
export function createKitchenFloorTileTexture(): THREE.CanvasTexture {
  if (cachedKitchenFloorTex) return cachedKitchenFloorTex;

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#475569';
  ctx.fillRect(0, 0, 512, 512);

  const step = 128;
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      ctx.fillStyle = (r + c) % 2 === 0 ? '#64748b' : '#526277';
      ctx.fillRect(c * step + 4, r * step + 4, step - 8, step - 8);
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 4;
      ctx.strokeRect(c * step + 2, r * step + 2, step - 4, step - 4);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 2);
  tex.needsUpdate = true;
  cachedKitchenFloorTex = tex;
  return tex;
}

/**
 * Full-width White Subway Tile Kitchen Wall texture (matching the top of the reference image).
 */
export function createBacksplashTileTexture(): THREE.CanvasTexture {
  if (cachedBacksplashTex) return cachedBacksplashTex;

  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#94a3b8';
  ctx.fillRect(0, 0, 1024, 512);

  const cols = 6;
  const rows = 6;
  const tw = 1024 / cols;
  const th = 512 / rows;

  for (let r = 0; r < rows; r++) {
    const offset = (r % 2) * (tw * 0.5);
    for (let c = -1; c <= cols; c++) {
      const x = c * tw + offset;
      const y = r * th;

      ctx.fillStyle = (r + c) % 3 === 0 ? '#cbd5e1' : '#e2e8f0';
      ctx.fillRect(x + 4, y + 4, tw - 8, th - 8);

      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(x + 6, y + 6, tw - 16, 10);

      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 4;
      ctx.strokeRect(x + 3, y + 3, tw - 6, th - 6);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  tex.needsUpdate = true;
  cachedBacksplashTex = tex;
  return tex;
}

/**
 * Porous yellow sponge texture for Estropajo Nanas.
 */
function createSpongeTexture(): THREE.CanvasTexture {
  if (cachedSpongeTex) return cachedSpongeTex;

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#eab308';
  ctx.fillRect(0, 0, 256, 256);

  ctx.fillStyle = '#713f12';
  for (let i = 0; i < 48; i++) {
    const px = 16 + ((i * 53) % 224);
    const py = 16 + ((i * 79) % 224);
    const r = 4 + (i % 4) * 2.5;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  cachedSpongeTex = tex;
  return tex;
}

/**
 * High-contrast Canvas2D illustrated face texture for the Chibi Chef.
 */
function createChefFaceTexture(): THREE.CanvasTexture {
  if (cachedChefFaceTex) return cachedChefFaceTex;

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#f6c49e';
  ctx.fillRect(0, 0, 512, 512);

  ctx.fillStyle = 'rgba(239, 108, 108, 0.45)';
  ctx.beginPath();
  ctx.ellipse(165, 295, 34, 22, 0, 0, Math.PI * 2);
  ctx.ellipse(347, 295, 34, 22, 0, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  cachedChefFaceTex = tex;
  return tex;
}

/**
 * Illustrated comic label texture for the Spray Flus-Flus (Turquoise body + Pink/Coral label)
 * & Purple Aerosol UV bottles (Purple body + White outlined text).
 */
function createBottleLabelTexture(
  bodyHex: string,
  labelBgHex: string,
  line1: string,
  line2 = ''
): THREE.CanvasTexture {
  const key = `${bodyHex}_${labelBgHex}_${line1}_${line2}`;
  if (cachedLabelTextures.has(key)) return cachedLabelTextures.get(key)!;

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = bodyHex;
  ctx.fillRect(0, 0, 512, 256);

  [128, 384].forEach((cx) => {
    if (labelBgHex !== bodyHex) {
      ctx.fillStyle = labelBgHex;
      ctx.beginPath();
      ctx.roundRect(cx - 88, 38, 176, 180, 22);
      ctx.fill();
      ctx.strokeStyle = '#141013';
      ctx.lineWidth = 7;
      ctx.stroke();
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    if (line2) {
      ctx.font = '900 44px sans-serif';
      ctx.strokeStyle = '#141013';
      ctx.lineWidth = 11;
      ctx.strokeText(line1, cx, 102);
      ctx.strokeText(line2, cx, 158);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(line1, cx, 102);
      ctx.fillText(line2, cx, 158);
    } else {
      ctx.font = '900 66px sans-serif';
      ctx.strokeStyle = '#141013';
      ctx.lineWidth = 12;
      ctx.strokeText(line1, cx, 130);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(line1, cx, 130);
    }
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  cachedLabelTextures.set(key, tex);
  return tex;
}

// ============================================================================
// 3. ARSENAL "HIGIENE LETAL" 3D (FIEL A LA IMAGEN 1794109185461.jpg)
// ============================================================================

export function buildUtensilMesh(type: UtensilType, _isSoftwareGl = false): THREE.Group {
  const root = new THREE.Group();
  root.scale.setScalar(0.75);
  root.add(createComicContactShadow(0.54, 0.46, 0.14));

  // Tilt -18° back toward the camera so front labels, triggers, and nozzles pop clearly
  const group = new THREE.Group();
  group.rotation.x = -THREE.MathUtils.degToRad(18);
  root.add(group);

  if (type === 'spray_flus') {
    // 1. SPRAY "FLUS-FLUS" TÁCTICO: Turquoise-Cyan sculpted bottle + Pink/Coral "Flus-Flus" label + Red Trigger Spray Head
    const bottleMat = createToonMaterial(0xffffff, {
      map: createBottleLabelTexture('#22d3ee', '#fb7185', 'Flus-', 'Flus'),
    });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 0.82, 32), bottleMat);
    body.scale.set(1.08, 1, 0.82);
    body.rotation.y = Math.PI / 2;
    body.position.y = 0.42;
    group.add(body);

    const neck = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.28, 0.22, 32),
      createToonMaterial(0x06b6d4)
    );
    neck.position.y = 0.9;
    group.add(neck);

    const redMat = createToonMaterial(0xef4444);
    const collar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.18, 0.12, 28),
      redMat
    );
    collar.position.y = 1.02;
    group.add(collar);

    const headCap = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.24, 0.52), redMat);
    headCap.position.set(0, 1.16, -0.04);
    group.add(headCap);

    const nozzle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.11, 0.2, 28),
      redMat
    );
    nozzle.rotation.x = Math.PI / 2;
    nozzle.position.set(0, 1.16, -0.32);
    group.add(nozzle);

    const triggerLever = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.14), redMat);
    triggerLever.position.set(0.15, 0.96, 0.2);
    triggerLever.rotation.x = -0.38;
    triggerLever.name = 'anim_part';
    group.add(triggerLever);
  } else if (type === 'scourer_nanas') {
    // 2. ESTROPAJO DOBLE CARA "NANAS": Porous Yellow Sponge Base + Wavy Green Scouring Pad Top
    const spongeGroup = new THREE.Group();
    spongeGroup.position.y = 0.24;
    spongeGroup.rotation.y = 0.32;

    const yellowBlock = new THREE.Mesh(
      new THREE.BoxGeometry(0.88, 0.34, 0.62),
      createToonMaterial(0xffffff, { map: createSpongeTexture() })
    );
    const greenScrub = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.17, 0.64),
      createToonMaterial(0x22c55e)
    );
    greenScrub.position.y = 0.24;
    spongeGroup.add(yellowBlock, greenScrub);
    group.add(spongeGroup);

    const foamGroup = new THREE.Group();
    foamGroup.name = 'anim_part';
    const bubbleMat = createToonMaterial(0xe0f2fe, { transparent: true, opacity: 0.9 });
    [
      [-0.24, 0.52, 0.12, 0.12],
      [0.22, 0.54, -0.1, 0.14],
      [0.02, 0.58, 0.15, 0.11],
    ].forEach(([bx, by, bz, br]) => {
      const b = new THREE.Mesh(new THREE.SphereGeometry(br, 28, 28), bubbleMat);
      b.position.set(bx, by, bz);
      foamGroup.add(b);
    });
    group.add(foamGroup);
  } else if (type === 'aerosol_torch') {
    // 3. AEROSOL "MATA-TODO" UV: Purple Canister (#7c3aed) with White Outlined "Aerosol UV" text & Silver Dome
    const canMat = createToonMaterial(0xffffff, {
      map: createBottleLabelTexture('#7c3aed', '#7c3aed', 'Aerosol', 'UV'),
    });
    const can = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.86, 32), canMat);
    can.rotation.y = Math.PI / 2;
    can.position.y = 0.45;
    group.add(can);

    const bottomRim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.34, 0.08, 32),
      createToonMaterial(0xcbd5e1)
    );
    bottomRim.position.y = 0.05;
    group.add(bottomRim);

    const topRim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.34, 0.07, 32),
      createToonMaterial(0xcbd5e1)
    );
    topRim.position.y = 0.87;
    group.add(topRim);

    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(0.31, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
      createToonMaterial(0xe2e8f0)
    );
    dome.position.y = 0.87;
    group.add(dome);

    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.11, 0.16, 28),
      createToonMaterial(0xffffff)
    );
    cap.position.y = 1.13;
    group.add(cap);

    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.14, 0.32, 28),
      createToonMaterial(0xfacc15, { emissive: 0xf97316, emissiveIntensity: 0.65 })
    );
    flame.position.set(0, 1.34, 0);
    flame.name = 'anim_part';
    group.add(flame);
  } else if (type === 'soap_bar') {
    // 4. PASTILLA DE JABÓN RESBALÓN 45°
    const puddle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.48, 0.52, 0.05, 32),
      createToonMaterial(0x7dd3fc)
    );
    puddle.position.y = 0.03;
    group.add(puddle);

    const soapGroup = new THREE.Group();
    soapGroup.position.y = 0.22;
    soapGroup.rotation.y = Math.PI / 4;

    const soapMain = new THREE.Mesh(
      new THREE.BoxGeometry(0.78, 0.28, 0.5),
      createToonMaterial(0xf472b6)
    );
    const soapInset = new THREE.Mesh(
      new THREE.BoxGeometry(0.56, 0.31, 0.3),
      createToonMaterial(0xfbcfe8)
    );
    soapInset.userData.skipOutline = true;
    soapGroup.add(soapMain, soapInset);
    group.add(soapGroup);
  } else if (type === 'mop_vortex') {
    // 5. FREGONA "TURBO-SPIN" 360°
    const stick = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 1.05, 28),
      createToonMaterial(0xef4444)
    );
    stick.position.y = 0.58;
    group.add(stick);

    const mopHead = new THREE.Group();
    mopHead.position.y = 0.18;
    mopHead.name = 'anim_part';

    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.26, 0.2, 32),
      createToonMaterial(0x0284c7)
    );
    cap.position.y = 0.16;
    mopHead.add(cap);

    const strandMat = createToonMaterial(0x2dd4bf);
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const strand = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.46, 24), strandMat);
      strand.rotation.z = Math.PI / 2.2;
      strand.rotation.y = angle;
      strand.position.set(Math.cos(angle) * 0.28, 0.04, Math.sin(angle) * 0.28);
      mopHead.add(strand);
    }
    group.add(mopHead);
  } else if (type === 'wc_shield') {
    const holder = new THREE.Mesh(
      new THREE.BoxGeometry(0.82, 0.54, 0.24),
      createToonMaterial(0xffffff)
    );
    holder.position.y = 0.32;
    const gel = new THREE.Mesh(
      new THREE.BoxGeometry(0.68, 0.4, 0.28),
      createToonMaterial(0x00d2ff)
    );
    gel.position.y = 0.32;
    group.add(holder, gel);
  } else {
    const jug = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.4, 0.78, 32),
      createToonMaterial(0xfacc15)
    );
    jug.position.y = 0.42;
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.15, 0.2, 28),
      createToonMaterial(0xef4444)
    );
    cap.position.y = 0.88;
    group.add(jug, cap);
  }

  addInkOutline(group);

  const gunk = new THREE.Mesh(
    new THREE.SphereGeometry(0.48, 28, 28),
    createToonMaterial(0x65a30d, { transparent: true, opacity: 0.85 })
  );
  gunk.scale.set(1.1, 0.65, 1.1);
  gunk.position.y = 0.4;
  gunk.visible = false;
  gunk.name = 'gunk_overlay';
  gunk.userData.skipOutline = true;
  root.add(gunk);

  return root;
}

// ============================================================================
// 4. PLAGAS 3D SUAVIZADAS CON CONTORNO DE TINTA LIMPIO (ESCALA 0.75)
// ============================================================================

export function buildBugMesh(type: BugType): THREE.Group {
  const root = new THREE.Group();
  root.scale.setScalar(0.75);
  const isBoss = type === 'king_crab';
  root.add(createComicContactShadow(isBoss ? 0.62 : 0.46, isBoss ? 0.62 : 0.5, 0.06));

  const group = new THREE.Group();
  group.rotation.x = -THREE.MathUtils.degToRad(12);
  root.add(group);

  const eyeWhiteMat = createToonMaterial(0xffffff);
  const pupilMat = new THREE.MeshBasicMaterial({ color: INK_COLOR_HEX });

  if (type === 'speed_ant' || type === 'shift_roach') {
    const darkShellMat = createToonMaterial(type === 'shift_roach' ? 0x9a3412 : 0xb45309);
    const wingCaseMat = createToonMaterial(type === 'shift_roach' ? 0xfbbf24 : 0xf59e0b);
    const blackLegMat = createToonMaterial(0x1c1917);

    const abdomen = new THREE.Mesh(new THREE.SphereGeometry(0.36, 32, 28), darkShellMat);
    abdomen.scale.set(0.92, 0.52, 1.38);
    abdomen.position.set(0, 0.28, -0.05);
    group.add(abdomen);

    [-0.11, 0.11].forEach((wx) => {
      const wing = new THREE.Mesh(new THREE.SphereGeometry(0.22, 28, 24), wingCaseMat);
      wing.scale.set(0.55, 0.38, 1.32);
      wing.position.set(wx, 0.4, -0.06);
      wing.userData.skipOutline = true;
      group.add(wing);
    });

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 32, 28), darkShellMat);
    head.scale.set(0.95, 0.78, 1.05);
    head.position.set(0, 0.3, 0.36);
    group.add(head);

    [-0.12, 0.12].forEach((ex) => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.1, 28, 28), eyeWhiteMat);
      eye.position.set(ex, 0.4, 0.45);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.052, 20, 20), pupilMat);
      pupil.position.set(ex, 0.41, 0.53);
      pupil.userData.skipOutline = true;
      group.add(eye, pupil);
    });

    [-0.12, 0.12].forEach((ax) => {
      const ant1 = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.03, 0.58, 20), blackLegMat);
      ant1.position.set(ax * 1.5, 0.54, 0.56);
      ant1.rotation.x = Math.PI / 3.2;
      ant1.rotation.z = ax > 0 ? -0.42 : 0.42;
      group.add(ant1);
    });

    const legsGroup = new THREE.Group();
    legsGroup.name = 'anim_legs';
    [-0.24, 0, 0.24].forEach((lz, idx) => {
      [-1, 1].forEach((side) => {
        const leg = new THREE.Mesh(
          new THREE.CylinderGeometry(0.03, 0.024, 0.4, 16),
          blackLegMat
        );
        leg.position.set(side * 0.38, 0.16, lz);
        leg.rotation.z = side * (Math.PI / 2 - 0.38);
        leg.rotation.y = side * (idx - 1) * 0.28;
        legsGroup.add(leg);
      });
    });
    group.add(legsGroup);
  } else if (type === 'cap_beetle' || type === 'king_crab') {
    const scale = isBoss ? 1.22 : 1.0;
    const furMat = createToonMaterial(isBoss ? 0x475569 : 0x64748b);
    const bellyMat = createToonMaterial(0xcbd5e1);
    const pinkMat = createToonMaterial(0xf472b6);

    const body = new THREE.Mesh(new THREE.SphereGeometry(0.4 * scale, 32, 28), furMat);
    body.scale.set(0.95, 0.86, 1.18);
    body.position.set(0, 0.38 * scale, -0.04 * scale);
    group.add(body);

    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.32 * scale, 28, 24), bellyMat);
    belly.scale.set(0.85, 0.6, 1.05);
    belly.position.set(0, 0.26 * scale, 0.06 * scale);
    belly.userData.skipOutline = true;
    group.add(belly);

    const snout = new THREE.Mesh(
      new THREE.ConeGeometry(0.26 * scale, 0.5 * scale, 32),
      furMat
    );
    snout.rotation.x = Math.PI / 2;
    snout.position.set(0, 0.42 * scale, 0.42 * scale);
    group.add(snout);

    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.08 * scale, 28, 28), pinkMat);
    nose.position.set(0, 0.44 * scale, 0.68 * scale);
    group.add(nose);

    [-0.28 * scale, 0.28 * scale].forEach((ex) => {
      const earGroup = new THREE.Group();
      earGroup.position.set(ex, 0.74 * scale, 0.2 * scale);
      earGroup.rotation.z = ex > 0 ? -0.2 : 0.2;

      const outerEar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2 * scale, 0.2 * scale, 0.07 * scale, 32),
        furMat
      );
      outerEar.rotation.x = Math.PI / 2;

      const innerEar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.13 * scale, 0.13 * scale, 0.085 * scale, 32),
        pinkMat
      );
      innerEar.rotation.x = Math.PI / 2;
      innerEar.position.z = 0.012;
      innerEar.userData.skipOutline = true;

      earGroup.add(outerEar, innerEar);
      group.add(earGroup);
    });

    [-0.12 * scale, 0.12 * scale].forEach((ex) => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.085 * scale, 28, 28), eyeWhiteMat);
      eye.position.set(ex, 0.56 * scale, 0.44 * scale);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.048, 20, 20), pupilMat);
      pupil.position.set(ex, 0.56 * scale, 0.51 * scale);
      pupil.userData.skipOutline = true;
      group.add(eye, pupil);
    });

    if (isBoss) {
      const crown = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.16, 0.24, 28),
        createToonMaterial(0xfacc15)
      );
      crown.position.set(0, 0.98, 0.24);
      group.add(crown);
    }

    const tailGroup = new THREE.Group();
    tailGroup.name = 'anim_tail';
    tailGroup.position.set(0, 0.3 * scale, -0.46 * scale);
    const seg1 = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04 * scale, 0.065 * scale, 0.46 * scale, 24),
      pinkMat
    );
    seg1.rotation.x = Math.PI / 2.4;
    seg1.position.set(-0.08, 0.08, -0.18 * scale);
    tailGroup.add(seg1);
    group.add(tailGroup);

    // Red Heater Shield with Silver Rim held clearly on the Rat's flank/front
    const capShield = new THREE.Group();
    capShield.name = 'bottle_cap_shield';
    const outerShield = new THREE.Mesh(
      new THREE.CylinderGeometry(0.38 * scale, 0.28 * scale, 0.1, 32),
      createToonMaterial(0xcbd5e1)
    );
    outerShield.rotation.x = Math.PI / 2;
    const innerRedShield = new THREE.Mesh(
      new THREE.CylinderGeometry(0.31 * scale, 0.22 * scale, 0.12, 32),
      createToonMaterial(isBoss ? 0xfacc15 : 0xdc2626)
    );
    innerRedShield.rotation.x = Math.PI / 2;
    innerRedShield.userData.skipOutline = true;
    capShield.add(outerShield, innerRedShield);
    capShield.position.set(0.34 * scale, 0.36 * scale, 0.36 * scale);
    capShield.rotation.y = -0.35;
    group.add(capShield);
  } else {
    const darkMat = createToonMaterial(0x1e293b);
    const yellowMat = createToonMaterial(0xfacc15);
    const redEyeMat = createToonMaterial(0xef4444);

    const thorax = new THREE.Mesh(new THREE.SphereGeometry(0.28, 32, 28), darkMat);
    thorax.position.set(0, 0.56, 0.12);
    const abdomen = new THREE.Mesh(new THREE.SphereGeometry(0.32, 32, 28), yellowMat);
    abdomen.scale.set(0.9, 0.85, 1.25);
    abdomen.position.set(0, 0.54, -0.28);
    group.add(thorax, abdomen);

    [-0.14, 0.14].forEach((ex) => {
      const redEye = new THREE.Mesh(new THREE.SphereGeometry(0.14, 28, 28), redEyeMat);
      redEye.position.set(ex, 0.62, 0.34);
      group.add(redEye);
    });

    const wingsGroup = new THREE.Group();
    wingsGroup.name = 'anim_wings';
    const wingMat = createToonMaterial(0xe0f2fe, { transparent: true, opacity: 0.86 });

    const leftWing = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.03, 28), wingMat);
    leftWing.scale.set(1.4, 1, 0.7);
    leftWing.position.set(-0.4, 0.78, 0.04);
    leftWing.rotation.z = 0.25;
    leftWing.name = 'left_wing';

    const rightWing = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.03, 28), wingMat);
    rightWing.scale.set(1.4, 1, 0.7);
    rightWing.position.set(0.4, 0.78, 0.04);
    rightWing.rotation.z = -0.25;
    rightWing.name = 'right_wing';

    wingsGroup.add(leftWing, rightWing);
    group.add(wingsGroup);
  }

  addInkOutline(group);

  const skates = new THREE.Mesh(
    new THREE.TorusGeometry(0.4, 0.11, 16, 32),
    createToonMaterial(0xf472b6)
  );
  skates.rotation.x = Math.PI / 2;
  skates.position.y = 0.12;
  skates.visible = false;
  skates.name = 'foam_skates';
  addInkOutline(skates);
  root.add(skates);

  return root;
}

// ============================================================================
// 5. CHEF BASTION CHIBI ILUSTRADO (FIEL A 1794109185461.jpg:
//    PELO CASTAÑO, PUNTAS DEL BIGOTE ASOMANDO POR LOS LADOS, PAÑUELO ROJO Y GORRO ALTO)
// ============================================================================

export function buildChefBastionMesh(hat: HatId, armor: ArmorId): THREE.Group {
  const root = new THREE.Group();
  root.scale.setScalar(0.46);

  const chef = new THREE.Group();
  chef.name = 'chef_inner';
  root.add(chef);

  const jacketHex =
    armor === 'hazmat_epi'
      ? 0xfacc15
      : armor === 'golden_scourer_mail'
      ? 0xfde047
      : 0xffffff;

  const blackMat = createToonMaterial(0x141013);
  const hairMat = createToonMaterial(0x3e2723);
  const pantsMat = createToonMaterial(0x1e293b);

  // 0. Chibi Legs & Black Shoes
  [-0.25, 0.25].forEach((lx) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.16, 0.34, 24), pantsMat);
    leg.position.set(lx, 0.17, 0);
    const shoe = new THREE.Mesh(new THREE.SphereGeometry(0.19, 24, 20), blackMat);
    shoe.scale.set(0.95, 0.65, 1.3);
    shoe.position.set(lx, 0.08, 0.06);
    chef.add(leg, shoe);
  });

  // 1. Smooth Chibi Chef Coat
  const torso = new THREE.Mesh(
    new THREE.CylinderGeometry(0.54, 0.64, 1.0, 32),
    createToonMaterial(jacketHex)
  );
  torso.position.y = 0.72;
  chef.add(torso);

  // Front double-breasted buttons (visible when rotated toward camera in Wardrobe!)
  [-0.16, 0.16].forEach((bx) => {
    [0.48, 0.7, 0.92].forEach((by) => {
      const btn = new THREE.Mesh(new THREE.SphereGeometry(0.055, 24, 24), blackMat);
      btn.position.set(bx, by, 0.58);
      btn.userData.skipOutline = true;
      chef.add(btn);
    });
  });

  // 2. Red Chef Neckerchief (Triangular bandana visible on BACK and knotted on FRONT!)
  const redScarfMat = createToonMaterial(0xdc2626);
  const scarfCollar = new THREE.Mesh(
    new THREE.TorusGeometry(0.46, 0.1, 20, 32),
    redScarfMat
  );
  scarfCollar.rotation.x = Math.PI / 2;
  scarfCollar.position.set(0, 1.18, 0);
  chef.add(scarfCollar);

  // Back triangular bandana drape (matching 1794109185461.jpg!)
  const backTriangle = new THREE.Mesh(
    new THREE.ConeGeometry(0.34, 0.46, 4),
    redScarfMat
  );
  backTriangle.rotation.x = Math.PI;
  backTriangle.rotation.y = Math.PI / 4;
  backTriangle.position.set(0, 0.98, -0.48);
  chef.add(backTriangle);

  // Front knot & tails (for Wardrobe front view)
  const frontKnot = new THREE.Mesh(new THREE.SphereGeometry(0.11, 24, 24), redScarfMat);
  frontKnot.position.set(0, 1.1, 0.52);
  chef.add(frontKnot);

  // 3. Chibi Arms Raised at Sides (with rolled-up white cuffs & fists ready for action!)
  const skinMat = createToonMaterial(0xffffff, { map: createChefFaceTexture() });
  const plainSkinMat = createToonMaterial(0xf6c49e);
  const sleeveMat = createToonMaterial(jacketHex);

  [-1, 1].forEach((side) => {
    const armGroup = new THREE.Group();
    armGroup.name = side === -1 ? 'chef_arm_l' : 'chef_arm_r';
    armGroup.position.set(side * 0.64, 0.96, 0.0);
    armGroup.rotation.z = side * 0.45;
    armGroup.rotation.x = 0.25;

    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.18, 0.46, 28), sleeveMat);
    sleeve.position.y = -0.14;
    const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.05, 16, 28), sleeveMat);
    cuff.rotation.x = Math.PI / 2;
    cuff.position.y = -0.34;
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.16, 28, 28), plainSkinMat);
    hand.position.y = -0.46;
    armGroup.add(sleeve, cuff, hand);
    chef.add(armGroup);
  });

  // 4. Smooth 32-Segment Head + Dark Brown Hair on the Back/Nape (matching 1794109185461.jpg!)
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.56, 32, 32), skinMat);
  head.scale.set(1.06, 0.96, 1.0);
  head.position.set(0, 1.62, 0.0);
  chef.add(head);

  // Dark Brown Hair cap covering the back of the head (-Z)
  const hairBack = new THREE.Mesh(
    new THREE.SphereGeometry(0.59, 32, 28, 0, Math.PI * 2, 0, Math.PI * 0.65),
    hairMat
  );
  hairBack.rotation.x = -Math.PI * 0.54;
  hairBack.position.set(0, 1.64, -0.05);
  chef.add(hairBack);

  // Prominent Peach Ears on Left & Right
  [-0.6, 0.6].forEach((ex) => {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.15, 24, 24), plainSkinMat);
    ear.position.set(ex, 1.6, -0.04);
    chef.add(ear);
  });

  // ICONIC CURVED HANDLEBAR MUSTACHE TIPS STICKING OUT PAST BOTH CHEEKS!
  // Visible from BOTH the front (Wardrobe) AND from behind (Gameplay, exactly like 1794109185461.jpg!)
  [-1, 1].forEach((side) => {
    const stacheCenterLobe = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 28, 24),
      blackMat
    );
    stacheCenterLobe.scale.set(1.45, 0.72, 0.75);
    stacheCenterLobe.position.set(side * 0.18, 1.44, 0.52);
    stacheCenterLobe.rotation.z = side * -0.18;
    stacheCenterLobe.userData.skipOutline = true;
    chef.add(stacheCenterLobe);

    // Wide curled mustache tips extending past `x = ±0.76` so they silhouette out on both sides of the head!
    const curledTip = new THREE.Mesh(
      new THREE.TorusGeometry(0.21, 0.085, 20, 28, Math.PI * 1.15),
      blackMat
    );
    curledTip.position.set(side * 0.66, 1.48, -0.06);
    curledTip.rotation.z = side === 1 ? -0.32 : Math.PI + 0.32;
    chef.add(curledTip);
  });

  // Front Eyes & Nose (for Wardrobe 3D live preview)
  const pupilBasicMat = new THREE.MeshBasicMaterial({ color: 0x141013 });
  const catchlightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  [-0.2, 0.2].forEach((ex, idx) => {
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.085, 24, 24), pupilBasicMat);
    pupil.position.set(ex, 1.68, 0.54);
    pupil.userData.skipOutline = true;

    const catchlight = new THREE.Mesh(new THREE.SphereGeometry(0.03, 16, 16), catchlightMat);
    catchlight.position.set(ex - 0.025, 1.71, 0.61);
    catchlight.userData.skipOutline = true;

    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.065, 0.08), blackMat);
    brow.position.set(ex, 1.84, 0.5);
    brow.rotation.z = idx === 0 ? 0.14 : -0.14;
    brow.userData.skipOutline = true;

    chef.add(pupil, catchlight, brow);
  });

  const nose = new THREE.Mesh(
    new THREE.SphereGeometry(0.11, 28, 28),
    createToonMaterial(0xeb9b78)
  );
  nose.position.set(0, 1.58, 0.58);
  chef.add(nose);

  // 5. Tall Pleated White Chef Toque Hat (upright from 3/4 rear camera angle matching 1794109185461.jpg!)
  const hatGroup = new THREE.Group();
  hatGroup.position.set(0, 2.0, -0.04);
  hatGroup.rotation.x = -0.16;

  const whiteHatMat = createToonMaterial(0xffffff);
  const bandMat = createToonMaterial(
    hat === 'duck_shower_cap'
      ? 0x38bdf8
      : hat === 'bucket_helmet'
      ? 0xfacc15
      : 0xe2e8f0
  );

  const rim = new THREE.Mesh(
    new THREE.CylinderGeometry(0.46, 0.44, 0.24, 32),
    bandMat
  );
  rim.position.y = 0.08;
  hatGroup.add(rim);

  const baseCylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(0.52, 0.44, 0.62, 32),
    whiteHatMat
  );
  baseCylinder.position.y = 0.46;
  hatGroup.add(baseCylinder);

  // Puffy multi-lobed cloud top of the Chef Toque (matching 1794109185461.jpg!)
  const crownCenter = new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 32), whiteHatMat);
  crownCenter.scale.set(1.24, 0.72, 1.02);
  crownCenter.position.y = 0.84;
  hatGroup.add(crownCenter);

  [-0.34, 0.34].forEach((lx) => {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(0.35, 28, 28), whiteHatMat);
    puff.position.set(lx, 0.82, 0);
    puff.userData.skipOutline = true;
    hatGroup.add(puff);
  });

  if (hat === 'duck_shower_cap') {
    const duck = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 28, 28),
      createToonMaterial(0xfacc15)
    );
    duck.position.set(0, 0.18, 0.48);
    hatGroup.add(duck);
  }

  chef.add(hatGroup);

  addInkOutline(chef);

  return root;
}

// ============================================================================
// 6. ESTACIÓN DE COCINA ILUSTRADA (4 REJILLAS DE ACERO, BARRA DIVISORIA, PATAS DE MESA Y PLATOS)
// ============================================================================

export function buildOvercookedKitchenProps(railToWorldX: (r: number) => number): {
  root: THREE.Group;
  bastionPlates: THREE.Group[];
} {
  const root = new THREE.Group();
  const bastionPlates: THREE.Group[] = [];

  // ===========================================================================
  // 4 REJILLAS DE VENTILACIÓN RECTANGULARES DE ACERO EN LA PARED DE AZULEJOS
  // (Exactamente como las 4 rejillas con 4 ranuras oscuras y tornillos en 1794109185461.jpg)
  // ===========================================================================
  const grateFrameMat = createToonMaterial(0x94a3b8);
  const grateInnerMat = createToonMaterial(0x64748b);
  const darkSlotMat = new THREE.MeshBasicMaterial({ color: 0x090a0f });

  for (let r = 0; r < 4; r++) {
    const rx = railToWorldX(r);
    const ventGroup = new THREE.Group();
    ventGroup.position.set(rx, 0.48, -6.28);

    // Outer steel frame
    const outerFrame = new THREE.Mesh(
      new THREE.BoxGeometry(1.06, 0.86, 0.24),
      grateFrameMat
    );
    const innerRecess = new THREE.Mesh(
      new THREE.BoxGeometry(0.84, 0.64, 0.26),
      grateInnerMat
    );
    innerRecess.userData.skipOutline = true;
    ventGroup.add(outerFrame, innerRecess);

    // 4 vertical dark vent slots
    [-0.27, -0.09, 0.09, 0.27].forEach((sx) => {
      const slot = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.48, 0.28), darkSlotMat);
      slot.position.x = sx;
      slot.userData.skipOutline = true;
      ventGroup.add(slot);
    });

    // 4 corner screws
    [-0.42, 0.42].forEach((cx) => {
      [-0.32, 0.32].forEach((cy) => {
        const screw = new THREE.Mesh(
          new THREE.CylinderGeometry(0.035, 0.035, 0.28, 12),
          darkSlotMat
        );
        screw.rotation.x = Math.PI / 2;
        screw.position.set(cx, cy, 0);
        screw.userData.skipOutline = true;
        ventGroup.add(screw);
      });
    });

    addInkOutline(ventGroup);
    root.add(ventGroup);
  }

  // ===========================================================================
  // BARRA METÁLICA HORIZONTAL DIVISORIA ENTRE LAS CASILLAS JUGABLES Y LOS 4 PLATOS
  // (Exactamente como la barra de acero horizontal en z = +3.52 de 1794109185461.jpg)
  // ===========================================================================
  const dividerBar = new THREE.Mesh(
    new THREE.BoxGeometry(7.28, 0.1, 0.16),
    createToonMaterial(0x94a3b8)
  );
  dividerBar.position.set(0, 0.05, 3.52);
  addInkOutline(dividerBar);
  root.add(dividerBar);

  // ===========================================================================
  // FRENTE GRUESO DE LA MESA DE CARNICERO + 2 PATAS ROBUSTAS DE MADERA
  // (Exactamente como las patas delanteras de la mesa en 1794109185461.jpg)
  // ===========================================================================
  const tableApronMat = createToonMaterial(0xb4692c);
  const tableLegMat = createToonMaterial(0x8c4a19);

  [-2.85, 2.85].forEach((lx) => {
    const leg = new THREE.Mesh(
      new THREE.BoxGeometry(0.82, 2.2, 0.82),
      tableLegMat
    );
    leg.position.set(lx, -1.45, 4.35);
    addInkOutline(leg);
    root.add(leg);
  });

  const underBeam = new THREE.Mesh(
    new THREE.BoxGeometry(6.2, 0.42, 0.6),
    tableApronMat
  );
  underBeam.position.set(0, -0.82, 4.42);
  addInkOutline(underBeam);
  root.add(underBeam);

  // ===========================================================================
  // LÍNEA DEL BASTIÓN: 4 PLATOS BLANCOS DE PORCELANA EN SU FRANJA DEDICADA (z = +4.2)
  // ===========================================================================
  const plateWhiteMat = createToonMaterial(0xffffff);
  const plateInnerRimMat = createToonMaterial(0xcbd5e1);

  for (let r = 0; r < 4; r++) {
    const rx = railToWorldX(r);
    const dishGroup = new THREE.Group();
    dishGroup.position.set(rx, 0.04, 4.18);
    dishGroup.scale.setScalar(0.86);
    dishGroup.add(createComicContactShadow(0.64, 0.56, 0.08));

    const plateBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.58, 0.46, 0.07, 32),
      plateWhiteMat
    );
    const plateInnerRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.38, 0.018, 16, 32),
      plateInnerRimMat
    );
    plateInnerRing.rotation.x = Math.PI / 2;
    plateInnerRing.position.y = 0.038;
    plateInnerRing.userData.skipOutline = true;

    dishGroup.add(plateBase, plateInnerRing);

    const foodContent = new THREE.Group();
    foodContent.name = 'food_content';

    if (r === 0) {
      // Plate 1: Porción de Tarta con Fresa (matching left plate in 1794109185461.jpg!)
      const cakeWedge = new THREE.Mesh(
        new THREE.ConeGeometry(0.24, 0.22, 3),
        createToonMaterial(0xd97706)
      );
      cakeWedge.rotation.x = Math.PI / 2;
      cakeWedge.rotation.z = 0.4;
      cakeWedge.position.set(0, 0.1, 0);
      const berry = new THREE.Mesh(
        new THREE.SphereGeometry(0.065, 20, 20),
        createToonMaterial(0xef4444)
      );
      berry.position.set(0.02, 0.2, -0.02);
      foodContent.add(cakeWedge, berry);
    } else if (r === 1) {
      // Plate 2: Polenta Dorada + Tomates Cherry + Brócoli (matching 2nd plate in 1794109185461.jpg!)
      const cube = new THREE.Mesh(
        new THREE.BoxGeometry(0.24, 0.16, 0.22),
        createToonMaterial(0xeab308)
      );
      cube.position.set(-0.1, 0.1, 0);
      cube.rotation.y = 0.25;
      const tomato1 = new THREE.Mesh(
        new THREE.SphereGeometry(0.075, 20, 20),
        createToonMaterial(0xef4444)
      );
      tomato1.position.set(0.08, 0.09, 0.1);
      const tomato2 = new THREE.Mesh(
        new THREE.SphereGeometry(0.07, 20, 20),
        createToonMaterial(0xef4444)
      );
      tomato2.position.set(0.16, 0.09, 0.02);
      const broccoli = new THREE.Mesh(
        new THREE.SphereGeometry(0.1, 20, 20),
        createToonMaterial(0x16a34a)
      );
      broccoli.position.set(0.08, 0.1, -0.1);
      foodContent.add(cube, tomato1, tomato2, broccoli);
    } else if (r === 2) {
      // Plate 3: Asado Dorado (becomes empty white porcelain plate when 1 seal is lost!)
      const roast = new THREE.Mesh(
        new THREE.SphereGeometry(0.17, 28, 24),
        createToonMaterial(0xd97706)
      );
      roast.scale.set(1.15, 0.6, 0.95);
      roast.position.set(-0.05, 0.08, 0);
      const greens = new THREE.Mesh(
        new THREE.SphereGeometry(0.1, 24, 24),
        createToonMaterial(0x16a34a)
      );
      greens.position.set(0.14, 0.08, 0.06);
      foodContent.add(roast, greens);
    } else {
      // Plate 4: Pastel de Carne + Boniato + Brócoli (matching 4th plate in 1794109185461.jpg!)
      const meatloaf = new THREE.Mesh(
        new THREE.BoxGeometry(0.24, 0.16, 0.22),
        createToonMaterial(0xc2410c)
      );
      meatloaf.position.set(-0.1, 0.1, -0.02);
      meatloaf.rotation.y = 0.2;
      const sweetPotato = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 24, 20),
        createToonMaterial(0xea580c)
      );
      sweetPotato.scale.set(1.3, 0.55, 0.75);
      sweetPotato.position.set(0.08, 0.08, 0.1);
      const broccoli = new THREE.Mesh(
        new THREE.SphereGeometry(0.1, 20, 20),
        createToonMaterial(0x16a34a)
      );
      broccoli.position.set(0.1, 0.1, -0.08);
      foodContent.add(meatloaf, sweetPotato, broccoli);
    }

    dishGroup.add(foodContent);
    addInkOutline(dishGroup);
    root.add(dishGroup);
    bastionPlates.push(dishGroup);
  }

  // ===========================================================================
  // UTENSILIOS DECORATIVOS EN LAS ENCIMERA LATERALES DE MADERA OSCURA
  // ===========================================================================
  const knifeBlock = new THREE.Group();
  knifeBlock.position.set(-4.15, 0.15, -4.6);
  knifeBlock.rotation.y = 0.25;
  knifeBlock.rotation.z = -0.14;
  const blockBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.76, 1.05, 0.76),
    createToonMaterial(0xc28145)
  );
  knifeBlock.add(blockBody);
  [-0.18, 0, 0.18].forEach((kz, idx) => {
    const kh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.065, 0.055, 0.48, 20),
      createToonMaterial(0x1e293b)
    );
    kh.position.set((idx - 1) * 0.09, 0.68, kz);
    kh.rotation.z = 0.18;
    knifeBlock.add(kh);
  });
  addInkOutline(knifeBlock);
  root.add(knifeBlock);

  const rollingPin = new THREE.Group();
  rollingPin.position.set(-4.18, -0.12, -0.6);
  rollingPin.rotation.y = 0.14;
  const rollerBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.2, 1.65, 28),
    createToonMaterial(0xdeb887)
  );
  rollerBody.rotation.x = Math.PI / 2;
  const pinRod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.07, 2.3, 24),
    createToonMaterial(0xb47b44)
  );
  pinRod.rotation.x = Math.PI / 2;
  rollingPin.add(rollerBody, pinRod);
  addInkOutline(rollingPin);
  root.add(rollingPin);

  const spiceColors = [0x84cc16, 0xea580c, 0xeab308];
  spiceColors.forEach((sc, idx) => {
    const jar = new THREE.Group();
    jar.position.set(4.15, -0.02, -4.6 + idx * 0.85);
    const jarBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.24, 0.58, 28),
      createToonMaterial(sc)
    );
    const jarLid = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.25, 0.13, 28),
      createToonMaterial(0x94a3b8)
    );
    jarLid.position.y = 0.32;
    jar.add(jarBody, jarLid);
    addInkOutline(jar);
    root.add(jar);
  });

  const saltShaker = new THREE.Group();
  saltShaker.position.set(4.12, -0.08, -1.65);
  const saltBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.21, 0.46, 28),
    createToonMaterial(0xffffff)
  );
  const saltCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    createToonMaterial(0xcbd5e1)
  );
  saltCap.position.y = 0.23;
  saltShaker.add(saltBody, saltCap);
  addInkOutline(saltShaker);
  root.add(saltShaker);

  const towelGroup = new THREE.Group();
  towelGroup.position.set(4.18, -0.22, -0.15);
  towelGroup.rotation.y = -0.25;
  const towel = new THREE.Mesh(
    new THREE.BoxGeometry(0.75, 0.1, 1.25),
    createToonMaterial(0xf8fafc)
  );
  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(0.76, 0.11, 0.12),
    createToonMaterial(0x2563eb)
  );
  stripe.position.z = 0.28;
  stripe.userData.skipOutline = true;
  towelGroup.add(towel, stripe);
  addInkOutline(towelGroup);
  root.add(towelGroup);

  return { root, bastionPlates };
}
