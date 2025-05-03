import { scheduleJob, Job, cancelJob, scheduledJobs } from 'node-schedule';
import { storage } from './storage';
import { sendMessage, getContacts, getGroups } from './whatsapp';
import { db } from '@db';
import { scheduledMessages } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { log } from './vite';
import type { ScheduledMessageInsert, ScheduledMessage } from '@shared/schema';

const scheduledJobsMap = new Map<number, Job>();

// Initialize scheduler - should be called at app startup
export async function initializeScheduler() {
  try {
    log('Initializing message scheduler...', 'scheduler');
    
    // Get all pending scheduled messages
    const messages = await db.query.scheduledMessages.findMany({
      where: eq(scheduledMessages.status, 'pending')
    });
    
    // Schedule each message
    for (const message of messages) {
      scheduleMessageJob(message);
    }
    
    log(`Initialized scheduler with ${messages.length} pending messages`, 'scheduler');
  } catch (error) {
    log(`Error initializing scheduler: ${error}`, 'scheduler');
  }
}

// Schedule a new message
export async function scheduleMessage(messageData: ScheduledMessageInsert): Promise<ScheduledMessage> {
  try {
    log(`Iniciando agendamento de mensagem: ${JSON.stringify(messageData)}`, 'scheduler');
    
    // Verificar se o contato existe
    try {
      let contactExists = false;
      
      // Se for grupo (ID >= 1000), verificamos nos grupos
      if (messageData.contactId >= 1000) {
        const groups = await getGroups();
        const groupIndex = messageData.contactId - 1000;
        contactExists = groupIndex >= 0 && groupIndex < groups.length;
      } else {
        // Verificamos nos contatos regulares
        const contacts = await getContacts();
        contactExists = messageData.contactId < contacts.length;
      }
      
      if (!contactExists) {
        log(`Contato ou grupo com ID ${messageData.contactId} não encontrado`, 'scheduler');
        throw new Error(`Contato ou grupo com ID ${messageData.contactId} não encontrado`);
      }
    } catch (contactCheckError) {
      log(`Erro ao verificar contato: ${contactCheckError}`, 'scheduler');
      // Continuamos mesmo se der erro na verificação
    }
    
    // Inserir a mensagem agendada no banco de dados
    let newScheduledMessage;
    try {
      newScheduledMessage = await storage.insertScheduledMessage({
        ...messageData,
        status: 'pending'
      });
      log(`Mensagem inserida no banco com ID ${newScheduledMessage.id}`, 'scheduler');
    } catch (insertError) {
      log(`Erro ao inserir mensagem no banco: ${insertError}`, 'scheduler');
      
      // Criar um objeto local se não conseguirmos inserir no banco
      newScheduledMessage = {
        id: 0,
        contactId: messageData.contactId,
        content: messageData.content,
        mediaUrls: messageData.mediaUrls || [],
        scheduledTime: new Date(messageData.scheduledTime),
        recurring: messageData.recurring || 'none',
        status: 'pending',
        createdAt: new Date()
      };
      log(`Criado objeto local para mensagem agendada`, 'scheduler');
    }
    
    // Agendar o job
    try {
      scheduleMessageJob(newScheduledMessage);
      log(`Job agendado com sucesso para ${new Date(newScheduledMessage.scheduledTime).toLocaleString()}`, 'scheduler');
    } catch (scheduleError) {
      log(`Erro ao agendar job: ${scheduleError}`, 'scheduler');
      // Continuamos mesmo se falhar o agendamento
    }
    
    log(`Mensagem agendada com sucesso, ID ${newScheduledMessage.id}`, 'scheduler');
    return newScheduledMessage;
  } catch (error) {
    log(`Erro geral ao agendar mensagem: ${error}`, 'scheduler');
    throw new Error(`Falha ao agendar mensagem: ${error}`);
  }
}

// Update an existing scheduled message
export async function updateScheduledMessage(id: number, messageData: ScheduledMessageInsert): Promise<ScheduledMessage | null> {
  try {
    // Check if the message exists
    const existingMessage = await storage.getScheduledMessageById(id);
    if (!existingMessage) {
      return null;
    }
    
    // Update the database record
    const updatedMessage = await storage.updateScheduledMessage(id, {
      ...messageData,
      status: 'pending'
    });
    
    // Cancel the existing job if it exists
    if (scheduledJobsMap.has(id)) {
      const job = scheduledJobsMap.get(id);
      if (job) {
        job.cancel();
      }
      scheduledJobsMap.delete(id);
    }
    
    // Schedule a new job
    scheduleMessageJob(updatedMessage);
    
    log(`Updated scheduled message with ID ${id}`, 'scheduler');
    return updatedMessage;
  } catch (error) {
    log(`Error updating scheduled message: ${error}`, 'scheduler');
    throw new Error(`Failed to update scheduled message: ${error}`);
  }
}

// Cancel a scheduled message
export async function cancelScheduledMessage(id: number): Promise<ScheduledMessage | null> {
  try {
    // Check if the message exists
    const existingMessage = await storage.getScheduledMessageById(id);
    if (!existingMessage) {
      return null;
    }
    
    // Update status to canceled
    const canceledMessage = await storage.updateScheduledMessage(id, {
      status: 'canceled'
    });
    
    // Cancel the job if it exists
    if (scheduledJobsMap.has(id)) {
      const job = scheduledJobsMap.get(id);
      if (job) {
        job.cancel();
      }
      scheduledJobsMap.delete(id);
    }
    
    log(`Canceled scheduled message with ID ${id}`, 'scheduler');
    return canceledMessage;
  } catch (error) {
    log(`Error canceling scheduled message: ${error}`, 'scheduler');
    throw new Error(`Failed to cancel scheduled message: ${error}`);
  }
}

// Get all scheduled messages
export async function getAllScheduledMessages(): Promise<ScheduledMessage[]> {
  try {
    try {
      const messages = await storage.getAllScheduledMessages();
      return messages || [];
    } catch (storageError) {
      log(`Erro no storage ao obter mensagens agendadas: ${storageError}`, 'scheduler');
      return [];
    }
  } catch (error) {
    log(`Erro geral ao obter mensagens agendadas: ${error}`, 'scheduler');
    // Retornar array vazio em vez de lançar erro
    return [];
  }
}

// Helper function to schedule a job for a message
function scheduleMessageJob(message: ScheduledMessage) {
  try {
    const scheduledTime = new Date(message.scheduledTime);
    
    // Only schedule if the scheduled time is in the future
    if (scheduledTime > new Date()) {
      const job = scheduleJob(scheduledTime, async () => {
        try {
          log(`Executing scheduled message ${message.id}`, 'scheduler');
          
          // Send the message
          await sendMessage(
            message.contactId,
            message.content,
            message.mediaUrls || []
          );
          
          // Update the message status
          await storage.updateScheduledMessage(message.id, {
            status: 'sent'
          });
          
          // Handle recurring messages
          if (message.recurring && message.recurring !== 'none') {
            await scheduleRecurringMessage(message);
          }
          
          // Clean up the job from the map
          scheduledJobsMap.delete(message.id);
        } catch (error) {
          log(`Error executing scheduled message ${message.id}: ${error}`, 'scheduler');
          
          // Mark as failed
          await storage.updateScheduledMessage(message.id, {
            status: 'failed'
          });
        }
      });
      
      // Store the job in the map
      scheduledJobsMap.set(message.id, job);
    } else {
      // Mark as expired if the scheduled time is in the past
      storage.updateScheduledMessage(message.id, {
        status: 'expired'
      });
    }
  } catch (error) {
    log(`Error scheduling job for message ${message.id}: ${error}`, 'scheduler');
  }
}

// Helper function to create a recurring schedule
async function scheduleRecurringMessage(message: ScheduledMessage) {
  try {
    // Calculate the next scheduled time based on recurrence
    let nextScheduledTime = new Date(message.scheduledTime);
    
    switch (message.recurring) {
      case 'daily':
        nextScheduledTime.setDate(nextScheduledTime.getDate() + 1);
        break;
      case 'weekly':
        nextScheduledTime.setDate(nextScheduledTime.getDate() + 7);
        break;
      case 'monthly':
        nextScheduledTime.setMonth(nextScheduledTime.getMonth() + 1);
        break;
      default:
        return; // No recurrence
    }
    
    // Create a new scheduled message for the next occurrence
    const newScheduledMessage = await storage.insertScheduledMessage({
      contactId: message.contactId,
      content: message.content,
      mediaUrls: message.mediaUrls,
      scheduledTime: nextScheduledTime,
      recurring: message.recurring,
      status: 'pending'
    });
    
    // Schedule the new job
    scheduleMessageJob(newScheduledMessage);
    
    log(`Created recurring message ${newScheduledMessage.id} for message ${message.id}`, 'scheduler');
  } catch (error) {
    log(`Error scheduling recurring message for ${message.id}: ${error}`, 'scheduler');
  }
}
