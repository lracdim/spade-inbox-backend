import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { eq, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const allUsers = await db.select().from(users).orderBy(desc(users.createdAt));
    res.json({ success: true, data: allUsers });
  } catch (error: any) {
    res.json({ success: false, message: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.select().from(users).where(eq(users.id, parseInt(id)));
    const user = result[0];
    
    if (!user) {
      return res.json({ success: false, message: 'User not found' });
    }
    
    res.json({ success: true, data: user });
  } catch (error: any) {
    res.json({ success: false, message: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const passwordHash = await bcrypt.hash(password, 10);
    
    const newUser = await db.insert(users).values({
      name,
      email,
      passwordHash,
      role: role || 'staff',
    }).returning();
    
    res.json({ success: true, data: newUser[0] });
  } catch (error: any) {
    res.json({ success: false, message: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, role, isActive, notificationPreferences } = req.body;
    
    await db.update(users)
      .set({
        name,
        email,
        role,
        isActive,
        notificationPreferences,
        updatedAt: new Date(),
      })
      .where(eq(users.id, parseInt(id)));
    
    res.json({ success: true });
  } catch (error: any) {
    res.json({ success: false, message: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.delete(users).where(eq(users.id, parseInt(id)));
    res.json({ success: true });
  } catch (error: any) {
    res.json({ success: false, message: error.message });
  }
});

export { router as usersRouter };
