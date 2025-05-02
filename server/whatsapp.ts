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
  return Boolean(client?.info);
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

    client.on("authenticated", () => {
      log("WhatsApp client is authenticated", "whatsapp");
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
    
    const whatsappContacts = await client.getContacts();
    
    for (const contact of whatsappContacts) {
      // Skip if not a valid contact
      if (!contact.id.user || contact.id.user === "status") continue;
      
      // Format the phone number with country code
      const phoneNumber = `${contact.id._serialized}`;
      
      // Check if contact already exists
      const existingContact = await db.query.contacts.findFirst({
        where: eq(contacts.phoneNumber, phoneNumber)
      });
      
      if (!existingContact) {
        // Insert new contact
        await db.insert(contacts).values({
          name: contact.name || contact.pushname || phoneNumber,
          phoneNumber: phoneNumber,
          profilePicUrl: await contact.getProfilePicUrl() || null,
          isGroup: false
        });
      }
    }
    
    // Now sync groups
    const chats = await client.getChats();
    const groups = chats.filter(chat => chat.isGroup);
    
    for (const group of groups) {
      const phoneNumber = `${group.id._serialized}`;
      
      // Check if group already exists
      const existingGroup = await db.query.contacts.findFirst({
        where: eq(contacts.phoneNumber, phoneNumber)
      });
      
      if (!existingGroup) {
        // For GroupChat, we need to handle participants properly
        // But we can't directly access them as TypeScript doesn't know it's a GroupChat
        // In real implementation, we'd use proper type guards
        let participants: string[] = [];
        try {
          // This is a workaround, in a real app we'd use proper type checking
          // @ts-ignore - participants exists on GroupChat but not on Chat
          if (group.participants) {
            // @ts-ignore
            participants = group.participants.map((p: any) => p.id._serialized);
          }
        } catch (e) {
          log(`Error getting participants: ${e}`, "whatsapp");
        }
        
        // Get profile pic URL safely
        let profilePicUrl = null;
        try {
          // @ts-ignore - getProfilePicUrl exists but TypeScript doesn't know about it
          profilePicUrl = await client.getProfilePicUrl(group.id._serialized);
        } catch (e) {
          log(`Error getting profile pic: ${e}`, "whatsapp");
        }
        
        // Insert new group
        await db.insert(contacts).values({
          name: group.name,
          phoneNumber: phoneNumber,
          profilePicUrl: profilePicUrl,
          isGroup: true,
          participants: participants
        });
      }
    }
    
    log("Contact sync completed", "whatsapp");
  } catch (error) {
    log(`Error syncing contacts: ${error}`, "whatsapp");
    throw new Error(`Failed to sync contacts: ${error}`);
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
