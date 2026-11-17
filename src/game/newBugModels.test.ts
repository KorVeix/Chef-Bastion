import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildNewBugMesh, NEW_BUG_MODEL_IDS, type NewBugModelId, type NewBugVariant } from './models3d';

const VARIANTS: Partial<Record<NewBugModelId, NewBugVariant>> = {
  rice_weevil: 'buried',
  pill_bug: 'curled',
  popcorn_kernel: 'popped',
};

/** Mallas del bicho sin contar contornos, sombra ni patines de espuma. */
function bodyMeshes(root: THREE.Object3D): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  root.traverse((c) => {
    const m = c as THREE.Mesh;
    if (!m.isMesh || c.userData.isInkOutline) return;
    if (c.name === 'contact_shadow' || c.name === 'foam_skates') return;
    out.push(m);
  });
  return out;
}

const allModels = NEW_BUG_MODEL_IDS.flatMap((id) => {
  const v = VARIANTS[id];
  return v ? [[id, undefined], [id, v]] : [[id, undefined]];
}) as [NewBugModelId, NewBugVariant | undefined][];

test('los 15 bichos nuevos tienen id único', () => {
  assert.equal(NEW_BUG_MODEL_IDS.length, 15);
  assert.equal(new Set(NEW_BUG_MODEL_IDS).size, 15);
});

test('presupuesto de gama media: <= 20 mallas, esferas <= 10x8, cilindros y conos <= 8 lados', () => {
  for (const [id, v] of allModels) {
    const meshes = bodyMeshes(buildNewBugMesh(id, v));
    assert.ok(meshes.length <= 20, `${id}:${v ?? ''} tiene ${meshes.length} mallas`);
    for (const m of meshes) {
      const g = m.geometry as THREE.BufferGeometry & { parameters?: Record<string, number> };
      const p = g.parameters ?? {};
      if (g.type === 'SphereGeometry') {
        assert.ok(p.widthSegments <= 10 && p.heightSegments <= 8, `${id}: esfera ${p.widthSegments}x${p.heightSegments}`);
      }
      if (g.type === 'CylinderGeometry' || g.type === 'ConeGeometry') {
        assert.ok(p.radialSegments <= 8, `${id}: ${g.type} de ${p.radialSegments} lados`);
      }
    }
  }
});

test('todos llevan patines de espuma ocultos y sombra, y el destello blanco usa materiales toon', () => {
  for (const [id, v] of allModels) {
    const root = buildNewBugMesh(id, v);
    const skates = root.getObjectByName('foam_skates');
    assert.ok(skates && !skates.visible, `${id}: foam_skates`);
    assert.ok(root.getObjectByName('contact_shadow'), `${id}: contact_shadow`);
    for (const m of bodyMeshes(root)) {
      const mat = m.material as THREE.Material & { isMeshToonMaterial?: boolean; isMeshBasicMaterial?: boolean };
      assert.ok(mat.isMeshToonMaterial || mat.isMeshBasicMaterial, `${id}: material ${mat.type}`);
    }
  }
});

test('nodos que usa la lógica', () => {
  assert.ok(buildNewBugMesh('spittle_bug').getObjectByName('foam_coat'));
  assert.ok(buildNewBugMesh('pot_snail').getObjectByName('pot_shell'));
  assert.equal(buildNewBugMesh('pressure_beetle').getObjectByName('steam_puff')?.visible, false);
  const fly = buildNewBugMesh('bluebottle').getObjectByName('anim_wings');
  assert.ok(fly?.getObjectByName('left_wing') && fly.getObjectByName('right_wing'));
});

test('Lepisma semitransparente (0,45) con los contornos creados pero ocultos', () => {
  const body = buildNewBugMesh('silverfish').getObjectByName('silverfish_body');
  assert.ok(body);
  let outlines = 0;
  body.traverse((c) => {
    const m = c as THREE.Mesh;
    if (!m.isMesh) return;
    if (c.userData.isInkOutline) {
      outlines++;
      assert.equal(c.visible, false);
    } else {
      assert.equal((m.material as THREE.Material).opacity, 0.45);
    }
  });
  assert.ok(outlines > 0);
});

test('una variante que no corresponde se ignora', () => {
  const plain = bodyMeshes(buildNewBugMesh('oil_slick')).length;
  assert.equal(bodyMeshes(buildNewBugMesh('oil_slick', 'buried')).length, plain);
  assert.notEqual(bodyMeshes(buildNewBugMesh('pill_bug', 'curled')).length, bodyMeshes(buildNewBugMesh('pill_bug')).length);
});
