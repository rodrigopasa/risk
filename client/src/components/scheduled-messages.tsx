import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from "@/components/ui/dialog";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ScheduledMessage, Contact } from "@shared/schema";

// Interface estendida para mensagens agendadas que inclui o contato relacionado
interface ScheduledMessageWithContact extends ScheduledMessage {
  contact: Contact;
}

interface ScheduledMessagesProps {
  onClose: () => void;
}

export default function ScheduledMessages({ onClose }: ScheduledMessagesProps) {
  const [selectedMessageId, setSelectedMessageId] = useState<number | null>(null);
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  const { toast } = useToast();

  // Fetch scheduled messages
  const { 
    data: scheduledMessages = [], 
    isLoading,
    error
  } = useQuery<ScheduledMessageWithContact[]>({
    queryKey: ['/api/messages/scheduled'],
  });

  // Delete scheduled message mutation
  const deleteScheduledMessageMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/messages/scheduled/${id}`, null);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/messages/scheduled'] });
      toast({
        title: "Mensagem cancelada",
        description: "A mensagem agendada foi cancelada com sucesso",
      });
      setShowDeleteAlert(false);
    },
    onError: (error) => {
      toast({
        title: "Erro ao cancelar mensagem",
        description: `${error}`,
        variant: "destructive",
      });
    },
  });

  const handleDeleteClick = (id: number) => {
    setSelectedMessageId(id);
    setShowDeleteAlert(true);
  };

  const confirmDelete = () => {
    if (selectedMessageId) {
      deleteScheduledMessageMutation.mutate(selectedMessageId);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl max-h-[80vh] flex flex-col bg-pazap-dark-surface border-pazap-dark-border text-pazap-dark-text">
        <DialogHeader>
          <DialogTitle className="text-pazap-dark-text">Mensagens Agendadas</DialogTitle>
        </DialogHeader>
        
        <div className="overflow-y-auto flex-1">
          {isLoading ? (
            <div className="space-y-2">
              {Array(3).fill(0).map((_, i) => (
                <div key={`skeleton-${i}`} className="flex items-center space-x-4 p-4">
                  <Skeleton className="h-12 w-12 rounded-full bg-pazap-dark-bg" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-[250px] bg-pazap-dark-bg" />
                    <Skeleton className="h-4 w-[200px] bg-pazap-dark-bg" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-4 text-red-500">
              Erro ao carregar mensagens agendadas
            </div>
          ) : scheduledMessages.length === 0 ? (
            <div className="text-center py-12 px-4">
              <div className="mx-auto w-20 h-20 mb-4 text-pazap-dark-orange opacity-30">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2 text-pazap-dark-text">Nenhuma mensagem agendada</h3>
              <p className="text-pazap-dark-text-secondary max-w-md mx-auto">
                Você ainda não possui mensagens agendadas para envio. Para agendar uma mensagem, selecione um contato e use o ícone de calendário no campo de mensagem.
              </p>
            </div>
          ) : (
            <Table className="border-pazap-dark-border">
              <TableHeader className="bg-pazap-dark-bg">
                <TableRow className="border-pazap-dark-border hover:bg-pazap-dark-bg">
                  <TableHead className="w-[200px] text-pazap-dark-text">Destinatário</TableHead>
                  <TableHead className="text-pazap-dark-text">Mensagem</TableHead>
                  <TableHead className="w-[180px] text-pazap-dark-text">Data/Hora</TableHead>
                  <TableHead className="w-[120px] text-pazap-dark-text">Status</TableHead>
                  <TableHead className="w-[120px] text-pazap-dark-text">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scheduledMessages.map((message) => (
                  <TableRow key={message.id} className="border-pazap-dark-border hover:bg-pazap-dark-bg">
                    <TableCell className="whitespace-nowrap text-pazap-dark-text">
                      <div className="flex items-center">
                        <div className={`flex-shrink-0 h-8 w-8 rounded-full ${message.contact?.isGroup ? 'bg-pazap-dark-blue' : 'bg-pazap-dark-orange'} text-white flex items-center justify-center`}>
                          <span className="text-xs">
                            {message.contact?.name?.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() || 'N/A'}
                          </span>
                        </div>
                        <div className="ml-2">
                          <div className="text-sm font-medium text-pazap-dark-text">{message.contact?.name || 'Destinatário'}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-pazap-dark-text">
                      <div className="text-sm truncate max-w-[200px]">
                        {message.content}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-pazap-dark-text">
                      <div className="text-sm">
                        {format(new Date(message.scheduledTime), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Badge 
                        variant="outline"
                        className={`
                          ${message.status === 'pending' ? 'bg-pazap-dark-bg border-yellow-600 text-yellow-500' : 
                            message.status === 'sent' ? 'bg-pazap-dark-bg border-green-600 text-green-500' : 
                              message.status === 'failed' ? 'bg-pazap-dark-bg border-red-600 text-red-500' : 
                                'bg-pazap-dark-bg border-pazap-dark-border text-pazap-dark-text-secondary'}
                        `}
                      >
                        {message.status === 'pending' ? 'Pendente' :
                          message.status === 'sent' ? 'Enviada' :
                            message.status === 'failed' ? 'Falhou' :
                              message.status === 'canceled' ? 'Cancelada' : message.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {message.status === 'pending' && (
                        <>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="text-pazap-dark-blue hover:text-pazap-dark-blue hover:bg-pazap-dark-bg mr-2"
                            onClick={() => {
                              // In a real implementation, this would open an edit modal
                              toast({
                                title: "Funcionalidade não implementada",
                                description: "A edição de mensagens agendadas será implementada em uma versão futura",
                              });
                            }}
                          >
                            Editar
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="text-red-500 hover:text-red-400 hover:bg-pazap-dark-bg"
                            onClick={() => handleDeleteClick(message.id)}
                          >
                            Excluir
                          </Button>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
        
        <DialogFooter>
          <Button onClick={onClose} className="bg-pazap-dark-orange hover:bg-opacity-90">Fechar</Button>
        </DialogFooter>
      </DialogContent>

      {/* Confirmation Dialog for Delete */}
      <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
        <AlertDialogContent className="bg-pazap-dark-surface border-pazap-dark-border text-pazap-dark-text">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-pazap-dark-text">Cancelar mensagem agendada</AlertDialogTitle>
            <AlertDialogDescription className="text-pazap-dark-text-secondary">
              Tem certeza que deseja cancelar esta mensagem agendada? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-pazap-dark-bg text-pazap-dark-text border-pazap-dark-border hover:bg-pazap-dark-surface">Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
