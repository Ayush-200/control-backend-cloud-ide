import { integer, pgTable, varchar, text, uuid, timestamp } from "drizzle-orm/pg-core";


export const users = pgTable("cloud-ide-users", {
  userId: uuid("userId").defaultRandom().primaryKey(),
  name: varchar({ length: 255 }).notNull(),
  projects: text().array().default([]).notNull(),
  email: varchar({ length: 255 }).notNull().unique(),
  password: varchar({ length: 255 }).default(''), // Allow empty string for Auth0 users
  refreshToken: varchar({length: 255}),
  accessPointId: varchar({ length: 255 }).default('')
});

export const sessions = pgTable("cloud-ide-sessions", {
  sessionId: varchar({ length: 255 }).primaryKey(),
  userId: uuid("userId").notNull().references(() => users.userId, { onDelete: 'cascade' }),
  privateIp: varchar({ length: 50 }).notNull(),
  taskArn: varchar({ length: 500 }).notNull(),
  projectId: varchar({ length: 255 }),
  projectName: varchar({ length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull()
});
