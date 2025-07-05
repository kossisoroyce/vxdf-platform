import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

/*
Simple helper to retrieve context passages from VXDF files placed
in the `vxdf-data/` folder at the repo root.  This is deliberately
minimal – it shells out to the Python `vxdf` library so we don’t
re-implement parsing in JS.

Companies can replace / extend this however they like (e.g. switch to
an in-process WASM parser once available).
*/

// Root path is resolved relative to the location of this compiled file so that it
// still works when the project is bundled (e.g. in a Next.js server build). We
// walk up until we find the expected folders.
const ROOT_DIR = (() => {
  // In development `process.cwd()` is already the repo root.  In production
  // (e.g. inside a Next.js server bundle) `__dirname` may point somewhere under
  // `.next/`.  We therefore walk upward looking for the `scripts` folder (which
  // contains `vxdf_search.py`).  As soon as we find it we treat its parent as
  // the repo root.
  let cur: string | undefined = __dirname;
  for (let i = 0; i < 6 && cur; i += 1) {
    const candidate = path.join(cur, 'scripts', 'vxdf_search.py');
    if (fs.existsSync(candidate)) {
      return cur;
    }
    const parent = path.dirname(cur);
    if (parent === cur) break; // reached FS root
    cur = parent;
  }
  // Fallback to CWD – this is the common case in local development.
  return process.cwd();
})();

const DATA_DIR = path.join(ROOT_DIR, 'vxdf-data');

export async function getRagContext(query: string, k = 4): Promise<string | null> {
  // For now we just query the CBN Fintech policy file. Extend as needed.
  const vxdfPath = path.join(DATA_DIR, 'CBN_Fintech_Policies.vxdf');

  if (!fs.existsSync(vxdfPath)) {
    // If the specific file doesn't exist, we can't provide context.
    // This can happen on a fresh clone before data is added.
    console.warn(`[vxdf] Data file not found, skipping RAG: ${vxdfPath}`);
    return null;
  }

  try {
    /*
      We expect the vxdf CLI (provided by the parent Python project) to expose
      a `vxdf search <file> "<query>" --top-k <k>` command that prints the top
      chunks separated by newlines.  Adjust if your CLI is different.
    */
    // Use the local Python helper script that mirrors the Streamlit retrieval logic
    const scriptPath = path.join(ROOT_DIR, 'scripts', 'vxdf_search.py');

    // Determine which python executable to use. Prefer env override, then python3, then python.
    const pythonBins = [
      process.env.PYTHON_BIN, // user override
      'python3',
      'python',
    ].filter(Boolean) as string[];

    let execResult: ReturnType<typeof spawnSync> | null = null;
    for (const bin of pythonBins) {
      const r = spawnSync(bin, [scriptPath, vxdfPath, query, String(k)], {
        encoding: 'utf-8',
      });
      // If the interpreter is missing, keep searching – do NOT treat it as a real result.
      if (r.error && (r.error as any).code === 'ENOENT') {
        continue;
      }
      execResult = r;
      break;
    }

    if (!execResult) {
      console.error('[vxdf] No usable python interpreter found. Set PYTHON_BIN env var if one is available.');
      return null;
    }

    if (execResult.error) {
      console.error('[vxdf] search spawn error:', execResult.error);
      return null;
    }

    if (execResult.status !== 0) {
      console.error('[vxdf] search returned non-zero exit code:', execResult.stderr);
      return null;
    }

    const stdoutStr = typeof execResult.stdout === 'string' ? execResult.stdout : (execResult.stdout ?? Buffer.from('')).toString('utf-8');
    const context = stdoutStr.trim();
    if (!context) return null;

    // The RAG prompt template already adds explanatory headers, so we return
    // just the raw context.
    return context;
  } catch (err) {
    console.error('[vxdf] failed to run search:', err);
    return null;
  }
}
