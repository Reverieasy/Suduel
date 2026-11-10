import { useEffect, useRef, useState } from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import { usePreferences } from './preferences'

export function HomeAmbience() {
  const element = useRef<HTMLAudioElement>(null), interacted = useRef(false)
  const [playing,setPlaying] = useState(false)
  const enabled = usePreferences((s) => s.sound && s.homeMusic)
  const update = usePreferences((s) => s.update)
  useEffect(() => {
    const audio=element.current!
    let disposed=false
    audio.src='/audio/ambience/home-loop.wav'
    interacted.current=navigator.userActivation?.hasBeenActive ?? false
    const sync = () => {
      const settings=usePreferences.getState()
      audio.volume=settings.masterVolume*.18
      if(disposed || document.hidden || !interacted.current || !settings.sound || !settings.homeMusic) { audio.pause(); return }
      void audio.play().then(() => {
        const current=usePreferences.getState()
        if(disposed || document.hidden || !current.sound || !current.homeMusic)audio.pause()
      }).catch(() => { /* Browser autoplay restrictions never block the page. */ })
    }
    const gesture = (event: Event) => {
      if(event.target instanceof Element && event.target.closest('[data-home-music-control]'))return
      interacted.current=true; sync()
    }
    document.addEventListener('pointerdown',gesture,{passive:true})
    document.addEventListener('keydown',gesture)
    document.addEventListener('visibilitychange',sync)
    const unsubscribe=usePreferences.subscribe(sync)
    sync()
    return () => {
      disposed=true; unsubscribe()
      document.removeEventListener('pointerdown',gesture); document.removeEventListener('keydown',gesture); document.removeEventListener('visibilitychange',sync)
      audio.pause(); audio.removeAttribute('src'); audio.load()
    }
  },[])
  return <><audio ref={element} loop preload="none" aria-hidden="true" data-testid="home-ambience" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}/><button className="home-music-control" data-home-music-control aria-label={enabled&&playing?'Mute homepage music':'Play homepage music'} aria-pressed={enabled&&playing} onClick={() => { interacted.current=true; update(enabled&&playing ? {homeMusic:false} : {homeMusic:true,sound:true}) }}>{enabled&&playing?<Volume2 size={15}/>:<VolumeX size={15}/>}<span>{enabled&&playing?'MUSIC ON':'PLAY MUSIC'}</span></button></>
}
