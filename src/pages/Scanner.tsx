import { useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Webcam from 'react-webcam'

export default function Scanner() {
  const navigate = useNavigate()
  const webcamRef = useRef<Webcam>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [cameraError, setCameraError] = useState(false)
  const [flash, setFlash] = useState(false)
  const [showHelp, setShowHelp] = useState(false)

  const capture = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot()
    if (imageSrc) {
      navigate('/review', { state: { imageData: imageSrc } })
    }
  }, [navigate])

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onloadend = () => {
      navigate('/review', { state: { imageData: reader.result as string } })
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="bg-black font-body text-white overflow-hidden h-screen flex flex-col">
      {/* Top Navigation Bar */}
      <header className="flex items-center justify-between px-6 py-6 w-full z-50 absolute top-0">
        <button
          onClick={() => navigate(-1)}
          className="w-12 h-12 flex items-center justify-center rounded-full bg-black/40 backdrop-blur-md text-white hover:bg-black/60 transition-all active:scale-95"
        >
          <span className="material-symbols-outlined">close</span>
        </button>
        <div className="flex gap-4">
          <button
            onClick={() => setShowHelp(true)}
            className="w-12 h-12 flex items-center justify-center rounded-full bg-black/40 backdrop-blur-md text-white hover:bg-black/60 transition-all active:scale-95"
          >
            <span className="material-symbols-outlined">help</span>
          </button>
        </div>
      </header>

      {/* Camera Viewport */}
      <main className="relative flex-1 flex flex-col items-center justify-center overflow-hidden">
        {!cameraError ? (
          <Webcam
            ref={webcamRef}
            audio={false}
            screenshotFormat="image/jpeg"
            screenshotQuality={0.92}
            videoConstraints={{ facingMode: { ideal: 'environment' } }}
            onUserMediaError={() => setCameraError(true)}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-neutral-900 flex items-center justify-center">
            <div className="text-center space-y-2 px-8">
              <span className="material-symbols-outlined text-5xl text-white/30">no_photography</span>
              <p className="text-white/60 text-sm">Cámara no disponible</p>
              <p className="text-white/40 text-xs">Usa el botón de galería para subir una foto</p>
            </div>
          </div>
        )}

        {/* Dark overlay */}
        <div className="absolute inset-0 bg-radial-[circle,transparent_50%,rgba(0,0,0,0.65)_100%] pointer-events-none" />

        {/* Scanning Frame */}
        <div className="relative z-10 w-full max-w-md px-8 flex flex-col items-center">
          <div className="relative w-full aspect-[3/4] rounded-3xl border-2 border-primary/40 flex items-center justify-center overflow-hidden">
            <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-primary rounded-tl-3xl" />
            <div className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 border-primary rounded-tr-3xl" />
            <div className="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 border-primary rounded-bl-3xl" />
            <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-primary rounded-br-3xl" />
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-60 animate-pulse" />
          </div>

          <div className="mt-8 text-center space-y-2">
            <p className="text-lg font-headline font-bold text-white tracking-wide">
              Coloca el ticket dentro del marco
            </p>
            <p className="text-sm text-white/60 font-medium">
              Asegúrate de que el texto sea legible
            </p>
          </div>
        </div>
      </main>

      {/* Bottom Controls */}
      <footer className="relative z-50 bg-black/40 backdrop-blur-2xl px-10 pt-8 pb-12 rounded-t-[2.5rem] flex items-center justify-between border-t border-white/10">
        {/* Flash Toggle */}
        <div className="flex flex-col items-center gap-2 w-16">
          <button
            onClick={async () => {
              try {
                const stream = webcamRef.current?.video?.srcObject as MediaStream | null
                const track = stream?.getVideoTracks()[0]
                if (track && 'applyConstraints' in track) {
                  const newFlash = !flash
                  await (track as MediaStreamTrack & { applyConstraints: (c: object) => Promise<void> })
                    .applyConstraints({ advanced: [{ torch: newFlash } as object] })
                  setFlash(newFlash)
                }
              } catch {
                setFlash(f => !f)
              }
            }}
            className={`w-12 h-12 flex items-center justify-center rounded-full transition-all active:scale-90 ${flash ? 'bg-yellow-400/30' : 'bg-white/10 hover:bg-white/20'}`}
          >
            <span className="material-symbols-outlined text-white">{flash ? 'flash_on' : 'flash_off'}</span>
          </button>
          <span className="text-[10px] font-label uppercase tracking-widest text-white/50">
            {flash ? 'Flash On' : 'Flash Off'}
          </span>
        </div>

        {/* Capture Button */}
        <div className="relative flex items-center justify-center">
          <div className="absolute w-24 h-24 rounded-full border-2 border-primary opacity-30 animate-ping" />
          <button
            onClick={capture}
            disabled={cameraError}
            className="relative w-20 h-20 rounded-full bg-white p-1 shadow-2xl active:scale-95 transition-transform disabled:opacity-40"
          >
            <div className="w-full h-full rounded-full border-[3px] border-black/5 flex items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-primary to-primary-container shadow-inner" />
            </div>
          </button>
        </div>

        {/* Gallery Upload */}
        <div className="flex flex-col items-center gap-2 w-16">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-12 h-12 rounded-xl overflow-hidden border-2 border-white/20 hover:border-primary transition-all active:scale-90 bg-white/10 flex items-center justify-center"
          >
            <span className="material-symbols-outlined text-white/70 text-sm">photo_library</span>
          </button>
          <span className="text-[10px] font-label uppercase tracking-widest text-white/50">Galería</span>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileUpload}
          />
        </div>
      </footer>

      {/* Help Modal */}
      {showHelp && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-end justify-center"
          onClick={() => setShowHelp(false)}>
          <div className="bg-[#1a0e0a] rounded-t-[2rem] w-full max-w-lg p-8 pb-12 space-y-6"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-headline font-bold text-white text-xl">Cómo escanear</h3>
              <button onClick={() => setShowHelp(false)}
                className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white/70">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            {[
              { icon: 'light_mode', title: 'Buena iluminación', desc: 'Busca una superficie bien iluminada. Evita sombras sobre el ticket.' },
              { icon: 'straighten', title: 'Coloca bien el ticket', desc: 'Alinea el ticket dentro del marco. Que todo el texto quede visible.' },
              { icon: 'texture', title: 'Tickets arrugados', desc: 'Estira el ticket lo máximo posible. La IA puede leer texto aunque esté doblado.' },
              { icon: 'photo_library', title: 'Usa la galería', desc: 'Si ya tienes una foto del ticket, usa el botón de galería en lugar de la cámara.' },
            ].map(tip => (
              <div key={tip.icon} className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-primary text-[20px]">{tip.icon}</span>
                </div>
                <div>
                  <p className="font-semibold text-white text-sm">{tip.title}</p>
                  <p className="text-white/50 text-xs mt-0.5">{tip.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Ready Badge */}
      <div className="absolute bottom-40 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
        <div className="px-4 py-2 bg-primary/20 backdrop-blur-xl border border-primary/30 rounded-full flex items-center gap-2 shadow-xl">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span className="text-xs font-semibold text-primary uppercase tracking-tighter">Listo para escanear</span>
        </div>
      </div>
    </div>
  )
}
