import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import config from './config';
import logger from './logging';
import { errorHandler } from './middleware/errorHandler';
import { apiRouter } from './routes';

const app = express();

const port = process.env.PORT || 3000;

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const apiPrefix = process.env.API_PREFIX || '/api';

app.use(apiPrefix, apiRouter);
app.use(errorHandler);

app.get('/health', (_req, res) => res.status(200).json({ status: 'ok' }));

const serverConfig = config.getServerConfig();

const server = app.listen(port, () => {
  logger.info(`Server running at http://${serverConfig.host}:${serverConfig.port}`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

export default app;
