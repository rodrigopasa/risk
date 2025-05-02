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
import { WebSocketServer, WebSocket } from "ws";
import { log } from "./vite";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // Set up WebSocket server for real-time updates
  const wss = new WebSocketServer({ 
    server: httpServer,
    path: '/ws'  // Alterando para um caminho mais simples
  });
  
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
      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>WhatsApp QR Code</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
              body { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; font-family: sans-serif; }
              h3 { margin-bottom: 20px; }
              #qrcode { border: 15px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
            </style>
          </head>
          <body>
            <h3>Escaneie o QR Code com seu WhatsApp</h3>
            <div id="qrcode"></div>
            <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.0/build/qrcode.min.js"></script>
            <script>
              QRCode.toCanvas(document.getElementById('qrcode'), \`${qrCode}\`, {
                width: 256,
                margin: 2,
                color: {
                  dark: '#25D366',
                  light: '#FFFFFF'
                }
              }, function(error) {
                if (error) console.error(error);
              });
            </script>
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
      const ready = await isClientReady();
      if (!ready) {
        return res.status(401).json({ error: "WhatsApp not connected" });
      }

      const searchTerm = req.query.search as string || "";
      const contacts = await getContacts();
      
      let filteredContacts = contacts;
      
      if (searchTerm) {
        filteredContacts = contacts.filter(
          contact => contact.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }
      
      res.json(filteredContacts);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get all groups
  app.get("/api/groups", async (req, res) => {
    try {
      const ready = await isClientReady();
      if (!ready) {
        return res.status(401).json({ error: "WhatsApp not connected" });
      }

      const searchTerm = req.query.search as string || "";
      const groups = await getGroups();
      
      let filteredGroups = groups;
      
      if (searchTerm) {
        filteredGroups = groups.filter(
          group => group.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }
      
      res.json(filteredGroups);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
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
        return res.status(401).json({ error: "WhatsApp not connected" });
      }

      try {
        const scheduledMessageData = scheduledMessagesInsertSchema.parse(req.body);
        const result = await scheduleMessage(scheduledMessageData);
        res.status(201).json(result);
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

  // Get all scheduled messages
  app.get("/api/messages/scheduled", async (req, res) => {
    try {
      const scheduled = await getAllScheduledMessages();
      res.json(scheduled);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
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

  return httpServer;
}
