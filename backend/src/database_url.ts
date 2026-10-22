import path from 'node:path';

export const DEFAULT_DATABASE_URL = 'file:./dev.db';

function encodeSqlitePath(absolutePath: string): string {
    return absolutePath.split(path.sep)
        .map(segment => encodeURIComponent(segment).replace(/%3A/gi, ':'))
        .join('/');
}

/** Resolve SQLite file URLs relative to the Prisma schema directory, including query options. */
export function resolveSqliteDatabaseUrl(databaseUrl: string, schemaDirectory: string): string {
    if (!databaseUrl.toLowerCase().startsWith('file:')) {
        throw new Error('This build uses SQLite; DATABASE_URL must be a file: URL.');
    }
    const [rawPath, ...queryParts] = databaseUrl.slice('file:'.length).split('?');
    if (!rawPath) throw new Error('DATABASE_URL must include a SQLite file path.');
    let decodedPath: string;
    try { decodedPath = decodeURIComponent(rawPath); }
    catch { throw new Error('DATABASE_URL contains an invalid encoded SQLite path.'); }
    const absolutePath = path.isAbsolute(decodedPath)
        ? path.resolve(decodedPath)
        : path.resolve(schemaDirectory, decodedPath);
    const query = queryParts.length > 0 ? `?${queryParts.join('?')}` : '';
    return `file:${encodeSqlitePath(absolutePath)}${query}`;
}
