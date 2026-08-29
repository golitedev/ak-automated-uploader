import { file, spawn } from 'bun';
import { basename } from 'node:path';
import { randomUUID } from 'node:crypto';
import errorString from './error-string';
import { appTempPath, ensureAppTempDirectory } from './app-data-path';

export function resizedImageTempPath(root?: string): string {
    return root === undefined
        ? appTempPath(`${randomUUID()}.png`)
        : appTempPath(`${randomUUID()}.png`, root);
}

export default async function resizeImage(path: string, width: number): Promise<Blob> {

    await ensureAppTempDirectory();
    const outputPath = resizedImageTempPath();

    try {

        const ffmpeg = spawn([
            'ffmpeg',
            '-y',
            '-v', 'error',
            '-i', path,
            '-vf', `scale='min(${width},iw)':-1:flags=lanczos`,
            '-frames:v', '1',
            outputPath,
        ], { stdout: 'ignore', stderr: 'pipe' });

        const stderr = (await new Response(ffmpeg.stderr).text()).trim();
        const code = await ffmpeg.exited;

        if (code !== 0) {
            throw Error(errorString(`ffmpeg exited with code ${code}`, stderr));
        }

        const bytes = await file(outputPath).bytes();
        return new Blob([bytes], { type: 'image/png' });

    } catch (error) {
        throw Error(errorString(`Couldn't resize ${basename(path)} to ${width}px wide`, error));
    } finally {
        await file(outputPath).delete().catch(() => {});
    }

}
