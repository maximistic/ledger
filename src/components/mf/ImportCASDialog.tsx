'use client'

import { useEffect, useRef, useState } from 'react'
import { X, Upload, CheckCircle, ChevronDown, Loader2 } from 'lucide-react'

interface Props {
  onClose: () => void
  onSuccess: () => void
}

function friendlyError(msg?: string): string {
  if (!msg) return 'Something went wrong. Please try again.'
  const lower = msg.toLowerCase()
  if (lower.includes('not available') || lower.includes('not installed') || lower.includes('cas parser'))
    return 'CAS import is not available in production yet. Please add funds manually for now.'
  if (lower.includes('wrong password') || lower.includes('invalid password') || lower.includes('incorrect password'))
    return 'Incorrect PDF password. Try: PAN + DOB (e.g. ABCDE1234F01011990)'
  if (lower.includes('no fund') || lower.includes('no data') || lower.includes('no mutual fund'))
    return 'No mutual fund data found in this PDF. Make sure you downloaded a Detailed CAS.'
  if (msg.includes('PrismaClient') || msg.includes('prisma') || msg.length > 200)
    return 'Something went wrong. Please try again.'
  return msg
}

const fieldLabel: React.CSSProperties = {
  fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.6px',
  fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '5px',
}
const fieldInput: React.CSSProperties = {
  width: '100%', background: 'var(--color-surface)',
  border: '0.5px solid var(--color-border)', borderRadius: '7px',
  padding: '8px 11px', fontSize: '13.5px', color: 'var(--color-text-primary)',
  fontFamily: 'inherit', outline: 'none',
}
const errText: React.CSSProperties = {
  fontSize: '11px', color: 'var(--color-loss)', marginTop: '3px',
}
const ghostBtn: React.CSSProperties = {
  padding: '7px 16px', borderRadius: '6px',
  border: '0.5px solid var(--color-border)', background: 'transparent',
  color: 'var(--color-text-secondary)', fontSize: '13px', fontFamily: 'inherit', cursor: 'pointer',
}
const primaryBtn: React.CSSProperties = {
  padding: '7px 18px', borderRadius: '6px', border: 'none',
  background: 'var(--color-text-primary)', color: 'var(--color-surface)',
  fontSize: '13px', fontFamily: 'inherit', cursor: 'pointer',
  display: 'flex', alignItems: 'center', gap: '6px',
}

const casSteps = [
  'Go to mfcentral.com or camsonline.com',
  'Request a Detailed CAS for all folios',
  'Download the PDF sent to your email',
  'Upload it below along with the PDF password',
]

export default function ImportCASDialog({ onClose, onSuccess }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{
    imported: number; updated: number;
    transactions: { created: number; skipped: number };
    errors: string[]
  } | null>(null)
  const [errorsExpanded, setErrorsExpanded] = useState(false)

  const overlayRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handle = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handle)
    return () => document.removeEventListener('keydown', handle)
  }, [onClose])

  function handleFileDrop(e: React.DragEvent) {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f) { setFile(f); setError('') }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) { setFile(f); setError('') }
    e.target.value = ''
  }

  async function handleImport() {
    if (!file || !password) return
    setLoading(true)
    setError('')
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('password', password)
      const res = await fetch('/api/mf/import/cas', { method: 'POST', body: form })
      const data = await res.json() as {
        imported: number; updated: number;
        transactions: { created: number; skipped: number };
        errors: string[]; error?: string
      }
      if (!res.ok) {
        setError(friendlyError(data.error))
        return
      }
      setResult(data)
      onSuccess()
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const canImport = !!file && !!password && !loading

  return (
    <div
      ref={overlayRef}
      onClick={e => { if (e.target === overlayRef.current) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'var(--overlay-bg)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        className="dialog-panel"
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--color-bg)',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '460px',
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 20px 16px',
          borderBottom: '0.5px solid var(--color-border)',
        }}>
          <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
            Import CAS
          </div>
          <button
            onClick={onClose}
            style={{ padding: '4px', color: 'var(--color-text-muted)', borderRadius: '6px', lineHeight: 0, background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px' }}>
          {result ? (
            <ResultView
              result={result}
              errorsExpanded={errorsExpanded}
              setErrorsExpanded={setErrorsExpanded}
            />
          ) : (
            <>
              {/* Description box */}
              <div style={{
                background: 'var(--color-surface)',
                border: '0.5px solid var(--color-border)',
                borderRadius: '8px',
                padding: '12px 14px',
                fontSize: '12.5px',
                color: 'var(--color-text-secondary)',
                lineHeight: 1.6,
                marginBottom: '16px',
              }}>
                CAS (Consolidated Account Statement) contains all your mutual fund holdings and transaction history across all platforms.
              </div>

              {/* Steps */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                {casSteps.map((step, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <div style={{
                      width: '20px', height: '20px', minWidth: '20px', borderRadius: '50%',
                      background: 'var(--color-text-primary)', color: 'var(--color-surface)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '10px', fontWeight: 700,
                    }}>
                      {i + 1}
                    </div>
                    <div style={{ fontSize: '12.5px', color: 'var(--color-text-secondary)', lineHeight: 1.5, paddingTop: '1px' }}>
                      {step}
                    </div>
                  </div>
                ))}
              </div>

              {/* Password field */}
              <div style={{ marginBottom: '16px' }}>
                <div style={fieldLabel}>PDF Password</div>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Your PAN + DOB (e.g. ABCDE1234F01011990)"
                  style={fieldInput}
                />
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', lineHeight: 1.5, marginTop: '4px' }}>
                  CAS PDFs are password protected. Password is usually PAN number followed by date of birth in DDMMYYYY format.
                </div>
              </div>

              {/* Dropzone */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />

              {file ? (
                <div style={{
                  background: 'var(--color-surface)',
                  border: '0.5px solid var(--color-border)',
                  borderRadius: '8px',
                  padding: '14px 16px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-primary)' }}>{file.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                      {(file.size / 1024).toFixed(1)} KB
                    </div>
                  </div>
                  <button
                    onClick={() => setFile(null)}
                    style={{ padding: '3px', color: 'var(--color-text-muted)', borderRadius: '4px', lineHeight: 0, background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div
                  onDrop={handleFileDrop}
                  onDragOver={e => e.preventDefault()}
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: '1.5px dashed var(--color-border)',
                    borderRadius: '8px',
                    background: 'var(--color-surface)',
                    padding: '28px 20px',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                    cursor: 'pointer',
                  }}
                >
                  <Upload size={22} color="var(--color-text-muted)" />
                  <div style={{ fontSize: '13.5px', fontWeight: 500, color: 'var(--color-text-primary)', marginTop: '4px' }}>
                    Drop your PDF here
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>or browse to upload</div>
                  <div style={{
                    marginTop: '4px', padding: '2px 8px',
                    background: 'var(--color-surface-raised)',
                    border: '0.5px solid var(--color-border)',
                    borderRadius: '4px',
                    fontSize: '10px', fontWeight: 700, letterSpacing: '0.5px',
                    color: 'var(--color-text-muted)',
                  }}>
                    PDF
                  </div>
                </div>
              )}

              {error && (
                <div style={{
                  marginTop: '12px',
                  background: '#FFF5F5',
                  border: '0.5px solid #FECDD3',
                  borderRadius: '8px',
                  padding: '12px 14px',
                  color: '#DC2626',
                  fontSize: '13px',
                  lineHeight: 1.5,
                }}>
                  {error}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 20px',
          borderTop: '0.5px solid var(--color-border)',
          display: 'flex', justifyContent: 'flex-end', gap: '10px',
        }}>
          {result ? (
            <button
              onClick={() => { onSuccess(); onClose() }}
              style={primaryBtn}
            >
              Done
            </button>
          ) : (
            <>
              <button onClick={onClose} style={ghostBtn}>Cancel</button>
              <button
                onClick={handleImport}
                disabled={!canImport}
                style={{ ...primaryBtn, opacity: !canImport ? 0.6 : 1, cursor: !canImport ? 'not-allowed' : 'pointer' }}
              >
                {loading && <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />}
                {loading ? 'Parsing PDF…' : 'Import'}
              </button>
            </>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function ResultView({
  result,
  errorsExpanded,
  setErrorsExpanded,
}: {
  result: { imported: number; updated: number; transactions: { created: number; skipped: number }; errors: string[] }
  errorsExpanded: boolean
  setErrorsExpanded: (v: boolean) => void
}) {
  const rows = [
    {
      label: 'Funds imported',
      value: result.imported,
      color: result.imported > 0 ? 'var(--color-gain)' : 'var(--color-text-muted)',
    },
    {
      label: 'Funds updated',
      value: result.updated,
      color: 'var(--color-text-primary)',
    },
    {
      label: 'Transactions created',
      value: result.transactions.created,
      color: result.transactions.created > 0 ? 'var(--color-gain)' : 'var(--color-text-muted)',
    },
    {
      label: 'Transactions skipped',
      value: result.transactions.skipped,
      color: 'var(--color-text-primary)',
    },
    {
      label: 'Errors',
      value: result.errors.length,
      color: result.errors.length > 0 ? 'var(--color-loss)' : 'var(--color-text-muted)',
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
        <CheckCircle size={16} color="var(--color-gain)" />
        <span style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--color-text-primary)' }}>Import complete</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
        {rows.map((r, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'var(--color-surface)',
            padding: '10px 14px',
            borderRadius: i === 0 ? '8px 8px 0 0' : i === rows.length - 1 ? '0 0 8px 8px' : '0',
            border: '0.5px solid var(--color-border)',
          }}>
            <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{r.label}</span>
            <span style={{ fontSize: '14px', fontWeight: 700, color: r.color, fontVariantNumeric: 'tabular-nums' }}>{r.value}</span>
          </div>
        ))}
      </div>

      {result.errors.length > 0 && (
        <div style={{ marginTop: '10px' }}>
          <button
            onClick={() => setErrorsExpanded(!errorsExpanded)}
            style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '12px', color: 'var(--color-loss)', fontFamily: 'inherit',
              padding: '0',
            }}
          >
            <ChevronDown size={13} style={{ transform: errorsExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 160ms' }} />
            {result.errors.length} error{result.errors.length > 1 ? 's' : ''}
          </button>
          {errorsExpanded && (
            <div style={{
              marginTop: '8px', background: 'var(--color-surface)',
              border: '0.5px solid var(--color-border)',
              borderRadius: '8px', padding: '10px 14px',
              maxHeight: '120px', overflowY: 'auto',
            }}>
              {result.errors.map((e, i) => (
                <div key={i} style={{ fontSize: '11.5px', color: 'var(--color-loss)', padding: '2px 0' }}>{e}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
