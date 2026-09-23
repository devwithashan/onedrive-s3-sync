# Running & testing this app

## 1. Install

```bash
npm install
```

## 2. Configure `.env`

Already set for the OneDrive/Graph side (personal account, device-code flow):

- `AZURE_CLIENT_ID`
- `ONEDRIVE_REFRESH_TOKEN`
- `GRAPH_ITEM_PATH` — e.g. `/HourlyReports/hello.xlsx`
- `GRAPH_DRIVE_ID` — `me`

Still blank, needed for the S3 + webhook pipeline:

| Variable | Needed for | Notes |
| --- | --- | --- |
| `S3_BUCKET` | sync, S3 notify | your target bucket |
| `S3_KEY_PREFIX` | sync | defaults to `graph-sync/` |
| `AWS_REGION` | sync, S3 notify | defaults to `us-east-1` |
| `WEBHOOK_NOTIFICATION_URL` | subscription manager | public HTTPS URL Graph calls, e.g. `https://your-host/graph/webhook` |
| `WEBHOOK_CLIENT_STATE` | subscription manager, webhook controller | any random secret string you choose |
| `BACKEND_NOTIFY_URL` | Lambda only | your backend's `/graph/s3-notify` URL |
| `NOTIFY_SHARED_SECRET` | Lambda, S3 notify controller | any random secret string you choose |

AWS credentials themselves (for the `S3Client` calls) come from your normal AWS credential chain (`~/.aws/credentials`, env vars, etc.) — not from `.env`.

## 3. Run the server

```bash
npm run start:dev   # watch mode, http://localhost:3000
```

Confirms it's up:

```bash
curl http://localhost:3000/
# -> Hello World!
```

Routes registered: `GET /`, `POST /graph/webhook`, `POST /graph/s3-notify`.

## 4. One-time OneDrive auth (only if `ONEDRIVE_REFRESH_TOKEN` is missing/expired)

```bash
npm run dev:script -- src/onedrive-device-code-auth.ts
```

Open the printed URL, sign in, copy the printed refresh token into `.env`.

## 5. Test the OneDrive → S3 sync directly

Requires `S3_BUCKET` set and valid AWS credentials.

```bash
npm run dev:script -- src/onedrive/graph-file-sync.ts
```

Downloads the file at `GRAPH_ITEM_PATH` and uploads it to `s3://$S3_BUCKET/$S3_KEY_PREFIX<filename>`. Prints the resulting key on success.

## 6. Test the webhook controller

### Validation handshake (what Graph does when you first create a subscription)

With the server running:

```bash
curl -X POST "http://localhost:3000/graph/webhook?validationToken=abc123"
# -> abc123  (plain text, 200)
```

### Simulated change notification

```bash
curl -X POST http://localhost:3000/graph/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "value": [{
      "subscriptionId": "test-sub",
      "clientState": "'"$WEBHOOK_CLIENT_STATE"'",
      "resource": "me/drive/root",
      "changeType": "updated"
    }]
  }'
```

Should respond `202` immediately, then (if `S3_BUCKET`/AWS creds are valid) log a successful sync in the server console. A `clientState` that doesn't match `.env`'s `WEBHOOK_CLIENT_STATE` is logged as ignored and does nothing.

## 7. Test the S3 notify controller (the endpoint the Lambda calls)

```bash
curl -X POST http://localhost:3000/graph/s3-notify \
  -H "Content-Type: application/json" \
  -H "X-Notify-Secret: $NOTIFY_SHARED_SECRET" \
  -d '{
    "bucket": "'"$S3_BUCKET"'",
    "key": "graph-sync/hello.xlsx",
    "eventTime": "2026-09-21T00:00:00Z"
  }'
```

Requires that `bucket`/`key` actually exist in S3 and valid AWS credentials — it does a real `GetObject`. On success it emits `fileProcessed` over the WebSocket gateway and returns `{"status":"ok"}`. Wrong/missing `X-Notify-Secret` returns `401`.

## 8. Register a real Graph subscription (real webhook, needs a public HTTPS URL)

`WEBHOOK_NOTIFICATION_URL` must be reachable from Microsoft's servers — tunnel your local server first if testing locally:

```bash
ngrok http 3000
# set WEBHOOK_NOTIFICATION_URL=https://<ngrok-id>.ngrok.app/graph/webhook in .env
```

Then:

```bash
npm run dev:script -- src/onedrive/graph-subscription-manager.ts create
# prints and note the subscription id

npm run dev:script -- src/onedrive/graph-subscription-manager.ts renew <subscriptionId>
```

Subscriptions expire after 30 days — `renew` should run on a recurring schedule (e.g. a daily cron/Lambda) well before that.

To actually see it fire end-to-end: edit the file in OneDrive and watch the server logs for the webhook hitting and `syncFileToS3()` running.

## 9. Automated tests

```bash
npm run test        # unit tests (vitest)
npm run test:e2e    # e2e tests (boots AppModule, hits GET /)
npm run test:cov    # coverage
```

## 10. Lint & build

```bash
npm run lint
npm run build        # compiles to dist/, used by `start:prod`
```

## 11. Lambda (`lambda/s3-upload-notify-lambda.ts`)

This is a separate deploy target, not part of the Nest app. Bundle and deploy it independently (see the integration guide's Section 6/7 for the esbuild + IAM role + S3 event notification setup), pointing its `BACKEND_NOTIFY_URL` at your deployed backend's `/graph/s3-notify` and `NOTIFY_SHARED_SECRET` at the same value configured on the backend.
