import serverless from 'serverless-http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import roar from './roar.js';

const app = express();

app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ status: 'ok', app: 'roar-east-africa' }));
app.use('/api/roar', roar.router);

app.use((_req, res) => res.status(404).json({ message: 'Not found.' }));

await roar.init();

export const handler = serverless(app);
