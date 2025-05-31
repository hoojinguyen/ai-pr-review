import config, { AIProviderConfig } from '@/config';
import logger from '@/logging';
import { ModelManager, ReviewConfig, ReviewPolicyManager } from '@/managers';
import { AnthropicProvider, BedrockProvider, OpenAIProvider } from '@/providers';

interface PRFile {
  filename: string;
  isBinary: boolean;
  patch?: string;
}

interface PRData {
  title?: string;
  body?: string;
  files: PRFile[];
  number?: number;
}

interface AWSConfig {
  region: string;
  modelId: string;
  maxTokens: number;
  temperature: number;
}

export class AIService {
  private modelManager: ModelManager;
  private reviewPolicyManager: ReviewPolicyManager;

  constructor() {
    // Get AI configuration
    const aiConfig = config.getAIConfig();

    // Initialize model manager
    this.modelManager = new ModelManager(aiConfig);
    this.reviewPolicyManager = new ReviewPolicyManager();

    // Register providers based on configuration
    this.initializeProviders(aiConfig);
  }

  /**
   * Initialize and register available model providers
   * @param {Object} aiConfig - AI configuration
   */
  initializeProviders(aiConfig: AIProviderConfig) {
    try {
      // Register Bedrock provider if configured
      if (aiConfig.providers && aiConfig.providers.bedrock) {
        this.modelManager.registerProvider(new BedrockProvider(aiConfig.providers.bedrock));
        logger.info('Registered Bedrock provider');
      }

      // Register OpenAI provider if configured with API key
      if (aiConfig.providers && aiConfig.providers.openai && aiConfig.providers.openai.apiKey) {
        this.modelManager.registerProvider(new OpenAIProvider(aiConfig.providers.openai));
        logger.info('Registered OpenAI provider');
      }

      // Register Anthropic provider if configured with API key
      if (
        aiConfig.providers &&
        aiConfig.providers.anthropic &&
        aiConfig.providers.anthropic.apiKey
      ) {
        this.modelManager.registerProvider(new AnthropicProvider(aiConfig.providers.anthropic));
        logger.info('Registered Anthropic provider');
      }

      // Log available providers
      const availableProviders = this.modelManager.getAvailableProviders();
      logger.info('Available AI providers', { providers: availableProviders });

      if (availableProviders.length === 0) {
        logger.warn('No AI providers registered. Check configuration.');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error : 'Unknown error';
      logger.error('Error initializing AI providers', { error: errorMessage });
    }
  }

  /**
   * Build a prompt for the AI model based on PR data
   * @param {PRData} prData - Pull request data including title, description, and files
   * @returns {string} Formatted prompt
   */
  private buildPrompt(prData: PRData, repoConfig: ReviewConfig): string {
    return this.reviewPolicyManager.generateCustomizedPrompt(prData, repoConfig);
  }

  /**
   * Invoke the AI model with the given prompt
   * @param {string} prompt - The prompt to send to the model
   * @param {Object} repoConfig - Repository review policy configuration
   * @returns {Promise<Object>} The model's response and metadata
   */
  private async invokeModel(prompt: string, repoConfig: ReviewConfig): Promise<any> {
    try {
      // Determine which provider to use based on repository configuration
      const providerName = repoConfig?.ai?.provider;

      logger.info('Invoking AI model', {
        provider: providerName || 'default',
        promptLength: prompt.length,
      });

      // Record metric for AI call attempt
      logger.recordMetric('aiCallsMade');

      // Prepare options from repository config
      const options = {
        provider: providerName,
        modelId: repoConfig?.ai?.model_id,
        temperature: repoConfig?.ai?.temperature,
        maxTokens: repoConfig?.ai?.max_tokens,
        enableFallback: repoConfig?.ai?.enable_fallback,
        fallbackProvider: repoConfig?.ai?.fallback_provider,
      };

      // Invoke model through manager
      const response = await this.modelManager.invokeModel(prompt, options);

      // Record success metric
      logger.recordMetric('aiCallsSucceeded');

      logger.info('Received AI response', {
        provider: response.provider,
        modelId: response.modelId,
        usedFallback: response.usedFallback || false,
        responseLength: response.content.length,
      });

      return response;
    } catch (error) {
      const erroMessage = error instanceof Error ? error : 'Unknown error';
      // Record failure metric
      logger.recordMetric('aiCallsFailed');

      logger.error('Failed to invoke AI model', {
        error: erroMessage,
        provider: repoConfig?.ai?.provider || 'default',
      });

      throw error;
    }
  }

  /**
   * Format the AI response into a well-structured markdown review comment
   * @param {string} aiResponse - Raw response from the AI model
   * @param {PRData} prData - Pull request data for context
   * @returns {string} Formatted markdown review
   */
  private formatReviewComment(
    aiResponse: string,
    prData: PRData,
    provider: string,
    modelId: string,
  ): string {
    // Add a header to the review
    const formattedReview = `## Automated Code Review

${aiResponse}

---
*Review generated by AI-Powered PR Review Extension using ${provider || 'AI'} (${modelId || 'unknown model'})*
`;

    return formattedReview;
  }

  /**
   * Perform a complete code review on a pull request
   * @param {PRData} prData - Pull request data including title, description, and files
   * @returns {Promise<string>} Formatted review comment
   */
  public async reviewPullRequest(
    prData: PRData,
    owner: string,
    repo: string,
    ref: string,
    trigger = 'webhook',
  ): Promise<string> {
    try {
      const repoConfig = await this.reviewPolicyManager.getRepositoryConfig(owner, repo, ref);

      // Build the prompt
      const prompt = this.buildPrompt(prData, repoConfig);

      const aiResponse = await this.invokeModel(prompt, repoConfig);

      // Format the response
      const formattedReview = this.formatReviewComment(
        aiResponse,
        prData,
        aiResponse.provider,
        aiResponse.modelId,
      );

      return formattedReview;
    } catch (error) {
      const errorMessage = error instanceof Error ? error : 'Unknown error';

      logger.error('Failed to review pull request', {
        error: errorMessage,
        prNumber: prData.number,
      });

      // Return a fallback message
      return `## Automated Code Review

I encountered an error while trying to review this pull request. Please try again later or contact the administrator.

Error: ${errorMessage}

---
*AI-Powered PR Review Extension*`;
    }
  }
}
