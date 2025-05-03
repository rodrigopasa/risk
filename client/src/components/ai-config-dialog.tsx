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
import { Settings, BrainCog } from "lucide-react";
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
        <Button variant="ghost" size="icon" className="h-9 w-9">
          <BrainCog className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BrainCog className="h-5 w-5" />
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