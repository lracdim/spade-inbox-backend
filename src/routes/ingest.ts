import { Router } from 'express';
import { db } from '../db/index.js';
import { messages, messageActivity } from '../db/schema.js';
import { io } from '../index.js';

const router = Router();

function detectColdEmail(email: string, body?: string): { isCold: boolean; reason: string } {
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
