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
  scheduledTime: (schema) => schema.refine(val => new Date(val) > new Date(), {
    message: "Scheduled time must be in the future"
  })
});
export type ScheduledMessageInsert = z.infer<typeof scheduledMessagesInsertSchema>;
export type ScheduledMessage = typeof scheduledMessages.$inferSelect;

export const whatsappSessionsInsertSchema = createInsertSchema(whatsappSessions);
export type WhatsappSessionInsert = z.infer<typeof whatsappSessionsInsertSchema>;
export type WhatsappSession = typeof whatsappSessions.$inferSelect;
