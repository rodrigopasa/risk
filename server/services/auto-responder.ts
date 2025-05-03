import { db } from '@db';
import { autoResponders, contacts, messages } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { log } from '../vite';
import { generateAIResponse, shouldAutoRespond } from './openai';

// Interface para configuração do auto-respondedor
interface AutoResponderConfig {
  contactId: number;
  enabled: boolean;
  autoRespondWhen: string;
  workingHoursStart?: string;
  workingHoursEnd?: string;
  promptTemplate: string;
  systemMessage?: string;
  maxHistoryMessages?: number;
  aiModel?: string;
  allowScheduling?: boolean;
  requireApproval?: boolean;
}

// Função para salvar configuração de resposta automática
export async function saveAutoResponderConfig(config: AutoResponderConfig): Promise<boolean> {
  try {
    // Verificar se já existe uma configuração para este contato
    const existingConfig = await db.query.autoResponders.findFirst({
      where: eq(autoResponders.contactId, config.contactId)
    });
    
    if (existingConfig) {
      // Atualizar configuração existente
      await db.update(autoResponders)
        .set({ 
          ...config,
          updatedAt: new Date()
        })
        .where(eq(autoResponders.id, existingConfig.id));
    } else {
      // Criar nova configuração
      await db.insert(autoResponders).values(config);
    }
    
    return true;
  } catch (error) {
    log(`Error saving auto-responder config: ${error}`, 'auto-responder');
    return false;
  }
}

// Função para obter configuração de resposta automática
export async function getAutoResponderConfig(contactId: number) {
  try {
    const config = await db.query.autoResponders.findFirst({
      where: eq(autoResponders.contactId, contactId)
    });
    
    return config;
  } catch (error) {
    log(`Error getting auto-responder config: ${error}`, 'auto-responder');
    return null;
  }
}

// Função para processar mensagem recebida e gerar resposta automática se configurado
export async function processIncomingMessage(contactId: number, messageId: number, messageContent: string): Promise<string | null> {
  try {
    // Verificar se este contato deve receber resposta automática
    if (!await shouldAutoRespond(contactId)) {
      return null;
    }
    
    // Obter configuração do auto-responder
    const config = await getAutoResponderConfig(contactId);
    if (!config) {
      return null;
    }
    
    // Gerar resposta com base na configuração
    const response = await generateAIResponse({
      contactId,
      messageId,
      incomingMessage: messageContent,
      systemMessage: config.systemMessage,
      promptTemplate: config.promptTemplate,
      model: config.aiModel,
      maxHistoryMessages: config.maxHistoryMessages
    });
    
    return response;
  } catch (error) {
    log(`Error processing incoming message: ${error}`, 'auto-responder');
    return null;
  }
}

// Função para listar contatos com resposta automática configurada
export async function getAutoRespondingContacts() {
  try {
    const autoRespondingContacts = await db.query.autoResponders.findMany({
      with: {
        contact: true
      },
      where: eq(autoResponders.enabled, true)
    });
    
    return autoRespondingContacts;
  } catch (error) {
    log(`Error getting auto-responding contacts: ${error}`, 'auto-responder');
    return [];
  }
}

// Função para criar templates de resposta padrão para clínica médica
export function getDefaultClinicTemplates() {
  return [
    {
      name: "Recepcionista Geral",
      systemMessage: `
        Você é um assistente virtual para uma clínica médica.
        Você deve ser profissional, educado e prestativo.
        Nunca forneça diagnósticos ou conselhos médicos.
        Seu objetivo é auxiliar com informações sobre a clínica, 
        agendamentos e procedimentos administrativos.
      `,
      promptTemplate: `
        Responda à seguinte mensagem de {contact_name} de forma educada e profissional:
        "{message}"
        
        Lembre-se:
        - Não forneça diagnósticos
        - Ofereça ajuda com agendamentos
        - Sugira falar com profissionais médicos para questões clínicas
      `
    },
    {
      name: "Agendamento de Consultas",
      systemMessage: `
        Você é um assistente virtual especializado em agendamento de consultas.
        Colete informações essenciais: nome, especialidade desejada e preferências de horário.
        Verifique disponibilidade e confirme detalhes.
        Seja eficiente e claro em suas respostas.
      `,
      promptTemplate: `
        {contact_name} está tentando agendar ou perguntar sobre uma consulta:
        "{message}"
        
        Ajude a:
        - Coletar informações necessárias para agendamento
        - Explicar processo de agendamento
        - Confirmar detalhes e próximos passos
      `
    },
    {
      name: "Perguntas Frequentes",
      systemMessage: `
        Você é um assistente virtual especializado em responder perguntas frequentes sobre a clínica.
        Conhece informações sobre horários, endereços, estacionamento, convênios e procedimentos básicos.
        Seja conciso e direto nas respostas.
      `,
      promptTemplate: `
        {contact_name} tem uma pergunta sobre a clínica:
        "{message}"
        
        Forneça informações sobre:
        - Localização, horários e facilidades
        - Procedimentos administrativos
        - Convênios e formas de pagamento
        - Encaminhe para um atendente humano questões complexas
      `
    },
    {
      name: "Confirmação de Consulta",
      systemMessage: `
        Você é um assistente virtual responsável por confirmar consultas e enviar lembretes.
        Seu tom deve ser amigável, mas profissional.
        Você deve incluir detalhes importantes como data, hora e preparações necessárias.
      `,
      promptTemplate: `
        Esta é uma mensagem para {contact_name} sobre confirmação de consulta:
        "{message}"
        
        Se for uma confirmação de consulta:
        - Confirme os detalhes (data/hora)
        - Lembre sobre documentos necessários
        - Pergunte se há dúvidas adicionais
        
        Se for um cancelamento ou remarcação:
        - Confirme a intenção
        - Ofereça alternativas
        - Seja compreensivo
      `
    }
  ];
}