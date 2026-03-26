import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background font-body flex flex-col items-center justify-center px-6 text-center">
      <img src="/icons/icon.png" alt="IDT" className="w-16 h-16 rounded-2xl object-contain mb-8 opacity-40" />
      <h1 className="font-headline font-extrabold text-6xl text-primary mb-2">404</h1>
      <p className="text-on-surface font-semibold text-lg mb-1">Página no encontrada</p>
      <p className="text-on-surface-variant text-sm mb-8">La dirección que buscas no existe.</p>
      <Link
        to="/dashboard"
        className="flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-xl font-semibold text-sm active:scale-95 transition-transform"
      >
        <span className="material-symbols-outlined text-[18px]">home</span>
        Volver al inicio
      </Link>
    </div>
  )
}
