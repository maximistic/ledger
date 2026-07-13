'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Moon, Sun, Settings } from 'lucide-react'
import { useTheme } from '@/context/ThemeContext'

const navLinks = [
  { href: '/', label: 'Dashboard' },
  { href: '/assets', label: 'Assets' },
]

const iconButtonStyle: React.CSSProperties = {
  width: '32px',
  height: '32px',
  borderRadius: '6px',
  border: '0.5px solid var(--nav-indicator)',
  background: 'var(--nav-bg)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--nav-indicator)',
  cursor: 'pointer',
}

export default function Nav() {
  const pathname = usePathname()
  const router = useRouter()
  const { theme, toggleTheme } = useTheme()

  function isActive(href: string) {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  return (
    <nav
      style={{
        width: '100%',
        height: '52px',
        background: 'var(--nav-bg)',
        borderBottom: '0.5px solid var(--nav-border)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
    >
      <div
        style={{
          maxWidth: '1280px',
          margin: '0 auto',
          padding: '0 40px',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* Logo */}
        <Link
          href="/"
          style={{
            fontFamily: "'Instrument Serif', serif",
            fontStyle: 'italic',
            fontSize: '26px',
            color: 'var(--color-text-primary)',
            letterSpacing: '-0.5px',
            WebkitTextStroke: '0.4px currentColor',
            textDecoration: 'none',
          }}
        >
          Ledger
        </Link>

        {/* Nav links */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {navLinks.map(({ href, label }) => {
            const active = isActive(href)
            return (
              <Link
                key={href}
                href={href}
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: '14.5px',
                  padding: '0 16px',
                  height: '52px',
                  display: 'flex',
                  alignItems: 'center',
                  color: active ? 'var(--nav-text-active)' : 'var(--nav-text)',
                  fontWeight: active ? 600 : 400,
                  borderBottom: active
                    ? '2px solid var(--nav-indicator)'
                    : '2px solid transparent',
                  textDecoration: 'none',
                  transition: 'color 160ms ease, border-bottom-color 160ms ease, font-weight 160ms ease',
                }}
              >
                {label}
              </Link>
            )
          })}
        </div>

        {/* Right — icon buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button onClick={() => router.push('/settings')} style={iconButtonStyle}>
            <Settings size={16} />
          </button>
          <button onClick={toggleTheme} style={iconButtonStyle}>
            {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
          </button>
        </div>
      </div>
    </nav>
  )
}
