import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Paperclip, Smile, Clock, Check, X, Image, FileText, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Contact } from "@shared/schema";
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import EmojiPicker, { Theme } from 'emoji-picker-react';

interface MessageComposerProps {
  contact: Contact;
}

export default function MessageComposer({ contact }: MessageComposerProps) {
  const [message, setMessage] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [recurring, setRecurring] = useState("none");
  const [mediaFiles, setMediaFiles] = useState<string[]>([]);
  const [showMediaPreview, setShowMediaPreview] = useState(false);
  const [showFileUploadModal, setShowFileUploadModal] = useState(false);
  const [fileType, setFileType] = useState<"image" | "document" | "contact" | null>(null);
  
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const attachmentMenuRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<ReactQuill>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      return apiRequest("POST", "/api/messages/send", {
        contactId: contact.id,
        content,
      });
    },
    onSuccess: () => {
      setMessage("");
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
      toast({
        title: "Mensagem enviada",
        description: `Mensagem enviada para ${contact.name}`,
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao enviar mensagem",
        description: `${error}`,
        variant: "destructive",
      });
    },
  });

  // Schedule message mutation
  const scheduleMessageMutation = useMutation({
    mutationFn: async (data: { 
      contactId: number; 
      content: string; 
      scheduledTime: string;
      recurring: string;
    }) => {
      return apiRequest("POST", "/api/messages/schedule", data);
    },
    onSuccess: () => {
      setMessage("");
      setShowScheduleModal(false);
      queryClient.invalidateQueries({ queryKey: ['/api/messages/scheduled'] });
      toast({
        title: "Mensagem agendada",
        description: `Mensagem para ${contact.name} agendada com sucesso`,
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao agendar mensagem",
        description: `${error}`,
        variant: "destructive",
      });
    },
  });

  // Handle clicking outside of emoji picker
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        emojiPickerRef.current && 
        !emojiPickerRef.current.contains(event.target as Node) &&
        event.target instanceof Element &&
        !event.target.closest('button[data-emoji-button="true"]')
      ) {
        setShowEmojiPicker(false);
      }

      if (
        attachmentMenuRef.current && 
        !attachmentMenuRef.current.contains(event.target as Node) &&
        event.target instanceof Element &&
        !event.target.closest('button[data-attachment-button="true"]')
      ) {
        setShowAttachmentMenu(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleSendMessage = () => {
    if (!message.trim()) return;
    
    // Extract text content from HTML
    const div = document.createElement('div');
    div.innerHTML = message;
    const textContent = div.textContent || div.innerText || '';
    
    if (!textContent.trim()) {
      toast({
        title: "Mensagem vazia",
        description: "Por favor, digite uma mensagem",
        variant: "destructive",
      });
      return;
    }
    
    sendMessageMutation.mutate(message);
  };

  const handleScheduleMessage = () => {
    if (!message.trim() || !scheduledDate || !scheduledTime) {
      toast({
        title: "Informações incompletas",
        description: "Por favor, preencha todos os campos",
        variant: "destructive",
      });
      return;
    }
    
    const scheduledDateTime = new Date(`${scheduledDate}T${scheduledTime}`);
    
    if (scheduledDateTime <= new Date()) {
      toast({
        title: "Data inválida",
        description: "A data de agendamento deve ser no futuro",
        variant: "destructive",
      });
      return;
    }
    
    scheduleMessageMutation.mutate({
      contactId: contact.id,
      content: message,
      scheduledTime: scheduledDateTime.toISOString(),
      recurring,
    });
  };

  const handleEmojiClick = (emojiData: any) => {
    const emoji = emojiData.emoji;
    
    if (messageInputRef.current) {
      const editor = messageInputRef.current.getEditor();
      const range = editor.getSelection(true);
      editor.insertText(range.index, emoji);
    }
  };

  const handleAttachImage = () => {
    // Mock implementation - would be replaced with actual file picker
    toast({
      title: "Funcionalidade não implementada",
      description: "O anexo de imagens será implementado em uma versão futura",
    });
    setShowAttachmentMenu(false);
  };

  const modules = {
    toolbar: [
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'list': 'ordered' }, { 'list': 'bullet' }],
      ['link'],
      ['clean']
    ]
  };

  return (
    <>
      <div className="bg-white p-3 border-t border-gray-300">
        <div className="flex items-end space-x-2">
          {/* Attachment Button */}
          <button 
            className="p-2 text-gray-500 hover:text-whatsapp-green transition-colors"
            onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
            data-attachment-button="true"
          >
            <Paperclip className="h-6 w-6" />
          </button>

          {/* Emoji Button */}
          <button 
            className="p-2 text-gray-500 hover:text-whatsapp-green transition-colors"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            data-emoji-button="true"
          >
            <Smile className="h-6 w-6" />
          </button>

          {/* Message Input */}
          <div className="flex-1 relative">
            <ReactQuill
              ref={messageInputRef}
              theme="snow"
              value={message}
              onChange={setMessage}
              placeholder="Digite uma mensagem"
              modules={modules}
              className="min-h-[40px] rounded-lg"
            />
            
            {/* Emoji Picker */}
            {showEmojiPicker && (
              <div 
                ref={emojiPickerRef}
                className="absolute bottom-12 left-0 z-50"
              >
                <EmojiPicker 
                  onEmojiClick={handleEmojiClick}
                  theme={Theme.LIGHT}
                  width={320}
                  height={350}
                />
              </div>
            )}

            {/* Attachment Menu */}
            {showAttachmentMenu && (
              <div 
                ref={attachmentMenuRef}
                className="absolute bottom-12 left-0 z-50"
              >
                <div className="bg-white rounded-lg shadow-lg p-3">
                  <div className="grid grid-cols-3 gap-2">
                    <button 
                      className="flex flex-col items-center justify-center p-3 hover:bg-gray-100 rounded-lg transition-colors"
                      onClick={handleAttachImage}
                    >
                      <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center mb-1">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-whatsapp-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <span className="text-xs">Imagem</span>
                    </button>
                    <button className="flex flex-col items-center justify-center p-3 hover:bg-gray-100 rounded-lg transition-colors">
                      <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center mb-1">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <span className="text-xs">Documento</span>
                    </button>
                    <button className="flex flex-col items-center justify-center p-3 hover:bg-gray-100 rounded-lg transition-colors">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mb-1">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <span className="text-xs">Contato</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Schedule Button */}
          <button 
            className="p-2 text-gray-500 hover:text-whatsapp-green transition-colors"
            onClick={() => setShowScheduleModal(true)}
          >
            <Clock className="h-6 w-6" />
          </button>

          {/* Send Button */}
          <button 
            className="p-2 text-white bg-whatsapp-green rounded-full hover:bg-opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleSendMessage}
            disabled={!message.trim() || sendMessageMutation.isPending}
          >
            <Check className="h-6 w-6" />
          </button>
        </div>
      </div>

      {/* Schedule Modal */}
      <Dialog open={showScheduleModal} onOpenChange={setShowScheduleModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Agendar Mensagem</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="date">Data</Label>
              <Input
                id="date"
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="time">Hora</Label>
              <Input
                id="time"
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="recurring">Repetir</Label>
              <Select value={recurring} onValueChange={setRecurring}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma opção" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Não repetir</SelectItem>
                  <SelectItem value="daily">Diariamente</SelectItem>
                  <SelectItem value="weekly">Semanalmente</SelectItem>
                  <SelectItem value="monthly">Mensalmente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowScheduleModal(false)}
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleScheduleMessage}
              disabled={!message.trim() || !scheduledDate || !scheduledTime || scheduleMessageMutation.isPending}
              className="bg-whatsapp-green hover:bg-opacity-90 text-white"
            >
              Agendar Mensagem
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
