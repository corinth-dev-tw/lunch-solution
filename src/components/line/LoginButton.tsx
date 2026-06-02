'use client'

interface LoginButtonProps {
  redirectAfter?: string
  className?: string
  children?: React.ReactNode
}

export default function LoginButton({ redirectAfter, className, children }: LoginButtonProps) {
  const handleLogin = () => {
    const url = new URL('/api/auth/line', window.location.origin)
    if (redirectAfter) url.searchParams.set('redirect', redirectAfter)
    window.location.href = url.toString()
  }

  return (
    <button
      onClick={handleLogin}
      className={
        className ??
        'flex items-center gap-3 bg-[#00B900] hover:bg-[#009900] text-white font-bold px-6 py-3 rounded-xl transition-all hover:scale-105 shadow-lg shadow-green-500/25'
      }
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
        <path d="M12 2C6.48 2 2 6.48 2 12c0 4.24 2.65 7.86 6.39 9.29.47.09.63-.2.63-.45v-1.58C6.27 20.07 5.73 18.1 5.73 18.1c-.43-1.09-1.05-1.38-1.05-1.38-.86-.59.07-.58.07-.58.95.07 1.45.97 1.45.97.84 1.44 2.22 1.03 2.76.78.08-.61.33-1.03.6-1.27-2.1-.24-4.31-1.05-4.31-4.68 0-1.03.37-1.87.97-2.53-.1-.24-.42-1.2.09-2.49 0 0 .79-.25 2.6.97.75-.21 1.56-.31 2.36-.32.8.01 1.61.11 2.36.32 1.81-1.22 2.6-.97 2.6-.97.51 1.29.19 2.25.09 2.49.6.66.97 1.5.97 2.53 0 3.64-2.21 4.44-4.32 4.67.34.29.64.87.64 1.75v2.59c0 .25.16.55.64.45C19.35 19.86 22 16.24 22 12c0-5.52-4.48-10-10-10z" />
      </svg>
      {children ?? 'LINE 登入'}
    </button>
  )
}
