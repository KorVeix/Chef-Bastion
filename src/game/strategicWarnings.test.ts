import test from 'node:test';
import assert from 'node:assert/strict';
import { STRATEGIC_SCRIPTS } from './strategicScripts';
import {
  STRATEGIC_FRONT_QUIET_SEC,
  STRATEGIC_WARNING_LEAD_SEC,
  STRATEGIC_WARNING_MIN_GAP_SEC,
  activeScriptWarnings,
  formatWarningCounts,
  getScriptWarnings,
} from './strategicWarnings';

/** Hasta este segundo los pasos de la solución son la colocación inicial, no recolocaciones. */
const OPENING_SEC = 8;
/** Pasos de una misma recolocación (una pieza cada ~0,6 s). */
const MOVE_CLUSTER_SEC = 1.5;

for (const script of STRATEGIC_SCRIPTS) {
  const warnings = getScriptWarnings(script);

  test(`Avisos Nv.${script.level}: margen fijo y tandas reales del guion`, () => {
    for (const w of warnings) {
      assert.ok(w.spawnAt >= STRATEGIC_WARNING_LEAD_SEC, `${w.id}: sin margen completo`);
      assert.equal(Math.round((w.spawnAt - w.showAt) * 10) / 10, STRATEGIC_WARNING_LEAD_SEC);
      const tanda = script.spawns.filter((sp) => sp.t === w.spawnAt);
      const announced = w.entries.reduce((n, e) => n + Object.values(e.counts).reduce((a, b) => a + b, 0), 0);
      assert.equal(announced, tanda.length, `${w.id}: el aviso no cuenta la tanda entera`);
    }
    assert.deepEqual(getScriptWarnings(script), warnings, 'debe ser determinista');
  });

  test(`Avisos Nv.${script.level}: cada recolocación de la solución llega con su tanda avisada`, () => {
    const moves: number[] = [];
    for (const step of script.solution) {
      if (step.t < OPENING_SEC) continue;
      if (moves.length === 0 || step.t - moves[moves.length - 1] > MOVE_CLUSTER_SEC) moves.push(step.t);
    }
    for (const m of moves) {
      const covered = warnings.some((w) => w.showAt <= m && m - w.spawnAt <= STRATEGIC_FRONT_QUIET_SEC);
      assert.ok(covered, `recolocación a los ${m} s sin aviso previo`);
    }
  });

  test(`Avisos Nv.${script.level}: bichos nuevos y jefes siempre avisados, frentes sin encadenar`, () => {
    const firstSeen = new Map<string, number>();
    for (const sp of [...script.spawns].sort((a, b) => a.t - b.t)) {
      if (!firstSeen.has(sp.type)) firstSeen.set(sp.type, sp.t);
    }
    for (const [type, t] of firstSeen) {
      if (t < STRATEGIC_WARNING_LEAD_SEC) continue;
      assert.ok(
        warnings.some((w) => w.spawnAt === t && (w.kind === 'new' || w.kind === 'boss')),
        `${type} aparece a los ${t} s sin aviso`
      );
    }
    for (const sp of script.spawns.filter((s) => s.boss && s.t >= STRATEGIC_WARNING_LEAD_SEC)) {
      assert.ok(warnings.some((w) => w.spawnAt === sp.t && w.kind === 'boss'), `jefe a los ${sp.t} s sin aviso`);
    }
    for (let i = 1; i < warnings.length; i++) {
      if (warnings[i].kind !== 'front') continue;
      assert.ok(warnings[i].spawnAt >= STRATEGIC_FRONT_QUIET_SEC, `${warnings[i].id}: frente en la apertura`);
      assert.ok(
        warnings[i].spawnAt - warnings[i - 1].spawnAt >= STRATEGIC_WARNING_MIN_GAP_SEC,
        `${warnings[i].id}: frente pegado al aviso anterior`
      );
    }
  });
}

test('Avisos: los tramos del Nv.4 se anuncian al cambiar de lado', () => {
  const nv4 = STRATEGIC_SCRIPTS.find((s) => s.level === 4)!;
  const ws = getScriptWarnings(nv4);
  assert.deepEqual(
    ws.map((w) => [w.spawnAt, w.kind, w.entries.map((e) => e.rail)]),
    [
      [16, 'front', [2, 3]],
      [32, 'front', [0, 1]],
    ]
  );
});

test('Avisos: entradas laterales llevan lado y fila', () => {
  const nv13 = STRATEGIC_SCRIPTS.find((s) => s.level === 13)!;
  const lateral = getScriptWarnings(nv13).flatMap((w) => w.entries);
  assert.ok(lateral.length > 0);
  for (const e of lateral) {
    assert.ok(e.side === 'left' || e.side === 'right');
    assert.equal(typeof e.row, 'number');
  }
});

test('Avisos: activeScriptWarnings muestra el aviso solo entre showAt y la tanda', () => {
  const nv4 = STRATEGIC_SCRIPTS.find((s) => s.level === 4)!;
  const ws = getScriptWarnings(nv4);
  assert.equal(activeScriptWarnings(ws, 12.9).length, 0);
  const live = activeScriptWarnings(ws, 14.5);
  assert.equal(live.length, 1);
  assert.equal(live[0].warning.spawnAt, 16);
  assert.ok(Math.abs(live[0].secondsLeft - 1.5) < 1e-9);
  assert.equal(activeScriptWarnings(ws, 16).length, 0);
  assert.equal(formatWarningCounts({ cap_beetle: 2, speed_ant: 1 }), '🛡️🐀×2 🐜×1');
  assert.equal(formatWarningCounts({ king_crab: 1 }, true), '👑 🦀×1');
});
