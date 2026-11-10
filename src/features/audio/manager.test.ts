import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { AudioManager } from './manager'
import { DEFAULT_PREFERENCES, usePreferences } from './preferences'

const sources: { start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> }[] = []
const volume = vi.fn(), close = vi.fn(async () => {})
let manager: AudioManager, clock = 0
class Context {
  state = 'running'; currentTime = 0; destination = {}
  createGain() { return { connect: vi.fn(), gain: { setTargetAtTime: volume } } }
  decodeAudioData() { return Promise.resolve({ duration: .1 }) }
  createBufferSource() { const source = { buffer: null, connect: vi.fn(), disconnect: vi.fn(), onended: null, start: vi.fn(), stop: vi.fn() }; sources.push(source); return source }
  close = close
}
beforeEach(() => {
  sources.length = 0; clock = 0; volume.mockClear(); close.mockClear()
  usePreferences.setState(DEFAULT_PREFERENCES)
  vi.stubGlobal('AudioContext', Context); vi.stubGlobal('document', { hidden: false })
  vi.stubGlobal('fetch',vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(1) })))
  vi.spyOn(performance,'now').mockImplementation(() => clock)
  manager = new AudioManager()
})
afterEach(() => { manager.dispose(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

it('does not initialize or play before a user gesture; caches preloads after unlock', async () => {
  manager.play('valid_number'); expect(fetch).not.toHaveBeenCalled()
  manager.unlock(); await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(29))
  manager.unlock(); manager.play('valid_number','accepted')
  await vi.waitFor(() => expect(sources).toHaveLength(1))
  manager.play('valid_number','accepted'); clock = 1000; manager.play('valid_number','accepted')
  await Promise.resolve(); expect(sources).toHaveLength(1); expect(fetch).toHaveBeenCalledTimes(29)
})
it('caps overlap at five voices and stops every active source immediately on mute', async () => {
  manager.unlock(); await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(29))
  for (let i = 0; i < 6; i++) { clock+=100; manager.play('fog_impact',`cast:${i}`); await vi.waitFor(() => expect(sources).toHaveLength(i+1)) }
  expect(sources[0].stop).toHaveBeenCalledOnce()
  usePreferences.setState({ sound: false }); manager.updateVolume()
  expect(sources.every((source) => source.stop.mock.calls.length === 1)).toBe(true)
  expect(volume).toHaveBeenLastCalledWith(0,0,.01)
  manager.play('fog_impact','muted'); await Promise.resolve(); expect(sources).toHaveLength(6)
})
it('suppresses background and disabled countdown cues, but keeps other gameplay cues', async () => {
  manager.unlock(); await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(29))
  usePreferences.setState({ countdownSound: false })
  manager.play('tick'); manager.play('warning'); manager.play('countdown')
  vi.stubGlobal('document', { hidden: true }); manager.play('wrong_number')
  await Promise.resolve(); expect(sources).toHaveLength(0)
  vi.stubGlobal('document', { hidden: false }); manager.play('wrong_number','rejected')
  await vi.waitFor(() => expect(sources).toHaveLength(1))
})
it.each(['mute','background','dispose'])('does not play a cue that finishes loading after %s', async (condition) => {
  let release!: (value: { duration: number }) => void
  vi.spyOn(Context.prototype,'decodeAudioData').mockImplementation(() => new Promise((resolve) => { release = resolve }) as Promise<{ duration: number }>)
  manager.unlock(); manager.play('draw','late')
  await vi.waitFor(() => expect(release).toBeTypeOf('function'))
  if (condition === 'mute') usePreferences.setState({ sound: false })
  if (condition === 'background') vi.stubGlobal('document', { hidden: true })
  if (condition === 'dispose') manager.dispose()
  release({ duration: .1 }); await Promise.resolve(); await Promise.resolve()
  expect(sources).toHaveLength(0)
  manager.dispose(); expect(close).toHaveBeenCalled()
})
