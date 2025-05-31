import config, { type GitHubConfig } from '@/config';
import logger from '@/logging';
import { Octokit } from '@octokit/rest';

interface FileContentResponse {
  content: string;
  decodedContent: string;
  [key: string]: any;
}

export class GithubService {
  private octokit: Octokit;
  private rateLimitRemaining: number | null = null;
  private rateLimitReset: number | null = null;

  constructor() {
    const githubConfig: GitHubConfig = config.getGitHubConfig();

    this.octokit = new Octokit({
      auth: githubConfig.token,
      baseUrl: githubConfig.baseUrl,
      log: {
        debug: (message: string) => logger.log('debug', `Octokit: ${message}`),
        info: (message: string) => logger.log('info', `Octokit: ${message}`),
        warn: (message: string) => logger.log('warn', `Octokit: ${message}`),
        error: (message: string) => logger.log('error', `Octokit: ${message}`),
      },
    });
  }

  async getPullRequestDetails(owner: string, repo: string, prNumber: number): Promise<any> {
    try {
      logger.info('Fetching PR details', { owner, repo, prNumber });

      const response = await this.octokit.pulls.get({
        owner,
        repo,
        pull_number: prNumber,
      });

      this.updateRateLimitInfo(response.headers);

      return response.data;
    } catch (error: any) {
      logger.error('Failed to fetch PR details', {
        error: error.message,
        owner,
        repo,
        prNumber,
      });
      throw error;
    }
  }

  async getPullRequestFiles(owner: string, repo: string, prNumber: number): Promise<any[]> {
    try {
      logger.info('Fetching PR files', { owner, repo, prNumber });

      const response = await this.octokit.pulls.listFiles({
        owner,
        repo,
        pull_number: prNumber,
      });

      this.updateRateLimitInfo(response.headers);

      return response.data;
    } catch (error: any) {
      logger.error('Failed to fetch PR files', {
        error: error.message,
        owner,
        repo,
        prNumber,
      });
      throw error;
    }
  }

  async getFileContent(
    owner: string,
    repo: string,
    path: string,
    ref: string,
  ): Promise<FileContentResponse> {
    try {
      logger.info('Fetching file content', { owner, repo, path, ref });

      const response = await this.octokit.repos.getContent({
        owner,
        repo,
        path,
        ref,
      });

      this.updateRateLimitInfo(response.headers);

      if (!('content' in response.data) || typeof response.data.content !== 'string') {
        throw new Error('Content not found in response data');
      }

      const content = Buffer.from(response.data.content, 'base64').toString();

      return {
        ...response.data,
        decodedContent: content,
      };
    } catch (error: any) {
      logger.error('Failed to fetch file content', {
        error: error.message,
        owner,
        repo,
        path,
        ref,
      });
      throw error;
    }
  }

  async createComment(owner: string, repo: string, prNumber: number, body: string): Promise<any> {
    try {
      logger.info('Creating PR comment', { owner, repo, prNumber });

      const response = await this.octokit.issues.createComment({
        owner,
        repo,
        issue_number: prNumber,
        body,
      });

      this.updateRateLimitInfo(response.headers);
      logger.recordMetric('commentsPosted');

      return response.data;
    } catch (error: any) {
      logger.error('Failed to create PR comment', {
        error: error.message,
        owner,
        repo,
        prNumber,
      });
      throw error;
    }
  }

  async updateComment(owner: string, repo: string, commentId: number, body: string): Promise<any> {
    try {
      logger.info('Updating comment', { owner, repo, commentId });

      const response = await this.octokit.issues.updateComment({
        owner,
        repo,
        comment_id: commentId,
        body,
      });

      this.updateRateLimitInfo(response.headers);

      return response.data;
    } catch (error: any) {
      logger.error('Failed to update comment', {
        error: error.message,
        owner,
        repo,
        commentId,
      });
      throw error;
    }
  }

  private updateRateLimitInfo(headers: Record<string, any>): void {
    if (headers['x-ratelimit-remaining']) {
      this.rateLimitRemaining = parseInt(headers['x-ratelimit-remaining'], 10);
    }

    if (headers['x-ratelimit-reset']) {
      this.rateLimitReset = parseInt(headers['x-ratelimit-reset'], 10);
    }

    if (this.rateLimitRemaining !== null && this.rateLimitRemaining < 100) {
      logger.warn('GitHub API rate limit running low', {
        remaining: this.rateLimitRemaining,
        resetTimestamp: this.rateLimitReset,
        resetTime: this.rateLimitReset
          ? new Date(this.rateLimitReset * 1000).toISOString()
          : 'unknown',
      });
    }
  }

  isRateLimited(): boolean {
    return this.rateLimitRemaining !== null && this.rateLimitRemaining <= 0;
  }

  getSecondsUntilReset(): number | null {
    if (!this.rateLimitReset) return null;

    const now = Math.floor(Date.now() / 1000);
    return Math.max(0, this.rateLimitReset - now);
  }
}
