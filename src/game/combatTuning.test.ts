import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');

// El motor y el simulador deben leer los números de combate de `combatTuning.ts`.
// Si alguien vuelve a escribir una tabla a mano en uno de los dos, el simulador deja de
// representar al juego sin que ningún otro test lo note.
test('Constantes de combate: ni el motor ni el simulador redeclaran tablas propias', () => {
  const sources = {
    canvas: read('../components/ChefBastionCanvas.tsx'),
    sim: read('./strategicSim.ts'),
  };
  const forbidden = [
    /speed_ant:\s*0\.68/, // tabla de velocidad
    /speed_ant:\s*40\b/, // tabla de vida del Estratégico
    /isInCombo \? 0\.6 :/, // cadencia del Flus-Flus
    /inCombo \? 0\.6 :/,
    /\? 240\s*\n\s*: 65/, // contacto de la Fregona
  ];
  for (const [name, src] of Object.entries(sources)) {
    for (const re of forbidden) {
      assert.ok(!re.test(src), `${name} redeclara una constante de combate (${re}); usa combatTuning.ts`);
    }
  }
});
