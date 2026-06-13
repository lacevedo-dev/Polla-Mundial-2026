import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { AvatarStorageService } from './avatar-storage.service';

describe('AvatarStorageService', () => {
    const originalUploadDir = process.env.AVATAR_UPLOAD_DIR;
    let tempDir: string;
    let service: AvatarStorageService;

    beforeEach(() => {
        tempDir = path.join(os.tmpdir(), `avatar-storage-${randomUUID()}`);
        process.env.AVATAR_UPLOAD_DIR = tempDir;
        service = new AvatarStorageService();
    });

    afterEach(() => {
        if (originalUploadDir === undefined) {
            delete process.env.AVATAR_UPLOAD_DIR;
        } else {
            process.env.AVATAR_UPLOAD_DIR = originalUploadDir;
        }

        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('writes the uploaded avatar buffer and returns a public avatar path', async () => {
        const publicPath = await service.save({
            originalname: 'avatar.png',
            mimetype: 'image/png',
            buffer: Buffer.from('avatar-image'),
        } as Express.Multer.File);

        expect(publicPath).toMatch(/^\/uploads\/avatars\/.+\.png$/);
        const storedFile = path.join(tempDir, path.basename(publicPath));
        expect(fs.existsSync(storedFile)).toBe(true);
        expect(fs.readFileSync(storedFile, 'utf8')).toBe('avatar-image');
    });

    it('removes a previously saved avatar file', async () => {
        const publicPath = await service.save({
            originalname: 'avatar.webp',
            mimetype: 'image/webp',
            buffer: Buffer.from('avatar-image'),
        } as Express.Multer.File);

        const storedFile = path.join(tempDir, path.basename(publicPath));
        expect(fs.existsSync(storedFile)).toBe(true);

        await service.remove(publicPath);

        expect(fs.existsSync(storedFile)).toBe(false);
    });

    it('ignores missing files during best-effort cleanup', async () => {
        await expect(service.remove('/uploads/avatars/missing-file.png')).resolves.toBeUndefined();
    });

    it('downloads a remote OAuth avatar and stores it locally', async () => {
        const imageBytes = Buffer.from('oauth-image-bytes');
        globalThis.fetch = jest.fn().mockResolvedValue({
            ok: true,
            headers: {
                get: (name: string) => (name === 'content-type' ? 'image/jpeg' : null),
            },
            arrayBuffer: async () => imageBytes.buffer.slice(
                imageBytes.byteOffset,
                imageBytes.byteOffset + imageBytes.byteLength,
            ),
        }) as unknown as typeof fetch;

        const publicPath = await service.saveFromUrl('https://lh3.googleusercontent.com/a/photo.jpg');

        expect(publicPath).toMatch(/^\/uploads\/avatars\/.+\.jpg$/);
        const storedFile = path.join(tempDir, path.basename(publicPath!));
        expect(fs.existsSync(storedFile)).toBe(true);
        expect(fs.readFileSync(storedFile)).toEqual(imageBytes);
    });

    it('returns null when remote avatar is not an image', async () => {
        globalThis.fetch = jest.fn().mockResolvedValue({
            ok: true,
            headers: {
                get: (name: string) => (name === 'content-type' ? 'text/html' : null),
            },
            arrayBuffer: async () => Buffer.from('<html></html>').buffer,
        }) as unknown as typeof fetch;

        await expect(service.saveFromUrl('https://example.com/not-image')).resolves.toBeNull();
    });

    it('identifies local avatar paths', () => {
        expect(service.isLocalAvatarPath('/uploads/avatars/abc.jpg')).toBe(true);
        expect(service.isLocalAvatarPath('https://lh3.googleusercontent.com/a/photo')).toBe(false);
        expect(service.isLocalAvatarPath(null)).toBe(false);
    });

    it('checks whether a local avatar file exists on disk', async () => {
        const publicPath = await service.save({
            originalname: 'avatar.png',
            mimetype: 'image/png',
            buffer: Buffer.from('avatar-image'),
        } as Express.Multer.File);

        await expect(service.exists(publicPath)).resolves.toBe(true);
        await expect(service.exists('/uploads/avatars/missing.png')).resolves.toBe(false);
    });
});
