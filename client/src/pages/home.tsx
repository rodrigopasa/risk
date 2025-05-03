import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import ContactList from "@/components/contact-list";
import QRCode from "@/components/qr-code";
import ChatArea from "@/components/chat-area";
import MessageComposer from "@/components/message-composer";
import ScheduledMessages from "@/components/scheduled-messages";
import { AIConfigDialog } from "@/components/ai-config-dialog";
import { useWhatsAppContext } from "@/hooks/use-whatsapp";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
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

  // Removendo a conexão WebSocket duplicada
  // Estamos usando o hook useWhatsAppContext para lidar com as atualizações em tempo real

  const handleContactSelect = (contact: Contact) => {
    setSelectedContact(contact);
  };

  const handleConnectWhatsApp = () => {
    connect();
  };

  const toggleScheduledMessages = () => {
    setShowScheduledMessages(!showScheduledMessages);
  };

  const { logout } = useAuth();

  return (
    <div className="flex flex-col h-screen bg-pazap-dark-bg text-pazap-dark-text animate-fade-in">
      {/* Header */}
      <header className="bg-pazap-dark-surface border-b border-pazap-dark-border p-4 shadow-lg">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold gradient-text">PaZap</h1>
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <span className={`h-3 w-3 rounded-full mr-2 ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
              <span>{connected ? 'Conectado' : 'Desconectado'}</span>
            </div>
            <AIConfigDialog contact={selectedContact || undefined} />
            <button 
              onClick={logout} 
              className="bg-pazap-dark-border hover:bg-pazap-dark-orange transition-colors rounded-md px-3 py-1 text-sm"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="bg-pazap-dark-surface w-80 flex flex-col border-r border-pazap-dark-border h-full shadow-md">
          {/* QR Code Section */}
          {!connected && (
            <QRCode onConnect={handleConnectWhatsApp} />
          )}

          {/* Contact List */}
          <ContactList onSelectContact={handleContactSelect} />

          {/* Scheduled Messages Button */}
          <div className="p-3 border-t border-pazap-dark-border">
            <button 
              onClick={toggleScheduledMessages}
              className="w-full flex items-center justify-center bg-pazap-dark-blue text-white px-4 py-2 rounded-md hover:bg-opacity-90 transition-colors shadow-md"
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
            <div className="flex-1 flex flex-col items-center justify-center bg-pazap-dark-bg text-center px-4 animate-fade-in">
              <div className="mb-8 animate-pulse">
                <div className="h-24 w-24 mx-auto rounded-full pazap-gradient flex items-center justify-center text-white text-5xl font-bold">
                  PZ
                </div>
              </div>
              <h2 className="text-2xl font-bold mb-2 gradient-text">Sistema de Mensagens PaZap</h2>
              <p className="text-pazap-dark-text-secondary max-w-lg">
                Conecte-se usando o QR code no painel lateral. Selecione um contato ou grupo para enviar mensagens ou agendar envios para um momento específico.
              </p>
              <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-3xl">
                <div className="bg-pazap-dark-surface p-4 rounded-lg border border-pazap-dark-orange/50 animate-slide-in" style={{animationDelay: '0.1s'}}>
                  <h3 className="text-pazap-dark-orange font-semibold mb-2">Envios Imediatos</h3>
                  <p className="text-sm text-pazap-dark-text-secondary">Envie mensagens de texto, imagens e links para seus contatos em tempo real.</p>
                </div>
                <div className="bg-pazap-dark-surface p-4 rounded-lg border border-pazap-dark-blue/50 animate-slide-in" style={{animationDelay: '0.2s'}}>
                  <h3 className="text-pazap-dark-blue font-semibold mb-2">Agendamentos</h3>
                  <p className="text-sm text-pazap-dark-text-secondary">Programe o envio de mensagens para qualquer horário, até mesmo para daqui alguns minutos.</p>
                </div>
                <div className="bg-pazap-dark-surface p-4 rounded-lg border border-pazap-dark-border animate-slide-in" style={{animationDelay: '0.3s'}}>
                  <h3 className="gradient-text font-semibold mb-2">Integração</h3>
                  <p className="text-sm text-pazap-dark-text-secondary">Acesse todos os seus contatos e grupos diretamente do WhatsApp.</p>
                </div>
              </div>
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
