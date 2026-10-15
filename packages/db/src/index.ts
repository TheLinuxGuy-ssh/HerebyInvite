import { Pool, type PoolConfig } from 'pg';

import type { SiteSpec } from '@hereby/spec';

export interface ProjectRecord {
  id: string;
  sourcePrompt: string;
  language: string;
  languagePreference?: string;
  spec: SiteSpec;
  createdAt: string;
}

export interface ProjectStore {
  saveProject(project: ProjectRecord): Promise<void>;
  getProject(id: string): Promise<ProjectRecord | null>;
  initialize?(): Promise<void>;
  close?(): Promise<void>;
}

export class MemoryProjectStore implements ProjectStore {
  private readonly projects = new Map<string, ProjectRecord>();

  saveProject(project: ProjectRecord): Promise<void> {
    this.projects.set(project.id, project);
    return Promise.resolve();
  }

  getProject(id: string): Promise<ProjectRecord | null> {
    return Promise.resolve(this.projects.get(id) ?? null);
  }
}

export class PostgresProjectStore implements ProjectStore {
  private readonly pool: Pool;

  constructor(config: PoolConfig = {}) {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ...(process.env.DB_PASSWORD ? { password: process.env.DB_PASSWORD } : {}),
      max: 5,
      idleTimeoutMillis: 30_000,
      ...config,
    });
  }

  async initialize(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id UUID PRIMARY KEY,
        source_prompt TEXT NOT NULL,
        language TEXT NOT NULL CHECK (language IN ('english', 'hindi', 'hinglish')),
        language_preference TEXT CHECK (language_preference IS NULL OR language_preference IN ('en', 'hi', 'hinglish')),
        spec_json JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS projects_created_at_idx ON projects (created_at DESC);
    `);
  }

  async saveProject(project: ProjectRecord): Promise<void> {
    await this.pool.query(
      `INSERT INTO projects (id, source_prompt, language, language_preference, spec_json, created_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6)
       ON CONFLICT (id) DO UPDATE SET
         source_prompt = EXCLUDED.source_prompt,
         language = EXCLUDED.language,
         language_preference = EXCLUDED.language_preference,
         spec_json = EXCLUDED.spec_json`,
      [
        project.id,
        project.sourcePrompt,
        project.language,
        project.languagePreference ?? null,
        JSON.stringify(project.spec),
        project.createdAt,
      ],
    );
  }

  async getProject(id: string): Promise<ProjectRecord | null> {
    const result = await this.pool.query<{
      id: string;
      source_prompt: string;
      language: string;
      language_preference: string | null;
      spec_json: SiteSpec;
      created_at: Date;
    }>('SELECT id, source_prompt, language, language_preference, spec_json, created_at FROM projects WHERE id = $1', [id]);
    const row = result.rows[0];
    if (!row) return null;

    return {
      id: row.id,
      sourcePrompt: row.source_prompt,
      language: row.language,
      ...(row.language_preference ? { languagePreference: row.language_preference } : {}),
      spec: row.spec_json,
      createdAt: row.created_at.toISOString(),
    };
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

export function createProjectStore(): ProjectStore {
  return process.env.DATABASE_URL ? new PostgresProjectStore() : new MemoryProjectStore();
}
