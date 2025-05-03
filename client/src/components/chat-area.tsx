import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Maximize2, BrainCircuit } from "lucide-react";
import { Contact, Message } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AIConfigDialog } from "./ai-config-dialog";

interface ChatAreaProps {
  contact: Contact;
  messages: Message[];
}

export default function ChatArea({ contact, messages }: ChatAreaProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch messages for this contact
  const { data: fetchedMessages } = useQuery({
    queryKey: [`/api/contacts/${contact.id}/messages`],
    enabled: !!contact?.id,
  });
  
  // Fetch auto-responder config
  const { data: autoResponderConfig } = useQuery({
    queryKey: [`/api/auto-responders/${contact.id}`],
    enabled: !!contact?.id,
  });

  // Combine passed messages with fetched ones
  const combinedMessages = Array.isArray(fetchedMessages) ? fetchedMessages : [];
  const allMessages = [...combinedMessages, ...messages].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [allMessages]);

  return (
    <>
      {/* Conversation Header */}
      <div className="bg-pazap-dark-surface border-b border-pazap-dark-border p-3 flex items-center">
        <div className="flex items-center flex-1">
          <div className={`h-10 w-10 rounded-full ${contact.isGroup ? 'bg-pazap-dark-blue' : 'bg-pazap-dark-orange'} text-white flex items-center justify-center mr-3 animate-pulse`}>
            <span className="font-semibold">
              {contact.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
            </span>
          </div>
          <div>
            <h3 className="font-medium text-pazap-dark-text">{contact.name}</h3>
            <p className="text-xs text-pazap-dark-text-secondary">
              {contact.isGroup 
                ? `${contact.participants?.length || 0} participantes` 
                : 'Contato'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {autoResponderConfig?.enabled && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="p-1.5 rounded-full bg-pazap-dark-blue/20 text-pazap-dark-blue">
                    <BrainCircuit className="h-4 w-4" />
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Respostas automáticas ativadas</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          <AIConfigDialog contact={contact} />
          <button className="p-2 rounded-full text-pazap-dark-text-secondary hover:bg-pazap-dark-bg transition-colors">
            <Maximize2 className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-4 bg-pazap-dark-bg">
        {allMessages.length === 0 ? (
          <div className="flex justify-center items-center h-full text-pazap-dark-text-secondary">
            <p>Nenhuma mensagem ainda. Comece a conversar!</p>
          </div>
        ) : (
          allMessages.map((message) => (
            <div 
              key={message.id} 
              className={`flex ${message.fromMe ? 'justify-end' : 'justify-start'} mb-3 animate-fade-in`}
            >
              <div 
                className={`rounded-lg py-2 px-3 max-w-md shadow-sm ${
                  message.fromMe 
                    ? 'bg-pazap-dark-orange text-white' 
                    : 'bg-pazap-dark-surface text-pazap-dark-text'
                }`}
              >
                <div dangerouslySetInnerHTML={{ __html: message.content }} />
                <span 
                  className={`text-xs block text-right mt-1 ${
                    message.fromMe ? 'text-white text-opacity-80' : 'text-pazap-dark-text-secondary'
                  }`}
                >
                  {formatDistanceToNow(new Date(message.timestamp), { 
                    addSuffix: true,
                    locale: ptBR
                  })}
                </span>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
    </>
  );
}
