import express from 'express';
import cors from 'cors';
import { initDatabase } from './db/database.js';
import eventsRouter from './routes/events.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api/events', eventsRouter);

await initDatabase();

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
