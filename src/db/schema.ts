import { pgTable, serial, varchar, text, boolean, timestamp, jsonb, integer } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  role: varchar('role', { length: 10 }).default('staff'),
  isActive: boolean('is_active').default(true),
  notificationPreferences: jsonb('notification_preferences'),
  lastLoginAt: timestamp('last_login_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const messages = pgTable('messages', {
  id: serial('id').primaryKey(),
  source: varchar('source', { length: 20 }).default('contact'),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 50 }),
  company: varchar('company', { length: 255 }),
  subject: varchar('subject', { length: 500 }),
  body: text('body').notNull(),
  priority: varchar('priority', { length: 10 }).default('normal'),
  status: varchar('status', { length: 20 }).default('new').notNull(),
  isDeleted: boolean('is_deleted').default(false).notNull(),
  metadata: jsonb('metadata'),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const messageReplies = pgTable('message_replies', {
  id: serial('id').primaryKey(),
  messageId: integer('message_id').notNull(),
  userId: integer('user_id').notNull(),
  replyBody: text('reply_body').notNull(),
  sentVia: varchar('sent_via', { length: 10 }).default('email'),
  emailSentAt: timestamp('email_sent_at'),
  emailStatus: varchar('email_status', { length: 10 }).default('pending'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const messageViews = pgTable('message_views', {
  id: serial('id').primaryKey(),
  messageId: integer('message_id').notNull(),
  userId: integer('user_id').notNull(),
  viewedAt: timestamp('viewed_at').defaultNow(),
});

export const messageActivity = pgTable('message_activity', {
  id: serial('id').primaryKey(),
  messageId: integer('message_id').notNull(),
  userId: integer('user_id'),
  action: varchar('action', { length: 30 }).notNull(),
  details: jsonb('details'),
  ipAddress: varchar('ip_address', { length: 45 }),
  createdAt: timestamp('created_at').defaultNow(),
});

export const sessions = pgTable('sessions', {
  id: varchar('id', { length: 128 }).primaryKey(),
  userId: integer('user_id').notNull(),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  lastActivity: timestamp('last_activity').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
  expiresAt: timestamp('expires_at').notNull(),
});

export const rateLimits = pgTable('rate_limits', {
  id: serial('id').primaryKey(),
  identifier: varchar('identifier', { length: 255 }).notNull(),
  endpoint: varchar('endpoint', { length: 255 }).notNull(),
  requestCount: integer('request_count').default(1),
  windowStart: timestamp('window_start').defaultNow(),
});
