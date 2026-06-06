/**
 * @fileoverview SQLite database logger and tracker for job states and events.
 * @module orchestrator/db
 */

import { DatabaseSync } from 'node:sqlite';
import * as path from 'path';
import * as fs from 'fs';

let db: DatabaseSync | null = null;

/**
 * Initializes the SQLite database and creates the required schema.
 */
export function initDb(dbPath?: string): void {
  const finalPath = dbPath || path.resolve(process.cwd(), 'reports', 'factory.db');
  const dir = path.dirname(finalPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  db = new DatabaseSync(finalPath);
  
  // Create jobs tracking table
  db.exec(`
    CREATE TABLE IF NOT EXISTS orchestrator_jobs (
      job_id TEXT PRIMARY KEY,
      niche TEXT NOT NULL,
      tool_quantity INTEGER,
      credentials_provided INTEGER,
      state TEXT NOT NULL,
      score REAL,
      deployment_url TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  
  // Create step/event logging table
  db.exec(`
    CREATE TABLE IF NOT EXISTS orchestrator_steps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id TEXT NOT NULL,
      state TEXT NOT NULL,
      message TEXT,
      timestamp TEXT NOT NULL,
      FOREIGN KEY(job_id) REFERENCES orchestrator_jobs(job_id)
    );
  `);
}

/**
 * Inserts a new job entry into the database.
 */
export function createJob(job: {
  jobId: string;
  niche: string;
  toolQuantity?: number;
  credentialsProvided?: boolean;
  state: string;
  createdAt: string;
  updatedAt: string;
}): void {
  if (!db) initDb();
  const stmt = db!.prepare(`
    INSERT INTO orchestrator_jobs (job_id, niche, tool_quantity, credentials_provided, state, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    job.jobId,
    job.niche,
    job.toolQuantity ?? 2,
    job.credentialsProvided ? 1 : 0,
    job.state,
    job.createdAt,
    job.updatedAt
  );
}

/**
 * Updates an existing job's state and optional score/url parameters.
 */
export function updateJobState(
  jobId: string,
  state: string,
  updateFields: { score?: number; deploymentUrl?: string } = {}
): void {
  if (!db) initDb();
  const updatedAt = new Date().toISOString();
  
  if (updateFields.score !== undefined && updateFields.deploymentUrl !== undefined) {
    const stmt = db!.prepare(`
      UPDATE orchestrator_jobs 
      SET state = ?, score = ?, deployment_url = ?, updated_at = ?
      WHERE job_id = ?
    `);
    stmt.run(state, updateFields.score, updateFields.deploymentUrl, updatedAt, jobId);
  } else if (updateFields.score !== undefined) {
    const stmt = db!.prepare(`
      UPDATE orchestrator_jobs 
      SET state = ?, score = ?, updated_at = ?
      WHERE job_id = ?
    `);
    stmt.run(state, updateFields.score, updatedAt, jobId);
  } else if (updateFields.deploymentUrl !== undefined) {
    const stmt = db!.prepare(`
      UPDATE orchestrator_jobs 
      SET state = ?, deployment_url = ?, updated_at = ?
      WHERE job_id = ?
    `);
    stmt.run(state, updateFields.deploymentUrl, updatedAt, jobId);
  } else {
    const stmt = db!.prepare(`
      UPDATE orchestrator_jobs 
      SET state = ?, updated_at = ?
      WHERE job_id = ?
    `);
    stmt.run(state, updatedAt, jobId);
  }
}

/**
 * Inserts a step event log row associated with a job.
 */
export function logStep(jobId: string, state: string, message: string): void {
  if (!db) initDb();
  const timestamp = new Date().toISOString();
  const stmt = db!.prepare(`
    INSERT INTO orchestrator_steps (job_id, state, message, timestamp)
    VALUES (?, ?, ?, ?)
  `);
  stmt.run(jobId, state, message, timestamp);
}

/**
 * Retrieves job metadata.
 */
export function getJob(jobId: string): any {
  if (!db) initDb();
  const stmt = db!.prepare(`SELECT * FROM orchestrator_jobs WHERE job_id = ?`);
  return stmt.get(jobId);
}

/**
 * Retrieves all step events logged under a job.
 */
export function getSteps(jobId: string): any[] {
  if (!db) initDb();
  const stmt = db!.prepare(`SELECT * FROM orchestrator_steps WHERE job_id = ? ORDER BY id ASC`);
  return stmt.all(jobId) as any[];
}
