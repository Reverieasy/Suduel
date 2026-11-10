export function Wordmark({ large = false }: { large?: boolean }) {
  return <span className={`wordmark${large ? ' wordmark-large' : ''}`} aria-label="SUDUEL">
    <span className="pixel-mark" aria-hidden="true"><i /><i /><i /><i /></span>
    <span aria-hidden="true">SU<span className="blue">DU</span><span className="red">EL</span></span>
  </span>
}
