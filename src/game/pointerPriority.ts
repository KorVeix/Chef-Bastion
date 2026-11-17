/**
 * Prioridad del toque en el tablero: las armas antes que el Chef.
 *
 * El Chef (Trapazo de cocina) tiene un cilindro invisible para el raycast que, con la cámara de
 * móvil, tapa casi entera la casilla F7 de su carril, y el Chef se desplaza al carril tocado. Si el
 * Chef ganara siempre, con un bicho cerca de los platos no se podría coger un arma de F7.
 *
 * Regla: el toque es del Chef solo si cae sobre él, no hay ningún arma seleccionada y la casilla de
 * debajo (si la hay) está vacía. En cualquier otro caso se coge, suelta o mueve el arma.
 */
export function chefTakesPointerDown(input: {
  overChef: boolean;
  hasSelectedPiece: boolean;
  cellHasPiece: boolean;
}): boolean {
  return input.overChef && !input.hasSelectedPiece && !input.cellHasPiece;
}

/** Desplazamiento máximo (px CSS) para que soltar el dedo cuente como toque y no como arrastre. */
export const TAP_SLOP_PX = 12;

/**
 * Qué hacer al levantar el dedo tras coger un arma del tablero.
 *
 * Al arrastrar se suelta la pieza 45 px por encima del dedo para verla. Si eso se aplicara también
 * a un toque sin movimiento, el arma saltaría a la fila de encima solo por tocarla (en F7 la
 * casilla mide ~50 px en pantalla). Un toque, por tanto, no mueve nada:
 * - `drop`: arrastre real (o arrastre desde la bandeja): se suelta en la casilla de destino.
 * - `keep`: toque sobre un arma no seleccionada: queda seleccionada; se coloca tocando el destino.
 * - `release`: toque sobre el arma que ya estaba seleccionada: se suelta la selección.
 */
export function resolveBoardPointerUp(input: {
  movedPx: number;
  fromTray: boolean;
  downOnAlreadySelected: boolean;
}): 'drop' | 'keep' | 'release' {
  if (input.fromTray || input.movedPx > TAP_SLOP_PX) return 'drop';
  return input.downOnAlreadySelected ? 'release' : 'keep';
}
