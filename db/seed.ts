import { db } from "./index";
import * as schema from "@shared/schema";

async function seed() {
  try {
    console.log("Starting database seed...");

    // Only add seed data if tables are empty
    const existingContacts = await db.query.contacts.findMany({
      limit: 1
    });

    if (existingContacts.length === 0) {
      console.log("Seeding contacts...");
      
      // Add sample contacts - these will be replaced by real contacts from WhatsApp
      // when a user connects their account
      await db.insert(schema.contacts).values([
        {
          name: "João da Silva",
          phoneNumber: "5511912345678",
          isGroup: false,
          profilePicUrl: null
        },
        {
          name: "Maria Almeida",
          phoneNumber: "5511987654321",
          isGroup: false,
          profilePicUrl: null
        },
        {
          name: "Time Marketing",
          phoneNumber: "551123456789-group",
          isGroup: true,
          participants: ["5511912345678", "5511987654321"]
        },
        {
          name: "Família Extendida",
          phoneNumber: "551187654321-group",
          isGroup: true,
          participants: ["5511912345678", "5511987654321"]
        }
      ]);
    }

    // Check for scheduled messages
    const existingScheduledMessages = await db.query.scheduledMessages.findMany({
      limit: 1
    });

    if (existingScheduledMessages.length === 0) {
      console.log("Seeding scheduled messages...");
      
      // Get the contacts we just created
      const allContacts = await db.query.contacts.findMany();
      
      if (allContacts.length > 0) {
        // Create sample scheduled messages
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(9, 0, 0, 0);
        
        const nextWeek = new Date();
        nextWeek.setDate(nextWeek.getDate() + 7);
        nextWeek.setHours(15, 30, 0, 0);
        
        await db.insert(schema.scheduledMessages).values([
          {
            contactId: allContacts[0].id,
            content: "Olá! Lembrete sobre nossa reunião amanhã",
            scheduledTime: tomorrow,
            status: "pending",
            recurring: "none"
          },
          {
            contactId: allContacts[2].id,
            content: "Relatório semanal de desempenho da campanha",
            scheduledTime: nextWeek,
            status: "pending",
            recurring: "weekly"
          }
        ]);
      }
    }

    console.log("Seed completed successfully!");
  } catch (error) {
    console.error("Error seeding database:", error);
  }
}

seed();
