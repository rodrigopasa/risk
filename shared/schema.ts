import { pgTable, text, serial, integer, timestamp, boolean, jsonb } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { relations } from 'drizzle-orm';
import { z } from 'zod';

export const contacts = pgTable('contacts', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  phoneNumber: text('phone_number').notNull().unique(),
  profilePicUrl: text('profile_pic_url'),
  isGroup: boolean('is_group').default(false).notNull(),
  participants: text('participants').array(),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

export const messages = pgTable('messages', {
  id: serial('id').primaryKey(),
  contactId: integer('contact_id').references(() => contacts.id).notNull(),
  content: text('content').notNull(),
  mediaUrls: text('media_urls').array(),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  fromMe: boolean('from_me').default(true).notNull(),
  status: text('status').default('pending')
});

export const scheduledMessages = pgTable('scheduled_messages', {
  id: serial('id').primaryKey(),
  contactId: integer('contact_id').references(() => contacts.id).notNull(),
  content: text('content').notNull(),
  mediaUrls: text('media_urls').array(),
  scheduledTime: timestamp('scheduled_time').notNull(),
  recurring: text('recurring').default('none'),
  status: text('status').default('pending'),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

export const whatsappSessions = pgTable('whatsapp_sessions', {
  id: serial('id').primaryKey(),
  isActive: boolean('is_active').default(false),
  sessionData: jsonb('session_data'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

// Relations
export const contactsRelations = relations(contacts, ({ many }) => ({
  messages: many(messages),
  scheduledMessages: many(scheduledMessages)
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  contact: one(contacts, { fields: [messages.contactId], references: [contacts.id] })
}));

export const scheduledMessagesRelations = relations(scheduledMessages, ({ one }) => ({
  contact: one(contacts, { fields: [scheduledMessages.contactId], references: [contacts.id] })
}));

// Schemas
export const contactsInsertSchema = createInsertSchema(contacts, {
  name: (schema) => schema.min(1, "Name is required"),
  phoneNumber: (schema) => schema.min(1, "Phone number is required")
});
export type ContactInsert = z.infer<typeof contactsInsertSchema>;
export type Contact = typeof contacts.$inferSelect;

export const messagesInsertSchema = createInsertSchema(messages, {
  content: (schema) => schema.min(1, "Message content is required")
});
export type MessageInsert = z.infer<typeof messagesInsertSchema>;
export type Message = typeof messages.$inferSelect;

export const scheduledMessagesInsertSchema = createInsertSchema(scheduledMessages, {
  content: (schema) => schema.min(1, "Message content is required"),
  // Removida a validação que exigia horário futuro
});
export type ScheduledMessageInsert = z.infer<typeof scheduledMessagesInsertSchema>;
export type ScheduledMessage = typeof scheduledMessages.$inferSelect;

export const whatsappSessionsInsertSchema = createInsertSchema(whatsappSessions);
export type WhatsappSessionInsert = z.infer<typeof whatsappSessionsInsertSchema>;
export type WhatsappSession = typeof whatsappSessions.$inferSelect;

// Tabelas para a integração com IA e serviços externos

// Tabela para armazenar configurações de API
export const apiConfigs = pgTable('api_configs', {
  id: serial('id').primaryKey(),
  service: text('service').notNull(), // 'openai', 'google', etc.
  apiKey: text('api_key'),
  clientId: text('client_id'),
  clientSecret: text('client_secret'),
  refreshToken: text('refresh_token'),
  accessToken: text('access_token'),
  expiresAt: timestamp('expires_at'),
  active: boolean('active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

// Tabela para configurações de respostas automáticas por contato
export const autoResponders = pgTable('auto_responders', {
  id: serial('id').primaryKey(),
  contactId: integer('contact_id').references(() => contacts.id).notNull(),
  enabled: boolean('enabled').default(false).notNull(),
  autoRespondWhen: text('auto_respond_when').default('always'), // 'always', 'away', 'custom_hours'
  workingHoursStart: text('working_hours_start'),
  workingHoursEnd: text('working_hours_end'),
  promptTemplate: text('prompt_template').notNull(),
  systemMessage: text('system_message'),
  maxHistoryMessages: integer('max_history_messages').default(5),
  aiModel: text('ai_model').default('gpt-4o'),
  allowScheduling: boolean('allow_scheduling').default(false),
  requireApproval: boolean('require_approval').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

// Tabela para armazenar conversas geradas por IA
export const aiResponses = pgTable('ai_responses', {
  id: serial('id').primaryKey(),
  contactId: integer('contact_id').references(() => contacts.id).notNull(),
  messageId: integer('message_id').references(() => messages.id),
  incomingMessage: text('incoming_message').notNull(),
  response: text('response').notNull(),
  promptUsed: text('prompt_used'),
  status: text('status').default('generated'), // 'generated', 'sent', 'edited', 'rejected'
  editedResponse: text('edited_response'),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

// Tabela para armazenar eventos agendados via IA
export const aiScheduledEvents = pgTable('ai_scheduled_events', {
  id: serial('id').primaryKey(),
  contactId: integer('contact_id').references(() => contacts.id).notNull(),
  messageId: integer('message_id').references(() => messages.id),
  eventTitle: text('event_title').notNull(),
  eventDescription: text('event_description'),
  startTime: timestamp('start_time').notNull(),
  endTime: timestamp('end_time'),
  calendarId: text('calendar_id'),
  googleEventId: text('google_event_id'),
  status: text('status').default('scheduled'), // 'scheduled', 'confirmed', 'cancelled'
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

// Relações adicionais
export const autoRespondersRelations = relations(autoResponders, ({ one }) => ({
  contact: one(contacts, { fields: [autoResponders.contactId], references: [contacts.id] })
}));

export const aiResponsesRelations = relations(aiResponses, ({ one }) => ({
  contact: one(contacts, { fields: [aiResponses.contactId], references: [contacts.id] }),
  message: one(messages, { fields: [aiResponses.messageId], references: [messages.id] })
}));

export const aiScheduledEventsRelations = relations(aiScheduledEvents, ({ one }) => ({
  contact: one(contacts, { fields: [aiScheduledEvents.contactId], references: [contacts.id] }),
  message: one(messages, { fields: [aiScheduledEvents.messageId], references: [messages.id] })
}));

// Schemas para as novas tabelas
export const apiConfigsInsertSchema = createInsertSchema(apiConfigs, {
  service: (schema) => schema.min(1, "Service type is required"),
});
export type ApiConfigInsert = z.infer<typeof apiConfigsInsertSchema>;
export type ApiConfig = typeof apiConfigs.$inferSelect;

export const autoRespondersInsertSchema = createInsertSchema(autoResponders, {
  promptTemplate: (schema) => schema.min(1, "Prompt template is required"),
});
export type AutoResponderInsert = z.infer<typeof autoRespondersInsertSchema>;
export type AutoResponder = typeof autoResponders.$inferSelect;

export const aiResponsesInsertSchema = createInsertSchema(aiResponses, {
  incomingMessage: (schema) => schema.min(1, "Incoming message is required"),
  response: (schema) => schema.min(1, "Response is required"),
});
export type AiResponseInsert = z.infer<typeof aiResponsesInsertSchema>;
export type AiResponse = typeof aiResponses.$inferSelect;

export const aiScheduledEventsInsertSchema = createInsertSchema(aiScheduledEvents, {
  eventTitle: (schema) => schema.min(1, "Event title is required"),
});
export type AiScheduledEventInsert = z.infer<typeof aiScheduledEventsInsertSchema>;
export type AiScheduledEvent = typeof aiScheduledEvents.$inferSelect;
