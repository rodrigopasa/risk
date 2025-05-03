import OpenAI from 'openai';
import { db } from '@db';
import { apiConfigs, contacts, messages, aiResponses } from '@shared/schema';
import { eq, desc, and } from 'drizzle-orm';
import { log } from '../vite';

// Tipos específicos para ChatGPT
type MessageRole = 'system' | 'user' | 'assistant';

interface ChatMessage {
  role: MessageRole;
  content: string;
}

// Interface para as opções de geração de resposta
interface GenerateResponseOptions {
  contactId: number;
  messageId?: number;
  incomingMessage: string;
  systemMessage?: string;
  promptTemplate?: string;
  model?: string;
  maxHistoryMessages?: number;
}

// Função para obter cliente OpenAI com a chave API apropriada
async function getOpenAIClient(): Promise<OpenAI | null> {
  try {
    // Buscar configuração da API da OpenAI
    const apiConfig = await db.query.apiConfigs.findFirst({
      where: and(
        eq(apiConfigs.service, 'openai'),
        eq(apiConfigs.active, true)
      )
    });

    if (!apiConfig || !apiConfig.apiKey) {
      log('OpenAI API key not configured', 'openai');
      return null;
    }

    // Criar cliente OpenAI com a chave API
    const openai = new OpenAI({
      apiKey: apiConfig.apiKey,
    });

    return openai;
  } catch (error) {
    log(`Error getting OpenAI client: ${error}`, 'openai');
    return null;
  }
}

// Função para obter histórico de mensagens para contextualização
async function getMessageHistory(contactId: number, maxMessages: number = 5) {
  try {
    const messageHistory = await db.query.messages.findMany({
      where: eq(messages.contactId, contactId),
      orderBy: [desc(messages.timestamp)],
      limit: maxMessages,
    });
    
    // Reverter para ordem cronológica (mais antigas primeiro)
    return messageHistory.reverse();
  } catch (error) {
    log(`Error getting message history: ${error}`, 'openai');
    return [];
  }
}

// Função principal para gerar resposta usando OpenAI
export async function generateAIResponse(options: GenerateResponseOptions): Promise<string | null> {
  const {
    contactId,
    messageId,
    incomingMessage,
    systemMessage,
    promptTemplate,
    model = 'gpt-4o',
    maxHistoryMessages = 5
  } = options;

  try {
    // Obter cliente OpenAI
    const openai = await getOpenAIClient();
    if (!openai) {
      throw new Error('OpenAI client could not be initialized');
    }

    // Obter informações do contato
    const contact = await db.query.contacts.findFirst({
      where: eq(contacts.id, contactId)
    });

    if (!contact) {
      throw new Error(`Contact with ID ${contactId} not found`);
    }

    // Obter histórico de mensagens para contexto
    const history = await getMessageHistory(contactId, maxHistoryMessages);
    
    // Preparar mensagens para a API
    const messages = [];
    
    // System message (instruções para o modelo)
    const defaultSystemMessage = `
    Você é um assistente de uma clínica médica profissional chamada PaZap. 
    Você não é um médico e não pode dar conselhos médicos ou diagnósticos. 
    Você pode fornecer informações gerais sobre a clínica, marcar consultas, 
    responder perguntas sobre horários e procedimentos, mas sempre deve deixar 
    claro que questões médicas precisam ser tratadas diretamente com os profissionais.
    
    Sua comunicação deve ser sempre:
    - Profissional e respeitosa
    - Clara e concisa
    - Útil e informativa
    - Empática, mas sem diagnosticar ou tratar
    
    Quando não souber uma resposta, indique que vai verificar com a equipe médica 
    e solicite um contato posterior.
    `;
    
    messages.push({
      role: 'system',
      content: systemMessage || defaultSystemMessage
    });
    
    // Adicionar histórico de mensagens para contexto
    for (const msg of history) {
      messages.push({
        role: msg.fromMe ? 'assistant' : 'user',
        content: msg.content
      });
    }
    
    // Adicionar a mensagem atual
    messages.push({
      role: 'user',
      content: incomingMessage
    });
    
    // Se tiver um template de prompt específico, adicionar como última instrução
    if (promptTemplate) {
      // Substituir variáveis no template
      let processedTemplate = promptTemplate
        .replace('{contact_name}', contact.name)
        .replace('{message}', incomingMessage);
      
      messages.push({
        role: 'system',
        content: processedTemplate
      });
    }

    // Fazer a chamada para a API da OpenAI
    const response = await openai.chat.completions.create({
      model: model, // o modelo mais recente da OpenAI é "gpt-4o" lançado em 13 de maio de 2024
      messages: messages.map(msg => ({
        role: msg.role as 'system' | 'user' | 'assistant',
        content: msg.content
      })),
      temperature: 0.7,
      max_tokens: 500,
    });

    const aiResponse = response.choices[0].message.content;
    
    if (!aiResponse) {
      throw new Error('OpenAI returned empty response');
    }
    
    // Salvar a resposta no banco de dados
    await db.insert(aiResponses).values({
      contactId,
      messageId,
      incomingMessage,
      response: aiResponse,
      promptUsed: JSON.stringify(messages)
    });
    
    return aiResponse;
  } catch (error) {
    log(`Error generating AI response: ${error}`, 'openai');
    return null;
  }
}

// Função para verificar se um contato tem resposta automática configurada
export async function shouldAutoRespond(contactId: number): Promise<boolean> {
  try {
    const autoResponder = await db.query.autoResponders.findFirst({
      where: and(
        eq(apiConfigs.service, 'openai'),
        eq(apiConfigs.active, true)
      )
    });
    
    if (!autoResponder || !autoResponder.enabled) {
      return false;
    }
    
    // Se estiver configurado para sempre responder, retorna true
    if (autoResponder.autoRespondWhen === 'always') {
      return true;
    }
    
    // Se estiver configurado para responder em horário específico, verificar horário
    if (autoResponder.autoRespondWhen === 'custom_hours' &&
        autoResponder.workingHoursStart &&
        autoResponder.workingHoursEnd) {
      const now = new Date();
      const currentTime = now.getHours() * 60 + now.getMinutes(); // minutos desde meia-noite
      
      const [startHour, startMinute] = autoResponder.workingHoursStart.split(':').map(Number);
      const [endHour, endMinute] = autoResponder.workingHoursEnd.split(':').map(Number);
      
      const startTime = startHour * 60 + startMinute;
      const endTime = endHour * 60 + endMinute;
      
      return currentTime >= startTime && currentTime <= endTime;
    }
    
    return false;
  } catch (error) {
    log(`Error checking auto-respond config: ${error}`, 'openai');
    return false;
  }
}

// Função para salvar chave da API
export async function saveApiKey(service: string, apiKey: string): Promise<boolean> {
  try {
    // Verificar se já existe uma configuração para este serviço
    const existingConfig = await db.query.apiConfigs.findFirst({
      where: eq(apiConfigs.service, service)
    });
    
    if (existingConfig) {
      // Atualizar configuração existente
      await db.update(apiConfigs)
        .set({ 
          apiKey, 
          active: true,
          updatedAt: new Date()
        })
        .where(eq(apiConfigs.id, existingConfig.id));
    } else {
      // Criar nova configuração
      await db.insert(apiConfigs).values({
        service,
        apiKey,
        active: true
      });
    }
    
    return true;
  } catch (error) {
    log(`Error saving API key: ${error}`, 'openai');
    return false;
  }
}

// Função para obter a configuração atual da API
export async function getApiConfig(service: string = 'openai') {
  try {
    const config = await db.query.apiConfigs.findFirst({
      where: eq(apiConfigs.service, service)
    });
    
    // Nunca retornar a chave API completa, apenas status
    if (config) {
      const { apiKey, ...safeConfig } = config;
      return {
        ...safeConfig,
        hasApiKey: !!apiKey,
        apiKeyMasked: apiKey ? `${apiKey.substring(0, 3)}...${apiKey.substring(apiKey.length - 4)}` : null
      };
    }
    
    return null;
  } catch (error) {
    log(`Error getting API config: ${error}`, 'openai');
    return null;
  }
}