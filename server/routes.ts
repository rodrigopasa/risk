import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  getClient, 
  initializeWhatsApp, 
  getQRCode, 
  isClientReady, 
  getContacts, 
  getGroups,
  sendMessage,
  disableQRCode
} from "./whatsapp";
import { 
  scheduleMessage, 
  cancelScheduledMessage, 
  updateScheduledMessage, 
  getAllScheduledMessages 
} from "./scheduler";
import { scheduledMessagesInsertSchema } from "@shared/schema";
import { saveApiKey, getApiConfig } from "./services/openai";
import { saveGoogleCredentials, getGoogleConfig, checkGoogleConnection, createCalendarEvent } from "./services/google";
import { 
  saveAutoResponderConfig, 
  getAutoResponderConfig, 
  getAutoRespondingContacts, 
  processIncomingMessage, 
  getDefaultClinicTemplates, 
  getGlobalAutoRespondConfig,
  saveGlobalAutoRespondConfig
} from "./services/auto-responder";
import { WebSocketServer, WebSocket } from "ws";
import { log } from "./vite";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // Set up WebSocket server for real-time updates
  const wss = new WebSocketServer({ 
    server: httpServer,
    path: '/ws'  // Alterando para um caminho mais simples
  });
  
  // Disponibilize globalmente o WebSocketServer para que outros módulos possam acessá-lo
  (global as any).wss = wss;
  
  wss.on("connection", (ws: WebSocket) => {
    log("WebSocket client connected", "websocket");
    
    // Enviar o QR code atual para o cliente recém conectado, se disponível
    const currentQrCode = getQRCode();
    if (currentQrCode) {
      log("Sending current QR code to new client", "websocket");
      ws.send(JSON.stringify({ type: "qr", data: currentQrCode }));
    }
    
    ws.on("message", (message: Buffer) => {
      log("Received message: " + message.toString(), "websocket");
    });
  });

  // Initialize WhatsApp client
  await initializeWhatsApp(
    (qr: string) => {
      // Broadcast QR code to all connected clients
      log("Received new QR code, broadcasting to clients", "whatsapp");
      wss.clients.forEach((client: WebSocket) => {
        if (client.readyState === WebSocket.OPEN) {
          log("Sending QR code to client", "websocket");
          client.send(JSON.stringify({ type: "qr", data: qr }));
        }
      });
    },
    () => {
      // Broadcast ready state to all connected clients
      wss.clients.forEach((client: WebSocket) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ type: "authenticated", data: true }));
        }
      });

      // Disable QR code when authenticated
      disableQRCode();
    }
  );

  // WhatsApp connection status
  app.get("/api/whatsapp/status", async (req, res) => {
    try {
      const ready = await isClientReady();
      res.json({ connected: ready });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get QR code for authentication
  app.get("/api/whatsapp/qrcode", async (req, res) => {
    try {
      const qrCode = await getQRCode();
      if (!qrCode) {
        return res.status(404).json({ error: "QR Code not available" });
      }
      res.json({ qrCode });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Get QR code as HTML data URI (for direct viewing)
  app.get("/api/whatsapp/qrcode-html", async (req, res) => {
    try {
      const qrCode = await getQRCode();
      if (!qrCode) {
        return res.status(404).json({ error: "QR Code not available" });
      }
      
      // Create an HTML page with the QR code
      // Versão muito mais simples, sem usar nenhuma biblioteca:
      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>WhatsApp QR Code</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
              body { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; font-family: sans-serif; background-color: white; padding: 20px; }
              h2 { margin-bottom: 20px; color: #128C7E; }
              .qr-container { padding: 15px; background: white; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
              .instructions { font-size: 14px; color: #075E54; margin-top: 20px; max-width: 350px; text-align: center; }
              .refresh-btn { background-color: #25D366; color: white; border: none; padding: 10px 15px; border-radius: 5px; margin-top: 20px; cursor: pointer; font-size: 16px; }
              .refresh-btn:hover { background-color: #128C7E; }
              @media (max-width: 400px) {
                .qr-img { width: 200px; height: 200px; }
              }
            </style>
          </head>
          <body>
            <h2>Escaneie este QR Code no WhatsApp</h2>
            <div class="qr-container">
              <img 
                src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrCode)}" 
                alt="WhatsApp QR Code" 
                width="300" 
                height="300"
                class="qr-img"
              >
            </div>
            <p class="instructions">
              Abra o WhatsApp no seu celular, toque em Menu (⋮) ou Configurações, 
              selecione Aparelhos Conectados e toque em Conectar Dispositivo
            </p>
            <button class="refresh-btn" onclick="window.location.reload()">
              Atualizar QR Code
            </button>
          </body>
        </html>
      `;
      
      res.setHeader('Content-Type', 'text/html');
      res.send(htmlContent);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get all contacts
  app.get("/api/contacts", async (req, res) => {
    try {
      const searchTerm = req.query.search as string || "";
      
      // Obtemos os contatos diretamente da API do WhatsApp se possível
      const contacts = await getContacts();
      log(`Retornando ${contacts.length} contatos para o frontend`, "express");
      
      let filteredContacts = contacts;
      
      if (searchTerm && contacts && contacts.length > 0) {
        filteredContacts = contacts.filter(
          contact => contact.name?.toLowerCase().includes(searchTerm.toLowerCase())
        );
        log(`Filtrado para ${filteredContacts.length} contatos com o termo "${searchTerm}"`, "express");
      }
      
      res.json(filteredContacts);
    } catch (error: any) {
      log(`Erro na rota de contatos: ${error.message}`, "express");
      // Retornar array vazio em vez de erro 500
      res.json([]);
    }
  });

  // Get all groups
  app.get("/api/groups", async (req, res) => {
    try {
      const searchTerm = req.query.search as string || "";
      
      // Obtemos os grupos diretamente da API do WhatsApp se possível
      const groups = await getGroups();
      log(`Retornando ${groups.length} grupos para o frontend`, "express");
      
      let filteredGroups = groups;
      
      if (searchTerm && groups && groups.length > 0) {
        filteredGroups = groups.filter(
          group => group.name?.toLowerCase().includes(searchTerm.toLowerCase())
        );
        log(`Filtrado para ${filteredGroups.length} grupos com o termo "${searchTerm}"`, "express");
      }
      
      res.json(filteredGroups);
    } catch (error: any) {
      log(`Erro na rota de grupos: ${error.message}`, "express");
      // Retornar array vazio em vez de erro 500
      res.json([]);
    }
  });
  
  // Get messages for a specific contact
  app.get("/api/contacts/:contactId/messages", async (req, res) => {
    try {
      const contactId = parseInt(req.params.contactId);
      
      if (isNaN(contactId)) {
        return res.status(400).json({ error: "ID de contato inválido" });
      }
      
      try {
        // Buscar mensagens do banco de dados
        // Utilizamos a função do storage que já tem toda a lógica necessária
        const messages = await storage.getMessagesForContact(contactId);
        
        // Ordenar mensagens por timestamp (mais antigas primeiro)
        const sortedMessages = messages.sort((a, b) => {
          return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
        });
        
        log(`Retornando ${sortedMessages.length} mensagens para o contato ${contactId}`, "express");
        res.json(sortedMessages);
      } catch (dbError: any) {
        log(`Erro do banco de dados ao buscar mensagens: ${dbError.message}`, "express");
        // Em caso de erro, retornamos array vazio
        res.json([]);
      }
    } catch (error: any) {
      log(`Erro geral ao buscar mensagens: ${error.message}`, "express");
      // Retornar array vazio em vez de erro 500
      res.json([]);
    }
  });

  // Send message
  app.post("/api/messages/send", async (req, res) => {
    try {
      const ready = await isClientReady();
      if (!ready) {
        return res.status(401).json({ error: "WhatsApp not connected" });
      }

      const { contactId, content, mediaUrls } = req.body;
      
      if (!contactId || !content) {
        return res.status(400).json({ error: "Contact ID and message content are required" });
      }

      const messageResult = await sendMessage(contactId, content, mediaUrls);
      res.json(messageResult);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Schedule a message
  app.post("/api/messages/schedule", async (req, res) => {
    try {
      const ready = await isClientReady();
      if (!ready) {
        return res.status(401).json({ error: "WhatsApp não conectado. Por favor, escaneie o QR code primeiro." });
      }

      log(`Recebido pedido para agendar mensagem: ${JSON.stringify(req.body)}`, "express");
      
      try {
        // Vamos verificar o esquema e permitir agendamentos imediatos (sem validação de data futura)
        // isso permite que o usuário agende mensagens para o momento atual
        let scheduledMessageData = req.body;
        
        // Verificar se temos todos os campos necessários
        if (!scheduledMessageData.contactId) {
          return res.status(400).json({ error: "ID do contato é obrigatório" });
        }
        
        if (!scheduledMessageData.content) {
          return res.status(400).json({ error: "Conteúdo da mensagem é obrigatório" });
        }
        
        if (!scheduledMessageData.scheduledTime) {
          // Se não houver horário agendado, usar o momento atual
          scheduledMessageData.scheduledTime = new Date();
        }
        
        // Garantir que mediaUrls seja um array, mesmo que vazio
        if (!scheduledMessageData.mediaUrls) {
          scheduledMessageData.mediaUrls = [];
        }
        
        // Validar recurring se presente
        if (scheduledMessageData.recurring && 
            !['none', 'daily', 'weekly', 'monthly'].includes(scheduledMessageData.recurring)) {
          scheduledMessageData.recurring = 'none';
        }
        
        // Definir status como pending
        scheduledMessageData.status = 'pending';

        log(`Dados de mensagem agendada validados: ${JSON.stringify(scheduledMessageData)}`, "express");
        
        // Tentar agendar a mensagem
        const result = await scheduleMessage(scheduledMessageData);
        res.status(201).json(result);
      } catch (error: any) {
        log(`Erro ao processar agendamento: ${error}`, "express");
        
        if (error.errors) {
          return res.status(400).json({ 
            error: "Erro de validação", 
            details: error.errors 
          });
        }
        
        return res.status(400).json({ 
          error: "Erro ao agendar mensagem", 
          message: error.message 
        });
      }
    } catch (error: any) {
      log(`Erro geral ao agendar mensagem: ${error.message}`, "express");
      res.status(500).json({ error: `Erro interno: ${error.message}` });
    }
  });

  // Get all scheduled messages
  app.get("/api/messages/scheduled", async (req, res) => {
    try {
      log("Carregando mensagens agendadas...", "express");
      const scheduled = await getAllScheduledMessages();
      
      // Log das mensagens carregadas
      log(`Mensagens agendadas carregadas: ${JSON.stringify(scheduled)}`, "express");
      
      // Se não houver mensagens agendadas, retornar array vazio
      if (!scheduled || scheduled.length === 0) {
        log("Nenhuma mensagem agendada encontrada", "express");
        return res.json([]);
      }
      
      // Adicionar os contatos para as mensagens agendadas
      const scheduledWithContacts = await Promise.all(scheduled.map(async message => {
        // Tenta obter o contato relacionado pelo contactId
        let contact = await storage.getContactById(message.contactId);
        
        // Log para debug
        log(`Contato para mensagem ${message.id}: ${JSON.stringify(contact)}`, "express");
        
        // Se o contato não for encontrado, definimos um contato padrão
        if (!contact) {
          contact = { 
            id: message.contactId, 
            name: 'Contato não encontrado', 
            phoneNumber: 'desconhecido',
            isGroup: false,
            participants: [],
            createdAt: new Date()
          };
          log(`Usando contato padrão para mensagem ${message.id}`, "express");
        }
        
        // Retorna a mensagem com o contato
        return {
          ...message,
          contact: contact
        };
      }));
      
      log(`Enviando ${scheduledWithContacts.length} mensagens agendadas`, "express");
      res.json(scheduledWithContacts);
      
    } catch (error: any) {
      log(`Erro ao obter mensagens agendadas: ${error.message}`, "express");
      // Retornar array vazio em vez de erro 500
      res.json([]);
    }
  });

  // Update a scheduled message
  app.put("/api/messages/scheduled/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid ID format" });
      }

      try {
        const data = scheduledMessagesInsertSchema.parse(req.body);
        const updated = await updateScheduledMessage(id, data);
        
        if (!updated) {
          return res.status(404).json({ error: "Scheduled message not found" });
        }
        
        res.json(updated);
      } catch (error: any) {
        if (error.errors) {
          return res.status(400).json({ error: error.errors });
        }
        throw error;
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Cancel a scheduled message
  app.delete("/api/messages/scheduled/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid ID format" });
      }

      const result = await cancelScheduledMessage(id);
      
      if (!result) {
        return res.status(404).json({ error: "Scheduled message not found" });
      }
      
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // =========== NOVAS ROTAS PARA IA E INTEGRAÇÕES ===========

  // API OpenAI - Obter configuração
  app.get("/api/config/openai", async (req, res) => {
    try {
      const config = await getApiConfig('openai');
      // Retornar apenas as informações necessárias para o frontend
      res.json({
        hasApiKey: !!config?.apiKey,
        apiKeyMasked: config?.apiKey ? `${config.apiKey.substring(0, 3)}...${config.apiKey.substring(config.apiKey.length - 4)}` : null
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // API OpenAI - Salvar configuração
  app.post("/api/config/openai", async (req, res) => {
    try {
      const { apiKey } = req.body;
      if (!apiKey) {
        return res.status(400).json({ error: "API key is required" });
      }

      const success = await saveApiKey('openai', apiKey);
      if (!success) {
        return res.status(500).json({ error: "Failed to save API key" });
      }
      
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // API Google - Obter configuração
  app.get("/api/config/google", async (req, res) => {
    try {
      const config = await getGoogleConfig();
      // Retornar apenas as informações necessárias para o frontend
      res.json({
        hasCredentials: !!(config?.clientId && config?.clientSecret),
        clientIdMasked: config?.clientId ? `${config.clientId.substring(0, 5)}...${config.clientId.substring(config.clientId.length - 5)}` : null,
        hasRefreshToken: !!config?.refreshToken
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // API Google - Salvar configuração
  app.post("/api/config/google", async (req, res) => {
    try {
      const { clientId, clientSecret, refreshToken } = req.body;
      if (!clientId || !clientSecret) {
        return res.status(400).json({ error: "Client ID and Client Secret are required" });
      }

      const success = await saveGoogleCredentials(clientId, clientSecret, refreshToken);
      if (!success) {
        return res.status(500).json({ error: "Failed to save Google credentials" });
      }
      
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // API Google - Testar conexão
  app.get("/api/config/google/test", async (req, res) => {
    try {
      const result = await checkGoogleConnection();
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Auto Responder - Obter configuração para um contato
  app.get("/api/auto-responders/:contactId", async (req, res) => {
    try {
      const contactId = parseInt(req.params.contactId);
      if (isNaN(contactId)) {
        return res.status(400).json({ error: "Invalid contact ID" });
      }

      const config = await getAutoResponderConfig(contactId);
      res.json(config || {});
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Auto Responder - Salvar configuração para um contato
  app.post("/api/auto-responders/:contactId", async (req, res) => {
    try {
      const contactId = parseInt(req.params.contactId);
      if (isNaN(contactId)) {
        return res.status(400).json({ error: "Invalid contact ID" });
      }

      const config = { ...req.body, contactId };
      const success = await saveAutoResponderConfig(config);
      
      if (!success) {
        return res.status(500).json({ error: "Failed to save auto responder config" });
      }
      
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Auto Responder - Obter templates padrão para clínica
  app.get("/api/auto-responders/templates/clinic", async (req, res) => {
    try {
      const templates = getDefaultClinicTemplates();
      res.json(templates);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Obter configuração global de auto-resposta
  app.get("/api/auto-responders/global", async (req, res) => {
    try {
      const globalConfig = await getGlobalAutoRespondConfig();
      
      if (!globalConfig) {
        return res.json({
          enabled: false,
          excludeGroups: true,
          defaultTemplate: "Recepcionista Geral"
        });
      }
      
      // Extrair configuração do campo apiKey
      try {
        const configData = JSON.parse(globalConfig.apiKey || '{}');
        res.json({
          enabled: globalConfig.active || false,
          excludeGroups: configData.excludeGroups !== false, // default true se não especificado
          defaultTemplate: configData.defaultTemplate || "Recepcionista Geral"
        });
      } catch (parseError) {
        // Em caso de erro ao fazer parse, retornar configuração padrão
        res.json({
          enabled: globalConfig.active || false,
          excludeGroups: true,
          defaultTemplate: "Recepcionista Geral"
        });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Salvar configuração global de auto-resposta
  app.post("/api/auto-responders/global", async (req, res) => {
    try {
      const { enabled, excludeGroups, defaultTemplate } = req.body;
      
      if (typeof enabled !== 'boolean') {
        return res.status(400).json({ error: "O parâmetro 'enabled' deve ser um booleano" });
      }
      
      // Parâmetros opcionais com valores padrão
      const excludeGroupsValue = excludeGroups === undefined ? true : !!excludeGroups;
      const defaultTemplateValue = defaultTemplate || "Recepcionista Geral";
      
      // Salvar configuração
      const success = await saveGlobalAutoRespondConfig(
        enabled,
        excludeGroupsValue,
        defaultTemplateValue
      );
      
      if (success) {
        res.json({ 
          success: true,
          enabled,
          excludeGroups: excludeGroupsValue,
          defaultTemplate: defaultTemplateValue
        });
      } else {
        res.status(500).json({ error: "Falha ao salvar configuração global" });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Auto Responder - Testar resposta de IA
  app.post("/api/ai/test-response", async (req, res) => {
    try {
      const { contactId, messageContent } = req.body;
      if (!contactId || !messageContent) {
        return res.status(400).json({ error: "Contact ID and message content are required" });
      }

      const response = await processIncomingMessage(contactId, null, messageContent);
      res.json({ response });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Google Calendar - Criar evento
  app.post("/api/calendar/events", async (req, res) => {
    try {
      const { summary, description, startTime, endTime, attendees } = req.body;
      
      if (!summary || !startTime || !endTime) {
        return res.status(400).json({ error: "Summary, start time, and end time are required" });
      }
      
      const event = await createCalendarEvent(
        summary,
        description || "",
        new Date(startTime),
        new Date(endTime),
        attendees || []
      );
      
      res.json(event);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  return httpServer;
}
