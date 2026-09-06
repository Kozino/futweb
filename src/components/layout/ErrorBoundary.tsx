import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button, Card, Icon } from '@/components/ui'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * Route-level safety net.
 *
 * Without this, any uncaught error thrown while rendering a page (a bad
 * shape coming back from Supabase, an undefined field, etc.) unmounts the
 * entire React tree and the user is left looking at a blank page with no
 * indication anything went wrong — e.g. clicking a player in the squad list
 * and landing on nothing. This catches that, logs it, and gives the user a
 * way back instead of a dead screen.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary] Unhandled error while rendering:', error, info.componentStack)
  }

  private reset = () => {
    this.setState({ error: null })
    window.location.assign('/')
  }

  render() {
    if (this.state.error) {
      return (
        <div className="grid min-h-[60vh] place-items-center p-6">
          <Card className="max-w-md p-8 text-center">
            <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-red-50 text-red-500">
              <Icon name="alert" size={22} />
            </div>
            <h2 className="text-sm font-bold">Something went wrong loading this page</h2>
            <p className="mt-2 text-xs text-ink-500">
              This has been logged. You can try again, or head back to your dashboard.
            </p>
            {import.meta.env.DEV && (
              <pre className="mt-4 max-h-40 overflow-auto rounded-lg bg-ink-50 p-3 text-left text-[10px] text-ink-600">
                {this.state.error.message}
              </pre>
            )}
            <div className="mt-5 flex justify-center gap-2">
              <Button variant="outline" onClick={() => this.setState({ error: null })}>Try again</Button>
              <Button onClick={this.reset}>Back to dashboard</Button>
            </div>
          </Card>
        </div>
      )
    }
    return this.props.children
  }
}
