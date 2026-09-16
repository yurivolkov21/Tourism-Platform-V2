import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { forbiddenImports } from './package-boundary.js';

// Hàng rào ADR-0042 §3: package này chỉ được phụ thuộc @tourism/contract và
// @tourism/i18n. Luật nào người hay quên thì để máy nhớ — cùng tinh thần
// `scripts/check-mobile-tokens-only.mjs`.

describe('forbiddenImports', () => {
  it('bắt import react, react-native, next và API Node', () => {
    const source = [
      "import { useState } from 'react';",
      "import { View } from 'react-native';",
      "import { headers } from 'next/headers';",
      "import { readFileSync } from 'node:fs';",
    ].join('\n');
    expect(forbiddenImports(source)).toEqual(['react', 'react-native', 'next/headers', 'node:fs']);
  });

  it('cho qua import tương đối và hai package được phép', () => {
    const source = [
      "import { messages } from '@tourism/i18n';",
      "import { EmailSchema } from '@tourism/contract';",
      "import { mapAuthError } from './auth-errors.js';",
    ].join('\n');
    expect(forbiddenImports(source)).toEqual([]);
  });
});

describe('source thật của @tourism/core', () => {
  const srcDir = fileURLToPath(new URL('../', import.meta.url));
  const files = sourceFiles(srcDir);

  // Tự kiểm: quét mà không thấy file nào thì test dưới xanh giả.
  it('quét được ít nhất 3 file', () => {
    expect(files.length).toBeGreaterThanOrEqual(3);
  });

  it('không file nào import thứ bị cấm', () => {
    const violations = files.flatMap((file) =>
      forbiddenImports(readFileSync(file, 'utf8')).map((name) => `${file}: ${name}`),
    );
    expect(violations).toEqual([]);
  });
});

/** Mọi file `.ts` trong src trừ chính các spec — spec được phép dùng `node:fs`. */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts') ? [path] : [];
  });
}
