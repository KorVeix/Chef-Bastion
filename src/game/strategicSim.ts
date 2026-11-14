/**
 * Simulación sin pantalla del Modo Estratégico para validar guiones.
 *
 * Replica las reglas del motor (`ChefBastionCanvas.tsx`) para armas Nv.1 del Estratégico:
 * Flus-Flus (solo y con Estropajo: abanico de 5 burbujas), puente UV de 2 Aerosoles, Jabón,
 * Fregona y Escuadra; bichos que bajan por su carril, escudos y fugas a los platos.
 * Las combinaciones se evalúan con `evaluateBoardCombos`, la misma función que usa el juego.
 *
 * Mini-jefes: multiplicadores de `computeBossDamageMultiplier`, coraza que funde el puente UV y
 * aturdimiento del puzle (puente UV, Jabón o Escuadra).
 * Avispa (de guion, vuela): Jabón y Fregona no la tocan; ácido cada ~2,2 s entre las filas 0,5 y 3,6 que pringa armas 3,5 s; el Gel WC lo devuelve (45).
 * Gran Jefe: 3 fases por vida (coraza, esquiva con ácido en barrido sin azar, frenesí ×1,3).
 * Gran Jefe de guion: 3 fases por vida (66 % / 33 %), evasión alterna con ácido en fase 2+ y +30 % de
 * velocidad en fase 3. Sin escoltas (las del motor solo salen desde el Nv.30).
 * Invasión lateral: cruza en horizontal (×0,92) bajando ×0,22; la Escuadra la endereza por su carril.
 * No modela (todavía): Lejía.
 * Un guion que los use debe ampliar antes este simulador (ver `SIM_SUPPORTED_BUGS`).
 */
import type { BossPuzzleType, BossTier, BugEnemy, BugType, UtensilPiece, UtensilType } from './types';
import {
  GRID_RAILS,
  GRID_ROWS,
  MIN_PLACEABLE_ROW,
  applyPhysicalKnockback,
  computeBossDamageMultiplier,
  computeLiveMenuBuffs,
  evaluateBoardCombos,
  getGrandBossPhase,
  getBiomeForLevel,
  nextGrandBossEvadeRail,
  getLevelSpeedMultiplier,
} from './rules';
import { ROACH_SHIFT_INTERVAL_SEC, stepRoachZigzag } from './strategicScripts';
import { SHIELDED_BUGS } from './levelAudit';
import { BUG_BASE_HP, BUG_BASE_SPEED, COMBAT } from './combatTuning';

// Cucaracha de guion: zigzag de carril (stepRoachZigzag), clavada al resbalar en el Jabón.
export const SIM_SUPPORTED_BUGS: ReadonlySet<BugType> = new Set<BugType>([
  'acid_wasp',
  'speed_ant',
  'cap_beetle',
  'shift_roach',
  'king_crab',
]);

export interface SimPlacement {
  type: UtensilType;
  rail: number;
  row: number;
}

/** Disposición completa del tablero a partir del segundo `t` (lo que no aparece queda en la bandeja). */
export interface SimLayoutStep {
  t: number;
  placements: SimPlacement[];
}

export interface SimSpawn {
  t: number;
  type: BugType;
  rail: number;
  /** Cucaracha: sentido del primer cambio de carril (por defecto, hacia el centro). */
  dir?: 1 | -1;
  /** Entrada lateral (conducto): cruza en horizontal por la fila `row` hasta el borde contrario. */
  entry?: 'left' | 'right';
  row?: number;
  /** Multiplicador de la velocidad al cruzar en horizontal (motor: 0,92; hormiga de conducto: más). */
  lateralSpeed?: number;
  /** Jefe del guion (siempre con modelo de cangrejo rey en el motor). */
  boss?: { tier: BossTier; puzzle: BossPuzzleType; hp: number };
}

export interface SimEvent {
  t: number;
  type: BugType;
  rail: number;
}

export interface SimResult {
  spawned: number;
  kills: SimEvent[];
  leaks: SimEvent[];
  /** Máximo de bichos vivos a la vez. */
  peakAlive: number;
  /** Máximo de bichos vivos a la vez en los primeros 10 s. */
  peakAliveFirst10s: number;
  firstSpawnT: number | null;
  firstKillT: number | null;
  /** Mayor tramo sin ningún bicho en pantalla mientras el guion sigue (tiempo muerto). */
  maxDeadGap: number;
  /** Con `seals`: platos perdidos y si una fuga llegó sin sellos (derrota del motor). */
  platesLost: number;
  defeated: boolean;
  endTime: number;
}

/** Fugas que aguanta el motor antes de perder (3 Sellos Sanitarios; pierde en la siguiente). */
export const SIM_SANITATION_SEALS = 3;

interface SimBug {
  id: number;
  type: BugType;
  rail: number;
  targetRail: number;
  y: number;
  hp: number;
  hasShield: boolean;
  slowTimer: number;
  knockbackCooldown: number;
  isSlidingFromSoap: boolean;
  redirectedBySquare: boolean;
  bossTier: BossTier | null;
  puzzle: BossPuzzleType | null;
  armorBroken: boolean;
  stunTimer: number;
  maxHp: number;
  attackWindup: number;
  lateralDir: 0 | 1 | -1;
  lateralSpeed: number;
  roachTimer: number | null;
  roachDir: 1 | -1;
  /** Gran Jefe: fase por vida (1 > 66 %, 2 > 33 %, 3 el resto). */
  phase: 1 | 2 | 3;
  evadeTimer: number;
  evadeDir: 1 | -1;
}

interface SimProjectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  pierce: boolean;
  life: number;
  flavor: 'water_drop' | 'foam_fan' | 'vortex_soap' | 'enemy_acid' | 'reflected_bubble';
  fromVortex: boolean;
  fromDiagonalFoam: boolean;
  /** Ácido de avispa: pringa la primera arma que toca (3,5 s sin funcionar) salvo el Gel WC, que lo devuelve. */
  isEnemy?: boolean;
  thermal?: boolean;
}

/** Cambio de fase del Gran Jefe (como `evaluateGrandBossTransition` del motor). */
function checkGrandBossPhase(bug: SimBug): void {
  if (bug.bossTier !== 'grand' || bug.hp <= 0) return;
  const next = getGrandBossPhase(bug.hp, bug.maxHp);
  if (next <= bug.phase) return;
  bug.phase = next;
  bug.armorBroken = true;
  bug.hasShield = false;
  if (next === 2) {
    const cur = Math.max(0, Math.min(GRID_RAILS - 1, Math.round(bug.rail)));
    const first = nextGrandBossEvadeRail(cur, cur < GRID_RAILS - 1 ? 1 : -1);
    bug.targetRail = first.rail;
    bug.evadeDir = first.dir;
    bug.evadeTimer = COMBAT.grandBoss.firstEvadeSec;
  }
}

function bossMult(bug: SimBug, opts: { thermal: boolean; control: boolean }): number {
  if (!bug.bossTier) return 1;
  return computeBossDamageMultiplier({
    tier: bug.bossTier,
    phase: bug.phase,
    armorBroken: bug.armorBroken,
    isThermalOrExplosive: opts.thermal,
    isControlCombo: opts.control,
  });
}

const PLATE_ROW = 6.85;
const SPAWN_ROW = -0.35;
const FOAM_ANGLES = COMBAT.foam.angles;

function frictionFactor(level: number): number {
  const f = getBiomeForLevel(level).friction;
  return f > 1.1 ? 0.88 : f < 0.2 ? 1.06 : f < 0.5 ? 1.04 : 1.0;
}

function damp(current: number, target: number, lambda: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}

export function validateLayout(step: SimLayoutStep, loadout: readonly UtensilType[]): string | null {
  const counts = new Map<UtensilType, number>();
  for (const t of loadout) counts.set(t, (counts.get(t) ?? 0) + 1);
  const cells = new Set<string>();
  for (const p of step.placements) {
    const left = (counts.get(p.type) ?? 0) - 1;
    if (left < 0) return `t=${step.t}: ${p.type} no está en el reparto del nivel`;
    counts.set(p.type, left);
    if (p.rail < 0 || p.rail >= GRID_RAILS) return `t=${step.t}: carril ${p.rail} fuera del tablero`;
    if (p.row < MIN_PLACEABLE_ROW || p.row >= GRID_ROWS) return `t=${step.t}: fila ${p.row} no colocable`;
    const key = `${p.rail}:${p.row}`;
    if (cells.has(key)) return `t=${step.t}: dos armas en ${key}`;
    cells.add(key);
  }
  return null;
}

export function simulateStrategic(opts: {
  level: number;
  spawns: readonly SimSpawn[];
  plan: readonly SimLayoutStep[];
  dt?: number;
  maxTime?: number;
  /** Corta la simulación en la primera fuga (búsquedas de disposiciones que pierden). */
  stopOnFirstLeak?: boolean;
  /**
   * Desfase del reloj con el que gira la Fregona: los tests prueban varias fases.
   */
  clockOffset?: number;
   * Sellos del motor (3 en partida): cada fuga gasta uno, arruina un plato y lanza una onda de
   * Lejía por su carril (999 de daño, 180 a un jefe, que vuelve a la fila 2,4). Con 0 (por defecto)
   * cualquier fuga cuenta como fallo de diseño; con 3 se mide la derrota real (`defeated`).
   */
  seals?: number;
  /** Con `seals`: corta en la derrota (búsquedas). */
  stopOnDefeat?: boolean;
}): SimResult {
  const clockOffset = opts.clockOffset ?? 0;
  const dt = opts.dt ?? 1 / 60;
  const maxTime = opts.maxTime ?? 600;
  const speedMult = getLevelSpeedMultiplier(opts.level) * frictionFactor(opts.level);
  const spawns = [...opts.spawns].sort((a, b) => a.t - b.t);
  const plan = [...opts.plan].sort((a, b) => a.t - b.t);

  let pieces: UtensilPiece[] = [];
  let links = evaluateBoardCombos([]).links;
  let planIdx = 0;
  let spawnIdx = 0;
  let nextBugId = 1;
  let bugs: SimBug[] = [];
  let projectiles: SimProjectile[] = [];
  const kills: SimEvent[] = [];
  const leaks: SimEvent[] = [];
  let peakAlive = 0;
  let peakAliveFirst10s = 0;
  let firstSpawnT: number | null = null;
  let deadGap = 0;
  let maxDeadGap = 0;
  // Platos intactos: sus bonos (computeLiveMenuBuffs) se apagan al perder cada plato.
  const intactPlates = [true, true, true, true];
  let sealsLeft = opts.seals ?? 0;
  let platesLost = 0;
  let defeated = false;
  let t = 0;

  const applyLayout = (step: SimLayoutStep) => {
    const prev = pieces;
    const used = new Set<UtensilPiece>();
    pieces = step.placements.map((pl, idx) => {
      const same = prev.find(
        (p) => !used.has(p) && p.type === pl.type && p.rail === pl.rail && p.row === pl.row
      );
      if (same) {
        used.add(same);
        return same;
      }
      return null as unknown as UtensilPiece;
    });
    // Piezas movidas: conservan su temporizador de disparo y solo reciben el enganche de 0,3 s
    // (como moveOrSwapUtensil). Las nuevas salen de la bandeja con su temporizador inicial.
    pieces = pieces.map((p, idx) => {
      if (p) return p;
      const pl = step.placements[idx];
      const moved = prev.find((q) => !used.has(q) && q.type === pl.type && !pieces.includes(q));
      if (moved) {
        used.add(moved);
        moved.rail = pl.rail;
        moved.row = pl.row;
        moved.cooldown = 0.3;
        moved.gunkTimer = 0;
        return moved;
      }
      return {
        id: `sim-${pl.type}-${idx}-${step.t}`,
        type: pl.type,
        level: 1,
        rail: pl.rail,
        row: pl.row,
        gunkTimer: 0,
        cooldown: 0.3,
        fireTimer: pl.type === 'spray_flus' ? 0.35 : pl.type === 'mop_vortex' ? 0.3 : 0,
        comboType: 'none',
      } as UtensilPiece;
    });
    const evaluated = evaluateBoardCombos(pieces);
    // Conservar las referencias (temporizadores) y copiar solo el combo.
    pieces.forEach((p, i) => {
      p.comboType = evaluated.updatedPieces[i].comboType;
    });
    links = evaluated.links;
  };

  const pieceAt = (type: UtensilType, rail: number, row: number) =>
    pieces.find((p) => p.type === type && p.rail === rail && p.row === row && p.gunkTimer <= 0);

  while (t < maxTime) {
    while (planIdx < plan.length && plan[planIdx].t <= t) {
      applyLayout(plan[planIdx]);
      planIdx += 1;
    }

    const buffs = computeLiveMenuBuffs(intactPlates);

    // 1. Disparo de armas (Nv.1, Estratégico).
    for (const piece of pieces) {
      if (piece.rail === null || piece.row === null) continue;
      if (piece.gunkTimer > 0) {
        piece.gunkTimer = Math.max(0, piece.gunkTimer - dt);
        continue;
      }
      if (piece.cooldown > 0) {
        piece.cooldown = Math.max(0, piece.cooldown - dt);
        continue;
      }
      const inCombo = piece.comboType !== 'none';
      const interval =
        piece.type === 'spray_flus'
          ? inCombo
            ? COMBAT.flus.comboInterval
            : COMBAT.flus.interval
          : piece.type === 'mop_vortex'
          ? inCombo
            ? COMBAT.mop.comboInterval
            : COMBAT.mop.interval
          : 999;
      piece.fireTimer -= dt;
      if (piece.fireTimer > 0 || interval >= 100) continue;
      piece.fireTimer = interval;
      if (piece.type === 'spray_flus') {
        projectiles.push({
          x: piece.rail,
          y: piece.row - 0.25,
          vx: 0,
          vy: -COMBAT.flus.speed,
          damage: Math.round((inCombo ? COMBAT.flus.comboDamage : COMBAT.flus.damage) * buffs.frontalDamageMult),
          pierce: false,
          life: COMBAT.flus.life,
          flavor: 'water_drop',
          fromVortex: false,
          fromDiagonalFoam: false,
        });
      } else if (piece.type === 'mop_vortex') {
        const dirs = inCombo ? COMBAT.mop.comboShots : COMBAT.mop.shots;
        for (let d = 0; d < dirs; d++) {
          const ang = (d / dirs) * Math.PI * 2 + (t + clockOffset) * 2;
          projectiles.push({
            x: piece.rail,
            y: piece.row,
            vx: Math.cos(ang) * COMBAT.mop.speed,
            vy: Math.sin(ang) * COMBAT.mop.speed,
            damage: inCombo ? COMBAT.mop.comboDamage : COMBAT.mop.damage,
            pierce: true,
            life: COMBAT.mop.life,
            flavor: 'vortex_soap',
            fromVortex: true,
            fromDiagonalFoam: false,
          });
        }
      }
    }

    // 2. Apariciones del guion.
    while (spawnIdx < spawns.length && spawns[spawnIdx].t <= t) {
      const sp = spawns[spawnIdx];
      bugs.push({
        id: nextBugId++,
        type: sp.type,
        rail: sp.entry === 'left' ? -0.75 : sp.entry === 'right' ? 3.75 : sp.rail,
        targetRail: sp.entry === 'left' ? -0.75 : sp.entry === 'right' ? 3.75 : sp.rail,
        y: sp.entry ? sp.row ?? 2 : SPAWN_ROW,
        lateralDir: sp.entry === 'left' ? 1 : sp.entry === 'right' ? -1 : 0,
        lateralSpeed: sp.lateralSpeed ?? 0.92,
        hp: sp.boss ? sp.boss.hp : BUG_BASE_HP[sp.type],
        hasShield: sp.boss ? true : SHIELDED_BUGS.has(sp.type),
        slowTimer: 0,
        knockbackCooldown: 0,
        isSlidingFromSoap: false,
        redirectedBySquare: false,
        bossTier: sp.boss?.tier ?? null,
        puzzle: sp.boss?.puzzle ?? null,
        armorBroken: false,
        stunTimer: 0,
        maxHp: sp.boss ? sp.boss.hp : BUG_BASE_HP[sp.type],
        attackWindup: 0,
        roachTimer: sp.type === 'shift_roach' ? ROACH_SHIFT_INTERVAL_SEC : null,
        roachDir: sp.dir ?? (sp.rail <= 1 ? 1 : -1),
        phase: 1,
        evadeTimer: 2.6,
        evadeDir: 1,
      });
      spawnIdx += 1;
      if (firstSpawnT === null) firstSpawnT = t;
    }
    peakAlive = Math.max(peakAlive, bugs.length);
    if (t <= 10) peakAliveFirst10s = Math.max(peakAliveFirst10s, bugs.length);
    if (spawnIdx > 0 && spawnIdx < spawns.length && bugs.length === 0) {
      deadGap += dt;
      maxDeadGap = Math.max(maxDeadGap, deadGap);
    } else {
      deadGap = 0;
    }

    // 3. Proyectiles.
    const surviving: SimProjectile[] = [];
    for (const proj of projectiles) {
      proj.x += proj.vx * dt;
      proj.y += proj.vy * dt;
      proj.life -= dt;
      if (proj.flavor === 'water_drop') {
        const scourer = pieces.find(
          (p) =>
            p.type === 'scourer_nanas' &&
            p.gunkTimer <= 0 &&
            p.rail !== null &&
            p.row !== null &&
            Math.abs(p.rail - proj.x) < 0.35 &&
            Math.abs(p.row - proj.y) < 0.32
        );
        if (scourer && scourer.rail !== null && scourer.row !== null) {
          for (const ang of FOAM_ANGLES) {
            surviving.push({
              x: scourer.rail,
              y: scourer.row - 0.38,
              vx: Math.sin(ang) * COMBAT.foam.speedX,
              vy: -Math.cos(ang) * COMBAT.foam.speedY,
              damage: Math.round(COMBAT.foam.damage * (Math.abs(ang) < 0.1 ? buffs.frontalDamageMult : 1)),
              pierce: Math.abs(ang) > COMBAT.foam.pierceAngle,
              life: COMBAT.foam.life,
              flavor: 'foam_fan',
              fromVortex: false,
              fromDiagonalFoam: Math.abs(ang) > COMBAT.foam.pierceAngle,
            });
          }
          continue;
        }
      }
      if (proj.isEnemy) {
        const hitPiece = pieces.find(
          (p) =>
            p.rail !== null &&
            p.row !== null &&
            Math.abs(p.rail - proj.x) < 0.42 &&
            Math.abs(p.row - proj.y) < 0.42
        );
        if (hitPiece) {
          if (hitPiece.type === 'wc_shield') {
            proj.isEnemy = false;
            proj.vy = -Math.abs(proj.vy) * 1.4;
            proj.flavor = 'reflected_bubble';
            proj.pierce = true;
            proj.thermal = true;
            proj.fromDiagonalFoam = true;
            proj.damage = COMBAT.gelWc.reflectDamagePerLevel * hitPiece.level;
          } else {
            hitPiece.gunkTimer = COMBAT.wasp.gunkSec;
            continue;
          }
        }
        if (proj.life > 0 && proj.y > -1.2 && proj.y < 7.2) surviving.push(proj);
        continue;
      }
      for (const bug of bugs) {
        if (bug.y < -0.15) continue;
        // Las avispas vuelan: el remolino de la Fregona (suelo) no las alcanza.
        if (proj.fromVortex && bug.type === 'acid_wasp') continue;
        if (Math.abs(bug.rail - proj.x) < 0.48 && Math.abs(bug.y - proj.y) < 0.5) {
          if (proj.fromVortex && bug.knockbackCooldown <= 0) {
            const kb = applyPhysicalKnockback(
              {
                yProgress: bug.y,
                targetRail: bug.targetRail,
                knockbackCooldown: 0,
                koTimer: 0,
                bossTier: bug.bossTier ?? undefined,
              } as unknown as BugEnemy,
              { pushCells: 1.0 }
            );
            if (kb.applied) {
              bug.y = kb.nextYProgress;
              bug.knockbackCooldown = 1.15;
            }
          }
          if (bug.bossTier) {
            const control =
              proj.fromDiagonalFoam || proj.fromVortex || bug.isSlidingFromSoap || bug.redirectedBySquare;
            const damageMult = bossMult(bug, { thermal: Boolean(proj.thermal), control });
            if (proj.thermal) {
              bug.armorBroken = true;
              bug.hasShield = false;
            }
            bug.hp -= proj.damage * damageMult;
            checkGrandBossPhase(bug);
            if (proj.fromVortex) bug.slowTimer = Math.max(bug.slowTimer, 1.8 * buffs.controlDurationMult);
          } else if (bug.hasShield && !proj.pierce) {
            // ¡CLINK! sin daño.
          } else {
            if (bug.hasShield && proj.pierce) bug.hasShield = false;
            bug.hp -= proj.damage;
            if (proj.fromVortex) bug.slowTimer = Math.max(bug.slowTimer, 1.4 * buffs.controlDurationMult);
          }
          proj.life = 0;
          break;
        }
      }
      if (proj.life > 0 && proj.y > -1.2 && proj.y < 7.2 && proj.x > -0.6 && proj.x < 3.6) {
        surviving.push(proj);
      }
    }
    projectiles = surviving;

    // 4. Movimiento de bichos y efectos por casilla.
    const alive: SimBug[] = [];
    for (const bug of bugs) {
      bug.slowTimer = Math.max(0, bug.slowTimer - dt);
      bug.knockbackCooldown = Math.max(0, bug.knockbackCooldown - dt);
      bug.stunTimer = Math.max(0, bug.stunTimer - dt);
      const frenzy = bug.bossTier === 'grand' && bug.phase === 3 ? COMBAT.grandBoss.frenzySpeedMult : 1.0;
      const speed =
        bug.stunTimer > 0
          ? COMBAT.grandBoss.stunnedSpeed
          : BUG_BASE_SPEED[bug.type] * speedMult * frenzy * (bug.slowTimer > 0 ? COMBAT.slowSpeedFactor : 1.0);
      if (bug.roachTimer !== null) {
        const z = stepRoachZigzag(
          {
            railInt: Math.round(bug.targetRail),
            timer: bug.roachTimer,
            dir: bug.roachDir,
            pinned: bug.isSlidingFromSoap,
            onBoard: bug.y > 0,
          },
          dt
        );
        bug.roachTimer = z.timer;
        bug.roachDir = z.dir;
        if (z.shiftTo !== null) bug.targetRail = z.shiftTo;
      }
      if (bug.lateralDir !== 0) {
        // Invasión lateral (motor): avanza en horizontal y apenas baja; al llegar al borde contrario baja recto.
        bug.rail += bug.lateralDir * speed * bug.lateralSpeed * dt;
        bug.targetRail = bug.rail;
        bug.y += speed * 0.22 * dt;
        if (bug.lateralDir === 1 && bug.rail >= GRID_RAILS - 1) {
          bug.rail = GRID_RAILS - 1;
          bug.targetRail = GRID_RAILS - 1;
          bug.lateralDir = 0;
        } else if (bug.lateralDir === -1 && bug.rail <= 0) {
          bug.rail = 0;
          bug.targetRail = 0;
          bug.lateralDir = 0;
        }
      } else {
        bug.rail = damp(bug.rail, bug.targetRail, 9, dt);
        bug.y += speed * dt;
      }

      // Gran Jefe, fase 2+: esquiva de carril (barrido sin azar) y escupitajo de ácido por su carril.
      if (
        bug.bossTier === 'grand' &&
        bug.phase >= 2 &&
        bug.y > COMBAT.grandBoss.evadeMinRow &&
        bug.y < COMBAT.grandBoss.evadeMaxRow &&
        bug.stunTimer <= 0
      ) {
        bug.evadeTimer -= dt * (bug.slowTimer > 0 ? COMBAT.grandBoss.slowedEvadeRate : 1.0);
        if (bug.evadeTimer <= 0) {
          bug.evadeTimer = bug.phase === 3 ? COMBAT.grandBoss.evadeIntervalP3 : COMBAT.grandBoss.evadeIntervalP2;
          const cur = Math.max(0, Math.min(GRID_RAILS - 1, Math.round(bug.rail)));
          const evade = nextGrandBossEvadeRail(cur, bug.evadeDir);
          bug.targetRail = evade.rail;
          bug.evadeDir = evade.dir;
          projectiles.push({
            x: cur,
            y: bug.y + 0.35,
            vx: 0,
            vy: COMBAT.grandBoss.acidSpeed,
            damage: COMBAT.grandBoss.acidDamage,
            pierce: false,
            life: COMBAT.grandBoss.acidLife,
            flavor: 'enemy_acid',
            fromVortex: false,
            fromDiagonalFoam: false,
            isEnemy: true,
          });
        }
      }

      if (bug.type === 'acid_wasp' && bug.y > COMBAT.wasp.minRow && bug.y < COMBAT.wasp.maxRow && bug.stunTimer <= 0) {
        bug.attackWindup += dt * COMBAT.wasp.windupPerSec;
        if (bug.attackWindup >= 1.0) {
          bug.attackWindup = 0;
          projectiles.push({
            x: Math.round(bug.rail),
            y: bug.y + 0.3,
            vx: 0,
            vy: COMBAT.wasp.acidSpeed,
            damage: COMBAT.wasp.acidDamage,
            pierce: false,
            life: COMBAT.wasp.acidLife,
            flavor: 'enemy_acid',
            fromVortex: false,
            fromDiagonalFoam: false,
            isEnemy: true,
          });
        }
      }

      const railInt = Math.max(0, Math.min(GRID_RAILS - 1, Math.round(bug.rail)));
      const rowInt = Math.round(bug.y);

      const square = pieceAt('corner_square', railInt, rowInt);
      if (
        square &&
        (bug.lateralDir !== 0 || !bug.redirectedBySquare) &&
        Math.abs(bug.rail - railInt) < 0.44 &&
        Math.abs(bug.y - rowInt) < 0.44
      ) {
        bug.lateralDir = 0;
        bug.rail = railInt;
        bug.targetRail = railInt;
        bug.redirectedBySquare = true;
        bug.hasShield = false;
        bug.armorBroken = true;
        if (bug.puzzle === 'square_deflect') bug.stunTimer = 3.5;
      }

      const bridge = links.find(
        (l) => l.kind === 'bridge_uv' && l.fromRow === rowInt && (l.fromRail === railInt || l.toRail === railInt)
      );
      if (bridge && Math.abs(bug.y - rowInt) < COMBAT.bridgeUv.halfWindowRows) {
        if (bug.hasShield || (bug.bossTier && !bug.armorBroken)) {
          bug.hasShield = false;
          bug.armorBroken = true;
          if (bug.bossTier === 'mini' && bug.puzzle === 'uv_overheat') {
            bug.stunTimer = COMBAT.bridgeUv.miniBossStunSec * buffs.controlDurationMult;
          }
        }
        bug.hp -=
          COMBAT.bridgeUv.dps * buffs.thermalRateMult * bossMult(bug, { thermal: true, control: false }) * dt;
        checkGrandBossPhase(bug);
      }

      const flying = bug.type === 'acid_wasp';
      const soap = pieceAt('soap_bar', railInt, rowInt);
      if (soap && !flying && !bug.isSlidingFromSoap && Math.abs(bug.y - rowInt) < 0.32) {
        bug.isSlidingFromSoap = true;
        bug.slowTimer = Math.max(bug.slowTimer, COMBAT.soap.slowSec * buffs.controlDurationMult);
        if (bug.bossTier === 'mini' && bug.puzzle === 'soap_stun') {
          bug.stunTimer = 3.5 * buffs.controlDurationMult;
          bug.hasShield = false;
          bug.armorBroken = true;
        }
        const mop = pieces.find(
          (p) => p.type === 'mop_vortex' && p.rail !== null && Math.abs(p.rail - railInt) === 1
        );
        bug.targetRail = mop && mop.rail !== null ? mop.rail : railInt < GRID_RAILS - 1 ? railInt + 1 : railInt - 1;
      }

      const mopHere = pieceAt('mop_vortex', railInt, rowInt);
      if (mopHere && !flying && Math.abs(bug.y - rowInt) < 0.45) {
        bug.slowTimer = Math.max(bug.slowTimer, 2.2 * buffs.controlDurationMult);
        if (!bug.isSlidingFromSoap && bug.knockbackCooldown <= 0 && bug.bossTier !== 'grand') {
          bug.y = Math.max(-0.2, bug.y - (bug.bossTier === 'mini' ? 0.45 : 1.0));
          bug.knockbackCooldown = 1.25;
        }
        const vortexDps = bug.bossTier
          ? (bug.isSlidingFromSoap ? COMBAT.mop.bossContactDpsSlipped : COMBAT.mop.bossContactDps) *
            bossMult(bug, { thermal: false, control: true })
          : bug.isSlidingFromSoap
          ? COMBAT.mop.contactDpsSlipped
          : COMBAT.mop.contactDps;
        bug.hp -= vortexDps * dt;
        checkGrandBossPhase(bug);
      }

      if (bug.hp <= 0) {
        kills.push({ t, type: bug.type, rail: railInt });
        continue;
      }
      if (bug.y >= PLATE_ROW) {
        leaks.push({ t, type: bug.type, rail: railInt });
<<<<<<< HEAD
        if (seals > 0) {
          seals -= 1;
          intactPlates[railInt] = false;
        } else {
          defeated = true;
        }
=======
        if (sealsLeft > 0) {
          sealsLeft -= 1;
          platesLost += 1;
          projectiles.push({
            x: railInt,
            y: 6.8,
            vx: 0,
            vy: -8.5,
            damage: bug.bossTier ? 180 : 999,
            pierce: true,
            life: 1.8,
            flavor: 'reflected_bubble',
            fromVortex: false,
            fromDiagonalFoam: false,
            thermal: true,
          });
          if (bug.bossTier) {
            bug.y = 2.4;
            alive.push(bug);
          }
          continue;
        }
        if (opts.seals) defeated = true;
>>>>>>> origin/claude/dale-33w4mv
        continue;
      }
      alive.push(bug);
    }
    bugs = alive;

    t += dt;
    if (spawnIdx >= spawns.length && bugs.length === 0) break;
    if (opts.stopOnFirstLeak && leaks.length > 0) break;
    if (opts.stopOnDefeat && defeated) break;
  }

  return {
    spawned: spawnIdx,
    kills,
    leaks,
    peakAlive,
    peakAliveFirst10s,
    firstSpawnT,
    firstKillT: kills.length > 0 ? kills[0].t : null,
    maxDeadGap,
    defeated,
    endTime: t,
    platesLost,
    defeated,
  };
}
