import { QueryClientProvider } from "@tanstack/react-query";
import { Switch, Route, Redirect, useLocation } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { queryClient } from "./lib/queryClient";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import LoginPage from "@/pages/login";
import { useAuth, AuthProvider } from "@/hooks/use-auth";
import { Footer } from "@/components/ui/footer";
import { WhatsAppProvider } from "./hooks/use-whatsapp";

// Componente para rotas protegidas (separado para usar hooks após o provider)
const ProtectedRoute = ({ component: Component }: { component: React.ComponentType }) => {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  
  if (!user?.isAuthenticated) {
    // Usar setLocation em vez de Redirect para evitar problemas com hooks
    setLocation("/login");
    return null;
  }
  
  return <Component />;
}

// Router separado para poder usar o hook useAuth somente após o provider
const Router = () => {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/">
        <ProtectedRoute component={Home} />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <WhatsAppProvider>
          <div className="flex flex-col min-h-screen dark-mode">
            <main className="flex-grow">
              <Router />
            </main>
            <Footer />
          </div>
          <Toaster />
        </WhatsAppProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
