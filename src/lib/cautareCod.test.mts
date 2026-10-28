// Rulare: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cheieCod, cheiCautare, filtreCod } from './cautareCod.ts'

test('spațiile, punctele, slash-urile și cratimele nu contează', () => {
  for (const c of ['HU 719/7 X', 'HU719/7X', 'hu7197x', 'HU-719.7 X']) assert.equal(cheieCod(c), 'HU7197X')
  assert.equal(cheieCod('123/456'), cheieCod('123 456'))
  assert.equal(cheieCod('123456'), cheieCod('123.456'))
})

test('Elring: EL + 6 cifre = codul fără EL', () => {
  assert.equal(cheieCod('EL136790'), '136790')
  assert.equal(cheieCod('el 136.790'), '136790')
  assert.equal(cheieCod('136.790'), '136790')
  assert.equal(cheieCod('EL954EXI'), 'EL954EXI')   // nu e Elring
  assert.equal(cheieCod('EL1234567'), 'EL1234567') // 7 cifre — nu e Elring
})

test('Lemförder: LMI în față nu contează', () => {
  assert.equal(cheieCod('LMI26772'), '26772')
  assert.equal(cheieCod('LMI 26774 01'), '2677401')
  assert.equal(cheieCod('27126 01'), '2712601')
})

test('„26772 01" găsește și „LMI26772" (fără sufix)', () => {
  assert.deepEqual(cheiCautare('26772 01'), ['2677201', '26772'])
  assert.deepEqual(cheiCautare('LMI 26772-01'), ['2677201', '26772'])
  assert.deepEqual(cheiCautare('HU 719/7 X'), ['HU7197X'])
  assert.deepEqual(cheiCautare('a'), [])
})

test('filtrele PostgREST conțin doar litere și cifre (fără virgule care strică .or())', () => {
  assert.deepEqual(filtreCod('C 35,154'), ['cod_cautare.ilike.%C35154%'])
  assert.deepEqual(filtreCod('26772 01', 'x'), ['x.ilike.%2677201%', 'x.ilike.%26772%'])
})
