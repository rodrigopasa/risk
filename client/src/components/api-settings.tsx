import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2, Key, RefreshCw } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";

export function ApiSettings() {
  const [openAIKey, setOpenAIKey] = useState("");
  const [googleClientId, setGoogleClientId] = useState("");
  const [googleClientSecret, setGoogleClientSecret] = useState("");
  const [googleRefreshToken, setGoogleRefreshToken] = useState("");
  const [activeTab, setActiveTab] = useState("openai");
  
  const queryClient = useQueryClient();

  // OpenAI API config
  const { 
    data: openAIConfig,
    isLoading: isLoadingOpenAI,
    isError: isErrorOpenAI,
    refetch: refetchOpenAI
  } = useQuery({ 
    queryKey: ['/api/config/openai'],
    refetchOnWindowFocus: false,
  });

  // Google API config
  const { 
    data: googleConfig,
    isLoading: isLoadingGoogle,
    isError: isErrorGoogle,
    refetch: refetchGoogle
  } = useQuery({ 
    queryKey: ['/api/config/google'],
    refetchOnWindowFocus: false,
  });

  // Mutation para salvar chave da OpenAI
  const saveOpenAIMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/config/openai', { apiKey: openAIKey });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/config/openai'] });
    }
  });

  // Mutation para salvar credenciais do Google
  const saveGoogleMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/config/google', { 
        clientId: googleClientId,
        clientSecret: googleClientSecret,
        refreshToken: googleRefreshToken || undefined
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/config/google'] });
    }
  });

  // Mutation para testar conexão com Google API
  const testGoogleMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('GET', '/api/config/google/test');
      return await response.json();
    }
  });

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">Configurações de API</h2>
        <p className="text-muted-foreground">
          Configure as integrações com APIs externas para habilitar recursos avançados.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-2 w-[400px]">
          <TabsTrigger value="openai">OpenAI</TabsTrigger>
          <TabsTrigger value="google">Google</TabsTrigger>
        </TabsList>

        <TabsContent value="openai" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                Configuração da OpenAI
              </CardTitle>
              <CardDescription>
                Configure a chave da API da OpenAI para habilitar respostas automáticas 
                inteligentes e outras funcionalidades de IA.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {openAIConfig?.hasApiKey && (
                <Alert className="mb-4" variant="success">
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertTitle>Chave da API configurada</AlertTitle>
                  <AlertDescription>
                    Sua chave da API OpenAI está configurada e pronta para uso.
                    Chave: {openAIConfig.apiKeyMasked}
                  </AlertDescription>
                </Alert>
              )}
              
              {isErrorOpenAI && (
                <Alert className="mb-4" variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Erro</AlertTitle>
                  <AlertDescription>
                    Não foi possível carregar a configuração da API.
                  </AlertDescription>
                </Alert>
              )}
              
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="openai-api-key">Chave da API da OpenAI</Label>
                  <Input
                    id="openai-api-key"
                    value={openAIKey}
                    onChange={(e) => setOpenAIKey(e.target.value)}
                    placeholder="sk-..."
                    type="password"
                  />
                  <p className="text-sm text-muted-foreground">
                    Obtenha sua chave da API em <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">https://platform.openai.com/api-keys</a>
                  </p>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button 
                variant="outline" 
                onClick={() => refetchOpenAI()}
                disabled={isLoadingOpenAI}
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${isLoadingOpenAI ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
              <Button 
                onClick={() => saveOpenAIMutation.mutate()}
                disabled={!openAIKey || saveOpenAIMutation.isPending}
              >
                {saveOpenAIMutation.isPending ? "Salvando..." : "Salvar Chave"}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="google" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"/>
                </svg>
                Configuração do Google
              </CardTitle>
              <CardDescription>
                Configure as credenciais da API do Google para integração com 
                Google Calendar e Google Sheets.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {googleConfig?.hasCredentials && (
                <Alert className="mb-4" variant="success">
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertTitle>Credenciais configuradas</AlertTitle>
                  <AlertDescription>
                    Suas credenciais do Google estão configuradas.
                    Client ID: {googleConfig.clientIdMasked}
                    {googleConfig.hasRefreshToken && <span className="block">Token de atualização configurado.</span>}
                  </AlertDescription>
                </Alert>
              )}
              
              {isErrorGoogle && (
                <Alert className="mb-4" variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Erro</AlertTitle>
                  <AlertDescription>
                    Não foi possível carregar a configuração da API do Google.
                  </AlertDescription>
                </Alert>
              )}
              
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="google-client-id">Client ID</Label>
                  <Input
                    id="google-client-id"
                    value={googleClientId}
                    onChange={(e) => setGoogleClientId(e.target.value)}
                    placeholder="xxx.apps.googleusercontent.com"
                  />
                </div>
                
                <div className="space-y-1.5">
                  <Label htmlFor="google-client-secret">Client Secret</Label>
                  <Input
                    id="google-client-secret"
                    value={googleClientSecret}
                    onChange={(e) => setGoogleClientSecret(e.target.value)}
                    placeholder="GOCSPX-..."
                    type="password"
                  />
                </div>
                
                <Separator className="my-2" />
                
                <div className="space-y-1.5">
                  <Label htmlFor="google-refresh-token">Refresh Token (opcional)</Label>
                  <Input
                    id="google-refresh-token"
                    value={googleRefreshToken}
                    onChange={(e) => setGoogleRefreshToken(e.target.value)}
                    placeholder="1//04..."
                    type="password"
                  />
                  <p className="text-sm text-muted-foreground">
                    O token de atualização é opcional e permite acesso contínuo
                    às APIs do Google sem autenticação manual.
                  </p>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => refetchGoogle()}
                  disabled={isLoadingGoogle}
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${isLoadingGoogle ? 'animate-spin' : ''}`} />
                  Atualizar
                </Button>
                
                <Button 
                  variant="outline" 
                  onClick={() => testGoogleMutation.mutate()}
                  disabled={testGoogleMutation.isPending || !googleConfig?.hasCredentials}
                >
                  Testar Conexão
                </Button>
              </div>
              
              <Button 
                onClick={() => saveGoogleMutation.mutate()}
                disabled={
                  (!googleClientId || !googleClientSecret) || 
                  saveGoogleMutation.isPending
                }
              >
                {saveGoogleMutation.isPending ? "Salvando..." : "Salvar Credenciais"}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}