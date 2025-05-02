import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import ContactList from "@/components/contact-list";
import QRCode from "@/components/qr-code";
import ChatArea from "@/components/chat-area";
import MessageComposer from "@/components/message-composer";
import ScheduledMessages from "@/components/scheduled-messages";
import { useWhatsAppContext } from "@/hooks/use-whatsapp";
import { useToast } from "@/hooks/use-toast";
import { Contact } from "@shared/schema";

export default function Home() {
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [showScheduledMessages, setShowScheduledMessages] = useState(false);
  const { connected, messages, connect } = useWhatsAppContext();
  const { toast } = useToast();

  // Check WhatsApp connection status
  const { data: statusData } = useQuery({
    queryKey: ['/api/whatsapp/status'],
    refetchInterval: 10000,
  });

  // Set up WebSocket connection for real-time updates
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log('WebSocket connected');
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
          case 'qr':
            // QR code received
            console.log('QR code received');
            break;
          case 'authenticated':
            // WhatsApp authenticated
            console.log('WhatsApp authenticated');
            toast({
              title: "WhatsApp Connected",
              description: "Your WhatsApp account is now connected.",
              duration: 3000,
            });
            break;
          case 'message':
            // New message received
            console.log('New message:', data.data);
            break;
        }
      } catch (e) {
        console.error('Error processing WebSocket message:', e);
      }
    };

    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    socket.onclose = () => {
      console.log('WebSocket disconnected');
    };

    return () => {
      socket.close();
    };
  }, [toast]);

  const handleContactSelect = (contact: Contact) => {
    setSelectedContact(contact);
  };

  const handleConnectWhatsApp = () => {
    connect();
  };

  const toggleScheduledMessages = () => {
    setShowScheduledMessages(!showScheduledMessages);
  };

  return (
    <div className="flex flex-col h-screen bg-whatsapp-bg">
      {/* Header */}
      <header className="bg-whatsapp-green text-white p-4 shadow-md">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold">WhatsApp Messaging System</h1>
          <div className="flex items-center">
            <span className={`h-3 w-3 rounded-full mr-2 ${connected ? 'bg-green-500' : 'bg-red-500'}`}></span>
            <span>{connected ? 'Conectado' : 'Desconectado'}</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="bg-white w-80 flex flex-col border-r border-gray-300 h-full">
          {/* QR Code Section */}
          {!connected && (
            <QRCode onConnect={handleConnectWhatsApp} />
          )}

          {/* Contact List */}
          <ContactList onSelectContact={handleContactSelect} />

          {/* Scheduled Messages Button */}
          <div className="p-3 border-t border-gray-200">
            <button 
              onClick={toggleScheduledMessages}
              className="w-full flex items-center justify-center bg-gray-100 text-whatsapp-green px-4 py-2 rounded-md hover:bg-gray-200 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Mensagens Agendadas
            </button>
          </div>
        </aside>

        {/* Main Chat Area */}
        <main className="flex-1 flex flex-col h-full">
          {selectedContact ? (
            <>
              <ChatArea 
                contact={selectedContact} 
                messages={messages.filter(msg => msg.contactId === selectedContact.id)} 
              />
              <MessageComposer contact={selectedContact} />
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center bg-white text-center px-4">
              <div className="mb-8">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-24 w-24 text-whatsapp-green mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold mb-2 text-gray-800">Sistema de Mensagens WhatsApp</h2>
              <p className="text-gray-600 max-w-lg">
                Conecte-se usando o QR code no painel lateral. Selecione um contato ou grupo para enviar mensagens ou agendar envios para um momento específico.
              </p>
            </div>
          )}
        </main>
      </div>

      {/* Scheduled Messages Modal */}
      {showScheduledMessages && (
        <ScheduledMessages onClose={toggleScheduledMessages} />
      )}
    </div>
  );
}
