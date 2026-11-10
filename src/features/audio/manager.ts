import { CueGate } from '../battle/events'
import { usePreferences } from './preferences'

export const SOUND_FILES = {
  select: 'ui/select', valid_number: 'sudoku/valid-number', wrong_number: 'sudoku/wrong-number',
  row_complete: 'sudoku/row-complete', column_complete: 'sudoku/column-complete', box_complete: 'sudoku/box-complete',
  energy_gain: 'battle/energy-gain', energy_spend: 'battle/energy-spend', combo_2: 'battle/combo-2', combo_3: 'battle/combo-3',
  fog_cast: 'battle/fog-cast', fog_impact: 'battle/fog-impact', freeze_cast: 'battle/freeze-cast', freeze_impact: 'battle/freeze-impact',
  freeze_end: 'battle/freeze-end', scramble_cast: 'battle/scramble-cast', scramble_impact: 'battle/scramble-impact', scramble_end: 'battle/scramble-end',
  shield_activate: 'battle/shield-activate', shield_block: 'battle/shield-block',
  warning: 'timer/warning', tick: 'timer/tick', tick_high: 'timer/tick-high', tick_final: 'timer/tick-final', countdown: 'timer/countdown',
  round_end: 'results/round-end', victory: 'results/victory', defeat: 'results/defeat', draw: 'results/draw',
} as const
export type Sound = keyof typeof SOUND_FILES

export class AudioManager {
  private context: AudioContext | null = null
  private gain: GainNode | null = null
  private buffers = new Map<Sound, AudioBuffer>()
  private loading = new Map<Sound, Promise<AudioBuffer | null>>()
  private sources = new Set<AudioBufferSourceNode>()
  private gate = new CueGate()
  private failed = false
  private disposed = false

  unlock() {
    if (!usePreferences.getState().sound || this.failed) return
    this.disposed = false
    try {
      if (!this.context || this.context.state === 'closed') {
        this.context = new AudioContext()
        this.gain = this.context.createGain(); this.gain.connect(this.context.destination)
        this.updateVolume()
      }
      if (this.context.state === 'suspended') void this.context.resume().catch(() => {})
      for (const sound of Object.keys(SOUND_FILES) as Sound[]) void this.load(sound)
    } catch { this.failed = true }
  }
  private load(sound: Sound): Promise<AudioBuffer | null> {
    if (this.buffers.has(sound)) return Promise.resolve(this.buffers.get(sound)!)
    if (this.loading.has(sound)) return this.loading.get(sound)!
    const context = this.context
    if (!context) return Promise.resolve(null)
    const promise = fetch(`/audio/${SOUND_FILES[sound]}.wav`).then((response) => response.ok ? response.arrayBuffer() : Promise.reject(new Error('Audio unavailable'))).then((data) => context.decodeAudioData(data)).then((buffer) => { if (this.disposed || this.context !== context) return null; this.buffers.set(sound, buffer); return buffer }).catch(() => null)
    this.loading.set(sound, promise)
    return promise
  }
  play(sound: Sound, id?: string) {
    const settings = usePreferences.getState()
    if (!settings.sound || settings.masterVolume === 0 || settings.effectsVolume === 0 || document.hidden || !this.context || this.context.state !== 'running' || this.disposed) return
    if ((sound.startsWith('tick') || sound === 'warning' || sound === 'countdown') && !settings.countdownSound) return
    if (!this.gate.allow(sound, id, performance.now(), sound === 'wrong_number' ? 220 : sound === 'select' ? 45 : 80)) return
    const requestedAt = performance.now()
    const context = this.context
    void this.load(sound).then((buffer) => {
      const current = usePreferences.getState()
      if (!buffer || !this.context || this.context !== context || !this.gain || this.disposed || !current.sound || current.masterVolume === 0 || current.effectsVolume === 0 || document.hidden || performance.now() - requestedAt > 300 || this.context.state !== 'running') return
      if ((sound.startsWith('tick') || sound === 'warning' || sound === 'countdown') && !current.countdownSound) return
      if (this.sources.size >= 5) { const oldest = this.sources.values().next().value; oldest?.stop(); if (oldest) this.sources.delete(oldest) }
      const source = this.context.createBufferSource(); source.buffer = buffer; source.connect(this.gain); this.sources.add(source)
      source.onended = () => { this.sources.delete(source); source.disconnect() }
      source.start()
    })
  }
  updateVolume() {
    const settings = usePreferences.getState()
    if (this.gain && this.context) this.gain.gain.setTargetAtTime(settings.sound ? settings.masterVolume * settings.effectsVolume * .65 : 0, this.context.currentTime, .01)
    if (!settings.sound) this.silence()
  }
  silence() {
    for (const source of this.sources) { try { source.stop() } catch { /* Already ended. */ } }
    this.sources.clear()
  }
  dispose() {
    this.disposed = true
    this.silence(); this.buffers.clear(); this.loading.clear()
    if (this.context) void this.context.close().catch(() => {})
    this.context = null; this.gain = null
  }
}
export const audioManager = new AudioManager()
