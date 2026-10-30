import 'dotenv/config'
import { defineConfig } from 'prisma/config'
import path from 'node:path'
import { DEFAULT_DATABASE_URL, resolveSqliteDatabaseUrl } from './src/database_url'

const provider = process.env.DATABASE_PROVIDER?.trim().toLowerCase() || 'sqlite'
const configuredUrl = process.env.DATABASE_URL?.trim() || DEFAULT_DATABASE_URL
const databaseUrl = provider === 'postgresql'
  ? (process.env.DIRECT_URL?.trim() || configuredUrl)
  : resolveSqliteDatabaseUrl(configuredUrl, path.resolve(__dirname, 'prisma'))
if (provider !== 'sqlite' && provider !== 'postgresql') {
  throw new Error('DATABASE_PROVIDER must be either sqlite or postgresql.')
}
if (provider === 'postgresql' && !/^postgres(?:ql)?:\/\//i.test(databaseUrl)) {
  throw new Error('PostgreSQL requires a postgres:// or postgresql:// DATABASE_URL.')
}
process.env.DATABASE_URL = databaseUrl

export default defineConfig({
  earlyAccess: true,
  schema: {
    migrate: {
      url: databaseUrl,
    },
  },
})
