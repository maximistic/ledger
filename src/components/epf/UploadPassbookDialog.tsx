'use client'

import { useEffect, useRef, useState } from 'react'
import { X, Upload, CheckCircle, Loader2 } from 'lucide-react'
import { formatINR } from '@/lib/utils'

interface Props {
  onClose: () => void
  onSuccess: () => void
}

interface ImportResult {
  transactions: { created: number; skipped: number }
  autoDetected: { employeeMonthly: number; employerMonthly: number }
}

function cleanError(msg?: string): string {
  if (!msg) return 'Something went wrong. Please try again.'
  if (msg.includes('PrismaClient') || msg.includes('prisma') || msg.length > 200)
    return 'Something went wrong. Please try again.'
  return msg
}

const steps = [
  'Go to passbook.epfindia.gov.in and log in with UAN',
  'Select your Member ID and click View Passbook',
  'Download as PDF and upload below',
]

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

export default function UploadPassbookDialog({ onClose, onSuccess }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<ImportResult | null>(null)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [resetting, setResetting] = useState(false)

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
    if (f && f.type === 'application/pdf') { setFile(f); setError('') }
    else if (f) setError('Please upload a PDF file')
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) { setFile(f); setError('') }
    e.target.value = ''
  }

  async function handleReset() {
    setResetting(true)
    try {
      const res = await fetch('/api/epf', { method: 'DELETE' })
      if (!res.ok && res.status !== 404) {
        setError('Failed to clear EPF data. Please try again.')
        setShowResetConfirm(false)
        return
      }
      setFile(null)
      setResult(null)
      setError('')
      setShowResetConfirm(false)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setResetting(false)
    }
  }

  async function handleUpload() {
    if (!file) return
    setLoading(true)
    setError('')
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/epf/import', { method: 'POST', body: form })
      const data = await res.json() as ImportResult & { error?: string }
      if (!res.ok) {
        setError(cleanError(data.error))
        return
      }
      setResult(data)
      // onSuccess is called by the Done button so the result view is visible first
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

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
            Upload UAN passbook
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
            <ResultView result={result} />
          ) : (
            <>
              {/* Description */}
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
                Your UAN passbook PDF contains your full EPF contribution history. Uploading it will automatically fill your account details and transaction history.
              </div>

              {/* Steps */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
                {steps.map((step, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <div style={{
                      width: '20px', height: '20px', minWidth: '20px', borderRadius: '50%',
                      background: 'var(--color-text-primary)', color: 'var(--color-surface)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '10px', fontWeight: 700, flexShrink: 0,
                    }}>
                      {i + 1}
                    </div>
                    <div style={{ fontSize: '12.5px', color: 'var(--color-text-secondary)', lineHeight: 1.5, paddingTop: '1px' }}>
                      {step}
                    </div>
                  </div>
                ))}
                <div style={{ paddingLeft: '30px', fontSize: '11.5px', color: 'var(--color-text-muted)' }}>
                  EPFO passbooks are not password protected
                </div>
              </div>

              {/* Dropzone / file display */}
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
                    onClick={() => { setFile(null); setError('') }}
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
                    Drop your passbook PDF here
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
                <div style={{ fontSize: '12px', color: 'var(--color-loss)', marginTop: '10px', lineHeight: 1.5 }}>
                  {error.startsWith('Could not parse') || error.startsWith('No transactions')
                    ? `Could not parse passbook: ${error}`
                    : error}
                </div>
              )}

              {/* Reset link */}
              <div style={{ marginTop: '14px' }}>
                {!showResetConfirm ? (
                  <button
                    onClick={() => setShowResetConfirm(true)}
                    style={{
                      border: 'none', background: 'transparent', cursor: 'pointer',
                      padding: 0, fontSize: '11.5px', color: '#DC2626',
                      textDecoration: 'underline', fontFamily: 'inherit',
                    }}
                  >
                    Want to start fresh? Clear all data first
                  </button>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '12px', color: '#DC2626' }}>Clear all EPF data?</span>
                    <button
                      onClick={() => setShowResetConfirm(false)}
                      style={{
                        border: '0.5px solid var(--color-border)', background: 'transparent',
                        borderRadius: '5px', padding: '3px 10px', fontSize: '11.5px',
                        color: 'var(--color-text-secondary)', fontFamily: 'inherit', cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleReset}
                      disabled={resetting}
                      style={{
                        border: 'none', background: '#DC2626', color: '#fff',
                        borderRadius: '5px', padding: '3px 10px', fontSize: '11.5px',
                        fontFamily: 'inherit', cursor: resetting ? 'not-allowed' : 'pointer',
                        opacity: resetting ? 0.7 : 1,
                        display: 'flex', alignItems: 'center', gap: '4px',
                      }}
                    >
                      {resetting && <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />}
                      {resetting ? 'Clearing…' : 'Clear data'}
                    </button>
                  </div>
                )}
              </div>
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
            <button onClick={() => { onSuccess(); onClose() }} style={primaryBtn}>
              Done
            </button>
          ) : (
            <>
              <button onClick={onClose} style={ghostBtn}>Cancel</button>
              <button
                onClick={handleUpload}
                disabled={!file || loading}
                style={{ ...primaryBtn, opacity: !file || loading ? 0.6 : 1, cursor: !file || loading ? 'not-allowed' : 'pointer' }}
              >
                {loading && <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />}
                {loading ? 'Parsing passbook…' : 'Upload'}
              </button>
            </>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function ResultView({ result }: { result: ImportResult }) {
  const rows = [
    {
      label: 'Transactions imported',
      value: result.transactions.created,
      color: result.transactions.created > 0 ? 'var(--color-gain)' : 'var(--color-text-muted)',
    },
    {
      label: 'Transactions skipped (duplicates)',
      value: result.transactions.skipped,
      color: 'var(--color-text-primary)',
    },
    {
      label: 'Account updated',
      value: '✓',
      color: 'var(--color-gain)',
    },
  ]

  const hasAutoDetected =
    result.autoDetected.employeeMonthly > 0 || result.autoDetected.employerMonthly > 0

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
        <CheckCircle size={16} color="var(--color-gain)" />
        <span style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
          Import complete
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', marginBottom: hasAutoDetected ? '12px' : '0' }}>
        {rows.map((r, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'var(--color-surface)',
            padding: '10px 14px',
            borderRadius: i === 0 ? '8px 8px 0 0' : i === rows.length - 1 ? '0 0 8px 8px' : '0',
            border: '0.5px solid var(--color-border)',
          }}>
            <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{r.label}</span>
            <span style={{ fontSize: '14px', fontWeight: 700, color: r.color, fontVariantNumeric: 'tabular-nums' }}>
              {r.value}
            </span>
          </div>
        ))}
      </div>

      {hasAutoDetected && (
        <div style={{
          background: 'var(--color-surface)',
          border: '0.5px solid var(--color-border)',
          borderRadius: '8px',
          padding: '10px 14px',
          fontSize: '12px',
          color: 'var(--color-text-secondary)',
          lineHeight: 1.6,
        }}>
          <span style={{ fontWeight: 600 }}>Auto-detected: </span>
          Employee {formatINR(result.autoDetected.employeeMonthly)}/month · Employer {formatINR(result.autoDetected.employerMonthly)}/month
          <div style={{ color: 'var(--color-text-muted)', marginTop: '2px' }}>
            You can adjust these in Configure.
          </div>
        </div>
      )}
    </div>
  )
}
