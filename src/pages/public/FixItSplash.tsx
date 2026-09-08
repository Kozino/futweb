import { useEffect, useRef, useState, useCallback } from 'react'

type Scene = {
  id: number
  start: number
  end: number
  title: string
  description: string
  visual: string
  camera: string
  image: string
  audio?: string
  color: string
}

const SCENES: Scene[] = [
  { id: 1, start: 1, end: 8, title: "Messy Beginning", description: "Establish a playful outdoor car-wash/garage area. A small muddy car sits covered in dirt and splashes.", camera: "Wide establishing shot", visual: "Sunny outdoor garage, muddy toy car", image: "/storyboard/01-messy-beginning.png", audio: "/storyboard/audio/01-intro.mp3", color: "from-amber-200 to-orange-300" },
  { id: 2, start: 8, end: 11, title: "Muddy Car", description: "Kids notice the dirty car and look concerned/excited.", camera: "Medium shot", visual: "Kids reaction", image: "/storyboard/02-muddy-car.png", audio: "/storyboard/audio/01-intro.mp3", color: "from-brown-200 to-amber-300" },
  { id: 3, start: 11, end: 20, title: "Grab the Buckets", description: "Kids quickly grab colorful buckets and look for water. A large water tank is visible nearby.", camera: "Tracking shot following kids", visual: "Kids running with buckets", image: "/storyboard/03-grab-buckets.png", audio: "/storyboard/audio/02-buckets-leak.mp3", color: "from-sky-200 to-blue-300" },
  { id: 4, start: 20, end: 27, title: "Tank Leak", description: "Water pours from a hole on the side of the tank. Daddy runs into frame to investigate.", camera: "Wide → close-up of leak", visual: "Water leak from tank", image: "/storyboard/04-tank-leak.png", audio: "/storyboard/audio/02-buckets-leak.mp3", color: "from-cyan-200 to-blue-400" },
  { id: 5, start: 27, end: 41, title: "Daddy Fixes It", description: "Daddy puts tape over the leak. Suddenly the water bursts through and sprays directly into his face. Everyone reacts with surprise and laughter.", camera: "Close-up → fast pullback", visual: "Comedic tape fix fail", image: "/storyboard/05-daddy-fixes.png", audio: "/storyboard/audio/03-fix-splash.mp3", color: "from-yellow-200 to-orange-300" },
  { id: 6, start: 41, end: 49, title: "Splash!", description: "Water sprays everywhere. Kids dance and play in the puddles.", camera: "Wide playful shot", visual: "Big water spray, kids dancing", image: "/storyboard/06-splash.png", audio: "/storyboard/audio/03-fix-splash.mp3", color: "from-blue-200 to-cyan-300" },
  { id: 7, start: 49, end: 70, title: "Water Is the Best", description: "The family happily washes the car while singing. Lots of bubbles, splashes and funny little messes.", camera: "Alternating wide/close shots", visual: "Family car wash with bubbles", image: "/storyboard/07-water-best.png", audio: "/storyboard/audio/04-wash.mp3", color: "from-sky-200 to-indigo-200" },
  { id: 8, start: 70, end: 75, title: "Big Laugh", description: "Daddy and the kids laugh after getting soaked.", camera: "Close-up reactions", visual: "Soaked but laughing", image: "/storyboard/08-big-laugh.png", audio: "/storyboard/audio/04-wash.mp3", color: "from-orange-200 to-pink-200" },
  { id: 9, start: 75, end: 82, title: "Knock at the Door", description: "A delivery vehicle arrives. Someone knocks at the garage/house door.", camera: "Wide exterior shot", visual: "Delivery van arriving", image: "/storyboard/09-knock-door.png", audio: "/storyboard/audio/05-delivery.mp3", color: "from-emerald-200 to-teal-300" },
  { id: 10, start: 82, end: 88, title: "New Box", description: "Delivery man carries in a large new box containing a shiny hose.", camera: "Medium tracking shot", visual: "Large box delivery", image: "/storyboard/10-new-box.png", audio: "/storyboard/audio/05-delivery.mp3", color: "from-amber-100 to-yellow-200" },
  { id: 11, start: 88, end: 98, title: "New Hose", description: "Family opens the box and excitedly connects the new hose/tap.", camera: "Close-ups of hands + hose", visual: "Unboxing new hose", image: "/storyboard/11-new-hose.png", audio: "/storyboard/audio/05-delivery.mp3", color: "from-lime-200 to-green-300" },
  { id: 12, start: 98, end: 100, title: "Water!", description: "Water begins flowing from the new setup.", camera: "Close-up", visual: "Sparkling water flow", image: "/storyboard/12-water.png", audio: "/storyboard/audio/06-water-boom.mp3", color: "from-cyan-200 to-blue-300" },
  { id: 13, start: 100, end: 109, title: "Boom & Crash", description: "A playful water burst creates another huge splash. Everyone jumps back, then laughs.", camera: "Dynamic wide shot", visual: "Huge splash surprise", image: "/storyboard/13-boom-crash.png", audio: "/storyboard/audio/06-water-boom.mp3", color: "from-blue-300 to-purple-300" },
  { id: 14, start: 109, end: 119, title: "Drip Drip Drop", description: "Water continues dripping while the kids play around the puddles.", camera: "Low-angle shot", visual: "Puddle play, drips", image: "/storyboard/14-drip-drop.png", audio: "/storyboard/audio/06-water-boom.mp3", color: "from-sky-100 to-blue-200" },
  { id: 15, start: 119, end: 131, title: "Fill the Tank", description: "They successfully fill the tank. The water level rises toward the top.", camera: "Vertical/tilting shot", visual: "Tank filling up", image: "/storyboard/15-fill-tank.png", audio: "/storyboard/audio/07-fill-clean.mp3", color: "from-blue-200 to-indigo-300" },
  { id: 16, start: 131, end: 135, title: "Almost Full", description: "The tank reaches the top and water splashes over slightly.", camera: "Close-up", visual: "Overflow splash", image: "/storyboard/16-almost-full.png", audio: "/storyboard/audio/07-fill-clean.mp3", color: "from-cyan-200 to-blue-400" },
  { id: 17, start: 135, end: 142, title: "Clean Cars", description: "The cars are now sparkling clean under the sunshine. Family celebrates.", camera: "Hero wide shot", visual: "Sparkling clean cars", image: "/storyboard/17-clean-cars.png", audio: "/storyboard/audio/07-fill-clean.mp3", color: "from-yellow-100 to-amber-200" },
  { id: 18, start: 142, end: 150, title: "Final Splash", description: "A final exaggerated water spray sends everyone into a playful frenzy.", camera: "Fast dynamic shots", visual: "Epic final splash", image: "/storyboard/18-final-splash.png", audio: "/storyboard/audio/08-finale.mp3", color: "from-blue-300 to-cyan-200" },
  { id: 19, start: 150, end: 168, title: "Happy Ending", description: "Kids and Daddy laugh, dance and enjoy the finished car wash. Clean cars shine behind them.", camera: "Wide closing shot", visual: "Happy dance celebration", image: "/storyboard/19-happy-ending.png", audio: "/storyboard/audio/08-finale.mp3", color: "from-pink-200 to-orange-200" },
]

const TOTAL_DURATION = 168

function formatTime(s: number) {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

export default function FixItSplash() {
  const [currentTime, setCurrentTime] = useState(1)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentSceneIdx, setCurrentSceneIdx] = useState(0)
  const [showSplash, setShowSplash] = useState(false)
  const [bubbles, setBubbles] = useState<{x:number,y:number,size:number,delay:number}[]>([])
  const [isMuted, setIsMuted] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null)
  const intervalRef = useRef<number | null>(null)
  const mainAudioRef = useRef<HTMLAudioElement>(null)
  const videoRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)

  const currentScene = SCENES[currentSceneIdx]

  useEffect(() => {
    const b = Array.from({length: 24}, () => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 8 + Math.random() * 36,
      delay: Math.random() * 5
    }))
    setBubbles(b)
  }, [])

  // Scene sync
  useEffect(() => {
    const idx = SCENES.findIndex(s => currentTime >= s.start && currentTime < s.end)
    if (idx !== -1 && idx !== currentSceneIdx) {
      setCurrentSceneIdx(idx)
      if ([4,5,12,17].includes(SCENES[idx].id)) {
        setShowSplash(true)
        setTimeout(() => setShowSplash(false), 900)
      }
    }
  }, [currentTime, currentSceneIdx])

  // Playback loop
  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = window.setInterval(() => {
        setCurrentTime(prev => {
          if (prev >= TOTAL_DURATION) {
            setIsPlaying(false)
            return 1
          }
          return prev + 0.1
        })
      }, 100)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [isPlaying])

  // Audio sync - play audio stem when scene changes and playing
  const lastAudioRef = useRef<string>('')
  useEffect(() => {
    if (!mainAudioRef.current) return
    const audioSrc = currentScene.audio
    if (!audioSrc) return
    if (lastAudioRef.current !== audioSrc) {
      lastAudioRef.current = audioSrc
      if (isPlaying && !isMuted) {
        mainAudioRef.current.src = audioSrc
        mainAudioRef.current.play().catch(()=>{})
      }
    }
  }, [currentSceneIdx, isPlaying, isMuted, currentScene.audio])

  useEffect(() => {
    if (!mainAudioRef.current) return
    if (isPlaying && !isMuted) {
      if (mainAudioRef.current.paused) {
        mainAudioRef.current.play().catch(()=>{})
      }
    } else {
      mainAudioRef.current.pause()
    }
  }, [isPlaying, isMuted])

  const togglePlay = useCallback(() => {
    setIsPlaying(p => !p)
  }, [])

  const seekTo = useCallback((time: number) => {
    setCurrentTime(time)
  }, [])

  const seekToScene = useCallback((idx: number) => {
    setCurrentSceneIdx(idx)
    setCurrentTime(SCENES[idx].start + 0.1)
    setIsPlaying(true)
  }, [])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault()
        togglePlay()
      }
      if (e.code === 'ArrowRight') {
        setCurrentTime(t => Math.min(TOTAL_DURATION, t + 5))
      }
      if (e.code === 'ArrowLeft') {
        setCurrentTime(t => Math.max(1, t - 5))
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [togglePlay])

  const startRecording = useCallback(async () => {
    if (!canvasRef.current || !videoRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    canvas.width = 1920
    canvas.height = 1080
    
    // Capture video element as stream
    const stream = canvas.captureStream(30)
    const audioStream = mainAudioRef.current ? (mainAudioRef.current as any).captureStream?.() : null
    let combinedStream: MediaStream = stream
    if (audioStream) {
      const audioTracks = audioStream.getAudioTracks()
      audioTracks.forEach((t: MediaStreamTrack) => combinedStream.addTrack(t))
    }

    const recorder = new MediaRecorder(combinedStream, { mimeType: 'video/webm;codecs=vp9' })
    const chunks: Blob[] = []
    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' })
      const url = URL.createObjectURL(blob)
      setRecordedUrl(url)
      setIsRecording(false)
    }
    mediaRecorderRef.current = recorder
    recorder.start()
    setIsRecording(true)

    // Draw loop - render current image to canvas
    let rafId = 0
    const draw = () => {
      if (!isRecording && mediaRecorderRef.current?.state !== 'recording') {
        cancelAnimationFrame(rafId)
        return
      }
      const img = videoRef.current?.querySelector('img') as HTMLImageElement | null
      if (img && img.complete) {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        // overlay text
        ctx.fillStyle = 'rgba(0,0,0,0.5)'
        ctx.fillRect(0, canvas.height - 120, canvas.width, 120)
        ctx.fillStyle = 'white'
        ctx.font = 'bold 48px sans-serif'
        ctx.fillText(`${currentScene.id}. ${currentScene.title}`, 40, canvas.height - 60)
        ctx.font = '24px sans-serif'
        ctx.fillText(currentScene.description.slice(0, 80), 40, canvas.height - 20)
      }
      rafId = requestAnimationFrame(draw)
    }
    draw()

    // auto stop after full duration
    setTimeout(() => {
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop()
      }
    }, (TOTAL_DURATION - currentTime) * 1000 + 1000)
  }, [currentTime, currentScene, isRecording])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
  }, [])

  const progress = ((currentTime - 1) / (TOTAL_DURATION - 1)) * 100

  return (
    <div className="min-h-screen bg-[#0a0f1f] text-white selection:bg-cyan-400/30">
      <div className="sticky top-0 z-40 backdrop-blur-xl bg-[#0a0f1f]/90 border-b border-white/10">
        <div className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 grid place-items-center font-black text-sm shadow-lg shadow-cyan-500/20">FIX</div>
            <div>
              <h1 className="font-black tracking-tight text-[15px] leading-none">FIX IT SPLASH SONG</h1>
              <p className="text-[11px] tracking-widest opacity-60 uppercase font-bold">Chapter 1 • 2:48 • 19 Scenes • FINAL RENDER</p>
            </div>
            <span className="hidden md:inline-flex ml-3 px-2.5 py-1 rounded-full bg-emerald-400 text-black text-[10px] font-black tracking-widest">✓ 19/19 IMAGES • 8 AUDIO</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex items-center gap-2 text-[11px] font-bold tracking-widest uppercase px-3 py-1.5 rounded-full bg-white/10 border border-white/10">
              <span className={`w-2 h-2 rounded-full ${isPlaying ? 'bg-emerald-400 animate-pulse' : 'bg-white/40'}`} /> {isPlaying ? 'PLAYING' : 'PAUSED'} • {formatTime(currentTime)} / {formatTime(TOTAL_DURATION)}
            </span>
            <button onClick={() => setIsMuted(!isMuted)} className="w-8 h-8 rounded-full bg-white/10 border border-white/10 grid place-items-center hover:bg-white/15">
              {isMuted ? '🔇' : '🔊'}
            </button>
            <a href="/" className="text-xs font-semibold px-3 py-1.5 rounded-full bg-white text-black hover:bg-white/90 transition">← FutWeb</a>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-8 py-4 lg:py-6 grid grid-cols-1 lg:grid-cols-[1.25fr_0.75fr] gap-4 lg:gap-6">
        <div className="space-y-3">
          <div 
            ref={videoRef}
            className="relative aspect-[16/9] rounded-[24px] overflow-hidden bg-black shadow-2xl shadow-blue-900/40 border border-white/10 group"
          >
            <div className="absolute inset-0">
              <img 
                key={currentScene.id}
                src={currentScene.image} 
                alt={currentScene.title}
                className="w-full h-full object-cover transition-all duration-700 ease-out"
                style={{ transform: `scale(${isPlaying ? 1.06 : 1})` }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
            </div>

            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              {bubbles.map((b, i) => (
                <div
                  key={i}
                  className="absolute rounded-full bg-white/20 backdrop-blur-sm border border-white/30 animate-float"
                  style={{
                    left: `${b.x}%`,
                    top: `${b.y}%`,
                    width: `${b.size}px`,
                    height: `${b.size}px`,
                    animationDelay: `${b.delay}s`,
                    animationDuration: `${3 + Math.random() * 4}s`
                  }}
                />
              ))}
            </div>

            {showSplash && (
              <div className="absolute inset-0 pointer-events-none grid place-items-center">
                <div className="w-[200%] h-[200%] bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.9)_0%,rgba(100,200,255,0.6)_20%,transparent_60%)] animate-splash" />
                <div className="absolute text-7xl animate-bounce drop-shadow-2xl">💦</div>
                <div className="absolute text-5xl animate-ping" style={{top: '30%', left: '20%'}}>💧</div>
                <div className="absolute text-4xl animate-ping" style={{bottom: '20%', right: '15%', animationDelay: '0.2s'}}>💦</div>
              </div>
            )}

            <div className="absolute top-0 inset-x-0 p-4 flex justify-between items-start">
              <div className="flex gap-2">
                <span className="px-3 py-1.5 rounded-full bg-black/70 backdrop-blur-md text-[11px] font-black tracking-widest uppercase border border-white/20 shadow-xl">
                  SCENE {currentScene.id.toString().padStart(2,'0')} • {currentScene.camera}
                </span>
                <span className="hidden sm:inline-flex px-3 py-1.5 rounded-full bg-cyan-400 text-black text-[11px] font-black tracking-widest uppercase shadow-xl">
                  {formatTime(currentScene.start)} – {formatTime(currentScene.end)}
                </span>
              </div>
              <span className="px-3 py-1.5 rounded-full bg-white/95 text-black text-xs font-bold shadow-xl">
                {currentScene.title}
              </span>
            </div>

            {!isPlaying && (
              <button
                onClick={togglePlay}
                className="absolute inset-0 grid place-items-center bg-black/20 backdrop-blur-[1px] group-hover:bg-black/30 transition"
              >
                <div className="w-24 h-24 rounded-full bg-white text-black grid place-items-center shadow-2xl scale-100 group-hover:scale-110 transition-transform duration-300">
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor" className="translate-x-1"><path d="M8 5.14v14l11-7-11-7z"/></svg>
                </div>
                <div className="absolute bottom-20 text-sm font-bold tracking-widest uppercase bg-black/60 px-4 py-2 rounded-full border border-white/20">Click to Play Fix It Splash Song</div>
              </button>
            )}

            <div className="absolute bottom-0 inset-x-0 p-5">
              <div className="flex items-end justify-between gap-4">
                <div className="space-y-1.5 max-w-[78%]">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full bg-white text-black grid place-items-center text-xs font-black">{currentScene.id}</span>
                    <h2 className="text-2xl sm:text-[28px] font-black leading-none tracking-tight drop-shadow-xl">{currentScene.title}</h2>
                  </div>
                  <p className="text-[13px] sm:text-[14px] leading-snug opacity-90 drop-shadow-md font-medium">{currentScene.description}</p>
                </div>
                <button
                  onClick={togglePlay}
                  className="hidden sm:grid w-14 h-14 rounded-full bg-white text-black place-items-center shadow-2xl hover:scale-105 transition"
                >
                  {isPlaying ? (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                  ) : (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" className="translate-x-0.5"><path d="M8 5.14v14l11-7-11-7z"/></svg>
                  )}
                </button>
              </div>

              <div className="mt-5 space-y-2">
                <div className="h-2 w-full bg-white/20 rounded-full overflow-hidden backdrop-blur shadow-inner">
                  <div className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full transition-all duration-100 ease-linear shadow-lg" style={{ width: `${progress}%` }} />
                </div>
                <div className="flex justify-between text-[10px] font-bold tracking-widest opacity-60 uppercase">
                  <span>{formatTime(currentTime)}</span>
                  <span className="flex gap-1.5 items-center">
                    {SCENES.map((s, i) => (
                      <span key={s.id} className={`h-1.5 rounded-full transition-all ${i === currentSceneIdx ? 'bg-white w-6' : i < currentSceneIdx ? 'bg-cyan-400/80 w-1.5' : 'bg-white/30 w-1.5'}`} />
                    ))}
                  </span>
                  <span>{formatTime(TOTAL_DURATION)}</span>
                </div>
              </div>
            </div>

            <input
              type="range"
              min={1}
              max={TOTAL_DURATION}
              step={0.1}
              value={currentTime}
              onChange={(e) => seekTo(parseFloat(e.target.value))}
              className="absolute bottom-[88px] left-0 right-0 w-full opacity-0 cursor-pointer h-10"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button onClick={togglePlay} className="px-6 py-3 rounded-full bg-white text-black font-black text-sm hover:bg-white/90 transition flex items-center gap-2 shadow-xl">
              {isPlaying ? '⏸ Pause' : '▶ Play Video'} <span className="opacity-60 text-xs hidden sm:inline">(Space)</span>
            </button>
            <button onClick={() => seekTo(Math.max(1, currentTime - 5))} className="px-4 py-3 rounded-full bg-white/10 hover:bg-white/15 border border-white/10 font-bold text-sm transition">⏪ -5s</button>
            <button onClick={() => seekTo(Math.min(TOTAL_DURATION, currentTime + 5))} className="px-4 py-3 rounded-full bg-white/10 hover:bg-white/15 border border-white/10 font-bold text-sm transition">+5s ⏩</button>
            <button onClick={() => { setCurrentTime(1); setCurrentSceneIdx(0); setIsPlaying(true)}} className="px-4 py-3 rounded-full bg-white/10 hover:bg-white/15 border border-white/10 font-bold text-sm transition">↺ Restart</button>
            
            <div className="ml-auto flex items-center gap-2">
              {!isRecording ? (
                <button onClick={startRecording} className="px-4 py-3 rounded-full bg-gradient-to-r from-red-500 to-pink-500 text-white font-black text-xs tracking-widest uppercase hover:from-red-600 hover:to-pink-600 transition shadow-xl">
                  ● Record MP4
                </button>
              ) : (
                <button onClick={stopRecording} className="px-4 py-3 rounded-full bg-red-600 text-white font-black text-xs tracking-widest uppercase animate-pulse">
                  ■ Stop Recording
                </button>
              )}
              {recordedUrl && (
                <a href={recordedUrl} download="fix-it-splash-song.webm" className="px-4 py-3 rounded-full bg-emerald-500 text-black font-black text-xs tracking-widest uppercase hover:bg-emerald-400 transition">
                  ⬇ Download Video
                </a>
              )}
            </div>
          </div>

          {/* Hidden canvas for recording */}
          <canvas ref={canvasRef} className="hidden" />
          <audio ref={mainAudioRef} className="hidden" preload="auto" />

          <div className="rounded-[20px] bg-white/[0.06] border border-white/10 p-5 backdrop-blur">
            <h3 className="font-black text-sm tracking-wide flex items-center gap-2"><span className="w-7 h-7 rounded-full bg-gradient-to-br from-pink-400 to-orange-400 grid place-items-center text-xs">♪</span> FIX IT SPLASH SONG — Full Lyrics (2:48 Sing-Along)</h3>
            <div className="mt-4 grid sm:grid-cols-2 gap-3 text-[13px] leading-relaxed">
              <div className="space-y-2">
                <p className="bg-white/5 rounded-xl p-3 border border-white/5"><strong className="text-cyan-300">[0:01] Messy Beginning:</strong><br/>Oh what a muddy day, look at that car! Covered in splashes, muddy near and far! 🚗💨</p>
                <p className="bg-white/5 rounded-xl p-3 border border-white/5"><strong className="text-cyan-300">[0:11] Grab the Buckets:</strong><br/>Grab the buckets, red, yellow, blue! We need water, yes we do! 🪣</p>
                <p className="bg-white/5 rounded-xl p-3 border border-white/5"><strong className="text-cyan-300">[0:20] Tank Leak:</strong><br/>Oh no oh no, the tank has a leak! Water pouring, drip drip, squeak squeak! 💧</p>
                <p className="bg-white/5 rounded-xl p-3 border border-white/5"><strong className="text-cyan-300">[0:27] Daddy Fixes It:</strong><br/>Daddy's here with tape, tap tap tap! But SPLASH! Water on his cap! 😂💦</p>
                <p className="bg-white/5 rounded-xl p-3 border border-white/5"><strong className="text-cyan-300">[0:41] Splash Dance:</strong><br/>Splash splash splash, dance in the rain! Puddle jumping, again again!</p>
                <p className="bg-white/5 rounded-xl p-3 border border-white/5"><strong className="text-cyan-300">[0:49] Water Is the Best:</strong><br/>Scrub-a-dub-dub, bubbles so high! Wash that car 'neath sunny sky! 🫧✨</p>
              </div>
              <div className="space-y-2">
                <p className="bg-white/5 rounded-xl p-3 border border-white/5"><strong className="text-cyan-300">[1:10] Big Laugh:</strong><br/>Hahaha, we're soaked through! Laughing together, me and you!</p>
                <p className="bg-white/5 rounded-xl p-3 border border-white/5"><strong className="text-cyan-300">[1:15] Knock Knock:</strong><br/>Knock knock knock, who's at the door? Delivery man with something more! 📦</p>
                <p className="bg-white/5 rounded-xl p-3 border border-white/5"><strong className="text-cyan-300">[1:28] New Hose:</strong><br/>Open the box, what do we see? Shiny new hose, yay, yippee! 🎉</p>
                <p className="bg-white/5 rounded-xl p-3 border border-white/5"><strong className="text-cyan-300">[1:40] Boom & Crash:</strong><br/>Boom crash splash, jump back quick! Then we laugh, haha, what a trick! 💥</p>
                <p className="bg-white/5 rounded-xl p-3 border border-white/5"><strong className="text-cyan-300">[1:49] Drip Drop:</strong><br/>Drip drip drop, plip plop plip! Playing 'round the puddle drip!</p>
                <p className="bg-white/5 rounded-xl p-3 border border-white/5"><strong className="text-cyan-300">[1:59] Fill the Tank:</strong><br/>Fill it up, up up up! Water rising to the top top top! ⬆️💧</p>
                <p className="bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-xl p-3 border border-cyan-400/20"><strong className="text-white">[2:15] Clean Cars → Finale:</strong><br/>Look how shiny, clean and bright! FINAL SPLASH, the biggest fun! Dance and laugh with everyone! We fixed it, cleaned it, hip hip hooray! The Fix-It Splash car-wash day! 💦✨🚗🎉</p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-[20px] bg-white/[0.06] border border-white/10 overflow-hidden backdrop-blur">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <h3 className="font-black text-sm tracking-wide">STORYBOARD TIMELINE • 19 SHOTS • FINAL</h3>
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-400 text-black">19/19 ✓</span>
            </div>
            <div className="max-h-[760px] overflow-auto custom-scrollbar">
              {SCENES.map((scene, idx) => {
                const isActive = idx === currentSceneIdx
                const isPast = currentTime > scene.end
                return (
                  <button
                    key={scene.id}
                    onClick={() => seekToScene(idx)}
                    className={`w-full text-left p-3 flex gap-3 hover:bg-white/[0.05] transition border-b border-white/[0.06] last:border-0 group ${isActive ? 'bg-cyan-500/10 !border-cyan-400/30' : ''}`}
                  >
                    <div className="relative w-[96px] h-[56px] rounded-[12px] overflow-hidden bg-black/50 shrink-0 border border-white/10 shadow-lg">
                      <img src={scene.image} alt={scene.title} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 grid place-items-center">
                        {isActive && isPlaying ? (
                          <span className="w-6 h-6 rounded-full bg-white text-black grid place-items-center animate-pulse shadow-xl">▶</span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded-full bg-black/80 border border-white/20 text-[10px] font-black tracking-widest">{formatTime(scene.start)}</span>
                        )}
                      </div>
                      {isPast && !isActive && <div className="absolute inset-0 bg-black/30" />}
                      {isActive && <div className="absolute inset-0 border-2 border-cyan-400 rounded-[12px] pointer-events-none" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-[11px] font-black tracking-widest px-1.5 py-0.5 rounded ${isActive ? 'bg-cyan-400 text-black' : 'bg-white/10 text-white/70'}`}>{scene.id.toString().padStart(2,'0')}</span>
                        <h4 className={`text-[13px] font-bold leading-tight truncate ${isActive ? 'text-white' : 'text-white/80 group-hover:text-white'}`}>{scene.title}</h4>
                      </div>
                      <p className="text-[11px] leading-snug opacity-60 line-clamp-2 mt-1">{scene.description}</p>
                      <p className="text-[10px] font-bold tracking-widest uppercase opacity-40 mt-1">{scene.camera} • {formatTime(scene.end - scene.start)}s</p>
                    </div>
                    <div className={`w-1 self-stretch rounded-full transition ${isActive ? 'bg-cyan-400' : 'bg-white/10 group-hover:bg-white/20'}`} />
                  </button>
                )
              })}
            </div>
          </div>

          <div className="rounded-[20px] bg-gradient-to-br from-violet-600/20 to-blue-600/20 border border-white/10 p-4 backdrop-blur">
            <h4 className="font-black text-xs tracking-widest uppercase opacity-80 mb-3 flex items-center gap-2">🎧 Song Stems & SFX • 8 Tracks <span className="ml-auto text-[10px] bg-white/10 px-2 py-1 rounded-full">Auto-sync when playing</span></h4>
            <div className="grid gap-2">
              {[
                { label: "01 Intro - Messy Beginning", src: "/storyboard/audio/01-intro.mp3", time: "0:01-0:11" },
                { label: "02 Buckets & Leak", src: "/storyboard/audio/02-buckets-leak.mp3", time: "0:11-0:27" },
                { label: "03 Fix & Splash", src: "/storyboard/audio/03-fix-splash.mp3", time: "0:27-0:49" },
                { label: "04 Wash & Laugh", src: "/storyboard/audio/04-wash.mp3", time: "0:49-1:15" },
                { label: "05 Delivery & New Hose", src: "/storyboard/audio/05-delivery.mp3", time: "1:15-1:38" },
                { label: "06 Water Boom Drip", src: "/storyboard/audio/06-water-boom.mp3", time: "1:38-1:59" },
                { label: "07 Fill & Clean Cars", src: "/storyboard/audio/07-fill-clean.mp3", time: "1:59-2:22" },
                { label: "08 Finale Splash", src: "/storyboard/audio/08-finale.mp3", time: "2:22-2:48" },
              ].map(a => (
                <div key={a.src} className="flex items-center gap-2 bg-black/40 rounded-full pl-3 pr-2 py-2 border border-white/10 hover:bg-black/50 transition">
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-bold truncate">{a.label}</div>
                    <div className="text-[10px] opacity-50 font-bold tracking-widest">{a.time}</div>
                  </div>
                  <audio controls src={a.src} className="h-7 w-[160px] sm:w-[170px]" preload="metadata" />
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[20px] bg-white text-black p-5 shadow-2xl">
            <h4 className="font-black text-sm flex items-center gap-2">✅ Video Complete — Delivery Ready</h4>
            <div className="mt-3 space-y-3 text-xs leading-snug">
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-black/5 rounded-xl p-3 border border-black/10">
                  <div className="font-black text-[11px] tracking-widest uppercase opacity-60">Format</div>
                  <div className="font-bold mt-1">16:9 • 1920×1080 • 30fps</div>
                  <div className="opacity-70">Pixar 3D Kids Cartoon</div>
                </div>
                <div className="bg-black/5 rounded-xl p-3 border border-black/10">
                  <div className="font-black text-[11px] tracking-widest uppercase opacity-60">Duration</div>
                  <div className="font-bold mt-1">2:48 • 19 Scenes</div>
                  <div className="opacity-70">Chapter 1 Complete</div>
                </div>
              </div>
              <p className="opacity-70">All 19 scene images + 8 audio stems are in <code className="bg-black/10 px-1.5 py-0.5 rounded font-bold">/public/storyboard/</code>. Use the Record MP4 button to capture WebM, or screen-record with OBS at 1080p. For pro edit, import image sequence into Premiere/DaVinci with 0.1s cross-dissolve and overlay audio stems.</p>
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1.5 rounded-full bg-black text-white text-xs font-bold">19 Images ✓</span>
                <span className="px-3 py-1.5 rounded-full bg-black text-white text-xs font-bold">8 Audio ✓</span>
                <span className="px-3 py-1.5 rounded-full bg-black/5 border border-black/10 text-xs font-bold">Interactive Player ✓</span>
                <span className="px-3 py-1.5 rounded-full bg-black/5 border border-black/10 text-xs font-bold">Record to MP4 ✓</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) translateX(0) scale(1); opacity: 0.7; }
          50% { transform: translateY(-30px) translateX(10px) scale(1.1); opacity: 1; }
        }
        .animate-float { animation: float linear infinite; }
        @keyframes splash {
          0% { transform: scale(0); opacity: 0.9; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        .animate-splash { animation: splash 0.9s ease-out forwards; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 999px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
      `}</style>
    </div>
  )
}
