import { AnthropicConfig } from '@/config';
import logger from '@/logging';
import { Anthropic } from '@anthropic-ai/sdk';
import { MessageParam, TextBlock } from '@anthropic-ai/sdk/resources/messages';
import ModelProvider from './ModelProvider';

interface ModelOptions {
  modelId?: string;
  maxTokens?: number;
  temperature?: number;
}

export class AnthropicProvider extends ModelProvider {
  protected config: AnthropicConfig;
  private client: Anthropic;
  private modelId: string;
  private maxTokens: number;
  private temperature: number;

  /**
   * Initialize the Anthropic provider
   * @param {AnthropicConfig} config - Anthropic-specific configuration
   */
  constructor(config: AnthropicConfig) {
    super(config);
    this.config = config;

    if (!config.apiKey) {
      logger.warn('Anthropic provider initialized without API key');
    }

    // Initialize the Anthropic client
    this.client = new Anthropic({
      apiKey: config.apiKey,
    });

    this.modelId = config.modelId || 'claude-3-opus-20240229';
    this.maxTokens = config.maxTokens || 1000;
    this.temperature = config.temperature || 0.3;

    logger.info('Initialized Anthropic provider', {
      modelId: this.modelId,
      hasApiKey: !!config.apiKey,
    });
  }

  /**
   * Get the provider name
   * @returns {string} Provider name
   */
  public getName(): string {
    return 'anthropic';
  }

  /**
   * Check if the provider is available and configured
   * @returns {Promise<boolean>} True if available
   */
  public async isAvailable(): Promise<boolean> {
    try {
      // Check if API key is configured
      if (!this.config.apiKey) {
        logger.warn('Anthropic provider not properly configured: missing API key');
        return false;
      }

      // We could perform a lightweight call to Anthropic to verify credentials,
      // but for now we'll just check for configuration
      return true;
    } catch (error) {
      const erroMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error checking Anthropic availability', { error: erroMessage });
      return false;
    }
  }

  /**
   * Invoke the Anthropic model with a prompt
   * @param {string} prompt - The prompt to send
   * @param {ModelOptions} options - Model-specific options
   * @returns {Promise<string>} Model response
   */
  public async invokeModel(prompt: string, options: ModelOptions = {}): Promise<string> {
    try {
      const modelId = options.modelId || this.modelId;
      const maxTokens = options.maxTokens || this.maxTokens;
      const temperature = options.temperature || this.temperature;

      logger.info('Invoking Anthropic model', {
        modelId,
        promptLength: prompt.length,
        maxTokens,
        temperature,
      });

      // Create the message request
      const response = await this.client.messages.create({
        model: modelId,
        messages: this.formatMessages([{ role: 'user', content: prompt }]),
        max_tokens: maxTokens,
        temperature: temperature,
      });

      // Extract the text from the response
      const content = response?.content as Array<TextBlock>;
      const aiContent = content[0]?.text;

      logger.info('Received Anthropic response', {
        modelId,
        responseLength: aiContent.length,
      });

      return aiContent;
    } catch (error) {
      const erroMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error('Failed to invoke Anthropic model', {
        error: erroMessage,
        modelId: options.modelId || this.modelId,
      });

      throw error;
    }
  }

  /**
   * Format messages for the Anthropic model
   * @param {Message[]} messages - Array of message objects
   * @returns {Message[]} Formatted messages for the model
   */
  public formatMessages(messages: Array<MessageParam>): Array<MessageParam> {
    return messages.map((msg) => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content,
    }));
  }
}
