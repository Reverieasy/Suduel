import { Modal } from '../../components/Modal'
import { usePreferences } from './preferences'
import { audioManager } from './manager'

export function AudioSettings({ onClose }: { onClose: () => void }) {
  const settings = usePreferences()
  return <Modal title="SOUND & ACCESSIBILITY" onClose={onClose} mobileSheet><div className="game-settings">
    <label className="toggle-setting"><span>Game sound</span><input type="checkbox" checked={settings.sound} onChange={(e) => { settings.update({ sound: e.target.checked }); if (e.target.checked) audioManager.unlock() }} /></label>
    <label className="toggle-setting"><span>Homepage music</span><input type="checkbox" checked={settings.homeMusic} onChange={(e) => settings.update({ homeMusic: e.target.checked })} /></label>
    <label>MASTER VOLUME <output>{Math.round(settings.masterVolume * 100)}%</output><input aria-label="Master volume" type="range" min="0" max="1" step="0.05" value={settings.masterVolume} onChange={(e) => settings.update({ masterVolume: Number(e.target.value) })} /></label>
    <label>EFFECTS VOLUME <output>{Math.round(settings.effectsVolume * 100)}%</output><input aria-label="Effects volume" type="range" min="0" max="1" step="0.05" value={settings.effectsVolume} onChange={(e) => settings.update({ effectsVolume: Number(e.target.value) })} /></label>
    <label className="toggle-setting"><span>Countdown sounds</span><input type="checkbox" checked={settings.countdownSound} onChange={(e) => settings.update({ countdownSound: e.target.checked })} /></label>
    <label className="toggle-setting"><span>Reduce motion</span><input type="checkbox" checked={settings.reducedMotion} onChange={(e) => settings.update({ reducedMotion: e.target.checked })} /></label>
    <label className="toggle-setting"><span>Light impact shake</span><input type="checkbox" checked={settings.screenShake} disabled={settings.reducedMotion} onChange={(e) => settings.update({ screenShake: e.target.checked })} /></label>
    <button className="button button-outline" disabled={!settings.sound} onClick={() => { audioManager.unlock(); audioManager.play('row_complete') }}>PREVIEW SOUND</button>
    <p>System reduced-motion preferences are always respected. Muting takes effect immediately. Sound starts after your first interaction and stays quiet in background tabs.</p>
    {settings.storageWarning && <p role="status">Browser storage is unavailable. These preferences will not survive a reload.</p>}
  </div></Modal>
}
