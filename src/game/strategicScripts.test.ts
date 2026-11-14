import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STRATEGIC_SCRIPTS,
  getScriptPhase,
  getStrategicScript,
  takeDueScriptSpawns,
} from './strategicScripts';
import { SIM_SUPPORTED_BUGS, simulateStrategic, validateLayout } from './strategicSim';
import type { BugType } from './types';
import { enumerateComboLayouts } from './strategicLayouts';

/** Fases del reloj de la Fregona (el motor gira con el reloj real): la solución debe valer en todas. */
const CLOCK_OFFSETS = [0, 0.2, 0.4, 0.6, 0.8, 1.0, 1.2, 1.4];

const leaksLabel = (leaks: Array<{ t: number; type: BugType; rail: number }>) =>
  leaks.map((l) => `${l.type}@carril ${l.rail + 1} (${l.t.toFixed(1)} s)`).join(', ');

for (const script of STRATEGIC_SCRIPTS) {
  test(`Guion Nv.${script.level}: la solución de referencia limpia el guion sin perder platos`, () => {
    for (const step of script.solution) {
      assert.equal(validateLayout(step, script.loadout), null);
    }
    for (const sp of script.spawns) {
      assert.ok(SIM_SUPPORTED_BUGS.has(sp.type), `${sp.type} no está modelado en el simulador`);
      assert.ok(sp.rail >= 0 && sp.rail <= 3);
    }
    for (const clockOffset of CLOCK_OFFSETS) {
      const res = simulateStrategic({ level: script.level, spawns: script.spawns, plan: script.solution, clockOffset });
      assert.equal(res.leaks.length, 0, `fase ${clockOffset}: fugas ${leaksLabel(res.leaks)}`);
      assert.equal(res.kills.length, script.spawns.length);
    }
  });

  test(`Guion Nv.${script.level}: sin el combo que enseña («${script.failsWithout.label}») se pierde`, () => {
    for (const step of script.failsWithout.plan) {
      assert.equal(validateLayout(step, script.loadout), null);
    }
    // Perder de verdad: el motor absorbe 3 fugas con los Sellos y pierde en la 4.ª.
    for (const clockOffset of CLOCK_OFFSETS) {
      const res = simulateStrategic({
        level: script.level,
        spawns: script.spawns,
        plan: script.failsWithout.plan,
        clockOffset,
      });
      const min = script.failsWithout.minLeaks;
      if (min !== undefined) {
        assert.ok(res.leaks.length >= min, `fase ${clockOffset}: sin el combo solo pasan ${res.leaks.length} de ${min}`);
      } else {
        assert.ok(
          res.defeated,
          `fase ${clockOffset}: sin el combo solo pasan ${res.leaks.length} (hacen falta 4 para perder)`
        );
      }
    }
  });

  test(`Guion Nv.${script.level}: regla de los 10 s (sin tiempos muertos)`, () => {
    const res = simulateStrategic({ level: script.level, spawns: script.spawns, plan: script.solution });
    assert.ok((res.firstSpawnT ?? 99) <= 1, `primer bicho a los ${res.firstSpawnT} s (máx. 1 s)`);
    assert.ok((res.firstKillT ?? 99) <= 5, `primera baja a los ${res.firstKillT?.toFixed(1)} s (máx. 5 s)`);
    assert.ok(res.peakAliveFirst10s >= 3, `solo ${res.peakAliveFirst10s} bichos a la vez en los primeros 10 s (mín. 3)`);
    assert.ok(res.maxDeadGap <= 4, `${res.maxDeadGap.toFixed(1)} s seguidos sin bichos (máx. 4 s)`);
  });

  test(`Guion Nv.${script.level}: el reparto incluye el Flus-Flus`, () => {
    assert.ok(script.loadout.includes('spray_flus'));
  });
}

test('Guiones: niveles únicos y en orden', () => {
  const levels = STRATEGIC_SCRIPTS.map((s) => s.level);
  assert.deepEqual(levels, [...levels].sort((a, b) => a - b));
  assert.equal(new Set(levels).size, levels.length);
});

test('Guiones: ningún tipo de bicho sale en más de 3 niveles seguidos', () => {
  // Una variante con otra forma de matarla (p. ej. la hormiga de conducto) cuenta como bicho propio.
  const key = (sp: { type: BugType; entry?: string }) => (sp.entry ? `${sp.type}:conducto` : sp.type);
  const byLevel = new Map(STRATEGIC_SCRIPTS.map((s) => [s.level, new Set(s.spawns.map(key))]));
  const types = new Set(STRATEGIC_SCRIPTS.flatMap((s) => s.spawns.map(key)));
  for (const type of types) {
    let run = 0;
    for (let lvl = 1; lvl <= 60; lvl++) {
      run = byLevel.get(lvl)?.has(type) ? run + 1 : 0;
      assert.ok(run <= 3, `${type} sale en más de 3 niveles seguidos (hasta el Nv.${lvl})`);
    }
  }
});

test('Guiones: las apariciones salen en su segundo y la fase avanza por tercios', () => {
  const script = getStrategicScript(1)!;
  const first = takeDueScriptSpawns(script, 0, 0.4);
  assert.equal(first.spawns.length, 0);
  const second = takeDueScriptSpawns(script, first.cursor, 0.5);
  assert.equal(second.spawns.length, 1);
  assert.equal(getScriptPhase(script, 0), 1);
  assert.equal(getScriptPhase(script, script.spawns.length), 3);
});

/** Momentos de recolocación: pasos de la solución separados más de 3 s (sin contar la colocación inicial). */
function moveMoments(script: (typeof STRATEGIC_SCRIPTS)[number]): number[] {
  const sorted = [...script.solution].sort((a, b) => a.t - b.t);
  const starts: number[] = [];
  let last = -99;
  for (const step of sorted) {
    if (step.t - last > 3) starts.push(step.t);
    last = step.t;
  }
  return starts.slice(1);
}

for (const script of STRATEGIC_SCRIPTS.filter((s) => s.minMoves)) {
  test(`Guion Nv.${script.level}: exige ${script.minMoves} recolocaciones y parar antes pierde`, () => {
    const moments = moveMoments(script);
    assert.ok(moments.length >= script.minMoves!, `solo ${moments.length} recolocaciones`);
    for (const cut of moments) {
      const plan = script.solution.filter((s) => s.t < cut);
      const res = simulateStrategic({ level: script.level, spawns: script.spawns, plan });
      assert.ok(res.leaks.length >= 1, `dejar de mover en el segundo ${cut} también gana`);
    }
  });

  test(`Guion Nv.${script.level}: ningún tablero quieto con los combos montados gana`, () => {
    const layouts = enumerateComboLayouts(script.loadout, { looseRows: script.staticSearchRows });
    assert.ok(layouts.length > 0);
    const winners = layouts.filter(
      (placements) =>
        simulateStrategic({
          level: script.level,
          spawns: script.spawns,
          plan: [{ t: 0, placements }],
          stopOnFirstLeak: true,
        }).leaks.length === 0
    );
    const show = winners
      .slice(0, 3)
      .map((l) => l.map((p) => `${p.type}@C${p.rail + 1}F${p.row + 1}`).join(' '))
      .join(' | ');
    assert.equal(winners.length, 0, `${winners.length}/${layouts.length} tableros quietos ganan: ${show}`);
  });
}

test('Gran Jefe: la esquiva barre los carriles sin azar y rebota en los bordes', async () => {
  const { nextGrandBossEvadeRail } = await import('./rules');
  const path: number[] = [];
  let rail = 1;
  let dir: 1 | -1 = 1;
  for (let i = 0; i < 6; i++) {
    const next = nextGrandBossEvadeRail(rail, dir);
    rail = next.rail;
    dir = next.dir;
    path.push(rail);
  }
  assert.deepEqual(path, [2, 3, 2, 1, 0, 1]);
});

test('Gran Jefe en el simulador: pasa por las 3 fases y el mismo guion da siempre el mismo resultado', () => {
  const spawns = [{ t: 0.5, type: 'king_crab' as const, rail: 1, boss: { tier: 'grand' as const, puzzle: 'uv_overheat' as const, hp: 460 } }];
  const plan = [
    {
      t: 0,
      placements: [
        { type: 'aerosol_torch' as const, rail: 0, row: 3 },
        { type: 'aerosol_torch' as const, rail: 1, row: 3 },
        { type: 'soap_bar' as const, rail: 2, row: 3 },
        { type: 'mop_vortex' as const, rail: 3, row: 3 },
        { type: 'spray_flus' as const, rail: 1, row: 5 },
      ],
    },
  ];
  const a = simulateStrategic({ level: 10, spawns, plan });
  const b = simulateStrategic({ level: 10, spawns, plan });
  assert.equal(a.kills.length, 1);
  assert.equal(a.kills[0].t, b.kills[0].t);
  // Solo con el Flus-Flus (sin calor ni control) la coraza y la esquiva lo dejan pasar.
  const weak = simulateStrategic({ level: 10, spawns, plan: [{ t: 0, placements: [{ type: 'spray_flus', rail: 1, row: 5 }] }] });
  assert.equal(weak.leaks.length, 1);
});
