export interface GameEvent {
  sequence: number; match_id: string | null; kind: string; created_at: string
  payload: Record<string, unknown>
}

/** Never replay historical impacts on first mount or after a long recovery. */
export class EventCursor {
  private cursor: number | null = null
  accept(events: GameEvent[], latest: number, serverNow: number): GameEvent[] {
    if (this.cursor === null) { this.cursor = latest; return [] }
    const previous = this.cursor
    this.cursor = Math.max(this.cursor, latest)
    return events.filter((event) => event.sequence > previous && event.sequence <= latest && serverNow - Date.parse(event.created_at) < 2000 && serverNow >= Date.parse(event.created_at) - 100).sort((a, b) => a.sequence - b.sequence)
  }
}

/** Bounded deduplication and cooldowns for audio and one-shot feedback. */
export class CueGate {
  private ids = new Set<string>()
  private last = new Map<string, number>()
  allow(cue: string, id: string | undefined, now: number, cooldownMs = 60): boolean {
    if (id && this.ids.has(id)) return false
    if (id) { this.ids.add(id); if (this.ids.size > 512) this.ids.delete(this.ids.values().next().value!) }
    if (now - (this.last.get(cue) ?? -Infinity) < cooldownMs) return false
    this.last.set(cue, now)
    return true
  }
}
