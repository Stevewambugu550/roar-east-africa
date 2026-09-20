import serverless from 'serverless-http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import roar from './roar.js';

let serverlessHandler = null;
let initializing = null;

async function buildHandler() {
    const app = express();
    app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
    app.use(cors({ origin: true, credentials: true }));
    app.use(express.json());

    app.get('/api/health', (_req, res) => res.json({ status: 'ok', app: 'roar-east-africa' }));
    app.use('/api/roar', roar.router);
    app.use((_req, res) => res.status(404).json({ message: 'Not found.' }));

    await roar.init();
    serverlessHandler = serverless(app);
}

async function ensureHandler() {
    if (serverlessHandler) return serverlessHandler;
    if (initializing) return initializing;
    initializing = buildHandler();
    try {
        await initializing;
    } finally {
        initializing = null;
    }
    return serverlessHandler;
}

export async function handler(event, context) {
    const h = await ensureHandler();
    return h(event, context);
}
