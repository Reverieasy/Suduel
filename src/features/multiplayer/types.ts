import type { Database } from '../../types/database'
type Row<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export interface RoomPlayer { user_id: string; seat: number; ready: boolean; last_seen: string; username: string; display_name: string; avatar_url: string | null }
export interface RoomSnapshot {
  server_now: string; room: Row<'game_rooms'>; players: RoomPlayer[]
  match: Row<'game_matches'> | null; progress: Row<'match_players'>[]
  board: { entries: number[]; version: number } | null
  cursor: number; action?: { rejected?: boolean; message?: string }
}
export function progressPercent(cells: number, clues: number[]): number {
  const total = clues.filter((n) => n === 0).length
  return total ? Math.round(cells / total * 100) : 0
}
