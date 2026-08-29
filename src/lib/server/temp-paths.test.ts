import { describe, expect, test } from 'bun:test';
import { downloadedTorrentTempPath } from './tracker';
import { screenshotTempPath } from './screenshots';
import { torrentTempPath } from './torrent';
import { resizedImageTempPath } from './util/resize-image';

describe('AK temporary artifact paths', () => {

    test('uses the application temp directory for every generated artifact type', () => {
        const root = '/config';
        const paths = [
            screenshotTempPath('screenshot', root),
            resizedImageTempPath(root),
            torrentTempPath(root),
            downloadedTorrentTempPath(root),
        ];

        for (const path of paths) expect(path.startsWith(`${root}/tmp/`)).toBe(true);
        expect(paths[0]).toBe('/config/tmp/screenshot.png');
        expect(paths[1]?.endsWith('.png')).toBe(true);
        expect(paths[2]?.endsWith('.torrent')).toBe(true);
        expect(paths[3]?.endsWith('.torrent')).toBe(true);

    });

});
