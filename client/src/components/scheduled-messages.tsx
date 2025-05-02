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
  } = useQuery({
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
      <DialogContent className="sm:max-w-4xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Mensagens Agendadas</DialogTitle>
        </DialogHeader>
        
        <div className="overflow-y-auto flex-1">
          {isLoading ? (
            <div className="space-y-2">
              {Array(3).fill(0).map((_, i) => (
                <div key={`skeleton-${i}`} className="flex items-center space-x-4 p-4">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-[250px]" />
                    <Skeleton className="h-4 w-[200px]" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-4 text-red-500">
              Erro ao carregar mensagens agendadas
            </div>
          ) : scheduledMessages.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Nenhuma mensagem agendada
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">Destinatário</TableHead>
                  <TableHead>Mensagem</TableHead>
                  <TableHead className="w-[180px]">Data/Hora</TableHead>
                  <TableHead className="w-[120px]">Status</TableHead>
                  <TableHead className="w-[120px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scheduledMessages.map((message) => (
                  <TableRow key={message.id}>
                    <TableCell className="whitespace-nowrap">
                      <div className="flex items-center">
                        <div className={`flex-shrink-0 h-8 w-8 rounded-full ${message.contact.isGroup ? 'bg-indigo-500' : 'bg-whatsapp-lightgreen'} text-white flex items-center justify-center`}>
                          <span className="text-xs">
                            {message.contact.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                          </span>
                        </div>
                        <div className="ml-2">
                          <div className="text-sm font-medium text-gray-900">{message.contact.name}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-gray-900 truncate max-w-[200px]">
                        {message.content}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {format(new Date(message.scheduledTime), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Badge 
                        variant="outline"
                        className={`
                          ${message.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 
                            message.status === 'sent' ? 'bg-green-100 text-green-800' : 
                              message.status === 'failed' ? 'bg-red-100 text-red-800' : 
                                'bg-gray-100 text-gray-800'}
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
                            className="text-indigo-600 hover:text-indigo-900 mr-2"
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
                            className="text-red-600 hover:text-red-900"
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
          <Button onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>

      {/* Confirmation Dialog for Delete */}
      <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar mensagem agendada</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja cancelar esta mensagem agendada? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
