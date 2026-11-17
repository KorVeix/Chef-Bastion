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
