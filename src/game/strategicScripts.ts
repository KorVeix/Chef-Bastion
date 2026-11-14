/**
 * Guiones del Modo Estratégico: cada nivel es un guion fijo (qué bicho, en qué carril y en qué segundo)
 * con las armas justas para resolverlo. Sin azar: el mismo guion en cada intento.
 *
 * Reglas de diseño (del autor):
 * - Cada 2–3 niveles aparece un bicho nuevo con su forma de matarlo; el nivel siguiente lo refuerza
 *   con más cantidad y después se retira: ningún tipo de bicho sale en más de 3 niveles seguidos.
 * - La dificultad sale de la composición (cuántas amenazas coinciden, en qué carriles y qué movimientos
 *   exigen), no de inflar la vida: la vida de cada bicho es fija.
 * - Se gana al limpiar el guion.
 *
 * Cada guion trae su solución de referencia y un plan que falla sin el combo que enseña; los tests
 * (`strategicScripts.test.ts`) los pasan por `simulateStrategic`.
 */
import type { BossPuzzleType, BugType, UtensilType } from './types';
import type { SimLayoutStep, SimSpawn } from './strategicSim';

export interface StrategicScript {
  level: number;
  /** Armas del nivel (en la bandeja al empezar). */
  loadout: UtensilType[];
  /** Qué enseña o exige el nivel (para la ficha previa). */
  teaches: string;
  /** Tutorial guiado a mostrar (claves de `getTutorialGuideForLevel`), si lo hay. */
  tutorial: 'line_foam' | 'bridge_uv' | 'slip_vortex' | 'corner_square' | null;
  spawns: SimSpawn[];
  /** Solución de referencia: debe limpiar el guion sin perder ningún plato. */
  solution: SimLayoutStep[];
  /** Plan sin el combo que enseña el nivel: debe dejar pasar al menos un bicho. */
  failsWithout: { label: string; plan: SimLayoutStep[] };
}

const at = (t: number, type: BugType, ...rails: number[]): SimSpawn[] =>
  rails.map((rail) => ({ t, type, rail }));

/** Mini-jefe del guion: cangrejo rey con su puzle y vida fijados en el guion. */
const miniBoss = (t: number, rail: number, puzzle: BossPuzzleType, hp: number): SimSpawn[] => [
  { t, type: 'king_crab', rail, boss: { tier: 'mini', puzzle, hp } },
];

/** Cucaracha con el sentido de su primer cambio de carril (zigzag). */
const roach = (t: number, rail: number, dir: 1 | -1): SimSpawn => ({ t, type: 'shift_roach', rail, dir });

/** Gran jefe del guion (3 fases), puzle de coraza UV. */
const grandBoss = (t: number, rail: number, hp: number): SimSpawn[] => [
  { t, type: 'king_crab', rail, boss: { tier: 'grand', puzzle: 'uv_overheat', hp } },
];

const foam = (rail: number, scourerRow = 3, sprayRow = 5) => [
  { type: 'scourer_nanas' as const, rail, row: scourerRow },
  { type: 'spray_flus' as const, rail, row: sprayRow },
];

const bridge = (leftRail: number, row: number) => [
  { type: 'aerosol_torch' as const, rail: leftRail, row },
  { type: 'aerosol_torch' as const, rail: leftRail + 1, row },
];

/** Colocación en vivo (niveles sin fase de colocación): una pieza cada 1,5 s desde el segundo 1,5. */
const placedLive = (pieces: SimLayoutStep['placements']): SimLayoutStep[] =>
  pieces.map((_, i) => ({ t: 1.5 * (i + 1), placements: pieces.slice(0, i + 1) }));

export const STRATEGIC_SCRIPTS: readonly StrategicScript[] = [
  {
    level: 1,
    loadout: ['scourer_nanas', 'spray_flus'],
    teaches: 'Estropajo delante del Flus-Flus: abanico de 5 burbujas que cubre 3 carriles.',
    tutorial: 'line_foam',
    spawns: [
      ...at(0.5, 'speed_ant', 1),
      ...at(3, 'speed_ant', 2),
      ...at(5, 'speed_ant', 1),
      ...at(7, 'speed_ant', 0, 1, 2),
      ...at(10, 'speed_ant', 2),
      ...at(12, 'speed_ant', 1),
      ...at(14, 'speed_ant', 0, 2),
      ...at(17, 'speed_ant', 1),
      ...at(19, 'speed_ant', 1, 2),
      ...at(22, 'speed_ant', 0, 1, 2),
      ...at(25, 'speed_ant', 2),
      ...at(27, 'speed_ant', 1, 2),
      ...at(30, 'speed_ant', 0, 1, 2),
    ],
    solution: placedLive(foam(1)),
    failsWithout: {
      label: 'Flus-Flus sin Estropajo',
      plan: [{ t: 1.5, placements: [{ type: 'spray_flus', rail: 1, row: 5 }] }],
    },
  },
  {
    level: 2,
    loadout: ['scourer_nanas', 'spray_flus'],
    teaches: 'Más hormigas y en los 4 carriles: mueve el abanico hacia donde entran.',
    tutorial: null,
    spawns: [
      // Tramo 1: carriles 1-3, abanico en el carril 2.
      ...at(0.5, 'speed_ant', 0),
      ...at(2.5, 'speed_ant', 1),
      ...at(4.5, 'speed_ant', 2),
      ...at(7, 'speed_ant', 0, 1, 2),
      ...at(10, 'speed_ant', 1),
      ...at(12, 'speed_ant', 0, 2),
      ...at(14.5, 'speed_ant', 1),
      ...at(16.5, 'speed_ant', 0, 1, 2),
      // Tramo 2: se abre el carril 4 → el abanico pasa al carril 3.
      ...at(19, 'speed_ant', 3),
      ...at(21, 'speed_ant', 2),
      ...at(23, 'speed_ant', 1, 3),
      ...at(25.5, 'speed_ant', 2, 3),
      ...at(28, 'speed_ant', 1, 2, 3),
      ...at(31, 'speed_ant', 3),
      ...at(33, 'speed_ant', 2, 3),
      ...at(35.5, 'speed_ant', 1, 2, 3),
      // Remate: por los dos bordes a la vez → ir y volver con el abanico.
      ...at(38, 'speed_ant', 0, 3),
      ...at(44, 'speed_ant', 0, 3),
    ],
    solution: [
      ...placedLive(foam(1)),
      { t: 19.5, placements: foam(2) },
      { t: 40, placements: foam(1) },
      { t: 46, placements: foam(2) },
    ],
    failsWithout: {
      label: 'Abanico quieto en el carril 2',
      plan: placedLive(foam(1)),
    },
  },
  {
    level: 3,
    loadout: ['scourer_nanas', 'spray_flus', 'aerosol_torch', 'aerosol_torch'],
    teaches: 'Ratas blindadas: 2 Aerosoles UV en carriles vecinos y misma fila funden el escudo.',
    tutorial: 'bridge_uv',
    spawns: [
      // El volumen de hormigas del Nv.2, por los carriles 1-3…
      ...at(0.5, 'speed_ant', 1),
      ...at(2.5, 'speed_ant', 0),
      ...at(4.5, 'speed_ant', 2),
      ...at(7, 'speed_ant', 0, 1, 2),
      ...at(10, 'speed_ant', 1),
      ...at(12, 'speed_ant', 0, 2),
      ...at(14.5, 'speed_ant', 1),
      ...at(16.5, 'speed_ant', 0, 1, 2),
      ...at(19, 'speed_ant', 2),
      ...at(21, 'speed_ant', 0),
      ...at(23, 'speed_ant', 1, 2),
      ...at(25.5, 'speed_ant', 0, 1),
      ...at(28, 'speed_ant', 0, 1, 2),
      ...at(31, 'speed_ant', 2),
      ...at(33, 'speed_ant', 0, 1),
      ...at(35.5, 'speed_ant', 0, 1, 2),
      // …y 2 ratas blindadas por el carril 4, fuera del abanico.
      ...at(9, 'cap_beetle', 3),
      ...at(26, 'cap_beetle', 3),
    ],
    solution: placedLive([...foam(1), ...bridge(2, 2)]),
    failsWithout: {
      label: 'Aerosoles separados (sin puente)',
      plan: placedLive([
        ...foam(1),
        { type: 'aerosol_torch', rail: 3, row: 2 },
        { type: 'aerosol_torch', rail: 3, row: 4 },
      ]),
    },
  },
  {
    level: 4,
    loadout: ['scourer_nanas', 'spray_flus', 'aerosol_torch', 'aerosol_torch'],
    teaches: 'Solo ratas blindadas, más y en todos los carriles: abanico y puente a la vez.',
    tutorial: null,
    spawns: [
      ...at(0.5, 'cap_beetle', 1),
      ...at(3, 'cap_beetle', 3),
      ...at(5.5, 'cap_beetle', 0, 2, 3),
      ...at(9, 'cap_beetle', 1),
      ...at(11.5, 'cap_beetle', 0, 3),
      ...at(14, 'cap_beetle', 2),
      ...at(16.5, 'cap_beetle', 1, 3),
      ...at(19, 'cap_beetle', 0, 2),
      ...at(22, 'cap_beetle', 1, 2, 3),
      ...at(25, 'cap_beetle', 0),
      ...at(27.5, 'cap_beetle', 2, 3),
      ...at(30, 'cap_beetle', 0, 1, 3),
      ...at(33.5, 'cap_beetle', 2),
      ...at(36, 'cap_beetle', 0, 1, 2, 3),
    ],
    // Nv.4 tiene fase de colocación: el reloj del guion empieza con las armas ya puestas.
    solution: [{ t: 0, placements: [...foam(1), ...bridge(2, 2)] }],
    failsWithout: {
      label: 'Solo el abanico',
      plan: [{ t: 0, placements: foam(1) }],
    },
  },
  {
    level: 5,
    loadout: ['scourer_nanas', 'spray_flus', 'aerosol_torch', 'aerosol_torch'],
    teaches:
      'Examen: ratas blindadas por todos lados y un mini-jefe acorazado por el borde. El puente UV le funde la coraza y lo aturde.',
    tutorial: null,
    spawns: [
      ...at(0.5, 'cap_beetle', 3),
      ...at(2.5, 'cap_beetle', 1),
      ...at(5, 'cap_beetle', 0, 2, 3),
      ...at(8.5, 'cap_beetle', 1),
      ...at(11, 'cap_beetle', 0, 3),
      ...at(13.5, 'cap_beetle', 2, 3),
      ...at(16, 'cap_beetle', 0, 1),
      // El mini-jefe entra por el carril 4 mientras las ratas tienen ocupado el abanico.
      ...miniBoss(19, 3, 'uv_overheat', 250),
      ...at(20, 'cap_beetle', 0),
      ...at(23, 'cap_beetle', 1, 2),
      ...at(26, 'cap_beetle', 0, 1),
      ...at(29, 'cap_beetle', 2),
      ...at(31, 'cap_beetle', 0, 1, 2),
      ...at(35, 'cap_beetle', 0, 2),
      ...at(38, 'cap_beetle', 1, 2, 3),
    ],
    solution: [{ t: 0, placements: [...foam(1), ...bridge(2, 2)] }],
    failsWithout: {
      label: 'Solo el abanico',
      plan: [{ t: 0, placements: foam(1) }],
    },
  },
  {
    level: 6,
    loadout: ['soap_bar', 'mop_vortex', 'spray_flus'],
    teaches:
      'Cucarachas que cambian de carril cada 2,4 s y esquivan el disparo recto. El Jabón las hace patinar (y dejan de esquivar) hacia la Fregona: centrifugado 3★.',
    tutorial: 'slip_vortex',
    spawns: [
      roach(0.5, 1, 1),
      roach(2, 2, -1),
      roach(4, 0, 1),
      roach(4, 3, -1),
      roach(7, 1, 1),
      roach(9.5, 2, -1),
      roach(12, 0, 1),
      roach(12, 2, 1),
      roach(15, 3, -1),
      roach(17.5, 1, -1),
      roach(20, 0, 1),
      roach(20, 3, -1),
      roach(23, 2, -1),
      roach(25.5, 1, 1),
      roach(28, 0, 1),
      roach(28, 2, -1),
      roach(28, 3, -1),
      roach(32, 1, 1),
      roach(34.5, 3, -1),
      roach(37, 0, 1),
      roach(37, 1, -1),
      roach(37, 2, 1),
    ],
    // Disposición del tutorial: Fregona [R2,F3], Jabón al lado [R3,F3], Flus-Flus [R2,F5].
    solution: [
      {
        t: 0,
        placements: [
          { type: 'mop_vortex', rail: 1, row: 2 },
          { type: 'soap_bar', rail: 2, row: 2 },
          { type: 'spray_flus', rail: 1, row: 4 },
        ],
      },
    ],
    failsWithout: {
      label: 'Sin Jabón (la cucaracha sigue esquivando)',
      plan: [
        {
          t: 0,
          placements: [
            { type: 'mop_vortex', rail: 1, row: 2 },
            { type: 'spray_flus', rail: 1, row: 4 },
          ],
        },
      ],
    },
  },
  {
    level: 7,
    loadout: ['soap_bar', 'mop_vortex', 'spray_flus'],
    teaches: 'Más cucarachas y por los 4 carriles: sin el Jabón esquivan y se amontonan.',
    tutorial: null,
    spawns: [
      roach(0.5, 2, 1),
      roach(2, 3, -1),
      roach(3.5, 1, 1),
      roach(5, 2, 1),
      roach(5, 3, -1),
      roach(5, 0, 1),
      roach(8, 2, -1),
      roach(10, 3, -1),
      roach(10, 1, 1),
      roach(12, 0, 1),
      roach(13, 2, 1),
      roach(15, 3, -1),
      roach(15, 2, -1),
      roach(15, 0, 1),
      roach(18, 1, 1),
      roach(20, 3, -1),
      roach(22, 0, 1),
      roach(24, 1, -1),
      roach(25, 3, -1),
      roach(26, 0, 1),
      roach(26, 2, -1),
      roach(29, 1, -1),
      roach(30, 3, -1),
      roach(31, 0, 1),
      roach(31, 1, 1),
      roach(34, 0, 1),
      roach(35, 3, -1),
      roach(36, 2, -1),
      roach(36, 1, -1),
      roach(40, 0, 1),
      roach(40, 3, -1),
      roach(40, 1, -1),
      roach(40, 2, 1),
      roach(44, 0, 1),
      roach(44, 3, -1),
      roach(44, 1, 1),
      roach(44, 2, -1),
    ],
    solution: [
      {
        t: 0,
        placements: [
          { type: 'mop_vortex', rail: 1, row: 2 },
          { type: 'soap_bar', rail: 2, row: 2 },
          { type: 'spray_flus', rail: 1, row: 4 },
        ],
      },
    ],
    failsWithout: {
      label: 'Sin Jabón',
      plan: [
        {
          t: 0,
          placements: [
            { type: 'mop_vortex', rail: 1, row: 2 },
            { type: 'spray_flus', rail: 1, row: 4 },
          ],
        },
      ],
    },
  },
  {
    level: 8,
    loadout: ['soap_bar', 'mop_vortex', 'spray_flus', 'wc_shield'],
    teaches:
      'Avispas: vuelan (el Jabón y la Fregona no las tocan) y su ácido pringa tus armas. El Gel WC en su carril les devuelve el ácido.',
    tutorial: null,
    spawns: [
      roach(0.5, 1, 1),
      roach(2, 2, -1),
      roach(4, 0, 1),
      roach(4, 3, -1),
      ...at(6, 'acid_wasp', 1),
      ...at(6, 'acid_wasp', 2),
      roach(7, 1, 1),
      roach(9.5, 2, -1),
      roach(12, 0, 1),
      roach(12, 1, 1),
      roach(12, 2, -1),
      roach(12, 2, 1),
      roach(13.5, 1, -1),
      roach(13.5, 2, 1),
      roach(15, 0, 1),
      roach(15, 3, -1),
      roach(15, 3, -1),
      roach(17.5, 1, -1),
      roach(20, 0, 1),
      roach(20, 3, -1),
      roach(23, 2, -1),
      roach(25.5, 1, 1),
      ...at(26, 'acid_wasp', 1),
      ...at(26, 'acid_wasp', 2),
      roach(28, 0, 1),
      roach(28, 2, -1),
      roach(28, 3, -1),
      roach(32, 1, 1),
      roach(32, 1, 1),
      roach(32, 2, -1),
      roach(33.5, 1, -1),
      roach(33.5, 2, 1),
      roach(34.5, 3, -1),
      roach(35, 0, 1),
      roach(35, 3, -1),
      roach(37, 0, 1),
      roach(37, 1, -1),
      roach(37, 2, 1),
    ],
    solution: [
      {
        t: 0,
        placements: [
          { type: 'wc_shield', rail: 2, row: 2 },
          { type: 'mop_vortex', rail: 1, row: 2 },
          { type: 'soap_bar', rail: 0, row: 2 },
          { type: 'spray_flus', rail: 1, row: 4 },
        ],
      },
    ],
    failsWithout: {
      label: 'Sin Gel WC',
      plan: [
        {
          t: 0,
          placements: [
            { type: 'mop_vortex', rail: 1, row: 2 },
            { type: 'soap_bar', rail: 2, row: 2 },
            { type: 'spray_flus', rail: 1, row: 4 },
          ],
        },
      ],
    },
  },
  {
    level: 9,
    loadout: ['scourer_nanas', 'spray_flus', 'wc_shield'],
    teaches:
      'Más avispas y cargando el carril 4, fuera del abanico: el Gel WC bajo en ese carril les devuelve el ácido mientras el abanico limpia los otros 3.',
    tutorial: null,
    spawns: [
      ...at(0.5, 'acid_wasp', 1),
      ...at(2, 'acid_wasp', 3),
      ...at(3.5, 'acid_wasp', 0),
      ...at(5, 'acid_wasp', 2, 3),
      ...at(7, 'acid_wasp', 0, 1, 3),
      ...at(10, 'acid_wasp', 3),
      ...at(11.5, 'acid_wasp', 1, 2),
      ...at(13, 'acid_wasp', 3),
      ...at(15, 'acid_wasp', 0, 2, 3),
      ...at(18, 'acid_wasp', 3),
      ...at(19.5, 'acid_wasp', 1),
      ...at(21, 'acid_wasp', 0, 3),
      ...at(23, 'acid_wasp', 2, 3),
      ...at(25, 'acid_wasp', 3),
      ...at(26.5, 'acid_wasp', 0, 1, 2),
      ...at(28, 'acid_wasp', 3),
      ...at(30, 'acid_wasp', 1, 3),
      ...at(32, 'acid_wasp', 0, 2, 3),
      ...at(35, 'acid_wasp', 3),
      ...at(36.5, 'acid_wasp', 0, 1, 2, 3),
    ],
    // Gel bajo (F5): arriba se le escapan las avispas que ya lo han rebasado.
    solution: [{ t: 0, placements: [...foam(1), { type: 'wc_shield', rail: 3, row: 4 }] }],
    failsWithout: {
      label: 'Sin Gel WC',
      plan: [{ t: 0, placements: foam(1) }],
    },
  },
  {
    level: 10,
    loadout: [
      'scourer_nanas',
      'spray_flus',
      'aerosol_torch',
      'aerosol_torch',
      'soap_bar',
      'mop_vortex',
      'wc_shield',
    ],
    teaches:
      'Examen: Gran Jefe de 3 fases entre avispas. Fase 1 coraza (solo la funde el puente UV), fase 2 esquiva y escupe ácido (Jabón → Fregona lo centrifuga), fase 3 frenesí. El Gel WC para las avispas del carril 4.',
    tutorial: null,
    spawns: [
      ...at(0.5, 'acid_wasp', 1),
      ...at(2, 'acid_wasp', 3),
      ...at(3.5, 'acid_wasp', 0),
      ...at(5, 'acid_wasp', 2, 3),
      ...at(7, 'acid_wasp', 0, 1, 3),
      ...at(10, 'acid_wasp', 3),
      // Gran jefe (3 fases): coraza → puente UV; evasión con ácido → Jabón + Fregona; frenesí final.
      ...grandBoss(12, 1, 460),
      ...at(14, 'acid_wasp', 0, 3),
      ...at(17, 'acid_wasp', 2, 3),
      ...at(20, 'acid_wasp', 0, 1),
      ...at(23, 'acid_wasp', 3),
      ...at(26, 'acid_wasp', 0, 2, 3),
      ...at(30, 'acid_wasp', 1, 3),
      ...at(34, 'acid_wasp', 0, 2, 3),
      ...at(38, 'acid_wasp', 3),
      ...at(40, 'acid_wasp', 0, 1, 2, 3),
    ],
    solution: [
      {
        t: 0,
        placements: [
          ...foam(0),
          ...bridge(1, 2),
          { type: 'soap_bar', rail: 1, row: 4 },
          { type: 'mop_vortex', rail: 2, row: 4 },
          { type: 'wc_shield', rail: 3, row: 4 },
        ],
      },
    ],
    failsWithout: {
      label: 'Sin puente UV (la coraza del jefe aguanta)',
      plan: [
        {
          t: 0,
          placements: [
            ...foam(0),
            { type: 'soap_bar', rail: 1, row: 4 },
            { type: 'mop_vortex', rail: 2, row: 4 },
            { type: 'wc_shield', rail: 3, row: 4 },
          ],
        },
      ],
    },
  },
];

/** La cucaracha cambia de carril cada 2,4 s en zigzag; resbalar en el Jabón la deja clavada. */
export const ROACH_SHIFT_INTERVAL_SEC = 2.4;

export function stepRoachZigzag(
  state: { railInt: number; timer: number; dir: 1 | -1; pinned: boolean; onBoard: boolean },
  dt: number,
  railCount = 4
): { timer: number; dir: 1 | -1; shiftTo: number | null } {
  if (state.pinned || !state.onBoard) return { timer: state.timer, dir: state.dir, shiftTo: null };
  const timer = state.timer - dt;
  if (timer > 0) return { timer, dir: state.dir, shiftTo: null };
  let dir = state.dir;
  let next = state.railInt + dir;
  if (next < 0 || next >= railCount) {
    dir = (dir === 1 ? -1 : 1) as 1 | -1;
    next = state.railInt + dir;
  }
  return { timer: ROACH_SHIFT_INTERVAL_SEC, dir: (dir === 1 ? -1 : 1) as 1 | -1, shiftTo: next };
}

/**
 * Evasión del Gran Jefe de guion (fase 2+): cambia de carril alternando el sentido, sin azar.
 * En los bordes vuelve hacia dentro.
 */
export function nextBossEvadeRail(curRail: number, dir: 1 | -1, railCount = 4): { rail: number; dir: 1 | -1 } {
  const rail = curRail <= 0 ? 1 : curRail >= railCount - 1 ? railCount - 2 : curRail + dir;
  return { rail, dir: (dir === 1 ? -1 : 1) as 1 | -1 };
}

export function getStrategicScript(level: number): StrategicScript | null {
  return STRATEGIC_SCRIPTS.find((s) => s.level === level) ?? null;
}

export function getScriptBugTypes(script: StrategicScript): BugType[] {
  return [...new Set(script.spawns.map((s) => s.type))];
}

/** Fase de HUD (1-3) según cuántas apariciones del guion han salido ya. */
export function getScriptPhase(script: StrategicScript, spawnedCount: number): 1 | 2 | 3 {
  const total = Math.max(1, script.spawns.length);
  const frac = spawnedCount / total;
  return frac < 1 / 3 ? 1 : frac < 2 / 3 ? 2 : 3;
}

/** Apariciones con `t` en (prevT, t]: las que el motor debe soltar en este fotograma. */
export function takeDueScriptSpawns(
  script: StrategicScript,
  cursor: number,
  elapsed: number
): { spawns: SimSpawn[]; cursor: number } {
  const sorted = [...script.spawns].sort((a, b) => a.t - b.t);
  const out: SimSpawn[] = [];
  let c = cursor;
  while (c < sorted.length && sorted[c].t <= elapsed) {
    out.push(sorted[c]);
    c += 1;
  }
  return { spawns: out, cursor: c };
}
