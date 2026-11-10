import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { ArrowLeft, ArrowRight, Users } from 'lucide-react'
import { roomCommand } from './api'

export default function CreateRoom() {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(null)
    const fields = new FormData(event.currentTarget)
    try {
      const snapshot = await roomCommand('create', { difficulty: String(fields.get('difficulty')), time_limit: Number(fields.get('time_limit')) })
      navigate(`/room/${snapshot.room.code}`)
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not create the room.') }
    finally { setBusy(false) }
  }
  function join(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const code = String(new FormData(event.currentTarget).get('code')).trim().toUpperCase()
    if (!/^[A-F0-9]{8}$/.test(code)) { setError('Enter the eight-character room code.'); return }
    navigate(`/room/${code}`)
  }
  return <div className="container page-content"><header className="page-heading"><Link to="/play" className="back-link"><ArrowLeft size={14} /> ALL MODES</Link><h1>PRIVATE MATCH</h1><p>Two players. One puzzle. Create a Classic Race or join a friend.</p></header><div className="room-setup-grid">
    <section className="panel room-setup"><Users className="yellow" size={36} /><h2>CREATE YOUR ROOM</h2><p>Standard 9×9 Sudoku. Both players receive the same unique puzzle.</p><form onSubmit={create}><fieldset disabled={busy} className="auth-fields"><label>DIFFICULTY<select name="difficulty" defaultValue="easy"><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></label><label>TIME LIMIT<select name="time_limit" defaultValue="300"><option value="180">3 minutes</option><option value="300">5 minutes</option><option value="600">10 minutes</option></select></label><button className="button" type="submit">{busy ? 'CREATING…' : 'CREATE ROOM'} <ArrowRight size={16} /></button></fieldset></form></section>
    <section className="panel room-setup"><h2>GOT AN INVITE?</h2><p>Enter your friend’s room code. An invitation link opens the lobby directly.</p><form className="auth-fields" onSubmit={join}><label>ROOM CODE<input name="code" placeholder="A1B2C3D4" required minLength={8} maxLength={8} pattern="[a-fA-F0-9]{8}" autoComplete="off" className="code-input" /></label><button className="button button-outline" type="submit">JOIN ROOM <ArrowRight size={16} /></button></form><p className="hint-note">Your email must be verified to play. Private rooms expire after two hours.</p></section>
  </div>{error && <p className="form-error" role="alert">{error}</p>}</div>
}
