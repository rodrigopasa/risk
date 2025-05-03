import whatsappWeb from "whatsapp-web.js";
const { Client, LocalAuth } = whatsappWeb;
import { db } from "@db";
import { contacts, messages, autoResponders } from "@shared/schema";
import { eq, desc, and, ne } from "drizzle-orm";
import { log } from "./vite"; 
import { processIncomingMessage } from "./services/auto-responder";

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
        
        if (!contact) {
          log(`Contact not found for number ${message.from}`, "whatsapp");
          return;
        }
        
        // Inserir a mensagem no banco de dados
        const [insertedMessage] = await db.insert(messages).values({
          contactId: contact.id,
          content: message.body,
          fromMe: false,
          status: "received",
          mediaUrls: []
        }).returning();
        
        // Verificar se o contato tem configuração para respostas automáticas
        log(`Verificando se o contato ${contact.id} tem respostas automáticas configuradas`, "whatsapp");
        
        // Verificar se existe uma configuração de resposta automática para este contato
        const autoResponder = await db.query.autoResponders.findFirst({
          where: eq(autoResponders.contactId, contact.id),
        });
        
        if (autoResponder && autoResponder.enabled) {
          log(`Contato ${contact.name} tem resposta automática ativada`, "whatsapp");
          
          // Gerar resposta automática
          const autoResponse = await processIncomingMessage(
            contact.id, 
            insertedMessage.id,
            message.body
          );
          
          if (autoResponse) {
            log(`Resposta automática gerada: ${autoResponse.substring(0, 50)}...`, "whatsapp");
            
            // Enviar resposta automática
            await sendMessage(contact.id, autoResponse);
          } else {
            log(`Não foi possível gerar resposta automática para o contato ${contact.id}`, "whatsapp");
          }
        } else {
          log(`Contato ${contact.name} não tem resposta automática ativada`, "whatsapp");
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
    if (client && client.info) {
      log("Cliente WhatsApp pronto, obtendo contatos diretamente da API", "whatsapp");
      
      try {
        // Obter contatos diretamente do WhatsApp Web
        const whatsappContacts = await client.getContacts();
        
        // Filtrar contatos válidos
        const validContacts = whatsappContacts
          .filter(contact => contact.id?.user && contact.id.user !== "status")
          .filter(contact => !contact.isGroup); // Garantir que não pegamos grupos
        
        log(`Obtidos ${validContacts.length} contatos válidos diretamente do WhatsApp`, "whatsapp");
        
        // Transformar para o formato esperado pela aplicação
        const formattedContacts = await Promise.all(validContacts.map(async (contact, index) => {
          let profilePicUrl = null;
          try {
            if (typeof contact.getProfilePicUrl === 'function') {
              profilePicUrl = await contact.getProfilePicUrl() || null;
            }
          } catch (picError) {
            // Ignorar erros de foto de perfil
          }
          
          return {
            id: index + 1, // ID temporário para a UI
            name: contact.name || contact.pushname || contact.id._serialized,
            phoneNumber: contact.id._serialized,
            profilePicUrl: profilePicUrl,
            isGroup: false,
            participants: [],
            createdAt: new Date()
          };
        }));
        
        // Adicionar um contato padrão ao início para garantir que temos pelo menos um
        formattedContacts.unshift({
          id: 0,
          name: "Todos os contatos",
          phoneNumber: "default",
          profilePicUrl: null,
          isGroup: false,
          participants: [],
          createdAt: new Date()
        });
        
        return formattedContacts;
      } catch (apiError) {
        log(`Erro ao obter contatos da API do WhatsApp: ${apiError}`, "whatsapp");
      }
    }
    
    log("Cliente WhatsApp não conectado ou erro na API, usando contato padrão", "whatsapp");
    
    // Retornar ao menos um contato padrão para evitar problemas na UI
    return [{
      id: 0,
      name: "Sem contatos disponíveis",
      phoneNumber: "default",
      profilePicUrl: null,
      isGroup: false,
      participants: [],
      createdAt: new Date()
    }];
  } catch (error) {
    log(`Erro geral ao obter contatos: ${error}`, "whatsapp");
    return [{
      id: 0,
      name: "Erro ao carregar contatos",
      phoneNumber: "default",
      profilePicUrl: null,
      isGroup: false,
      participants: [],
      createdAt: new Date()
    }];
  }
}

// Get all groups
export async function getGroups() {
  try {
    if (client && client.info) {
      log("Cliente WhatsApp pronto, obtendo grupos diretamente da API", "whatsapp");
      
      try {
        // Obter grupos diretamente do WhatsApp Web
        const chats = await client.getChats();
        const groups = chats.filter(chat => chat.isGroup);
        
        log(`Obtidos ${groups.length} grupos diretamente do WhatsApp`, "whatsapp");
        
        // Transformar para o formato esperado pela aplicação
        const formattedGroups = groups.map((group, index) => {
          // Tentativa de obter participantes quando disponível
          let participants: string[] = [];
          try {
            // Tentar diferentes propriedades dependendo da versão da API
            if ((group as any)._data && (group as any)._data.participants) {
              participants = (group as any)._data.participants.map((p: any) => p.id || '');
            } else if ((group as any).participants) {
              participants = (group as any).participants.map((p: any) => 
                (p.id && p.id._serialized) ? p.id._serialized : (p.id || ''));
            }
          } catch (e) {
            // Ignorar erros de participantes
          }
          
          return {
            id: 1000 + index, // IDs começando em 1000 para grupos para diferenciar de contatos
            name: group.name || "Grupo sem nome",
            phoneNumber: group.id._serialized,
            profilePicUrl: null, // Grupos geralmente não têm API fácil para fotos
            isGroup: true,
            participants: participants,
            createdAt: new Date()
          };
        });
        
        return formattedGroups;
      } catch (apiError) {
        log(`Erro ao obter grupos da API do WhatsApp: ${apiError}`, "whatsapp");
      }
    }
    
    log("Cliente WhatsApp não conectado ou erro na API, usando array vazio de grupos", "whatsapp");
    return [];
  } catch (error) {
    log(`Erro geral ao obter grupos: ${error}`, "whatsapp");
    return [];
  }
}

// Send a message to a contact or group
export async function sendMessage(contactId: number, content: string, mediaUrls: string[] = []) {
  try {
    if (!client || !client.info) {
      throw new Error("Cliente WhatsApp não está pronto para enviar mensagens");
    }
    
    log(`Tentando enviar mensagem para contactId ${contactId}`, "whatsapp");
    
    // Primeiro tentamos obter o contato do banco de dados
    let phoneNumber: string | null = null;
    let foundContact = null;
    
    try {
      foundContact = await db.query.contacts.findFirst({
        where: eq(contacts.id, contactId)
      });
      
      if (foundContact) {
        phoneNumber = foundContact.phoneNumber;
        log(`Encontrado contato no banco: ${foundContact.name}`, "whatsapp");
      }
    } catch (dbError) {
      log(`Erro ao buscar contato no banco: ${dbError}`, "whatsapp");
      // Continuamos mesmo com erro do banco
    }
    
    // Se não encontramos no banco, vamos tentar buscar diretamente em memória
    if (!phoneNumber) {
      log("Contato não encontrado no banco, tentando API direta", "whatsapp");
      
      // Verificar se é um grupo (IDs de grupo começam em 1000)
      if (contactId >= 1000) {
        try {
          const chats = await client.getChats();
          const groups = chats.filter(chat => chat.isGroup);
          
          if (groups.length > 0) {
            const groupIndex = contactId - 1000;
            if (groupIndex >= 0 && groupIndex < groups.length) {
              const group = groups[groupIndex];
              phoneNumber = group.id._serialized;
              log(`Encontrado grupo por índice: ${group.name}`, "whatsapp");
            }
          }
        } catch (groupError) {
          log(`Erro ao buscar grupo por índice: ${groupError}`, "whatsapp");
        }
      } else {
        // É um contato individual
        try {
          const contacts = await client.getContacts();
          const validContacts = contacts.filter(c => c.id?.user && c.id.user !== "status");
          
          if (validContacts.length > 0) {
            const contactIndex = contactId;
            if (contactIndex >= 0 && contactIndex < validContacts.length) {
              const contact = validContacts[contactIndex];
              phoneNumber = contact.id._serialized;
              log(`Encontrado contato por índice: ${contact.name || contact.pushname}`, "whatsapp");
            }
          }
        } catch (contactError) {
          log(`Erro ao buscar contato por índice: ${contactError}`, "whatsapp");
        }
      }
    }
    
    if (!phoneNumber) {
      throw new Error(`Contato ou grupo não encontrado para o ID: ${contactId}`);
    }
    
    log(`Enviando mensagem para o número: ${phoneNumber}`, "whatsapp");
    
    // Remover tags HTML do conteúdo da mensagem
    let cleanContent = content;
    try {
      // Remover tags <p> e </p> 
      cleanContent = content.replace(/<\/?p>/g, '');
      
      // Remover outras tags HTML comuns
      cleanContent = cleanContent.replace(/<\/?[^>]+(>|$)/g, '');
      
      // Substituir &nbsp; por espaço
      cleanContent = cleanContent.replace(/&nbsp;/g, ' ');
      
      // Substituir <br> por quebra de linha
      cleanContent = cleanContent.replace(/<br\s*\/?>/gi, '\n');
      
      log(`Conteúdo limpo: "${cleanContent}"`, "whatsapp");
    } catch (parseError) {
      log(`Erro ao limpar HTML do conteúdo: ${parseError}`, "whatsapp");
      // Se houver erro, usamos o conteúdo original
      cleanContent = content;
    }
    
    // Verificar se há arquivos de mídia para enviar
    let sent;
    
    if (mediaUrls && mediaUrls.length > 0) {
      log(`Enviando ${mediaUrls.length} arquivos de mídia`, "whatsapp");
      
      // Enviar cada arquivo de mídia com a mensagem
      for (const mediaUrl of mediaUrls) {
        try {
          log(`Enviando mídia: ${mediaUrl}`, "whatsapp");
          
          // Se começa com data:, é uma imagem base64
          if (mediaUrl.startsWith('data:')) {
            // Extrair o tipo de mídia e os dados base64
            const match = mediaUrl.match(/^data:([^;]+);base64,(.+)$/);
            if (match) {
              const [, mimeType, base64Data] = match;
              const mediaData = Buffer.from(base64Data, 'base64');
              
              // Verificar tipo de mídia
              if (mimeType.startsWith('image/')) {
                sent = await client.sendMessage(phoneNumber, {
                  body: cleanContent,
                  media: mediaData
                });
                log(`Imagem enviada com sucesso: ${mimeType}`, "whatsapp");
              } else if (mimeType.startsWith('application/') || mimeType.startsWith('text/')) {
                // Tentar enviar como documento
                sent = await client.sendMessage(phoneNumber, {
                  body: cleanContent,
                  media: mediaData,
                  // Se possível, determinar o nome do arquivo baseado no conteúdo
                  filename: `documento.${mimeType.split('/')[1] || 'file'}`
                });
                log(`Documento enviado com sucesso: ${mimeType}`, "whatsapp");
              } else {
                // Mídia não reconhecida, tentar enviar como arquivo genérico
                sent = await client.sendMessage(phoneNumber, {
                  body: cleanContent,
                  media: mediaData
                });
                log(`Mídia enviada como arquivo genérico: ${mimeType}`, "whatsapp");
              }
            } else {
              throw new Error("Formato de dados base64 inválido");
            }
          } else {
            // URL externa, podemos tentar baixar e enviar
            sent = await client.sendMessage(phoneNumber, {
              body: cleanContent,
              media: mediaUrl
            });
            log(`Mídia enviada via URL: ${mediaUrl}`, "whatsapp");
          }
        } catch (mediaError) {
          log(`Erro ao enviar mídia ${mediaUrl}: ${mediaError}`, "whatsapp");
          // Em caso de erro com a mídia, enviamos pelo menos o texto
          sent = await client.sendMessage(phoneNumber, cleanContent);
        }
      }
    } else {
      // Sem mídia, apenas enviar o texto
      sent = await client.sendMessage(phoneNumber, cleanContent);
    }
    
    log("Mensagem enviada com sucesso!", "whatsapp");
    
    // Armazena a mensagem no banco
    let messageRecord;
    try {
      const [newMessage] = await db.insert(messages).values({
        contactId: contactId,
        content: content,
        fromMe: true,
        status: "sent",
        mediaUrls: mediaUrls
      }).returning();
      
      messageRecord = newMessage;
      log("Mensagem salva no banco de dados", "whatsapp");
    } catch (dbError) {
      log(`Erro ao salvar mensagem no banco: ${dbError}`, "whatsapp");
      // Mesmo com erro no banco, continuamos e retornamos um objeto básico
      messageRecord = {
        id: 0,
        contactId: contactId,
        content: content,
        fromMe: true,
        status: "sent",
        mediaUrls: mediaUrls,
        createdAt: new Date()
      };
    }
    
    return messageRecord;
  } catch (error) {
    log(`Erro ao enviar mensagem: ${error}`, "whatsapp");
    throw new Error(`Falha ao enviar mensagem: ${error}`);
  }
}
