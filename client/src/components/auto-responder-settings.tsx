import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, MessageSquare, Clock, CheckCircle2, Loader2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Contact } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";

interface AutoResponderSettingsProps {
  contact: Contact;
}

export function AutoResponderSettings({ contact }: AutoResponderSettingsProps) {
  const [enabled, setEnabled] = useState(false);
  const [autoRespondWhen, setAutoRespondWhen] = useState("always");
  const [workingHoursStart, setWorkingHoursStart] = useState("08:00");
  const [workingHoursEnd, setWorkingHoursEnd] = useState("18:00");
  const [promptTemplate, setPromptTemplate] = useState("");
  const [systemMessage, setSystemMessage] = useState("");
  const [maxHistoryMessages, setMaxHistoryMessages] = useState("5");
  const [aiModel, setAiModel] = useState("gpt-4o");
  const [allowScheduling, setAllowScheduling] = useState(false);
  const [requireApproval, setRequireApproval] = useState(false);
  const [testMessage, setTestMessage] = useState("");
  const [activeTab, setActiveTab] = useState("settings");
  
  const queryClient = useQueryClient();

  // Carregar configurações existentes
  const { 
    data: autoResponderConfig,
    isLoading: isLoadingConfig,
    isError: isErrorConfig,
    refetch: refetchConfig
  } = useQuery({ 
    queryKey: ['/api/auto-responders', contact.id],
    refetchOnWindowFocus: false,
    enabled: !!contact.id
  });

  // Carregar templates da clínica
  const {
    data: clinicTemplates,
    isLoading: isLoadingTemplates
  } = useQuery({ 
    queryKey: ['/api/auto-responders/templates/clinic'],
    refetchOnWindowFocus: false
  });

  // Carregar status da API OpenAI
  const { 
    data: openAIConfig,
    isLoading: isLoadingOpenAI,
    isError: isErrorOpenAI
  } = useQuery({ 
    queryKey: ['/api/config/openai'],
    refetchOnWindowFocus: false,
  });

  // Mutation para salvar configurações
  const saveSettingsMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', `/api/auto-responders/${contact.id}`, {
        enabled,
        autoRespondWhen,
        workingHoursStart: autoRespondWhen === 'custom_hours' ? workingHoursStart : undefined,
        workingHoursEnd: autoRespondWhen === 'custom_hours' ? workingHoursEnd : undefined,
        promptTemplate,
        systemMessage,
        maxHistoryMessages: maxHistoryMessages ? parseInt(maxHistoryMessages) : undefined,
        aiModel,
        allowScheduling,
        requireApproval
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auto-responders', contact.id] });
    }
  });

  // Mutation para testar resposta de IA
  const testResponseMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/ai/test-response', {
        contactId: contact.id,
        messageContent: testMessage
      });
      return await response.json();
    }
  });

  // Atualizar estados quando os dados forem carregados
  useEffect(() => {
    if (autoResponderConfig) {
      setEnabled(autoResponderConfig.enabled || false);
      setAutoRespondWhen(autoResponderConfig.autoRespondWhen || "always");
      setWorkingHoursStart(autoResponderConfig.workingHoursStart || "08:00");
      setWorkingHoursEnd(autoResponderConfig.workingHoursEnd || "18:00");
      setPromptTemplate(autoResponderConfig.promptTemplate || "");
      setSystemMessage(autoResponderConfig.systemMessage || "");
      setMaxHistoryMessages(autoResponderConfig.maxHistoryMessages?.toString() || "5");
      setAiModel(autoResponderConfig.aiModel || "gpt-4o");
      setAllowScheduling(autoResponderConfig.allowScheduling || false);
      setRequireApproval(autoResponderConfig.requireApproval || false);
    }
  }, [autoResponderConfig]);

  // Aplicar template selecionado
  const applyTemplate = (templateIndex: number) => {
    if (!clinicTemplates || templateIndex < 0 || templateIndex >= clinicTemplates.length) return;
    
    const template = clinicTemplates[templateIndex];
    setSystemMessage(template.systemMessage || "");
    setPromptTemplate(template.promptTemplate || "");
  };

  // Verificar se a chave da API está configurada
  const isOpenAIConfigured = openAIConfig?.hasApiKey;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">Configuração de Resposta Automática</h2>
        <p className="text-muted-foreground">
          Configure respostas automáticas com IA para o contato: <span className="font-semibold">{contact.name}</span>
        </p>
      </div>

      {!isOpenAIConfigured && (
        <Alert className="mb-4" variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>API OpenAI não configurada</AlertTitle>
          <AlertDescription>
            É necessário configurar a chave da API OpenAI para utilizar respostas automáticas.
            Acesse as Configurações de API para adicionar sua chave.
          </AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="settings">Configurações</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="test">Testar</TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Configurações Básicas
              </CardTitle>
              <CardDescription>
                Configure os parâmetros básicos de resposta automática.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingConfig ? (
                <div className="space-y-3">
                  <Skeleton className="h-4 w-[250px]" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-4 w-[300px]" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="auto-responder-enabled">Resposta automática ativada</Label>
                      <p className="text-sm text-muted-foreground">
                        Ative para responder automaticamente a mensagens deste contato
                      </p>
                    </div>
                    <Switch
                      id="auto-responder-enabled"
                      checked={enabled}
                      onCheckedChange={setEnabled}
                      disabled={!isOpenAIConfigured}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Quando responder</Label>
                    <RadioGroup value={autoRespondWhen} onValueChange={setAutoRespondWhen}>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="always" id="always" />
                        <Label htmlFor="always">Sempre responder</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="custom_hours" id="custom_hours" />
                        <Label htmlFor="custom_hours">Apenas em horário comercial</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {autoRespondWhen === "custom_hours" && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="working-hours-start">Horário inicial</Label>
                        <Input
                          id="working-hours-start"
                          type="time"
                          value={workingHoursStart}
                          onChange={(e) => setWorkingHoursStart(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="working-hours-end">Horário final</Label>
                        <Input
                          id="working-hours-end"
                          type="time"
                          value={workingHoursEnd}
                          onChange={(e) => setWorkingHoursEnd(e.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label htmlFor="ai-model">Modelo de IA</Label>
                    <Select value={aiModel} onValueChange={setAiModel}>
                      <SelectTrigger id="ai-model">
                        <SelectValue placeholder="Selecione o modelo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gpt-4o">GPT-4o (Recomendado)</SelectItem>
                        <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo (Mais rápido)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-sm text-muted-foreground">
                      O GPT-4o oferece respostas de melhor qualidade, mas o GPT-3.5 é mais rápido.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="max-history">Contexto histórico (mensagens)</Label>
                    <Input
                      id="max-history"
                      type="number"
                      min="0"
                      max="20"
                      value={maxHistoryMessages}
                      onChange={(e) => setMaxHistoryMessages(e.target.value)}
                    />
                    <p className="text-sm text-muted-foreground">
                      Número de mensagens anteriores a considerar para contexto (0-20). 
                      Mais mensagens = melhor contexto, porém maior custo.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="system-message">Mensagem do sistema (instruções para a IA)</Label>
                    <Textarea
                      id="system-message"
                      value={systemMessage}
                      onChange={(e) => setSystemMessage(e.target.value)}
                      placeholder="Você é um assistente de uma clínica médica profissional..."
                      rows={5}
                    />
                    <p className="text-sm text-muted-foreground">
                      Instruções gerais para a IA sobre como ela deve se comportar e responder.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="prompt-template">Template de prompt</Label>
                    <Textarea
                      id="prompt-template"
                      value={promptTemplate}
                      onChange={(e) => setPromptTemplate(e.target.value)}
                      placeholder="Responda à seguinte mensagem de {contact_name} de forma educada e profissional: '{message}'"
                      rows={5}
                    />
                    <p className="text-sm text-muted-foreground">
                      Template para formatar cada mensagem. Use {'{contact_name}'} para inserir o nome do contato 
                      e {'{message}'} para a mensagem recebida.
                    </p>
                  </div>

                  <div className="flex flex-col gap-4 pt-2">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="allow-scheduling">Permitir agendamento</Label>
                        <p className="text-sm text-muted-foreground">
                          Permite que a IA agende consultas automaticamente
                        </p>
                      </div>
                      <Switch
                        id="allow-scheduling"
                        checked={allowScheduling}
                        onCheckedChange={setAllowScheduling}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="require-approval">Exigir aprovação</Label>
                        <p className="text-sm text-muted-foreground">
                          Solicita sua aprovação antes de enviar respostas automáticas
                        </p>
                      </div>
                      <Switch
                        id="require-approval"
                        checked={requireApproval}
                        onCheckedChange={setRequireApproval}
                      />
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
            <CardFooter className="justify-end">
              <Button 
                onClick={() => saveSettingsMutation.mutate()}
                disabled={
                  saveSettingsMutation.isPending || 
                  isLoadingConfig || 
                  !isOpenAIConfigured ||
                  (enabled && !promptTemplate)
                }
              >
                {saveSettingsMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : "Salvar Configurações"}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="templates" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Templates Prontos</CardTitle>
              <CardDescription>
                Selecione um template pré-configurado para facilitar a configuração.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingTemplates ? (
                <div className="space-y-4">
                  <Skeleton className="h-[100px] w-full" />
                  <Skeleton className="h-[100px] w-full" />
                  <Skeleton className="h-[100px] w-full" />
                </div>
              ) : (
                <div className="space-y-4">
                  {clinicTemplates?.map((template, index) => (
                    <Card key={index} className="overflow-hidden">
                      <CardHeader className="bg-muted/50 py-3">
                        <CardTitle className="text-base">{template.name}</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-4">
                        <p className="line-clamp-2 text-sm text-muted-foreground">
                          {template.systemMessage?.substring(0, 150)}...
                        </p>
                      </CardContent>
                      <CardFooter className="border-t bg-muted/20 py-2">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => applyTemplate(index)}
                          className="ml-auto"
                        >
                          Aplicar Template
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}

                  {!clinicTemplates?.length && (
                    <Alert>
                      <AlertTitle>Nenhum template disponível</AlertTitle>
                      <AlertDescription>
                        Não há templates pré-configurados disponíveis no momento.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="test" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Testar Resposta</CardTitle>
              <CardDescription>
                Teste como a IA responderá baseada na sua configuração atual.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="test-message">Mensagem de teste</Label>
                  <Textarea
                    id="test-message"
                    value={testMessage}
                    onChange={(e) => setTestMessage(e.target.value)}
                    placeholder="Olá, gostaria de agendar uma consulta..."
                    rows={3}
                  />
                </div>

                <Button 
                  onClick={() => testResponseMutation.mutate()}
                  disabled={
                    testResponseMutation.isPending || 
                    !testMessage || 
                    !isOpenAIConfigured ||
                    !(autoResponderConfig?.enabled)
                  }
                  className="w-full"
                >
                  {testResponseMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Gerando resposta...
                    </>
                  ) : "Gerar Resposta de Teste"}
                </Button>

                {testResponseMutation.isPending && (
                  <div className="rounded-md border p-4 mt-4">
                    <div className="flex items-center justify-center">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                    <p className="text-center text-sm text-muted-foreground mt-2">
                      Gerando resposta... Pode levar alguns segundos.
                    </p>
                  </div>
                )}

                {testResponseMutation.isSuccess && testResponseMutation.data?.response && (
                  <div className="rounded-md border p-4 mt-4">
                    <h3 className="font-medium mb-2 flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      Resposta gerada:
                    </h3>
                    <div className="bg-muted rounded-md p-3 whitespace-pre-wrap text-sm">
                      {testResponseMutation.data.response}
                    </div>
                  </div>
                )}

                {testResponseMutation.isError && (
                  <Alert variant="destructive" className="mt-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Erro ao gerar resposta</AlertTitle>
                    <AlertDescription>
                      Não foi possível gerar uma resposta automática.
                      Verifique as configurações e a chave da API.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}