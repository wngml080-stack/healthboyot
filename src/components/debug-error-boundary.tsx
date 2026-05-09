'use client'

import React from 'react'

interface State {
  error: Error | null
  componentStack: string | null
}

// 디버그용 ErrorBoundary — error.tsx와 달리 componentStack을 받을 수 있다.
// React 18은 className minify 시에도 컴포넌트 displayName/function name을 stack에 포함.
// (next.config 에서 keep_fnames 켜져 있어야 의미 있음)
export class DebugErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  state: State = { error: null, componentStack: null }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[DebugErrorBoundary]', error, info)
    this.setState({ error, componentStack: info.componentStack ?? null })
  }

  reset = () => {
    this.setState({ error: null, componentStack: null })
  }

  render() {
    if (!this.state.error) return this.props.children

    const { error, componentStack } = this.state

    return (
      <div style={{
        padding: '1.5rem',
        minHeight: '60vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#111',
        color: '#fff',
        fontFamily: 'system-ui, sans-serif',
      }}>
        <div style={{ maxWidth: 480, width: '100%', textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.05rem', marginBottom: '1rem' }}>잠시 후 다시 시도해주세요</h2>
          <div style={{ background: '#7f1d1d33', padding: '0.75rem', borderRadius: '0.5rem', textAlign: 'left', marginBottom: '1.25rem' }}>
            <p style={{ fontSize: '0.75rem', color: '#fca5a5', wordBreak: 'break-word', margin: 0 }}>
              <strong>에러:</strong> {error.message || '(no message)'}
            </p>
            {componentStack && (
              <pre style={{ fontSize: '0.65rem', color: '#fde68a', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: '220px', overflow: 'auto', marginTop: '0.5rem', marginBottom: 0 }}>
                <strong>컴포넌트 스택:</strong>
                {'\n'}{componentStack}
              </pre>
            )}
            {error.stack && (
              <pre style={{ fontSize: '0.6rem', color: '#aaa', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: '180px', overflow: 'auto', marginTop: '0.5rem', marginBottom: 0 }}>
                <strong>JS 스택:</strong>
                {'\n'}{error.stack.split('\n').slice(0, 8).join('\n')}
              </pre>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
            <button onClick={this.reset} style={{ padding: '0.5rem 1.25rem', backgroundColor: '#facc15', color: '#000', border: 'none', borderRadius: '0.375rem', fontWeight: 600, fontSize: '0.85rem' }}>다시 시도</button>
            <button onClick={() => window.location.reload()} style={{ padding: '0.5rem 1.25rem', backgroundColor: '#333', color: '#fff', border: 'none', borderRadius: '0.375rem', fontWeight: 600, fontSize: '0.85rem' }}>새로고침</button>
          </div>
        </div>
      </div>
    )
  }
}
