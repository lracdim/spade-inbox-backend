import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { eq, desc, and, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { messages, messageReplies, messageActivity, messageViews } from '../db/schema.js';

const router = Router();

router.get('/stats', async (req, res) => {
  try {
    const notDeleted = sql`(${messages.isDeleted} = false OR ${messages.isDeleted} IS NULL)`;
    const notSpam = sql`(${messages.isSpam} = false OR ${messages.isSpam} IS NULL)`;
    
    const totalResult = await db.select({ count: sql`count(*)` }).from(messages).where(and(notDeleted, notSpam));
    const newResult = await db.select({ count: sql`count(*)` }).from(messages).where(and(notDeleted, notSpam, eq(messages.status, 'new')));
    const highResult = await db.select({ count: sql`count(*)` }).from(messages).where(and(notDeleted, notSpam, eq(messages.priority, 'high')));
    const trashResult = await db.select({ count: sql`count(*)` }).from(messages).where(eq(messages.isDeleted, true));
    const spamResult = await db.select({ count: sql`count(*)` }).from(messages).where(and(notDeleted, eq(messages.isSpam, true)));
    
    res.json({
      success: true,
      data: {
        total: Number(totalResult[0].count),
        new: Number(newResult[0].count),
        highPriority: Number(highResult[0].count),
        trash: Number(trashResult[0].count),
        spam: Number(spamResult[0].count),
      }
    });
  } catch (error: any) {
    res.json({ success: false, message: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.select().from(messages).where(eq(messages.id, parseInt(id)));
    const message = result[0];
    
    if (!message) {
      return res.json({ success: false, message: 'Message not found' });
    }
    
    const replies = await db.select().from(messageReplies).where(eq(messageReplies.messageId, parseInt(id)));
    const activity = await db.select().from(messageActivity)
      .where(eq(messageActivity.messageId, parseInt(id)))
      .orderBy(desc(messageActivity.createdAt))
      .limit(50);
    
    const formatDate = (date: any) => date instanceof Date ? date.toISOString() : date;
    
    res.json({
      success: true,
      data: { 
        ...message, 
        createdAt: formatDate(message.createdAt),
        updatedAt: formatDate(message.updatedAt),
        replies: replies.map(r => ({ ...r, createdAt: formatDate(r.createdAt), emailSentAt: formatDate(r.emailSentAt) })),
        activity: activity.map(a => ({ ...a, createdAt: formatDate(a.createdAt) }))
      }
    });
  } catch (error: any) {
    res.json({ success: false, message: error.message });
  }
});

router.post('/:id/view', async (req, res) => {
  try {
    const { id } = req.params;
    const token = req.headers.authorization?.replace('Bearer ', '');
    const decoded = jwt.verify(token!, process.env.JWT_SECRET!) as any;
    
    await db.update(messages)
      .set({ status: 'viewed', updatedAt: new Date() })
      .where(eq(messages.id, parseInt(id)));
    
    res.json({ success: true });
  } catch (error: any) {
    res.json({ success: false, message: error.message });
  }
});

router.put('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    await db.update(messages)
      .set({ status, updatedAt: new Date() })
      .where(eq(messages.id, parseInt(id)));
    
    res.json({ success: true });
  } catch (error: any) {
    res.json({ success: false, message: error.message });
  }
});

router.put('/:id/priority', async (req, res) => {
  try {
    const { id } = req.params;
    const { priority } = req.body;
    
    await db.update(messages)
      .set({ priority, updatedAt: new Date() })
      .where(eq(messages.id, parseInt(id)));
    
    res.json({ success: true });
  } catch (error: any) {
    res.json({ success: false, message: error.message });
  }
});

router.patch('/:id/spam', async (req, res) => {
  try {
    const { id } = req.params;
    const { spamReason } = req.body;
    
    await db.update(messages)
      .set({ 
        isSpam: true, 
        spamScore: 100,
        spamReason: spamReason || 'Manually marked as spam',
        updatedAt: new Date() 
      })
      .where(eq(messages.id, parseInt(id)));
    
    res.json({ success: true });
  } catch (error: any) {
    res.json({ success: false, message: error.message });
  }
});

router.patch('/:id/restore', async (req, res) => {
  try {
    const { id } = req.params;
    
    await db.update(messages)
      .set({ 
        isSpam: false, 
        spamScore: 0,
        spamReason: null,
        updatedAt: new Date() 
      })
      .where(eq(messages.id, parseInt(id)));
    
    res.json({ success: true });
  } catch (error: any) {
    res.json({ success: false, message: error.message });
  }
});

router.post('/:id/reply', async (req, res) => {
  try {
    const { id } = req.params;
    const { reply_body, sent_via } = req.body;
    const token = req.headers.authorization?.replace('Bearer ', '');
    const decoded = jwt.verify(token!, process.env.JWT_SECRET!) as any;
    
    const reply = await db.insert(messageReplies).values({
      messageId: parseInt(id),
      userId: decoded.id,
      replyBody: reply_body,
      sentVia: sent_via || 'email',
    }).returning();
    
    await db.update(messages)
      .set({ status: 'replied', updatedAt: new Date() })
      .where(eq(messages.id, parseInt(id)));

    const message = await db.select().from(messages).where(eq(messages.id, parseInt(id)));
    
    if (process.env.N8N_WEBHOOK_URL && message[0]) {
      try {
        console.log('Calling reply webhook:', process.env.N8N_WEBHOOK_URL);
        console.log('Reply payload:', { userEmail: message[0].email, userName: message[0].name, replyMessage: reply_body });
        
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        
        const response = await fetch(process.env.N8N_WEBHOOK_URL, {
          method: 'POST',
          redirect: 'follow',
          headers: {
            'Content-Type': 'application/json',
            'x-secret-key': process.env.N8N_SECRET || ''
          },
          body: JSON.stringify({
            messageId: parseInt(id),
            to: message[0].email,
            name: message[0].name,
            replyTo: `reply+messageid${id}@spadesecurityservices.com`,
            subject: `Re: ${message[0].subject}`,
            body: reply_body
          }),
          signal: controller.signal
        });
        
        clearTimeout(timeout);
        const responseText = await response.text();
        console.log('Reply webhook response:', response.status, responseText);
      } catch (n8nError: any) {
        console.error('n8n webhook error:', n8nError.message || n8nError);
      }
    } else {
      console.log('N8N_WEBHOOK_URL not configured or message not found');
    }
    
    res.json({ success: true, data: reply[0] });
  } catch (error: any) {
    res.json({ success: false, message: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const { type, priority, source, search, page = '1', limit = '50' } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;
    
    const conditions: any[] = [];
    
    if (type === 'trash') {
      conditions.push(eq(messages.isDeleted, true));
    } else if (type === 'spam') {
      conditions.push(eq(messages.isSpam, true));
    } else {
      conditions.push(
        sql`(${messages.isDeleted} = false OR ${messages.isDeleted} IS NULL)`,
        sql`(${messages.isSpam} = false OR ${messages.isSpam} IS NULL)`
      );
    }
    
    if (priority) conditions.push(eq(messages.priority, priority as string));
    if (source) conditions.push(eq(messages.source, source as string));
    if (search) {
      const searchStr = String(search);
      conditions.push(sql`(name ILIKE ${'%' + searchStr + '%'}) OR (email ILIKE ${'%' + searchStr + '%'}) OR (subject ILIKE ${'%' + searchStr + '%'}) OR (body ILIKE ${'%' + searchStr + '%'})`);
    }
    
    if (conditions.length === 0) {
      throw new Error('Query conditions missing — unsafe query blocked');
    }
    
    const where = and(...conditions);
    
    const items = await db.select().from(messages)
      .where(where)
      .orderBy(desc(messages.createdAt))
      .limit(limitNum)
      .offset(offset);
    
    const countResult = await db.select({ count: sql`count(*)` }).from(messages).where(where);
    const total = Number(countResult[0].count);
    
    const formatDate = (date: any) => date instanceof Date ? date.toISOString() : date;
    
    res.json({
      success: true,
      data: {
        messages: items.map(m => ({ ...m, createdAt: formatDate(m.createdAt), updatedAt: formatDate(m.updatedAt) })),
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        }
      }
    });
  } catch (error: any) {
    res.json({ success: false, message: error.message });
  }
});

router.post('/bulk/trash', async (req, res) => {
  try {
    const { ids } = req.body;
    
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.json({ success: false, message: 'No IDs provided' });
    }
    
    await db.update(messages)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(sql`${messages.id} IN (${ids})`);
    
    res.json({ success: true });
  } catch (error: any) {
    res.json({ success: false, message: error.message });
  }
});

router.post('/bulk/mark-viewed', async (req, res) => {
  try {
    const { ids } = req.body;
    
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.json({ success: false, message: 'No IDs provided' });
    }
    
    await db.update(messages)
      .set({ status: 'viewed', updatedAt: new Date() })
      .where(sql`${messages.id} IN (${ids})`);
    
    res.json({ success: true });
  } catch (error: any) {
    res.json({ success: false, message: error.message });
  }
});

router.post('/bulk/archive', async (req, res) => {
  try {
    const { ids } = req.body;
    
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.json({ success: false, message: 'No IDs provided' });
    }
    
    await db.update(messages)
      .set({ status: 'archived', updatedAt: new Date() })
      .where(sql`${messages.id} IN (${ids})`);
    
    res.json({ success: true });
  } catch (error: any) {
    res.json({ success: false, message: error.message });
  }
});

router.post('/bulk/restore', async (req, res) => {
  try {
    const { ids } = req.body;
    
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.json({ success: false, message: 'No IDs provided' });
    }
    
    await db.update(messages)
      .set({ isDeleted: false, updatedAt: new Date() })
      .where(sql`${messages.id} IN (${ids})`);
    
    res.json({ success: true });
  } catch (error: any) {
    res.json({ success: false, message: error.message });
  }
});

router.post('/bulk/delete', async (req, res) => {
  try {
    const { ids } = req.body;
    
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.json({ success: false, message: 'No IDs provided' });
    }
    
    for (const id of ids) {
      await db.delete(messageReplies).where(eq(messageReplies.messageId, id));
      await db.delete(messageViews).where(eq(messageViews.messageId, id));
      await db.delete(messageActivity).where(eq(messageActivity.messageId, id));
      await db.delete(messages).where(eq(messages.id, id));
    }
    
    res.json({ success: true });
  } catch (error: any) {
    res.json({ success: false, message: error.message });
  }
});

router.post('/empty-trash', async (req, res) => {
  try {
    const trashMessages = await db.select({ id: messages.id }).from(messages).where(eq(messages.isDeleted, true));
    
    for (const msg of trashMessages) {
      await db.delete(messageActivity).where(eq(messageActivity.messageId, msg.id));
      await db.delete(messages).where(eq(messages.id, msg.id));
    }
    
    res.json({ success: true });
  } catch (error: any) {
    res.json({ success: false, message: error.message });
  }
});

export { router as messagesRouter };
