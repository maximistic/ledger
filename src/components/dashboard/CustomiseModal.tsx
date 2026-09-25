'use client'

import { useEffect } from 'react'
import { X, Check } from 'lucide-react'
import type { Visibility } from './types'
import { TOGGLES } from './shared'

interface Props {
  vis:       Visibility
  onToggle:  (key: keyof Visibility) => void
  onClose:   () => void
}

export default function CustomiseModal({ vis, onToggle, onClose }: Props) {
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', fn)
    return () => document.removeEventListener('keydown', fn)
  }, [onClose])

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'var(--overlay-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: 'var(--color-bg)', borderRadius: '12px', width: '100%', maxWidth: '360px', boxShadow: 'var(--shadow-lg)', overflow: 'hidden' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px 14px', borderBottom: '0.5px solid var(--color-border)' }}>
          <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text-primary)' }}>Customise dashboard</div>
          <button onClick={onClose} style={{ padding: '4px', color: 'var(--color-text-muted)', borderRadius: '6px', lineHeight: 0, background: 'none', border: 'none', cursor: 'pointer' }}>
            <X size={16} />
          </button>
        </div>
        <div style={{ padding: '6px 0' }}>
          {TOGGLES.map(item => {
            const on = vis[item.key]
            return (
              <button
                key={item.key}
                onClick={() => onToggle(item.key)}
                disabled={item.locked}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 20px 11px 16px', background: 'none', border: 'none', borderRight: on ? '3px solid var(--color-text-primary)' : '3px solid transparent', cursor: item.locked ? 'default' : 'pointer', fontFamily: 'inherit', transition: 'border-color 160ms ease' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: 18, height: 18, borderRadius: '50%', flexShrink: 0, background: on ? 'var(--color-text-primary)' : 'transparent', border: on ? 'none' : '1.5px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 160ms ease, border-color 160ms ease' }}>
                    {on && <Check size={10} color="var(--color-surface)" strokeWidth={3} />}
                  </div>
                  <span style={{ fontSize: '13.5px', color: 'var(--color-text-primary)', textAlign: 'left' }}>{item.label}</span>
                </div>
                {item.locked && (
                  <span style={{ fontSize: '10.5px', color: 'var(--color-text-muted)' }}>Always on</span>
                )}
              </button>
            )
          })}
        </div>
        <div style={{ padding: '12px 20px', borderTop: '0.5px solid var(--color-border)' }}>
          <button
            onClick={onClose}
            style={{ width: '100%', padding: '8px', borderRadius: '6px', background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)', fontSize: '13px', fontWeight: 500, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
