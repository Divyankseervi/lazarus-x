import 'dotenv/config'
import { defineConfig } from 'prisma/config'
import path from 'node:path'
import { DEFAULT_DATABASE_URL, resolveSqliteDatabaseUrl } from './src/database_url'

const databaseUrl = resolveSqliteDatabaseUrl(
  process.env.DATABASE_URL?.trim() || DEFAULT_DATABASE_URL,
  path.resolve(__dirname, 'prisma'),
)
process.env.DATABASE_URL = databaseUrl

export default defineConfig({
  earlyAccess: true,
  schema: {
    migrate: {
      url: databaseUrl,
    },
  },
})
