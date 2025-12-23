import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import assessmentRoutes from './routes/assessments';
import accessCodeRoutes from './routes/accessCodes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/assessments', assessmentRoutes);
app.use('/api/access-codes', accessCodeRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`📊 API Endpoints:`);
  console.log(`   - POST /api/auth/register`);
  console.log(`   - POST /api/auth/login`);
  console.log(`   - POST /api/auth/admin/login`);
  console.log(`   - POST /api/assessments`);
  console.log(`   - POST /api/access-codes/validate`);
  console.log(`   - POST /api/access-codes/generate (Admin)`);
  console.log(`   - GET  /api/assessments/stats (Admin)`);
});
