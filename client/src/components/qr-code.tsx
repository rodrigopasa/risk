import { useState, useEffect } from "react";
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
  const { toast } = useToast();

  // Get QR code data
  const { 
    data: qrCodeData,
    isLoading,
    isError,
    refetch
  } = useQuery<{ qrCode: string }>({
    queryKey: ['/api/whatsapp/qrcode'],
    enabled: generatingQR,
    refetchInterval: generatingQR ? 10000 : false,
  });

  const handleInitiateConnection = async () => {
    setGeneratingQR(true);
    toast({
      title: "Generating QR Code",
      description: "Please wait while we generate a QR code for WhatsApp connection.",
      duration: 5000,
    });
    await refetch();
  };

  useEffect(() => {
    if (isError) {
      toast({
        title: "Error Generating QR Code",
        description: "There was an error generating the QR code. Please try again.",
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
          
          <div className="w-48 h-48 mx-auto bg-white flex items-center justify-center border">
            {generatingQR ? (
              isLoading ? (
                <Skeleton className="w-full h-full" />
              ) : qrCodeData?.qrCode ? (
                <img 
                  src={`data:image/png;base64,${btoa(qrCodeData.qrCode)}`} 
                  alt="WhatsApp QR Code" 
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
