# GPU Worker Template Archives

The large GPU worker / inference template zips are **no longer stored in git**.
They were removed from the repo to keep it from bloating (they total ~1.16 GB
with duplicates and several exceed GitHub's 100 MB per-file limit, which blocks
pushes).

The 5 unique archives now live in **Replit Object Storage (App Storage)**.

## Where they are

- Bucket: `replit-objstore-92420312-7368-4c29-8394-f3bd7ba1e2dd`
  (also exposed as the `DEFAULT_OBJECT_STORAGE_BUCKET_ID` env var)
- Prefix: `gpu-templates/`

| Object key | Size | md5 |
|---|---|---|
| `gpu-templates/Collab_inference.zip` | 57,472,122 B (~55 MB) | `83bd4f042de39172c198e21114702087` |
| `gpu-templates/Collab_inference_slim.zip` | 47,828,395 B (~46 MB) | `46a520121c91bb89685f1f6b1b37dcbc` |
| `gpu-templates/Latentsync_export.zip` | 126,226,904 B (~120 MB) | `4de847a3cdf8a8807c4cc627d80ca411` |
| `gpu-templates/PerformAnywhereExport.zip` | 119,562,510 B (~114 MB) | `b84ea1b48d2507ad67181c840828bfe9` |
| `gpu-templates/Motion_transfer_studio.zip` | 10,019,664 B (~9.6 MB) | `ff2b27620f5d39ed65399f36158c6f94` |

> The 9 other large zips that previously sat in `attached_assets/` were exact
> byte-for-byte duplicates of these 5 (verified by md5) and were not uploaded.

## How to download

**Option A — Object Storage pane (no code):**
Open the Object Storage tool in the Replit workspace, browse to the
`gpu-templates/` prefix, and download the file you need.

**Option B — programmatically:**

```bash
bun add -d @replit/object-storage
```

```js
import { Client } from "@replit/object-storage";
const client = new Client({
  bucketId: "replit-objstore-92420312-7368-4c29-8394-f3bd7ba1e2dd",
});
await client.downloadToFilename(
  "gpu-templates/Latentsync_export.zip",
  "./Latentsync_export.zip",
);
```

## Do not re-commit these to git

`.gitignore` ignores the `Collab_inference*`, `Latentsync_export*`,
`PerformAnywhereExport*`, and `Motion_transfer_studio*` zip families under
`attached_assets/`. If you need a new version of one of these archives, upload
it to Object Storage instead of committing it.
