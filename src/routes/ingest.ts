import { Router } from 'express';
import { db } from '../db/index.js';
import { messages, messageActivity } from '../db/schema.js';

const router = Router();

router.post('/contact', async (req, res) => {
  try {
    const { name, email, phone, company, subject, body, metadata } = req.body;
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    
    const message = await db.insert(messages).values({
      source: 'contact',
      name,
      email,
      phone,
      company,
      subject,
      body,
      ipAddress,
      userAgent,
      metadata: metadata || null,
    }).returning();
    
    await db.insert(messageActivity).values({
      messageId: message[0].id,
      action: 'created',
      ipAddress,
    });
    
    res.json({ success: true, data: message[0] });
  } catch (error: any) {
    res.json({ success: false, message: error.message });
  }
});

router.post('/quote', async (req, res) => {
  try {
    const { name, email, phone, company, subject, body, metadata } = req.body;
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    
    const message = await db.insert(messages).values({
      source: 'quote',
      name,
      email,
      phone,
      company,
      subject,
      body,
      priority: 'high',
      ipAddress,
      userAgent,
      metadata: metadata || null,
    }).returning();
    
    await db.insert(messageActivity).values({
      messageId: message[0].id,
      action: 'created',
      ipAddress,
    });
    
    res.json({ success: true, data: message[0] });
  } catch (error: any) {
    res.json({ success: false, message: error.message });
  }
});

router.post('/subscription', async (req, res) => {
  try {
    const { email } = req.body;
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    
    const message = await db.insert(messages).values({
      source: 'subscription',
      name: 'Newsletter Subscriber',
      email,
      body: 'Newsletter subscription request',
      ipAddress,
      userAgent,
    }).returning();
    
    await db.insert(messageActivity).values({
      messageId: message[0].id,
      action: 'created',
      ipAddress,
    });
    
    res.json({ success: true, data: message[0] });
  } catch (error: any) {
    res.json({ success: false, message: error.message });
  }
});

export { router as ingestRouter };
