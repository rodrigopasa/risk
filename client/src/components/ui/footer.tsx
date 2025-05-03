import React from "react";

export function Footer() {
  return (
    <footer className="border-t p-4 bg-gradient-to-r from-pazap-orange-light to-pazap-blue-light text-white">
      <div className="container mx-auto flex flex-col md:flex-row justify-between items-center">
        <div className="mb-2 md:mb-0">
          <p className="font-semibold">PaZap</p>
          <p className="text-sm opacity-80">Sistema de Mensagens</p>
        </div>
        
        <div className="text-center mb-2 md:mb-0">
          <p className="text-sm opacity-80">© {new Date().getFullYear()}</p>
        </div>
        
        <div className="text-right">
          <p className="font-semibold animate-pulse">Desenvolvido por Rodrigo Pasa</p>
        </div>
      </div>
    </footer>
  );
}