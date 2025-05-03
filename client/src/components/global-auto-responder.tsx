import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2, MessageSquare, RefreshCw } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function GlobalAutoResponder() {
  const [isEnabled, setIsEnabled] = useState(false);
  const [excludeGroups, setExcludeGroups] = useState(true);
  const [defaultTemplate, setDefaultTemplate] = useState("Recepcionista Geral");
  const [templates, setTemplates] = useState<Array<any>>([]);
  
  const queryClient = useQueryClient();

  // Obter configuração global atual
  const { 
    data: globalConfig,
    isLoading: isLoadingConfig,
    isError: isErrorConfig,
    refetch: refetchConfig
  } = useQuery<{ 
    enabled: boolean; 
    excludeGroups: boolean; 
    defaultTemplate: string;
  }>({ 
    queryKey: ['/api/auto-responders/global'],
    refetchOnWindowFocus: false,
  });

  // Obter templates disponíveis
  const { 
    data: availableTemplates,
    isLoading: isLoadingTemplates,
  } = useQuery<Array<{ 
    name: string; 
    systemMessage: string; 
    promptTemplate: string;
  }>>({ 
    queryKey: ['/api/auto-responders/templates/clinic'],
    refetchOnWindowFocus: false,
  });
  
  // Atualizar estados locais quando os dados são carregados
  useEffect(() => {
    if (globalConfig) {
      setIsEnabled(globalConfig.enabled);
      setExcludeGroups(globalConfig.excludeGroups);
      setDefaultTemplate(globalConfig.defaultTemplate);
    }
  }, [globalConfig]);
  
  useEffect(() => {
    if (availableTemplates) {
      setTemplates(availableTemplates);
    }
  }, [availableTemplates]);

  // Mutation para salvar configuração global
  const saveConfigMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/auto-responders/global', { 
        enabled: isEnabled,
        excludeGroups,
        defaultTemplate
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auto-responders/global'] });
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Configuração Global de Respostas Automáticas
        </CardTitle>
        <CardDescription>
          Ative respostas automáticas para todos os contatos de uma só vez.
          Esta configuração é aplicada a contatos que não têm configuração individual.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {saveConfigMutation.isSuccess && (
          <Alert className="mb-4">
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>Configuração salva</AlertTitle>
            <AlertDescription>
              Sua configuração global de respostas automáticas foi salva com sucesso.
            </AlertDescription>
          </Alert>
        )}
        
        {isErrorConfig && (
          <Alert className="mb-4" variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Erro</AlertTitle>
            <AlertDescription>
              Não foi possível carregar a configuração global.
            </AlertDescription>
          </Alert>
        )}
        
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="global-auto-responder">Ativar para todos os contatos</Label>
              <p className="text-sm text-muted-foreground">
                Responder automaticamente para todos os contatos que não têm configuração individual.
              </p>
            </div>
            <Switch
              id="global-auto-responder"
              checked={isEnabled}
              onCheckedChange={setIsEnabled}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="exclude-groups">Excluir grupos</Label>
              <p className="text-sm text-muted-foreground">
                Não responder automaticamente em conversas de grupo.
              </p>
            </div>
            <Switch
              id="exclude-groups"
              checked={excludeGroups}
              onCheckedChange={setExcludeGroups}
              disabled={!isEnabled}
            />
          </div>
          
          <div className="space-y-1.5">
            <Label htmlFor="default-template">Template padrão</Label>
            <Select
              value={defaultTemplate}
              onValueChange={setDefaultTemplate}
              disabled={!isEnabled}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um template" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((template, i) => (
                  <SelectItem key={i} value={template.name}>
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Template usado para responder quando não há configuração específica para o contato.
            </p>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button 
          variant="outline" 
          onClick={() => refetchConfig()}
          disabled={isLoadingConfig}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${isLoadingConfig ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
        <Button 
          onClick={() => saveConfigMutation.mutate()}
          disabled={saveConfigMutation.isPending}
        >
          {saveConfigMutation.isPending ? "Salvando..." : "Salvar Configuração"}
        </Button>
      </CardFooter>
    </Card>
  );
}