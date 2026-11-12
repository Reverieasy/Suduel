import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { Avatar } from '../../components/Avatar'
import { requireBackend } from '../../lib/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'

type Profile = { id: string; username: string; display_name: string; avatar_url: string | null; bio: string | null }
type Rating = { rating: number; rank_tier: string; ranked_matches: number; current_streak: number; best_streak: number }

export default function PublicProfilePage() {
  const { username } = useParams()
  const [result,setResult] = useState<{username:string;profile:Profile|null;rating:Rating|null;error:string|null}|null>(null)
  const current=result?.username===username?result:null
  const profile=current?.profile, rating=current?.rating, error=current?.error
  useEffect(() => {
    let active=true
    async function load() {
      if (!username) return
      const client = requireBackend() as unknown as SupabaseClient
      const profileResult = await client.from('profiles').select('id,username,display_name,avatar_url,bio').eq('username', username).maybeSingle()
      if(profileResult.error)throw new Error('Could not load this player.')
      if (!profileResult.data) { if(active)setResult({username,profile:null,rating:null,error:'Player not found.'}); return }
      const ratingResult = await client.from('player_ratings').select('rating,rank_tier,ranked_matches,current_streak,best_streak').eq('user_id', profileResult.data.id).maybeSingle()
      if(active)setResult({username,profile:profileResult.data,rating:ratingResult.data,error:null})
    }
    void load().catch(() => {if(active&&username)setResult({username,profile:null,rating:null,error:'Could not load this player.'})})
    return ()=>{active=false}
  }, [username])
  if (error) return <div className="container page-content"><p className="form-error">{error}</p><Link to="/leaderboard" className="button">BACK TO LEADERBOARD</Link></div>
  if (!profile) return <div className="container page-content"><p role="status">Loading player…</p></div>
  return <div className="container page-content phase4-page"><div className="public-profile panel"><Avatar name={profile.username} url={profile.avatar_url}/><div><span className="eyebrow blue">PLAYER PROFILE</span><h1>{profile.display_name}</h1><p className="profile-handle">@{profile.username}</p><p>{profile.bio || 'Ready for the next grid.'}</p></div><Link to="/leaderboard" className="button button-outline">LEADERBOARD</Link></div><div className="profile-stats phase4-stats"><div><span className="eyebrow">RATING</span><strong>{rating?.rating ?? '—'}</strong></div><div><span className="eyebrow">RANK</span><strong>{rating?.rank_tier ?? 'UNRANKED'}</strong></div><div><span className="eyebrow">MATCHES</span><strong>{rating?.ranked_matches ?? 0}</strong></div><div><span className="eyebrow">BEST STREAK</span><strong>{rating?.best_streak ?? 0}</strong></div></div></div>
}
