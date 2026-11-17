import test from 'node:test';
import assert from 'node:assert/strict';
import { chefTakesPointerDown } from './pointerPriority';

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
