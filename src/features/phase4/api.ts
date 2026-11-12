import type { SupabaseClient } from '@supabase/supabase-js'
import { requireBackend } from '../../lib/supabase'

const client = () => requireBackend() as unknown as SupabaseClient
export type AccountSummary = { username: string; display_name: string; avatar_url: string | null }
export type LeaderboardEntry = { user_id: string; rating: number; rank_tier: string; ranked_matches: number; profiles: AccountSummary | null }

export async function loadLocker(userId: string) {
  const db = client()
  const [items, inventory, equipped] = await Promise.all([
    db.from('cosmetic_items').select('*').order('category').order('name'),
    db.from('player_inventory').select('item_id').eq('user_id', userId),
    db.from('player_equipped_cosmetics').select('*').eq('user_id', userId).maybeSingle(),
  ])
  if (items.error || inventory.error || equipped.error) throw new Error('The locker could not be loaded.')
  return { items: items.data ?? [], owned: new Set((inventory.data ?? []).map((item) => item.item_id)), equipped: equipped.data }
}

export async function equipCosmetic(itemId: string) {
  const { error } = await client().rpc('equip_cosmetic', { p_item: itemId })
  if (error) throw new Error(error.message)
}

export async function loadLeaderboard() {
  const { data, error } = await client().from('player_ratings').select('user_id,rating,rank_tier,ranked_matches,current_streak,best_streak,profiles!inner(username,display_name,avatar_url)').order('rating', { ascending: false }).range(0, 99).overrideTypes<LeaderboardEntry[], {merge:false}>()
  if (error) throw new Error('The leaderboard could not be loaded.')
  return data ?? []
}

export async function loadFeed() {
  const { data, error } = await client().from('community_posts').select('*,profiles(username,display_name,avatar_url),post_reactions(user_id),post_comments(id,body,created_at,author_id,profiles(username,display_name))').is('deleted_at', null).order('created_at', { ascending: false }).range(0, 19)
  if (error) throw new Error('The community feed could not be loaded.')
  return data ?? []
}

export async function createPost(kind: string, body: string) {
  const { error } = await client().rpc('create_community_post', { p_kind: kind, p_body: body, p_match: null, p_achievement: null })
  if (error) throw new Error(error.message)
}

export async function toggleReaction(postId: string, userId: string, reacted: boolean) {
  const db = client()
  const result = reacted ? await db.from('post_reactions').delete().eq('post_id', postId).eq('user_id', userId) : await db.from('post_reactions').insert({ post_id: postId, user_id: userId })
  if (result.error) throw new Error(result.error.message)
}
