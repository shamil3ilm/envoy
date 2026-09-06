import { z } from 'zod';
import path from 'path';
import fs from 'fs';

// Match 0x00 (NUL) through 0x1F (US) — control characters that indicate
// injection attempts or corrupted input. Using explicit Unicode escapes via
// the RegExp constructor avoids embedding raw control bytes in source.
const CONTROL_CHARS = new RegExp('[\\u0000-\\u001f]');

const noControlChars = (s: string) => !CONTROL_CHARS.test(s);
const noControlMsg = { message: 'Contains control characters' };

// Bounded safe string factory — apply .max() at the ZodString level, then refine.
const bounded = (max: number) =>
  z.string().max(max).refine(noControlChars, noControlMsg);

export const safeString = bounded(4096);

// Absolute or relative file path. Length-capped; NUL/control-byte rejected.
export const filePath = bounded(4096);

export const existingFile = filePath.refine(
  (p) => {
    try {
      return fs.existsSync(p) && fs.statSync(p).isFile();
    } catch {
      return false;
    }
  },
  { message: 'File does not exist or is not a regular file' }
);

// Restrict to a given extension list (case-insensitive).
export const withExtensions = (allowed: string[]) =>
  filePath.refine(
    (p) => {
      const ext = path.extname(p).toLowerCase();
      return allowed.some((a) => a.toLowerCase() === ext);
    },
    { message: 'Unsupported file extension' }
  );

export const csvImportPath = existingFile.and(withExtensions(['.csv', '.txt']));
export const csvExportPath = filePath.and(withExtensions(['.csv']));
export const soundUploadPath = existingFile.and(withExtensions(['.mp3', '.wav', '.ogg']));
export const docxSourcePath = existingFile.and(withExtensions(['.docx']));

// User-facing name field: no path separators, reasonable length.
export const entityName = z
  .string()
  .min(1)
  .max(200)
  .refine((s) => !/[/\\]/.test(s), { message: 'Name cannot contain path separators' })
  .refine(noControlChars, noControlMsg);

// electron dialog filter shape.
export const dialogFilter = z.object({
  name: bounded(200),
  extensions: z.array(bounded(20)).max(20),
});

export const openDialogOptions = z.object({
  title: bounded(200).optional(),
  defaultPath: bounded(4096).optional(),
  filters: z.array(dialogFilter).max(20).optional(),
});

export const saveDialogOptions = openDialogOptions;

export const docxUploadInput = z.object({
  sourcePath: docxSourcePath,
  name: entityName,
});

export const notificationSoundType = z.enum(['reminders', 'medical', 'scheduled']);

/**
 * Validate the input, returning either the parsed value or a shaped error result.
 * Callers can inline the error into their existing return contract instead of throwing.
 */
export function validate<T>(schema: z.ZodType<T>, input: unknown):
  | { ok: true; value: T }
  | { ok: false; error: string } {
  const result = schema.safeParse(input);
  if (result.success) return { ok: true, value: result.data };
  const first = result.error.issues[0];
  return { ok: false, error: first?.message ?? 'Invalid input' };
}
