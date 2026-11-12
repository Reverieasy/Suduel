import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router'
import { Shell } from './app/Shell'
import { Landing } from './features/marketing/Landing'
import { Modes } from './features/marketing/Modes'
import { Features, HowToPlay, NotFound } from './features/marketing/InfoPages'
import { AuthPage } from './features/auth/AuthPage'
import { AuthCallback } from './features/auth/AuthCallback'
import { RequireAuth } from './features/auth/RequireAuth'
import { OnlinePlayersPresence } from './features/presence/OnlinePlayers'

const Practice = lazy(() => import('./features/sudoku/Practice'))
const CreateRoom = lazy(() => import('./features/multiplayer/CreateRoom'))
const RoomPage = lazy(() => import('./features/multiplayer/RoomPage'))
const ProfilePage = lazy(() => import('./features/profiles/ProfilePage'))
const LockerPage = lazy(() => import('./features/phase4/LockerPage'))
const LeaderboardPage = lazy(() => import('./features/phase4/LeaderboardPage'))
const CommunityPage = lazy(() => import('./features/phase4/CommunityPage'))
const PublicProfilePage = lazy(() => import('./features/phase4/PublicProfilePage'))
const RankedPage = lazy(() => import('./features/ranked/RankedPage'))

export default function App() {
  return <BrowserRouter><OnlinePlayersPresence/><Routes><Route element={<Shell />}>
    <Route index element={<Landing />} />
    <Route path="play" element={<Modes />} />
    <Route path="practice" element={<Suspense fallback={<div role="status" className="empty-state">Loading practice…</div>}><Practice /></Suspense>} />
    <Route path="how-to-play" element={<HowToPlay />} />
    <Route path="features" element={<Features />} />
    <Route path="login" element={<AuthPage />} />
    <Route path="register" element={<AuthPage mode="register" />} />
    <Route path="forgot-password" element={<AuthPage mode="forgot" />} />
    <Route path="reset-password" element={<AuthPage mode="reset" />} />
    <Route path="auth/callback" element={<AuthCallback />} />
    <Route element={<RequireAuth />}>
      <Route path="rooms/new" element={<Suspense fallback={<div className="empty-state" role="status">Loading rooms…</div>}><CreateRoom /></Suspense>} />
      <Route path="room/:code" element={<Suspense fallback={<div className="empty-state" role="status">Loading room…</div>}><RoomPage /></Suspense>} />
      <Route path="profile" element={<Suspense fallback={<div className="empty-state" role="status">Loading profile…</div>}><ProfilePage /></Suspense>} />
      <Route path="locker" element={<Suspense fallback={<div className="empty-state" role="status">Loading locker…</div>}><LockerPage /></Suspense>} />
      <Route path="leaderboard" element={<Suspense fallback={<div className="empty-state" role="status">Loading leaderboard…</div>}><LeaderboardPage /></Suspense>} />
      <Route path="community" element={<Suspense fallback={<div className="empty-state" role="status">Loading community…</div>}><CommunityPage /></Suspense>} />
      <Route path="players/:username" element={<Suspense fallback={<div className="empty-state" role="status">Loading player…</div>}><PublicProfilePage /></Suspense>} />
      <Route path="ranked" element={<Suspense fallback={<div className="empty-state" role="status">Loading ranked matchmaking…</div>}><RankedPage /></Suspense>} />
    </Route>
    <Route path="*" element={<NotFound />} />
  </Route></Routes></BrowserRouter>
}
