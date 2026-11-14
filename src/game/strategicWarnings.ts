/**
 * Avisos de tanda del Modo Estratégico: qué tandas del guion se anuncian sobre su respiradero (o su
 * conducto lateral) y cuántos segundos antes. Puro y determinista: sale del guion, sin azar.
 *
 * Solo se avisa lo que obliga a pensar o a mover algo; avisar cada tanda sería ruido:
 * - `new`: primera aparición de un tipo de bicho en el nivel.
 * - `boss`: un jefe.
 * - `front`: un frente nuevo, es decir, un tipo de bicho entra por un carril (o conducto) por el que
 *   no ha entrado en los últimos `STRATEGIC_FRONT_QUIET_SEC`. Las cucarachas no abren frente: cambian de
 *   carril cada 2,4 s y su carril de entrada no decide nada.
 *
 * Una tanda que sale antes de `STRATEGIC_WARNING_LEAD_SEC` no se avisa: el aviso no tendría su margen
 * completo (de la apertura se encargan el tutorial y la previsión de la fase de colocación). Tampoco se
 * avisan frentes antes de `STRATEGIC_FRONT_QUIET_SEC`: en la apertura todos los carriles son «nuevos».
 * Los frentes que llegan a menos de `STRATEGIC_WARNING_MIN_GAP_SEC` del aviso anterior se omiten para
 * no encadenar avisos; `new` y `boss` se avisan siempre.
 */
import type { BugType } from './types';
import type { StrategicScript } from './strategicScripts';
import type { SimSpawn } from './strategicSim';

export const STRATEGIC_WARNING_LEAD_SEC = 3;
export const STRATEGIC_FRONT_QUIET_SEC = 8;
export const STRATEGIC_WARNING_MIN_GAP_SEC = 3;

export type ScriptWarningKind = 'new' | 'boss' | 'front';

export interface ScriptWarningEntry {
  /** Carril del respiradero (entrada normal) o carril de referencia del conducto. */
  rail: number;
  /** Solo en entradas laterales: lado y fila por la que cruzan. */
  side?: 'left' | 'right';
  row?: number;
  counts: Partial<Record<BugType, number>>;
  /** La entrada trae un jefe (se marca con corona). */
  boss?: boolean;
}

export interface ScriptWarning {
  id: string;
  kind: ScriptWarningKind;
  /** Segundo del guion en que aparece el aviso. */
  showAt: number;
  /** Segundo del guion en que sale la tanda (el aviso desaparece). */
  spawnAt: number;
  entries: ScriptWarningEntry[];
}

/** Iconos de bicho para los avisos (compartidos con Supervivencia). */
export const BUG_WARNING_ICONS: Readonly<Record<BugType, string>> = {
  speed_ant: '🐜',
  cap_beetle: '🛡️🐀',
  acid_wasp: '🦟',
  shift_roach: '🪳',
  king_crab: '🦀',
};

const entryKey = (sp: SimSpawn) => (sp.entry ? `${sp.entry}:${sp.row ?? 2}` : `v:${sp.rail}`);

function groupByTime(spawns: readonly SimSpawn[]): SimSpawn[][] {
  const sorted = [...spawns].sort((a, b) => a.t - b.t);
  const groups: SimSpawn[][] = [];
  for (const sp of sorted) {
    const last = groups[groups.length - 1];
    if (last && last[0].t === sp.t) last.push(sp);
    else groups.push([sp]);
  }
  return groups;
}

function buildEntries(group: readonly SimSpawn[]): ScriptWarningEntry[] {
  const byKey = new Map<string, ScriptWarningEntry>();
  for (const sp of group) {
    const key = entryKey(sp);
    let entry = byKey.get(key);
    if (!entry) {
      entry = sp.entry ? { rail: sp.rail, side: sp.entry, row: sp.row ?? 2, counts: {} } : { rail: sp.rail, counts: {} };
      byKey.set(key, entry);
    }
    entry.counts[sp.type] = (entry.counts[sp.type] ?? 0) + 1;
    if (sp.boss) entry.boss = true;
  }
  return [...byKey.values()].sort((a, b) => a.rail - b.rail);
}

export function getScriptWarnings(script: StrategicScript): ScriptWarning[] {
  const seenTypes = new Set<BugType>();
  const lastFront = new Map<string, number>();
  const out: ScriptWarning[] = [];
  let lastAnnounced = -Infinity;

  for (const group of groupByTime(script.spawns)) {
    const t = group[0].t;
    const hasBoss = group.some((sp) => sp.boss);
    const hasNewType = group.some((sp) => !seenTypes.has(sp.type));
    const opensFront = group.some((sp) => {
      if (sp.type === 'shift_roach') return false;
      const last = lastFront.get(`${sp.type}@${entryKey(sp)}`);
      return last === undefined || t - last > STRATEGIC_FRONT_QUIET_SEC;
    });
    for (const sp of group) {
      seenTypes.add(sp.type);
      lastFront.set(`${sp.type}@${entryKey(sp)}`, t);
    }

    if (t < STRATEGIC_WARNING_LEAD_SEC) continue;
    const kind: ScriptWarningKind | null = hasBoss
      ? 'boss'
      : hasNewType
        ? 'new'
        : opensFront && t >= STRATEGIC_FRONT_QUIET_SEC && t - lastAnnounced >= STRATEGIC_WARNING_MIN_GAP_SEC
          ? 'front'
          : null;
    if (!kind) continue;

    out.push({
      id: `nv${script.level}-t${t}`,
      kind,
      showAt: Math.round((t - STRATEGIC_WARNING_LEAD_SEC) * 10) / 10,
      spawnAt: t,
      entries: buildEntries(group),
    });
    lastAnnounced = t;
  }
  return out;
}

/** Avisos visibles en el segundo `clock` del guion, con los segundos que faltan para la tanda. */
export function activeScriptWarnings(
  warnings: readonly ScriptWarning[],
  clock: number
): { warning: ScriptWarning; secondsLeft: number }[] {
  return warnings
    .filter((w) => clock >= w.showAt && clock < w.spawnAt)
    .map((w) => ({ warning: w, secondsLeft: w.spawnAt - clock }));
}

/** Texto del aviso de una entrada: «🐜×3 🦟×1»; con jefe, «👑 🦀×1». */
export function formatWarningCounts(counts: Partial<Record<BugType, number>>, boss = false): string {
  const text = (Object.entries(counts) as [BugType, number][])
    .map(([type, n]) => `${BUG_WARNING_ICONS[type]}×${n}`)
    .join(' ');
  return boss ? `👑 ${text}` : text;
}
