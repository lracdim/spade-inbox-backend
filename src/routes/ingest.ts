import { Router } from 'express';
import { db } from '../db/index.js';
import { messages, messageActivity } from '../db/schema.js';

const router = Router();

const FREE_EMAIL_DOMAINS = [
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com',
  'icloud.com', 'mail.com', 'protonmail.com', 'yandex.com', 'live.com',
  'msn.com', 'comcast.net', 'verizon.net', 'att.net', 'sbcglobal.net'
];

const SUSPICIOUS_TLDS = [
  '.xyz', '.top', '.click', '.link', '.work', '.date', '.racing',
  '.science', '.party', '.cricket', '.win', '.download', '.bid',
  '.stream', '.trade', '.review', '.accountant', '.loan', '.win'
];

const SPAM_FREE_DOMAINS = [
  'tempmail.com', '10minutemail.com', 'guerrillamail.com', 'mailinator.com',
  'throwaway.email', 'fakeinbox.com', 'trashmail.com', 'getnada.com',
  'yopmail.com', 'dispostable.com', 'sharklasers.com', 'grr.la'
];

function detectColdEmail(email: string): { isCold: boolean; reason: string } {
  const emailLower = email.toLowerCase();
  const domain = emailLower.split('@')[1];
  
  if (!domain) return { isCold: false, reason: '' };
  
  if (SPAM_FREE_DOMAINS.some(d => domain.includes(d))) {
    return { isCold: true, reason: 'Disposable email provider' };
  }
  
  if (SUSPICIOUS_TLDS.some(tld => domain.endsWith(tld))) {
    return { isCold: true, reason: 'Suspicious TLD' };
  }
  
  if (FREE_EMAIL_DOMAINS.includes(domain)) {
    return { isCold: true, reason: 'Free email provider' };
  }
  
  const namePart = emailLower.split('@')[0];
  if (namePart.length > 20 && !namePart.includes('.') && !namePart.includes(' ')) {
    const randomPattern = /^[a-z]{10,}[0-9]+$/;
    if (randomPattern.test(namePart)) {
      return { isCold: true, reason: 'Random generated email pattern' };
    }
  }
  
  return { isCold: false, reason: '' };
}

async function triggerAutoreplyWebhook(message: any) {
  if (!process.env.N8N_AUTOREPLY_WEBHOOK_URL) return;
  
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    
    await fetch(process.env.N8N_AUTOREPLY_WEBHOOK_URL, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messageId: message.id,
        name: message.name,
        email: message.email,
        subject: message.subject,
        body: message.body
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeout);
  } catch (error) {
    console.error('Autoreply webhook error:', error);
  }
}

router.post('/contact', async (req, res) => {
  try {
    const { name, email, phone, company, subject, body, metadata, skipAutoreply } = req.body;
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    
    const coldEmail = detectColdEmail(email);
    const status = coldEmail.isCold ? 'spam' : 'new';
    
    const message = await db.insert(messages).values({
      source: 'contact',
      name,
      email,
      phone,
      company,
      subject,
      body,
      status,
      ipAddress,
      userAgent,
      metadata: metadata ? { ...metadata, coldEmailReason: coldEmail.reason } : { coldEmailReason: coldEmail.reason },
    }).returning();
    
    await db.insert(messageActivity).values({
      messageId: message[0].id,
      action: coldEmail.isCold ? 'blocked_cold_email' : 'created',
      ipAddress,
    });
    
    if (!coldEmail.isCold && skipAutoreply !== true) {
      triggerAutoreplyWebhook(message[0]);
    }
    
    res.json({ success: true, data: message[0], coldEmail: coldEmail.isCold });
  } catch (error: any) {
    res.json({ success: false, message: error.message });
  }
});

router.post('/quote', async (req, res) => {
  try {
    const { name, email, phone, company, subject, body, metadata, skipAutoreply } = req.body;
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    
    const coldEmail = detectColdEmail(email);
    const status = coldEmail.isCold ? 'spam' : 'new';
    
    const message = await db.insert(messages).values({
      source: 'quote',
      name,
      email,
      phone,
      company,
      subject,
      body,
      priority: coldEmail.isCold ? 'normal' : 'high',
      status,
      ipAddress,
      userAgent,
      metadata: metadata ? { ...metadata, coldEmailReason: coldEmail.reason } : { coldEmailReason: coldEmail.reason },
    }).returning();
    
    await db.insert(messageActivity).values({
      messageId: message[0].id,
      action: coldEmail.isCold ? 'blocked_cold_email' : 'created',
      ipAddress,
    });
    
    if (!coldEmail.isCold && skipAutoreply !== true) {
      triggerAutoreplyWebhook(message[0]);
    }
    
    res.json({ success: true, data: message[0], coldEmail: coldEmail.isCold });
  } catch (error: any) {
    res.json({ success: false, message: error.message });
  }
});

router.post('/subscription', async (req, res) => {
  try {
    const { email, skipAutoreply } = req.body;
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    
    const coldEmail = detectColdEmail(email);
    const status = coldEmail.isCold ? 'spam' : 'new';
    
    const message = await db.insert(messages).values({
      source: 'subscription',
      name: 'Newsletter Subscriber',
      email,
      body: 'Newsletter subscription request',
      status,
      ipAddress,
      userAgent,
      metadata: { coldEmailReason: coldEmail.reason },
    }).returning();
    
    await db.insert(messageActivity).values({
      messageId: message[0].id,
      action: coldEmail.isCold ? 'blocked_cold_email' : 'created',
      ipAddress,
    });
    
    if (!coldEmail.isCold && skipAutoreply !== true) {
      triggerAutoreplyWebhook(message[0]);
    }
    
    res.json({ success: true, data: message[0], coldEmail: coldEmail.isCold });
  } catch (error: any) {
    res.json({ success: false, message: error.message });
  }
});

export { router as ingestRouter };
