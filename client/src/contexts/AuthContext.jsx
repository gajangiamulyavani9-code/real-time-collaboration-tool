import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { authAPI } from '../services/api'
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
      const token = localStorage.getItem('token')
      const savedUser = localStorage.getItem('user')

      if (token && savedUser) {
        try {
          // Verify token is still valid by fetching current user
          const { data } = await authAPI.getCurrentUser()
          setUser(data.data.user)
          setIsAuthenticated(true)
        } catch (error) {
          // Token is invalid or expired
          console.error('Auth initialization failed:', error)
          localStorage.removeItem('token')
          localStorage.removeItem('user')
        }
      } else if (savedUser) {
        // Restore user from localStorage if no API call needed
        setUser(JSON.parse(savedUser))
        setIsAuthenticated(true)
      }

      setIsLoading(false)
    }

    initAuth()
  }, [])

  // Register new user
  const register = useCallback(async (userData) => {
    try {
      setIsLoading(true)
      const { data } = await authAPI.register(userData)
      
      const { user, token } = data.data
      
      localStorage.setItem('token', token)
      localStorage.setItem('user', JSON.stringify(user))
      
      setUser(user)
      setIsAuthenticated(true)
      
      toast.success('Registration successful!')
      return { success: true, user }
    } catch (error) {
      const message = error.response?.data?.message || 'Registration failed'
      toast.error(message)
      return { success: false, error: message }
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Login user
  const login = useCallback(async (credentials) => {
    try {
      setIsLoading(true)
      const { data } = await authAPI.login(credentials)
      
      const { user, token } = data.data
      
      localStorage.setItem('token', token)
      localStorage.setItem('user', JSON.stringify(user))
      
      setUser(user)
      setIsAuthenticated(true)
      
      toast.success(`Welcome back, ${user.name}!`)
      return { success: true, user }
    } catch (error) {
      const message = error.response?.data?.message || 'Login failed'
      toast.error(message)
      return { success: false, error: message }
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Logout user
  const logout = useCallback(async () => {
    try {
      await authAPI.logout()
    } catch (error) {
      console.error('Logout API error:', error)
    } finally {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      setUser(null)
      setIsAuthenticated(false)
      toast.success('Logged out successfully')
    }
  }, [])

  // Update user profile
  const updateProfile = useCallback(async (updates) => {
    try {
      const { data } = await authAPI.updateProfile(updates)
      const updatedUser = data.data.user
      
      localStorage.setItem('user', JSON.stringify(updatedUser))
      setUser(updatedUser)
      
      toast.success('Profile updated successfully')
      return { success: true, user: updatedUser }
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to update profile'
      toast.error(message)
      return { success: false, error: message }
    }
  }, [])

  const value = {
    user,
    isLoading,
    isAuthenticated,
    register,
    login,
    logout,
    updateProfile,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
