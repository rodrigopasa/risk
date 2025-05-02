import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { QRCodeSVG } from "qrcode.react";

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
    refetchInterval: (generatingQR && !qrCode) ? 10000 : false,
  });

  // Connect WebSocket for more reliable QR code updates
  useEffect(() => {
    if (generatingQR && !wsRef.current) {
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
      };

      socket.onclose = () => {
        console.log('WebSocket disconnected');
        wsRef.current = null;
      };

      return () => {
        socket.close();
        wsRef.current = null;
      };
    }
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
    <div className="p-4 border-b border-gray-200">
      <Card className="bg-gray-100">
        <CardContent className="p-4 text-center">
          <h2 className="font-semibold text-lg mb-2">Conectar ao WhatsApp</h2>
          <p className="text-sm text-gray-600 mb-4">
            Escaneie o QR code com seu WhatsApp para conectar
          </p>
          
          <div className="w-64 h-64 mx-auto bg-white flex items-center justify-center border p-2">
            {generatingQR ? (
              isLoading && !qrCode ? (
                <Skeleton className="w-full h-full" />
              ) : qrCode ? (
                <QRCodeSVG 
                  value={qrCode}
                  size={240}
                  level="H"
                  includeMargin={true}
                  className="w-full h-full"
                />
              ) : (
                <p className="text-gray-400">QR Code não disponível</p>
              )
            ) : (
              <p className="text-gray-400">QR Code aparecerá aqui</p>
            )}
          </div>
          
          <Button 
            onClick={handleInitiateConnection}
            disabled={generatingQR && !isError}
            className="mt-4 bg-whatsapp-green hover:bg-opacity-90 text-white"
          >
            {generatingQR ? "Gerando QR Code..." : "Iniciar Conexão"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
