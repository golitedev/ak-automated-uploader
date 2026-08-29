import { describe, expect, test } from 'bun:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { QBittorrent } from './qbittorrent';

interface Preferences {
    auto_tmm_enabled: boolean;
    save_path: string;
}

async function sendTorrent(
    pathMappings: string,
    relativeContentPath: string | undefined,
    parentContentPath: string,
    preferences: Preferences,
) {

    const originalFetch = globalThis.fetch;
    const requestedUrls: string[] = [];
    let submittedForm: FormData | undefined;
    let temporaryDirectory: string | undefined;

    globalThis.fetch = (async (input, init) => {

        const url = String(input);
        requestedUrls.push(url);

        if (url.endsWith('/api/v2/app/version')) return new Response('4.6.0');
        if (url.endsWith('/api/v2/app/preferences')) {
            return new Response(JSON.stringify(preferences), {
                headers: { 'Content-Type': 'application/json' },
            });
        }
        if (url.endsWith('/api/v2/torrents/add')) {
            submittedForm = await new Request(input, init).formData();
            return new Response('Ok');
        }

        throw Error(`Unexpected qBittorrent request: ${url}`);

    }) as typeof fetch;

    try {

        temporaryDirectory = await mkdtemp(join(tmpdir(), 'ak-qbittorrent-test-'));
        const torrentPath = join(temporaryDirectory, 'release.torrent');
        await writeFile(torrentPath, 'test torrent');

        const client = new QBittorrent();
        await client.configure({
            name: 'qBittorrent',
            url: 'http://qbittorrent.test',
            username: 'user',
            password: 'password',
            pathMappings,
        });
        await client.send(torrentPath, relativeContentPath, new AbortController().signal, parentContentPath);

    } finally {

        globalThis.fetch = originalFetch;
        if (temporaryDirectory) await rm(temporaryDirectory, { recursive: true, force: true });

    }

    if (!submittedForm) throw Error('qBittorrent add request was not sent');
    return { requestedUrls, submittedForm };

}

describe('qBittorrent torrent requests', () => {

    test('sends a mapped absolute parent and disables Auto TMM', async () => {

        const parentContentPath = '/hdd3/tv/El Cartel de los Sapos (2008)';
        const { requestedUrls, submittedForm } = await sendTorrent(
            '/hdd3=/hdd3',
            'tv/El Cartel de los Sapos (2008)',
            parentContentPath,
            { auto_tmm_enabled: true, save_path: '/hdd2/downloads' },
        );

        expect(submittedForm.get('savepath')).toBe(parentContentPath);
        expect(submittedForm.get('autoTMM')).toBe('false');
        expect(submittedForm.get('skip_checking')).toBe('true');
        expect(submittedForm.get('category')).toBeNull();
        expect(requestedUrls.some((url) => url.endsWith('/api/v2/torrents/categories'))).toBe(false);

        const stringValues = [...submittedForm.values()]
            .filter((value): value is string => typeof value === 'string');
        expect(stringValues.join('\n')).not.toContain('/hdd2/downloads');

    });

    test('retains the legacy global save-path behavior with no mappings', async () => {

        const { submittedForm } = await sendTorrent(
            '',
            'tv/Show (2008)',
            '/mnt/media/tv/Show (2008)',
            { auto_tmm_enabled: false, save_path: '/hdd2/downloads' },
        );

        expect(submittedForm.get('savepath')).toBe('/hdd2/downloads/tv/Show (2008)');
        expect(submittedForm.get('autoTMM')).toBe('false');

    });

});
