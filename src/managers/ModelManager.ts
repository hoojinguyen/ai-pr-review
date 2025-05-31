import logger from '@/logging';
import ModelProvider from '@/providers/ModelProvider';

interface AIConfig {
  defaultProvider?: string;
}

interface ModelOptions {
  provider?: string;
  modelId?: string;
  enableFallback?: boolean;
  fallbackProvider?: string;
}

interface ModelResponse {
  content: any;
  provider: string;
  modelId?: string;
  usedFallback?: boolean;
}

export class ModelManager {
  private config: AIConfig;
  private providers: Map<string, ModelProvider>;
  private defaultProvider: ModelProvider | null;

  constructor(config: AIConfig) {
    this.config = config;
    this.providers = new Map();
    this.defaultProvider = null;

    logger.info('Initialized Model Manager', {
      defaultProvider: config.defaultProvider || 'bedrock',
    });
  }

  public registerProvider(provider: ModelProvider): void {
    this.providers.set(provider.getName(), provider);

    if (
      (this.config.defaultProvider && this.config.defaultProvider === provider.getName()) ||
      !this.defaultProvider
    ) {
      this.defaultProvider = provider;
      logger.info('Set default provider', { provider: provider.getName() });
    }
  }

  public getProvider(name: string): ModelProvider | null {
    return this.providers.get(name) || this.defaultProvider;
  }

  public getDefaultProvider(): ModelProvider | null {
    return this.defaultProvider;
  }

  public getAvailableProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  public async invokeModel(prompt: string, options: ModelOptions = {}): Promise<ModelResponse> {
    const providerName = options.provider || this.defaultProvider?.getName() || 'bedrock';
    const primaryProvider = this.getProvider(providerName);

    if (!primaryProvider) {
      throw new Error('No AI model provider available');
    }

    try {
      logger.info('Attempting to invoke primary provider', {
        provider: primaryProvider.getName(),
        modelId: options.modelId,
      });

      const response = await primaryProvider.invokeModel(prompt, options);
      return {
        content: response,
        provider: primaryProvider.getName(),
        modelId: options.modelId,
      };
    } catch (error) {
      logger.error('Primary provider failed', {
        provider: primaryProvider.getName(),
        error: error instanceof Error ? error.message : String(error),
      });

      if (options.enableFallback && options.fallbackProvider) {
        const fallbackProvider = this.getProvider(options.fallbackProvider);

        if (fallbackProvider && fallbackProvider.getName() !== primaryProvider.getName()) {
          logger.info('Attempting fallback provider', {
            provider: fallbackProvider.getName(),
          });

          try {
            const response = await fallbackProvider.invokeModel(prompt, options);
            return {
              content: response,
              provider: fallbackProvider.getName(),
              modelId: options.modelId,
              usedFallback: true,
            };
          } catch (fallbackError) {
            logger.error('Fallback provider also failed', {
              provider: fallbackProvider.getName(),
              error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
            });
            throw fallbackError;
          }
        }
      }

      throw error;
    }
  }
}
