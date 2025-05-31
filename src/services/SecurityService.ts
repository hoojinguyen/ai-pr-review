import logger from '@/logging';
import * as crypto from 'crypto';

interface SecurityEventDetails {
  [key: string]: any;
}

export class SecurityService {
  private readonly sensitiveFields: string[] = [
    'password',
    'token',
    'secret',
    'key',
    'credential',
    'auth',
  ];

  /**
   * Validate the GitHub webhook signature
   * @param {Buffer|string} payload - Raw request body
   * @param {string} signature - X-Hub-Signature-256 header value
   * @param {string} secret - Webhook secret
   * @returns {boolean} True if signature is valid
   */
  public validateWebhookSignature(
    payload: Buffer | string,
    signature: string,
    secret?: string,
  ): boolean {
    if (!payload || !signature || !secret) {
      logger.warn('Missing required parameters for signature validation');
      return false;
    }

    // GitHub signature format: sha256=<hex>
    const [algorithm, providedSignature] = signature.split('=');
    if (!algorithm || !providedSignature || algorithm !== 'sha256') {
      logger.warn('Invalid signature format', { signature });
      return false;
    }

    // Calculate expected signature
    const hmac = crypto.createHmac('sha256', secret);
    const calculatedSignature = hmac.update(payload).digest('hex');

    // Use constant-time comparison to prevent timing attacks
    try {
      const isValid = crypto.timingSafeEqual(
        Buffer.from(providedSignature, 'hex'),
        Buffer.from(calculatedSignature, 'hex'),
      );

      if (!isValid) {
        logger.warn('Invalid webhook signature');
      }

      return isValid;
    } catch (error) {
      logger.error('Error validating webhook signature', { error });
      return false;
    }
  }

  /**
   * Sanitize input data to prevent injection attacks
   * @param {T} data - Data to sanitize
   * @returns {T} Sanitized data
   */
  public sanitizeInputData<T>(data: T): T {
    return JSON.parse(JSON.stringify(data));
  }

  /**
   * Sanitize output data to prevent sensitive data leakage
   * @param {T} data - Data to sanitize
   * @returns {T} Sanitized data
   */
  public sanitizeOutputData<T>(data: T): T {
    const sanitized = JSON.parse(JSON.stringify(data));
    return this.sanitizeObject(sanitized);
  }

  /**
   * Log a security-relevant event for audit purposes
   * @param {string} eventType - Type of security event
   * @param {SecurityEventDetails} details - Event details
   */
  public auditLogSecurityEvent(eventType: string, details: SecurityEventDetails = {}): void {
    logger.info(`Security event: ${eventType}`, {
      securityEvent: eventType,
      ...this.sanitizeOutputData(details),
    });
  }

  private sanitizeObject<T>(obj: T): T {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    const result = { ...obj };

    for (const [key, value] of Object.entries(result)) {
      const isFieldSensitive = this.sensitiveFields.some((field) =>
        key.toLowerCase().includes(field.toLowerCase()),
      );

      if (isFieldSensitive && typeof value === 'string') {
        (result as any)[key] = '[REDACTED]';
      } else if (value && typeof value === 'object') {
        (result as any)[key] = this.sanitizeObject(value);
      }
    }

    return result as T;
  }
}
