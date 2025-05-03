#!/bin/bash
set -e

echo "========================================"
echo "Iniciando configuração do PaZap (WhatsApp Web App)"
echo "========================================"

# Verificar se a variável de ambiente DATABASE_URL está definida
if [ -z "$DATABASE_URL" ]; then
  echo "ERRO: DATABASE_URL não está definida. O banco de dados não está configurado."
  exit 1
fi

echo "✓ Banco de dados configurado corretamente"

# Criar diretório para arquivos do WhatsApp se não existir
if [ ! -d "./whatsapp-auth" ]; then
  echo "Criando diretório para os arquivos de autenticação do WhatsApp..."
  mkdir -p ./whatsapp-auth
  chmod -R 777 ./whatsapp-auth
  echo "✓ Diretório de autenticação criado"
else
  echo "✓ Diretório de autenticação já existe"
fi

# Executar migração do esquema do banco de dados
echo "Aplicando atualizações do schema no banco de dados..."
npm run db:push
echo "✓ Schema atualizado com sucesso"

# Inserir dados iniciais se necessário
echo "Verificando e inserindo dados iniciais..."
npm run db:seed
echo "✓ Dados iniciais verificados"

# Configurar o fuso horário para São Paulo (America/Sao_Paulo)
echo "Configurando ambiente para fuso horário de São Paulo..."
export TZ=America/Sao_Paulo
echo "✓ Fuso horário configurado: $(date)"

echo "========================================"
echo "Configuração concluída! Iniciando aplicativo..."
echo "========================================"

# Iniciar o aplicativo
exec npm start