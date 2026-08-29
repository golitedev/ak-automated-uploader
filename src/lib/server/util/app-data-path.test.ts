import { describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import appDataPath, {
    appTempPath,
    getConfigRoot,
    initializeAppData,
} from './app-data-path';

async function exists(path: string): Promise<boolean> {
    try {
        await readFile(path);
        return true;
    } catch {
        return false;
    }
}

describe('Docker application data paths', () => {

    test('defaults to exactly /config without using HOME', () => {
        expect(getConfigRoot({})).toBe('/config');
        expect(appTempPath('screenshot.png', '/config')).toBe('/config/tmp/screenshot.png');
    });

    test('does not create a nested application directory for a new install', async () => {
        const root = await mkdtemp(join(tmpdir(), 'ak-config-test-'));
        try {
            await initializeAppData(root);
            expect(await appDataPath('settings.json', root)).toBe(join(root, 'settings.json'));
            expect(await exists(join(root, 'ak-automated-uploader', 'settings.json'))).toBe(false);
        } finally {
            await rm(root, { recursive: true, force: true });
        }
    });

    test('migrates legacy files without overwriting existing destinations', async () => {
        const root = await mkdtemp(join(tmpdir(), 'ak-config-migration-test-'));
        const legacy = join(root, 'ak-automated-uploader');
        try {
            await mkdir(legacy, { recursive: true });
            await Bun.write(join(legacy, 'settings.json'), 'legacy settings');
            await Bun.write(join(legacy, 'token.json'), 'legacy token');
            await Bun.write(join(root, 'settings.json'), 'current settings');

            await initializeAppData(root);

            expect(await Bun.file(join(root, 'settings.json')).text()).toBe('current settings');
            expect(await Bun.file(join(root, 'token.json')).text()).toBe('legacy token');
            expect(await exists(join(legacy, 'settings.json'))).toBe(true);
        } finally {
            await rm(root, { recursive: true, force: true });
        }
    });

    test('removes the legacy directory after all entries are migrated', async () => {
        const root = await mkdtemp(join(tmpdir(), 'ak-config-migration-empty-'));
        const legacy = join(root, 'ak-automated-uploader');
        try {
            await mkdir(legacy, { recursive: true });
            await writeFile(join(legacy, 'settings.json'), 'legacy settings');
            await initializeAppData(root);

            expect(await Bun.file(join(root, 'settings.json')).text()).toBe('legacy settings');
            expect(await exists(legacy)).toBe(false);
        } finally {
            await rm(root, { recursive: true, force: true });
        }
    });

});
