import { Component } from 'react'

class AppErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
          <div className="max-w-lg w-full bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
            <h1 className="text-xl font-semibold text-gray-900 mb-2">
              App could not start
            </h1>
            <p className="text-gray-600 mb-4">
              {this.state.error.message || 'A startup error occurred.'}
            </p>
            <p className="text-sm text-gray-500">
              Check the deployment environment variables and redeploy.
            </p>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default AppErrorBoundary
