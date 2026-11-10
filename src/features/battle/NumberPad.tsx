import { useLayoutEffect, useRef } from 'react'
import { useReducedMotion } from '../audio/useReducedMotion'

export function NumberPad({ digits, disabled, place }: { digits: number[]; disabled: boolean; place: (digit: number) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const previous = useRef(new Map<number, DOMRect>())
  const reduced = useReducedMotion()
  const order = digits.join(',')
  useLayoutEffect(() => {
    const animations: Animation[] = []
    ref.current?.querySelectorAll<HTMLButtonElement>('button').forEach((button) => {
      const digit = Number(button.dataset.digit), bounds = button.getBoundingClientRect(), old = previous.current.get(digit)
      if (old && !reduced && typeof button.animate === 'function' && (old.x !== bounds.x || old.y !== bounds.y)) animations.push(button.animate([{ transform: `translate(${old.x - bounds.x}px, ${old.y - bounds.y}px)` }, { transform: 'translate(0,0)' }], { duration: 250, easing: 'cubic-bezier(.2,.7,.2,1)' }))
      previous.current.set(digit, bounds)
    })
    return () => { for (const animation of animations) animation.cancel() }
  }, [order, reduced])
  return <div ref={ref} className="number-pad battle-number-pad" aria-label="Number controls">{digits.map((digit) => <button key={digit} data-digit={digit} disabled={disabled} onClick={() => place(digit)} aria-label={`Enter ${digit}`}>{digit}</button>)}</div>
}
