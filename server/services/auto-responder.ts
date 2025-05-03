import { db } from '@db';
import { autoResponders, contacts, messages, apiConfigs } from '@shared/schema';
import { eq, and, ne } from 'drizzle-orm';
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

// Obter configuração global de auto resposta
export async function getGlobalAutoRespondConfig() {
  try {
    const config = await db.query.apiConfigs.findFirst({
      where: and(
        eq(apiConfigs.service, 'auto_responder_global'),
        eq(apiConfigs.active, true)
      )
    });
    
    return config;
  } catch (error) {
    log(`Error getting global auto-responder config: ${error}`, 'auto-responder');
    return null;
  }
}

// Salvar configuração global de auto resposta
export async function saveGlobalAutoRespondConfig(
  enabled: boolean, 
  excludeGroups: boolean = true,
  defaultTemplate: string = "Recepcionista Geral"
): Promise<boolean> {
  try {
    // Verificar se já existe uma configuração global
    const existingConfig = await db.query.apiConfigs.findFirst({
      where: eq(apiConfigs.service, 'auto_responder_global')
    });
    
    // Preparar dados como JSON string para salvar nas configs
    const configData = JSON.stringify({
      enabled,
      excludeGroups,
      defaultTemplate
    });
    
    if (existingConfig) {
      // Atualizar configuração existente
      await db.update(apiConfigs)
        .set({ 
          apiKey: configData, // Usando campo apiKey para armazenar a config
          active: enabled,
          updatedAt: new Date()
        })
        .where(eq(apiConfigs.id, existingConfig.id));
    } else {
      // Criar nova configuração
      await db.insert(apiConfigs).values({
        service: 'auto_responder_global',
        apiKey: configData,
        active: enabled
      });
    }
    
    return true;
  } catch (error) {
    log(`Error saving global auto-responder config: ${error}`, 'auto-responder');
    return false;
  }
}

// Função para processar mensagem recebida e gerar resposta automática se configurado
export async function processIncomingMessage(contactId: number, messageId: number | null, messageContent: string): Promise<string | null> {
  try {
    // Verificar se este contato deve receber resposta automática por configuração individual
    if (!await shouldAutoRespond(contactId)) {
      // Se não tiver configuração individual, verificar se está ativa a resposta global
      const globalConfig = await getGlobalAutoRespondConfig();
      
      if (!globalConfig || !globalConfig.active) {
        return null; // Não há configuração global ativa
      }
      
      try {
        // Verificar se é um grupo (IDs >= 1000 são grupos)
        const isGroup = contactId >= 1000;
        
        // Obter configuração global como objeto JSON
        const globalConfigData = JSON.parse(globalConfig.apiKey || '{}');
        
        // Se for um grupo e a configuração está para excluir grupos, não responde
        if (isGroup && globalConfigData.excludeGroups) {
          log(`Não respondendo para o grupo com ID ${contactId} (configuração global)`, 'auto-responder');
          return null;
        }
        
        // Usar template padrão para resposta global
        const templates = getDefaultClinicTemplates();
        const defaultTemplate = templates.find(t => t.name === globalConfigData.defaultTemplate) || templates[0];
        
        // Gerar resposta usando o template padrão configurado
        const response = await generateAIResponse({
          contactId,
          messageId: messageId || undefined,
          incomingMessage: messageContent,
          systemMessage: defaultTemplate.systemMessage,
          promptTemplate: defaultTemplate.promptTemplate,
          model: 'gpt-4o', // usar o modelo padrão para respostas globais
          maxHistoryMessages: 5 // usar 5 como padrão para histórico
        });
        
        return response;
      } catch (error) {
        log(`Erro ao processar configuração global: ${error}`, 'auto-responder');
        return null;
      }
    }
    
    // Se chegou aqui, tem uma configuração específica para este contato
    // Obter configuração do auto-responder
    const config = await getAutoResponderConfig(contactId);
    if (!config) {
      return null;
    }
    
    // Gerar resposta com base na configuração
    const response = await generateAIResponse({
      contactId,
      messageId: messageId || undefined,
      incomingMessage: messageContent,
      systemMessage: config.systemMessage || undefined,
      promptTemplate: config.promptTemplate || undefined,
      model: config.aiModel || undefined,
      maxHistoryMessages: config.maxHistoryMessages || undefined
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