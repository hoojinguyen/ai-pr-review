import logger from '@/logging';
import { GithubService } from '@/services';
import * as yaml from 'js-yaml';

export interface ReviewConfig {
  general: {
    enabled: boolean;
    min_size: number;
    max_size: number;
    style: string;
  };
  focus: {
    code_quality: boolean;
    security: boolean;
    performance: boolean;
    documentation: boolean;
    testing: boolean;
    architecture: boolean;
  };
  severity: {
    critical: boolean;
    high: boolean;
    medium: boolean;
    low: boolean;
    info: boolean;
  };
  files: {
    include: string[];
    exclude: string[];
  };
  custom_rules: CustomRule[];
  ai: {
    provider?: string;
    temperature?: number;
    max_tokens?: number;
    custom_instructions?: string;
    model_id?: string;
    enable_fallback?: boolean;
    fallback_provider?: string;
  };
}

interface CustomRule {
  name: string;
  pattern: string;
  description: string;
  severity: string;
}

interface PRData {
  title?: string;
  body?: string;
  files: Array<{
    filename: string;
    isBinary?: boolean;
    patch?: string;
  }>;
}

interface RuleViolation {
  rule: string;
  description: string;
  severity: string;
  line: number;
  match: string;
}

export class ReviewPolicyManager {
  private readonly defaultConfig: ReviewConfig = {
    general: {
      enabled: true,
      min_size: 10,
      max_size: 1000,
      style: 'consolidated',
    },
    focus: {
      code_quality: true,
      security: true,
      performance: true,
      documentation: true,
      testing: true,
      architecture: true,
    },
    severity: {
      critical: true,
      high: true,
      medium: true,
      low: true,
      info: true,
    },
    files: {
      include: ['**/*'],
      exclude: [],
    },
    custom_rules: [],
    ai: {
      temperature: 0.3,
      max_tokens: 1000,
      custom_instructions: '',
    },
  };

  private configCache: Map<string, ReviewConfig> = new Map();
  private githubService = new GithubService();

  async getRepositoryConfig(owner: string, repo: string, ref: string): Promise<ReviewConfig> {
    try {
      const cacheKey = `${owner}/${repo}/${ref}`;

      if (this.configCache.has(cacheKey)) {
        logger.info('Using cached review policy configuration', { owner, repo });
        return this.configCache.get(cacheKey)!;
      }

      logger.info('Fetching review policy configuration', { owner, repo, ref });

      try {
        const configFile = await this.githubService.getFileContent(
          owner,
          repo,
          '.github/ai-review.yml',
          ref,
        );

        const config = yaml.load(configFile.decodedContent) as Partial<ReviewConfig>;
        const validatedConfig = this.validateAndMergeConfig(config);
        this.configCache.set(cacheKey, validatedConfig);

        logger.info('Loaded custom review policy configuration', { owner, repo });
        return validatedConfig;
      } catch (error: any) {
        if (error.status === 404) {
          logger.info('No custom review policy configuration found, using defaults', {
            owner,
            repo,
          });
        } else {
          logger.warn('Error loading review policy configuration, using defaults', {
            error: error.message,
            owner,
            repo,
          });
        }

        this.configCache.set(cacheKey, this.defaultConfig);
        return this.defaultConfig;
      }
    } catch (error: any) {
      logger.error('Failed to get repository configuration', {
        error: error.message,
        owner,
        repo,
      });

      return this.defaultConfig;
    }
  }

  private validateAndMergeConfig(config: Partial<ReviewConfig>): ReviewConfig {
    const mergedConfig = structuredClone(this.defaultConfig);

    const mergeObjects = <T extends object>(target: T, source?: Partial<T>): T => {
      if (!source || typeof source !== 'object' || Array.isArray(source)) {
        return target;
      }

      Object.entries(source).forEach(([key, value]) => {
        if (
          value &&
          typeof value === 'object' &&
          !Array.isArray(value) &&
          target[key as keyof T] &&
          typeof target[key as keyof T] === 'object' &&
          !Array.isArray(target[key as keyof T])
        ) {
          mergeObjects(target[key as keyof T] as object, value);
        } else {
          (target as any)[key] = value;
        }
      });

      return target;
    };

    return mergeObjects(mergedConfig, config);
  }

  shouldIncludeFile(filePath: string, config: ReviewConfig): boolean {
    const { include, exclude } = config.files;

    const matchesPattern = (file: string, pattern: string): boolean => {
      const regexPattern = pattern
        .replace(/\./g, '\\.')
        .replace(/\*\*/g, '.*')
        .replace(/\*/g, '[^/]*')
        .replace(/\?/g, '.');

      return new RegExp(`^${regexPattern}$`).test(file);
    };

    return (
      !exclude.some((pattern) => matchesPattern(filePath, pattern)) &&
      include.some((pattern) => matchesPattern(filePath, pattern))
    );
  }

  applyCustomRules(filePath: string, content: string, customRules: CustomRule[]): RuleViolation[] {
    return customRules.flatMap((rule) => {
      try {
        const regex = new RegExp(rule.pattern, 'g');
        const violations: RuleViolation[] = [];
        let match: RegExpExecArray | null;

        while ((match = regex.exec(content)) !== null) {
          const lineNumber = (content.substring(0, match.index).match(/\n/g) || []).length + 1;

          violations.push({
            rule: rule.name,
            description: rule.description,
            severity: rule.severity,
            line: lineNumber,
            match: match[0],
          });
        }

        return violations;
      } catch (error: any) {
        logger.warn(`Invalid regex pattern in custom rule: ${rule.name}`, {
          error: error.message,
        });
        return [];
      }
    });
  }

  generateCustomizedPrompt(prData: PRData, config: ReviewConfig): string {
    const { title, body, files } = prData;
    const focusAreas = Object.entries(config.focus)
      .filter(([_, enabled]) => enabled)
      .map(([area]) => area.replace('_', ' '));

    const severityLevels = Object.entries(config.severity)
      .filter(([_, enabled]) => enabled)
      .map(([level]) => (level === 'info' ? 'informational' : level));

    let prompt = config.ai.custom_instructions ? `${config.ai.custom_instructions}\n\n` : '';
    prompt += `Please review the following code changes in a pull request. `;
    prompt += `Focus on ${focusAreas.join(', ')}. `;
    prompt += `Include ${severityLevels.join(', ')} severity issues. `;
    prompt += `Provide feedback as a markdown report with sections for summary and detailed comments.

PR Title: ${title || 'No title provided'}
PR Description: ${body || 'No description provided'}

Files changed:
`;

    files.forEach((file) => {
      if (!this.shouldIncludeFile(file.filename, config)) return;

      if (file.isBinary || (file.patch && file.patch.length > 10000)) {
        prompt += `${file.filename}: [Binary file or too large to include]\n`;
        return;
      }

      prompt += `${file.filename}:
\`\`\`
${file.patch || 'No diff available'}
\`\`\`

`;
    });

    if (config.custom_rules.length > 0) {
      prompt += `\nPlease also check for the following custom rules:\n`;
      config.custom_rules.forEach((rule) => {
        prompt += `- ${rule.name}: ${rule.description} (${rule.severity} severity)\n`;
      });
      prompt += `\n`;
    }

    prompt += `
Please organize your review with these sections:
1. Summary - A brief overview of the changes and their purpose
2. Key Findings - Major issues or concerns, categorized by type (${focusAreas.join(', ')})
3. Recommendations - Specific suggestions for improvement

Your review should be constructive, specific, and actionable.`;

    logger.info('Generated customized AI prompt', {
      promptLength: prompt.length,
      fileCount: files.length,
      focusAreas,
      severityLevels,
    });

    return prompt;
  }

  clearCache(): void {
    this.configCache.clear();
    logger.info('Cleared review policy configuration cache');
  }
}
