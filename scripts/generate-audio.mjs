// Original SUDUEL sound design: deterministic synthesis; no third-party samples.
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
const rate = 22050
let seed = 1729
const random = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296 * 2 - 1 }
const sounds = new Map()
function compose(name, duration, voices, noise = 0) {
  const data = new Float64Array(Math.ceil(duration * rate))
  let filtered = 0
  for (let i = 0; i < data.length; i++) {
    const t = i / rate
    filtered = .7 * filtered + .3 * random()
    let sample = filtered * noise * Math.exp(-t / Math.max(.06, duration * .3))
    for (const voice of voices) {
      const [frequency, start = 0, length = duration, level = .2, slide = 0, harmonic = .12] = voice
      const local = t - start
      if (local < 0 || local > length) continue
      const envelope = Math.min(1, local / .007) * Math.pow(Math.max(0, 1 - local / length), 2)
      const phase = 2 * Math.PI * (frequency * local + slide * local * local / 2)
      sample += level * envelope * (Math.sin(phase) + harmonic * Math.sin(phase * 2) + .04 * Math.sin(phase * 3))
    }
    data[i] = Math.tanh(sample) * .85
  }
  const buffer = Buffer.alloc(44 + data.length * 2)
  buffer.write('RIFF', 0); buffer.writeUInt32LE(buffer.length - 8, 4); buffer.write('WAVEfmt ', 8)
  buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22); buffer.writeUInt32LE(rate, 24)
  buffer.writeUInt32LE(rate * 2, 28); buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34); buffer.write('data', 36); buffer.writeUInt32LE(data.length * 2, 40)
  for (let i = 0; i < data.length; i++) buffer.writeInt16LE(Math.round(Math.max(-1, Math.min(1, data[i])) * 32767), 44 + i * 2)
  const path = `public/audio/${name}.wav`; mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, buffer)
  sounds.set(name, { seconds: duration, bytes: buffer.length })
}
compose('ui/select', .06, [[720, 0, .055, .12, -2400]], .04)
compose('sudoku/valid-number', .12, [[680,0,.12,.22,320], [1020,.015,.09,.08]])
compose('sudoku/wrong-number', .19, [[148,0,.16,.25,-110,.45],[111,.035,.15,.15,0,.3]], .05)
compose('sudoku/row-complete', .4, [[523,0,.25,.2],[784,.1,.28,.22]])
compose('sudoku/column-complete', .4, [[587,0,.25,.2],[880,.1,.28,.22]])
compose('sudoku/box-complete', .56, [[523,0,.28,.2],[659,.1,.3,.19],[1046,.2,.32,.22]])
compose('battle/energy-gain', .3, [[780,0,.2,.18,800],[1175,.08,.2,.17]])
compose('battle/energy-spend', .15, [[420,0,.14,.16,-1300]], .14)
compose('battle/combo-2', .5, [[659,0,.28,.23],[988,.12,.32,.23]])
compose('battle/combo-3', .75, [[523,0,.3,.2],[659,.12,.3,.2],[784,.24,.34,.22],[1046,.36,.36,.2]])
compose('battle/fog-cast', .32, [[280,0,.3,.08,1300]], .48)
compose('battle/fog-impact', .44, [[190,0,.25,.1,-150]], .6)
compose('battle/freeze-cast', .3, [[1500,0,.27,.18,1200],[2200,.06,.22,.1]], .09)
compose('battle/freeze-impact', .42, [[1780,0,.35,.2,-650],[2630,.02,.25,.12],[3130,.04,.24,.08]], .3)
compose('battle/freeze-end', .28, [[2350,0,.16,.12,-1700],[1580,.08,.18,.1]], .2)
compose('battle/scramble-cast', .28, [[390,0,.09,.2,2300],[920,.09,.07,.18,-2000],[510,.16,.1,.2,3200]], .12)
compose('battle/scramble-impact', .38, [[260,0,.09,.22],[1100,.07,.08,.2,-5000],[440,.15,.09,.2],[880,.24,.12,.15]], .22)
compose('battle/scramble-end', .25, [[440,0,.14,.16],[880,.09,.15,.18]])
compose('battle/shield-activate', .48, [[220,0,.4,.2,260],[440,.06,.38,.14],[880,.15,.3,.1]])
compose('battle/shield-block', .38, [[660,0,.34,.23],[987,0,.28,.14],[1420,.015,.24,.1]], .18)
compose('timer/warning', .4, [[440,0,.17,.16],[554,.2,.18,.16]])
compose('timer/tick', .075, [[900,0,.07,.13]])
compose('timer/tick-high', .085, [[1100,0,.08,.14]])
compose('timer/tick-final', .17, [[1320,0,.16,.16],[660,0,.15,.06]])
compose('timer/countdown', .12, [[620,0,.11,.16]])
compose('results/round-end', .45, [[440,0,.4,.16,-220],[220,.1,.3,.12]])
compose('results/victory', 1.5, [[523,0,.4,.2],[659,.18,.4,.2],[784,.36,.45,.2],[1046,.58,.8,.21],[659,.6,.8,.09],[784,.6,.8,.09]])
compose('results/defeat', 1.05, [[523,0,.36,.18],[392,.2,.4,.18],[294,.4,.55,.18],[147,.45,.55,.08]])
compose('results/draw', .8, [[440,0,.4,.16],[554,.18,.4,.14],[440,.36,.4,.15]])
writeFileSync('public/audio/manifest.json', JSON.stringify(Object.fromEntries(sounds), null, 2) + '\n')
console.log(`Generated ${sounds.size} original PCM WAV cues (${[...sounds.values()].reduce((sum, s) => sum + s.bytes, 0)} bytes).`)
