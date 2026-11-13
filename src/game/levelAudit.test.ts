import test from 'node:test';
import assert from 'node:assert/strict';
import {
  auditStrategicLevel,
  computeRailCoverage,
  findBestCoverage,
  getStrategicLevelSpec,
} from './levelAudit';

test('Huellas: Flus-Flus solo daña su carril y no abre escudos', () => {
  const cov = computeRailCoverage([{ type: 'spray_flus', rail: 1 }]);
  assert.deepEqual(cov.damage, [false, true, false, false]);
  assert.deepEqual(cov.shieldBreak, [false, false, false, false]);
});

test('Huellas: Flus-Flus + Estropajo cubre su carril y los vecinos, y abre escudos', () => {
  const cov = computeRailCoverage([
    { type: 'spray_flus', rail: 1 },
    { type: 'scourer_nanas', rail: 1 },
  ]);
  assert.deepEqual(cov.damage, [true, true, true, false]);
  assert.deepEqual(cov.shieldBreak, [true, true, true, false]);
});

test('Huellas: el puente UV necesita 2 Aerosoles en carriles contiguos', () => {
  const apart = computeRailCoverage([
    { type: 'aerosol_torch', rail: 0 },
    { type: 'aerosol_torch', rail: 2 },
  ]);
  assert.deepEqual(apart.damage, [false, false, false, false]);
  const bridge = computeRailCoverage([
    { type: 'aerosol_torch', rail: 2 },
    { type: 'aerosol_torch', rail: 3 },
  ]);
  assert.deepEqual(bridge.damage, [false, false, true, true]);
  assert.deepEqual(bridge.shieldBreak, [false, false, true, true]);
});

test('Huellas: el Jabón cubre su carril si el carril al que desvía está cubierto', () => {
  const cov = computeRailCoverage([
    { type: 'spray_flus', rail: 2 },
    { type: 'soap_bar', rail: 1 },
  ]);
  assert.equal(cov.damage[1], true);
  assert.equal(cov.damage[0], false);
});

test('Cabida: Escuadra + Estropajo + Flus-Flus no cubren 4 carriles con escudos', () => {
  const res = findBestCoverage(['corner_square', 'scourer_nanas', 'spray_flus'], [0, 1, 2, 3], true);
  assert.equal(res.ok, false);
  assert.equal(res.uncoveredRails.length, 1);
});

test('Cabida: abanico en 3 carriles + puente UV en el cuarto cubren los 4', () => {
  const res = findBestCoverage(
    ['spray_flus', 'scourer_nanas', 'aerosol_torch', 'aerosol_torch'],
    [0, 1, 2, 3],
    true
  );
  assert.equal(res.ok, true);
});

test('Auditoría: el Nivel 1 tiene solución', () => {
  assert.equal(auditStrategicLevel(getStrategicLevelSpec(1)).ok, true);
});

test('Auditoría: detecta un arma anunciada que no llega a la bandeja', () => {
  const spec = getStrategicLevelSpec(7);
  assert.equal(spec.phases[2].announcedUnlock, 'mop_vortex');
  assert.equal(spec.phases[2].unlockDelivered, false);
  const res = auditStrategicLevel(spec);
  assert.ok(res.findings.some((f) => f.code === 'unlock_not_delivered' && f.phase === 3));
});
