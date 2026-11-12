export function FreezeAtmosphere({ active }: { active: boolean }) {
  if(!active)return null
  return <div className="freeze-screen" data-screen-effect="freeze" aria-hidden="true"><div className="freeze-screen-frost"/><div className="freeze-screen-glint"/></div>
}
