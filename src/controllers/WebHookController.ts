import config from '@/config';
import logger from '@/logging';
import { AIService, GithubService, SecurityService } from '@/services';
import { Request, Response } from 'express';

interface PullRequestData {
  number: number;
  title: string;
  body: string;
  files: any[];
}

interface ProcessingResult {
  processed: boolean;
  reason?: string;
  commentId?: string;
  error?: string;
}

interface ReviewState {
  timestamp: number;
  commentId: string;
}

export class WebHookController {
  private prReviewState: Map<string, ReviewState>;
  private githubService: GithubService;
  private aiService: AIService;
  private securityService: SecurityService;

  constructor() {
    this.prReviewState = new Map();

    this.githubService = new GithubService();
    this.aiService = new AIService();
    this.securityService = new SecurityService();
  }

  /**
   * Process a pull request event
   * @param {Object} payload - Webhook payload
   * @returns {Promise<Object>} Processing result
   */
  private async processPullRequestEvent(payload: any): Promise<ProcessingResult> {
    try {
      const { action, pull_request, repository } = payload;
      const prNumber = pull_request.number;
      const repo = repository.name;
      const owner = repository.owner.login;
      const prTitle = pull_request.title;
      const prBody = pull_request.body || '';

      logger.info('Processing pull request event', {
        action,
        owner,
        repo,
        prNumber,
      });

      if (!['opened', 'synchronize', 'reopened'].includes(action)) {
        logger.info('Ignoring pull request event with action', { action });
        return { processed: false, reason: `Action "${action}" not supported` };
      }

      const prKey = `${owner}/${repo}/${prNumber}`;
      const lastProcessed = this.prReviewState.get(prKey);

      if (lastProcessed && Date.now() - lastProcessed.timestamp < 5 * 60 * 1000) {
        logger.info('Skipping recently processed PR', {
          prKey,
          lastProcessedAt: new Date(lastProcessed.timestamp).toISOString(),
        });
        return { processed: false, reason: 'PR was recently processed' };
      }

      const files = await this.githubService.getPullRequestFiles(owner, repo, prNumber);

      if (!files?.length) {
        logger.info('No files changed in PR', { prNumber });
        return { processed: false, reason: 'No files changed' };
      }

      const prData: PullRequestData = {
        number: prNumber,
        title: prTitle,
        body: prBody,
        files,
      };

      const review = await this.aiService.reviewPullRequest(prData, owner, repo, prNumber);
      const comment = await this.githubService.createComment(owner, repo, prNumber, review);

      this.prReviewState.set(prKey, {
        timestamp: Date.now(),
        commentId: comment.id,
      });

      logger.info('Successfully posted review comment', {
        owner,
        repo,
        prNumber,
        commentId: comment.id,
      });

      return {
        processed: true,
        commentId: comment.id,
      };
    } catch (error: any) {
      logger.error('Error processing pull request event', { error: error.message });
      throw error;
    }
  }

  /**
   * Process an issue comment event (for manual review triggers)
   * @param {Object} payload - Webhook payload
   * @returns {Promise<Object>} Processing result
   */
  private async processIssueCommentEvent(payload: any): Promise<ProcessingResult> {
    try {
      if (!payload.issue.pull_request) {
        return { processed: false, reason: 'Not a pull request comment' };
      }

      const { action, comment, issue, repository } = payload;
      const prNumber = issue.number;
      const repo = repository.name;
      const owner = repository.owner.login;

      if (action !== 'created') {
        return { processed: false, reason: `Action "${action}" not supported` };
      }

      if (!comment.body.includes('/ai-review')) {
        return { processed: false, reason: 'Comment does not contain review trigger' };
      }

      logger.info('Processing manual review request', {
        owner,
        repo,
        prNumber,
      });

      const prDetails = await this.githubService.getPullRequestDetails(owner, repo, prNumber);
      const files = await this.githubService.getPullRequestFiles(owner, repo, prNumber);

      const prData: PullRequestData = {
        number: prNumber,
        title: prDetails.title,
        body: prDetails.body || '',
        files,
      };

      const review = await this.aiService.reviewPullRequest(prData, owner, repo, prNumber);
      const reviewComment = await this.githubService.createComment(owner, repo, prNumber, review);

      logger.info('Successfully posted manual review comment', {
        owner,
        repo,
        prNumber,
        commentId: reviewComment.id,
      });

      return {
        processed: true,
        commentId: reviewComment.id,
      };
    } catch (error: any) {
      logger.error('Error processing issue comment event', { error: error.message });
      throw error;
    }
  }

  /**
   * Handle incoming webhook request
   */
  public async handleWebHook(req: Request, res: Response): Promise<Response> {
    try {
      logger.recordMetric('webhooksReceived');

      const webhookSecret = config.getGitHubConfig().webhookSecret;
      const signature = req.headers['x-hub-signature-256'] as string;

      if (!this.securityService.validateWebhookSignature(req.body, signature, webhookSecret)) {
        logger.warn('Invalid webhook signature');
        return res.status(401).json({ error: 'Invalid signature' });
      }

      const eventType = req.headers['x-github-event'] as string;
      const payload = req.body;

      logger.info('Received webhook', { eventType });

      let result: ProcessingResult;

      switch (eventType) {
        case 'pull_request':
          result = await this.processPullRequestEvent(payload);
          break;
        case 'issue_comment':
          result = await this.processIssueCommentEvent(payload);
          break;
        default:
          logger.info('Ignoring unsupported event type', { eventType });
          result = { processed: false, reason: `Event type "${eventType}" not supported` };
      }

      if (result.processed) {
        logger.recordMetric('webhooksProcessed');
      }

      return res.status(200).json(result);
    } catch (error: any) {
      logger.error('Error processing webhook', { error: error.message });
      return res.status(200).json({
        processed: false,
        error: error.message,
      });
    }
  }
}
