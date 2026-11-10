import { useCallback, useEffect, useRef } from 'react'
import { audioManager } from '../audio/manager'
import type { Sound } from '../audio/manager'
import type { RoomSnapshot } from '../multiplayer/types'
import { EventCursor } from './events'
import { useFeedback } from './feedback'
import { SKILLS, type CompletedUnit, type Skill } from './rules'

export function useBattleFeedback(snapshot: RoomSnapshot | null, userId: string) {
  const cursor = useRef(new EventCursor())
  const actions = useRef(new Set<string>())
  const room = useRef<string | null>(null)
  const consumeReply = useCallback((snapshot: RoomSnapshot) => {
    if (!snapshot.match) return
    const emit = useFeedback.getState().emit
    const action = snapshot.action
    if (action?.id && typeof action.cell === 'number' && !actions.current.has(action.id)) {
      actions.current.add(action.id)
      if (actions.current.size > 256) actions.current.delete(actions.current.values().next().value!)
      if (action.rejected) {
        audioManager.play('wrong_number', `wrong:${action.id}`)
        emit({ id: `wrong:${action.id}`, matchId: snapshot.match.id, kind: 'wrong', cell: action.cell, text: 'INCORRECT NUMBER', detail: 'Your confirmed board is unchanged.' })
      } else if (snapshot.board?.entries[action.cell]) audioManager.play('valid_number', `valid:${action.id}`)
    }
  }, [])
  useEffect(() => {
    if (!snapshot?.match) return
    if (room.current !== snapshot.room.id) { room.current = snapshot.room.id; cursor.current = new EventCursor(); actions.current.clear() }
    consumeReply(snapshot)
    const emit = useFeedback.getState().emit
    for (const event of cursor.current.accept(snapshot.events ?? [], snapshot.cursor, Date.parse(snapshot.server_now))) {
      const payload = event.payload
      if (event.match_id !== snapshot.match.id) continue
      if (event.kind === 'energy' && payload.actor_id === userId) {
        const units = payload.units as CompletedUnit[]
        const combo = Number(payload.combo)
        const cue: Sound = combo >= 3 ? 'combo_3' : combo === 2 ? 'combo_2' : units[0]?.kind === 'row' ? 'row_complete' : units[0]?.kind === 'column' ? 'column_complete' : 'box_complete'
        audioManager.play(cue, `unit:${event.sequence}`); audioManager.play('energy_gain', `energy:${event.sequence}`)
        emit({ id: `event:${event.sequence}`, matchId: snapshot.match.id, kind: 'energy', units, text: combo >= 2 ? `COMBO ×${combo}` : `${units[0]?.kind.toUpperCase()} COMPLETE`, detail: `+${payload.stored} ENERGY${Number(payload.stored) < Number(payload.generated) ? ' · CAP REACHED' : ''}` })
      }
      if (event.kind !== 'cast' && event.kind !== 'shield_block') continue
      const skill = payload.skill as Skill
      if (!SKILLS.includes(skill)) continue
      const outgoing = payload.actor_id === userId
      const incoming = payload.target_id === userId && !outgoing
      if (outgoing) {
        audioManager.play('energy_spend', `spend:${event.sequence}`)
        audioManager.play(skill === 'shield' ? 'shield_activate' : `${skill}_cast`, `cast:${event.sequence}`)
        emit({ id: `event:${event.sequence}`, matchId: snapshot.match.id, kind: 'cast', skill, text: skill === 'shield' ? 'SHIELD ACTIVE' : `${skill.toUpperCase()} SENT!`, detail: `−${payload.cost} ENERGY${payload.blocked ? ' · BLOCKED BY SHIELD' : ''}` })
      } else if (incoming) {
        audioManager.play(payload.blocked ? 'shield_block' : `${skill}_impact` as Sound, `impact:${event.sequence}`)
        emit({ id: `event:${event.sequence}`, matchId: snapshot.match.id, kind: payload.blocked ? 'block' : 'impact', skill: payload.blocked ? 'shield' : skill, text: payload.blocked ? 'ATTACK BLOCKED!' : skill === 'freeze' ? 'FROZEN!' : skill === 'scramble' ? 'SCRAMBLED!' : 'FOG ATTACK!', detail: payload.blocked ? 'Your shield absorbed the hit.' : 'Temporary effect · puzzle remains intact' })
      }
    }
  }, [snapshot, userId, consumeReply])
  return consumeReply
}
