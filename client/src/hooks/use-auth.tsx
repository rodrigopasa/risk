import { createContext, ReactNode, useContext, useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

interface User {
  username: string;
  isAuthenticated: boolean;
}

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const ADMIN_USERNAME = "Hisoka";
const ADMIN_PASSWORD = "Hisoka44#666";

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);

  // Check if user is already logged in on page load
  useEffect(() => {
    const savedUser = localStorage.getItem("pazap_user");
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (error) {
        localStorage.removeItem("pazap_user");
      }
    }
  }, []);

  const login = (username: string, password: string): boolean => {
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      const user = { username, isAuthenticated: true };
      setUser(user);
      localStorage.setItem("pazap_user", JSON.stringify(user));
      
      toast({
        title: "Login bem-sucedido",
        description: "Bem-vindo ao PaZap!",
        className: "bg-pazap-blue text-white",
      });
      
      return true;
    } else {
      toast({
        variant: "destructive",
        title: "Falha no login",
        description: "Usuário ou senha incorretos",
      });
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("pazap_user");
    
    toast({
      title: "Logout realizado",
      description: "Você foi desconectado do sistema",
    });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth deve ser usado dentro de um AuthProvider");
  }
  return context;
}