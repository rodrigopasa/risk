import whatsappWeb from "whatsapp-web.js";
const { Client, LocalAuth } = whatsappWeb;
import { db } from "@db";
import { contacts, messages } from "@shared/schema";
import { eq, desc, and, ne } from "drizzle-orm";
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
      throw new Error("Cliente WhatsApp não está pronto para sincronização");
    }

    log("Sincronizando contatos do WhatsApp...", "whatsapp");
    
    try {
      // Primeiro inserimos um contato padrão para evitar problemas de UI
      const defaultContact = {
        name: "Meus Contatos",
        phoneNumber: "default",
        profilePicUrl: null,
        isGroup: false,
        participants: []
      };
      
      try {
        const existingDefault = await db.query.contacts.findFirst({
          where: eq(contacts.phoneNumber, "default")
        });
        
        if (!existingDefault) {
          await db.insert(contacts).values(defaultContact);
          log("Contato padrão inserido", "whatsapp");
        }
      } catch (defaultError) {
        log(`Erro verificando contato padrão: ${defaultError}`, "whatsapp");
        // Tenta inserir de qualquer forma
        try {
          await db.insert(contacts).values(defaultContact);
        } catch (insertError) {
          log(`Erro ao inserir contato padrão: ${insertError}`, "whatsapp");
        }
      }
      
      // Limpa contatos antigos e sincroniza contatos atuais do número conectado
      try {
        log("Iniciando sincronização de contatos individuais", "whatsapp");
        
        // Tenta limpar contatos antigos para evitar informações desatualizadas
        // Mas preserva o contato padrão
        try {
          await db.delete(contacts).where(
            and(
              ne(contacts.phoneNumber, "default"),
              eq(contacts.isGroup, false)
            )
          );
          log("Contatos antigos removidos para garantir dados atualizados", "whatsapp");
        } catch (deleteError) {
          log(`Erro ao limpar contatos antigos: ${deleteError}`, "whatsapp");
          // Continua mesmo se não conseguir limpar
        }
        
        // Obtém contatos do número de WhatsApp conectado
        const whatsappContacts = await client.getContacts();
        log(`Obtidos ${whatsappContacts.length} contatos do número conectado ao WhatsApp`, "whatsapp");
        
        // Processa em lotes menores para evitar sobrecarga
        const validContacts = whatsappContacts.filter(contact => 
          contact.id?.user && contact.id.user !== "status");
        
        log(`Encontrados ${validContacts.length} contatos válidos para sincronização`, "whatsapp");
        
        let processedCount = 0;
        
        // Processa contatos em lotes menores para evitar sobrecarga
        for (let i = 0; i < validContacts.length; i += 5) {
          const batch = validContacts.slice(i, i + 5);
          
          for (const contact of batch) {
            try {
              // Formata o número de telefone
              const phoneNumber = `${contact.id._serialized}`;
              
              // Tenta obter foto de perfil
              let profilePicUrl = null;
              try {
                if (typeof contact.getProfilePicUrl === 'function') {
                  profilePicUrl = await contact.getProfilePicUrl() || null;
                }
              } catch (picError) {
                log(`Erro ao obter foto de perfil: ${picError}`, "whatsapp");
              }
              
              // Insere o novo contato diretamente (já que limpamos anteriormente)
              try {
                await db.insert(contacts).values({
                  name: contact.name || contact.pushname || phoneNumber,
                  phoneNumber: phoneNumber,
                  profilePicUrl: profilePicUrl,
                  isGroup: false,
                  participants: []
                });
                processedCount++;
              } catch (insertError) {
                log(`Erro ao inserir contato: ${insertError}`, "whatsapp");
                
                // Em caso de erro de duplicidade, tenta atualizar
                try {
                  await db.update(contacts)
                    .set({
                      name: contact.name || contact.pushname || phoneNumber,
                      profilePicUrl: profilePicUrl
                    })
                    .where(eq(contacts.phoneNumber, phoneNumber));
                } catch (updateError) {
                  log(`Erro ao atualizar contato: ${updateError}`, "whatsapp");
                }
              }
            } catch (contactError) {
              log(`Erro processando contato: ${contactError}`, "whatsapp");
              continue;
            }
          }
          
          // Pequena pausa entre lotes para evitar sobrecarga
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        log(`Processados ${processedCount} contatos do número conectado`, "whatsapp");
      } catch (contactsError) {
        log(`Erro ao sincronizar contatos: ${contactsError}`, "whatsapp");
      }
      
      // Limpa grupos antigos e sincroniza grupos atuais
      try {
        log("Iniciando sincronização de grupos", "whatsapp");
        
        // Tenta limpar grupos antigos para evitar informações desatualizadas
        try {
          await db.delete(contacts).where(eq(contacts.isGroup, true));
          log("Grupos antigos removidos para garantir dados atualizados", "whatsapp");
        } catch (deleteError) {
          log(`Erro ao limpar grupos antigos: ${deleteError}`, "whatsapp");
          // Continua mesmo se não conseguir limpar
        }

        // Obtém todos os chats (incluindo grupos) do número conectado
        const chats = await client.getChats();
        const groups = chats.filter(chat => chat.isGroup);
        log(`Obtidos ${groups.length} grupos do número conectado ao WhatsApp`, "whatsapp");
        
        let groupCount = 0;
        
        // Processa grupos em lotes para melhor performance
        for (let i = 0; i < groups.length; i += 5) {
          const batch = groups.slice(i, i + 5);
          
          for (const group of batch) {
            try {
              if (!group.id?._serialized) continue;
              
              const phoneNumber = `${group.id._serialized}`;
              
              // Tentar obter participantes do grupo, se disponível na API
              let participants = [];
              try {
                // Método alternativo para obter participantes dependendo da versão da API
                if (group._data && group._data.participants) {
                  participants = group._data.participants.map((p: any) => p.id);
                } else if ((group as any).participants) {
                  participants = (group as any).participants.map((p: any) => p.id?._serialized || p.id);
                }
              } catch (participantsError) {
                log(`Erro ao obter participantes do grupo: ${participantsError}`, "whatsapp");
              }
              
              // Insere o grupo no banco de dados
              try {
                await db.insert(contacts).values({
                  name: group.name || "Grupo",
                  phoneNumber: phoneNumber,
                  profilePicUrl: null,
                  isGroup: true,
                  participants: participants
                });
                groupCount++;
              } catch (insertError) {
                log(`Erro ao inserir grupo: ${insertError}`, "whatsapp");
              }
            } catch (groupError) {
              log(`Erro processando grupo: ${groupError}`, "whatsapp");
              continue;
            }
          }
          
          // Pequena pausa entre lotes para evitar sobrecarga
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        log(`Processados ${groupCount} grupos do número conectado`, "whatsapp");
      } catch (groupsError) {
        log(`Erro ao sincronizar grupos: ${groupsError}`, "whatsapp");
      }
    } catch (syncError) {
      log(`Erro não fatal durante sincronização: ${syncError}`, "whatsapp");
    }
    
    log("Sincronização de contatos concluída", "whatsapp");
  } catch (error) {
    log(`Erro na função principal syncContacts: ${error}`, "whatsapp");
  }
}

// Get all contacts
export async function getContacts() {
  try {
    // Mesmo que o cliente não esteja totalmente pronto, podemos tentar retornar contatos do banco
    // ao invés de lançar um erro imediatamente
    try {
      // Verificação mais suave - se o cliente estiver pronto, perfeito
      // se não, usamos o banco de dados de qualquer forma
      if (client && client.info) {
        log("Cliente WhatsApp pronto, obtendo contatos", "whatsapp");
      } else {
        log("Cliente WhatsApp não está pronto, usando apenas o banco de dados", "whatsapp");
      }
      
      // Sempre retornamos o que temos no banco
      const result = await db.query.contacts.findMany({
        where: eq(contacts.isGroup, false),
        orderBy: contacts.name
      });
      
      // Se não temos contatos ainda, pelo menos retornamos um array vazio
      // em vez de um erro 500
      return result || [];
    } catch (dbError) {
      // Em caso de erro no banco, criamos um contato padrão para não quebrar a UI
      log(`Erro ao buscar contatos do banco: ${dbError}`, "whatsapp");
      return [{
        id: 0,
        name: "Default Contact",
        phoneNumber: "default",
        profilePicUrl: null,
        isGroup: false,
        participants: [],
        createdAt: new Date()
      }];
    }
  } catch (error) {
    log(`Erro ao obter contatos: ${error}`, "whatsapp");
    // Retornamos array vazio em vez de lançar erro
    return [];
  }
}

// Get all groups
export async function getGroups() {
  try {
    // Mesmo que o cliente não esteja totalmente pronto, podemos tentar retornar grupos do banco
    // ao invés de lançar um erro imediatamente
    try {
      // Verificação mais suave - se o cliente estiver pronto, perfeito
      // se não, usamos o banco de dados de qualquer forma
      if (client && client.info) {
        log("Cliente WhatsApp pronto, obtendo grupos", "whatsapp");
      } else {
        log("Cliente WhatsApp não está pronto, usando apenas o banco de dados", "whatsapp");
      }
      
      // Sempre retornamos o que temos no banco
      const result = await db.query.contacts.findMany({
        where: eq(contacts.isGroup, true),
        orderBy: contacts.name
      });
      
      // Se não temos grupos ainda, pelo menos retornamos um array vazio
      // em vez de um erro 500
      return result || [];
    } catch (dbError) {
      // Em caso de erro no banco, retornamos array vazio para não quebrar a UI
      log(`Erro ao buscar grupos do banco: ${dbError}`, "whatsapp");
      return [];
    }
  } catch (error) {
    log(`Erro ao obter grupos: ${error}`, "whatsapp");
    // Retornamos array vazio em vez de lançar erro
    return [];
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
