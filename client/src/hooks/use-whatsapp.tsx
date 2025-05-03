import { 
  createContext, 
  useContext, 
  useState, 
  useEffect, 
  useCallback,
  ReactNode 
} from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Contact, Message } from '@shared/schema';

interface WhatsAppContextType {
  connected: boolean;
  loading: boolean;
  error: string | null;
  contacts: Contact[];
  groups: Contact[];
  messages: Message[];
  connect: () => void;
  disconnect: () => void;
  sendMessage: (contactId: number, content: string) => Promise<void>;
}

const WhatsAppContext = createContext<WhatsAppContextType>({
  connected: false,
  loading: false,
  error: null,
  contacts: [],
  groups: [],
  messages: [],
  connect: () => {},
  disconnect: () => {},
  sendMessage: async () => {},
});

export function WhatsAppProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const { toast } = useToast();

  // Check connection status
  const { 
    data: statusData,
    isLoading: statusLoading,
    error: statusError,
    refetch: refetchStatus
  } = useQuery<{ connected: boolean }>({
    queryKey: ['/api/whatsapp/status'],
    refetchInterval: 10000,
  });

  // Fetch contacts
  const { data: contacts = [] } = useQuery<Contact[]>({
    queryKey: ['/api/contacts'],
    enabled: connected,
  });

  // Fetch groups
  const { data: groups = [] } = useQuery<Contact[]>({
    queryKey: ['/api/groups'],
    enabled: connected,
  });

  // Update connection status when status data changes
  useEffect(() => {
    if (statusData?.connected !== undefined) {
      setConnected(statusData.connected);
    }
  }, [statusData]);

  // WebSocket connection for real-time updates
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    console.log('Connecting to WhatsApp Provider WebSocket at:', wsUrl);
    
    let socket: WebSocket | null = null;
    try {
      // Only create a new socket if we're on the main page
      // (this prevents duplicating the socket with QR code component)
      if (!window.location.pathname.includes('/qr-code')) {
        socket = new WebSocket(wsUrl);

        socket.onopen = () => {
          console.log('WhatsApp Provider WebSocket connected');
        };

        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            if (data.type === 'message') {
              // Add incoming message to state
              setMessages(prevMessages => [...prevMessages, data.data]);
            } else if (data.type === 'authenticated') {
              setConnected(true);
              refetchStatus();
              queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
              queryClient.invalidateQueries({ queryKey: ['/api/groups'] });
            }
          } catch (e) {
            console.error('Error processing WebSocket message:', e);
          }
        };

        socket.onerror = (error) => {
          console.error('WebSocket error:', error);
          toast({
            title: "Erro de Conexão",
            description: "Falha ao estabelecer conexão em tempo real",
            variant: "destructive",
          });
        };

        socket.onclose = () => {
          console.log('WebSocket disconnected');
        };
      }
    } catch (error) {
      console.error('Error creating WebSocket:', error);
    }
    
    return () => {
      if (socket) {
        socket.close();
      }
    };
  }, [toast, refetchStatus]);

  // Connect to WhatsApp
  const connect = useCallback(() => {
    // The QR code component handles the actual connection
    // This is just for manual connection triggering if needed
    refetchStatus();
  }, [refetchStatus]);

  // Disconnect from WhatsApp (would need a server endpoint)
  const disconnect = useCallback(() => {
    toast({
      title: "Not Implemented",
      description: "Disconnection functionality is not yet implemented",
    });
  }, [toast]);

  // Send a message
  const sendMessage = useCallback(async (contactId: number, content: string) => {
    try {
      const response = await apiRequest("POST", "/api/messages/send", {
        contactId,
        content,
      });
      
      const newMessage = await response.json();
      setMessages(prev => [...prev, newMessage]);
      
      return newMessage;
    } catch (error) {
      toast({
        title: "Error Sending Message",
        description: String(error),
        variant: "destructive",
      });
      throw error;
    }
  }, [toast]);

  const value = {
    connected,
    loading: statusLoading,
    error: statusError ? String(statusError) : null,
    contacts,
    groups,
    messages,
    connect,
    disconnect,
    sendMessage,
  };

  return (
    <WhatsAppContext.Provider value={value}>
      {children}
    </WhatsAppContext.Provider>
  );
}

export function useWhatsAppContext() {
  const context = useContext(WhatsAppContext);
  if (context === undefined) {
    throw new Error('useWhatsAppContext must be used within a WhatsAppProvider');
  }
  return context;
}
