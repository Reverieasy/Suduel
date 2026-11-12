import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Avatar } from '../../components/Avatar'
import { loadLeaderboard, type LeaderboardEntry } from './api'

export default function LeaderboardPage() {
  const [entries,setEntries]=useState<LeaderboardEntry[]>([]), [loading,setLoading]=useState(true), [error,setError]=useState<string|null>(null)
  useEffect(()=> {
    let active=true
    void loadLeaderboard().then(data=>{if(active)setEntries(data.filter(entry=>entry.profiles?.username))}).catch(failure=>{if(active)setError(failure instanceof Error?failure.message:'Leaderboard unavailable.')}).finally(()=>{if(active)setLoading(false)})
    return ()=>{active=false}
  },[])
  return <div className="container page-content phase4-page"><div className="page-heading"><span className="eyebrow blue">SEASON 01 / LIVE</span><h1>LEADERBOARD</h1><p>Climb the ratings. Every placement comes from verified ranked results.</p></div><div className="leaderboard-panel panel"><div className="section-heading"><h2>GLOBAL RANKING</h2><span className="badge yellow">TOP 100</span></div>{error&&<p className="form-error" role="alert">{error}</p>}{loading?<p role="status">Loading rankings…</p>:<div className="leaderboard-list">{entries.map((entry,index)=> {
    const player=entry.profiles
    if(!player)return null
    return <Link className="leaderboard-row" to={`/players/${encodeURIComponent(player.username)}`} key={entry.user_id}><strong className={index<3?'yellow':''}>#{index+1}</strong><Avatar name={player.username} url={player.avatar_url}/><span className="leaderboard-player"><b>@{player.username}</b><small>{player.display_name&&player.display_name!==player.username?`${player.display_name} · `:''}{entry.ranked_matches} ranked matches</small></span><span className={`badge ${entry.rank_tier==='Legend'||entry.rank_tier==='Master'?'yellow':'blue'}`}>{entry.rank_tier.toUpperCase()}</span><strong className="leaderboard-rating">{entry.rating}</strong></Link>
  })}{!error&&!entries.length&&<p>No ranked players yet.</p>}</div>}</div></div>
}
