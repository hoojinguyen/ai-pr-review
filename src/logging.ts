import * as winston from 'winston';
import config from './config';

interface Metrics {
  webhooksReceived: number;
  webhooksProcessed: number;
  aiCallsMade: number;
  aiCallsSucceeded: number;
  aiCallsFailed: number;
  commentsPosted: number;
  errors: number;
  lastError: string | null;
  lastErrorTime: string | null;
  [key: string]: number | string | null;
}

interface HealthData {
  status: string;
  uptime: number;
  timestamp: string;
  metrics: Metrics;
}

export class LoggingService {
  private logger: winston.Logger;
  private metrics: Metrics;

  constructor() {
    const logConfig = config.getLoggingConfig();

    const transports: winston.transport[] = [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.timestamp(),
          winston.format.printf(({ timestamp, level, message, ...meta }) => {
            return `${timestamp} ${level}: ${message} ${Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''}`;
          }),
        ),
      }),
    ];

    if (logConfig.file) {
      transports.push(
        new winston.transports.File({
          filename: logConfig.file,
          format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
        }),
      );
    }

    this.logger = winston.createLogger({
      level: logConfig.level,
      transports,
      // Don't exit on uncaught exceptions
      exitOnError: false,
    });

    // Track metrics in memory for the health endpoint
    this.metrics = {
      webhooksReceived: 0,
      webhooksProcessed: 0,
      aiCallsMade: 0,
      aiCallsSucceeded: 0,
      aiCallsFailed: 0,
      commentsPosted: 0,
      errors: 0,
      lastError: null,
      lastErrorTime: null,
    };
  }

  public log(level: string, message: string, metadata: Record<string, any> = {}): void {
    // Sanitize any potentially sensitive data
    const sanitizedMetadata = this.sanitizeMetadata(metadata);

    this.logger.log(level, message, sanitizedMetadata);
  }

  public info(message: string, metadata: Record<string, any> = {}): void {
    this.log('info', message, metadata);
  }

  public warn(message: string, metadata: Record<string, any> = {}): void {
    this.log('warn', message, metadata);
  }

  public error(error: Error | string, context: Record<string, any> = {}): void {
    const errorObj = error instanceof Error ? error : new Error(error);
    const message = errorObj.message;

    // Update error metrics
    this.metrics.errors += 1;
    this.metrics.lastError = message;
    this.metrics.lastErrorTime = new Date().toISOString();

    this.log('error', message, {
      stack: errorObj.stack,
      ...context,
    });
  }

  public recordMetric(name: string, value: number = 1, tags: Record<string, any> = {}): void {
    // Update in-memory metrics
    if (this.metrics[name] !== undefined) {
      if (typeof this.metrics[name] === 'number') {
        this.metrics[name] = (this.metrics[name] as number) + value;
      } else {
        this.metrics[name] = value;
      }
    }

    // Log the metric
    this.info(`Metric: ${name}`, { metric: name, value, tags });
  }

  public getHealthData(): HealthData {
    return {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      metrics: this.metrics,
    };
  }

  private sanitizeMetadata(metadata: Record<string, any>): Record<string, any> {
    const sanitized = { ...metadata };

    // List of fields that might contain sensitive data
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'credential', 'auth'];

    // Recursively sanitize objects
    const sanitizeObject = (obj: Record<string, any>): Record<string, any> => {
      if (!obj || typeof obj !== 'object') return obj;

      const result = { ...obj };

      for (const key in result) {
        // Check if this is a sensitive field
        const isFieldSensitive = sensitiveFields.some((field) =>
          key.toLowerCase().includes(field.toLowerCase()),
        );

        if (isFieldSensitive && typeof result[key] === 'string') {
          // Redact sensitive values
          result[key] = '[REDACTED]';
        } else if (typeof result[key] === 'object' && result[key] !== null) {
          // Recursively sanitize nested objects
          result[key] = sanitizeObject(result[key]);
        }
      }

      return result;
    };

    return sanitizeObject(sanitized);
  }
}

export default new LoggingService();
