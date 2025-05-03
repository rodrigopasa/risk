import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";

const loginSchema = z.object({
  username: z.string().min(1, "O nome de usuário é obrigatório"),
  password: z.string().min(1, "A senha é obrigatória"),
});

export default function LoginPage() {
  const { user, login } = useAuth();
  const [, navigate] = useLocation();
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    // Se já estiver autenticado, redirecionar para a home
    if (user?.isAuthenticated) {
      navigate("/");
    }
  }, [user, navigate]);

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  function onSubmit(data: z.infer<typeof loginSchema>) {
    setIsLoggingIn(true);
    try {
      const success = login(data.username, data.password);
      if (success) {
        navigate("/");
      }
    } finally {
      setIsLoggingIn(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-pazap-orange-light to-pazap-blue-light p-4">
      <div className="w-full max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 animate-fade-in">
        <Card className="bg-white/95 shadow-lg backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-center mb-2">
              <span className="gradient-text">Bem-vindo ao PaZap</span>
            </CardTitle>
            <CardDescription className="text-center text-lg">
              Faça login para acessar o sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome de Usuário</FormLabel>
                      <FormControl>
                        <Input placeholder="Digite seu nome de usuário" {...field} className="animate-fade-in" style={{animationDelay: '0.1s'}} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Senha</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Digite sua senha" {...field} className="animate-fade-in" style={{animationDelay: '0.2s'}} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button 
                  type="submit" 
                  className="w-full hover:bg-gradient-to-r from-pazap-orange to-pazap-blue animate-fade-in" 
                  style={{animationDelay: '0.3s'}}
                  disabled={isLoggingIn}
                >
                  {isLoggingIn ? "Entrando..." : "Entrar"}
                </Button>
              </form>
            </Form>
          </CardContent>
          <CardFooter className="text-center text-sm text-muted-foreground flex justify-center">
            <p>Use as credenciais fornecidas pelo administrador do sistema</p>
          </CardFooter>
        </Card>
        
        <div className="hidden md:flex flex-col justify-center items-center text-white animate-fade-in" style={{animationDelay: '0.4s'}}>
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-6 animate-pulse">PaZap</h1>
            <p className="text-xl mb-4">Sistema de Mensagens Inteligente</p>
            <ul className="space-y-2 text-left max-w-md mx-auto">
              <li className="flex items-center animate-slide-in" style={{animationDelay: '0.5s'}}>
                <div className="w-6 h-6 rounded-full bg-white/30 flex items-center justify-center mr-2">✓</div>
                <span>Envio de mensagens em tempo real</span>
              </li>
              <li className="flex items-center animate-slide-in" style={{animationDelay: '0.6s'}}>
                <div className="w-6 h-6 rounded-full bg-white/30 flex items-center justify-center mr-2">✓</div>
                <span>Agendamento de mensagens</span>
              </li>
              <li className="flex items-center animate-slide-in" style={{animationDelay: '0.7s'}}>
                <div className="w-6 h-6 rounded-full bg-white/30 flex items-center justify-center mr-2">✓</div>
                <span>Interface amigável e intuitiva</span>
              </li>
              <li className="flex items-center animate-slide-in" style={{animationDelay: '0.8s'}}>
                <div className="w-6 h-6 rounded-full bg-white/30 flex items-center justify-center mr-2">✓</div>
                <span>Acesso a contatos e grupos reais</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
      
      <footer className="mt-8 text-white text-center animate-fade-in" style={{animationDelay: '0.9s'}}>
        <p>Desenvolvido por Rodrigo Pasa</p>
      </footer>
    </div>
  );
}