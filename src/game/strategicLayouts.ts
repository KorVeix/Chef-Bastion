/**
 * Enumera las disposiciones «con sentido» de un reparto del Estratégico: todas las que montan los
 * combos que el reparto permite (abanico, puente UV, Jabón→Fregona) y colocan el resto de armas
 * sueltas. Sirve para comprobar con el simulador que un nivel no se gana dejando el tablero quieto.
 */
import { GRID_RAILS, GRID_ROWS, MIN_PLACEABLE_ROW } from './rules';
import type { SimPlacement } from './strategicSim';
import type { UtensilType } from './types';

type Group = SimPlacement[];

const ROWS = Array.from({ length: GRID_ROWS - MIN_PLACEABLE_ROW }, (_, i) => MIN_PLACEABLE_ROW + i);
const RAILS = Array.from({ length: GRID_RAILS }, (_, i) => i);

function foamGroups(): Group[] {
  const out: Group[] = [];
  for (const rail of RAILS) {
    for (const sprayRow of ROWS) {
      for (const gap of [1, 2]) {
        const scourerRow = sprayRow - gap;
        if (scourerRow < MIN_PLACEABLE_ROW) continue;
        out.push([
          { type: 'scourer_nanas', rail, row: scourerRow },
          { type: 'spray_flus', rail, row: sprayRow },
        ]);
      }
    }
  }
  return out;
}

function bridgeGroups(): Group[] {
  const out: Group[] = [];
  for (let rail = 0; rail < GRID_RAILS - 1; rail++) {
    for (const row of ROWS) {
      out.push([
        { type: 'aerosol_torch', rail, row },
        { type: 'aerosol_torch', rail: rail + 1, row },
      ]);
    }
  }
  return out;
}

function slipGroups(): Group[] {
  const out: Group[] = [];
  for (const rail of RAILS) {
    for (const row of ROWS) {
      for (const dRail of [-1, 1]) {
        for (const dRow of [-1, 0, 1]) {
          const mopRail = rail + dRail;
          const mopRow = row + dRow;
          if (mopRail < 0 || mopRail >= GRID_RAILS || !ROWS.includes(mopRow)) continue;
          out.push([
            { type: 'soap_bar', rail, row },
            { type: 'mop_vortex', rail: mopRail, row: mopRow },
          ]);
        }
      }
    }
  }
  return out;
}

function singleGroups(type: UtensilType, rows: readonly number[] = ROWS): Group[] {
  return RAILS.flatMap((rail) => rows.map((row) => [{ type, rail, row }]));
}

/**
 * Disposiciones con todos los combos del reparto montados. `looseRows` limita las filas de las
 * armas sueltas para acotar la búsqueda (por defecto, todas las colocables).
 */
export function enumerateComboLayouts(
  loadout: readonly UtensilType[],
  opts: { looseRows?: Partial<Record<UtensilType, readonly number[]>> } = {}
): SimPlacement[][] {
  const left = new Map<UtensilType, number>();
  for (const t of loadout) left.set(t, (left.get(t) ?? 0) + 1);
  const take = (t: UtensilType, n = 1) => {
    if ((left.get(t) ?? 0) < n) return false;
    left.set(t, (left.get(t) ?? 0) - n);
    return true;
  };

  const families: Group[][] = [];
  if ((left.get('scourer_nanas') ?? 0) >= 1 && (left.get('spray_flus') ?? 0) >= 1) {
    take('scourer_nanas');
    take('spray_flus');
    families.push(foamGroups());
  }
  if (take('aerosol_torch', 2)) families.push(bridgeGroups());
  if ((left.get('soap_bar') ?? 0) >= 1 && (left.get('mop_vortex') ?? 0) >= 1) {
    take('soap_bar');
    take('mop_vortex');
    families.push(slipGroups());
  }
  for (const [type, n] of left) {
    for (let i = 0; i < n; i++) families.push(singleGroups(type, opts.looseRows?.[type]));
  }

  let layouts: SimPlacement[][] = [[]];
  for (const family of families) {
    const next: SimPlacement[][] = [];
    for (const base of layouts) {
      const used = new Set(base.map((p) => `${p.rail}:${p.row}`));
      for (const group of family) {
        if (group.some((p) => used.has(`${p.rail}:${p.row}`))) continue;
        next.push([...base, ...group]);
      }
    }
    layouts = next;
  }
  return layouts;
}
