import type { S3Event, S3Handler } from 'aws-lambda';

const BACKEND_NOTIFY_URL = process.env.BACKEND_NOTIFY_URL!;
const NOTIFY_SHARED_SECRET = process.env.NOTIFY_SHARED_SECRET!;

export const handler: S3Handler = async (event: S3Event) => {
  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));

    const response = await fetch(BACKEND_NOTIFY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Notify-Secret': NOTIFY_SHARED_SECRET,
      },
      body: JSON.stringify({ bucket, key, eventTime: record.eventTime }),
    });

    if (!response.ok) {
      throw new Error(
        `Backend notify failed: ${response.status} ${await response.text()}`,
      );
    }
  }
};
