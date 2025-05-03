import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApiSettings } from "./api-settings";
import { AutoResponderSettings } from "./auto-responder-settings";
import { Contact } from "@shared/schema";
import { Settings } from "lucide-react";
import { useState } from "react";

interface AIConfigDialogProps {
  contact?: Contact;
}

export function AIConfigDialog({ contact }: AIConfigDialogProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(contact ? "auto-responder" : "api-settings");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="icon" 
          className="h-9 w-9 border-pazap-dark-orange hover:bg-pazap-dark-orange/20 hover:text-pazap-dark-orange text-orange-500"
        >
          <BrainCogIcon className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BrainCogIcon className="h-5 w-5" />
            Configurações de IA
          </DialogTitle>
          <DialogDescription>
            Configure a integração com OpenAI para respostas automáticas e Google para agenda.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="api-settings">
              <Settings className="h-4 w-4 mr-2" />
              Configurações de API
            </TabsTrigger>
            <TabsTrigger 
              value="auto-responder" 
              disabled={!contact}
            >
              <MessageSquareText className="h-4 w-4 mr-2" />
              Resposta Automática
            </TabsTrigger>
          </TabsList>
          <TabsContent value="api-settings" className="py-4">
            <ApiSettings />
          </TabsContent>
          <TabsContent value="auto-responder" className="py-4">
            {contact && <AutoResponderSettings contact={contact} />}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// Ícone de cérebro com engrenagem para configurações de IA
function BrainCogIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 4.5a2.5 2.5 0 0 0-4.96-.46 2.5 2.5 0 0 0-1.98 3 2.5 2.5 0 0 0-1.32 4.24 3 3 0 0 0 .34 5.58 2.5 2.5 0 0 0 2.96 3.08 2.5 2.5 0 0 0 4.91.05L12 20V4.5Z" />
      <path d="M16 8V5c0-1.1.9-2 2-2" />
      <path d="M12 13h4" />
      <path d="M12 18h6a2 2 0 0 1 2 2v1" />
      <path d="M12 8h8" />
      <path d="M20.5 8a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0Z" />
      <path d="M16.5 13a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0Z" />
      <path d="M20.5 21a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0Z" />
      <path d="M18.5 3a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0Z" />
    </svg>
  );
}

// Ícone de MessageSquareText para o componente
function MessageSquareText(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      <path d="M13 8H7" />
      <path d="M17 12H7" />
    </svg>
  );
}