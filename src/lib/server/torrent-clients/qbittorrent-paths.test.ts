import { describe, expect, test } from 'bun:test';
import { mapQbittorrentPath } from './qbittorrent-paths';

describe('qBittorrent path mappings', () => {

    test('maps an identity path', () => {
        expect(mapQbittorrentPath(
            '/hdd3/tv/Show (2008)',
            '/hdd3=/hdd3',
        )).toBe('/hdd3/tv/Show (2008)');
    });

    test('maps between different container paths', () => {
        expect(mapQbittorrentPath(
            '/mnt/media3/tv/Show',
            ' /mnt/media3 = /hdd3 ',
        )).toBe('/hdd3/tv/Show');
    });

    test('uses the longest matching source prefix', () => {
        expect(mapQbittorrentPath(
            '/mnt/hdd3/tv/foo',
            '/mnt=/storage\n/mnt/hdd3=/hdd3',
        )).toBe('/hdd3/tv/foo');
    });

    test('does not match a path with a partial source component', () => {
        expect(() => mapQbittorrentPath('/hdd30/foo', '/hdd3=/hdd3')).toThrow(
            "Content path \"/hdd30/foo\" isn't covered by a qBittorrent path mapping",
        );
    });

    test('reports an unmatched path instead of falling back', () => {
        expect(() => mapQbittorrentPath('/other/media/Show', '/hdd3=/hdd3')).toThrow(
            "isn't covered by a qBittorrent path mapping",
        );
    });

    test('normalizes mapped paths while preserving the remainder', () => {
        expect(mapQbittorrentPath(
            '/mnt/media3/./tv/Show (2008)/../Show (2008)',
            '/mnt/media3/=/storage/',
        )).toBe('/storage/tv/Show (2008)');
    });

    test('returns no mapped path for an empty configuration', () => {
        expect(mapQbittorrentPath('/hdd3/tv/Show', '')).toBeUndefined();
        expect(mapQbittorrentPath('/hdd3/tv/Show', '\n  \n')).toBeUndefined();
    });

});
