// Rulare: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { alocaRezervari, cuDisponibil, type Rezervare } from './rezervari.ts'

const intrari = [
  { id: 'nou', produs_id: 'P', produs_cod: 'C1', cantitate: 5, updated_at: '2026-10-02' },
  { id: 'vechi', produs_id: 'P', produs_cod: 'C1', cantitate: 2, updated_at: '2026-10-01' },
  { id: 'altul', produs_id: 'Q', produs_cod: 'C2', cantitate: 4, updated_at: '2026-09-01' },
]
const rez = (r: Partial<Rezervare>): Rezervare =>
  ({ tip: 'livrat', stoc_id: null, produs_id: null, cod: null, cantitate: 1, eticheta: 'X', sursa_id: 'S', ...r })

test('fără intrare exactă: FIFO, întâi intrarea cea mai veche', () => {
  const d = cuDisponibil(intrari, [rez({ produs_id: 'P', cantitate: 3 })])
  assert.deepEqual(d.map(e => e.cantitate), [4, 0, 4])
})

test('se potrivește și doar după cod (stoc importat fără produs)', () => {
  const d = cuDisponibil(intrari, [rez({ cod: 'C2', cantitate: 1 })])
  assert.deepEqual(d.map(e => e.cantitate), [5, 2, 3])
})

test('intrarea exactă are prioritate, surplusul trece FIFO pe restul', () => {
  const d = cuDisponibil(intrari, [rez({ stoc_id: 'nou', produs_id: 'P', cantitate: 6 })])
  assert.deepEqual(d.map(e => e.cantitate), [0, 1, 4])
})

test('rezervările cu intrare exactă nu sunt împinse de cele fără', () => {
  const a = alocaRezervari(intrari, [
    rez({ produs_id: 'P', cantitate: 2, eticheta: 'fara' }),
    rez({ stoc_id: 'vechi', produs_id: 'P', cantitate: 2, eticheta: 'exacta' }),
  ])
  assert.deepEqual(a.get('vechi')!.rezervari.map(r => r.eticheta), ['exacta'])
  assert.equal(a.get('nou')!.rezervat, 2)
})

test('disponibilul nu scade sub 0 când rezervările depășesc stocul', () => {
  const d = cuDisponibil(intrari, [rez({ produs_id: 'Q', cantitate: 10 })])
  assert.equal(d[2].cantitate, 0)
})
