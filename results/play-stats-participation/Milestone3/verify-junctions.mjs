// Local build verification only: pnpm directory links may use Windows junctions.
import fs from 'node:fs';
import path from 'node:path';

if (process.platform === 'win32') {
  const original = fs.promises.symlink.bind(fs.promises);
  fs.promises.symlink = async (target, destination, type) => {
    const resolved = path.resolve(path.dirname(destination), target);
    const info = await fs.promises.stat(resolved).catch(() => null);
    return original(info?.isDirectory() ? resolved : target, destination, info?.isDirectory() ? 'junction' : type);
  };
}
