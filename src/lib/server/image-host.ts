import type { Image, ImageHostSettings } from '$lib/types';

export default abstract class ImageHost {

    abstract maxSize: number;

    async configure(settings: ImageHostSettings): Promise<void> { }
    abstract upload(image: string, width: number | undefined, signal?: AbortSignal): Promise<Image>;

}