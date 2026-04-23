import { io } from 'socket.io-client'
import toast from 'react-hot-toast'

class SocketService {
  constructor() {
    this.socket = null
    this.listeners = new Map()
  }

  // Initialize socket connection
  connect() {
    if (this.socket?.connected) {
      return this.socket
    }

    const token = localStorage.getItem('token')
    
    if (!token) {
      console.warn('No token available for socket connection')
      return null
    }

    this.socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000', {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    })

    this.setupDefaultListeners()
    
    return this.socket
  }

  // Disconnect socket
  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
      this.listeners.clear()
    }
  }

  // Check if connected
  isConnected() {
    return this.socket?.connected || false
  }

  // Setup default event listeners
  setupDefaultListeners() {
    if (!this.socket) return

    this.socket.on('connect', () => {
      console.log('✅ Socket connected:', this.socket.id)
    })

    this.socket.on('disconnect', (reason) => {
      console.log('❌ Socket disconnected:', reason)
      
      if (reason === 'io server disconnect') {
        // Server forced disconnect, try to reconnect
        toast.error('Disconnected from server. Trying to reconnect...')
      }
    })

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error.message)
      
      if (error.message === 'Authentication required') {
        toast.error('Session expired. Please log in again.')
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        window.location.href = '/login'
      }
    })

    this.socket.on('error', (error) => {
      console.error('Socket error:', error)
      toast.error(error.message || 'An error occurred')
    })

    this.socket.on('reconnect', (attemptNumber) => {
      console.log('🔄 Socket reconnected after', attemptNumber, 'attempts')
      toast.success('Reconnected to server')
    })

    this.socket.on('reconnect_attempt', (attemptNumber) => {
      console.log('🔄 Reconnection attempt:', attemptNumber)
    })

    this.socket.on('reconnect_failed', () => {
      console.error('Failed to reconnect to server')
      toast.error('Failed to reconnect. Please refresh the page.')
    })
  }

  // Join a document room
  joinDocument(documentId) {
    if (!this.socket?.connected) {
      console.warn('Socket not connected, cannot join document')
      return
    }

    this.socket.emit('join-document', { documentId })
  }

  // Leave a document room
  leaveDocument(documentId) {
    if (!this.socket?.connected) return

    this.socket.emit('leave-document', { documentId })
  }

  // Send document changes
  sendDocumentChange(documentId, content, operation) {
    if (!this.socket?.connected) return

    this.socket.emit('document-change', { documentId, content, operation })
  }

  // Send cursor position
  sendCursorMove(documentId, cursor) {
    if (!this.socket?.connected) return

    // Throttle cursor updates on the client side
    this.socket.emit('cursor-move', { documentId, cursor })
  }

  // Send chat message
  sendMessage(documentId, content) {
    if (!this.socket?.connected) return

    this.socket.emit('send-message', { documentId, content })
  }

  // Send typing indicator
  sendTyping(documentId, isTyping) {
    if (!this.socket?.connected) return

    this.socket.emit('typing', { documentId, isTyping })
  }

  // Request explicit save
  requestSave(documentId, content) {
    if (!this.socket?.connected) return

    this.socket.emit('save-document', { documentId, content })
  }

  // Subscribe to an event
  on(event, callback) {
    if (!this.socket) {
      console.warn('Socket not initialized, cannot subscribe to:', event)
      return
    }

    // Store listener for cleanup
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event).push(callback)

    this.socket.on(event, callback)
  }

  // Unsubscribe from an event
  off(event, callback) {
    if (!this.socket) return

    if (callback) {
      this.socket.off(event, callback)
      
      // Remove from stored listeners
      const listeners = this.listeners.get(event)
      if (listeners) {
        const index = listeners.indexOf(callback)
        if (index > -1) {
          listeners.splice(index, 1)
        }
      }
    } else {
      // Remove all listeners for this event
      this.socket.off(event)
      this.listeners.delete(event)
    }
  }

  // Remove all listeners
  removeAllListeners() {
    if (!this.socket) return

    this.listeners.forEach((callbacks, event) => {
      callbacks.forEach(callback => {
        this.socket.off(event, callback)
      })
    })
    this.listeners.clear()
  }
}

// Create singleton instance
const socketService = new SocketService()

export default socketService
