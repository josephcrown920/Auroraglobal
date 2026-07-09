> ## Documentation Index
> Fetch the complete documentation index at: https://heygen-1fa696a7.mintlify.site/llms.txt
> Use this file to discover all available pages before exploring further.

# Lipsync - Precision

> Run the HeyGen Lipsync API in precision mode for frame-accurate mouth movements on long-form video. Best for cinematic content where fidelity matters.

* Endpoint: [`POST /v3/lipsyncs`](/reference/create-lipsync)
* Purpose: Dub or replace audio on a video with high-accuracy lip-sync. The job runs asynchronously — poll via [Get Lipsync](/reference/get-lipsync) or use a `callback_url` ([Webhooks](/docs/webhooks)).
* For faster, lower-fidelity lipsync, see [Speed mode](/lipsync-speed).

### Quick Example

```bash theme={null}
curl -X POST "https://api.heygen.com/v3/lipsyncs" \
  -H "X-Api-Key: $HEYGEN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "video": { "type": "url", "url": "https://example.com/source.mp4" },
    "audio": { "type": "url", "url": "https://example.com/new-audio.mp3" },
    "mode": "precision"
  }'
```

### Request Body

| Parameter                   | Type    | Required | Default | Description                                                                                                                                                                                                       |
| --------------------------- | ------- | -------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `video`                     | object  | Yes      | —       | Source video. Provide as `{ "type": "url", "url": "https://..." }` or `{ "type": "asset_id", "asset_id": "..." }` (from [`POST /v3/assets`](/reference/upload-asset) — see [Upload Assets](/docs/upload-assets)). |
| `audio`                     | object  | Yes      | —       | Replacement audio. Same format options as `video`.                                                                                                                                                                |
| `mode`                      | string  | No       | —       | Set to `"precision"` for avatar-inference lip-sync.                                                                                                                                                               |
| `title`                     | string  | No       | —       | Display title for the lipsync in the HeyGen dashboard.                                                                                                                                                            |
| `enable_caption`            | boolean | No       | `false` | Generate captions for the output video.                                                                                                                                                                           |
| `enable_dynamic_duration`   | boolean | No       | `true`  | Allow output duration to adjust to match the new audio length.                                                                                                                                                    |
| `disable_music_track`       | boolean | No       | `false` | Strip background music from the source video.                                                                                                                                                                     |
| `enable_speech_enhancement` | boolean | No       | `false` | Enhance speech quality in the output.                                                                                                                                                                             |
| `enable_watermark`          | boolean | No       | `false` | Add a watermark to the output.                                                                                                                                                                                    |
| `start_time`                | number  | No       | —       | Start time in seconds for partial lipsync.                                                                                                                                                                        |
| `end_time`                  | number  | No       | —       | End time in seconds for partial lipsync.                                                                                                                                                                          |
| `keep_the_same_format`      | boolean | No       | —       | Preserve the source video's resolution and bitrate.                                                                                                                                                               |
| `fps_mode`                  | string  | No       | —       | Frame rate mode: `"vfr"`, `"cfr"`, or `"passthrough"`.                                                                                                                                                            |
| `callback_url`              | string  | No       | —       | [Webhook](/docs/webhooks) URL — receives a POST when the job completes or fails.                                                                                                                                  |
| `callback_id`               | string  | No       | —       | Arbitrary ID echoed back in the webhook payload.                                                                                                                                                                  |
| `folder_id`                 | string  | No       | —       | Organize the lipsync into a specific project folder.                                                                                                                                                              |

### Response

```json theme={null}
{
  "data": {
    "lipsync_id": "ls_abc123"
  }
}
```

| Field        | Type   | Description                                                                                           |
| ------------ | ------ | ----------------------------------------------------------------------------------------------------- |
| `lipsync_id` | string | Unique identifier. Use with [`GET /v3/lipsyncs/{lipsync_id}`](/reference/get-lipsync) to poll status. |

## Get Lipsync Details

* Endpoint: [`GET /v3/lipsyncs/{lipsync_id}`](/reference/get-lipsync)
* Purpose: Get detailed information about a lipsync including status, download URL, and metadata.

### Quick Example

```bash theme={null}
curl -X GET "https://api.heygen.com/v3/lipsyncs/ls_abc123" \
  -H "X-Api-Key: $HEYGEN_API_KEY"
```

### Path Parameters

| Parameter    | Type   | Required | Description                |
| ------------ | ------ | -------- | -------------------------- |
| `lipsync_id` | string | Yes      | Unique lipsync identifier. |

### Response

```json theme={null}
{
  "data": {
    "id": "ls_abc123",
    "title": "My Lipsync",
    "status": "completed",
    "duration": 42.5,
    "video_url": "https://files.heygen.ai/...",
    "callback_id": null,
    "created_at": 1717000000,
    "failure_message": null
  }
}
```

### Response Fields

| Field             | Type            | Description                                                                             |
| ----------------- | --------------- | --------------------------------------------------------------------------------------- |
| `id`              | string          | Unique lipsync identifier.                                                              |
| `title`           | string or null  | Display title.                                                                          |
| `status`          | string          | Current status: `"pending"`, `"running"`, `"completed"`, or `"failed"`.                 |
| `duration`        | number or null  | Video duration in seconds. Present when completed.                                      |
| `video_url`       | string or null  | Presigned download URL for the output video. Only present when status is `"completed"`. |
| `callback_id`     | string or null  | Client-provided callback ID.                                                            |
| `created_at`      | integer or null | Unix timestamp of creation.                                                             |
| `failure_message` | string or null  | Error description. Only present when status is `"failed"`.                              |

## List Lipsyncs

* Endpoint: [`GET /v3/lipsyncs`](/reference/list-lipsyncs)
* Purpose: List lipsyncs with cursor-based pagination.

### Quick Example

```bash theme={null}
curl -X GET "https://api.heygen.com/v3/lipsyncs?limit=10" \
  -H "X-Api-Key: $HEYGEN_API_KEY"
```

### Query Parameters

| Parameter | Type    | Required | Default | Description                            |
| --------- | ------- | -------- | ------- | -------------------------------------- |
| `limit`   | integer | No       | `10`    | Results per page (1–100).              |
| `token`   | string  | No       | —       | Opaque cursor token for the next page. |

### Response

```json theme={null}
{
  "data": [
    {
      "id": "ls_abc123",
      "title": "My Lipsync",
      "status": "completed",
      "duration": 42.5,
      "video_url": "https://files.heygen.ai/...",
      "created_at": 1717000000
    }
  ],
  "has_more": false,
  "next_token": null
}
```

## Update Lipsync

* Endpoint: [`PATCH /v3/lipsyncs/{lipsync_id}`](/reference/update-lipsync)
* Purpose: Update a lipsync's title.

### Quick Example

```bash theme={null}
curl -X PATCH "https://api.heygen.com/v3/lipsyncs/ls_abc123" \
  -H "X-Api-Key: $HEYGEN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "title": "Updated Title" }'
```

### Request Body

| Parameter | Type   | Required | Description                |
| --------- | ------ | -------- | -------------------------- |
| `title`   | string | Yes      | New title for the lipsync. |

## Delete Lipsync

* Endpoint: [`DELETE /v3/lipsyncs/{lipsync_id}`](/reference/delete-lipsync)
* Purpose: Permanently delete a lipsync.

### Quick Example

```bash theme={null}
curl -X DELETE "https://api.heygen.com/v3/lipsyncs/ls_abc123" \
  -H "X-Api-Key: $HEYGEN_API_KEY"
```

### Response

```json theme={null}
{
  "data": {
    "id": "ls_abc123"
  }
}
```

## CLI Usage

```bash theme={null}
# Create with precision mode
heygen lipsync create -d '{
  "video": {"type": "url", "url": "https://example.com/source.mp4"},
  "audio": {"type": "url", "url": "https://example.com/new-audio.mp3"},
  "mode": "precision"
}' --wait

# Poll status manually
heygen lipsync get <lipsync-id>

# List lipsyncs
heygen lipsync list --limit 10

# Update title
heygen lipsync update <lipsync-id> --title "Updated Title"

# Delete
heygen lipsync delete <lipsync-id> --force
```

Use `--request-schema` to see all available request fields without needing auth:

```bash theme={null}
heygen lipsync create --request-schema
```

## Polling Pattern

Lipsyncs are processed asynchronously. Poll until status reaches `"completed"` or `"failed"`.

Status transitions: `pending` → `running` → `completed` | `failed`

```bash theme={null}
while true; do
  STATUS=$(curl -s "https://api.heygen.com/v3/lipsyncs/ls_abc123" \
    -H "X-Api-Key: $HEYGEN_API_KEY" | jq -r '.data.status')
  echo "Status: $STATUS"
  [ "$STATUS" = "completed" ] || [ "$STATUS" = "failed" ] && break
  sleep 10
done
```

Or let the CLI handle polling for you:

```bash theme={null}
heygen lipsync create -d '...' --wait --timeout 30m
```

## Asset Inputs

Both `video` and `audio` fields accept two input formats:

**By URL** — any publicly accessible HTTPS link:

```json theme={null}
{ "type": "url", "url": "https://example.com/file.mp4" }
```

**By asset ID** — reference a file previously uploaded via [`POST /v3/assets`](/reference/upload-asset) (see [Upload Assets](/docs/upload-assets)):

```json theme={null}
{ "type": "asset_id", "asset_id": "asset_xyz789" }
```
