/**
 * Simulación sin pantalla del Modo Estratégico para validar guiones.
 *
 * Replica las reglas del motor (`ChefBastionCanvas.tsx`) para armas Nv.1 del Estratégico:
 * Flus-Flus (solo y con Estropajo: abanico de 5 burbujas), puente UV de 2 Aerosoles, Jabón,
 * Fregona y Escuadra; bichos que bajan por su carril, escudos y fugas a los platos.
 * Las combinaciones se evalúan con `evaluateBoardCombos`, la misma función que usa el juego.
 *
 * No modela (todavía): ácido de avispa, Gel WC, Lejía, invasión lateral ni jefes. Un guion que
 * los use debe ampliar antes este simulador (ver `SIM_SUPPORTED_BUGS`).
 */
import type { BugType, UtensilPiece, UtensilType } from './types';
import {
  GRID_RAILS,
  GRID_ROWS,
  MIN_PLACEABLE_ROW,
  applyPhysicalKnockback,
  evaluateBoardCombos,
  getBiomeForLevel,
  getLevelSpeedMultiplier,
} from './rules';
import { STRATEGIC_BUG_BASE_HP, STRATEGIC_BUG_BASE_SPEED, SHIELDED_BUGS } from './levelAudit';

export const SIM_SUPPORTED_BUGS: ReadonlySet<BugType> = new Set<BugType>([
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
  endTime: number;
}

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
}

interface SimProjectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  pierce: boolean;
  life: number;
  flavor: 'water_drop' | 'foam_fan' | 'vortex_soap';
  fromVortex: boolean;
}

const PLATE_ROW = 6.85;
const SPAWN_ROW = -0.35;
const FOAM_ANGLES = [-0.55, -0.26, 0, 0.26, 0.55];

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
}): SimResult {
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
      // Pieza recién colocada o movida: 0,3 s de enganche magnético (moveOrSwapUtensil).
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
      };
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
        piece.type === 'spray_flus' ? (inCombo ? 0.6 : 1.65) : piece.type === 'mop_vortex' ? (inCombo ? 0.85 : 1.45) : 999;
      piece.fireTimer -= dt;
      if (piece.fireTimer > 0 || interval >= 100) continue;
      piece.fireTimer = interval;
      if (piece.type === 'spray_flus') {
        projectiles.push({
          x: piece.rail,
          y: piece.row - 0.25,
          vx: 0,
          vy: -5.0,
          damage: inCombo ? 19 : 14,
          pierce: false,
          life: 2.3,
          flavor: 'water_drop',
          fromVortex: false,
        });
      } else if (piece.type === 'mop_vortex') {
        const dirs = inCombo ? 8 : 4;
        for (let d = 0; d < dirs; d++) {
          const ang = (d / dirs) * Math.PI * 2 + t * 2;
          projectiles.push({
            x: piece.rail,
            y: piece.row,
            vx: Math.cos(ang) * 2.5,
            vy: Math.sin(ang) * 2.5,
            damage: inCombo ? 24 : 14,
            pierce: true,
            life: 0.88,
            flavor: 'vortex_soap',
            fromVortex: true,
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
        rail: sp.rail,
        targetRail: sp.rail,
        y: SPAWN_ROW,
        hp: STRATEGIC_BUG_BASE_HP[sp.type],
        hasShield: SHIELDED_BUGS.has(sp.type),
        slowTimer: 0,
        knockbackCooldown: 0,
        isSlidingFromSoap: false,
        redirectedBySquare: false,
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
              vx: Math.sin(ang) * 3.2,
              vy: -Math.cos(ang) * 4.5,
              damage: 16,
              pierce: Math.abs(ang) > 0.2,
              life: 1.4,
              flavor: 'foam_fan',
              fromVortex: false,
            });
          }
          continue;
        }
      }
      for (const bug of bugs) {
        if (bug.y < -0.15) continue;
        if (Math.abs(bug.rail - proj.x) < 0.48 && Math.abs(bug.y - proj.y) < 0.5) {
          if (proj.fromVortex && bug.knockbackCooldown <= 0) {
            const kb = applyPhysicalKnockback(
              { yProgress: bug.y, targetRail: bug.targetRail, knockbackCooldown: 0, koTimer: 0 } as never,
              { pushCells: 1.0 }
            );
            if (kb.applied) {
              bug.y = kb.nextYProgress;
              bug.knockbackCooldown = 1.15;
            }
          }
          if (bug.hasShield && !proj.pierce) {
            // ¡CLINK! sin daño.
          } else {
            if (bug.hasShield && proj.pierce) bug.hasShield = false;
            bug.hp -= proj.damage;
            if (proj.fromVortex) bug.slowTimer = Math.max(bug.slowTimer, 1.4);
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
      const speed =
        STRATEGIC_BUG_BASE_SPEED[bug.type] * speedMult * (bug.slowTimer > 0 ? 0.55 : 1.0);
      bug.rail = damp(bug.rail, bug.targetRail, 9, dt);
      bug.y += speed * dt;

      const railInt = Math.max(0, Math.min(GRID_RAILS - 1, Math.round(bug.rail)));
      const rowInt = Math.round(bug.y);

      const square = pieceAt('corner_square', railInt, rowInt);
      if (
        square &&
        !bug.redirectedBySquare &&
        Math.abs(bug.rail - railInt) < 0.44 &&
        Math.abs(bug.y - rowInt) < 0.44
      ) {
        bug.redirectedBySquare = true;
        bug.hasShield = false;
      }

      const bridge = links.find(
        (l) => l.kind === 'bridge_uv' && l.fromRow === rowInt && (l.fromRail === railInt || l.toRail === railInt)
      );
      if (bridge && Math.abs(bug.y - rowInt) < 0.3) {
        bug.hasShield = false;
        bug.hp -= 48 * dt;
      }

      const soap = pieceAt('soap_bar', railInt, rowInt);
      if (soap && !bug.isSlidingFromSoap && Math.abs(bug.y - rowInt) < 0.32) {
        bug.isSlidingFromSoap = true;
        bug.slowTimer = Math.max(bug.slowTimer, 2.6);
        const mop = pieces.find(
          (p) => p.type === 'mop_vortex' && p.rail !== null && Math.abs(p.rail - railInt) === 1
        );
        bug.targetRail = mop && mop.rail !== null ? mop.rail : railInt < GRID_RAILS - 1 ? railInt + 1 : railInt - 1;
      }

      const mopHere = pieceAt('mop_vortex', railInt, rowInt);
      if (mopHere && Math.abs(bug.y - rowInt) < 0.45) {
        bug.slowTimer = Math.max(bug.slowTimer, 2.2);
        if (!bug.isSlidingFromSoap && bug.knockbackCooldown <= 0) {
          bug.y = Math.max(-0.2, bug.y - 1.0);
          bug.knockbackCooldown = 1.25;
        }
        bug.hp -= (bug.isSlidingFromSoap ? 240 : 65) * dt;
      }

      if (bug.hp <= 0) {
        kills.push({ t, type: bug.type, rail: railInt });
        continue;
      }
      if (bug.y >= PLATE_ROW) {
        leaks.push({ t, type: bug.type, rail: railInt });
        continue;
      }
      alive.push(bug);
    }
    bugs = alive;

    t += dt;
    if (spawnIdx >= spawns.length && bugs.length === 0) break;
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
    endTime: t,
  };
}
