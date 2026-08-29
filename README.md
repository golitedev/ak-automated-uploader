# ak-automated-uploader

AK Automated Uploader is a web-based torrent uploader tool for private trackers.

Well, a few private trackers. More coming. Probably.

Upload files by picking them via the web UI, or go fully automated with the API.

![Screenshot of the AK Automated Uploader user interface](https://files.catbox.moe/i32l9r.png)

Supported trackers:

| Tracker         | Features |
| --------------- | -------- |
| Aither          | Duplicate search, banned groups, season pack trumping, repack trumping |
| BeyondHD\*      | Duplicate search, banned groups |
| LST             | Duplicate search, banned groups, season pack trumping, repack trumping |
| MidnightScene\* | Untested |
| Seedpool\*      | Untested |

\* These ones probably work but could use a little testing.

Supported image hosts:
- Catbox
- Freeimage.host
- ImgBB
- imgbox
- PiXhost
- ptpimg
- Zipline (untested)

Supported torrent clients:
- qBittorrent
- rTorrent (experimental)
- Just saving the .torrent file to a folder

## Prerequisites

Any new-ish version of the following should do. Put them in your PATH.

- [Bun](https://bun.com/)
- [ffmpeg/ffprobe](https://www.ffmpeg.org/)
- [mkbrr](https://mkbrr.com/)

You'll also need a TMDB API key.

## Getting started

Download the latest release and run the following:

```
bun install
ORIGIN=http://localhost:51901 PORT=51901 bun build/index.js
```

Or on PowerShell:

```
$env:ORIGIN = "http://localhost:51901"
$env:PORT = "51901"
bun install
bun build/index.js
```

Configure your image hosts, torrent client, and trackers on the settings page.

### qBittorrent path mappings

The qBittorrent **Path mappings** setting maps paths visible inside AK to paths visible inside qBittorrent. Add one absolute mapping per line using `/ak/path=/qb/path`. When both containers use the same paths, enter:

```
/hdd1=/hdd1
/hdd2=/hdd2
/hdd3=/hdd3
/hdd4=/hdd4
```

When mappings are configured, AK sends the mapped parent directory as qBittorrent's save path and disables Auto TMM for that torrent. qBittorrent's global save path is not used for mapped paths. Leave the setting empty to retain the normal qBittorrent save-path behavior.

## Docker image

Or use the Docker image at `ghcr.io/aqtku/ak-automated-uploader:latest`.

Here's a docker-compose:

```
services:
  uploader:
    image: ghcr.io/aqtku/ak-automated-uploader:latest
    container_name: ak-automated-uploader
    ports:
      - "51901:51901"
    volumes:
      - ./config:/config
      - /path/to/your/media:/mnt:ro
    environment:
      - PORT=51901
      - ORIGIN=http://localhost:51901
      - APPDATA=/config
      - HOME=/mnt
    restart: unless-stopped
```

For a multi-drive NAS setup, mount each drive at the same path in both containers. qBittorrent can use read-write mounts while AK only needs read-only access:

```
services:
  qbittorrent:
    volumes:
      - /volume1/hdd1:/hdd1
      - /volume3/hdd2:/hdd2
      - /volume4/hdd3:/hdd3
      - /volume5/hdd4:/hdd4

  uploader:
    volumes:
      - /volume1/hdd1:/hdd1:ro
      - /volume3/hdd2:/hdd2:ro
      - /volume4/hdd3:/hdd3:ro
      - /volume5/hdd4:/hdd4:ro
```

With these mounts, use the four identity mappings above. For different container paths, map the AK path on the left to the qBittorrent path on the right.

## Known issues

- Needs a pretty clean scene or P2P filename to work because the checker for
  data in the filename is a whitelist.
- No support for full discs yet.
