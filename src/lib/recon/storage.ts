import crypto from "node:crypto";
import path from "node:path";
import { promises as fs } from "node:fs";

export type SavedUpload = {
  storedPath: string; // relative to uploads root
  sha256: string;
  sizeBytes: number;
};

export function getUploadsRootDir(): string {
  const configured = process.env.RECONEX_STORAGE_DIR?.trim();
  if (configured) return configured;
  return path.join(process.cwd(), "storage", "uploads");
}

export async function ensureUploadsDir(): Promise<void> {
  await fs.mkdir(getUploadsRootDir(), { recursive: true });
}

export function sha256Hex(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

export function safeFileExtensionFromName(filename: string): string | null {
  const ext = path.extname(filename).toLowerCase().replace(/^\./, "");
  if (!ext) return null;
  // Keep it conservative; only allow alphanumeric extensions.
  if (!/^[a-z0-9]+$/.test(ext)) return null;
  return ext;
}

export async function saveUploadedFile(buffer: Buffer, extension: string | null): Promise<SavedUpload> {
  await ensureUploadsDir();
  const sha256 = sha256Hex(buffer);
  const sizeBytes = buffer.byteLength;

  const dateFolder = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const root = getUploadsRootDir();
  const folder = path.join(root, dateFolder);
  await fs.mkdir(folder, { recursive: true });

  const id = crypto.randomUUID();
  const filename = extension ? `${id}.${extension}` : id;
  const absPath = path.join(folder, filename);
  await fs.writeFile(absPath, buffer, { flag: "wx" });

  const storedPath = path.join(dateFolder, filename);
  return { storedPath, sha256, sizeBytes };
}

export async function readStoredFile(storedPath: string): Promise<Buffer> {
  const absPath = path.join(getUploadsRootDir(), storedPath);
  // Prevent path traversal.
  const root = path.resolve(getUploadsRootDir());
  const resolved = path.resolve(absPath);
  if (!resolved.startsWith(root + path.sep) && resolved !== root) {
    throw new Error("Invalid storedPath (path traversal)");
  }
  return await fs.readFile(resolved);
}


