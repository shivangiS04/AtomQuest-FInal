import { useEffect, useRef, useCallback } from 'react';
import io from 'socket.io-client';

export function useSocket(token, onEvents = {}) {
  const socketRef = useRef(null);

  useEffect(() => {
    const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:4000';
    socketRef.current = io(socketUrl, {
      auth: { token },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    socketRef.current.on('connect', () => {
      console.log('Socket connected');
      onEvents.onConnect?.();
    });

    socketRef.current.on('disconnect', () => {
      console.log('Socket disconnected');
      onEvents.onDisconnect?.();
    });

    socketRef.current.on('error', (err) => {
      console.error('Socket error:', err);
      onEvents.onError?.(err);
    });

    Object.entries(onEvents).forEach(([event, handler]) => {
      if (event.startsWith('on')) {
        const eventName = event.slice(2);
        const eventNameLower = eventName.charAt(0).toLowerCase() + eventName.slice(1);
        if (handler && event !== 'onConnect' && event !== 'onDisconnect' && event !== 'onError') {
          socketRef.current.on(eventNameLower, handler);
        }
      }
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [token]);

  const emit = useCallback((event, data) => {
    if (socketRef.current) {
      socketRef.current.emit(event, data);
    }
  }, []);

  return { socket: socketRef.current, emit };
}
