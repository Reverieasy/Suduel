import { generatePuzzle, type Difficulty } from './engine'

self.onmessage = (event: MessageEvent<Difficulty>) => {
  try { self.postMessage({ puzzle: generatePuzzle(event.data) }) }
  catch { self.postMessage({ error: 'The puzzle could not be generated. Please try again.' }) }
}
