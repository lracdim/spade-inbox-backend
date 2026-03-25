import { Router } from 'express';
import { db } from '../db/index.js';
import { messages, messageActivity } from '../db/schema.js';
import { io } from '../index.js';

const router = Router();

const SPAM_KEYWORDS = [
  'seo services', 'digital marketing services', 'we can help you rank',
  'increase your traffic', 'boost your website', 'lead generation',
  'we specialize in', 'our agency', 'our team can help',
  'i came across your website', 'i visited your website',
  'i found your website', 'i noticed your website',
  'guest post', 'link building', 'backlink', 'collaboration opportunity',
  'content partnership', 'sponsored post', 'paid post',
  'i hope this email finds you', 'i hope this message finds you',
  'i am reaching out', 'i wanted to reach out',
  'i would like to offer', 'we would like to offer',
  'please let me know if you are interested',
  'kindly revert', 'kindly reply',
  'investment opportunity', 'crypto', 'bitcoin', 'passive income',
  'financial freedom', 'work from home opportunity',
  'click here', 'buy now', 'limited time offer', 'act now',
  'congratulations you have been selected',
  'you have won', 'claim your prize',
];

const SPAM_PATTERNS = [
  /\b(https?:\/\/\S+)\b.*\b(https?:\/\/\S+)\b/i,
  /dear\s+(sir|madam|owner|webmaster|admin)/i,
  /\$\d+/,
  /\d+%\s*(off|discount|roi|return)/i,
  /\b(whatsapp|telegram)\s*[:+]?\s*\d{7,}/i,
];

function detectColdEmail(email: string, body?: string): { isCold: boolean; reason: string } {
  if (!body) return { isCold: false, reason: '' };

  const lowerBody = body.toLowerCase();

  for (const keyword of SPAM_KEYWORDS) {
    if (lowerBody.includes(keyword)) {
      return { isCold: true, reason: `Spam keyword matched: "${keyword}"` };
    }
  }

  for (const pattern of SPAM_PATTERNS) {
    if (pattern.test(body)) {
      return { isCold: true, reason: `Spam pattern matched: ${pattern}` };
    }
  }

  if (body.trim().length < 10) {
    return { isCold: true, reason: 'Message too short' };
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
    const fields = req.body.fields || req.body;
    
    console.log('Elementor form data:', req.body);
    
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    
    const finalName    = fields.client_name?.value   || fields.client_name   || 'Unknown';
    const finalEmail   = fields.client_email?.value  || fields.client_email  || '';
    const finalPhone   = fields.field_phone?.value   || fields.field_phone   || null;
    const finalCompany = fields.field_company?.value || fields.field_company || null;
    const finalBody    = fields.field_message?.value || fields.field_message || '';
    const finalSubject = `Contact form submission from ${finalName}`;
    
    const { metadata, skipAutoreply } = req.body;
    
    const coldEmail = detectColdEmail(finalEmail, finalBody);
    const status = coldEmail.isCold ? 'spam' : 'new';
    
    const newMessage = await db.insert(messages).values({
      source: 'contact',
      name: finalName,
      email: finalEmail,
      phone: finalPhone,
      company: finalCompany,
      subject: finalSubject,
      body: finalBody,
      status,
      ipAddress,
      userAgent,
      metadata: metadata ? { ...metadata, coldEmailReason: coldEmail.reason } : { coldEmailReason: coldEmail.reason },
    }).returning();
    
    await db.insert(messageActivity).values({
      messageId: newMessage[0].id,
      action: coldEmail.isCold ? 'blocked_cold_email' : 'created',
      ipAddress,
    });
    
    if (!coldEmail.isCold && skipAutoreply !== true) {
      triggerAutoreplyWebhook(newMessage[0]);
    }
    
    io.emit('new-message', newMessage[0]);
    
    res.json({ success: true, data: newMessage[0], coldEmail: coldEmail.isCold });
  } catch (error: any) {
    res.json({ success: false, message: error.message });
  }
});

router.post('/quote', async (req, res) => {
  try {
    const fields = req.body.fields || req.body;
    const { metadata, skipAutoreply } = req.body;
    
    const finalName    = fields.name?.value    || fields.name    || '';
    const finalEmail   = fields.email?.value   || fields.email   || '';
    const finalPhone   = fields.phone?.value   || fields.phone   || null;
    const finalCompany = fields.company?.value || fields.company || null;
    const finalSubject = fields.subject?.value || fields.subject || '';
    const finalBody    = fields.body?.value    || fields.body    || '';
    
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    
    const coldEmail = detectColdEmail(finalEmail, finalBody);
    const status = coldEmail.isCold ? 'spam' : 'new';
    
    const message = await db.insert(messages).values({
      source: 'quote',
      name: finalName,
      email: finalEmail,
      phone: finalPhone,
      company: finalCompany,
      subject: finalSubject,
      body: finalBody,
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
    
    io.emit('new-message', message[0]);
    
    res.json({ success: true, data: message[0], coldEmail: coldEmail.isCold });
  } catch (error: any) {
    res.json({ success: false, message: error.message });
  }
});

router.post('/subscription', async (req, res) => {
  try {
    const fields = req.body.fields || req.body;
    const { skipAutoreply } = req.body;
    
    const finalEmail = fields.email?.value || fields.email || '';
    
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    
    const coldEmail = detectColdEmail(finalEmail);
    const status = coldEmail.isCold ? 'spam' : 'new';
    
    const message = await db.insert(messages).values({
      source: 'subscription',
      name: 'Newsletter Subscriber',
      email: finalEmail,
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
    
    io.emit('new-message', message[0]);
    
    res.json({ success: true, data: message[0], coldEmail: coldEmail.isCold });
  } catch (error: any) {
    res.json({ success: false, message: error.message });
  }
});

export { router as ingestRouter };
