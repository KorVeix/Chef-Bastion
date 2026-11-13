/**
 * Informe del comprobador de cabida del Modo Estratégico: `bun run audit:estrategico`.
 * Solo lee las reglas; no cambia ningún nivel.
 */
import { auditStrategicCampaign } from '../src/game/levelAudit';

const results = auditStrategicCampaign();
for (const r of results) {
  const tp = r.throughputByPhase
    .map((t, i) => `F${i + 1} ${t.requiredDps.toFixed(0)}/${t.maxDps.toFixed(0)}`)
    .join('  ');
  console.log(`Nv.${String(r.level).padStart(2)} ${r.ok ? 'OK  ' : 'FALLA'}  vida que entra/techo de daño: ${tp}`);
  for (const f of r.findings) {
    console.log(`        ${f.severity === 'fail' ? '✗' : '·'} ${f.message}`);
  }
}
const failing = results.filter((r) => !r.ok).map((r) => r.level);
console.log(`\nNiveles que fallan (${failing.length}): ${failing.join(', ') || 'ninguno'}`);
