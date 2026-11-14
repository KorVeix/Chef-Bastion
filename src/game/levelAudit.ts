/**
 * Comprobador de cabida del Modo Estratégico (auditoría, solo lectura).
 *
 * Pregunta, nivel a nivel: con las armas que el nivel da, ¿existe una colocación que responda
 * a todos los bichos que el nivel puede sacar, al ritmo al que los saca?
 *
 * Las tablas de aparición, vida y velocidad replican las del motor
 * (`ChefBastionCanvas.tsx`, bucle de aparición del Estratégico y `speedMap`) y el reparto de armas
 * replica `createInitialBoardPieces` + `handleUnlockUtensil` (`App.tsx`). No cambia ningún nivel.
 * Cuando se corrijan los niveles, el motor debe leer estas mismas tablas para que no diverjan.
 */
import type { BossPuzzleType, BossTier, BugType, UtensilType } from './types';
import {
  GRID_RAILS,
  createInitialBoardPieces,
  getBiomeForLevel,
  getBossPuzzleTypeForLevel,
  getBossTierForLevel,
  getLevelForecast,
  getLevelSpeedMultiplier,
  checkPhaseTransition,
} from './rules';
import { getStrategicScript } from './strategicScripts';

export type Phase = 1 | 2 | 3;

/** Vida base por bicho (motor: `hpMap` del bucle de aparición del Estratégico). */
export const STRATEGIC_BUG_BASE_HP: Record<BugType, number> = {
  speed_ant: 40,
  cap_beetle: 84,
  acid_wasp: 64,
  shift_roach: 60,
  king_crab: 145,
};

/** Velocidad base en filas/s (motor: `speedMap`). */
export const STRATEGIC_BUG_BASE_SPEED: Record<BugType, number> = {
  speed_ant: 0.68,
  cap_beetle: 0.48,
  acid_wasp: 0.44,
  shift_roach: 0.6,
  king_crab: 0.36,
};

export const SHIELDED_BUGS: ReadonlySet<BugType> = new Set<BugType>(['cap_beetle', 'king_crab']);

/** Datos de daño del motor en Estratégico (armas Nv.1, sin sombreros). */
export const ENGINE_DAMAGE = {
  sprayShot: 14,
  sprayInterval: 1.65,
  /** Con Estropajo delante cada gota se convierte en 5 burbujas de 16. */
  foamBubbles: 5,
  foamBubbleDamage: 16,
  sprayComboInterval: 0.6,
  bridgeDps: 48,
  /** Ventana del puente: |Δfila| < 0.3. */
  bridgeWindowRows: 0.6,
  mopShots: 4,
  mopShotDamage: 14,
  mopInterval: 1.45,
  mopComboShots: 8,
  mopComboShotDamage: 24,
  mopComboInterval: 0.85,
  /** Fila desde la que bajan los bichos hasta los platos (yProgress 6.85). */
  plateRow: 6.85,
} as const;

export interface SpawnWeight {
  type: BugType;
  weight: number;
}

export interface StrategicPhaseSpec {
  phase: Phase;
  pieces: UtensilType[];
  /** Arma anunciada al empezar esta fase («¡NUEVA ARMA EN BANDEJA!»), aunque no llegue. */
  announcedUnlock: UtensilType | null;
  unlockDelivered: boolean;
  spawns: SpawnWeight[];
  killsToAdvance: number;
}

export interface StrategicLevelSpec {
  level: number;
  activeRails: number[];
  spawnIntervalSec: number;
  maxBugsOnScreen: number;
  hpMult: number;
  speedMult: number;
  lateralChance: number;
  lateralRows: number[];
  lateralSides: Array<'left' | 'right'>;
  boss: { tier: BossTier; puzzle: BossPuzzleType; hp: number } | null;
  forecastBugTypes: BugType[];
  phases: StrategicPhaseSpec[];
}

function spawnTableFor(level: number, phase: Phase): SpawnWeight[] {
  if (level === 1) return [{ type: 'speed_ant', weight: 1 }];
  if (level === 2) {
    return [
      { type: 'cap_beetle', weight: 0.7 },
      { type: 'speed_ant', weight: 0.3 },
    ];
  }
  if (level === 3) {
    return [
      { type: 'cap_beetle', weight: 0.65 },
      { type: 'speed_ant', weight: 0.35 },
    ];
  }
  if (phase === 1) {
    return [
      { type: 'speed_ant', weight: 0.55 },
      { type: 'cap_beetle', weight: 0.45 },
    ];
  }
  if (phase === 2) {
    return [
      { type: 'cap_beetle', weight: 0.45 },
      { type: 'acid_wasp', weight: 0.33 },
      { type: 'speed_ant', weight: 0.22 },
    ];
  }
  const crab = getBossTierForLevel(level) === null ? 0.18 : 0;
  return [
    ...(crab > 0 ? [{ type: 'king_crab' as BugType, weight: crab }] : []),
    { type: 'cap_beetle', weight: 0.55 - crab },
    { type: 'acid_wasp', weight: 0.27 },
    { type: 'shift_roach', weight: 0.18 },
  ];
}

function railsFor(level: number): number[] {
  return level <= 3 ? [1, 2] : Array.from({ length: GRID_RAILS }, (_, i) => i);
}

/** Replica el reparto de armas por fase, incluido el tope de `handleUnlockUtensil` (App.tsx). */
function piecesByPhase(level: number): Array<{
  pieces: UtensilType[];
  announced: UtensilType | null;
  delivered: boolean;
}> {
  const base = createInitialBoardPieces(level).map((p) => p.type);
  const out: Array<{ pieces: UtensilType[]; announced: UtensilType | null; delivered: boolean }> = [
    { pieces: [...base], announced: null, delivered: true },
  ];
  let current = [...base];
  for (const from of [1, 2] as Phase[]) {
    const trans = checkPhaseTransition(from, Number.MAX_SAFE_INTEGER, level);
    const unlock = trans.unlockedUtensilOnAdvance;
    let delivered = false;
    if (unlock) {
      const already = current.filter((t) => t === unlock).length;
      if (already < 2 && current.length < 5) {
        current = [...current, unlock];
        delivered = true;
      }
    }
    out.push({ pieces: [...current], announced: unlock, delivered: unlock ? delivered : true });
  }
  return out;
}

export function getStrategicLevelSpec(level: number): StrategicLevelSpec {
  const tier = getBossTierForLevel(level);
  const puzzle = getBossPuzzleTypeForLevel(level);
  const biome = getBiomeForLevel(level);
  const frictionFactor =
    biome.friction > 1.1 ? 0.88 : biome.friction < 0.2 ? 1.06 : biome.friction < 0.5 ? 1.04 : 1.0;
  const byPhase = piecesByPhase(level);
  const phases: StrategicPhaseSpec[] = ([1, 2, 3] as Phase[]).map((phase, idx) => ({
    phase,
    pieces: byPhase[idx].pieces,
    announcedUnlock: byPhase[idx].announced,
    unlockDelivered: byPhase[idx].delivered,
    spawns: spawnTableFor(level, phase),
    killsToAdvance: checkPhaseTransition(phase, 0, level).targetKillsForCurrentPhase,
  }));
  return {
    level,
    activeRails: railsFor(level),
    spawnIntervalSec: level <= 3 ? 3.4 : Math.max(2.1, 3.0 - level * 0.1),
    maxBugsOnScreen: level <= 3 ? 3 : 5,
    hpMult: 1 + Math.max(0, level - 3) * 0.08,
    speedMult: getLevelSpeedMultiplier(level) * frictionFactor,
    lateralChance: level === 31 ? 0.72 : level >= 32 ? 0.45 : 0,
    lateralRows: level === 31 ? [2] : level >= 32 ? [2, 3] : [],
    lateralSides: level === 31 ? ['left'] : level >= 32 ? ['left', 'right'] : [],
    boss:
      tier && puzzle
        ? {
            tier,
            puzzle,
            hp: tier === 'grand' ? Math.round(340 + level * 12) : Math.round(210 + level * 8),
          }
        : null,
    forecastBugTypes: getLevelForecast(level).bugTypes,
    phases,
  };
}

// ---------------------------------------------------------------------------
// Cobertura de carriles: ¿hay una colocación que dañe (y abra escudos) en todos los carriles activos?
// ---------------------------------------------------------------------------

export interface RailCoverage {
  damage: boolean[];
  shieldBreak: boolean[];
}

/**
 * Huella por arma según el motor (armas Nv.1, Estratégico):
 * - Flus-Flus solo: daña su carril; no abre escudos.
 * - Flus-Flus + Estropajo en el mismo carril: abanico de 5 burbujas; las diagonales perforan escudo
 *   y alcanzan los carriles vecinos (k-1..k+1).
 * - 2 Aerosoles UV en carriles contiguos y misma fila: daña y abre escudos en esos 2 carriles.
 *   Un Aerosol Nv.1 suelto no dispara en Estratégico (intervalo 999).
 * - Fregona: proyectiles 360° que perforan escudo (k-1..k+1).
 * - Escuadra: abre el escudo del bicho que pasa por su casilla (su carril); 0 daño.
 * - Jabón: desvía el bicho al carril vecino (hacia la Fregona si está al lado): su carril queda
 *   cubierto si el carril de destino lo está.
 */
export function computeRailCoverage(
  assignment: Array<{ type: UtensilType; rail: number }>,
  railCount = GRID_RAILS
): RailCoverage {
  const damage = Array<boolean>(railCount).fill(false);
  const shieldBreak = Array<boolean>(railCount).fill(false);
  const mark = (arr: boolean[], r: number) => {
    if (r >= 0 && r < railCount) arr[r] = true;
  };
  const railsOf = (t: UtensilType) => assignment.filter((a) => a.type === t).map((a) => a.rail);

  const scourerRails = new Set(railsOf('scourer_nanas'));
  for (const r of railsOf('spray_flus')) {
    mark(damage, r);
    if (scourerRails.has(r)) {
      for (const d of [-1, 0, 1]) {
        mark(damage, r + d);
        mark(shieldBreak, r + d);
      }
    }
  }
  const aerosols = railsOf('aerosol_torch').sort((a, b) => a - b);
  for (let i = 0; i + 1 < aerosols.length; i++) {
    if (aerosols[i + 1] - aerosols[i] === 1) {
      for (const r of [aerosols[i], aerosols[i + 1]]) {
        mark(damage, r);
        mark(shieldBreak, r);
      }
    }
  }
  const mopRails = railsOf('mop_vortex');
  for (const r of mopRails) {
    for (const d of [-1, 0, 1]) {
      mark(damage, r + d);
      mark(shieldBreak, r + d);
    }
  }
  for (const r of railsOf('corner_square')) mark(shieldBreak, r);
  for (const r of railsOf('soap_bar')) {
    const mopNeighbor = mopRails.find((m) => Math.abs(m - r) === 1);
    const dest = mopNeighbor ?? (r < railCount - 1 ? r + 1 : r - 1);
    if (damage[dest]) damage[r] = true;
    if (shieldBreak[dest]) shieldBreak[r] = true;
  }
  return { damage, shieldBreak };
}

export interface CoverageResult {
  ok: boolean;
  layout: Array<{ type: UtensilType; rail: number | null }>;
  uncoveredRails: number[];
}

/** Prueba todas las asignaciones de carril (o dejar el arma en la bandeja) y se queda con la mejor. */
export function findBestCoverage(
  pieces: UtensilType[],
  activeRails: number[],
  needShieldBreak: boolean
): CoverageResult {
  const options = [null, ...Array.from({ length: GRID_RAILS }, (_, i) => i)];
  let best: CoverageResult | null = null;
  const current: Array<number | null> = Array(pieces.length).fill(null);
  const evaluate = () => {
    const assignment = pieces
      .map((type, i) => ({ type, rail: current[i] }))
      .filter((a): a is { type: UtensilType; rail: number } => a.rail !== null);
    const cov = computeRailCoverage(assignment);
    const uncovered = activeRails.filter(
      (r) => !cov.damage[r] || (needShieldBreak && !cov.shieldBreak[r])
    );
    if (!best || uncovered.length < best.uncoveredRails.length) {
      best = {
        ok: uncovered.length === 0,
        layout: pieces.map((type, i) => ({ type, rail: current[i] })),
        uncoveredRails: uncovered,
      };
    }
  };
  const recurse = (i: number): boolean => {
    if (i === pieces.length) {
      evaluate();
      return best!.ok;
    }
    for (const opt of options) {
      current[i] = opt;
      if (recurse(i + 1)) return true;
    }
    return false;
  };
  recurse(0);
  return best!;
}

// ---------------------------------------------------------------------------
// Caudal: daño máximo teórico de las armas frente a la vida que entra por segundo.
// ---------------------------------------------------------------------------

export interface ThroughputResult {
  /** Vida media que entra por segundo (vida media por bicho / intervalo de aparición). */
  requiredDps: number;
  /** Techo optimista: todos los proyectiles aciertan y cada bicho cruza el puente. */
  maxDps: number;
  ratio: number;
}

export function computeThroughput(
  spec: StrategicLevelSpec,
  phase: StrategicPhaseSpec
): ThroughputResult {
  const totalW = phase.spawns.reduce((s, w) => s + w.weight, 0);
  const meanHp =
    phase.spawns.reduce((s, w) => s + w.weight * STRATEGIC_BUG_BASE_HP[w.type], 0) / totalW *
    spec.hpMult;
  const meanSpeed =
    phase.spawns.reduce((s, w) => s + w.weight * STRATEGIC_BUG_BASE_SPEED[w.type], 0) / totalW *
    spec.speedMult;
  const requiredDps = meanHp / spec.spawnIntervalSec;

  const has = (t: UtensilType) => phase.pieces.filter((p) => p === t).length;
  const D = ENGINE_DAMAGE;
  let maxDps = 0;
  if (has('spray_flus') > 0) {
    maxDps +=
      has('scourer_nanas') > 0
        ? (D.foamBubbles * D.foamBubbleDamage) / D.sprayComboInterval
        : D.sprayShot / D.sprayInterval;
  }
  if (has('mop_vortex') > 0) {
    maxDps +=
      has('soap_bar') > 0
        ? (D.mopComboShots * D.mopComboShotDamage) / D.mopComboInterval
        : (D.mopShots * D.mopShotDamage) / D.mopInterval;
  }
  if (has('aerosol_torch') >= 2) {
    const perBug = D.bridgeDps * (D.bridgeWindowRows / meanSpeed);
    maxDps += perBug / spec.spawnIntervalSec;
  }
  return { requiredDps, maxDps, ratio: maxDps / requiredDps };
}

// ---------------------------------------------------------------------------
// Auditoría
// ---------------------------------------------------------------------------

export type FindingSeverity = 'fail' | 'warn';

export interface AuditFinding {
  severity: FindingSeverity;
  code:
    | 'rail_coverage'
    | 'throughput'
    | 'unlock_not_delivered'
    | 'forecast_mismatch'
    | 'boss_counter_missing'
    | 'acid_without_reflector'
    | 'lateral_rows_uncovered';
  phase?: Phase;
  message: string;
}

export interface LevelAuditResult {
  level: number;
  /** Nivel con guion fijo: lo valida `strategicScripts.test.ts` con el simulador, no esta auditoría. */
  scripted?: boolean;
  ok: boolean;
  findings: AuditFinding[];
  throughputByPhase: ThroughputResult[];
}

const SHORT: Record<UtensilType, string> = {
  spray_flus: 'Flus-Flus',
  bleach_cannon: 'Lejía',
  scourer_nanas: 'Estropajo',
  aerosol_torch: 'Aerosol UV',
  soap_bar: 'Jabón',
  mop_vortex: 'Fregona',
  wc_shield: 'Gel WC',
  corner_square: 'Escuadra',
};

const BOSS_COUNTER: Record<BossPuzzleType, { pieces: UtensilType[]; label: string }> = {
  soap_stun: { pieces: ['soap_bar'], label: 'Jabón' },
  uv_overheat: { pieces: ['aerosol_torch', 'aerosol_torch'], label: '2 Aerosoles UV' },
  square_deflect: { pieces: ['corner_square'], label: 'Escuadra' },
};

export function auditStrategicLevel(spec: StrategicLevelSpec): LevelAuditResult {
  const findings: AuditFinding[] = [];
  const throughputByPhase: ThroughputResult[] = [];

  for (const ph of spec.phases) {
    if (ph.announcedUnlock && !ph.unlockDelivered) {
      findings.push({
        severity: 'warn',
        code: 'unlock_not_delivered',
        phase: ph.phase,
        message: `Fase ${ph.phase}: anuncia «nueva arma: ${SHORT[ph.announcedUnlock]}» pero no llega (bandeja llena o ya hay 2).`,
      });
    }

    const needShield = ph.spawns.some((s) => SHIELDED_BUGS.has(s.type));
    const cov = findBestCoverage(ph.pieces, spec.activeRails, needShield);
    if (!cov.ok) {
      findings.push({
        severity: 'fail',
        code: 'rail_coverage',
        phase: ph.phase,
        message: `Fase ${ph.phase}: ninguna colocación cubre los carriles ${cov.uncoveredRails
          .map((r) => r + 1)
          .join(', ')}${needShield ? ' (hace falta daño y abrir escudos)' : ''}.`,
      });
    }

    const tp = computeThroughput(spec, ph);
    throughputByPhase.push(tp);
    if (tp.ratio < 1) {
      findings.push({
        severity: 'fail',
        code: 'throughput',
        phase: ph.phase,
        message: `Fase ${ph.phase}: entra ${tp.requiredDps.toFixed(0)} de vida/s y el techo de daño es ${tp.maxDps.toFixed(0)}/s (×${tp.ratio.toFixed(2)}).`,
      });
    } else if (tp.ratio < 1.5) {
      findings.push({
        severity: 'warn',
        code: 'throughput',
        phase: ph.phase,
        message: `Fase ${ph.phase}: margen justo, techo de daño ×${tp.ratio.toFixed(2)} sobre la vida que entra (el techo supone acertar todo).`,
      });
    }

    if (ph.spawns.some((s) => s.type === 'acid_wasp') && !ph.pieces.includes('wc_shield')) {
      findings.push({
        severity: 'warn',
        code: 'acid_without_reflector',
        phase: ph.phase,
        message: `Fase ${ph.phase}: salen avispas (su ácido bloquea armas 3,5 s) y el nivel no da Gel WC.`,
      });
    }
  }

  const spawned = new Set(spec.phases.flatMap((p) => p.spawns.map((s) => s.type)));
  const forecast = new Set(spec.forecastBugTypes);
  const notForecast = [...spawned].filter((t) => !forecast.has(t));
  if (notForecast.length > 0) {
    findings.push({
      severity: 'warn',
      code: 'forecast_mismatch',
      message: `El aviso previo del nivel no menciona bichos que sí salen: ${notForecast.join(', ')}.`,
    });
  }

  if (spec.boss) {
    const lastPieces = spec.phases[2].pieces;
    const need = BOSS_COUNTER[spec.boss.puzzle];
    const missing = need.pieces.some(
      (t) => lastPieces.filter((p) => p === t).length < need.pieces.filter((n) => n === t).length
    );
    if (missing) {
      findings.push({
        severity: 'fail',
        code: 'boss_counter_missing',
        phase: 3,
        message: `Jefe (${spec.boss.puzzle}) pide ${need.label} y el nivel no lo da.`,
      });
    }
  }

  if (spec.lateralRows.length > 0) {
    const squares = spec.phases[2].pieces.filter((p) => p === 'corner_square').length;
    if (squares < spec.lateralRows.length) {
      findings.push({
        severity: 'warn',
        code: 'lateral_rows_uncovered',
        message: `Las invasiones laterales entran por ${spec.lateralRows.length} filas (${spec.lateralRows
          .map((r) => r + 1)
          .join(' y ')}) y solo hay ${squares} Escuadra: ~${Math.round(
          (1 - squares / spec.lateralRows.length) * 100
        )} % entra sin desviar.`,
      });
    }
  }

  return {
    level: spec.level,
    ok: !findings.some((f) => f.severity === 'fail'),
    findings,
    throughputByPhase,
  };
}

export function auditStrategicCampaign(maxLevel = 60): LevelAuditResult[] {
  return Array.from({ length: maxLevel }, (_, i) => {
    const level = i + 1;
    if (getStrategicScript(level)) {
      return { level, scripted: true, ok: true, findings: [], throughputByPhase: [] };
    }
    return auditStrategicLevel(getStrategicLevelSpec(level));
  });
}
