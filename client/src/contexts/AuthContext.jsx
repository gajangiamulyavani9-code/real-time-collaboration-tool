import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

const AuthContext = createContext(null)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  // Check if user is logged in on mount
  useEffect(() => {
    const initAuth = async () => {
      // Get current session
      const { data: { session } } = await supabase.auth.getSession()
      
      if (session) {
        setUser(session.user)
        setIsAuthenticated(true)
      }
      
      setIsLoading(false)
    }

    initAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          setUser(session.user)
          setIsAuthenticated(true)
        } else if (event === 'SIGNED_OUT') {
          setUser(null)
          setIsAuthenticated(false)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  // Register new user
  const register = useCallback(async ({ name, email, password }) => {
    try {
      setIsLoading(true)
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name }
        }
      })
      
      if (error) throw error
      
      toast.success('Registration successful! Check your email to confirm.')
      return { success: true, user: data.user }
    } catch (error) {
      toast.error(error.message || 'Registration failed')
      return { success: false, error: error.message }
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Login user
  const login = useCallback(async ({ email, password }) => {
    try {
      setIsLoading(true)
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })
      
      if (error) throw error
      
      setUser(data.user)
      setIsAuthenticated(true)
      
      toast.success(`Welcome back!`)
      return { success: true, user: data.user }
    } catch (error) {
      toast.error(error.message || 'Login failed')
      return { success: false, error: error.message }
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Logout user
  const logout = useCallback(async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      
      setUser(null)
      setIsAuthenticated(false)
      toast.success('Logged out successfully')
    } catch (error) {
      toast.error(error.message || 'Logout failed')
    }
  }, [])

  const value = {
    user,
    isLoading,
    isAuthenticated,
    register,
    login,
    logout,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
