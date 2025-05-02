FROM node:20-slim

# Instalar dependências para o Chrome
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    procps \
    fonts-freefont-ttf \
    gconf-service \
    libasound2 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgcc1 \
    libgconf-2-4 \
    libgdk-pixbuf2.0-0 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    fonts-liberation \
    libnss3 \
    lsb-release \
    xdg-utils

# Configurar o diretório de trabalho
WORKDIR /app

# Copiar arquivos de dependências
COPY package*.json ./

# Instalar dependências
# Usar npm install em vez de npm ci para garantir que as novas dependências sejam adicionadas
RUN npm install

# Copiar o resto dos arquivos
COPY . .

# Construir o aplicativo
RUN npm run build

# Expor a porta que o aplicativo usará
EXPOSE 5000

# Criar diretório para dados de autenticação WhatsApp
RUN mkdir -p /app/whatsapp-auth && chmod -R 777 /app/whatsapp-auth

# Definir variável de ambiente para produção
ENV NODE_ENV=production
ENV PORT=5000

# Comando para iniciar o aplicativo
CMD ["npm", "start"]