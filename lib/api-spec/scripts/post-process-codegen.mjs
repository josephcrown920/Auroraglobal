/**
 * Post-process Orval-generated React Query client so `query` options are typed
 * as `Omit<UseQueryOptions, 'queryKey' | 'queryFn'> & { queryKey?: QueryKey }`.
 * TanStack Query v5's UseQueryOptions requires `queryKey`/`queryFn`, but Orval
 * supplies them itself, so consumers should not have to pass them.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const generatedApiPath = path.resolve(
  __dirname,
  "..",
  "..",
  "..",
  "lib",
  "api-client-react",
  "src",
  "generated",
  "api.ts",
);

if (!fs.existsSync(generatedApiPath)) {
  console.error(`Generated API file not found: ${generatedApiPath}`);
  process.exit(1);
}

let content = fs.readFileSync(generatedApiPath, "utf-8");

// Find and replace each `query?:UseQueryOptions<...>` occurrence. The generic
// arguments may contain nested angle brackets, so we count `<` and `>` to find
// the matching closing `>` for `UseQueryOptions<...>`.
let out = "";
let i = 0;
const needle = "query?:UseQueryOptions<";
let idx = content.indexOf(needle, i);
while (idx !== -1) {
  out += content.slice(i, idx);

  // Find matching `>` for `UseQueryOptions<...>`
  let depth = 1;
  let j = idx + needle.length;
  while (j < content.length && depth > 0) {
    if (content[j] === "<") depth++;
    else if (content[j] === ">") depth--;
    j++;
  }

  // j now points just after the matching `>`
  const inner = content.slice(idx + needle.length, j - 1);
  out += `query?:Omit<UseQueryOptions<${inner}>, 'queryKey' | 'queryFn'> & { queryKey?: QueryKey }`;
  i = j;
  idx = content.indexOf(needle, i);
}
out += content.slice(i);
content = out;

fs.writeFileSync(generatedApiPath, content, "utf-8");
console.log(`Patched ${generatedApiPath}`);
