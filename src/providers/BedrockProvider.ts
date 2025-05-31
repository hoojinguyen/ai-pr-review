import { BedrockConfig } from '@/config';
import logger from '@/logging';
import { BedrockRuntimeClient, ConverseCommand, Message } from '@aws-sdk/client-bedrock-runtime';
import ModelProvider from './ModelProvider';

interface ModelOptions {
  modelId?: string;
  maxTokens?: number;
  temperature?: number;
}

export class BedrockProvider extends ModelProvider {
  private client: BedrockRuntimeClient;
  private modelId: string;
  private maxTokens: number;
  private temperature: number;
  protected config: BedrockConfig;

  /**
   * Initialize the Bedrock provider
   * @param {BedrockConfig} config - Bedrock-specific configuration
   */
  constructor(config: BedrockConfig) {
    super(config);
    this.config = config;

    // Initialize the Bedrock client
    this.client = new BedrockRuntimeClient({
      region: config.region,
    });

    this.modelId = config.modelId || 'amazon.titan-text-premier-v1:0';
    this.maxTokens = config.maxTokens || 1000;
    this.temperature = config.temperature || 0.3;

    logger.info('Initialized Bedrock provider', {
      modelId: this.modelId,
      region: config.region,
    });
  }

  /**
   * Get the provider name
   * @returns {string} Provider name
   */
  public getName(): string {
    return 'bedrock';
  }

  /**
   * Check if the provider is available and configured
   * @returns {Promise<boolean>} True if available
   */
  public async isAvailable(): Promise<boolean> {
    try {
      // Check if AWS region and model ID are configured
      if (!this.config.region || !this.modelId) {
        logger.warn('Bedrock provider not properly configured', {
          region: this.config.region,
          modelId: this.modelId,
        });
        return false;
      }

      // We could perform a lightweight call to Bedrock to verify credentials,
      // but for now we'll just check for configuration
      return true;
    } catch (error) {
      logger.error('Error checking Bedrock availability', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Invoke the Bedrock model with a prompt
   * @param {string} prompt - The prompt to send
   * @param {ModelOptions} options - Model-specific options
   * @returns {Promise<string>} Model response
   */
  public async invokeModel(prompt: string, options: ModelOptions = {}): Promise<string> {
    try {
      const modelId = options.modelId || this.modelId;
      const maxTokens = options.maxTokens || this.maxTokens;
      const temperature = options.temperature || this.temperature;

      logger.info('Invoking Bedrock model', {
        modelId,
        promptLength: prompt.length,
        maxTokens,
        temperature,
      });

      // Create the command for the model using the Converse API
      const command = new ConverseCommand({
        modelId,
        messages: this.formatMessages([{ role: 'user', content: prompt }]) as Message[],
        inferenceConfig: {
          maxTokens,
          temperature,
        },
      });

      // Send the command to Bedrock
      const response = await this.client.send(command);

      // Extract the text from the response
      const content = response?.output?.message?.content ?? [];
      const aiContent = content[0]?.text ?? '';
      logger.info('Received Bedrock response', {
        modelId,
        responseLength: aiContent.length,
      });

      return aiContent;
    } catch (error) {
      logger.error('Failed to invoke Bedrock model', {
        error: error instanceof Error ? error.message : String(error),
        modelId: options.modelId || this.modelId,
      });

      throw error;
    }
  }

  /**
   * Format messages for the Bedrock model
   * @param {Message[]} messages - Array of message objects
   * @returns {Array} Formatted messages for the model
   */
  public formatMessages(
    messages: {
      role: string;
      content: string;
    }[],
  ) {
    return messages.map((msg) => ({
      role: msg.role,
      content: [{ type: 'text', text: msg.content }],
    }));
  }
}

export default BedrockProvider;
