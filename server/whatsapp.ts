import whatsappWeb from "whatsapp-web.js";
const { Client, LocalAuth } = whatsappWeb;
import { db } from "@db";
import { contacts, messages } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import { log } from "./vite"; 

let client: typeof Client.prototype | null = null;
let qrCodeData: string | null = null;
let generatingQR = false;

export function getClient(): typeof Client.prototype | null {
  return client;
}

export async function isClientReady(): Promise<boolean> {
  // Verificação mais robusta de status de conexão
  try {
    if (!client) return false;
    
    // Verificamos se o cliente está inicializado
    if (!client.info) return false;
    
    // Verificamos se o cliente está conectado
    try {
      // Verificação adicional para confirmar que a conexão está ativa
      const connectionState = await client.getState();
      return connectionState === 'CONNECTED';
    } catch (e) {
      // Se não conseguir obter o estado, verifica se pelo menos temos info
      return Boolean(client.info);
    }
  } catch (error) {
    log(`Error checking client ready state: ${error}`, "whatsapp");
    return false;
  }
}

export function getQRCode(): string | null {
  return qrCodeData;
}

export function disableQRCode(): void {
  qrCodeData = null;
  generatingQR = false;
}

export async function initializeWhatsApp(
  qrCallback: (qr: string) => void,
  readyCallback: () => void
): Promise<void> {
  try {
    if (client) {
      log("WhatsApp client is already initialized", "whatsapp");
      return;
    }

    log("Initializing WhatsApp client...", "whatsapp");

    // Create a new client
    client = new Client({
      authStrategy: new LocalAuth({ dataPath: "./whatsapp-auth" }),
      puppeteer: {
        headless: true,
        executablePath: process.env.NODE_ENV === 'production' 
          ? undefined 
          : '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu',
          '--disable-extensions'
        ]
      }
    });

    // Register event handlers
    client.on("qr", (qr) => {
      log("QR code received", "whatsapp");
      qrCodeData = qr;
      generatingQR = true;
      qrCallback(qr);
    });

    client.on("ready", async () => {
      log("WhatsApp client is ready", "whatsapp");
      qrCodeData = null;
      generatingQR = false;
      readyCallback();
      await syncContacts();
    });

    client.on("authenticated", async () => {
      log("WhatsApp client is authenticated", "whatsapp");
      
      // Broadcast authenticated state to all WebSocket clients
      try {
        const WebSocketServer = (await import('ws')).WebSocketServer;
        const WebSocket = (await import('ws')).WebSocket;
        
        // Verificar se há um servidor WebSocket no app
        const getWss = () => {
          // @ts-ignore - o httpServer anexado ao app pode ter um wss
          const wss = global.wss;
          return wss;
        };
        
        const wss = getWss();
        if (wss) {
          log("Broadcasting authenticated state to WebSocket clients", "whatsapp");
          wss.clients.forEach((client: any) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({ type: "authenticated", data: true }));
            }
          });
        }
      } catch (e) {
        log(`Error broadcasting authenticated state: ${e}`, "whatsapp");
      }
    });

    client.on("auth_failure", (msg) => {
      log(`WhatsApp authentication failed: ${msg}`, "whatsapp");
    });

    client.on("disconnected", (reason) => {
      log(`WhatsApp client disconnected: ${reason}`, "whatsapp");
      // Reset client on disconnect
      client = null;
      qrCodeData = null;
      generatingQR = false;
    });

    client.on("message", async (message) => {
      try {
        log(`New message received from ${message.from}`, "whatsapp");
        
        // Store message in database
        const contact = await db.query.contacts.findFirst({
          where: eq(contacts.phoneNumber, message.from)
        });
        
        if (contact) {
          await db.insert(messages).values({
            contactId: contact.id,
            content: message.body,
            fromMe: false,
            status: "received",
            mediaUrls: []
          });
        }
      } catch (error) {
        log(`Error processing incoming message: ${error}`, "whatsapp");
      }
    });

    // Initialize client
    await client.initialize();
  } catch (error) {
    log(`Error initializing WhatsApp client: ${error}`, "whatsapp");
    throw new Error(`Failed to initialize WhatsApp client: ${error}`);
  }
}

// Sync contacts from WhatsApp to database
async function syncContacts() {
  try {
    if (!client || !client.info) {
      throw new Error("WhatsApp client is not ready");
    }

    log("Syncing contacts from WhatsApp...", "whatsapp");
    
    try {
      // Inserir pelo menos um contato padrão para evitar problemas quando não há contatos
      const defaultContact = {
        name: "Meus Contatos",
        phoneNumber: "default",
        profilePicUrl: null,
        isGroup: false,
        participants: []
      };
      
      const existingDefault = await db.query.contacts.findFirst({
        where: eq(contacts.phoneNumber, "default")
      });
      
      if (!existingDefault) {
        await db.insert(contacts).values(defaultContact);
        log("Inserted default contact", "whatsapp");
      }
      
      // Tente obter alguns contatos, mas não falhe se houver problemas
      try {
        const whatsappContacts = await client.getContacts();
        log(`Got ${whatsappContacts.length} contacts from WhatsApp`, "whatsapp");
        
        let processedCount = 0;
        
        for (const contact of whatsappContacts) {
          try {
            // Skip if not a valid contact
            if (!contact.id?.user || contact.id.user === "status") continue;
            
            // Format the phone number with country code
            const phoneNumber = `${contact.id._serialized}`;
            
            // Check if contact already exists
            const existingContact = await db.query.contacts.findFirst({
              where: eq(contacts.phoneNumber, phoneNumber)
            });
            
            if (!existingContact) {
              let profilePicUrl = null;
              try {
                if (typeof contact.getProfilePicUrl === 'function') {
                  profilePicUrl = await contact.getProfilePicUrl() || null;
                }
              } catch (picError) {
                log(`Could not get profile pic for contact: ${picError}`, "whatsapp");
              }
              
              // Insert new contact
              await db.insert(contacts).values({
                name: contact.name || contact.pushname || phoneNumber,
                phoneNumber: phoneNumber,
                profilePicUrl: profilePicUrl,
                isGroup: false,
                participants: []
              });
              
              processedCount++;
            }
          } catch (contactError) {
            log(`Error processing individual contact: ${contactError}`, "whatsapp");
            // Continue with next contact
            continue;
          }
        }
        
        log(`Successfully processed ${processedCount} contacts`, "whatsapp");
      } catch (contactsError) {
        log(`Error getting contacts list: ${contactsError}`, "whatsapp");
        // Don't throw, continue with other operations
      }
      
      // Attempt to sync groups, but don't fail if there's an issue
      try {
        const chats = await client.getChats();
        const groups = chats.filter(chat => chat.isGroup);
        log(`Got ${groups.length} groups from WhatsApp`, "whatsapp");
        
        for (const group of groups) {
          try {
            if (!group.id?._serialized) continue;
            
            const phoneNumber = `${group.id._serialized}`;
            
            // Check if group already exists
            const existingGroup = await db.query.contacts.findFirst({
              where: eq(contacts.phoneNumber, phoneNumber)
            });
            
            if (!existingGroup) {
              await db.insert(contacts).values({
                name: group.name || "Grupo",
                phoneNumber: phoneNumber,
                profilePicUrl: null,
                isGroup: true,
                participants: []
              });
            }
          } catch (groupError) {
            log(`Error processing individual group: ${groupError}`, "whatsapp");
            // Continue with next group
            continue;
          }
        }
      } catch (groupsError) {
        log(`Error getting groups list: ${groupsError}`, "whatsapp");
        // Don't throw, we've at least tried to sync what we can
      }
    } catch (syncError) {
      log(`Non-fatal error during contact sync: ${syncError}`, "whatsapp");
      // Don't rethrow, we want the app to continue working even if contact sync fails
    }
    
    log("Contact sync completed", "whatsapp");
  } catch (error) {
    log(`Error in syncContacts main function: ${error}`, "whatsapp");
    // Don't throw the error, just log it. This way the app can continue working
    // even if contact sync fails
  }
}

// Get all contacts
export async function getContacts() {
  try {
    if (!client || !client.info) {
      throw new Error("WhatsApp client is not ready");
    }
    
    const result = await db.query.contacts.findMany({
      where: eq(contacts.isGroup, false),
      orderBy: contacts.name
    });
    
    return result;
  } catch (error) {
    log(`Error getting contacts: ${error}`, "whatsapp");
    throw new Error(`Failed to get contacts: ${error}`);
  }
}

// Get all groups
export async function getGroups() {
  try {
    if (!client || !client.info) {
      throw new Error("WhatsApp client is not ready");
    }
    
    const result = await db.query.contacts.findMany({
      where: eq(contacts.isGroup, true),
      orderBy: contacts.name
    });
    
    return result;
  } catch (error) {
    log(`Error getting groups: ${error}`, "whatsapp");
    throw new Error(`Failed to get groups: ${error}`);
  }
}

// Send a message to a contact or group
export async function sendMessage(contactId: number, content: string, mediaUrls: string[] = []) {
  try {
    if (!client || !client.info) {
      throw new Error("WhatsApp client is not ready");
    }
    
    // Get contact from database
    const contact = await db.query.contacts.findFirst({
      where: eq(contacts.id, contactId)
    });
    
    if (!contact) {
      throw new Error("Contact not found");
    }
    
    // Send message to WhatsApp
    const sent = await client.sendMessage(contact.phoneNumber, content);
    
    // Store message in database
    const [newMessage] = await db.insert(messages).values({
      contactId: contact.id,
      content: content,
      fromMe: true,
      status: "sent",
      mediaUrls: mediaUrls
    }).returning();
    
    return newMessage;
  } catch (error) {
    log(`Error sending message: ${error}`, "whatsapp");
    throw new Error(`Failed to send message: ${error}`);
  }
}
