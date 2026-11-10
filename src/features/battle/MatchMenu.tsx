import { Modal } from '../../components/Modal'

export function MatchMenu({ onClose, onSound, onGuide, onForfeit, active }: { onClose: () => void; onSound: () => void; onGuide: () => void; onForfeit: () => void; active: boolean }) {
  return <Modal title="MATCH MENU" onClose={onClose} mobileSheet><p>The clock and active effects continue while this menu is open.</p><div className="match-menu-actions"><button className="button" onClick={onClose}>RETURN TO MATCH</button><button className="button button-outline" onClick={onGuide}>SKILL GUIDE</button><button className="button button-outline" onClick={onSound}>SOUND & ACCESSIBILITY</button>{active && <button className="quiet-button red" onClick={onForfeit}>FORFEIT MATCH</button>}</div></Modal>
}
