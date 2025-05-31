import { OpenAIConfig } from '@/config';
import logger from '@/logging';
import { OpenAI } from 'openai';
import { ChatCompletionUserMessageParam } from 'openai/resources/index';
import ModelProvider from './ModelProvider';

interface ModelOptions {
  modelId?: string;
  maxTokens?: number;
  temperature?: number;
}

export class OpenAIProvider extends ModelProvider {
  private client: OpenAI;
  private modelId: string;
  private maxTokens: number;
  private temperature: number;
  protected config: OpenAIConfig;

  /**
   * Initialize the OpenAI provider
   * @param {OpenAIConfig} config - OpenAI-specific configuration
   */
  constructor(config: OpenAIConfig) {
    super(config);
    this.config = config;

    if (!config.apiKey) {
      logger.warn('OpenAI provider initialized without API key');
    }

    // Initialize the OpenAI client
    this.client = new OpenAI({
      apiKey: config.apiKey,
    });

    this.modelId = config.modelId ?? 'gpt-4';
    this.maxTokens = config.maxTokens ?? 1000;
    this.temperature = config.temperature ?? 0.3;

    logger.info('Initialized OpenAI provider', {
      modelId: this.modelId,
      hasApiKey: !!config.apiKey,
    });
  }

  /**
   * Get the provider name
   * @returns {string} Provider name
   */
  public getName(): string {
    return 'openai';
  }

  /**
   * Check if the provider is available and configured
   * @returns {Promise<boolean>} True if available
   */
  public async isAvailable(): Promise<boolean> {
    try {
      // Check if API key is configured
      if (!this.config.apiKey) {
        logger.warn('OpenAI provider not properly configured: missing API key');
        return false;
      }

      // We could perform a lightweight call to OpenAI to verify credentials,
      // but for now we'll just check for configuration
      return true;
    } catch (error) {
      logger.error('Error checking OpenAI availability', { error: (error as Error).message });
      return false;
    }
  }

  /**
   * Invoke the OpenAI model with a prompt
   * @param {string} prompt - The prompt to send
   * @param {ModelOptions} options - Model-specific options
   * @returns {Promise<string>} Model response
   */
  public async invokeModel(prompt: string, options: ModelOptions = {}): Promise<string> {
    try {
      const modelId = options.modelId ?? this.modelId;
      const maxTokens = options.maxTokens ?? this.maxTokens;
      const temperature = options.temperature ?? this.temperature;

      logger.info('Invoking OpenAI model', {
        modelId,
        promptLength: prompt.length,
        maxTokens,
        temperature,
      });

      // Create the chat completion request
      const response = await this.client.chat.completions.create({
        model: modelId,
        messages: this.formatMessages([{ role: 'user', content: prompt }]),
        max_tokens: maxTokens,
        temperature,
      });

      // Extract the text from the response
      const aiContent = response.choices[0].message.content;

      logger.info('Received OpenAI response', {
        modelId,
        responseLength: aiContent?.length ?? 0,
      });

      return aiContent ?? '';
    } catch (error) {
      logger.error('Failed to invoke OpenAI model', {
        error: (error as Error).message,
        modelId: options.modelId ?? this.modelId,
      });

      throw error;
    }
  }

  /**
   * Format messages for the OpenAI model
   * @param {Message[]} messages - Array of message objects
   * @returns {Message[]} Formatted messages for the model
   */
  public formatMessages(
    messages: ChatCompletionUserMessageParam[],
  ): ChatCompletionUserMessageParam[] {
    return messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));
  }
}

export default OpenAIProvider;
