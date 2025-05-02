import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Maximize2 } from "lucide-react";
import { Contact, Message } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

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

  // Combine passed messages with fetched ones
  const allMessages = [...(fetchedMessages || []), ...messages].sort(
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
      <div className="bg-white p-3 border-b border-gray-300 flex items-center">
        <div className="flex items-center flex-1">
          <div className={`h-10 w-10 rounded-full ${contact.isGroup ? 'bg-indigo-500' : 'bg-whatsapp-lightgreen'} text-white flex items-center justify-center mr-3`}>
            <span className="font-semibold">
              {contact.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
            </span>
          </div>
          <div>
            <h3 className="font-medium">{contact.name}</h3>
            <p className="text-xs text-gray-500">
              {contact.isGroup 
                ? `${contact.participants?.length || 0} participantes` 
                : 'Contato'}
            </p>
          </div>
        </div>
        <div>
          <button className="p-2 rounded-full text-gray-500 hover:bg-gray-100 transition-colors">
            <Maximize2 className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-4 bg-whatsapp-chatbg">
        {allMessages.length === 0 ? (
          <div className="flex justify-center items-center h-full text-gray-500">
            <p>Nenhuma mensagem ainda. Comece a conversar!</p>
          </div>
        ) : (
          allMessages.map((message) => (
            <div 
              key={message.id} 
              className={`flex ${message.fromMe ? 'justify-end' : 'justify-start'} mb-3`}
            >
              <div 
                className={`rounded-lg py-2 px-3 max-w-md ${
                  message.fromMe 
                    ? 'bg-whatsapp-lightgreen text-white' 
                    : 'bg-white text-black'
                }`}
              >
                <div dangerouslySetInnerHTML={{ __html: message.content }} />
                <span 
                  className={`text-xs block text-right mt-1 ${
                    message.fromMe ? 'text-green-100' : 'text-gray-500'
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
