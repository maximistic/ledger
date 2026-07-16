'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Moon, Sun, Settings, LayoutDashboard, Briefcase, BarChart2 } from 'lucide-react'
import { useTheme } from '@/context/ThemeContext'

const navLinks = [
  { href: '/', label: 'Dashboard' },
  { href: '/assets', label: 'Assets' },
  { href: '/reports', label: 'Reports' },
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

        {/* Nav links — hidden on mobile */}
        <div className="nav-links-desktop" style={{ display: 'flex', alignItems: 'center' }}>
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

        {/* Right — icon buttons — hidden on mobile */}
        <div className="nav-icons-desktop" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button onClick={() => router.push('/settings')} style={iconButtonStyle}>
            <Settings size={16} />
          </button>
          <button onClick={toggleTheme} style={iconButtonStyle}>
            {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
          </button>
        </div>
      </div>

      {/* Mobile bottom tab bar */}
      <div className="bottom-tab-bar">
        {[
          { href: '/',         label: 'Dashboard', Icon: LayoutDashboard, active: pathname === '/' },
          { href: '/assets',   label: 'Assets',    Icon: Briefcase,       active: pathname.startsWith('/assets') },
          { href: '/reports',  label: 'Reports',   Icon: BarChart2,       active: pathname.startsWith('/reports') },
          { href: '/settings', label: 'Settings',  Icon: Settings,        active: pathname.startsWith('/settings') },
        ].map(({ href, label, Icon, active }) => (
          <Link
            key={href}
            href={href}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '3px',
              color: active ? 'var(--nav-text-active)' : 'var(--nav-text)',
              textDecoration: 'none',
              fontSize: '10px',
              fontWeight: active ? 600 : 400,
              transition: 'color 140ms ease',
            }}
          >
            <Icon size={20} />
            <span>{label}</span>
          </Link>
        ))}
        <button
          onClick={toggleTheme}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '3px',
            color: 'var(--nav-text)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '10px',
            fontWeight: 400,
          }}
        >
          {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
          <span>Theme</span>
        </button>
      </div>
    </nav>
  )
}
