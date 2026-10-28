// Rulare: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { statusOfertaDupaStorno } from './stornoOferta.ts'

// factură cumulată: oferta A are 2 linii (una împărțită FIFO pe două intrări), oferta B una
const linii = [
  { id: 'a1', oferta_id: 'A', cantitate: 2 },
  { id: 'a2', oferta_id: 'A', cantitate: 1 },
  { id: 'b1', oferta_id: 'B', cantitate: 4 },
]

test('nimic stornat → status neschimbat', () => {
  assert.equal(statusOfertaDupaStorno('A', linii, new Map()), null)
})

test('storno pe o parte din oferta A → parțial; B neatinsă', () => {
  const s = new Map([['a1', 1]])
  assert.equal(statusOfertaDupaStorno('A', linii, s), 'stornata_partial')
  assert.equal(statusOfertaDupaStorno('B', linii, s), null)
})

test('toate liniile ofertei stornate complet → stornată', () => {
  const s = new Map([['a1', 2], ['a2', 1]])
  assert.equal(statusOfertaDupaStorno('A', linii, s), 'stornata')
})

test('două storno-uri parțiale care acoperă tot → stornată', () => {
  const s = new Map([['b1', 4]]) // 1 + 3, deja adunate
  assert.equal(statusOfertaDupaStorno('B', linii, s), 'stornata')
})

test('stornat mai mult decât s-a facturat pe o linie nu acoperă altă linie', () => {
  const s = new Map([['a1', 5]])
  assert.equal(statusOfertaDupaStorno('A', linii, s), 'stornata_partial')
})
