import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

const LEGACY_PASSWORD_SALT = 'lazarus_salt_v1';
const BCRYPT_COST = 12;

export function hashPassword(password: string): Promise<string> {
    if (typeof password !== 'string' || password.length < 12 || Buffer.byteLength(password, 'utf8') > 72) {
        throw new RangeError('New passwords must be at least 12 characters and no more than 72 UTF-8 bytes.');
    }
    return bcrypt.hash(password, BCRYPT_COST);
}

export async function verifyPassword(password: string, encodedHash: string): Promise<boolean> {
    if (/^\$2[aby]\$/.test(encodedHash)) {
        if (Buffer.byteLength(password, 'utf8') > 72) return false;
        return bcrypt.compare(password, encodedHash);
    }

    // Keep accounts created before bcrypt support usable. New passwords use bcrypt.
    if (!/^[0-9a-f]{128}$/i.test(encodedHash)) return false;
    const legacyHash = crypto.scryptSync(password, LEGACY_PASSWORD_SALT, 64);
    const storedHash = Buffer.from(encodedHash, 'hex');
    return crypto.timingSafeEqual(legacyHash, storedHash);
}
