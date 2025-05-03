import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

interface QRCodeProps {
  onConnect: () => void;
}

export default function QRCode({ onConnect }: QRCodeProps) {
  const [generatingQR, setGeneratingQR] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const { toast } = useToast();
  const wsRef = useRef<WebSocket | null>(null);

  // Get QR code data via API (fallback)
  const { 
    data: qrCodeData,
    isLoading,
    isError,
    refetch
  } = useQuery<{ qrCode: string }>({
    queryKey: ['/api/whatsapp/qrcode'],
    enabled: generatingQR && !qrCode,
    refetchInterval: (generatingQR && !qrCode) ? 5000 : false,
  });

  // Connect WebSocket for more reliable QR code updates
  useEffect(() => {
    // Função para conectar ao WebSocket
    const connectWebSocket = () => {
      try {
        if (wsRef.current) {
          // Se já existe uma conexão, a fecha primeiro
          wsRef.current.close();
          wsRef.current = null;
        }
        
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        console.log('Connecting to WebSocket for QR code at:', wsUrl);
        
        const socket = new WebSocket(wsUrl);
        wsRef.current = socket;

        socket.onopen = () => {
          console.log('WebSocket connected for QR code');
        };

        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            if (data.type === 'qr') {
              console.log('Received QR code via WebSocket');
              setQrCode(data.data);
            } else if (data.type === 'authenticated') {
              console.log('WhatsApp authenticated');
              setGeneratingQR(false);
              setQrCode(null);
              onConnect();
            }
          } catch (e) {
            console.error('Error processing WebSocket message:', e);
          }
        };

        socket.onerror = (error) => {
          console.error('WebSocket error:', error);
          // Tentar reconectar após erro
          setTimeout(() => {
            if (generatingQR && !wsRef.current) {
              connectWebSocket();
            }
          }, 3000);
        };

        socket.onclose = () => {
          console.log('WebSocket disconnected');
          wsRef.current = null;
          // Tentar reconectar após desconexão
          setTimeout(() => {
            if (generatingQR && !wsRef.current) {
              connectWebSocket();
            }
          }, 3000);
        };
      } catch (error) {
        console.error('Error setting up WebSocket:', error);
      }
    };

    // Iniciar conexão quando estiver gerando QR code
    if (generatingQR) {
      connectWebSocket();
    }

    return () => {
      // Limpar conexão quando o componente for desmontado
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [generatingQR, onConnect]);

  // Use API data if WebSocket fails
  useEffect(() => {
    if (qrCodeData?.qrCode && !qrCode) {
      setQrCode(qrCodeData.qrCode);
    }
  }, [qrCodeData, qrCode]);

  const handleInitiateConnection = async () => {
    setGeneratingQR(true);
    toast({
      title: "Gerando QR Code",
      description: "Aguarde enquanto geramos o QR code para conexão com o WhatsApp.",
      duration: 5000,
    });
    await refetch();
  };

  useEffect(() => {
    if (isError) {
      toast({
        title: "Erro ao Gerar QR Code",
        description: "Houve um erro ao gerar o QR code. Por favor, tente novamente.",
        variant: "destructive",
      });
      setGeneratingQR(false);
    }
  }, [isError, toast]);

  return (
    <div className="p-4 border-b border-orange-100 animate-fade-in">
      <Card className="bg-gradient-to-br from-white to-pazap-bg shadow-md overflow-hidden">
        <CardContent className="p-6 text-center">
          <h2 className="font-semibold text-xl mb-2 gradient-text">Conectar ao PaZap</h2>
          <p className="text-sm text-gray-600 mb-4">
            Escaneie o QR code com seu WhatsApp para conectar
          </p>
          
          <div className="w-64 h-64 mx-auto bg-white flex items-center justify-center border border-pazap-orange/20 rounded-md p-2 shadow-inner relative overflow-hidden">
            {/* Efeito decorativo */}
            <div className="absolute inset-0 bg-gradient-to-br from-pazap-orange/5 to-pazap-blue/5"></div>
            
            {generatingQR ? (
              isLoading && !qrCode ? (
                <div className="animate-pulse">
                  <Skeleton className="w-full h-full" />
                </div>
              ) : qrCode ? (
                <div className="w-full h-full flex items-center justify-center animate-fade-in">
                  <iframe 
                    src="/api/whatsapp/qrcode-html" 
                    className="w-full h-full border-0"
                    title="WhatsApp QR Code"
                  ></iframe>
                </div>
              ) : (
                <p className="text-gray-400">QR Code não disponível</p>
              )
            ) : (
              <div className="text-gray-400 flex flex-col items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-2 text-pazap-orange/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
                <p>QR Code aparecerá aqui</p>
              </div>
            )}
          </div>
          
          <Button 
            onClick={handleInitiateConnection}
            disabled={generatingQR && !isError}
            className="mt-6 bg-gradient-to-r from-pazap-orange to-pazap-blue hover:opacity-90 text-white shadow-md transition-all hover:shadow-lg"
          >
            {generatingQR ? "Gerando QR Code..." : "Iniciar Conexão"}
          </Button>
          
          {generatingQR && !qrCode && (
            <div className="mt-4 p-2 bg-pazap-orange/10 rounded-md border border-pazap-orange/20 animate-fade-in">
              <p className="text-sm text-gray-600 mb-1">
                Se o QR code não aparecer, você pode visualizá-lo clicando abaixo:
              </p>
              <a 
                href="/api/whatsapp/qrcode-html" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sm text-pazap-blue hover:underline inline-flex items-center"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Ver QR Code em nova aba
              </a>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
