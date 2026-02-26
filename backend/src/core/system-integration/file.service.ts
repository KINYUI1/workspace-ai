import { PrismaClient } from '@prisma/client';
import { getPrismaClient } from '../../config/database';
import { NotFoundError, ValidationError } from '../../utils/errors';
import { logger } from '../../utils/logger';

// Inline DTOs until shared/types are generated
interface CreateFileDto {
  path: string;
  content: string;
  language?: string;
  agentId?: string;
  taskId?: string;
}

interface FileDto {
  id: string;
  userId: string;
  agentId: string | null;
  taskId: string | null;
  path: string;
  content: string;
  language: string | null;
  size: number;
  createdAt: Date;
  updatedAt: Date;
}

interface FileTreeNode {
  name: string;
  type: 'file' | 'folder';
  path?: string;
  children?: FileTreeNode[];
}

export class FileService {
  private readonly db: PrismaClient;

  constructor() {
    this.db = getPrismaClient();
  }

  async createFile(userId: string, dto: CreateFileDto): Promise<FileDto> {
    if (!dto.path || dto.path.trim() === '') {
      throw new ValidationError('File path is required');
    }

    // Upsert by userId + path (unique constraint in schema)
    const file = await this.db.projectFile.upsert({
      where: {
        userId_path: { userId, path: dto.path },
      },
      update: {
        content: dto.content,
        language: dto.language ?? null,
        agentId: dto.agentId ?? null,
        size: Buffer.byteLength(dto.content, 'utf8'),
      },
      create: {
        userId,
        path: dto.path,
        content: dto.content,
        language: dto.language ?? null,
        agentId: dto.agentId ?? null,
        size: Buffer.byteLength(dto.content, 'utf8'),
      },
    });

    logger.info('File created/updated', { fileId: file.id, path: dto.path, userId });
    return this.toDto(file);
  }

  async createFolder(userId: string, path: string): Promise<FileDto> {
    // Ensure path ends with /
    const folderPath = path.endsWith('/') ? path : `${path}/`;

    const file = await this.db.projectFile.upsert({
      where: {
        userId_path: { userId, path: folderPath },
      },
      update: {},
      create: {
        userId,
        path: folderPath,
        content: '',
        language: null,
        size: 0,
      },
    });

    logger.info('Folder created', { fileId: file.id, path: folderPath, userId });
    return this.toDto(file);
  }

  async getFile(userId: string, path: string): Promise<FileDto> {
    const file = await this.db.projectFile.findUnique({
      where: { userId_path: { userId, path } },
    });

    if (!file) {
      throw new NotFoundError('File', path);
    }

    return this.toDto(file);
  }

  async listFiles(userId: string, prefix?: string) {
    const where: Record<string, unknown> = { userId };

    if (prefix) {
      where.path = { startsWith: prefix };
    }

    const files = await this.db.projectFile.findMany({
      where,
      orderBy: { path: 'asc' },
    });

    return {
      data: files.map((f) => this.toDto(f)),
    };
  }

  async listFilesWithContent(userId: string, prefix: string): Promise<{ path: string; content: string }[]> {
    const files = await this.db.projectFile.findMany({
      where: { userId, path: { startsWith: prefix } },
      orderBy: { path: 'asc' },
      select: { path: true, content: true },
    });
    return files;
  }

  async deleteFile(userId: string, path: string): Promise<void> {
    const file = await this.db.projectFile.findUnique({
      where: { userId_path: { userId, path } },
    });

    if (!file) {
      throw new NotFoundError('File', path);
    }

    await this.db.projectFile.delete({ where: { id: file.id } });
    logger.info('File deleted', { fileId: file.id, path, userId });
  }

  async getFileTree(userId: string): Promise<FileTreeNode> {
    const files = await this.db.projectFile.findMany({
      where: { userId },
      orderBy: { path: 'asc' },
      select: { path: true },
    });

    const root: FileTreeNode = { name: 'root', type: 'folder', children: [] };

    for (const file of files) {
      const parts = file.path.split('/').filter((p) => p !== '');
      let current = root;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isLast = i === parts.length - 1;
        const isFolder = !isLast || file.path.endsWith('/');

        if (!current.children) {
          current.children = [];
        }

        let child = current.children.find((c) => c.name === part);

        if (!child) {
          child = {
            name: part,
            type: isFolder ? 'folder' : 'file',
            ...(isFolder ? { children: [] } : { path: file.path }),
          };
          current.children.push(child);
        }

        if (isFolder) {
          current = child;
        }
      }
    }

    return root;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private toDto(file: any): FileDto {
    return {
      id: file.id,
      userId: file.userId,
      agentId: file.agentId,
      taskId: file.taskId ?? null,
      path: file.path,
      content: file.content,
      language: file.language,
      size: file.size,
      createdAt: file.createdAt,
      updatedAt: file.updatedAt,
    };
  }
}
