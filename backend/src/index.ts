import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import { EvidenceValidationError, LazarusXEngine, SearchSpaceLimitError } from './engine/lazarus';
import { Schema, Evidence, ProvenanceEntry } from './engine/types';
import {
    appendPublicProvenanceEnvelope,
    createProvenanceDisclosure,
    decryptCaseSalt,
    deriveEventCommitmentKey,
    encryptCaseSalt,
    parseProvenanceMasterKey,
    PROVENANCE_GENESIS_HASH,
    PUBLIC_ENVELOPE_GENESIS_HASH,
    verifyProvenanceChain,
    createProvenanceCheckpointManifest,
    computeEnvelopeMerkleRoot,
    generateEnvelopeInclusionProof,
    buildEnvelopeMerkleTree,
    generateProofFromMerkleTree,
    type EnvelopeMerkleTree,
    type PublicProvenanceEnvelopeEntry,
    type ProvenanceCheckpointManifest,
} from './engine/provenance';
import { createOfflineAuditBundle, OFFLINE_AUDIT_VERIFIER_SOURCE } from './engine/audit_bundle';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { hashPassword, verifyPassword } from './security/password';

const generateToken = () => crypto.randomBytes(32).toString('hex');
const PROVENANCE_PAGE_SIZE = 500;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface RateLimitOptions {
    windowMs: number;
    maximum: number;
    name: string;
}

function createRateLimiter({ windowMs, maximum, name }: RateLimitOptions) {
    const windows = new Map<string, { count: number; resetAt: number }>();
    const maximumKeys = 20_000;
    let lastCleanup = 0;

    return (req: Request, res: Response, next: NextFunction) => {
        const now = Date.now();
        if (now - lastCleanup > 60_000 || windows.size >= maximumKeys) {
            for (const [key, window] of windows) if (window.resetAt <= now) windows.delete(key);
            lastCleanup = now;
        }
        const key = req.ip || req.socket.remoteAddress || 'unknown';
        let window = windows.get(key);
        if (!window || window.resetAt <= now) {
            if (windows.size >= maximumKeys) {
                const oldest = windows.keys().next().value;
                if (oldest !== undefined) windows.delete(oldest);
            }
            window = { count: 0, resetAt: now + windowMs };
            windows.set(key, window);
        }
        window.count += 1;
        const remaining = Math.max(0, maximum - window.count);
        res.setHeader('RateLimit-Limit', String(maximum));
        res.setHeader('RateLimit-Remaining', String(remaining));
        res.setHeader('RateLimit-Reset', String(Math.ceil(window.resetAt / 1000)));
        if (window.count > maximum) {
            res.setHeader('Retry-After', String(Math.max(1, Math.ceil((window.resetAt - now) / 1000))));
            return res.status(429).json({ error: 'Too many requests. Try again later.', code: 'RATE_LIMITED' });
        }
        res.setHeader('RateLimit-Policy', `${maximum};w=${Math.ceil(windowMs / 1000)};name="${name}"`);
        next();
    };
}

class BoundedEngineCache {
    private engines = new Map<string, LazarusXEngine>();
    constructor(private readonly maxEngines = 100) {}

    get(id: string): LazarusXEngine | undefined {
        const engine = this.engines.get(id);
        if (engine) {
            this.engines.delete(id);
            this.engines.set(id, engine);
        }
        return engine;
    }

    set(id: string, engine: LazarusXEngine): void {
        if (this.engines.has(id)) {
            this.engines.delete(id);
        } else if (this.engines.size >= this.maxEngines) {
            const oldest = this.engines.keys().next().value;
            if (oldest !== undefined) this.engines.delete(oldest);
        }
        this.engines.set(id, engine);
    }

    delete(id: string): boolean {
        return this.engines.delete(id);
    }

    clear(): void {
        this.engines.clear();
    }
}

interface CachedCaseProvenanceAccumulator {
    caseId: string;
    sequence: number;
    headHash: string;
    publicEnvelopeHead: string;
    envelopes: PublicProvenanceEnvelopeEntry[];
    merkleTree: EnvelopeMerkleTree;
    checkpoint: ProvenanceCheckpointManifest;
}

class BoundedProvenanceAccumulatorCache {
    private accumulators = new Map<string, CachedCaseProvenanceAccumulator>();
    constructor(private readonly maxCases = 100) {}

    get(id: string): CachedCaseProvenanceAccumulator | undefined {
        const item = this.accumulators.get(id);
        if (item) {
            this.accumulators.delete(id);
            this.accumulators.set(id, item);
        }
        return item;
    }

    set(id: string, accumulator: CachedCaseProvenanceAccumulator): void {
        if (this.accumulators.has(id)) {
            this.accumulators.delete(id);
        } else if (this.accumulators.size >= this.maxCases) {
            const oldest = this.accumulators.keys().next().value;
            if (oldest !== undefined) this.accumulators.delete(oldest);
        }
        this.accumulators.set(id, accumulator);
    }

    delete(id: string): boolean {
        return this.accumulators.delete(id);
    }

    clear(): void {
        this.accumulators.clear();
    }
}

function allowedOrigins(): Set<string> {
    const configured = process.env.CORS_ORIGINS || process.env.CORS_ORIGIN;
    if (configured !== undefined && configured.trim() !== '') {
        if (configured.trim() === '*') {
            return new Set(['*', 'http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000', 'http://127.0.0.1:3000']);
        }
        return new Set(configured.split(',').map(origin => origin.trim()).filter(Boolean));
    }
    return new Set([
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:4173',
        'http://127.0.0.1:4173'
    ]);
}

function toProvenanceEntry(entry: {
    sequence: number;
    eventType: string;
    fragmentId: string;
    relatedFragmentIds: string;
    actorId: string;
    receivedAt: Date;
    payload: string;
    previousHash: string;
    hash: string;
}): ProvenanceEntry {
    const relatedFragmentIds: unknown = JSON.parse(entry.relatedFragmentIds);
    if (!Array.isArray(relatedFragmentIds) || relatedFragmentIds.some(id => typeof id !== 'string')) {
        throw new Error('Malformed provenance references.');
    }
    const receivedAt = entry.receivedAt instanceof Date && Number.isFinite(entry.receivedAt.getTime())
        ? entry.receivedAt.toISOString()
        : String(entry.receivedAt);
    return {
        sequence: entry.sequence,
        eventType: entry.eventType as ProvenanceEntry['eventType'],
        fragmentId: entry.fragmentId,
        relatedFragmentIds: relatedFragmentIds as string[],
        actorId: entry.actorId,
        receivedAt,
        payload: entry.payload,
        previousHash: entry.previousHash,
        hash: entry.hash,
    };
}

function logApiFailure(req: Request, error: unknown): void {
    const errorName = error instanceof Error ? error.name : 'UnknownError';
    // Keep request bodies, credentials, and database messages out of logs.
    console.error(JSON.stringify({ event: 'api_error', method: req.method, path: req.path, errorName }));
}

function acquireCaseLock(locks: Map<string, Promise<void>>, key: string): Promise<() => void> {
    const previous = locks.get(key) ?? Promise.resolve();
    let releaseCurrent!: () => void;
    const currentGate = new Promise<void>(resolve => { releaseCurrent = resolve; });
    const tail = previous.then(() => currentGate);
    locks.set(key, tail);
    return previous.then(() => () => {
        releaseCurrent();
        if (locks.get(key) === tail) locks.delete(key);
    });
}

// ==========================================
// MIDDLEWARE
// ==========================================
declare global {
    namespace Express {
        interface Request {
            user?: { id: string; role: string; email: string };
            sessionTokenHash?: string;
        }
    }
}

const requireAuth = (prisma: PrismaClient) => async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization as string | undefined;
    if (!authHeader || !/^Bearer [a-f0-9]{64}$/i.test(authHeader)) {
        return res.status(401).json({ error: "Unauthorized: Missing token" });
    }
    const token = authHeader.slice(7);
    const tokenHash = crypto.createHash('sha256').update(token, 'utf8').digest('hex');
    
    const session = await prisma.session.findUnique({
        where: { token: tokenHash },
        include: { user: { select: { id: true, role: true, email: true } } }
    });

    if (!session) {
        return res.status(401).json({ error: "Unauthorized: Invalid or expired token" });
    }
    if (session.expiresAt <= new Date()) {
        // Authentication always fails closed on expiry. Best-effort deletion
        // prevents stale bearer digests from accumulating in the session table.
        try {
            await prisma.session.deleteMany({
                where: { token: tokenHash, expiresAt: { lte: new Date() } },
            });
        } catch (error) {
            logApiFailure(req, error);
        }
        return res.status(401).json({ error: "Unauthorized: Invalid or expired token" });
    }
    if (!['ADMIN', 'INVESTIGATOR'].includes(session.user.role)) {
        return res.status(401).json({ error: "Unauthorized: Invalid or expired token" });
    }

    req.user = { id: session.user.id, role: session.user.role, email: session.user.email };
    req.sessionTokenHash = tokenHash;
    next();
};

const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
    if (req.user?.role !== 'ADMIN') {
        return res.status(403).json({ error: "Forbidden: Admin access required" });
    }
    next();
};

// System metadata & health endpoints (Mandatory Course Verification & Cloud Monitoring)
export const divya23BCE1042_AuthorMetadata = {
    studentName: 'DIVYA',
    registrationNumber: '23BCE1042',
    course: 'BCSE302P - Database Systems Lab',
    slot: 'L25+L26',
    faculty: 'Dr. V. SIVAKUMAR',
    project: 'LAZARUS-X Forensic Relational Database Reconstruction Platform',
};

export function divya23BCE1042_GetSystemBanner(): string {
    return `[LAZARUS-X] Author: DIVYA (23BCE1042) | Slot: L25+L26 | Faculty: Dr. V. SIVAKUMAR`;
}

export function createApp(
    prisma: PrismaClient,
    provenanceMasterKey = parseProvenanceMasterKey(process.env.PROVENANCE_ENCRYPTION_KEY || process.env.PROVENANCE_MASTER_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'),
    options?: { trustProxy?: boolean | number | string },
) {
const app = express();
const trustProxyOption = options?.trustProxy ?? process.env.TRUST_PROXY;
if (trustProxyOption !== undefined) {
    if (trustProxyOption === 'true' || trustProxyOption === true) {
        app.set('trust proxy', true);
    } else if (trustProxyOption === 'false' || trustProxyOption === false) {
        app.set('trust proxy', false);
    } else if (typeof trustProxyOption === 'number' || /^\d+$/.test(String(trustProxyOption))) {
        app.set('trust proxy', Number(trustProxyOption));
    } else {
        app.set('trust proxy', trustProxyOption);
    }
}
const origins = allowedOrigins();
app.disable('x-powered-by');
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', process.env.NODE_ENV === 'production' && process.env.STRICT_FRAME_DENY === 'true' ? 'DENY' : 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'no-referrer');
    if (req.path.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store');
    next();
});
app.use(cors({
    origin(origin, callback) {
        if (!origin || origins.has('*') || origins.has(origin)) return callback(null, true);
        return callback(new Error('CORS origin denied.'));
    },
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type'],
    maxAge: 600,
}));
app.use(express.json({ limit: '1mb', strict: true }));
const publicDir = path.join(__dirname, '..', 'public');
const distDir = path.resolve(__dirname, '../../frontend/dist');
const containerDist = path.resolve(__dirname, '../dist');
const staticRoot = fs.existsSync(path.join(distDir, 'index.html'))
    ? distDir
    : fs.existsSync(path.join(publicDir, 'index.html'))
    ? publicDir
    : containerDist;
app.use(express.static(staticRoot));
const authenticate = requireAuth(prisma);
const activeEngines = new BoundedEngineCache(100);
const provenanceAccumulatorCache = new BoundedProvenanceAccumulatorCache(100);
const caseLocks = new Map<string, Promise<void>>();
const authRateLimit = createRateLimiter({ windowMs: 15 * 60_000, maximum: 10, name: 'auth' });
const writeRateLimit = createRateLimiter({ windowMs: 60_000, maximum: 120, name: 'write' });
const auditExportRateLimit = createRateLimiter({ windowMs: 60_000, maximum: 10, name: 'audit_export' });

async function ensureCaseSalt(caseId: string, ciphertext?: string | null): Promise<Buffer> {
    let protectedSalt = ciphertext;
    if (!protectedSalt) {
        protectedSalt = encryptCaseSalt(crypto.randomBytes(32), provenanceMasterKey);
        await prisma.reconstructionCase.update({ where: { id: caseId }, data: { provenanceSaltCiphertext: protectedSalt } });
    }
    return decryptCaseSalt(protectedSalt, provenanceMasterKey);
}

function buildPublicEnvelopeChain(entries: readonly ProvenanceEntry[], caseSalt: Uint8Array) {
    let previousHash = PUBLIC_ENVELOPE_GENESIS_HASH;
    const envelopes = entries.map(entry => {
        const envelope = appendPublicProvenanceEnvelope(
            entry,
            previousHash,
            deriveEventCommitmentKey(caseSalt, entry.sequence),
        );
        previousHash = envelope.envelopeHash;
        return envelope;
    });
    return { envelopes, headHash: previousHash };
}

// ==========================================
// AUTHENTICATION ROUTES
// ==========================================
app.post('/api/auth/register', authRateLimit, async (req, res) => {
    try {
        const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
        const { email, password } = body;
        if (typeof email !== 'string' || typeof password !== 'string') {
            return res.status(400).json({ error: 'A valid email and password are required.' });
        }
        const normalizedEmail = email.trim().toLowerCase();
        if (normalizedEmail.length > 254 || !EMAIL_PATTERN.test(normalizedEmail) ||
            password.length < 12 || Buffer.byteLength(password, 'utf8') > 72) {
            return res.status(400).json({ error: 'Use a valid email and a password from 12 to 72 UTF-8 bytes.' });
        }
        const existing = await prisma.user.findUnique({ where: { email: normalizedEmail }, select: { id: true } });
        if (existing) return res.status(409).json({ error: 'Email already exists.' });

        const user = await prisma.user.create({
            data: {
                email: normalizedEmail,
                passwordHash: await hashPassword(password),
                role: 'INVESTIGATOR'
            }
        });
        res.status(201).json({ message: "Registration successful", userId: user.id });
    } catch (error) {
        logApiFailure(req, error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

app.post('/api/auth/login', authRateLimit, async (req, res) => {
    try {
        const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
        const { email, password } = body;
        const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
        const user = normalizedEmail.length <= 254
            ? await prisma.user.findUnique({
                where: { email: normalizedEmail },
                select: { id: true, email: true, role: true, passwordHash: true },
            })
            : null;
        if (typeof password !== 'string' || password.length > 4096 ||
            !user || !(await verifyPassword(password, user.passwordHash))) {
            return res.status(401).json({ error: "Invalid credentials" });
        }
        if (!['ADMIN', 'INVESTIGATOR'].includes(user.role)) {
            return res.status(403).json({ error: 'Account role is not authorized.' });
        }

        const token = generateToken();
        const tokenHash = crypto.createHash('sha256').update(token, 'utf8').digest('hex');
        await prisma.$transaction(async tx => {
            await tx.session.create({
                data: {
                    token: tokenHash,
                    userId: user.id,
                    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
                }
            });
            await tx.auditLog.create({
                data: { userId: user.id, action: 'LOGIN' }
            });
        });

        res.json({ token, role: user.role, email: user.email });
    } catch (error) {
        logApiFailure(req, error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

app.post('/api/auth/logout', authenticate, writeRateLimit, async (req, res) => {
    try {
        if (req.sessionTokenHash) await prisma.$transaction(async tx => {
            await tx.session.delete({ where: { token: req.sessionTokenHash } });
            await tx.auditLog.create({ data: { userId: req.user!.id, action: 'LOGOUT' } });
        });
        res.json({ success: true });
    } catch (error) {
        logApiFailure(req, error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// ==========================================
// CORE WORKFLOW API
// ==========================================
async function rehydrateEngine(id: string, prisma: PrismaClient): Promise<LazarusXEngine | null> {
    const dbCase = await prisma.reconstructionCase.findUnique({
        where: { id },
        select: { id: true, provenanceSequence: true, provenanceHead: true },
    });
    if (!dbCase) return null;
    if (!Number.isSafeInteger(dbCase.provenanceSequence) || dbCase.provenanceSequence < 0) {
        throw new Error('Stored provenance head is invalid.');
    }
    const engine = new LazarusXEngine(engineSchema, 20);
    const acceptedFragmentIds = new Set<string>();
    type PendingReplay = {
        batchId?: string;
        actorId: string;
        receivedAt: string;
        expectedSize?: number;
        evidence: Evidence[];
    };
    let pending: PendingReplay | undefined;
    const flushPending = () => {
        if (!pending) return;
        engine.processEvidence(pending.evidence, {
            actorId: pending.actorId,
            receivedAt: new Date(pending.receivedAt),
            ...(pending.batchId ? { batchId: pending.batchId } : { includeBatchMetadata: false }),
        });
        pending = undefined;
    };
    let checkedSequence = 0;
    let chainHead = PROVENANCE_GENESIS_HASH;

    while (checkedSequence < dbCase.provenanceSequence) {
        const rows = await prisma.evidenceProvenanceEntry.findMany({
            where: { caseId: id, sequence: { gt: checkedSequence } },
            orderBy: { sequence: 'asc' },
            take: PROVENANCE_PAGE_SIZE,
        });
        if (rows.length === 0) throw new Error('Stored provenance ledger is incomplete.');
        const entries = rows.map(toProvenanceEntry);
        const check = verifyProvenanceChain(entries, undefined, undefined, checkedSequence, chainHead);
        if (!check.valid) throw new Error('Stored provenance ledger failed verification.');

        const accepted = entries.filter(entry => entry.eventType === 'EVIDENCE_ACCEPTED');
        const fragments = accepted.length === 0 ? [] : await prisma.evidenceFragment.findMany({
            where: { caseId: id, id: { in: accepted.map(entry => entry.fragmentId) } },
        });
        const fragmentsById = new Map(fragments.map(fragment => [fragment.id, fragment]));

        for (const entry of entries) {
            const payload = JSON.parse(entry.payload) as Record<string, unknown>;
            if (entry.eventType === 'EVIDENCE_ACCEPTED') {
                const fragment = fragmentsById.get(entry.fragmentId);
                const valueType = payload.value === null ? 'null' : typeof payload.value;
                if (!fragment || payload.table !== fragment.table || payload.recordId !== fragment.recordId ||
                    payload.field !== fragment.field || String(payload.value) !== fragment.value ||
                    payload.valueType !== valueType || entry.actorId !== fragment.userId ||
                    fragment.timestamp.toISOString() !== entry.receivedAt || entry.relatedFragmentIds.length !== 0) {
                    throw new Error('Stored evidence does not match its provenance entry.');
                }
                if (!['string', 'number', 'boolean', 'null'].includes(valueType) ||
                    (typeof payload.value === 'number' && !Number.isFinite(payload.value))) {
                    throw new Error('Stored evidence payload is invalid.');
                }
                const hasBatchMetadata = payload.batchId !== undefined || payload.batchIndex !== undefined || payload.batchSize !== undefined;
                const evidence: Evidence = {
                    id: entry.fragmentId,
                    table: payload.table as string,
                    recordId: payload.recordId as number,
                    field: payload.field as string,
                    value: payload.value,
                    ...(payload.confidence === undefined ? {} : { confidence: payload.confidence as number }),
                };

                if (hasBatchMetadata) {
                    const batchId = payload.batchId;
                    const batchIndex = payload.batchIndex;
                    const batchSize = payload.batchSize;
                    if (typeof batchId !== 'string' || batchId.length === 0 || batchId.length > 256 ||
                        !Number.isSafeInteger(batchIndex) || !Number.isSafeInteger(batchSize) ||
                        (batchIndex as number) < 0 || (batchSize as number) < 1 || (batchIndex as number) >= (batchSize as number)) {
                        throw new Error('Stored evidence batch metadata is invalid.');
                    }
                    if (!pending || pending.batchId !== batchId) {
                        flushPending();
                        if (batchIndex !== 0) throw new Error('Stored evidence batch is incomplete.');
                        pending = { batchId, actorId: entry.actorId, receivedAt: entry.receivedAt, expectedSize: batchSize as number, evidence: [] };
                    }
                    if (pending.actorId !== entry.actorId || pending.receivedAt !== entry.receivedAt ||
                        pending.expectedSize !== batchSize || pending.evidence.length !== batchIndex) {
                        throw new Error('Stored evidence batch order is invalid.');
                    }
                    pending.evidence.push(evidence);
                    if (pending.evidence.length === pending.expectedSize) flushPending();
                } else {
                    if (pending?.batchId || (pending && (pending.actorId !== entry.actorId || pending.receivedAt !== entry.receivedAt))) {
                        flushPending();
                    }
                    if (!pending) pending = { actorId: entry.actorId, receivedAt: entry.receivedAt, evidence: [] };
                    pending.evidence.push(evidence);
                }
                acceptedFragmentIds.add(entry.fragmentId);
            } else {
                flushPending();
                const sourceIds = payload.sourceFragmentIds;
                const targetIds = payload.targetFragmentIds;
                if (!Array.isArray(sourceIds) || !Array.isArray(targetIds) ||
                    [...sourceIds, ...targetIds].some(fragmentId => typeof fragmentId !== 'string' || !acceptedFragmentIds.has(fragmentId))) {
                    throw new Error('Stored fuzzy provenance references unknown evidence.');
                }
            }
        }
        checkedSequence = check.checkedEntries;
        chainHead = check.headHash;
    }
    flushPending();
    const trailingEntries = await prisma.evidenceProvenanceEntry.findMany({
        where: { caseId: id, sequence: { gt: dbCase.provenanceSequence } },
        take: 1,
    });
    if (trailingEntries.length > 0) throw new Error('Stored provenance ledger extends beyond its case head.');
    const evidenceCount = await prisma.evidenceFragment.count({ where: { caseId: id } });
    if (evidenceCount !== acceptedFragmentIds.size) throw new Error('Stored evidence includes untracked fragments.');
    const finalCheck = verifyProvenanceChain([], dbCase.provenanceHead, dbCase.provenanceSequence, checkedSequence, chainHead);
    const replayedHead = engine.getProvenanceHead();
    if (!finalCheck.valid || replayedHead.sequence !== dbCase.provenanceSequence || replayedHead.hash !== dbCase.provenanceHead) {
        throw new Error('Rehydrated engine does not match the verified provenance head.');
    }
    return engine;
}

const engineSchema: Schema = {
    tables: ['Department', 'Employee', 'Order'],
    constraints: [
        { type: 'UNIQUE', table: 'Department', field: 'id' },
        { type: 'UNIQUE', table: 'Employee', field: 'id' },
        { type: 'UNIQUE', table: 'Order', field: 'id' },
        { type: 'NOT_NULL', table: 'Department', field: 'name' },
        { type: 'NOT_NULL', table: 'Employee', field: 'name' },
        { type: 'FOREIGN_KEY', table: 'Employee', field: 'departmentId', targetTable: 'Department', targetField: 'id' },
        { type: 'FOREIGN_KEY', table: 'Order', field: 'employeeId', targetTable: 'Employee', targetField: 'id' },
    ]
};

function candidateEntropyBits(engine: LazarusXEngine): number {
    const states = engine.states;
    const total = states.reduce((sum, state) => sum + state.probabilityScore, 0);
    if (states.length <= 1 || total <= 0) return 0;
    return states.reduce((entropy, state) => {
        const probability = state.probabilityScore / total;
        return probability > 0 ? entropy - probability * Math.log2(probability) : entropy;
    }, 0);
}

function candidateSummaries(engine: LazarusXEngine) {
    return engine.states.slice(0, 8).map((state, index) => ({
        id: state.id,
        rank: index + 1,
        score: state.probabilityScore,
        fatalViolations: state.fatalViolations,
        resolvableViolations: state.resolvableViolations,
        fuzzyPenalty: state.fuzzyPenalty ?? 0,
        sourceReliabilityPenalty: state.sourceReliabilityPenalty ?? 0,
        isSelected: index === 0,
    }));
}

// Health & system info endpoints
app.get('/api/health', (req, res) => {
    res.json({
        status: 'UP',
        timestamp: new Date().toISOString(),
        engine: 'ONLINE',
        student: divya23BCE1042_AuthorMetadata,
    });
});

app.get('/api/info', (req, res) => {
    res.json({
        name: 'LAZARUS-X: Forensic Relational Database Reconstruction Platform',
        version: '2.0.0',
        metadata: divya23BCE1042_AuthorMetadata,
        features: [
            '11 Normalized Relational Tables (3NF/BCNF)',
            'AC-3 Constraint Satisfaction Propagation',
            'Shannon Entropy Ambiguity Disambiguation',
            'RFC 6962 Verifiable Merkle Tree Ledger',
            'Dynamic Case Search, Status Filtering & Pagination',
            'Full Relational CRUD Operations',
            'Single Users Table RBAC with BCrypt Hashing'
        ],
    });
});

// Prometheus metrics exporter & cloud telemetry
const getPrometheusMetrics = async () => {
    let casesCount = 0;
    let evidenceCount = 0;
    let auditCount = 0;
    let userCount = 0;

    try {
        if (typeof prisma.reconstructionCase?.count === 'function') {
            casesCount = await prisma.reconstructionCase.count().catch(() => 0);
        }
        if (typeof (prisma as any).evidenceFragment?.count === 'function') {
            evidenceCount = await (prisma as any).evidenceFragment.count().catch(() => 0);
        }
        if (typeof prisma.auditLog?.count === 'function') {
            auditCount = await prisma.auditLog.count().catch(() => 0);
        }
        if (typeof prisma.user?.count === 'function') {
            userCount = await prisma.user.count().catch(() => 0);
        }
    } catch {
        // Safe fallback in mock/isolated environments
    }

    const uptime = process.uptime();
    const mem = process.memoryUsage();

    return `# HELP lazarus_student_info Metadata of student author
# TYPE lazarus_student_info gauge
lazarus_student_info{name="DIVYA",regNo="23BCE1042",slot="L25_L26",faculty="Dr_V_SIVAKUMAR"} 1
# HELP lazarus_uptime_seconds Application process uptime in seconds
# TYPE lazarus_uptime_seconds gauge
lazarus_uptime_seconds ${uptime.toFixed(2)}
# HELP lazarus_memory_heap_bytes Node.js heap memory usage in bytes
# TYPE lazarus_memory_heap_bytes gauge
lazarus_memory_heap_bytes ${mem.heapUsed}
# HELP lazarus_cases_total Total number of forensic reconstruction cases
# TYPE lazarus_cases_total gauge
lazarus_cases_total ${casesCount}
# HELP lazarus_evidence_fragments_total Total evidence fragments recorded
# TYPE lazarus_evidence_fragments_total counter
lazarus_evidence_fragments_total ${evidenceCount}
# HELP lazarus_audit_logs_total Total database audit logs
# TYPE lazarus_audit_logs_total counter
lazarus_audit_logs_total ${auditCount}
# HELP lazarus_users_total Total registered users
# TYPE lazarus_users_total gauge
lazarus_users_total ${userCount}
`;
};

app.get('/metrics', async (req, res) => {
    res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.send(await getPrometheusMetrics());
});

app.get('/api/metrics', async (req, res) => {
    if (req.headers.accept?.includes('application/json')) {
        let casesCount = 0, evidenceCount = 0, auditCount = 0, userCount = 0;
        try {
            if (typeof prisma.reconstructionCase?.count === 'function') casesCount = await prisma.reconstructionCase.count().catch(() => 0);
            if (typeof (prisma as any).evidenceFragment?.count === 'function') evidenceCount = await (prisma as any).evidenceFragment.count().catch(() => 0);
            if (typeof prisma.auditLog?.count === 'function') auditCount = await prisma.auditLog.count().catch(() => 0);
            if (typeof prisma.user?.count === 'function') userCount = await prisma.user.count().catch(() => 0);
        } catch {}
        return res.json({
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            cases: casesCount,
            evidenceFragments: evidenceCount,
            auditLogs: auditCount,
            users: userCount,
            student: divya23BCE1042_AuthorMetadata,
        });
    }
    res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.send(await getPrometheusMetrics());
});

// Audit Trail query endpoint (Role-Based Access Control)
app.get('/api/audit-logs', authenticate, async (req, res) => {
    try {
        const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '50'), 10) || 50));
        const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
        const skip = (page - 1) * limit;
        const rawAction = typeof req.query.action === 'string' ? req.query.action.trim().toUpperCase() : undefined;
        const action = rawAction && rawAction !== 'ALL' ? rawAction : undefined;
        const search = typeof req.query.search === 'string' ? req.query.search.trim() : undefined;

        // RBAC: ADMIN sees all audit logs; INVESTIGATOR sees their own actions
        const baseWhere: any = req.user!.role === 'ADMIN' ? {} : { userId: req.user!.id };
        const where: any = {
            ...baseWhere,
            ...(action ? { action } : {}),
            ...(search ? {
                OR: [
                    { action: { contains: search } },
                    { resourceId: { contains: search } },
                    { resourceType: { contains: search } },
                ]
            } : {})
        };

        const total = typeof prisma.auditLog?.count === 'function'
            ? await prisma.auditLog.count({ where }).catch(() => 0)
            : 0;

        const logs = typeof prisma.auditLog?.findMany === 'function'
            ? await prisma.auditLog.findMany({
                where,
                orderBy: { timestamp: 'desc' },
                skip,
                take: limit,
                include: {
                    user: { select: { id: true, email: true, role: true } }
                }
            }).catch(() => [])
            : [];

        const resolvedTotal = total > 0 ? total : logs.length;
        res.json({
            logs,
            pagination: {
                total: resolvedTotal,
                page,
                limit,
                totalPages: Math.max(1, Math.ceil(resolvedTotal / limit))
            }
        });
    } catch (error) {
        logApiFailure(req, error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Admin-Only Database Backup Endpoint (Section 8: Backup & Recovery)
app.post('/api/admin/backup', authenticate, requireAdmin, writeRateLimit, async (req, res) => {
    try {
        const backupDir = path.resolve(__dirname, '..', '..', 'backups');
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFileName = `lazarus_backup_${timestamp}.db`;
        const backupFilePath = path.join(backupDir, backupFileName);

        const dbPath = path.resolve(__dirname, '..', 'prisma', 'dev.db');
        let fileSize = 0;
        if (fs.existsSync(dbPath)) {
            fs.copyFileSync(dbPath, backupFilePath);
            fileSize = fs.statSync(backupFilePath).size;
        }

        if (typeof prisma.auditLog?.create === 'function') {
            await prisma.auditLog.create({
                data: {
                    userId: req.user!.id,
                    action: 'BACKUP_DATABASE',
                    resourceType: 'DATABASE',
                    resourceId: backupFileName
                }
            });
        }

        res.json({
            success: true,
            message: 'Database backup generated successfully via native engine.',
            backup: {
                filename: backupFileName,
                bytes: fileSize,
                timestamp: new Date().toISOString(),
                location: backupFilePath
            }
        });
    } catch (error) {
        logApiFailure(req, error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

app.get('/api/cases', authenticate, async (req, res) => {
    try {
        const baseWhere = req.user!.role === 'ADMIN' ? {} : { ownerId: req.user!.id };
        const rawStatus = typeof req.query.status === 'string' ? req.query.status.trim().toUpperCase() : undefined;
        const status = rawStatus && rawStatus !== 'ALL' ? rawStatus : undefined;
        const search = typeof req.query.search === 'string'
            ? req.query.search.trim()
            : (typeof req.query.q === 'string' ? req.query.q.trim() : undefined);

        const where: any = {
            ...baseWhere,
            ...(status ? { status } : {}),
            ...(search ? {
                OR: [
                    { name: { contains: search } },
                    { id: { contains: search } }
                ]
            } : {})
        };

        const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '20'), 10) || 20));
        const skip = (page - 1) * limit;

        const cases = await prisma.reconstructionCase.findMany({
            where,
            select: { id: true, name: true, status: true, createdAt: true, updatedAt: true, provenanceSequence: true },
            orderBy: { updatedAt: 'desc' },
            skip,
            take: limit,
        });

        const total = typeof (prisma.reconstructionCase as any).count === 'function'
            ? await (prisma.reconstructionCase as any).count({ where })
            : cases.length;

        const totalPages = Math.max(1, Math.ceil(total / limit));

        res.json({
            cases,
            pagination: {
                total,
                page,
                limit,
                totalPages
            },
            total,
            page,
            totalPages,
            limit
        });
    } catch (error) {
        logApiFailure(req, error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

app.post('/api/cases', authenticate, writeRateLimit, async (req, res) => {
    try {
        const engine = new LazarusXEngine(engineSchema, 20);
        const dbCase = await prisma.$transaction(async tx => {
            const created = await tx.reconstructionCase.create({
                data: {
                    currentState: JSON.stringify(engine.getBestState()),
                    ownerId: req.user!.id,
                    provenanceHead: engine.getProvenanceHead().hash,
                    provenanceSequence: engine.getProvenanceHead().sequence,
                    provenanceSaltCiphertext: encryptCaseSalt(crypto.randomBytes(32), provenanceMasterKey),
                },
                select: { id: true, name: true, status: true, createdAt: true, updatedAt: true, provenanceSequence: true },
            });
            await tx.auditLog.create({
                data: { userId: req.user!.id, action: 'CREATE_CASE', resourceType: 'CASE', resourceId: created.id }
            });
            return created;
        });
        activeEngines.set(dbCase.id, engine);

        res.json({
            id: dbCase.id,
            name: dbCase.name,
            status: dbCase.status,
            createdAt: dbCase.createdAt,
            updatedAt: dbCase.updatedAt,
            provenanceSequence: dbCase.provenanceSequence,
            bestState: engine.getBestState(),
            candidates: candidateSummaries(engine),
        });
    } catch (error) {
        logApiFailure(req, error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

app.get('/api/cases/:id', authenticate, async (req, res) => {
    const id = req.params.id as string;
    const release = await acquireCaseLock(caseLocks, id);
    try {
        const dbCase = await prisma.reconstructionCase.findUnique({
            where: { id },
            select: { id: true, name: true, status: true, ownerId: true, provenanceSequence: true, provenanceHead: true },
        });
        if (!dbCase) return res.status(404).json({ error: 'Case not found.' });
        if (dbCase.ownerId !== req.user!.id && req.user!.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Forbidden: Not case owner.' });
        }
        let engine = activeEngines.get(id);
        if (!engine) {
            engine = await rehydrateEngine(id, prisma) as LazarusXEngine;
            if (!engine) return res.status(404).json({ error: 'Case not found.' });
            activeEngines.set(id, engine);
        }
        res.json({
            id: dbCase.id,
            name: dbCase.name,
            status: dbCase.status,
            bestState: engine.getBestState(),
            candidates: candidateSummaries(engine),
            ambiguityReduction: engine.recommendNextEvidence(),
            evidenceRecommendations: engine.rankNextEvidence(5),
            branchingDiagnostics: engine.getBranchingDiagnostics(),
            ambiguity: { entropyBits: candidateEntropyBits(engine), candidateCount: engine.states.length },
            provenance: { sequence: engine.getProvenanceHead().sequence },
            search: engine.getSearchDiagnostics(),
        });
    } catch (error) {
        logApiFailure(req, error);
        res.status(503).json({ error: 'Case state could not be safely restored or loaded.', code: 'CASE_STATE_UNAVAILABLE' });
    } finally {
        release();
    }
});

app.get('/api/cases/:id/candidates/:candidateId', authenticate, async (req, res) => {
    const id = req.params.id as string;
    const candidateId = req.params.candidateId as string;
    const release = await acquireCaseLock(caseLocks, id);
    try {
        const dbCase = await prisma.reconstructionCase.findUnique({
            where: { id },
            select: { id: true, ownerId: true, provenanceSequence: true, provenanceHead: true },
        });
        if (!dbCase) return res.status(404).json({ error: 'Case not found.' });
        if (dbCase.ownerId !== req.user!.id && req.user!.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Forbidden: Not case owner.' });
        }
        let engine = activeEngines.get(id);
        const inMemoryHead = engine?.getProvenanceHead();
        if (!engine || inMemoryHead?.sequence !== dbCase.provenanceSequence || inMemoryHead.hash !== dbCase.provenanceHead) {
            engine = await rehydrateEngine(id, prisma) as LazarusXEngine;
            if (!engine) return res.status(404).json({ error: 'Case not found.' });
            activeEngines.set(id, engine);
        }
        const candidate = engine.states.find(state => state.id === candidateId);
        if (!candidate) return res.status(404).json({ error: 'Candidate state is no longer available.' });
        res.json({ candidate });
    } catch (error) {
        logApiFailure(req, error);
        res.status(503).json({ error: 'Case state could not be safely restored or loaded.', code: 'CASE_STATE_UNAVAILABLE' });
    } finally {
        release();
    }
});

app.post('/api/cases/:id/evidence', authenticate, writeRateLimit, async (req, res) => {
    const id = req.params.id as string;
    const release = await acquireCaseLock(caseLocks, id);
    try {
        if (!Array.isArray(req.body?.evidence)) {
            return res.status(400).json({ error: 'Evidence must be provided as an array', code: 'INVALID_EVIDENCE' });
        }
        if (req.body.evidence.length === 0) {
            return res.status(400).json({ error: 'Evidence array cannot be empty.', code: 'INVALID_EVIDENCE' });
        }
        
        const dbCase = await prisma.reconstructionCase.findUnique({
            where: { id },
            select: { id: true, ownerId: true, provenanceSequence: true, provenanceHead: true, status: true },
        });
        if (!dbCase) return res.status(404).json({ error: "Case not found" });
        if (dbCase.ownerId !== req.user!.id && req.user!.role !== 'ADMIN') {
            return res.status(403).json({ error: "Forbidden: Not case owner" });
        }
        if (dbCase.status === 'SEALED') {
            return res.status(409).json({ error: 'Case is sealed and cryptographically frozen. No further evidence may be committed.', code: 'CASE_SEALED' });
        }

        let engine = activeEngines.get(id);
        const inMemoryHead = engine?.getProvenanceHead();
        if (!engine || inMemoryHead?.sequence !== dbCase.provenanceSequence || inMemoryHead.hash !== dbCase.provenanceHead) {
            engine = await rehydrateEngine(id, prisma) as LazarusXEngine;
            if (!engine) return res.status(404).json({ error: "Case not found" });
            activeEngines.set(id, engine);
        }

        const evidenceArray: Evidence[] = req.body.evidence.map((item: unknown) => {
            if (!item || typeof item !== 'object' || Array.isArray(item)) {
                throw new EvidenceValidationError('Each evidence item must be an object.');
            }
            const raw = item as Record<string, unknown>;
            return {
                id: crypto.randomUUID(), // Server-issued immutable fragment identity.
                table: raw.table as string,
                recordId: raw.recordId as number,
                field: raw.field as string,
                value: raw.value,
                ...(raw.confidence === undefined ? {} : { confidence: raw.confidence as number }),
            };
        });

        // Process a fork so the in-memory engine changes only after the durable
        // evidence, ledger, and case-head transaction has committed.
        const nextEngine = engine.fork();
        const entropyBeforeBits = candidateEntropyBits(engine);
        const candidateCountBefore = engine.states.length;
        const receivedAt = new Date();
        const previousHeadHash = engine.getProvenanceHead().hash;
        const previousSequence = nextEngine.getProvenanceHead().sequence;
        nextEngine.processEvidence(evidenceArray, { actorId: req.user!.id, receivedAt });
        const newEntries = nextEngine.getProvenanceEntriesSince(previousSequence);
        const head = nextEngine.getProvenanceHead();

        await prisma.$transaction(async (tx) => {
            for (const ev of evidenceArray) {
                await tx.evidenceFragment.create({
                    data: {
                        id: ev.id,
                        caseId: id,
                        table: ev.table,
                        recordId: ev.recordId,
                        field: ev.field,
                        value: String(ev.value),
                        userId: req.user!.id,
                        timestamp: receivedAt,
                    }
                });
            }
            for (const entry of newEntries) {
                await tx.evidenceProvenanceEntry.create({
                    data: {
                        caseId: id,
                        sequence: entry.sequence,
                        eventType: entry.eventType,
                        fragmentId: entry.fragmentId,
                        relatedFragmentIds: JSON.stringify(entry.relatedFragmentIds),
                        actorId: entry.actorId,
                        receivedAt: new Date(entry.receivedAt),
                        payload: entry.payload,
                        previousHash: entry.previousHash,
                        hash: entry.hash,
                    }
                });
            }
            const storedCase = await tx.reconstructionCase.findUnique({
                where: { id },
                select: { provenanceSequence: true, provenanceHead: true },
            });
            if (!storedCase || storedCase.provenanceSequence !== previousSequence ||
                storedCase.provenanceHead !== previousHeadHash) {
                throw new Error('Concurrent evidence update detected.');
            }
            await tx.reconstructionCase.update({
                where: { id },
                data: {
                    currentState: JSON.stringify(nextEngine.getBestState()),
                    provenanceHead: head.hash,
                    provenanceSequence: head.sequence,
                }
            });
        });
        engine = nextEngine;
        activeEngines.set(id, engine);
        provenanceAccumulatorCache.delete(id);
        
        res.json({
            bestState: engine.getBestState(),
            ambiguityReduction: engine.recommendNextEvidence(),
            evidenceRecommendations: engine.rankNextEvidence(5),
            branchingDiagnostics: engine.getBranchingDiagnostics(),
            ambiguity: {
                entropyBeforeBits,
                entropyAfterBits: candidateEntropyBits(engine),
                reductionBits: entropyBeforeBits - candidateEntropyBits(engine),
                candidateCountBefore,
                candidateCountAfter: engine.states.length,
            },
            candidates: candidateSummaries(engine),
            search: {
                candidateCoverage: 'exhaustive_over_propagated_domains',
                candidateCount: engine.states.length,
                maxMaterializedStates: engine.maxMaterializedStates,
                maxMaterializedUnits: engine.maxMaterializedUnits,
                maxEvidencePerBatch: engine.maxEvidencePerBatch,
                maxPropagationRevisions: engine.maxPropagationRevisions,
                maxFuzzyComparisons: engine.maxFuzzyComparisons,
                maxEditDistance: engine.maxEditDistance,
                maxProvenanceEntries: engine.maxProvenanceEntries,
                maxProvenanceBytes: engine.maxProvenanceBytes,
                propagation: engine.getSearchDiagnostics(),
            },
            provenance: { sequence: head.sequence, appendedEvents: newEntries.length },
        });
    } catch (error) {
        if (error instanceof EvidenceValidationError) return res.status(400).json({ error: error.message, code: error.code });
        if (error instanceof SearchSpaceLimitError) return res.status(422).json({ error: error.message, code: error.code });
        const databaseCode = typeof error === 'object' && error !== null && 'code' in error
            ? (error as { code?: unknown }).code
            : undefined;
        if ((error instanceof Error && error.message === 'Concurrent evidence update detected.') ||
            ['P2002', 'P2025', 'P2034'].includes(String(databaseCode))) {
            return res.status(409).json({ error: 'The case changed concurrently. Reload and retry.', code: 'CASE_CONFLICT' });
        }
        logApiFailure(req, error);
        res.status(500).json({ error: 'Internal server error.' });
    } finally {
        release();
    }
});

app.get('/api/cases/:id/provenance', authenticate, async (req, res) => {
    const id = req.params.id as string;
    const release = await acquireCaseLock(caseLocks, id);
    try {
        const dbCase = await prisma.reconstructionCase.findUnique({
            where: { id },
            select: { id: true, ownerId: true, provenanceSequence: true, provenanceHead: true, provenanceSaltCiphertext: true },
        });
        if (!dbCase) return res.status(404).json({ error: 'Case not found' });
        if (dbCase.ownerId !== req.user!.id && req.user!.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Forbidden: Not case owner' });
        }
        const caseSalt = await ensureCaseSalt(id, dbCase.provenanceSaltCiphertext);
        const rawAfterSequence = req.query.afterSequence ?? '0';
        const rawPageSize = req.query.limit ?? '100';
        const view = req.query.view ?? 'commitments';
        const afterSequence = Number(rawAfterSequence);
        const pageSize = Number(rawPageSize);
        if (!Number.isSafeInteger(afterSequence) || afterSequence < 0 ||
            afterSequence > dbCase.provenanceSequence || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 500 ||
            (view !== 'commitments' && view !== 'full')) {
            return res.status(400).json({ error: 'Use a valid afterSequence, limit from 1 through 500, and view of commitments or full.' });
        }

        // Verify the full chain in bounded pages so a large case cannot create
        // an unbounded in-memory response or verification array.
        let checkedEntries = 0;
        let chainHead = PROVENANCE_GENESIS_HASH;
        let publicEnvelopeHead = PUBLIC_ENVELOPE_GENESIS_HASH;
        let publicEnvelopeAtCursor = afterSequence === 0 ? PUBLIC_ENVELOPE_GENESIS_HASH : undefined;
        let verificationError: string | undefined;
        const acceptedFragmentIds = new Set<string>();
        const verificationPageSize = 500;
        while (checkedEntries < dbCase.provenanceSequence) {
            const batch = await prisma.evidenceProvenanceEntry.findMany({
                where: { caseId: id, sequence: { gt: checkedEntries } },
                orderBy: { sequence: 'asc' },
                take: verificationPageSize,
            });
            if (batch.length === 0) break;
            const entries = batch.map(toProvenanceEntry);
            const verification = verifyProvenanceChain(
                entries, undefined, undefined, checkedEntries, chainHead
            );
            checkedEntries = verification.checkedEntries;
            chainHead = verification.headHash;
            if (!verification.valid) { verificationError = verification.error; break; }

            for (const entry of entries) {
                const eventKey = deriveEventCommitmentKey(caseSalt, entry.sequence);
                publicEnvelopeHead = appendPublicProvenanceEnvelope(entry, publicEnvelopeHead, eventKey).envelopeHash;
                if (entry.sequence === afterSequence) publicEnvelopeAtCursor = publicEnvelopeHead;
            }

            const acceptedEntries = entries.filter(entry => entry.eventType === 'EVIDENCE_ACCEPTED');
            const fragments = acceptedEntries.length === 0 ? [] : await prisma.evidenceFragment.findMany({
                where: { caseId: id, id: { in: acceptedEntries.map(entry => entry.fragmentId) } },
            });
            const fragmentsById = new Map(fragments.map(fragment => [fragment.id, fragment]));
            for (const entry of entries) {
                try {
                    const payload = JSON.parse(entry.payload) as Record<string, unknown>;
                    if (entry.eventType === 'EVIDENCE_ACCEPTED') {
                        const fragment = fragmentsById.get(entry.fragmentId);
                        const expectedType = payload.value === null ? 'null' : typeof payload.value;
                        if (!fragment || payload.table !== fragment.table || payload.recordId !== fragment.recordId ||
                            payload.field !== fragment.field || String(payload.value) !== fragment.value ||
                            payload.valueType !== expectedType || entry.actorId !== fragment.userId ||
                            fragment.timestamp.toISOString() !== entry.receivedAt || entry.relatedFragmentIds.length !== 0) {
                            verificationError = `Evidence fragment ${entry.fragmentId} does not match its ledger entry.`;
                            break;
                        }
                        acceptedFragmentIds.add(entry.fragmentId);
                    } else {
                        const sourceIds = payload.sourceFragmentIds;
                        const targetIds = payload.targetFragmentIds;
                        if (!Array.isArray(sourceIds) || !Array.isArray(targetIds) ||
                            [...sourceIds, ...targetIds].some(fragmentId => typeof fragmentId !== 'string' || !acceptedFragmentIds.has(fragmentId))) {
                            verificationError = `Fuzzy correction at sequence ${entry.sequence} references an unknown fragment.`;
                            break;
                        }
                        const sourceStringIds = sourceIds as string[];
                        const targetStringIds = targetIds as string[];
                        const references = [...new Set([...sourceStringIds, ...targetStringIds])].sort();
                        if (entry.actorId !== 'system:lazarus-x' || entry.fragmentId !== sourceStringIds[0] ||
                            references.length !== entry.relatedFragmentIds.length ||
                            references.some((fragmentId, index) => fragmentId !== entry.relatedFragmentIds[index])) {
                            verificationError = `Fuzzy correction at sequence ${entry.sequence} has inconsistent fragment links.`;
                            break;
                        }
                    }
                } catch {
                    verificationError = `Invalid ledger payload at sequence ${entry.sequence}.`;
                    break;
                }
            }
            if (verificationError) break;
        }
        const extraEntries = await prisma.evidenceProvenanceEntry.findMany({
            where: { caseId: id, sequence: { gt: dbCase.provenanceSequence } },
            take: 1,
        });
        let verification = verifyProvenanceChain(
            [], dbCase.provenanceHead, dbCase.provenanceSequence, checkedEntries, chainHead
        );
        if (verificationError) verification = { ...verification, valid: false, error: verificationError };
        if (extraEntries.length > 0) verification = { ...verification, valid: false, error: 'Ledger has entries beyond the stored case head.' };
        const evidenceFragmentCount = await prisma.evidenceFragment.count({ where: { caseId: id } });
        const untrackedEvidenceFragments = Math.max(0, evidenceFragmentCount - acceptedFragmentIds.size);
        if (untrackedEvidenceFragments > 0) {
            verification = { ...verification, valid: false, error: 'Evidence fragments exist without provenance entries.' };
        }

        const page = await prisma.evidenceProvenanceEntry.findMany({
            where: { caseId: id, sequence: { gt: afterSequence } },
            orderBy: { sequence: 'asc' },
            take: pageSize,
        });
        const pageEntries = page.map(toProvenanceEntry);
        let pageEnvelopeHead = publicEnvelopeAtCursor ?? PUBLIC_ENVELOPE_GENESIS_HASH;
        const publicEnvelopeEntries = pageEntries.map(entry => {
            const eventKey = deriveEventCommitmentKey(caseSalt, entry.sequence);
            const envelope = appendPublicProvenanceEnvelope(entry, pageEnvelopeHead, eventKey);
            pageEnvelopeHead = envelope.envelopeHash;
            return envelope;
        });
        res.json({
            valid: verification.valid,
            checkedEntries: verification.checkedEntries,
            error: verification.error,
            view,
            publicEnvelope: view === 'commitments' ? {
                algorithm: 'HMAC-SHA-256 commitments + SHA-256 envelope chain',
                version: 2,
                genesisHash: PUBLIC_ENVELOPE_GENESIS_HASH,
                headHash: publicEnvelopeHead,
                pagePreviousHash: publicEnvelopeAtCursor,
                pageHeadHash: pageEnvelopeHead,
                headSequence: dbCase.provenanceSequence,
                zeroKnowledgeProof: false,
                note: 'Event fields use keyed commitments derived from an encrypted case key and event sequence. This envelope is not a zero-knowledge proof. An owner can selectively disclose one event with its event-scoped verification salt; retain its head independently to detect rewrites.',
            } : undefined,
            totalEntries: dbCase.provenanceSequence,
            trackedEvidenceFragments: acceptedFragmentIds.size,
            untrackedEvidenceFragments,
            nextAfterSequence: page.length === pageSize ? page[page.length - 1].sequence : null,
            entries: view === 'commitments' ? publicEnvelopeEntries : pageEntries,
        });
    } catch (error) {
        logApiFailure(req, error);
        res.status(500).json({ error: 'Internal server error.' });
    } finally {
        release();
    }
});

app.get('/api/cases/:id/provenance/claims/:sequence', authenticate, async (req, res) => {
    const id = req.params.id as string;
    const release = await acquireCaseLock(caseLocks, id);
    try {
        const dbCase = await prisma.reconstructionCase.findUnique({
            where: { id },
            select: { id: true, ownerId: true, provenanceSequence: true, provenanceHead: true, provenanceSaltCiphertext: true },
        });
        if (!dbCase) return res.status(404).json({ error: 'Case not found.' });
        if (dbCase.ownerId !== req.user!.id && req.user!.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Forbidden: Not case owner.' });
        }
        const sequence = Number(req.params.sequence);
        if (!Number.isSafeInteger(sequence) || sequence < 1 || sequence > dbCase.provenanceSequence) {
            return res.status(400).json({ error: 'A valid event sequence is required.' });
        }
        const caseSalt = await ensureCaseSalt(id, dbCase.provenanceSaltCiphertext);
        let checkedSequence = 0;
        let ledgerHead = PROVENANCE_GENESIS_HASH;
        let envelopeHead = PUBLIC_ENVELOPE_GENESIS_HASH;
        let disclosedEntry: ProvenanceEntry | undefined;
        let disclosedEnvelope: ReturnType<typeof appendPublicProvenanceEnvelope> | undefined;

        while (checkedSequence < dbCase.provenanceSequence) {
            const rows = await prisma.evidenceProvenanceEntry.findMany({
                where: { caseId: id, sequence: { gt: checkedSequence } },
                orderBy: { sequence: 'asc' },
                take: PROVENANCE_PAGE_SIZE,
            });
            if (rows.length === 0) break;
            const entries = rows.map(toProvenanceEntry);
            const verification = verifyProvenanceChain(entries, undefined, undefined, checkedSequence, ledgerHead);
            if (!verification.valid) return res.status(409).json({ error: 'The ledger cannot support a verified selective disclosure.' });
            checkedSequence = verification.checkedEntries;
            ledgerHead = verification.headHash;
            for (const entry of entries) {
                const eventKey = deriveEventCommitmentKey(caseSalt, entry.sequence);
                const envelope = appendPublicProvenanceEnvelope(entry, envelopeHead, eventKey);
                envelopeHead = envelope.envelopeHash;
                if (entry.sequence === sequence) {
                    disclosedEntry = entry;
                    disclosedEnvelope = envelope;
                }
            }
        }
        const extraEntries = await prisma.evidenceProvenanceEntry.findMany({
            where: { caseId: id, sequence: { gt: dbCase.provenanceSequence } },
            take: 1,
        });
        if (extraEntries.length > 0) {
            return res.status(409).json({ error: 'The case ledger contains entries beyond the recorded case sequence.' });
        }
        const finalCheck = verifyProvenanceChain(
            [], dbCase.provenanceHead, dbCase.provenanceSequence, checkedSequence, ledgerHead
        );
        if (!finalCheck.valid || !disclosedEntry || !disclosedEnvelope) {
            return res.status(409).json({ error: 'The case ledger is incomplete or does not match its stored head.' });
        }
        if (disclosedEntry.eventType === 'EVIDENCE_ACCEPTED') {
            const fragment = await prisma.evidenceFragment.findUnique({
                where: { id: disclosedEntry.fragmentId },
            });
            const payload = JSON.parse(disclosedEntry.payload) as Record<string, unknown>;
            const expectedType = payload.value === null ? 'null' : typeof payload.value;
            if (!fragment || fragment.caseId !== id || payload.table !== fragment.table ||
                payload.recordId !== fragment.recordId || payload.field !== fragment.field ||
                String(payload.value) !== fragment.value || payload.valueType !== expectedType ||
                disclosedEntry.actorId !== fragment.userId ||
                fragment.timestamp.toISOString() !== disclosedEntry.receivedAt) {
                return res.status(409).json({ error: 'Evidence fragment record does not match its ledger entry.' });
            }
        }
        const eventKey = deriveEventCommitmentKey(caseSalt, sequence);
        res.json({
            disclosure: createProvenanceDisclosure(disclosedEntry, eventKey),
            envelope: disclosedEnvelope,
            publicEnvelopeHead: envelopeHead,
            note: 'This event-scoped disclosure verifies only the selected event commitments. Share it only when the event contents are intended for disclosure.',
        });
    } catch (error) {
        logApiFailure(req, error);
        res.status(500).json({ error: 'Internal server error.' });
    } finally {
        release();
    }
});


app.get('/api/cases/:id/provenance/proofs/:sequence', authenticate, auditExportRateLimit, async (req, res) => {
    const id = req.params.id as string;
    const release = await acquireCaseLock(caseLocks, id);
    try {
        const dbCase = await prisma.reconstructionCase.findUnique({
            where: { id },
            select: { id: true, ownerId: true, provenanceSequence: true, provenanceHead: true, provenanceSaltCiphertext: true },
        });
        if (!dbCase) return res.status(404).json({ error: 'Case not found.' });
        if (dbCase.ownerId !== req.user!.id && req.user!.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Forbidden: Not case owner.' });
        }
        const sequence = Number(req.params.sequence);
        if (!Number.isSafeInteger(sequence) || sequence < 1 || sequence > dbCase.provenanceSequence) {
            return res.status(400).json({ error: 'A valid event sequence is required.' });
        }

        let cached = provenanceAccumulatorCache.get(id);
        if (!cached || cached.sequence !== dbCase.provenanceSequence || cached.headHash !== dbCase.provenanceHead) {
            const engine = await rehydrateEngine(id, prisma);
            if (!engine) return res.status(404).json({ error: 'Case not found.' });
            const head = engine.getProvenanceHead();
            if (head.sequence !== dbCase.provenanceSequence || head.hash !== dbCase.provenanceHead) {
                return res.status(409).json({ error: 'The case ledger does not match its stored head.' });
            }
            const caseSalt = await ensureCaseSalt(id, dbCase.provenanceSaltCiphertext);
            const { envelopes, headHash } = buildPublicEnvelopeChain(engine.getProvenanceEntries(), caseSalt);
            if (envelopes.length !== dbCase.provenanceSequence) {
                return res.status(409).json({ error: 'The case ledger is incomplete.' });
            }
            const merkleTree = buildEnvelopeMerkleTree(envelopes);
            const checkpoint = createProvenanceCheckpointManifest({
                caseId: id,
                sequence: dbCase.provenanceSequence,
                ledgerHead: dbCase.provenanceHead,
                publicEnvelopeHead: headHash,
                publicEnvelopeMerkleRoot: merkleTree.rootHash,
                cumulativeEventCount: dbCase.provenanceSequence,
            });
            cached = {
                caseId: id,
                sequence: dbCase.provenanceSequence,
                headHash: dbCase.provenanceHead,
                publicEnvelopeHead: headHash,
                envelopes,
                merkleTree,
                checkpoint,
            };
            provenanceAccumulatorCache.set(id, cached);
        }

        const envelope = cached.envelopes[sequence - 1];
        const proof = generateProofFromMerkleTree(cached.merkleTree, sequence);
        res.json({
            caseId: id,
            envelope,
            proof,
            checkpoint: cached.checkpoint,
            note: 'Verify the event inclusion against checkpoint.publicEnvelopeMerkleRoot. Verification and proof generation are O(log N) using the pre-indexed Merkle accumulator tree. Retain checkpoint.manifestDigest externally to authenticate this checkpoint against later rewrites.',
        });
    } catch (error) {
        logApiFailure(req, error);
        res.status(500).json({ error: 'Internal server error.' });
    } finally {
        release();
    }
});

app.get('/api/cases/:id/export/audit-bundle', authenticate, auditExportRateLimit, async (req, res) => {
    const id = req.params.id as string;
    const release = await acquireCaseLock(caseLocks, id);
    try {
        const dbCase = await prisma.reconstructionCase.findUnique({
            where: { id },
            select: { id: true, ownerId: true, provenanceSequence: true, provenanceHead: true, provenanceSaltCiphertext: true },
        });
        if (!dbCase) return res.status(404).json({ error: 'Case not found.' });
        if (dbCase.ownerId !== req.user!.id && req.user!.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Forbidden: Not case owner.' });
        }
        const engine = await rehydrateEngine(id, prisma);
        if (!engine) return res.status(404).json({ error: 'Case not found.' });
        const head = engine.getProvenanceHead();
        if (head.sequence !== dbCase.provenanceSequence || head.hash !== dbCase.provenanceHead) {
            return res.status(409).json({ error: 'The case ledger does not match its stored head.' });
        }
        const caseSalt = await ensureCaseSalt(id, dbCase.provenanceSaltCiphertext);
        const { envelopes, headHash } = buildPublicEnvelopeChain(engine.getProvenanceEntries(), caseSalt);
        if (envelopes.length !== dbCase.provenanceSequence) {
            return res.status(409).json({ error: 'The case ledger is incomplete.' });
        }
        const checkpoint = createProvenanceCheckpointManifest({
            caseId: id,
            sequence: dbCase.provenanceSequence,
            ledgerHead: dbCase.provenanceHead,
            publicEnvelopeHead: headHash,
            publicEnvelopeMerkleRoot: computeEnvelopeMerkleRoot(envelopes),
            cumulativeEventCount: dbCase.provenanceSequence,
        });
        const candidates = engine.states.slice(0, 20).map((state, index) => ({
            rank: index + 1,
            id: state.id,
            probabilityScore: state.probabilityScore,
            globalViolations: state.globalViolations,
            fatalViolations: state.fatalViolations,
            resolvableViolations: state.resolvableViolations,
            fuzzyPenalty: state.fuzzyPenalty ?? 0,
            sourceReliabilityPenalty: state.sourceReliabilityPenalty ?? 0,
            data: state.data,
            fuzzyCorrections: state.fuzzyCorrections ?? [],
            fuzzyDomains: state.fuzzyDomains ?? [],
        }));
        const maxBundleBytes = 64 * 1024 * 1024;
        let estimatedBytes = Buffer.byteLength(JSON.stringify({
            schema: { tables: engineSchema.tables, constraints: engineSchema.constraints },
            candidateSnapshot: { totalCandidates: engine.states.length, truncated: engine.states.length > candidates.length },
            checkpoint,
        }), 'utf8') + Buffer.byteLength(OFFLINE_AUDIT_VERIFIER_SOURCE, 'utf8') + 256 * 1024;
        for (const candidate of candidates) estimatedBytes += Buffer.byteLength(JSON.stringify(candidate), 'utf8') + 1;
        for (const envelope of envelopes) {
            estimatedBytes += Buffer.byteLength(JSON.stringify(envelope), 'utf8') + 1;
            if (estimatedBytes > maxBundleBytes) {
                return res.status(413).json({ error: 'Audit bundle exceeds the 64 MiB export limit. Export a smaller case or use paged provenance verification.' });
            }
        }
        if (estimatedBytes > maxBundleBytes) {
            return res.status(413).json({ error: 'Audit bundle exceeds the 64 MiB export limit. Export a smaller case or use paged provenance verification.' });
        }
        const bundle = createOfflineAuditBundle({
            caseId: id,
            generatedAt: new Date().toISOString(),
            schema: { tables: [...engineSchema.tables], constraints: engineSchema.constraints },
            candidateSnapshot: {
                totalCandidates: engine.states.length,
                truncated: engine.states.length > candidates.length,
                candidates,
            },
            publicEnvelopes: envelopes,
            checkpoint,
        });
        const serialized = JSON.stringify(bundle);
        if (Buffer.byteLength(serialized, 'utf8') > maxBundleBytes) {
            return res.status(413).json({ error: 'Audit bundle exceeds the 64 MiB export limit. Export a smaller case or use paged provenance verification.' });
        }
        res.type('application/vnd.lazarus-x.audit-bundle.v1+json').setHeader('Content-Disposition', `attachment; filename="lazarus-x-${id}-audit-bundle.json"`);
        res.send(serialized);
    } catch (error) {
        logApiFailure(req, error);
        res.status(500).json({ error: 'Internal server error.' });
    } finally {
        release();
    }
});

app.get('/api/cases/:id/provenance/checkpoint', authenticate, async (req, res) => {
    const id = req.params.id as string;
    const release = await acquireCaseLock(caseLocks, id);
    try {
        const dbCase = await prisma.reconstructionCase.findUnique({
            where: { id },
            select: { id: true, ownerId: true, provenanceSequence: true, provenanceHead: true, provenanceSaltCiphertext: true },
        });
        if (!dbCase) return res.status(404).json({ error: 'Case not found.' });
        if (dbCase.ownerId !== req.user!.id && req.user!.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Forbidden: Not case owner.' });
        }
        const caseSalt = await ensureCaseSalt(id, dbCase.provenanceSaltCiphertext);
        let checkedSequence = 0;
        let ledgerHead = PROVENANCE_GENESIS_HASH;
        let envelopeHead = PUBLIC_ENVELOPE_GENESIS_HASH;
        const publicEnvelopes: ReturnType<typeof appendPublicProvenanceEnvelope>[] = [];

        while (checkedSequence < dbCase.provenanceSequence) {
            const rows = await prisma.evidenceProvenanceEntry.findMany({
                where: { caseId: id, sequence: { gt: checkedSequence } },
                orderBy: { sequence: 'asc' },
                take: PROVENANCE_PAGE_SIZE,
            });
            if (rows.length === 0) break;
            const entries = rows.map(toProvenanceEntry);
            const verification = verifyProvenanceChain(entries, undefined, undefined, checkedSequence, ledgerHead);
            if (!verification.valid) return res.status(409).json({ error: 'The ledger cannot support a verified checkpoint.' });
            checkedSequence = verification.checkedEntries;
            ledgerHead = verification.headHash;
            for (const entry of entries) {
                const eventKey = deriveEventCommitmentKey(caseSalt, entry.sequence);
                const envelope = appendPublicProvenanceEnvelope(entry, envelopeHead, eventKey);
                envelopeHead = envelope.envelopeHash;
                publicEnvelopes.push(envelope);
            }
        }
        const extraEntries = await prisma.evidenceProvenanceEntry.findMany({
            where: { caseId: id, sequence: { gt: dbCase.provenanceSequence } },
            take: 1,
        });
        if (extraEntries.length > 0) {
            return res.status(409).json({ error: 'The case ledger contains entries beyond the recorded case sequence.' });
        }
        const finalCheck = verifyProvenanceChain(
            [], dbCase.provenanceHead, dbCase.provenanceSequence, checkedSequence, ledgerHead
        );
        if (!finalCheck.valid) {
            return res.status(409).json({ error: 'The case ledger is incomplete or does not match its stored head.' });
        }

        const checkpoint = createProvenanceCheckpointManifest({
            caseId: id,
            sequence: dbCase.provenanceSequence,
            ledgerHead: dbCase.provenanceHead,
            publicEnvelopeHead: envelopeHead,
            publicEnvelopeMerkleRoot: computeEnvelopeMerkleRoot(publicEnvelopes),
            cumulativeEventCount: dbCase.provenanceSequence,
        });

        res.json(checkpoint);
    } catch (error) {
        logApiFailure(req, error);
        res.status(500).json({ error: 'Internal server error.' });
    } finally {
        release();
    }
});

app.post('/api/cases/:id/seal', authenticate, writeRateLimit, async (req, res) => {
    const id = req.params.id as string;
    const release = await acquireCaseLock(caseLocks, id);
    try {
        const dbCase = await prisma.reconstructionCase.findUnique({
            where: { id },
            select: { id: true, ownerId: true, status: true, provenanceSequence: true, provenanceHead: true, provenanceSaltCiphertext: true },
        });
        if (!dbCase) return res.status(404).json({ error: 'Case not found.' });
        if (dbCase.ownerId !== req.user!.id && req.user!.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Forbidden: Not case owner.' });
        }
        if (dbCase.status === 'SEALED') {
            return res.status(409).json({ error: 'Case is already sealed.', code: 'CASE_ALREADY_SEALED' });
        }

        const engine = await rehydrateEngine(id, prisma);
        if (!engine) return res.status(404).json({ error: 'Case not found.' });

        const caseSalt = await ensureCaseSalt(id, dbCase.provenanceSaltCiphertext);
        const { envelopes, headHash } = buildPublicEnvelopeChain(engine.getProvenanceEntries(), caseSalt);

        const checkpoint = createProvenanceCheckpointManifest({
            caseId: id,
            sequence: dbCase.provenanceSequence,
            ledgerHead: dbCase.provenanceHead,
            publicEnvelopeHead: headHash,
            publicEnvelopeMerkleRoot: computeEnvelopeMerkleRoot(envelopes),
            cumulativeEventCount: dbCase.provenanceSequence,
        });

        await prisma.$transaction(async tx => {
            await tx.reconstructionCase.update({
                where: { id },
                data: { status: 'SEALED' },
            });
            await tx.auditLog.create({
                data: {
                    userId: req.user!.id,
                    action: 'SEAL_CASE',
                    resourceType: 'CASE',
                    resourceId: id,
                },
            });
        });

        res.json({
            success: true,
            status: 'SEALED',
            caseId: id,
            sealedAt: checkpoint.timestamp,
            checkpoint,
        });
    } catch (error) {
        logApiFailure(req, error);
        res.status(500).json({ error: 'Internal server error.' });
    } finally {
        release();
    }
});

app.patch('/api/cases/:id', authenticate, writeRateLimit, async (req, res) => {
    const id = req.params.id as string;
    const { name } = req.body || {};
    if (typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'Case name must be a non-empty string.' });
    }
    const release = await acquireCaseLock(caseLocks, id);
    try {
        const dbCase = await prisma.reconstructionCase.findUnique({
            where: { id },
            select: { id: true, ownerId: true, status: true }
        });
        if (!dbCase) return res.status(404).json({ error: 'Case not found.' });
        if (dbCase.ownerId !== req.user!.id && req.user!.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Forbidden: Only case owner or Administrator can rename this case.' });
        }
        if (dbCase.status === 'SEALED') {
            return res.status(409).json({ error: 'Cannot rename a sealed case; ledger custody is frozen.' });
        }
        const updated = await prisma.reconstructionCase.update({
            where: { id },
            data: { name: name.trim().slice(0, 100) },
            select: { id: true, name: true, status: true, updatedAt: true }
        });
        await prisma.auditLog.create({
            data: { userId: req.user!.id, action: 'RENAME_CASE', resourceType: 'CASE', resourceId: id }
        });
        res.json({ success: true, case: updated });
    } catch (error) {
        logApiFailure(req, error);
        res.status(500).json({ error: 'Internal server error.' });
    } finally {
        release();
    }
});

app.delete('/api/cases/:id', authenticate, requireAdmin, writeRateLimit, async (req, res) => {
    const id = req.params.id as string;
    const release = await acquireCaseLock(caseLocks, id);
    try {
        await prisma.$transaction(async tx => {
            await tx.reconstructionCase.delete({ where: { id } });
            await tx.auditLog.create({ data: { userId: req.user!.id, action: 'DELETE_CASE', resourceType: 'CASE', resourceId: id } });
        });
        activeEngines.delete(id);
        provenanceAccumulatorCache.delete(id);
        res.json({ success: true, message: `Case ${id} and all associated evidence records purged.` });
    } catch (error) {
        logApiFailure(req, error);
        res.status(500).json({ error: 'Internal server error.' });
    } finally {
        release();
    }
});

// SPA Fallback: Serve index.html for non-API client routes
app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
    const indexHtml = path.join(staticRoot, 'index.html');
    if (fs.existsSync(indexHtml)) {
        return res.sendFile(indexHtml);
    }
    next();
});

app.use((error: unknown, req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) return next(error);
    const candidate = error as { status?: unknown; type?: unknown; message?: unknown };
    const status = candidate.type === 'entity.too.large' ? 413
        : candidate.type === 'entity.parse.failed' ? 400
        : candidate.message === 'CORS origin denied.' ? 403
        : typeof candidate.status === 'number' && candidate.status >= 400 && candidate.status < 500 ? candidate.status
        : 500;
    if (status >= 500) logApiFailure(req, error);
    const message = status === 413 ? 'Request body is too large.'
        : status === 400 ? 'Request body is invalid JSON.'
        : status === 403 ? 'Origin is not allowed.'
        : 'Internal server error.';
    res.status(status).json({ error: message, ...(status === 413 ? { code: 'PAYLOAD_TOO_LARGE' } : {}) });
});

return app;
}

if (require.main === module) {
    const { createConfiguredPrismaClient } = require('./database') as typeof import('./database');
    const prisma = createConfiguredPrismaClient();
    const app = createApp(prisma);
    const PORT = process.env.PORT || 3000;
    const server = app.listen(PORT, () => {
        console.log(divya23BCE1042_GetSystemBanner());
        console.log(`LAZARUS-X Core Engine listening on port ${PORT}`);
    });
    server.on('error', (error: Error) => {
        console.error(JSON.stringify({ event: 'server_listen_error', errorName: error.name }));
        void prisma.$disconnect().finally(() => { process.exitCode = 1; });
    });
    let shuttingDown = false;
    const shutdown = () => {
        if (shuttingDown) return;
        shuttingDown = true;
        server.close(() => {
            void prisma.$disconnect().finally(() => { process.exitCode = 0; });
        });
    };
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
}
