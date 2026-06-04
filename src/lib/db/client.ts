/**
 * D1 database client for Cloudflare Workers.
 * Uses getCloudflareContext() from @opennextjs/cloudflare to access bindings.
 */

import { getCloudflareContext } from '@opennextjs/cloudflare'

export interface D1Result<T = unknown> {
  results: T[]
  success: boolean
  meta: { duration: number; changes?: number; last_row_id?: number; rows_read?: number; rows_written?: number }
}

export async function getDB() {
  const ctx = getCloudflareContext({ async: true })
  const env = (await ctx).env as Record<string, unknown>
  const db = env.DB as D1Database
  if (!db) {
    throw new Error('D1 database binding "DB" is not configured in wrangler.toml')
  }
  return db
}

export async function dbQuery<T = unknown>(sql: string, params?: unknown[]): Promise<D1Result<T>> {
  const db = await getDB()
  const stmt = db.prepare(sql)
  const bound = params ? stmt.bind(...params) : stmt
  return bound.all() as Promise<D1Result<T>>
}

export async function dbQueryFirst<T = unknown>(sql: string, params?: unknown[]): Promise<T | null> {
  const res = await dbQuery<T>(sql, params)
  return res.results[0] ?? null
}

export async function dbRun(sql: string, params?: unknown[]): Promise<D1Result> {
  const db = await getDB()
  const stmt = db.prepare(sql)
  const bound = params ? stmt.bind(...params) : stmt
  return bound.run() as Promise<D1Result>
}

export async function dbBatch(statements: { sql: string; params?: unknown[] }[]): Promise<D1Result[]> {
  const db = await getDB()
  const prepped = statements.map((s) => {
    const stmt = db.prepare(s.sql)
    return s.params ? stmt.bind(...s.params) : stmt
  })
  return db.batch(prepped) as Promise<D1Result[]>
}
