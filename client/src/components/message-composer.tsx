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
    mutationFn: async (data: { content: string; mediaUrls?: string[] }) => {
      return apiRequest("POST", "/api/messages/send", {
        contactId: contact.id,
        content: data.content,
        mediaUrls: data.mediaUrls || [],
      });
    },
    onSuccess: () => {
      setMessage("");
      setMediaFiles([]);
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
    if (!message.trim() && mediaFiles.length === 0) return;
    
    // Extract text content from HTML
    const div = document.createElement('div');
    div.innerHTML = message;
    const textContent = div.textContent || div.innerText || '';
    
    if (!textContent.trim() && mediaFiles.length === 0) {
      toast({
        title: "Mensagem vazia",
        description: "Por favor, digite uma mensagem ou anexe um arquivo",
        variant: "destructive",
      });
      return;
    }
    
    sendMessageMutation.mutate({
      content: message,
      mediaUrls: mediaFiles
    });
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
    
    // Criar a data ajustada para o fuso horário de São Paulo (GMT-3)
    const scheduledDateTime = new Date(`${scheduledDate}T${scheduledTime}`);
    
    // Fuso horário de São Paulo é GMT-3, aplicamos o offset manualmente
    // Esta linha é importante para garantir que o horário seja interpretado 
    // corretamente como horário de São Paulo
    scheduledDateTime.setHours(scheduledDateTime.getHours() - 3);
    
    const now = new Date();
    
    // Adicionar 1 minuto para permitir agendamento imediato mas evitar problemas
    // com envio retroativo (dá um pequeno buffer para processamento)
    const minimumScheduleTime = new Date(now.getTime() + 60000);
    
    if (scheduledDateTime < minimumScheduleTime) {
      toast({
        title: "Data inválida",
        description: "A data de agendamento deve ser pelo menos 1 minuto no futuro",
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

  const handleOpenFileUpload = (type: "image" | "document" | "contact") => {
    setFileType(type);
    setShowFileUploadModal(true);
    setShowAttachmentMenu(false);
  };
  
  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    const reader = new FileReader();
    
    reader.onload = (event) => {
      if (event.target?.result) {
        const dataUrl = event.target.result as string;
        setMediaFiles([...mediaFiles, dataUrl]);
        setShowMediaPreview(true);
        setShowFileUploadModal(false);
        
        toast({
          title: "Arquivo anexado",
          description: `${file.name} foi anexado e será enviado com a mensagem`,
        });
      }
    };
    
    reader.onerror = (error) => {
      toast({
        title: "Erro ao carregar arquivo",
        description: "Não foi possível ler o arquivo selecionado",
        variant: "destructive",
      });
    };
    
    if (fileType === "image") {
      reader.readAsDataURL(file);
    } else {
      reader.readAsDataURL(file);
    }
  };
  
  const handleRemoveMedia = (index: number) => {
    const newMediaFiles = [...mediaFiles];
    newMediaFiles.splice(index, 1);
    setMediaFiles(newMediaFiles);
    
    if (newMediaFiles.length === 0) {
      setShowMediaPreview(false);
    }
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
      <div className="bg-pazap-dark-surface p-3 border-t border-pazap-dark-border">
        {/* Media preview area */}
        {showMediaPreview && mediaFiles.length > 0 && (
          <div className="mb-3 overflow-x-auto whitespace-nowrap">
            <div className="flex space-x-2">
              {mediaFiles.map((file, index) => (
                <div key={index} className="relative">
                  <div className="w-20 h-20 rounded-md bg-pazap-dark-surface border border-pazap-dark-border flex items-center justify-center overflow-hidden">
                    {file.startsWith('data:image') ? (
                      <img 
                        src={file} 
                        alt={`Preview ${index}`} 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <FileText className="h-10 w-10 text-pazap-dark-orange" />
                    )}
                  </div>
                  <button
                    className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full"
                    onClick={() => handleRemoveMedia(index)}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-end space-x-2">
          {/* Attachment Button */}
          <button 
            className="p-2 text-pazap-dark-text-secondary hover:text-pazap-dark-orange transition-colors"
            onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
            data-attachment-button="true"
          >
            <Paperclip className="h-6 w-6" />
          </button>

          {/* Emoji Button */}
          <button 
            className="p-2 text-pazap-dark-text-secondary hover:text-pazap-dark-orange transition-colors"
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
                <div className="bg-pazap-dark-surface rounded-lg shadow-lg p-3 border border-pazap-dark-border">
                  <div className="grid grid-cols-3 gap-2">
                    <button 
                      className="flex flex-col items-center justify-center p-3 hover:bg-pazap-dark-bg rounded-lg transition-colors"
                      onClick={() => handleOpenFileUpload("image")}
                    >
                      <div className="w-10 h-10 rounded-full bg-pazap-dark-surface flex items-center justify-center mb-1 border border-pazap-dark-orange">
                        <Image className="h-5 w-5 text-pazap-dark-orange" />
                      </div>
                      <span className="text-xs text-pazap-dark-text">Imagem</span>
                    </button>
                    <button 
                      className="flex flex-col items-center justify-center p-3 hover:bg-pazap-dark-bg rounded-lg transition-colors"
                      onClick={() => handleOpenFileUpload("document")}
                    >
                      <div className="w-10 h-10 rounded-full bg-pazap-dark-surface flex items-center justify-center mb-1 border border-pazap-dark-blue">
                        <FileText className="h-5 w-5 text-pazap-dark-blue" />
                      </div>
                      <span className="text-xs text-pazap-dark-text">Documento</span>
                    </button>
                    <button 
                      className="flex flex-col items-center justify-center p-3 hover:bg-pazap-dark-bg rounded-lg transition-colors"
                      onClick={() => handleOpenFileUpload("contact")}
                    >
                      <div className="w-10 h-10 rounded-full bg-pazap-dark-surface flex items-center justify-center mb-1 border border-pazap-dark-blue">
                        <User className="h-5 w-5 text-pazap-dark-blue" />
                      </div>
                      <span className="text-xs text-pazap-dark-text">Contato</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Schedule Button */}
          <button 
            className="p-2 text-pazap-dark-text-secondary hover:text-pazap-dark-orange transition-colors"
            onClick={() => setShowScheduleModal(true)}
          >
            <Clock className="h-6 w-6" />
          </button>

          {/* Send Button */}
          <button 
            className="p-2 text-white bg-pazap-dark-orange rounded-full hover:bg-opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleSendMessage}
            disabled={(!message.trim() && mediaFiles.length === 0) || sendMessageMutation.isPending}
          >
            <Check className="h-6 w-6" />
          </button>
        </div>
      </div>
      
      {/* Hidden file input for uploads */}
      <input 
        type="file" 
        ref={fileInputRef}
        className="hidden"
        onChange={handleFileSelected}
        accept={fileType === "image" ? "image/*" : fileType === "document" ? ".pdf,.doc,.docx,.txt,.xls,.xlsx" : "*"}
      />

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
              className="bg-pazap-dark-orange hover:bg-opacity-90 text-white"
            >
              Agendar Mensagem
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* File Upload Modal */}
      <Dialog open={showFileUploadModal} onOpenChange={setShowFileUploadModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {fileType === "image" ? "Anexar Imagem" : 
               fileType === "document" ? "Anexar Documento" : 
               "Anexar Contato"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="file">{fileType === "image" ? "Selecione uma imagem" : 
               fileType === "document" ? "Selecione um documento" : 
               "Selecione um arquivo de contato"}</Label>
              <div className="flex items-center justify-center w-full">
                <label 
                  className="flex flex-col items-center justify-center w-full h-32 border-2 border-pazap-dark-border border-dashed rounded-lg cursor-pointer bg-pazap-dark-surface hover:bg-pazap-dark-bg"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    {fileType === "image" ? <Image className="w-10 h-10 mb-3 text-pazap-dark-orange" /> :
                     fileType === "document" ? <FileText className="w-10 h-10 mb-3 text-pazap-dark-blue" /> :
                     <User className="w-10 h-10 mb-3 text-pazap-dark-blue" />}
                    <p className="mb-2 text-sm text-pazap-dark-text">
                      <span className="font-semibold">Clique para selecionar</span> ou arraste e solte
                    </p>
                    <p className="text-xs text-pazap-dark-text-secondary">
                      {fileType === "image" ? "PNG, JPG ou GIF" : 
                       fileType === "document" ? "PDF, DOC, TXT ou XLS" : 
                       "VCF ou CSV"}
                    </p>
                  </div>
                </label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowFileUploadModal(false)}
            >
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
