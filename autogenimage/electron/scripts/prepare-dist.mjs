import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');
const distSource = path.join(projectRoot, 'dist');
const distTarget = path.join(projectRoot, 'electron', 'dist');

async function ensureSourceExists() {
  try {
    await fs.access(distSource);
  } catch (error) {
    throw new Error('Vite build output not found. Please run "npm run build" before preparing Electron.');
  }
}

async function removeTarget() {
  await fs.rm(distTarget, { recursive: true, force: true });
}

async function copyDirectory(source, destination) {
  await fs.mkdir(destination, { recursive: true });
  const entries = await fs.readdir(source, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(source, entry.name);
    const destPath = path.join(destination, entry.name);

    if (entry.isDirectory()) {
      await copyDirectory(srcPath, destPath);
    } else if (entry.isSymbolicLink()) {
      const link = await fs.readlink(srcPath);
      await fs.symlink(link, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

async function main() {
  await ensureSourceExists();
  await removeTarget();
  await copyDirectory(distSource, distTarget);
  console.log(`Copied Vite build from "${distSource}" to "${distTarget}".`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
