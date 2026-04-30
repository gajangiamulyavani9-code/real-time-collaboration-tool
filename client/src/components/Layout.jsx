import { Outlet, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { 
  FileText, 
  LogOut, 
  User, 
  Plus,
  Menu,
  X
} from 'lucide-react'
import { useState } from 'react'

const Layout = () => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const displayName = user?.user_metadata?.name || user?.email || 'User'

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/40 bg-[rgba(255,251,244,0.78)] backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center space-x-2">
              <div className="rounded-xl bg-primary-600 p-2 shadow-[0_14px_28px_rgba(54,81,107,0.24)]">
                <FileText className="h-6 w-6 text-white" />
              </div>
              <span className="text-2xl font-semibold font-display text-charcoal-900">CollabDocs</span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center space-x-8">
              <Link 
                to="/"
                className="flex items-center space-x-1 text-charcoal-700 hover:text-charcoal-900 font-medium"
              >
                <FileText className="h-4 w-4" />
                <span>My Documents</span>
              </Link>

              <Link
                to="/templates"
                className="flex items-center space-x-1 text-charcoal-700 hover:text-charcoal-900 font-medium"
              >
                <FileText className="h-4 w-4" />
                <span>Templates</span>
              </Link>
              
              <Link 
                to="/dashboard?create=1"
                className="flex items-center space-x-1 rounded-xl bg-primary-600 px-4 py-2 text-white shadow-[0_14px_28px_rgba(54,81,107,0.22)] transition-colors hover:bg-primary-700"
              >
                <Plus className="h-4 w-4" />
                <span>New Document</span>
              </Link>
            </nav>

            {/* User Menu */}
            <div className="hidden md:flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center">
                  <User className="h-4 w-4 text-primary-600" />
                </div>
                <span className="text-sm font-medium text-charcoal-700">
                  {displayName}
                </span>
              </div>
              
              <button
                onClick={handleLogout}
                className="p-2 text-charcoal-700 hover:text-red-600 transition-colors"
                title="Logout"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>

            {/* Mobile Menu Button */}
            <button
              className="md:hidden p-2 text-charcoal-700"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-white/40 bg-[rgba(255,251,244,0.92)] backdrop-blur-xl">
            <div className="px-4 py-3 space-y-3">
              <Link 
                to="/"
                className="flex items-center space-x-2 text-charcoal-700 py-2"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <FileText className="h-5 w-5" />
                <span>My Documents</span>
              </Link>

              <Link
                to="/templates"
                className="flex items-center space-x-2 text-charcoal-700 py-2"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <FileText className="h-5 w-5" />
                <span>Templates</span>
              </Link>

              <Link
                to="/dashboard?create=1"
                className="flex items-center space-x-2 text-primary-700 py-2 font-medium"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <Plus className="h-5 w-5" />
                <span>New Document</span>
              </Link>
              
              <div className="border-t border-white/40 pt-3">
                <div className="flex items-center space-x-2 py-2">
                  <User className="h-5 w-5 text-charcoal-700" />
                  <span className="font-medium">{displayName}</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center space-x-2 text-red-600 py-2 w-full"
                >
                  <LogOut className="h-5 w-5" />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  )
}

export default Layout
