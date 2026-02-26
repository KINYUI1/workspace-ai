import Docker from 'dockerode';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { logger } from '../../utils/logger';
import { DESKTOP_MODE } from '../../config/env';

interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  executionTimeMs: number;
  timedOut: boolean;
}

const LANGUAGE_CONFIG: Record<string, { image: string; cmd: (file: string) => string[] }> = {
  python: { image: 'python:3.12-slim', cmd: (f) => ['python', f] },
  javascript: { image: 'node:22-slim', cmd: (f) => ['node', f] },
  bash: { image: 'bash:5', cmd: (f) => ['bash', f] },
};

const FILE_EXTENSIONS: Record<string, string> = {
  python: '.py',
  javascript: '.js',
  bash: '.sh',
};

// Direct execution commands (desktop mode — no Docker)
const LOCAL_COMMANDS: Record<string, string> = {
  python: 'python3',
  javascript: 'node',
  bash: 'bash',
};

export class SandboxService {
  private readonly docker: Docker;

  constructor() {
    this.docker = new Docker();
  }

  async isDockerAvailable(): Promise<boolean> {
    try {
      await this.docker.ping();
      return true;
    } catch {
      return false;
    }
  }

  async executeCode(
    language: 'python' | 'javascript' | 'bash',
    code: string,
    timeoutMs = 30000,
  ): Promise<ExecutionResult> {
    // In desktop mode, prefer direct execution (Docker optional)
    if (DESKTOP_MODE) {
      const dockerAvailable = await this.isDockerAvailable();
      if (!dockerAvailable) {
        return this.executeDirectly(language, code, timeoutMs);
      }
    }

    return this.executeInDocker(language, code, timeoutMs);
  }

  /**
   * Execute code directly on the host machine (desktop mode).
   * Uses child_process.spawn with timeout enforcement.
   */
  private async executeDirectly(
    language: 'python' | 'javascript' | 'bash',
    code: string,
    timeoutMs: number,
  ): Promise<ExecutionResult> {
    const command = LOCAL_COMMANDS[language];
    if (!command) {
      return {
        stdout: '',
        stderr: `Unsupported language: ${language}`,
        exitCode: 1,
        executionTimeMs: 0,
        timedOut: false,
      };
    }

    const ext = FILE_EXTENSIONS[language];
    const sandboxDir = path.join(os.homedir(), '.workspace-ai', 'sandbox');
    if (!fs.existsSync(sandboxDir)) {
      fs.mkdirSync(sandboxDir, { recursive: true });
    }

    const fileName = path.join(sandboxDir, `exec_${Date.now()}${ext}`);
    const startTime = Date.now();

    try {
      // Write code to temp file
      fs.writeFileSync(fileName, code, 'utf-8');

      return await new Promise<ExecutionResult>((resolve) => {
        let stdout = '';
        let stderr = '';
        let timedOut = false;
        let resolved = false;

        const child = spawn(command, [fileName], {
          cwd: sandboxDir,
          timeout: timeoutMs,
          env: { ...process.env, HOME: os.homedir() },
        });

        child.stdout.on('data', (data: Buffer) => {
          stdout += data.toString('utf-8');
        });

        child.stderr.on('data', (data: Buffer) => {
          stderr += data.toString('utf-8');
        });

        const timer = setTimeout(() => {
          timedOut = true;
          child.kill('SIGKILL');
        }, timeoutMs);

        child.on('close', (exitCode) => {
          clearTimeout(timer);
          if (resolved) return;
          resolved = true;

          const executionTimeMs = Date.now() - startTime;
          logger.info('Code execution completed (direct)', {
            language,
            exitCode: exitCode ?? 1,
            executionTimeMs,
            timedOut,
          });

          resolve({
            stdout: stdout.slice(0, 10000),
            stderr: stderr.slice(0, 5000),
            exitCode: exitCode ?? 1,
            executionTimeMs,
            timedOut,
          });
        });

        child.on('error', (err) => {
          clearTimeout(timer);
          if (resolved) return;
          resolved = true;

          resolve({
            stdout: '',
            stderr: err.message,
            exitCode: 1,
            executionTimeMs: Date.now() - startTime,
            timedOut: false,
          });
        });
      });
    } finally {
      // Clean up temp file
      try {
        fs.unlinkSync(fileName);
      } catch {
        // Ignore
      }
    }
  }

  /**
   * Execute code in a Docker container (original implementation).
   */
  private async executeInDocker(
    language: 'python' | 'javascript' | 'bash',
    code: string,
    timeoutMs: number,
  ): Promise<ExecutionResult> {
    const config = LANGUAGE_CONFIG[language];
    if (!config) {
      return {
        stdout: '',
        stderr: `Unsupported language: ${language}`,
        exitCode: 1,
        executionTimeMs: 0,
        timedOut: false,
      };
    }

    const ext = FILE_EXTENSIONS[language];
    const fileName = `/tmp/code${ext}`;
    const startTime = Date.now();
    let container: Docker.Container | null = null;

    try {
      container = await this.docker.createContainer({
        Image: config.image,
        Cmd: ['sh', '-c', `cat > ${fileName} << 'CODEEOF'\n${code}\nCODEEOF\n${config.cmd(fileName).join(' ')}`],
        HostConfig: {
          Memory: 128 * 1024 * 1024,
          CpuPeriod: 100000,
          CpuQuota: 50000,
          NetworkMode: 'none',
        },
        Tty: false,
      });

      await container.start();

      const waitPromise = container.wait();
      const timeoutPromise = new Promise<{ StatusCode: number }>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), timeoutMs),
      );

      let timedOut = false;
      let statusCode = 1;

      try {
        const result = await Promise.race([waitPromise, timeoutPromise]);
        statusCode = result.StatusCode;
      } catch (err) {
        if ((err as Error).message === 'timeout') {
          timedOut = true;
          try {
            await container.stop({ t: 1 });
          } catch {
            // Container may already be stopped
          }
        } else {
          throw err;
        }
      }

      const logs = await container.logs({ stdout: true, stderr: true });
      const { stdout, stderr } = this.demuxDockerStream(logs);

      const executionTimeMs = Date.now() - startTime;

      logger.info('Code execution completed', {
        language,
        exitCode: statusCode,
        executionTimeMs,
        timedOut,
      });

      return {
        stdout: stdout.slice(0, 10000),
        stderr: stderr.slice(0, 5000),
        exitCode: statusCode,
        executionTimeMs,
        timedOut,
      };
    } catch (error) {
      logger.error('Code execution failed', {
        language,
        error: (error as Error).message,
      });

      return {
        stdout: '',
        stderr: (error as Error).message,
        exitCode: 1,
        executionTimeMs: Date.now() - startTime,
        timedOut: false,
      };
    } finally {
      if (container) {
        try {
          await container.remove({ force: true });
        } catch {
          // Container may already be removed
        }
      }
    }
  }

  private demuxDockerStream(buffer: Buffer): { stdout: string; stderr: string } {
    let stdout = '';
    let stderr = '';
    let offset = 0;

    while (offset < buffer.length) {
      if (offset + 8 > buffer.length) {
        stdout += buffer.subarray(offset).toString('utf-8');
        break;
      }

      const streamType = buffer[offset];
      const frameSize = buffer.readUInt32BE(offset + 4);
      offset += 8;

      if (offset + frameSize > buffer.length) {
        const text = buffer.subarray(offset).toString('utf-8');
        if (streamType === 2) stderr += text;
        else stdout += text;
        break;
      }

      const text = buffer.subarray(offset, offset + frameSize).toString('utf-8');
      if (streamType === 2) {
        stderr += text;
      } else {
        stdout += text;
      }
      offset += frameSize;
    }

    return { stdout, stderr };
  }
}
