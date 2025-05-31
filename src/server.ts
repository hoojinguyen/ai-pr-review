import cors from 'cors';
import express, { Application } from 'express';
import helmet from 'helmet';
import config from './config';
import logger from './logging';
import { errorHandler } from './middleware/errorHandler';
import { apiRouter } from './routes';

class Server {
  private app: Application;
  private server: any;
  private readonly port: number;
  private readonly apiPrefix: string;
  private readonly serverConfig: any;

  constructor() {
    this.app = express();
    this.port = Number(process.env.PORT) || 3000;
    this.apiPrefix = process.env.API_PREFIX || '/api';
    this.serverConfig = config.getServerConfig();
    this.initializeMiddlewares();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  private initializeMiddlewares(): void {
    this.app.use(helmet());
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
  }

  private initializeRoutes(): void {
    this.app.use(this.apiPrefix, apiRouter);
    this.app.get('/health', (_req, res) => res.status(200).json({ status: 'ok' }));
  }

  private initializeErrorHandling(): void {
    this.app.use(errorHandler);
  }

  private setupGracefulShutdown(): void {
    const shutdownHandler = (signal: string) => {
      logger.info(`${signal} received, shutting down gracefully`);
      this.server.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdownHandler('SIGTERM'));
    process.on('SIGINT', () => shutdownHandler('SIGINT'));
  }

  public start(): void {
    this.server = this.app.listen(this.port, () => {
      logger.info(`Server running at http://${this.serverConfig.host}:${this.serverConfig.port}`);
    });
    this.setupGracefulShutdown();
  }

  public getApp(): Application {
    return this.app;
  }
}

const server = new Server();
server.start();

export default server.getApp();
