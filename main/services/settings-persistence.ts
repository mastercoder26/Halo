import { randomUUID } from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";

export interface SettingsPersistenceFileSystem {
  writeFile(filePath: string, contents: string, encoding: "utf-8"): Promise<void>;
  rename(fromPath: string, toPath: string): Promise<void>;
  unlink(filePath: string): Promise<void>;
}

interface AtomicSettingsPersistence<T> {
  filePath: string;
  contents: string;
  next: T;
  commit: (settings: T) => void;
  notify: (settings: T) => void;
  fileSystem?: SettingsPersistenceFileSystem;
}

const nodeFileSystem: SettingsPersistenceFileSystem = {
  writeFile: (filePath, contents, encoding) => fs.writeFile(filePath, contents, encoding),
  rename: (fromPath, toPath) => fs.rename(fromPath, toPath),
  unlink: (filePath) => fs.unlink(filePath),
};

export async function persistSettingsAtomically<T>({
  filePath,
  contents,
  next,
  commit,
  notify,
  fileSystem = nodeFileSystem,
}: AtomicSettingsPersistence<T>): Promise<T> {
  const temporaryPath = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${randomUUID()}.tmp`,
  );

  try {
    await fileSystem.writeFile(temporaryPath, contents, "utf-8");
    await fileSystem.rename(temporaryPath, filePath);
  } catch (error) {
    try {
      await fileSystem.unlink(temporaryPath);
    } catch {
      // Preserve the original persistence error when cleanup also fails.
    }
    throw error;
  }

  commit(next);
  notify(next);
  return next;
}
