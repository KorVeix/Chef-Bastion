/**
 * Fuente única de los números de combate que comparten el motor (`ChefBastionCanvas.tsx`),
 * el simulador del Estratégico (`strategicSim.ts`) y el auditor (`levelAudit.ts`).
 *
 * Valores base para armas de nivel 1 sin sombreros ni mejoras: el motor aplica encima sus
 * multiplicadores (nivel del arma, Supervivencia, sombreros, comandas). Cambiar un número aquí
 * cambia el juego y el simulador a la vez, y los tests de guiones lo validan.
 */
import type { BugType } from './types';

/** Vida fija por tipo de bicho en el Estratégico. */
export const BUG_BASE_HP: Record<BugType, number> = {
  speed_ant: 40,
  cap_beetle: 84,
  acid_wasp: 64,
  shift_roach: 60,
  king_crab: 145,
};

/** Velocidad base en filas/s, antes del multiplicador de nivel y bioma. */
export const BUG_BASE_SPEED: Record<BugType, number> = {
  speed_ant: 0.68,
  cap_beetle: 0.48,
  acid_wasp: 0.44,
  shift_roach: 0.6,
  king_crab: 0.36,
};

export const COMBAT = {
  /** Factor de velocidad de un bicho frenado (Fregona, Jabón, remolino). */
  slowSpeedFactor: 0.55,

  flus: {
    interval: 1.65,
    rushInterval: 1.05,
    comboInterval: 0.6,
    damage: 14,
    comboDamage: 19,
    speed: 5.0,
    life: 2.3,
  },

  /** Estropajo delante del Flus-Flus: cada gota se abre en 5 burbujas. */
  foam: {
    angles: [-0.55, -0.26, 0, 0.26, 0.55] as readonly number[],
    damage: 16,
    speedX: 3.2,
    speedY: 4.5,
    life: 1.4,
    /** Las burbujas con |ángulo| > esto perforan escudo. */
    pierceAngle: 0.2,
  },

  mop: {
    interval: 1.45,
    comboInterval: 0.85,
    shots: 4,
    comboShots: 8,
    damage: 14,
    comboDamage: 24,
    speed: 2.5,
    life: 0.88,
    /** Daño por contacto en la casilla (por segundo). */
    contactDps: 65,
    contactDpsSlipped: 240,
    bossContactDps: 46,
    bossContactDpsSlipped: 88,
  },

  soap: {
    slowSec: 2.6,
  },

  bridgeUv: {
    dps: 48,
    /** Ventana vertical: |Δfila| < 0.3. */
    halfWindowRows: 0.3,
    miniBossStunSec: 3.2,
  },

  gelWc: {
    /** Daño del ácido devuelto, por nivel del Gel WC. */
    reflectDamagePerLevel: 45,
  },

  wasp: {
    /** Carga del ataque por segundo (dispara al llegar a 1). */
    windupPerSec: 0.45,
    minRow: 0.5,
    maxRow: 3.6,
    acidSpeed: 3.1,
    acidDamage: 10,
    acidLife: 2.2,
    /** Segundos que queda pringada el arma alcanzada. */
    gunkSec: 3.5,
  },
} as const;
