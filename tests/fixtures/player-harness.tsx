// Presentation fixture only; creates no Auth sessions or test accounts.
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router'
import LeaderboardPage from '../../src/features/phase4/LeaderboardPage'
import PublicProfilePage from '../../src/features/phase4/PublicProfilePage'
import '../../src/styles/index.css'
import '../../src/styles/phase4.css'
createRoot(document.getElementById('root')!).render(<MemoryRouter initialEntries={['/leaderboard']}><Routes><Route path="/leaderboard" element={<LeaderboardPage/>}/><Route path="/players/:username" element={<PublicProfilePage/>}/></Routes></MemoryRouter>)
