import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';

const router = Router();

router.post('/', async (req, res) => {
  try {
    const { key, name, email, password } = req.body;
    
    if (key !== process.env.SETUP_KEY) {
      return res.json({ success: false, message: 'Invalid setup key' });
    }
    
    const existing = await db.select().from(users).where(eq(users.email, email));
    if (existing.length) {
      return res.json({ success: false, message: 'User already exists' });
    }
    
    const passwordHash = await bcrypt.hash(password, 10);
    
    const newUser = await db.insert(users).values({
      name,
      email,
      passwordHash,
      role: 'admin',
      isActive: true,
    }).returning();
    
    res.json({ success: true, data: newUser[0] });
  } catch (error: any) {
    res.json({ success: false, message: error.message });
  }
});

export { router as setupRouter };
