import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';

const router = Router();

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const result = await db.select().from(users).where(eq(users.email, email));
    const user = result[0];
    
    if (!user || !user.isActive) {
      return res.json({ success: false, message: 'Invalid credentials' });
    }
    
    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      return res.json({ success: false, message: 'Invalid credentials' });
    }
    
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: '24h' }
    );
    
    await db.update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, user.id));
    
    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        }
      }
    });
  } catch (error: any) {
    res.json({ success: false, message: error.message });
  }
});

router.post('/logout', async (req, res) => {
  res.json({ success: true });
});

router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.json({ success: false, message: 'Unauthorized' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    const result = await db.select().from(users).where(eq(users.id, decoded.id));
    const user = result[0];
    
    if (!user || !user.isActive) {
      return res.json({ success: false, message: 'User not found' });
    }
    
    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          notificationPreferences: user.notificationPreferences,
        }
      }
    });
  } catch (error: any) {
    res.json({ success: false, message: 'Invalid token' });
  }
});

export { router as authRouter };
