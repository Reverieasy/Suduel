export function Avatar({ name, url, opponent = false }: { name: string; url?: string | null; opponent?: boolean }) {
  return <span className={`player-avatar${opponent ? ' opponent-avatar' : ''}`} aria-hidden="true">{url ? <img src={url} alt="" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.style.display = 'none' }} /> : null}<span>{name.slice(0, 2).toUpperCase()}</span></span>
}
