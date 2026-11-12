import { useEffect, useRef } from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import { usePreferences } from './preferences'

const START_MUSIC = 'suduel:start-background-music'

export function BackgroundMusic() {
  const element = useRef<HTMLAudioElement>(null), interacted = useRef(false)
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
    const start = () => { interacted.current=true; sync() }
    document.addEventListener(START_MUSIC,start)
    const unsubscribe=usePreferences.subscribe((next,previous) => {
      if(next.sound!==previous.sound || next.homeMusic!==previous.homeMusic || next.masterVolume!==previous.masterVolume)sync()
    })
    sync()
    return () => {
      disposed=true; unsubscribe()
      document.removeEventListener('pointerdown',gesture); document.removeEventListener('keydown',gesture); document.removeEventListener('visibilitychange',sync)
      document.removeEventListener(START_MUSIC,start)
      audio.pause(); audio.removeAttribute('src'); audio.load()
    }
  },[])
  return <audio ref={element} loop preload="none" aria-hidden="true" data-testid="background-music" onPlay={() => usePreferences.setState({musicPlaying:true})} onPause={() => usePreferences.setState({musicPlaying:false})}/>
}

export function MusicToggle() {
  const enabled=usePreferences((s)=>s.sound&&s.homeMusic), playing=usePreferences((s)=>s.musicPlaying), update=usePreferences((s)=>s.update)
  return <button className="home-music-control" data-home-music-control aria-label={enabled&&playing?'Mute background music':'Play background music'} aria-pressed={enabled&&playing} onClick={() => { update(enabled&&playing ? {homeMusic:false} : {homeMusic:true,sound:true}); document.dispatchEvent(new Event(START_MUSIC)) }}>{enabled&&playing?<Volume2 size={15}/>:<VolumeX size={15}/>}<span>{enabled&&playing?'MUSIC ON':'PLAY MUSIC'}</span></button>
}
