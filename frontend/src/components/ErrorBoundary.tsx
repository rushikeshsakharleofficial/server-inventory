import { Component, ErrorInfo, ReactNode } from 'react'
import { AlertOctagon, RefreshCw, Copy, Check, ChevronDown, ChevronRight } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  showDetails: boolean
  copied: boolean
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
      copied: false,
    }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo })
    console.error('ErrorBoundary caught an unhandled rendering crash:', error, errorInfo)
  }

  handleCopy = async () => {
    if (!this.state.error) return
    const errorDetails = `Error: ${this.state.error.message}\n\nStack:\n${this.state.error.stack || ''}\n\nComponent Stack:\n${this.state.errorInfo?.componentStack || ''}`
    try {
      await navigator.clipboard.writeText(errorDetails)
      this.setState({ copied: true })
      setTimeout(() => this.setState({ copied: false }), 2000)
    } catch (err) {
      console.error('Failed to copy error details', err)
    }
  }

  handleReload = () => {
    window.location.reload()
  }

  toggleDetails = () => {
    this.setState((prev) => ({ showDetails: !prev }))
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full flex items-center justify-center p-6 bg-black text-[#F4F4FF] selection:bg-[#00D4FF]/30 select-none">
          {/* Background atmosphere decoration */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute top-[10%] left-[20%] w-[400px] h-[400px] rounded-full bg-[#EF4444]/5 blur-[120px]" />
            <div className="absolute bottom-[10%] right-[20%] w-[400px] h-[400px] rounded-full bg-[#00D4FF]/5 blur-[120px]" />
            <div className="absolute inset-0" style={{
              backgroundImage: 'radial-gradient(circle, rgba(0, 212, 255, 0.03) 1px, transparent 1px)',
              backgroundSize: '28px 28px'
            }} />
          </div>

          <div className="relative z-10 w-full max-w-2xl bg-[#080808]/90 border border-[#252540] backdrop-blur-xl rounded-2xl shadow-[0_24_80px_rgba(0,0,0,0.85)] p-8 md:p-10 transition-all duration-300">
            {/* Header Icon */}
            <div className="flex justify-center mb-6">
              <div className="p-4 rounded-2xl bg-[#EF4444]/10 border border-[#EF4444]/20 animate-pulse text-[#EF4444]">
                <AlertOctagon size={48} strokeWidth={1.5} />
              </div>
            </div>

            {/* Error Message */}
            <h1 className="text-2xl font-bold text-center mb-3 text-[#F4F4FF] tracking-tight">
              Console Exception
            </h1>
            <p className="text-center text-[#8B8AB0] text-sm max-w-md mx-auto mb-8 leading-relaxed">
              The application encountered an unexpected rendering failure. We have isolated the crash to protect system telemetry and active queries.
            </p>

            {/* Call to Actions */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
              <button
                onClick={this.handleReload}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#00D4FF] hover:bg-[#00B8E6] text-black font-semibold rounded-lg shadow-[0_0_20px_rgba(0,212,255,0.2)] transition-all duration-200 cursor-pointer"
              >
                <RefreshCw size={16} className="animate-spin-slow" />
                Reload Application
              </button>
              <button
                onClick={this.toggleDetails}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#101018] hover:bg-[#18181F] border border-[#252540] hover:border-[#00D4FF]/30 text-[#F4F4FF] rounded-lg transition-all duration-200 cursor-pointer"
              >
                {this.state.showDetails ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                {this.state.showDetails ? 'Hide Diagnostics' : 'Show Diagnostics'}
              </button>
            </div>

            {/* Diagnostics Panel */}
            {this.state.showDetails && (
              <div className="mt-6 border border-[#252540] rounded-xl overflow-hidden bg-[#05050A] select-text">
                <div className="flex justify-between items-center px-4 py-3 bg-[#101018] border-b border-[#252540]">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#8B8AB0]">
                    Trace Details
                  </span>
                  <button
                    onClick={this.handleCopy}
                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded-sm text-xs text-[#8B8AB0] hover:text-[#00D4FF] hover:bg-[#00D4FF]/10 transition-colors"
                    title="Copy trace details"
                  >
                    {this.state.copied ? (
                      <>
                        <Check size={12} className="text-[#22C55E]" />
                        <span className="text-[#22C55E]">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy size={12} />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="p-4 overflow-x-auto max-h-[300px] font-mono text-[11px] leading-relaxed text-[#EF4444] scrollbar-thin">
                  <div className="font-semibold text-sm text-[#F4F4FF] mb-2">
                    {this.state.error?.name}: {this.state.error?.message}
                  </div>
                  <pre className="text-[#8B8AB0]">
                    {this.state.error?.stack || 'No call stack available'}
                  </pre>
                  {this.state.errorInfo?.componentStack && (
                    <div className="mt-4 border-t border-[#252540]/50 pt-3">
                      <div className="font-semibold text-xs text-[#F4F4FF] mb-1">Component Hierarchy:</div>
                      <pre className="text-[#48486A]">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
