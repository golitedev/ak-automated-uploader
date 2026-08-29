import { realpath, stat } from 'node:fs/promises';
import { basename, posix } from 'node:path';
import { env } from 'node:process';
import { getConfigRoot } from './util/app-data-path';
import { log } from './util/log';

export const VIRTUAL_MEDIA_ROOT = '__ak_media_root__';

const PROTECTED_ROOTS = [
    '/',
    '/app',
    '/bin',
    '/config',
    '/dev',
    '/etc',
    '/home',
    '/lib',
    '/lib64',
    '/opt',
    '/proc',
    '/root',
    '/run',
    '/sbin',
    '/sys',
    '/tmp',
    '/usr',
    '/var',
];

export interface MediaRoot {
    path: string;
    realPath: string;
    name: string;
}

export interface ValidatedMediaPath {
    path: string;
    realPath: string;
    root: MediaRoot;
}

export class MediaPathError extends Error {
    readonly status = 403;

    constructor(message: string) {
        super(message);
        this.name = 'MediaPathError';
    }
}

export class MediaRootConfigurationError extends Error {
    readonly status = 500;

    constructor(message: string) {
        super(message);
        this.name = 'MediaRootConfigurationError';
    }
}

function containsPath(parent: string, child: string): boolean {
    if (parent === '/') return child.startsWith('/');
    return child === parent || child.startsWith(`${parent}/`);
}

function normalizeAbsolutePath(value: string): string {
    const normalized = posix.normalize(value);
    return normalized.length > 1 ? normalized.replace(/\/+$/, '') : normalized;
}

function assertSafeMediaRoot(root: string): void {
    for (const protectedRoot of PROTECTED_ROOTS) {
        if (protectedRoot === '/' ? root === '/' : containsPath(protectedRoot, root)) {
            throw new MediaRootConfigurationError(
                `AK_MEDIA_ROOTS cannot expose protected container path ${root}`
            );
        }
    }

    const configRoot = getConfigRoot();
    if (containsPath(configRoot, root) || containsPath(root, configRoot)) {
        throw new MediaRootConfigurationError(
            `AK_MEDIA_ROOTS cannot overlap the AK config directory ${configRoot}`
        );
    }
}

export function parseMediaRootPaths(value = env.AK_MEDIA_ROOTS): string[] {
    if (!value?.trim()) return [];

    const roots: string[] = [];
    for (const rawRoot of value.split(',')) {
        const trimmedRoot = rawRoot.trim();
        if (!trimmedRoot) continue;
        if (!posix.isAbsolute(trimmedRoot)) {
            throw new MediaRootConfigurationError(
                `Every AK_MEDIA_ROOTS entry must be an absolute path, received "${trimmedRoot}"`
            );
        }

        const root = normalizeAbsolutePath(trimmedRoot);
        assertSafeMediaRoot(root);
        if (!roots.includes(root)) roots.push(root);
    }

    return roots;
}

let configuredMediaRoots: MediaRoot[] | undefined;

export async function initializeMediaRoots(value = env.AK_MEDIA_ROOTS): Promise<MediaRoot[]> {
    const paths = parseMediaRootPaths(value);
    const roots: MediaRoot[] = [];
    const realPaths = new Set<string>();

    for (const path of paths) {
        let realPath: string;
        try {
            realPath = normalizeAbsolutePath(await realpath(path));
        } catch (error) {
            throw new MediaRootConfigurationError(
                `Configured AK media root ${path} does not exist or cannot be read: ${error instanceof Error ? error.message : String(error)}`
            );
        }

        assertSafeMediaRoot(realPath);

        let info;
        try {
            info = await stat(path);
        } catch (error) {
            throw new MediaRootConfigurationError(
                `Configured AK media root ${path} cannot be inspected: ${error instanceof Error ? error.message : String(error)}`
            );
        }
        if (!info.isDirectory()) {
            throw new MediaRootConfigurationError(`Configured AK media root ${path} is not a directory`);
        }

        if (realPaths.has(realPath)) continue;
        realPaths.add(realPath);
        roots.push({ path, realPath, name: basename(path) });
    }

    configuredMediaRoots = roots;
    if (roots.length === 0) {
        log('No AK_MEDIA_ROOTS configured; the media browser and uploads are disabled', 'khaki');
    } else {
        log(`Configured AK media roots: ${roots.map(root => root.path).join(', ')}`, 'aquamarine');
    }

    return roots;
}

export async function getMediaRoots(): Promise<MediaRoot[]> {
    if (!configuredMediaRoots) await initializeMediaRoots();
    return configuredMediaRoots ?? [];
}

export function normalizeMediaPath(input: string): string {
    if (typeof input !== 'string' || !input.trim()) {
        throw new MediaPathError('A media path is required');
    }
    if (input.includes('\0')) {
        throw new MediaPathError('Media paths may not contain null bytes');
    }
    if (!posix.isAbsolute(input)) {
        throw new MediaPathError(`Media path "${input}" must be absolute`);
    }
    if (input.split('/').some(part => part === '..')) {
        throw new MediaPathError(`Media path "${input}" contains forbidden parent-directory traversal`);
    }

    return normalizeAbsolutePath(input);
}

export function findMediaRoot(path: string, roots: MediaRoot[]): MediaRoot | undefined {
    return roots
        .filter(root => containsPath(root.path, path))
        .sort((a, b) => b.path.length - a.path.length)[0];
}

export async function validateMediaPath(
    input: string,
    roots?: MediaRoot[],
): Promise<ValidatedMediaPath> {
    const path = normalizeMediaPath(input);
    const mediaRoots = roots ?? await getMediaRoots();
    const root = findMediaRoot(path, mediaRoots);

    if (!root) {
        throw new MediaPathError(
            `Media path "${path}" is not covered by any configured AK media root`
        );
    }

    let resolvedPath: string;
    try {
        resolvedPath = normalizeAbsolutePath(await realpath(path));
    } catch (error) {
        throw new MediaPathError(
            `Media path "${path}" does not exist or cannot be read: ${error instanceof Error ? error.message : String(error)}`
        );
    }

    if (!containsPath(root.realPath, resolvedPath)) {
        throw new MediaPathError(
            `Media path "${path}" resolves outside its configured media root ${root.path}`
        );
    }

    return { path, realPath: resolvedPath, root };
}

export async function validateMediaDirectory(
    input: string,
    roots?: MediaRoot[],
): Promise<ValidatedMediaPath> {
    const validated = await validateMediaPath(input, roots);
    let info;
    try {
        info = await stat(validated.path);
    } catch (error) {
        throw new MediaPathError(
            `Media path "${validated.path}" cannot be inspected: ${error instanceof Error ? error.message : String(error)}`
        );
    }
    if (!info.isDirectory()) {
        throw new MediaPathError(`Media path "${validated.path}" is not a directory`);
    }
    return validated;
}
