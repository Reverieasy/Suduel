import { describe, expect, it } from 'vitest'
import { registrationError, safeNext } from './validation'

describe('Account validation', () => {
  it('accepts arbitrary valid email addresses and valid usernames', () => {
    const email = `${crypto.randomUUID()}@test.example`
    expect(registrationError('Player_123', email, 'PuzzleRace2026', 'PuzzleRace2026')).toBeNull()
    expect(registrationError('bad name', email, 'PuzzleRace2026', 'PuzzleRace2026')).toMatch(/username/)
    expect(registrationError('Valid_name', 'invalid', 'PuzzleRace2026', 'PuzzleRace2026')).toMatch(/email/)
    expect(registrationError('Valid_name', email, 'short', 'short')).toMatch(/10 characters/)
    expect(registrationError('Valid_name', email, 'PuzzleRace2026', 'different')).toMatch(/do not match/)
  })
  it('only allows local redirect targets', () => {
    expect(safeNext('/room/ABC12345')).toBe('/room/ABC12345')
    for (const value of [null, 'https://example.com', '//example.com', '/\\example.com', '/\n/example.com']) expect(safeNext(value)).toBe('/play')
  })
})
