import test from 'node:test';
import assert from 'node:assert/strict';
import { chefTakesPointerDown, resolveBoardPointerUp, TAP_SLOP_PX } from './pointerPriority';

test('tocar un arma bajo el Chef la coge: el Trapazo no se come el toque', () => {
  assert.equal(chefTakesPointerDown({ overChef: true, hasSelectedPiece: false, cellHasPiece: true }), false);
});

test('con un arma seleccionada, tocar sobre el Chef la suelta en la casilla', () => {
  assert.equal(chefTakesPointerDown({ overChef: true, hasSelectedPiece: true, cellHasPiece: false }), false);
  assert.equal(chefTakesPointerDown({ overChef: true, hasSelectedPiece: true, cellHasPiece: true }), false);
});

test('el Trapazo sigue funcionando al tocar al Chef en vacío', () => {
  assert.equal(chefTakesPointerDown({ overChef: true, hasSelectedPiece: false, cellHasPiece: false }), true);
});

test('fuera del Chef nunca hay Trapazo por toque', () => {
  assert.equal(chefTakesPointerDown({ overChef: false, hasSelectedPiece: false, cellHasPiece: false }), false);
});

test('tocar un arma sin arrastrar no la mueve de fila: queda seleccionada', () => {
  assert.equal(resolveBoardPointerUp({ movedPx: 0, fromTray: false, downOnAlreadySelected: false }), 'keep');
  assert.equal(resolveBoardPointerUp({ movedPx: TAP_SLOP_PX, fromTray: false, downOnAlreadySelected: false }), 'keep');
});

test('volver a tocar el arma seleccionada la suelta', () => {
  assert.equal(resolveBoardPointerUp({ movedPx: 3, fromTray: false, downOnAlreadySelected: true }), 'release');
});

test('un arrastre real (o desde la bandeja) suelta el arma en el destino', () => {
  assert.equal(resolveBoardPointerUp({ movedPx: TAP_SLOP_PX + 1, fromTray: false, downOnAlreadySelected: false }), 'drop');
  assert.equal(resolveBoardPointerUp({ movedPx: 40, fromTray: false, downOnAlreadySelected: true }), 'drop');
  assert.equal(resolveBoardPointerUp({ movedPx: 0, fromTray: true, downOnAlreadySelected: false }), 'drop');
});
