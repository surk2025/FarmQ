import React, { createContext, useContext, useEffect, useRef, useState } from 'react';

interface QueueSocketEvent {
  type: string;
  centerId?: string;
  completedToken?: number;
  nowProcessing?: number;
  activeQueue?: any[];
  timestamp?: string;
  message?: string;
}

interface QueueSocketContextType {
  isConnected: boolean;
  activeCenterId: string | null;
  subscribeToCenter: (centerId: string) => void;
  latestEvent: QueueSocketEvent | null;
  lastUpdatedTime: string;
}

const QueueSocketContext = createContext<QueueSocketContextType | undefined>(undefined);

export const QueueSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [activeCenterId, setActiveCenterId] = useState<string | null>(null);
  const [latestEvent, setLatestEvent] = useState<QueueSocketEvent | null>(null);
  const [lastUpdatedTime, setLastUpdatedTime] = useState<string>('Just now');
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<any>(null);

  const subscribeToCenter = (centerId: string) => {
    if (centerId !== activeCenterId) {
      setActiveCenterId(centerId);
    }
  };

  useEffect(() => {
    if (!activeCenterId) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    // Vite proxy handles /ws or direct to 8000
    const wsUrl = `${protocol}//${host}:8000/ws/queue/${activeCenterId}`;

    const connectWs = () => {
      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          setIsConnected(true);
          console.log(`WebSocket connected to center: ${activeCenterId}`);
        };

        ws.onmessage = (event) => {
          try {
            const data: QueueSocketEvent = JSON.parse(event.data);
            setLatestEvent(data);
            setLastUpdatedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
          } catch {
            // Ignore non-json pings
          }
        };

        ws.onclose = () => {
          setIsConnected(false);
          // Try reconnecting in 3 seconds
          reconnectTimeoutRef.current = setTimeout(connectWs, 3000);
        };

        ws.onerror = (err) => {
          console.warn('WebSocket error:', err);
          ws.close();
        };
      } catch (e) {
        console.warn('Failed to initialize WebSocket:', e);
      }
    };

    connectWs();

    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [activeCenterId]);

  return (
    <QueueSocketContext.Provider value={{
      isConnected,
      activeCenterId,
      subscribeToCenter,
      latestEvent,
      lastUpdatedTime
    }}>
      {children}
    </QueueSocketContext.Provider>
  );
};

export const useQueueSocket = () => {
  const context = useContext(QueueSocketContext);
  if (!context) {
    throw new Error('useQueueSocket must be used within a QueueSocketProvider');
  }
  return context;
};
