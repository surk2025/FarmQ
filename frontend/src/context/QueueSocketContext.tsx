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
    const envWs = import.meta.env.VITE_WS_BASE_URL;
    let wsUrl = '';
    if (envWs) {
      wsUrl = `${envWs.replace(/\/$/, '')}/ws/queue/${activeCenterId}`;
    } else if (window.location.port === '5173' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      wsUrl = `${protocol}//${window.location.hostname}:8000/ws/queue/${activeCenterId}`;
    } else {
      wsUrl = `${protocol}//${window.location.host}/ws/queue/${activeCenterId}`;
    }

    let retryCount = 0;
    const maxRetries = 4;

    const connectWs = () => {
      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          setIsConnected(true);
          retryCount = 0;
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
          // Try reconnecting with backoff if within retry limit
          if (retryCount < maxRetries) {
            retryCount += 1;
            reconnectTimeoutRef.current = setTimeout(connectWs, 3000 * retryCount);
          }
        };

        ws.onerror = (err) => {
          console.warn('WebSocket connection notice:', err);
          try {
            ws.close();
          } catch {
            // Safe close
          }
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
