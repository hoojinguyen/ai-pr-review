import dotenv from 'dotenv';

dotenv.config();

export interface ServerConfig {
  port: number;
  host: string;
}

export interface GitHubConfig {
  token: string | undefined;
  baseUrl: string;
  webhookSecret?: string | undefined;
  appId?: string | undefined;
  privateKey?: string | undefined;
  installationId?: string | undefined;
}

export interface AWSConfig {
  region: string;
  modelId: string;
  maxTokens: number;
  temperature: number;
}

export interface LoggingConfig {
  level: string;
  file: string | undefined;
}
export interface AnthropicConfig {
  apiKey?: string;
  modelId?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface BedrockConfig {
  region: string;
  modelId?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface OpenAIConfig {
  apiKey?: string;
  modelId?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface AIProviderConfig {
  defaultProvider: string;
  enableFallback: boolean;
  fallbackProvider?: string;
  providers: {
    bedrock: BedrockConfig;
    openai: OpenAIConfig;
    anthropic: AnthropicConfig;
  };
}

interface Config {
  server: ServerConfig;
  github: GitHubConfig;
  aws: AWSConfig;
  logging: LoggingConfig;
  ai: AIProviderConfig;
}

class ConfigManager {
  private readonly config: Config;

  constructor() {
    this.config = {
      server: {
        port: Number(process.env.PORT) || 3000,
        host: process.env.HOST || '0.0.0.0',
      },
      github: {
        webhookSecret: process.env.GITHUB_WEBHOOK_SECRET,
        token: process.env.GITHUB_TOKEN,
        baseUrl: process.env.GITHUB_API_URL || 'https://api.github.com',
        appId: process.env.GITHUB_APP_ID,
        privateKey: process.env.GITHUB_PRIVATE_KEY,
        installationId: process.env.GITHUB_INSTALLATION_ID,
      },
      aws: {
        region: process.env.AWS_REGION || 'us-east-1',
        modelId: process.env.AWS_BEDROCK_MODEL_ID || 'amazon.titan-text-premier-v1:0',
        maxTokens: parseInt(process.env.AWS_BEDROCK_MAX_TOKENS || '1000', 10),
        temperature: parseFloat(process.env.AWS_BEDROCK_TEMPERATURE || '0.3'),
      },
      ai: {
        defaultProvider: process.env.AI_DEFAULT_PROVIDER || 'bedrock',
        enableFallback: process.env.AI_ENABLE_FALLBACK === 'true',
        fallbackProvider: process.env.AI_FALLBACK_PROVIDER,
        providers: {
          bedrock: {
            region: process.env.AWS_REGION || 'us-east-1',
            modelId: process.env.AWS_BEDROCK_MODEL_ID || 'amazon.titan-text-premier-v1:0',
            maxTokens: parseInt(process.env.AWS_BEDROCK_MAX_TOKENS || '1000', 10),
            temperature: parseFloat(process.env.AWS_BEDROCK_TEMPERATURE || '0.3'),
          },
          openai: {
            apiKey: process.env.OPENAI_API_KEY,
            modelId: process.env.OPENAI_MODEL_ID || 'gpt-4',
            maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '1000', 10),
            temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.3'),
          },
          anthropic: {
            apiKey: process.env.ANTHROPIC_API_KEY,
            modelId: process.env.ANTHROPIC_MODEL_ID || 'claude-3-opus-20240229',
            maxTokens: parseInt(process.env.ANTHROPIC_MAX_TOKENS || '1000', 10),
            temperature: parseFloat(process.env.ANTHROPIC_TEMPERATURE || '0.3'),
          },
        },
      },
      logging: {
        level: process.env.LOG_LEVEL || 'info',
        file: process.env.LOG_FILE,
      },
    };
  }

  public getConfig(): Config {
    return this.config;
  }

  public getGitHubConfig(): GitHubConfig {
    return this.config.github;
  }

  public getAIConfig() {
    return this.config.ai;
  }

  public getAWSConfig(): AWSConfig {
    return this.config.aws;
  }

  public getServerConfig(): ServerConfig {
    return this.config.server;
  }

  public getLoggingConfig(): LoggingConfig {
    return this.config.logging;
  }

  public validateConfig(): boolean {
    // Check for required GitHub configuration
    if (!this.config.github.webhookSecret) {
      throw new Error('Missing required configuration: GITHUB_WEBHOOK_SECRET');
    }

    // Check for GitHub authentication (either token or app credentials)
    if (!this.config.github.token && !(this.config.github.appId && this.config.github.privateKey)) {
      throw new Error(
        'Missing required GitHub authentication: Either GITHUB_TOKEN or GITHUB_APP_ID and GITHUB_PRIVATE_KEY must be provided',
      );
    }

    // Check that at least one AI provider is configured
    const aiConfig = this.getAIConfig();
    let hasValidProvider = false;

    // Check Bedrock configuration
    if (aiConfig.providers.bedrock && aiConfig.providers.bedrock.region) {
      hasValidProvider = true;
    }

    // Check OpenAI configuration
    if (aiConfig.providers.openai && aiConfig.providers.openai.apiKey) {
      hasValidProvider = true;
    }

    // Check Anthropic configuration
    if (aiConfig.providers.anthropic && aiConfig.providers.anthropic.apiKey) {
      hasValidProvider = true;
    }

    if (!hasValidProvider) {
      throw new Error(
        'No valid AI provider configured. Please configure at least one of: Bedrock, OpenAI, or Anthropic',
      );
    }

    return true;
  }
}

export default new ConfigManager();
