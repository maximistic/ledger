'use client'

import { useEffect, useRef, useState } from 'react'
import { X, Upload, CheckCircle, ChevronDown } from 'lucide-react'

type ImportTab = 'holdings' | 'tradebook'

function cleanError(msg?: string): string {
  if (!msg) return 'Something went wrong. Please try again.'
  if (msg.includes('PrismaClient') || msg.includes('prisma') || msg.length > 200) {
    return 'Something went wrong. Please try again.'
  }
  return msg
}

interface HoldingsResult { created: number; updated: number; skipped: number; errors: string[] }
interface TradebookResult {
  processed: number
  created: number
  skipped: number
  stocks: number
  skippedTickers: string[]
  errors: string[]
}

interface Props {
  onClose: () => void
  onSuccess: () => void
}

export default function ImportDialog({ onClose, onSuccess }: Props) {
  const [tab, setTab] = useState<ImportTab>('holdings')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [holdingsResult, setHoldingsResult] = useState<HoldingsResult | null>(null)
  const [tradebookResult, setTradebookResult] = useState<TradebookResult | null>(null)
  const [errorsExpanded, setErrorsExpanded] = useState(false)
  const [skippedExpanded, setSkippedExpanded] = useState(false)

  const overlayRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const accept = tab === 'holdings' ? '.xlsx' : '.csv'
  const isDone = tab === 'holdings' ? !!holdingsResult : !!tradebookResult

  useEffect(() => {
    const handle = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handle)
    return () => document.removeEventListener('keydown', handle)
  }, [onClose])

  function switchTab(t: ImportTab) {
    setTab(t)
    setFile(null)
    setError('')
    setHoldingsResult(null)
    setTradebookResult(null)
    setErrorsExpanded(false)
    setSkippedExpanded(false)
  }

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
    if (!file) return
    setLoading(true)
    setError('')
    try {
      const form = new FormData()
      form.append('file', file)
      const url = tab === 'holdings' ? '/api/stocks/import/holdings' : '/api/stocks/import/tradebook'
      const res = await fetch(url, { method: 'POST', body: form })
      const data = await res.json() as HoldingsResult & TradebookResult & { error?: string }

      if (!res.ok) {
        setError(cleanError(data.error))
        return
      }

      if (tab === 'holdings') setHoldingsResult(data)
      else setTradebookResult(data)
      onSuccess()
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const errorList = tab === 'holdings' ? holdingsResult?.errors : tradebookResult?.errors

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
          padding: '18px 20px 0',
        }}>
          <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
            Import from Zerodha
          </div>
          <button onClick={onClose} style={{ padding: '4px', color: 'var(--color-text-muted)', borderRadius: '6px', lineHeight: 0 }}>
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '20px', padding: '12px 20px 0', borderBottom: '0.5px solid var(--color-border)' }}>
          {(['holdings', 'tradebook'] as ImportTab[]).map(t => (
            <button
              key={t}
              onClick={() => switchTab(t)}
              style={{
                fontSize: '13px',
                fontWeight: tab === t ? 600 : 400,
                color: tab === t ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '0 0 10px',
                borderBottom: tab === t ? '2px solid var(--color-text-primary)' : '2px solid transparent',
                fontFamily: 'inherit',
                textTransform: 'capitalize',
                transition: 'color 160ms ease',
              }}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ padding: '20px' }}>
          {isDone ? (
            <ResultView
              tab={tab}
              holdings={holdingsResult}
              tradebook={tradebookResult}
              errorsExpanded={errorsExpanded}
              setErrorsExpanded={setErrorsExpanded}
              skippedExpanded={skippedExpanded}
              setSkippedExpanded={setSkippedExpanded}
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
                marginBottom: '16px',
                lineHeight: 1.6,
              }}>
                {tab === 'holdings'
                  ? 'Holdings imports your current portfolio snapshot. Best for first-time setup.'
                  : 'Tradebook imports your full buy/sell history.'}
              </div>

              {/* Steps */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                {(tab === 'holdings' ? holdingsSteps : tradebookSteps).map((step, i) => (
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

              {/* Drop zone or file selected */}
              <input
                ref={fileInputRef}
                type="file"
                accept={accept}
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
                  <button onClick={() => setFile(null)} style={{ padding: '3px', color: 'var(--color-text-muted)', borderRadius: '4px', lineHeight: 0 }}>
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
                    transition: 'border-color 160ms ease',
                  }}
                >
                  <Upload size={22} color="var(--color-text-muted)" />
                  <div style={{ fontSize: '13.5px', fontWeight: 500, color: 'var(--color-text-primary)', marginTop: '4px' }}>
                    Drop your file here
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>or browse to upload</div>
                  <div style={{
                    marginTop: '6px', padding: '2px 8px',
                    background: 'var(--color-surface-raised)',
                    border: '0.5px solid var(--color-border)',
                    borderRadius: '4px',
                    fontSize: '10px', fontWeight: 700, letterSpacing: '0.5px',
                    color: 'var(--color-text-muted)',
                  }}>
                    {tab === 'holdings' ? 'XLSX' : 'CSV'}
                  </div>
                </div>
              )}

              {error && (
                <div style={{ fontSize: '12px', color: 'var(--color-loss)', marginTop: '10px' }}>{error}</div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 20px', borderTop: '0.5px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          {isDone ? (
            <button onClick={onClose} style={primaryBtn}>Done</button>
          ) : (
            <>
              <button onClick={onClose} style={ghostBtn}>Cancel</button>
              <button
                onClick={handleImport}
                disabled={!file || loading}
                style={{ ...primaryBtn, opacity: (!file || loading) ? 0.6 : 1, cursor: (!file || loading) ? 'not-allowed' : 'pointer' }}
              >
                {loading ? 'Importing…' : 'Import'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function ResultView({
  tab, holdings, tradebook,
  errorsExpanded, setErrorsExpanded,
  skippedExpanded, setSkippedExpanded,
}: {
  tab: ImportTab
  holdings: HoldingsResult | null
  tradebook: TradebookResult | null
  errorsExpanded: boolean
  setErrorsExpanded: (v: boolean) => void
  skippedExpanded: boolean
  setSkippedExpanded: (v: boolean) => void
}) {
  const rows = tab === 'holdings'
    ? [
        { label: 'Stocks created',  value: holdings?.created ?? 0, color: 'var(--color-gain)' },
        { label: 'Stocks updated',  value: holdings?.updated ?? 0, color: 'var(--color-text-primary)' },
        { label: 'Errors',          value: holdings?.errors.length ?? 0, color: holdings && holdings.errors.length > 0 ? 'var(--color-loss)' : 'var(--color-text-muted)' },
      ]
    : [
        { label: 'Transactions added',    value: tradebook?.created ?? 0,   color: 'var(--color-gain)' },
        { label: 'Skipped (duplicates)',  value: tradebook?.skipped ?? 0,   color: 'var(--color-text-primary)' },
        { label: 'Stocks affected',       value: tradebook?.stocks ?? 0,    color: 'var(--color-text-primary)' },
        { label: 'Errors',                value: tradebook?.errors.length ?? 0, color: tradebook && tradebook.errors.length > 0 ? 'var(--color-loss)' : 'var(--color-text-muted)' },
      ]

  const errors         = tab === 'holdings' ? (holdings?.errors ?? []) : (tradebook?.errors ?? [])
  const skippedTickers = tab === 'tradebook' ? (tradebook?.skippedTickers ?? []) : []

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

      {/* Skipped tickers — informational, not an error */}
      {skippedTickers.length > 0 && (
        <div style={{ marginTop: '12px' }}>
          <button
            onClick={() => setSkippedExpanded(!skippedExpanded)}
            style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '12px', color: 'var(--color-text-muted)', fontFamily: 'inherit',
              padding: '0',
            }}
          >
            <ChevronDown size={13} style={{ transform: skippedExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 160ms' }} />
            {skippedTickers.length} ticker{skippedTickers.length > 1 ? 's' : ''} skipped (not in your holdings)
          </button>
          {skippedExpanded && (
            <div style={{
              marginTop: '8px', background: 'var(--color-surface)',
              border: '0.5px solid var(--color-border)',
              borderRadius: '8px', padding: '10px 14px',
            }}>
              <div style={{ fontSize: '11.5px', color: 'var(--color-text-muted)', marginBottom: '8px', lineHeight: 1.5 }}>
                Import your <strong>Holdings</strong> file first, then import Tradebook to add transaction history.
              </div>
              <div style={{ maxHeight: '100px', overflowY: 'auto' }}>
                {skippedTickers.map((t, i) => (
                  <div key={i} style={{ fontSize: '12px', color: 'var(--color-text-muted)', padding: '2px 0', fontVariantNumeric: 'tabular-nums' }}>{t}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Errors */}
      {errors.length > 0 && (
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
            {errors.length} error{errors.length > 1 ? 's' : ''}
          </button>
          {errorsExpanded && (
            <div style={{
              marginTop: '8px', background: 'var(--color-surface)',
              border: '0.5px solid var(--color-border)',
              borderRadius: '8px', padding: '10px 14px',
              maxHeight: '120px', overflowY: 'auto',
            }}>
              {errors.map((e, i) => (
                <div key={i} style={{ fontSize: '11.5px', color: 'var(--color-loss)', padding: '2px 0' }}>{e}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const holdingsSteps = [
  'Go to console.zerodha.com → Portfolio → Holdings',
  'Click the download icon at the top right of the holdings table',
  'Download as XLSX and upload below',
]

const tradebookSteps = [
  'Go to console.zerodha.com → Reports → Tradebook',
  'Select your date range and click Filter',
  'Click Download and save as CSV, then upload below',
]

const ghostBtn: React.CSSProperties = {
  padding: '7px 16px', borderRadius: '6px', border: '0.5px solid var(--color-border)',
  background: 'transparent', color: 'var(--color-text-secondary)',
  fontSize: '13px', fontFamily: 'inherit', cursor: 'pointer',
}
const primaryBtn: React.CSSProperties = {
  padding: '7px 18px', borderRadius: '6px', border: 'none',
  background: 'var(--color-text-primary)', color: 'var(--color-surface)',
  fontSize: '13px', fontFamily: 'inherit', cursor: 'pointer',
}
