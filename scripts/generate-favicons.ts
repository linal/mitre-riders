/**
 * Generate PNG + ICO favicon assets from `public/favicon.svg`.
 *
 * Outputs (overwriting existing files in `public/`):
 *   - favicon.ico              (16, 32, 48 px multi-size)
 *   - favicon-16x16.png
 *   - favicon-32x32.png
 *   - apple-touch-icon.png      (180 px)
 *   - android-chrome-192x192.png
 *   - android-chrome-512x512.png
 *
 * Usage:
 *   npm run generate:icons
 *
 * Notes:
 *   - The SVG uses `prefers-color-scheme` to swap spoke/hub colour. Rasterised
 *     PNGs cannot adapt at runtime, so we render with the LIGHT-mode palette
 *     (dark spokes on a transparent background), which matches what users see
 *     on most home screens / OS shortcut surfaces.
 *   - `apple-touch-icon` is rendered with a solid white background because iOS
 *     doesn't composite transparent home-screen icons nicely.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';

const PUBLIC_DIR = path.resolve(__dirname, '..', 'public');
const SVG_PATH = path.join(PUBLIC_DIR, 'favicon.svg');

type PngTarget = {
  filename: string;
  size: number;
  background?: { r: number; g: number; b: number; alpha: number };
};

const PNG_TARGETS: PngTarget[] = [
  { filename: 'favicon-16x16.png', size: 16 },
  { filename: 'favicon-32x32.png', size: 32 },
  { filename: 'apple-touch-icon.png', size: 180, background: { r: 255, g: 255, b: 255, alpha: 1 } },
  { filename: 'android-chrome-192x192.png', size: 192 },
  { filename: 'android-chrome-512x512.png', size: 512 },
];

const ICO_SIZES = [16, 32, 48];

async function renderPng(svg: Buffer, target: PngTarget): Promise<void> {
  const pipeline = sharp(svg, { density: 384 }).resize(target.size, target.size, {
    fit: 'contain',
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  });

  const buffer = target.background
    ? await pipeline.flatten({ background: target.background }).png().toBuffer()
    : await pipeline.png().toBuffer();

  await fs.writeFile(path.join(PUBLIC_DIR, target.filename), buffer);
  console.log(`  wrote ${target.filename} (${target.size}x${target.size})`);
}

async function renderIco(svg: Buffer): Promise<void> {
  const pngBuffers = await Promise.all(
    ICO_SIZES.map((size) =>
      sharp(svg, { density: 384 })
        .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer(),
    ),
  );

  const ico = await pngToIco(pngBuffers);
  await fs.writeFile(path.join(PUBLIC_DIR, 'favicon.ico'), ico);
  console.log(`  wrote favicon.ico (${ICO_SIZES.join(', ')})`);
}

async function main(): Promise<void> {
  const svg = await fs.readFile(SVG_PATH);
  console.log(`Generating icons from ${path.relative(process.cwd(), SVG_PATH)}`);

  for (const target of PNG_TARGETS) {
    await renderPng(svg, target);
  }
  await renderIco(svg);

  console.log('Done.');
}

main().catch((err) => {
  console.error('generate-favicons failed:', err);
  process.exit(1);
});
