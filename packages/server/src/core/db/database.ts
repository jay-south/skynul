import Database from 'better-sqlite3'
import { join } from 'path'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { getDataDir } from './config'
import * as schema from './schema'

let dbInstance: ReturnType<typeof drizzle> | null = null
let sqliteInstance: Database.Database | null = null

export function getDb() {
  if (dbInstance) return dbInstance

  const dbPath = join(getDataDir(), 'memory.db')
  sqliteInstance = new Database(dbPath)
  sqliteInstance.pragma('journal_mode = WAL')
  sqliteInstance.pragma('foreign_keys = ON')

  dbInstance = drizzle(sqliteInstance, { schema })
  return dbInstance
}

export function getSqlite(): Database.Database {
  if (!sqliteInstance) {
    getDb()
  }
  return sqliteInstance!
}

export function closeDb(): void {
  if (sqliteInstance) {
    sqliteInstance.close()
    sqliteInstance = null
    dbInstance = null
  }
}

export { schema }
