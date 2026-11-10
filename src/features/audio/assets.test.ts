/// <reference types="node" />
import { expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { SOUND_FILES } from './manager'

it('ships distinct, non-silent, unclipped PCM assets for every registered cue', () => {
  const hashes = new Set<string>()
  for (const file of Object.values(SOUND_FILES)) {
    const data = readFileSync(`public/audio/${file}.wav`)
    expect(data.toString('ascii',0,4)).toBe('RIFF'); expect(data.toString('ascii',8,12)).toBe('WAVE')
    expect(data.readUInt16LE(20)).toBe(1); expect(data.readUInt16LE(22)).toBe(1); expect(data.readUInt16LE(34)).toBe(16)
    const duration = (data.length-44) / 2 / data.readUInt32LE(24)
    expect(duration).toBeGreaterThan(.02); expect(duration).toBeLessThan(2)
    let peak = 0, energy = 0
    for (let i = 44; i < data.length; i+=2) { const sample = data.readInt16LE(i); peak = Math.max(peak,Math.abs(sample)); energy+=sample*sample }
    expect(peak).toBeLessThan(32767); expect(energy).toBeGreaterThan(100000)
    hashes.add(data.toString('base64'))
  }
  expect(hashes.size).toBe(Object.keys(SOUND_FILES).length)
})
