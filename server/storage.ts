import { db } from "@db";
import { contacts, messages, scheduledMessages, whatsappSessions } from '@shared/schema';
import { eq, and, or, desc, asc, like } from 'drizzle-orm';
import { log } from "./vite";

export const storage = {
  // Contact operations
  async getContactById(id: number) {
    return await db.query.contacts.findFirst({
      where: eq(contacts.id, id)
    });
  },
  
  async getContactByPhoneNumber(phoneNumber: string) {
    return await db.query.contacts.findFirst({
      where: eq(contacts.phoneNumber, phoneNumber)
    });
  },
  
  async getAllContacts() {
    return await db.query.contacts.findMany({
      where: eq(contacts.isGroup, false),
      orderBy: asc(contacts.name)
    });
  },
  
  async searchContacts(searchTerm: string) {
    return await db.query.contacts.findMany({
      where: and(
        eq(contacts.isGroup, false),
        or(
          like(contacts.name, `%${searchTerm}%`),
          like(contacts.phoneNumber, `%${searchTerm}%`)
        )
      ),
      orderBy: asc(contacts.name)
    });
  },
  
  // Group operations
  async getAllGroups() {
    return await db.query.contacts.findMany({
      where: eq(contacts.isGroup, true),
      orderBy: asc(contacts.name)
    });
  },
  
  async searchGroups(searchTerm: string) {
    return await db.query.contacts.findMany({
      where: and(
        eq(contacts.isGroup, true),
        like(contacts.name, `%${searchTerm}%`)
      ),
      orderBy: asc(contacts.name)
    });
  },
  
  // Message operations
  async getMessagesForContact(contactId: number, limit = 50) {
    return await db.query.messages.findMany({
      where: eq(messages.contactId, contactId),
      orderBy: desc(messages.timestamp),
      limit
    });
  },
  
  async insertMessage(messageData: any) {
    const [newMessage] = await db.insert(messages).values(messageData).returning();
    return newMessage;
  },
  
  // Scheduled message operations
  async getScheduledMessageById(id: number) {
    return await db.query.scheduledMessages.findFirst({
      where: eq(scheduledMessages.id, id),
      with: {
        contact: true
      }
    });
  },
  
  async getAllScheduledMessages() {
    try {
      log("Buscando todas as mensagens agendadas do banco de dados...", "storage");
      
      // Consultando mensagens agendadas com informações dos contatos
      const messages = await db.query.scheduledMessages.findMany({
        with: {
          contact: true
        }
      });
      
      log(`Encontradas ${messages.length} mensagens agendadas com informações de contato`, "storage");
      return messages;
    } catch (error) {
      if (error instanceof Error) {
        log(`Erro no storage ao obter mensagens agendadas: ${error.message}`, "storage");
      } else {
        log(`Erro no storage ao obter mensagens agendadas: ${String(error)}`, "storage");
      }
      return [];
    }
  },
  
  async insertScheduledMessage(messageData: any) {
    const [newScheduledMessage] = await db.insert(scheduledMessages)
      .values(messageData)
      .returning();
    return newScheduledMessage;
  },
  
  async updateScheduledMessage(id: number, messageData: any) {
    const [updatedMessage] = await db.update(scheduledMessages)
      .set(messageData)
      .where(eq(scheduledMessages.id, id))
      .returning();
    return updatedMessage;
  },
  
  async deleteScheduledMessage(id: number) {
    const [deletedMessage] = await db.delete(scheduledMessages)
      .where(eq(scheduledMessages.id, id))
      .returning();
    return deletedMessage;
  },
  
  // WhatsApp session operations
  async getActiveSession() {
    return await db.query.whatsappSessions.findFirst({
      where: eq(whatsappSessions.isActive, true),
      orderBy: desc(whatsappSessions.updatedAt)
    });
  },
  
  async saveSession(sessionData: any) {
    try {
      // Deactivate all existing sessions
      await db.update(whatsappSessions)
        .set({ isActive: false })
        .where(eq(whatsappSessions.isActive, true));
      
      // Create new active session
      const [newSession] = await db.insert(whatsappSessions)
        .values({
          isActive: true,
          sessionData: sessionData
        })
        .returning();
      
      return newSession;
    } catch (error) {
      log(`Error saving session: ${error}`, "storage");
      throw new Error(`Failed to save WhatsApp session: ${error}`);
    }
  }
};
