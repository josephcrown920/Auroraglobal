#!/usr/bin/env bash
# Aurora Global — Evidence Collector v3
# Evidence only. No classification, merge, deletion, or secret-value output.
set -u
set -o pipefail

REPORT="${REPORT:-$HOME/AURORA_GLOBAL_EVIDENCE_COLLECTION.md}"
ROOT="${ROOT:-.}"

say() { printf '\n[%s] %s\n' "$1" "$2"; }
list_files() {
  find "$ROOT" -type f "$@" -not -path "*/node_modules/*" -not -path "*/.git/*" 2>/dev/null | sort || true
}
safe_ls() { ls -1 "$@" 2>/dev/null || true; }
safe_grep() { grep -RniE "$1" "$ROOT" --exclude-dir=node_modules --exclude-dir=.git 2>/dev/null | head -100 || true; }

CURRENT_BRANCH="$(git -C "$ROOT" branch --show-current 2>/dev/null || true)"
HEAD_SHA="$(git -C "$ROOT" rev-parse HEAD 2>/dev/null || true)"
HEAD_COMMIT="$(git -C "$ROOT" log -1 --oneline 2>/dev/null || true)"
DIRTY_STATE="$(git -C "$ROOT" status --short 2>/dev/null || true)"
BRANCHES="$(git -C "$ROOT" branch -a 2>/dev/null | grep -v 'HEAD' || true)"
COMMITS="$(git -C "$ROOT" log --oneline -10 2>/dev/null || true)"
PR_LIST="$(gh pr list --state all --limit 50 2>/dev/null || printf '%s\n' 'gh unavailable or unauthenticated')"

say 0 "Collecting git state"
say 1 "Collecting documentation"
DOCS="$(list_files \( -iname 'README*' -o -iname 'ROADMAP*' -o -iname '*REPORT*' -o -iname '*AUDIT*' -o -iname 'TODO*' -o -iname 'STATUS*' -o -iname 'PLAN*' -o -iname 'ARCHITECTURE*' \))"

say 2 "Collecting architecture"
FRAMEWORK="Unknown"
if [ -f "$ROOT/vinxi.config.ts" ] || [ -f "$ROOT/app.config.ts" ] || grep -qi '"@tanstack/react-start"' "$ROOT/package.json" 2>/dev/null; then
  FRAMEWORK="TanStack Start / Vinxi (evidence)"
elif [ -f "$ROOT/next.config.js" ] || [ -f "$ROOT/next.config.ts" ]; then
  FRAMEWORK="Next.js (evidence)"
fi
PACKAGE_MANAGER="Unknown"
[ -f "$ROOT/pnpm-lock.yaml" ] && PACKAGE_MANAGER="pnpm"
[ -f "$ROOT/yarn.lock" ] && PACKAGE_MANAGER="yarn"
[ -f "$ROOT/package-lock.json" ] && PACKAGE_MANAGER="npm"
[ -f "$ROOT/bun.lockb" ] || [ -f "$ROOT/bun.lock" ] && PACKAGE_MANAGER="bun"
APP_ENTRY="$(safe_ls "$ROOT/app" | head -50)"
API_ROUTES="$(find "$ROOT" -type f \( -path '*/api/*' -o -path '*/routes/api/*' \) -not -path '*/node_modules/*' -not -path '*/.git/*' 2>/dev/null | sort || true)"

say 3 "Collecting MCP architecture evidence"
MCP_FILES="$(list_files -iname '*mcp*')"
MCP_ROUTE_FILES="$(find "$ROOT" -type f \( -path '*/api/mcp*' -o -iname '*mcp*.ts' -o -iname '*mcp*.js' \) -not -path '*/node_modules/*' -not -path '*/.git/*' 2>/dev/null | sort || true)"
MCP_SYMBOLS="$(safe_grep 'handleRpcMessage|tools/list|tools/call|aurora_modelark_director|authUserId' | head -120)"

say 4 "Collecting ModelArk / Dola evidence"
MODELARK_FILES="$(list_files \( -iname '*modelark*' -o -iname '*model-ark*' -o -iname '*dola*' -o -iname '*seedance*' -o -iname '*seedream*' \))"
MODELARK_SYMBOLS="$(safe_grep 'aurora_modelark_director|ARK_API_KEY|BYTEPLUS_API_KEY|ARK_BASE_URL|BYTEPLUS_BASE_URL|managed.?agent' | head -160)"

say 5 "Collecting database / jobs / credits evidence"
DB_FILES="$(list_files \( -iname '*supabase*' -o -iname '*postgres*' -o -iname '*database*' \))"
JOB_FILES="$(list_files \( -iname '*job*' -o -iname '*queue*' -o -iname '*credit*' -o -iname '*worker*' -o -iname '*sweep*' -o -iname '*idempot*' \))"
MIGRATIONS="$(find "$ROOT" -type d \( -path '*/supabase/migrations' -o -path '*/prisma/migrations' -o -path '*/drizzle' \) -not -path '*/node_modules/*' -not -path '*/.git/*' 2>/dev/null | sort || true)"
SCHEMA_FILES="$(list_files \( -name 'schema.ts' -o -name 'schema.sql' -o -name '*.prisma' \))"

say 6 "Collecting auth / authorization evidence"
AUTH_FILES="$(list_files \( -iname '*auth*' -o -iname '*session*' -o -iname '*middleware*' -o -iname '*guard*' -o -iname '*permission*' -o -iname '*rls*' \))"
AUTH_SYMBOLS="$(safe_grep 'getUser\(|getSession\(|Authorization|Bearer |authUserId|requireAuth|requireUser|RLS|row.level.security' | head -160)"

say 7 "Collecting media / GPU evidence"
VIDEO_FILES="$(list_files \( -iname '*video*' -o -iname '*motion*' -o -iname '*lip*sync*' -o -iname '*avatar*' -o -iname '*img2vid*' \))"
IMAGE_FILES="$(list_files \( -iname '*image*' -o -iname '*seedream*' -o -iname '*img2img*' -o -iname '*generation*' \))"
GPU_FILES="$(list_files \( -iname '*gpu*' -o -iname '*worker*' -o -iname '*autoscal*' \))"
LAYER_FILES="$(list_files -iname '*layer*')"

say 8 "Collecting security evidence without reading secret values"
RATE_FILES="$(list_files \( -iname '*rate*limit*' -o -iname '*ratelimit*' -o -iname '*throttl*' \))"
ERROR_FILES="$(list_files \( -iname '*error*' -o -iname '*exception*' -o -iname '*redact*' -o -iname '*logger*' -o -iname '*logging*' \))"
ENV_METADATA="$(safe_ls "$ROOT"/.env "$ROOT"/.env.local "$ROOT"/.env.example "$ROOT"/.env.production)"
TRACKED_ENV="$(git -C "$ROOT" ls-files | grep -E '(^|/)\.env($|\.|/)' || true)"
CORS_SYMBOLS="$(safe_grep 'Access-Control-Allow-Origin|CORS|cors' | head -80)"

say 9 "Collecting test / build evidence"
TEST_FILES="$(list_files \( -name '*.test.*' -o -name '*.spec.*' \) | wc -l | tr -d ' ')"
TEST_DIRS="$(find "$ROOT" -type d \( -name '__tests__' -o -name 'tests' -o -name 'test' \) -not -path '*/node_modules/*' -not -path '*/.git/*' 2>/dev/null | sort || true)"
SCRIPTS="$(node -e 'try{const p=require("./package.json"); console.log(JSON.stringify(p.scripts||{},null,2))}catch(e){console.log("{}")}' 2>/dev/null || printf '%s\n' '{}')"

say 10 "Collecting duplicate-candidate evidence"
DUP_VIDEO="$(safe_grep 'provider|model.*video|generate.*video' | head -120)"
DUP_MCP="$(safe_grep 'handleRpcMessage|tools/call|aurora_modelark_director' | head -120)"
DUP_JOBS="$(safe_grep 'enqueueJob|create_generation_and_reserve|jobId|queue' | head -120)"

cat > "$REPORT" <<EOF
# Aurora Global — Evidence Collection Report v3

> Evidence only. This report does not classify systems as working, broken, complete, incomplete, safe, unsafe, or ready.
> It does not read or print secret values. Live provider execution is not inferred from source evidence.

## 0. Git
- Branch: `$CURRENT_BRANCH`
- HEAD SHA: `$HEAD_SHA`
- HEAD: `$HEAD_COMMIT`
- Dirty state:
```
$DIRTY_STATE
```
- Branches:
```
$BRANCHES
```
- Last 10 commits:
```
$COMMITS
```
- PR listing:
```
$PR_LIST
```

## 1. Documentation
```
$DOCS
```

## 2. Architecture
| Evidence | Value |
|---|---|
| Framework | $FRAMEWORK |
| Package manager | $PACKAGE_MANAGER |
| App root entries | see below |
| API route candidates | see below |

```
$APP_ENTRY
```

### API route candidates
```
$API_ROUTES
```

## 3. MCP
### Files
```
$MCP_FILES
```
### MCP route candidates
```
$MCP_ROUTE_FILES
```
### Relevant symbol/reference evidence
```
$MCP_SYMBOLS
```

## 4. ModelArk / Dola
### Files
```
$MODELARK_FILES
```
### Relevant references
```
$MODELARK_SYMBOLS
```

## 5. Database / Jobs / Credits
### Database candidates
```
$DB_FILES
```
### Job / queue / credit / worker / idempotency candidates
```
$JOB_FILES
```
### Migration directories
```
$MIGRATIONS
```
### Schema candidates
```
$SCHEMA_FILES
```

## 6. Authentication / Authorization
### Files
```
$AUTH_FILES
```
### Relevant references
```
$AUTH_SYMBOLS
```

## 7. Video / Image / GPU
### Video
```
$VIDEO_FILES
```
### Image
```
$IMAGE_FILES
```
### GPU / worker / autoscaling
```
$GPU_FILES
```
### Layer-related
```
$LAYER_FILES
```

## 8. Security
### Rate-limit candidates
```
$RATE_FILES
```
### Error / logging / redaction candidates
```
$ERROR_FILES
```
### Environment-file metadata only
```
$ENV_METADATA
```
### Tracked environment-file paths
```
$TRACKED_ENV
```
### CORS-related references
```
$CORS_SYMBOLS
```

## 9. Tests / Build
- Test-file count: $TEST_FILES
- Test directories:
```
$TEST_DIRS
```
- package.json scripts:
```json
$SCRIPTS
```

> This collector records available commands. It does not invent commands or claim a test passed without an execution result.

## 10. Duplicate-candidate evidence
### Video/provider references
```
$DUP_VIDEO
```
### MCP references
```
$DUP_MCP
```
### Job/queue references
```
$DUP_JOBS
```

## 11. Live verification boundary
Source evidence cannot establish:
- ModelArk credential validity
- Managed-agent availability
- provider/GPU availability
- end-to-end generation
- external OAuth/publishing success
- production deployment health

Those require explicit runtime tests and their output should be recorded separately.

## 12. Audit workflow
1. Compare this evidence with the authoritative Aurora report.
2. Inspect relevant source files.
3. Run only commands that are actually present in package scripts/tooling.
4. Run ModelArk live tests only in an environment with valid credentials.
5. Record discrepancies without silently changing the authoritative report.
EOF

chmod +x "$ROOT/scripts/evidence-collector-v3.sh" 2>/dev/null || true
