> ## Documentation Index
> Fetch the complete documentation index at: https://heygen-1fa696a7.mintlify.site/llms.txt
> Use this file to discover all available pages before exploring further.

# Upload Assets

> Upload images, audio, and video to HeyGen via the Assets API. Use uploaded assets as backgrounds, voice references, lipsync inputs, or photo avatar sources.

The Assets API lets you upload files to HeyGen and receive an `asset_id` you can reference in other endpoints — including [Video Agent](/docs/video-agent), [Avatar creation](/docs/create-avatar), [Video Translation](/docs/video-translate), and [Lipsync](/lipsync-speed).

There are two ways to upload:

* [`POST /v3/assets`](/reference/upload-asset) — a single `multipart/form-data` request. Simplest option, capped at **32 MB**.
* [Direct upload](#upload-large-files-direct-upload) — a presigned-URL flow for files larger than 32 MB. The file bytes go straight to storage and never pass through the API.

## Upload via `POST /v3/assets`

Full schema: [`POST /v3/assets`](/reference/upload-asset). Upload a file using `multipart/form-data` — the MIME type is auto-detected from file bytes.

### Constraints

| Constraint       | Value                                                                            |
| ---------------- | -------------------------------------------------------------------------------- |
| Max file size    | 32 MB — for larger files, use [direct upload](#upload-large-files-direct-upload) |
| Supported images | png, jpeg                                                                        |
| Supported video  | mp4, webm                                                                        |
| Supported audio  | mp3, wav                                                                         |
| Other            | pdf                                                                              |

### Example request

<CodeGroup>
  ```bash curl theme={null}
  curl -X POST "https://api.heygen.com/v3/assets" \
    -H "X-Api-Key: $HEYGEN_API_KEY" \
    -F "file=@./product-screenshot.png"
  ```

  ```python Python theme={null}
  import requests

  with open("product-screenshot.png", "rb") as f:
      resp = requests.post(
          "https://api.heygen.com/v3/assets",
          headers={"X-Api-Key": HEYGEN_API_KEY},
          files={"file": ("product-screenshot.png", f, "image/png")},
      )

  asset = resp.json()["data"]
  print(asset["asset_id"])
  ```

  ```javascript Node.js theme={null}
  const fs = require("fs");
  const FormData = require("form-data");

  const form = new FormData();
  form.append("file", fs.createReadStream("./product-screenshot.png"));

  const resp = await fetch("https://api.heygen.com/v3/assets", {
    method: "POST",
    headers: {
      "X-Api-Key": process.env.HEYGEN_API_KEY,
      ...form.getHeaders(),
    },
    body: form,
  });
  const { data } = await resp.json();
  console.log(data.asset_id);
  ```
</CodeGroup>

### Response

```json theme={null}
{
  "data": {
    "asset_id": "asset_abc123def456",
    "url": "https://files.heygen.ai/assets/asset_abc123def456.png",
    "mime_type": "image/png",
    "size_bytes": 245760
  }
}
```

| Field        | Type    | Description                                                  |
| ------------ | ------- | ------------------------------------------------------------ |
| `asset_id`   | string  | Unique identifier to reference this file in other API calls. |
| `url`        | string  | Public URL of the uploaded file.                             |
| `mime_type`  | string  | Detected MIME type.                                          |
| `size_bytes` | integer | File size in bytes.                                          |

## Upload large files (direct upload)

For files larger than 32 MB, use the direct upload flow. It is a three-step process — **all three steps are required**; the `asset_id` is not usable until you call the complete endpoint:

<Steps>
  <Step title="Initialize the upload">
    Call [`POST /v3/assets/direct-uploads`](/reference/create-asset-upload) with the file's name, MIME type, and exact byte size. The response contains an `asset_id`, a presigned `upload_url`, and `upload_headers`.
  </Step>

  <Step title="PUT the file bytes">
    Send the raw file bytes to `upload_url` with an HTTP `PUT`, including every header from `upload_headers` verbatim. The URL expires after `expires_in_seconds`, and the byte size is signed into it — the upload fails if the file doesn't match the declared `size_bytes`.
  </Step>

  <Step title="Complete the upload">
    Call [`POST /v3/assets/{asset_id}/complete`](/reference/complete-asset-upload) to finalize the asset. This step is idempotent — repeated calls return the same finalized asset. The `asset_id` is now usable anywhere the API accepts assets.
  </Step>
</Steps>

### Example

<CodeGroup>
  ```bash curl theme={null}
  # Step 1: Initialize
  SIZE=$(stat -f%z ./footage.mp4)  # use `stat -c%s` on Linux
  INIT=$(curl -s -X POST "https://api.heygen.com/v3/assets/direct-uploads" \
    -H "X-Api-Key: $HEYGEN_API_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"filename\": \"footage.mp4\", \"content_type\": \"video/mp4\", \"size_bytes\": $SIZE}")

  ASSET_ID=$(echo "$INIT" | jq -r '.data.asset_id')
  UPLOAD_URL=$(echo "$INIT" | jq -r '.data.upload_url')

  # Step 2: PUT the raw bytes to the presigned URL,
  # passing every header from data.upload_headers verbatim
  HEADER_ARGS=$(echo "$INIT" | jq -r '.data.upload_headers | to_entries[] | "-H \"\(.key): \(.value)\""' | tr '\n' ' ')
  eval curl -X PUT "$UPLOAD_URL" $HEADER_ARGS --upload-file ./footage.mp4

  # Step 3: Complete
  curl -X POST "https://api.heygen.com/v3/assets/$ASSET_ID/complete" \
    -H "X-Api-Key: $HEYGEN_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{}'
  ```

  ```python Python theme={null}
  import os
  import requests

  file_path = "footage.mp4"

  # Step 1: Initialize
  init = requests.post(
      "https://api.heygen.com/v3/assets/direct-uploads",
      headers={"X-Api-Key": HEYGEN_API_KEY},
      json={
          "filename": os.path.basename(file_path),
          "content_type": "video/mp4",
          "size_bytes": os.path.getsize(file_path),
      },
  ).json()["data"]

  # Step 2: PUT the raw bytes to the presigned URL
  with open(file_path, "rb") as f:
      put_resp = requests.put(init["upload_url"], data=f, headers=init["upload_headers"])
  put_resp.raise_for_status()

  # Step 3: Complete
  asset = requests.post(
      f"https://api.heygen.com/v3/assets/{init['asset_id']}/complete",
      headers={"X-Api-Key": HEYGEN_API_KEY},
      json={},
  ).json()["data"]

  print(asset["asset_id"], asset["status"])
  ```

  ```javascript Node.js theme={null}
  const fs = require("fs");

  const filePath = "./footage.mp4";
  const { size } = fs.statSync(filePath);

  // Step 1: Initialize
  const initResp = await fetch("https://api.heygen.com/v3/assets/direct-uploads", {
    method: "POST",
    headers: {
      "X-Api-Key": process.env.HEYGEN_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      filename: "footage.mp4",
      content_type: "video/mp4",
      size_bytes: size,
    }),
  });
  const init = (await initResp.json()).data;

  // Step 2: PUT the raw bytes to the presigned URL
  await fetch(init.upload_url, {
    method: "PUT",
    headers: init.upload_headers,
    body: fs.readFileSync(filePath),
  });

  // Step 3: Complete
  const completeResp = await fetch(
    `https://api.heygen.com/v3/assets/${init.asset_id}/complete`,
    {
      method: "POST",
      headers: {
        "X-Api-Key": process.env.HEYGEN_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    }
  );
  const asset = (await completeResp.json()).data;
  console.log(asset.asset_id, asset.status);
  ```
</CodeGroup>

### Initialize response fields

| Field                | Type    | Description                                                        |
| -------------------- | ------- | ------------------------------------------------------------------ |
| `asset_id`           | string  | Reusable asset identifier. Becomes usable after the complete step. |
| `upload_url`         | string  | Presigned URL. `PUT` the raw file bytes here.                      |
| `upload_headers`     | object  | Headers that must be sent verbatim on the `PUT` request.           |
| `expires_in_seconds` | integer | Seconds until `upload_url` expires.                                |
| `max_bytes`          | integer | Maximum allowed upload size in bytes for this flow.                |
| `status`             | string  | Always `pending_upload` at this stage.                             |

<Note>
  Calling complete before the `PUT` has finished returns a `409 conflict` ("Uploaded object not found yet"). Retry after the `PUT` returns `200`. You can optionally pass `checksum_sha256` (hex) at both the initialize and complete steps to have the stored bytes verified end to end.
</Note>

## Use assets in Video Agent

Once uploaded, reference the `asset_id` in the `files` array when creating a video:

```json theme={null}
{
  "prompt": "Create a product demo using the attached screenshots",
  "files": [
    { "type": "asset_id", "asset_id": "asset_abc123def456" },
    { "type": "asset_id", "asset_id": "asset_ghi789jkl012" }
  ]
}
```

## Three ways to provide files

Video Agent and other endpoints accept files in three formats. Use whichever is most convenient for your workflow:

<CardGroup cols={3}>
  <Card title="Asset ID" icon="database">
    Upload once, reference by ID. Best for files you reuse across multiple videos.
  </Card>

  <Card title="HTTPS URL" icon="link">
    Point to a publicly accessible URL. No upload step needed — HeyGen fetches the file directly. Same 32 MB per-file limit as uploads.
  </Card>

  <Card title="Base64" icon="code">
    Inline the file content as a base64-encoded string. Useful for small files or when you want a self-contained request.
  </Card>
</CardGroup>

### Format comparison

| Format   | Syntax                                                                | When to use                                                                                                                              |
| -------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Asset ID | `{ "type": "asset_id", "asset_id": "asset_..." }`                     | Pre-uploaded files, reusable across requests. Only option for files over 32 MB (via [direct upload](#upload-large-files-direct-upload)). |
| URL      | `{ "type": "url", "url": "https://..." }`                             | Files up to 32 MB already hosted publicly.                                                                                               |
| Base64   | `{ "type": "base64", "media_type": "image/png", "data": "iVBOR..." }` | Small files, self-contained requests, no hosting needed.                                                                                 |

<Warning>
  The 32 MB per-file limit also applies to URL inputs — pointing at a larger self-hosted file fails with `Maximum size for URL inputs of type 'video/mp4' is 32 MB`. For larger files, use [direct upload](#upload-large-files-direct-upload) and pass the resulting `asset_id`. Base64 encoding additionally inflates payload size by \~33%, so prefer the other two formats for anything beyond a few MB.
</Warning>

## Where assets can be used

The `asset_id` format is accepted anywhere the API takes file inputs:

| Endpoint                                                                            | Use case                                                                                              |
| ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| [`POST /v3/video-agents`](/reference/create-video-agent-session)                    | Attach reference files (images, slides, video clips, audio).                                          |
| [`POST /v3/video-agents/{session_id}`](/reference/send-message-or-request-revision) | Send additional files in follow-up messages — see [Interactive Sessions](/docs/interactive-sessions). |
| [`POST /v3/avatars`](/reference/create-avatar)                                      | Provide a photo or video for avatar creation — see [Create Avatar](/docs/create-avatar).              |
| [`POST /v3/video-translations`](/reference/create-video-translation)                | Provide source video or custom audio — see [Video Translation](/docs/video-translate).                |
| [`POST /v3/lipsyncs`](/reference/create-lipsync)                                    | Provide source video and/or replacement audio — see [Lipsync](/lipsync-speed).                        |

## Example: Upload then generate

A complete workflow — upload a PDF, then use it to generate a video:

<CodeGroup>
  ```bash curl theme={null}
  # Step 1: Upload the PDF
  ASSET_ID=$(curl -s -X POST "https://api.heygen.com/v3/assets" \
    -H "X-Api-Key: $HEYGEN_API_KEY" \
    -F "file=@./quarterly-report.pdf" | jq -r '.data.asset_id')

  echo "Uploaded asset: $ASSET_ID"

  # Step 2: Generate a video using the uploaded PDF
  curl -X POST "https://api.heygen.com/v3/video-agents" \
    -H "X-Api-Key: $HEYGEN_API_KEY" \
    -H "Content-Type: application/json" \
    -d "{
      \"prompt\": \"Summarize the key findings from this quarterly report in a 60-second video\",
      \"files\": [{ \"type\": \"asset_id\", \"asset_id\": \"$ASSET_ID\" }]
    }"
  ```

  ```python Python theme={null}
  import requests

  # Step 1: Upload
  with open("quarterly-report.pdf", "rb") as f:
      upload_resp = requests.post(
          "https://api.heygen.com/v3/assets",
          headers={"X-Api-Key": HEYGEN_API_KEY},
          files={"file": f},
      )
  asset_id = upload_resp.json()["data"]["asset_id"]

  # Step 2: Generate
  gen_resp = requests.post(
      "https://api.heygen.com/v3/video-agents",
      headers={"X-Api-Key": HEYGEN_API_KEY},
      json={
          "prompt": "Summarize the key findings from this quarterly report in a 60-second video",
          "files": [{"type": "asset_id", "asset_id": asset_id}],
      },
  )
  session = gen_resp.json()["data"]
  ```
</CodeGroup>
