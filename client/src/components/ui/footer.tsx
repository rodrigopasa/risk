import React from "react";

export function Footer() {
  return (
    <footer className="border-t border-pazap-dark-border p-4 bg-pazap-dark-surface text-pazap-dark-text">
      <div className="container mx-auto flex flex-col md:flex-row justify-between items-center">
        <div className="mb-2 md:mb-0">
          <p className="font-semibold gradient-text">PaZap</p>
          <p className="text-sm text-pazap-dark-text-secondary">Sistema de Mensagens</p>
        </div>
        
        <div className="text-center mb-2 md:mb-0">
          <p className="text-sm text-pazap-dark-text-secondary">© {new Date().getFullYear()}</p>
        </div>
        
        <div className="text-right">
          <p className="font-semibold text-pazap-dark-orange animate-pulse">Desenvolvido por Rodrigo Pasa</p>
        </div>
      </div>
    </footer>
  );
}