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
  
  // Inicializar a data com a data de hoje
  const today = new Date();
  const formattedDate = today.toISOString().split('T')[0];
  
  // Inicializar o horário com o horário atual + 2 minutos
  const nextMinutes = new Date(today.getTime() + 2 * 60000);
  const hours = nextMinutes.getHours().toString().padStart(2, '0');
  const minutes = nextMinutes.getMinutes().toString().padStart(2, '0');
  const formattedTime = `${hours}:${minutes}`;
  
  const [scheduledDate, setScheduledDate] = useState(formattedDate);
  const [scheduledTime, setScheduledTime] = useState(formattedTime);
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
    
    // Criar a data com o horário local do usuário
    const scheduledDateTime = new Date(`${scheduledDate}T${scheduledTime}:00`);
    
    // Não aplicamos mais o ajuste de fuso horário aqui, pois isso estava causando
    // o problema com a validação de data
    
    const now = new Date();
    
    // Adicionar 15 segundos (em vez de 1 minuto) para permitir agendamento imediato mas evitar problemas
    // com envio retroativo (dá um pequeno buffer para processamento)
    const minimumScheduleTime = new Date(now.getTime() + 15000);
    
    console.log('Data agendada:', scheduledDateTime);
    console.log('Data mínima permitida:', minimumScheduleTime);
    
    if (scheduledDateTime.getTime() < minimumScheduleTime.getTime()) {
      toast({
        title: "Data inválida",
        description: "A data de agendamento deve ser pelo menos 15 segundos no futuro",
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
  
  // Função para redimensionar imagens e reduzir a qualidade
  const resizeImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (!event.target?.result) {
          return reject(new Error("Falha ao ler arquivo"));
        }
        
        const img = document.createElement('img');
        img.onload = () => {
          try {
            // Definir dimensão máxima (1200px para manter qualidade razoável)
            const MAX_SIZE = 1200;
            let width = img.width;
            let height = img.height;
            
            // Calcular nova dimensão mantendo proporção
            if (width > height && width > MAX_SIZE) {
              height = (height * MAX_SIZE) / width;
              width = MAX_SIZE;
            } else if (height > MAX_SIZE) {
              width = (width * MAX_SIZE) / height;
              height = MAX_SIZE;
            }
            
            // Criar canvas para redimensionar
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            
            // Desenhar imagem redimensionada
            const ctx = canvas.getContext('2d');
            if (!ctx) return reject(new Error("Contexto 2D não disponível"));
            
            ctx.drawImage(img, 0, 0, width, height);
            
            // Converter para JPEG com 75% de qualidade para reduzir tamanho
            const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
            resolve(dataUrl);
          } catch (err) {
            reject(new Error(`Erro ao processar imagem: ${err}`));
          }
        };
        
        img.onerror = () => reject(new Error("Falha ao carregar imagem"));
        img.src = event.target.result as string;
      };
      
      reader.onerror = () => reject(new Error("Falha ao ler arquivo"));
      reader.readAsDataURL(file);
    });
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    
    try {
      // Mostrar toast de "processando" para arquivos grandes
      if (file.size > 1000000) { // 1MB
        toast({
          title: "Processando arquivo",
          description: "Arquivos grandes podem levar alguns segundos...",
        });
      }
      
      let dataUrl;
      
      // Se for imagem, redimensionar para reduzir tamanho
      if (fileType === "image" && file.type.startsWith("image/")) {
        dataUrl = await resizeImage(file);
      } else {
        // Para outros tipos, ler normalmente
        dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      }
      
      setMediaFiles([...mediaFiles, dataUrl]);
      setShowMediaPreview(true);
      setShowFileUploadModal(false);
      
      toast({
        title: "Arquivo anexado",
        description: `${file.name} foi anexado e será enviado com a mensagem`,
      });
    } catch (error) {
      toast({
        title: "Erro ao processar arquivo",
        description: "Não foi possível processar o arquivo selecionado",
        variant: "destructive",
      });
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
                // Não vamos usar a restrição de data mínima para permitir agendamento para qualquer data
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
