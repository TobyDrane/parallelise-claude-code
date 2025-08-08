import fs from 'node:fs';
import path from 'node:path';
import { simpleGit } from 'simple-git';
import type { SimpleGit, SimpleGitProgressEvent } from 'simple-git';

export interface GitManagerOptions {
  workspaceDir: string;
  githubToken?: string;
}

export type ProgressCallback = (event: SimpleGitProgressEvent) => void;

/**
 * Manages Git operations for the docker wrapper
 */
export class GitManager {
  private git: SimpleGit;
  private workspaceDir: string;
  private githubToken?: string;

  constructor(options: GitManagerOptions) {
    this.workspaceDir = options.workspaceDir;
    this.githubToken = options.githubToken;
    if (!fs.existsSync(this.workspaceDir)) {
      fs.mkdirSync(this.workspaceDir, { recursive: true });
    }

    this.git = simpleGit({ baseDir: this.workspaceDir });
  }

  /**
   * Checks if a string is an SSH URL
   */
  private isSshUrl(url: string): boolean {
    return url.startsWith('git@') || url.includes('ssh://');
  }

  /**
   * Modifies an HTTPS URL to include the GitHub token
   */
  private addTokenToUrl(url: string): string {
    if (!this.githubToken || this.isSshUrl(url)) {
      return url;
    }

    const httpsPattern = /^https:\/\/([^\/]+)\/(.+)$/;
    const match = url.match(httpsPattern);

    if (match) {
      const domain = match[1];
      const repoPath = match[2];
      return `https://${this.githubToken}@${domain}/${repoPath}`;
    }

    return url;
  }

  /**
   * Clones a repository to the workspace directory
   */
  public async cloneRepository(
    repoUrl: string,
    progressCallback?: ProgressCallback
  ): Promise<string> {
    try {
      const authUrl = this.addTokenToUrl(repoUrl);

      if (progressCallback) {
        this.git.outputHandler((command, stdout, stderr, args) => {
          stdout.on('data', (data) => {
            const output = data.toString();

            const event: SimpleGitProgressEvent = {
              method: 'clone',
              stage: 'receiving',
              progress: 0,
              processed: 0,
              total: 0,
            };

            const receivingMatch = output.match(
              /Receiving objects:\s+(\d+)%\s+\((\d+)\/(\d+)\)/
            );
            const resolvingMatch = output.match(
              /Resolving deltas:\s+(\d+)%\s+\((\d+)\/(\d+)\)/
            );

            if (receivingMatch) {
              event.progress = Number.parseInt(receivingMatch[1], 10);
              event.processed = Number.parseInt(receivingMatch[2], 10);
              event.total = Number.parseInt(receivingMatch[3], 10);
              event.stage = 'receiving';
            } else if (resolvingMatch) {
              event.progress = Number.parseInt(resolvingMatch[1], 10);
              event.processed = Number.parseInt(resolvingMatch[2], 10);
              event.total = Number.parseInt(resolvingMatch[3], 10);
              event.stage = 'resolving';
            }

            progressCallback(event);
          });

          stderr.on('data', (data) => {
            const output = data.toString();
            progressCallback({
              method: 'clone',
              stage: 'error',
              progress: 0,
              processed: 0,
              total: 0,
            });
          });
        });
      }

      await this.git.clone(authUrl, this.workspaceDir);
      return this.workspaceDir;
    } catch (error) {
      await this.cleanWorkspace();
      throw error;
    }
  }

  /**
   * Validates that a repository is accessible
   */
  public async validateRepository(repoUrl: string): Promise<boolean> {
    const authUrl = this.addTokenToUrl(repoUrl);

    try {
      // For SSH URLs, we can't easily validate without attempting to clone
      if (this.isSshUrl(repoUrl)) {
        // Just check if it's a valid SSH URL format
        const sshPattern = /^git@([^:]+):([^\/]+)\/([^\/\.]+)(\.git)?$/;
        return sshPattern.test(repoUrl);
      }

      // For HTTPS URLs, try ls-remote to check access
      await this.git.listRemote([authUrl]);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Cleans up the workspace directory
   */
  public async cleanWorkspace(): Promise<void> {
    if (fs.existsSync(this.workspaceDir)) {
      const gitDir = path.join(this.workspaceDir, '.git');
      const isGitRepo = fs.existsSync(gitDir);

      if (isGitRepo) {
        try {
          // Remove .git directory to avoid permission issues
          fs.rmSync(gitDir, { recursive: true, force: true });
        } catch (error) {
          console.error(`Failed to remove .git directory: ${error}`);
        }
      }

      try {
        const entries = fs.readdirSync(this.workspaceDir);
        for (const entry of entries) {
          const entryPath = path.join(this.workspaceDir, entry);
          fs.rmSync(entryPath, { recursive: true, force: true });
        }
      } catch (error) {
        throw new Error(`Failed to clean workspace: ${error}`);
      }
    }
  }

  /**
   * Gets the current commit hash
   */
  public async getCurrentCommit(): Promise<string> {
    const result = await this.git.revparse(['HEAD']);
    return result.trim();
  }
}
