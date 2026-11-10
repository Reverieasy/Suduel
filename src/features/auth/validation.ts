export function safeNext(value: string | null): string {
  return value?.startsWith('/') && !value.startsWith('//') && !Array.from(value).some((character) => character === '\\' || character.charCodeAt(0) <= 32 || character.charCodeAt(0) === 127) ? value : '/play'
}
export function registrationError(username: string, email: string, password: string, confirmation: string): string | null {
  if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) return 'Use 3–20 letters, numbers, or underscores for your username.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Enter a valid email address.'
  if (password.length < 10 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) return 'Use at least 10 characters with an uppercase letter, lowercase letter, and number.'
  if (password !== confirmation) return 'Your passwords do not match.'
  return null
}
