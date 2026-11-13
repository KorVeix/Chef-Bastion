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
    const res = simulateStrategic({ level: script.level, spawns: script.spawns, plan: script.solution });
    assert.equal(res.leaks.length, 0, `fugas: ${leaksLabel(res.leaks)}`);
    assert.equal(res.kills.length, script.spawns.length);
  });

  test(`Guion Nv.${script.level}: sin el combo que enseña («${script.failsWithout.label}») se pierde`, () => {
    for (const step of script.failsWithout.plan) {
      assert.equal(validateLayout(step, script.loadout), null);
    }
    const res = simulateStrategic({
      level: script.level,
      spawns: script.spawns,
      plan: script.failsWithout.plan,
    });
    assert.ok(res.leaks.length >= 1, 'el guion se puede pasar sin el combo que enseña');
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
  const byLevel = new Map(STRATEGIC_SCRIPTS.map((s) => [s.level, new Set(s.spawns.map((sp) => sp.type))]));
  const types = new Set(STRATEGIC_SCRIPTS.flatMap((s) => s.spawns.map((sp) => sp.type)));
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
