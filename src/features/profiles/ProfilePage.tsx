import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Avatar } from '../../components/Avatar'
import { requireBackend } from '../../lib/supabase'
import { useAuth } from '../auth/store'
import { formatTime } from '../sudoku/game'
import type { Database } from '../../types/database'

type Stats = Database['public']['Tables']['player_stats']['Row']
type Match = Database['public']['Tables']['game_matches']['Row']
type Series = Database['public']['Tables']['battle_series']['Row']
export default function ProfilePage() {
  const { session, profile, refreshProfile } = useAuth()
  const [stats, setStats] = useState<Stats | null>(null)
  const [matches, setMatches] = useState<Match[]>([])
  const [series, setSeries] = useState<Series[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const id = session?.user.id ?? ''
  useEffect(() => {
    let disposed = false
    async function load() {
      try {
        const client = requireBackend()
        const [statistics, participations] = await Promise.all([client.from('player_stats').select('*').eq('user_id', id).single(), client.from('match_players').select('match_id').eq('user_id', id).limit(1000)])
        if (statistics.error || participations.error) throw new Error('Your match history could not be loaded. Please refresh to try again.')
        const ids = participations.data.map((p) => p.match_id)
        const history = ids.length ? await client.from('game_matches').select('*').in('id', ids).eq('status', 'finished').order('completed_at', { ascending: false }).limit(30) : { data: [], error: null }
        if (history.error) throw history.error
        const seriesIds = [...new Set((history.data ?? []).flatMap((m) => m.series_id ? [m.series_id] : []))]
        const battles = seriesIds.length ? await client.from('battle_series').select('*').in('id', seriesIds).eq('status', 'finished').order('completed_at', { ascending: false }) : { data: [], error: null }
        if (battles.error) throw battles.error
        if (!disposed) { setStats(statistics.data); setMatches((history.data ?? []).filter((m) => m.mode === 'classic')); setSeries(battles.data ?? []) }
      } catch (failure) { if (!disposed) setError(failure instanceof Error ? failure.message : 'Profile could not load.') }
      finally { if (!disposed) setLoading(false) }
    }
    void load()
    return () => { disposed = true }
  }, [id])
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(null); setMessage(null)
    const fields = new FormData(event.currentTarget)
    const displayName = String(fields.get('display_name')).trim()
    const avatar = String(fields.get('avatar_url')).trim()
    if (!displayName || displayName.length > 40 || avatar && (!avatar.startsWith('https://') || avatar.length > 2048)) { setError('Use a display name of 1–40 characters and an optional HTTPS image URL.'); setBusy(false); return }
    try {
      const { error: updateError } = await requireBackend().from('profiles').update({ display_name: displayName, avatar_url: avatar || null }).eq('id', id)
      if (updateError) throw updateError
      await refreshProfile(); setMessage('Profile saved.')
    } catch { setError('Could not save your profile. Please try again.') }
    finally { setBusy(false) }
  }
  return <div className="container page-content"><header className="profile-header panel"><Avatar name={profile?.username ?? 'PLAYER'} url={profile?.avatar_url} /><div><span className="eyebrow blue">YOUR PLAYER IDENTITY</span><h1>{profile?.display_name ?? 'YOUR PROFILE'}</h1><p>@{profile?.username} · SUDUEL player</p></div><Link className="button" to="/rooms/new">PLAY A FRIEND</Link></header>
    {error && <p className="form-error" role="alert">{error}</p>}{message && <p className="form-success" role="status">{message}</p>}
    <div className="profile-stats">{[['MATCHES',stats?.total_matches],['WINS',stats?.wins],['LOSSES',stats?.losses],['DRAWS',stats?.draws],['AVERAGE FINISH',stats?.completed_puzzles ? formatTime(stats.total_completion_time / stats.completed_puzzles * 1000) : '—']].map(([label,value]) => <div className="panel" key={label}><strong>{loading ? '…' : value ?? 0}</strong><span className="eyebrow">{label}</span></div>)}</div>
    <div className="lobby-grid"><section className="panel history-panel"><h2>RECENT MATCHES</h2><p className="hint-note">Each Battle series counts as one match. Individual round results stay in the room.</p>{loading ? <p role="status">Loading match history…</p> : !matches.length && !series.length ? <p>No completed matches yet. Invite a friend to start your first race.</p> : <ul className="match-history">{[...matches, ...series].sort((a,b) => Date.parse(b.completed_at!) - Date.parse(a.completed_at!)).map((match) => <li key={match.id}><span className={`badge ${match.winner_id === id ? 'green' : !match.winner_id ? 'yellow' : 'red'}`}>{match.winner_id === id ? 'WIN' : !match.winner_id ? 'DRAW' : 'LOSS'}</span><div><strong>{'difficulty' in match ? `CLASSIC / ${match.difficulty.toUpperCase()}` : 'BATTLE / BEST OF THREE'} / {match.outcome?.toUpperCase()}</strong><p>{new Date(match.completed_at!).toLocaleString()}</p></div><span>{'ends_at' in match ? formatTime(Math.max(0, Math.min(Date.parse(match.completed_at!), Date.parse(match.ends_at)) - Date.parse(match.started_at))) : 'SERIES'}</span></li>)}</ul>}</section>
    <section className="panel room-settings"><h2>EDIT PROFILE</h2><p>Your username is fixed. Display name and avatar are cosmetic.</p><form onSubmit={save}><fieldset className="auth-fields" disabled={busy || !profile}><label>DISPLAY NAME<input name="display_name" key={profile?.display_name} defaultValue={profile?.display_name} required maxLength={40} /></label><label>AVATAR IMAGE URL<input name="avatar_url" key={profile?.avatar_url} defaultValue={profile?.avatar_url ?? ''} type="url" placeholder="https://… (optional)" maxLength={2048} /></label><button className="button" type="submit">{busy ? 'SAVING…' : 'SAVE PROFILE'}</button></fieldset></form></section></div>
  </div>
}
