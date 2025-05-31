abstract class ModelProvider {
  protected config: Record<string, any>;

  /**
   * Initialize the model provider with configuration
   * @param {Object} config - Provider-specific configuration
   */
  constructor(config: Record<string, any>) {
    if (new.target === ModelProvider) {
      throw new Error("Abstract class 'ModelProvider' cannot be instantiated");
    }
    this.config = config;
  }

  /**
   * Get the provider name
   * @returns {string} Provider name
   */
  abstract getName(): string;

  /**
   * Check if the provider is available and configured
   * @returns {Promise<boolean>} True if available
   */
  abstract isAvailable(): Promise<boolean>;

  /**
   * Invoke the model with a prompt
   * @param {string} prompt - The prompt to send
   * @param {Object} options - Model-specific options
   * @returns {Promise<string>} Model response
   */
  abstract invokeModel(prompt: string, options?: Record<string, any>): Promise<string>;

  /**
   * Format messages for the model
   * @param {Array} messages - Array of message objects
   * @returns {Object} Formatted messages for the model
   */
  abstract formatMessages(messages: Array<any>): Record<string, any>;
}

export default ModelProvider;
