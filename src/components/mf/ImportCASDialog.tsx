'use client'

import { useRef, useState } from 'react'
import { X, Upload } from 'lucide-react'

interface Props {
  onClose: () => void
  onSuccess: () => void
}

function friendlyError(msg?: string): string {
  if (!msg) return 'Something went wrong. Please try again.'
  const lower = msg.toLowerCase()
  if (lower.includes('not configured') || lower.includes('econnrefused') || lower.includes('not available'))
    return 'CAS import is not available in this environment. Please add funds manually for now.'
  if (lower.includes('password') || lower.includes('incorrect password'))
    return 'Incorrect password. Try PAN + DOB in DDMMYYYY format (e.g. ABCDE1234F01011990).'
  if (lower.includes('no fund') || lower.includes('no data') || lower.includes('no mutual fund'))
    return 'No mutual fund data found. Make sure you downloaded a Detailed CAS.'
  if (msg.includes('PrismaClient') || msg.length > 200)
    return 'Something went wrong. Please try again.'
  return msg
}

export default function ImportCASDialog({ onClose, onSuccess }: Props) {
  const [file, setFile]           = useState<File | null>(null)
  const [password, setPassword]   = useState('')
  const [importing, setImporting] = useState(false)
  const [result, setResult]       = useState<{
    imported?: number; updated?: number; txCreated?: number; txSkipped?: number; errors?: string[]
  } | null>(null)
  const [error, setError]         = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  async function handleImport() {
    if (!file) return
    setImporting(true); setError(''); setResult(null)

    try {
      const form = new FormData()
      form.append('file', file)
      form.append('password', password)

      const res = await fetch('/api/mf/import/cas', { method: 'POST', body: form })
      const data = await res.json() as {
        error?: string; imported?: number; updated?: number; txCreated?: number; txSkipped?: number; errors?: string[]
      }

      if (!res.ok) {
        setError(friendlyError(data.error))
        return
      }

      setResult({
        imported: data.imported, updated: data.updated,
        txCreated: data.txCreated, txSkipped: data.txSkipped,
        errors: data.errors,
      })
      onSuccess()
    } catch (err) {
      console.error('ImportCAS error:', err)
      setError(friendlyError())
    } finally {
      setImporting(false)
    }
  }

  return (
    <div
      ref={overlayRef}
      onClick={e => { if (e.target === overlayRef.current) onClose() }}
      style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'var(--overlay-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
    >
      <div
        className="dialog-panel"
        onClick={e => e.stopPropagation()}
        style={{ background: 'var(--color-bg)', borderRadius: '12px', width: '100%', maxWidth: '480px', boxShadow: 'var(--shadow-lg)', overflow: 'hidden' }}
      >
        {/* Header */}
        <div style={{ padding: '18px 22px', borderBottom: '0.5px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: '14.5px', fontWeight: 600, color: 'var(--color-text-primary)' }}>Import CAS</div>
          <button onClick={onClose} style={{ padding: '4px', color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', lineHeight: 0 }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: '18px 22px' }}>
          {result ? (
            /* Success state */
            <div>
              <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-gain)', marginBottom: '12px' }}>Import complete</div>
              <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
                {result.imported !== undefined && <div>Funds imported: <strong>{result.imported}</strong></div>}
                {result.updated !== undefined && <div>Funds updated: <strong>{result.updated}</strong></div>}
                {result.txCreated !== undefined && <div>Transactions added: <strong>{result.txCreated}</strong></div>}
                {result.txSkipped !== undefined && <div>Transactions skipped: <strong>{result.txSkipped}</strong></div>}
              </div>
              {result.errors && result.errors.length > 0 && (
                <div style={{ marginTop: '10px', fontSize: '11.5px', color: 'var(--color-loss)' }}>
                  {result.errors.map((e, i) => <div key={i}>{e}</div>)}
                </div>
              )}
              <button
                onClick={() => { onSuccess(); onClose() }}
                style={{ marginTop: '16px', padding: '8px 20px', borderRadius: '6px', border: 'none', background: 'var(--color-text-primary)', color: 'var(--color-surface)', fontSize: '13px', fontFamily: 'inherit', cursor: 'pointer' }}
              >
                Done
              </button>
            </div>
          ) : (
            <>
              {/* Description */}
              <div style={{ background: 'var(--color-surface)', border: '0.5px solid var(--color-border)', borderRadius: '8px', padding: '12px 14px', marginBottom: '16px', fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                CAS (Consolidated Account Statement) contains your mutual fund history across all platforms.
              </div>

              {/* Steps */}
              <div style={{ marginBottom: '16px' }}>
                {[
                  'Go to mfcentral.com or camsonline.com',
                  'Request a Detailed CAS for all folios',
                  'Download the PDF sent to your email',
                  'Upload below with your PDF password',
                ].map((s, i) => (
                  <div key={i} style={{ display: 'flex', gap: '10px', marginBottom: '8px', fontSize: '12.5px', color: 'var(--color-text-secondary)' }}>
                    <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'var(--color-surface-raised)', border: '0.5px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, flexShrink: 0, color: 'var(--color-text-primary)' }}>
                      {i + 1}
                    </div>
                    {s}
                  </div>
                ))}
              </div>

              {/* Password */}
              <div style={{ marginBottom: '12px' }}>
                <div style={{ fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                  PDF Password
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="PAN + DOB (e.g. ABCDE1234F01011990)"
                  style={{ width: '100%', background: 'var(--color-surface)', border: '0.5px solid var(--color-border)', borderRadius: '7px', padding: '8px 11px', fontSize: '13px', color: 'var(--color-text-primary)', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                />
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                  Usually PAN number + date of birth DDMMYYYY
                </div>
              </div>

              {/* Dropzone */}
              <div
                onClick={() => fileRef.current?.click()}
                style={{
                  border: `1.5px dashed ${file ? 'var(--color-gain)' : 'var(--color-border)'}`,
                  borderRadius: '8px', padding: '20px', textAlign: 'center', cursor: 'pointer',
                  background: 'var(--color-surface)', marginBottom: '14px',
                  transition: 'border-color 120ms ease',
                }}
              >
                <Upload size={24} color={file ? 'var(--color-gain)' : 'var(--color-text-muted)'} style={{ margin: '0 auto 8px' }} />
                <div style={{ fontSize: '13px', color: 'var(--color-text-primary)', fontWeight: 500 }}>
                  {file ? file.name : 'Click to select PDF'}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '4px' }}>Accepts .pdf only</div>
                <input
                  ref={fileRef} type="file" accept=".pdf" style={{ display: 'none' }}
                  onChange={e => { setFile(e.target.files?.[0] ?? null); setError('') }}
                />
              </div>

              {error && (
                <div style={{ background: '#FFF5F5', border: '0.5px solid #FECDD3', borderRadius: '8px', padding: '10px 14px', color: '#DC2626', fontSize: '13px', marginBottom: '14px', lineHeight: 1.5 }}>
                  {error}
                </div>
              )}

              <button
                onClick={handleImport}
                disabled={!file || importing}
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: 'none', background: (!file || importing) ? 'var(--color-text-muted)' : 'var(--color-text-primary)', color: 'var(--color-surface)', fontSize: '13.5px', fontFamily: 'inherit', cursor: !file || importing ? 'not-allowed' : 'pointer', fontWeight: 500 }}
              >
                {importing ? 'Parsing PDF… this may take a moment' : 'Import CAS'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
