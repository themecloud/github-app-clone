import { App, Octokit } from 'octokit';
import { createAppAuth } from '@octokit/auth-app';

import { config } from 'dotenv';
import {simpleGit, SimpleGit, SimpleGitOptions } from 'simple-git';
import fs from 'fs';
import fsPromise from 'fs/promises';
import fetch from 'node-fetch';

// Load environment variables
config();

// Create custom Octokit class with fetch
const CustomOctokit = Octokit.defaults({
  request: {
    fetch: fetch as any
  }
});

interface Config {
  appId: string;
  privateKey: string;
  githubUser: string;
  repository: string;
  branch?: string;
  commit?: string;
}

const {
  GITHUB_APP_ID,
  GITHUB_USER,
  REPOSITORY,
  BRANCH,
  COMMIT
} = process.env;

console.log('GITHUB_APP_ID:', GITHUB_APP_ID);

// Validate required environment variables
if (!GITHUB_APP_ID  || !GITHUB_USER || !REPOSITORY) {
  throw new Error('Missing required environment variables');
}

async function main(): Promise<void> {
  try {
    const keyFilePath = './new-private-key.pem';
    const privateKey = fs.readFileSync(keyFilePath, 'utf-8');

    // Initialize GitHub App with custom Octokit
    const app = new App({
      appId: GITHUB_APP_ID as string,
      privateKey: privateKey as string,
      Octokit: CustomOctokit
    });

    // First verify the app authentication works
    try {
      const appInfo = await app.octokit.request('GET /app');
      console.log('App Info:', appInfo?.data?.name);

      // Get installations for the app
      const installations = await app.octokit.request('GET /app/installations');
      console.log('Installations:', installations.data);

      // Find the installation we want to use
      const installation = installations.data[0]; // Using first installation
      if (!installation) {
        throw new Error('No installation found');
      }

      console.log('Using installation:', installation.id);

      // Create an authenticated client for the installation
      const octokit = await app.getInstallationOctokit(installation.id);

      // Fix the repository format
      // Convert from git@github.com:Owner/Repo.git to Owner/Repo
      const repoPath = REPOSITORY?.match(/(?:git@github\.com:|https:\/\/github\.com\/)(.+?)(?:\.git)?$/)?.[1];

      if (!repoPath) {
        throw new Error('Invalid repository format');
      }

      const [owner, repo] = repoPath.split('/');

      // Create a directory for the clone if it doesn't exist
      const cloneDir = './repo-clone';
      await fsPromise.mkdir(cloneDir, { recursive: true });

      // Initialize git
      const gitOptions: Partial<SimpleGitOptions> = {
        baseDir: cloneDir,
        binary: 'git',
        maxConcurrentProcesses: 6,
        trimmed: false,
     };
      const git: SimpleGit = simpleGit(gitOptions);

      // Get the repository clone URL
      const repoData = await octokit.request('GET /repos/{owner}/{repo}', {
        owner,
        repo,
      });
      const cloneUrl = repoData.data.clone_url;


      // Clone the repository
      console.log('Cloning repository...');
      try {
        const authResponse = await octokit.auth({
          type: 'installation',
        });

        if (typeof authResponse === 'object' && authResponse !== null && 'token' in authResponse) {
          const token = authResponse.token;
          console.log('Token:', token);
          // Modify the authentication format in the clone URL
          const authenticatedCloneUrl = cloneUrl.replace(
            'https://',
            `https://x-access-token:${token}@`
          );

          // Clone the repository
          await git.clone(authenticatedCloneUrl, cloneDir);

          console.log(`Cloned repository to ${cloneDir}`);

          // Check if .git directory exists
          const gitDirExists = fs.existsSync(`${cloneDir}/.git`);

          if (!gitDirExists) {
            // Initialize as a Git repository if .git doesn't exist
            console.log('Initializing a new Git repository...');
            await git.init();
            console.log('Git repository initialized.');

            // Add the remote origin
            console.log('Adding remote origin...');
            await git.addRemote('origin', authenticatedCloneUrl);
            console.log('Remote origin added.');
          } else {
            console.log('Git repository already initialized.');
          }

          // Check out the specified branch
          if (BRANCH) {
            console.log(`Fetching remote branches...`);
            await git.fetch(['origin']);
            console.log(`Checking out branch: ${BRANCH}`);
            await git.checkout(['-b', BRANCH, `origin/${BRANCH}`]);
          }

          // Reset to the specified commit
          if (COMMIT) {
            await git.reset(['--hard', COMMIT]);
            console.log(`Checked out commit: ${COMMIT}`);
          }
        } else {
          throw new Error('Failed to retrieve the token');
        }




      } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }

      console.log('Repository cloned successfully!');
    } catch (error) {
      console.error('API Error:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

main();
