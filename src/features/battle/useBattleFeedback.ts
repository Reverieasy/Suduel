import { useCallback, useEffect, useRef } from 'react'
import { audioManager } from '../audio/manager'
import type { Sound } from '../audio/manager'
import type { RoomSnapshot } from '../multiplayer/types'
import { EventCursor } from './events'
import { useFeedback } from './feedback'
import { SKILLS, DEFAULT_PRESSURE_RULES, type CompletedUnit, type Skill } from './rules'

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
      if (action.rejected && action.counted !== false) {
        audioManager.play('wrong_number', `wrong:${action.id}`)
        const pressure = snapshot.events?.find((e) => e.kind==='mistake_pressure'&&e.payload.action_id===action.id&&e.payload.break)
        emit({ id: `wrong:${action.id}`, matchId: snapshot.match.id, actorId: userId, kind: 'wrong', cell: action.cell, text: pressure ? `MISTAKE ×${snapshot.battle?.series.rules.mistakePressure?.threshold ?? DEFAULT_PRESSURE_RULES.threshold}` : 'INCORRECT NUMBER', detail: pressure ? Number(pressure.payload.stored)>0 ? `OPPONENT +${pressure.payload.stored} ENERGY` : 'BONUS CAP REACHED' : 'Your confirmed board is unchanged.' })
      } else if (!action.rejected && !action.ignored && snapshot.board?.entries[action.cell]) audioManager.play('valid_number', `valid:${action.id}`)
    }
  }, [userId])
  useEffect(() => {
    if (!snapshot?.match) return
    if (room.current !== snapshot.room.id) { room.current = snapshot.room.id; cursor.current = new EventCursor(); actions.current.clear() }
    consumeReply(snapshot)
    const emit = useFeedback.getState().emit
    for (const event of cursor.current.accept(snapshot.events ?? [], snapshot.cursor, Date.parse(snapshot.server_now))) {
      const payload = event.payload
      if (event.match_id !== snapshot.match.id) continue
      if (event.kind === 'mistake_pressure' && payload.break) {
        const own = payload.actor_id === userId, stored = Number(payload.stored)
        audioManager.play('pressure_break', `pressure:${event.sequence}`)
        emit({ id: `event:${event.sequence}`, matchId: snapshot.match.id, kind: 'pressure', actorId: String(payload.actor_id), targetId: String(payload.target_id), mistakeTotal: Number(payload.genuine_mistakes), stored,
          text: `${own ? '' : 'RIVAL '}MISTAKE ×${snapshot.battle?.series.rules.mistakePressure?.threshold ?? DEFAULT_PRESSURE_RULES.threshold}`, detail: stored > 0 ? `${own ? 'OPPONENT' : 'YOU'} +${stored} ENERGY` : Number(payload.generated) > 0 ? 'ENERGY CAP REACHED · BONUS DISCARDED' : 'MISTAKE BONUS LIMIT REACHED' })
      }
      if (event.kind === 'energy') {
        const units = payload.units as CompletedUnit[]
        const combo = Number(payload.combo)
        const cue: Sound = combo >= 3 ? 'combo_3' : combo === 2 ? 'combo_2' : units[0]?.kind === 'row' ? 'row_complete' : units[0]?.kind === 'column' ? 'column_complete' : 'box_complete'
        if(payload.actor_id===userId) { audioManager.play(cue, `unit:${event.sequence}`); audioManager.play('energy_gain', `energy:${event.sequence}`) }
        emit({ id: `event:${event.sequence}`, matchId: snapshot.match.id, actorId: String(payload.actor_id), kind: 'energy', units, text: `${payload.actor_id===userId?'':'RIVAL '}${combo >= 2 ? `COMBO ×${combo}` : `${units[0]?.kind.toUpperCase()} COMPLETE`}`, detail: `+${payload.stored} ENERGY${Number(payload.stored) < Number(payload.generated) ? ' · CAP REACHED' : ''}` })
      }
      if (event.kind !== 'cast' && event.kind !== 'shield_block') continue
      const skill = payload.skill as Skill
      if (!SKILLS.includes(skill)) continue
      const outgoing = payload.actor_id === userId
      const incoming = payload.target_id === userId && !outgoing
      if (outgoing) {
        audioManager.play('energy_spend', `spend:${event.sequence}`)
        audioManager.play(skill === 'shield' ? 'shield_activate' : `${skill}_cast`, `cast:${event.sequence}`)
        emit({ id: `event:${event.sequence}`, matchId: snapshot.match.id, actorId: userId, targetId: String(payload.target_id), blocked: !!payload.blocked, kind: 'cast', skill, text: skill === 'shield' ? 'SHIELD ACTIVE' : `${skill.toUpperCase()} SENT!`, detail: `−${payload.cost} ENERGY${payload.blocked ? ' · BLOCKED BY SHIELD' : ''}` })
      } else if (incoming) {
        audioManager.play(payload.blocked ? 'shield_block' : `${skill}_impact` as Sound, `impact:${event.sequence}`)
        emit({ id: `event:${event.sequence}`, matchId: snapshot.match.id, actorId: String(payload.actor_id), targetId: userId, kind: payload.blocked ? 'block' : 'impact', skill: payload.blocked ? 'shield' : skill, text: payload.blocked ? 'ATTACK BLOCKED!' : skill === 'freeze' ? 'FROZEN!' : skill === 'scramble' ? 'SCRAMBLED!' : 'FOG ATTACK!', detail: payload.blocked ? 'Your shield absorbed the hit.' : 'Temporary effect · puzzle remains intact' })
      }
    }
  }, [snapshot, userId, consumeReply])
  return consumeReply
}
