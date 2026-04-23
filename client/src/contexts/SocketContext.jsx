import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import socketService from '../services/socket'
import { useAuth } from './AuthContext'

const SocketContext = createContext(null)

export const useSocket = () => {
  const context = useContext(SocketContext)
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider')
  }
  return context
}

export const SocketProvider = ({ children }) => {
  const { isAuthenticated } = useAuth()
  const [isConnected, setIsConnected] = useState(false)

  // Connect socket when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      const socket = socketService.connect()
      
      if (socket) {
        setIsConnected(socket.connected)
        
        socket.on('connect', () => setIsConnected(true))
        socket.on('disconnect', () => setIsConnected(false))
      }
    } else {
      socketService.disconnect()
      setIsConnected(false)
    }

    return () => {
      socketService.disconnect()
    }
  }, [isAuthenticated])

  // Socket actions
  const joinDocument = useCallback((documentId) => {
    socketService.joinDocument(documentId)
  }, [])

  const leaveDocument = useCallback((documentId) => {
    socketService.leaveDocument(documentId)
  }, [])

  const sendDocumentChange = useCallback((documentId, content, operation) => {
    socketService.sendDocumentChange(documentId, content, operation)
  }, [])

  const sendCursorMove = useCallback((documentId, cursor) => {
    socketService.sendCursorMove(documentId, cursor)
  }, [])

  const sendMessage = useCallback((documentId, content) => {
    socketService.sendMessage(documentId, content)
  }, [])

  const sendTyping = useCallback((documentId, isTyping) => {
    socketService.sendTyping(documentId, isTyping)
  }, [])

  const requestSave = useCallback((documentId, content) => {
    socketService.requestSave(documentId, content)
  }, [])

  const subscribe = useCallback((event, callback) => {
    socketService.on(event, callback)
    
    // Return unsubscribe function
    return () => {
      socketService.off(event, callback)
    }
  }, [])

  const value = {
    isConnected,
    joinDocument,
    leaveDocument,
    sendDocumentChange,
    sendCursorMove,
    sendMessage,
    sendTyping,
    requestSave,
    subscribe,
  }

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  )
}
