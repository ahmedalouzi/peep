import { Client as MinioClient } from 'minio';

const BUCKET_NAME = process.env.MINIO_BUCKET || 'synkro-build-artifacts';
const ARTIFACT_EXPIRY_SECONDS = 24 * 60 * 60; // 24 hours

let minioInstance: MinioClient | null = null;

function getMinioClient(): MinioClient {
  if (!minioInstance) {
    minioInstance = new MinioClient({
      endPoint: process.env.MINIO_ENDPOINT || 'localhost',
      port: parseInt(process.env.MINIO_PORT || '9000', 10),
      useSSL: process.env.MINIO_USE_SSL === 'true',
      accessKey: process.env.MINIO_ACCESS_KEY || '',
      secretKey: process.env.MINIO_SECRET_KEY || '',
    });
  }
  return minioInstance;
}

/**
 * Ensures the artifacts bucket exists, creating it if necessary.
 */
export async function ensureBucket(): Promise<void> {
  const client = getMinioClient();
  const exists = await client.bucketExists(BUCKET_NAME);
  if (!exists) {
    await client.makeBucket(BUCKET_NAME);
    console.log(`[MINIO] Created bucket: ${BUCKET_NAME}`);
  }
}

/**
 * Uploads a build artifact (APK/AAB) to MinIO and returns a presigned download URL.
 */
export async function uploadArtifact(
  jobId: string,
  localFilePath: string,
  filename: string
): Promise<{ url: string; sizeBytes: number }> {
  const client = getMinioClient();
  const fs = await import('node:fs/promises');
  const stat = await fs.stat(localFilePath);

  const objectName = `${jobId}/${filename}`;
  await client.fPutObject(BUCKET_NAME, objectName, localFilePath, {
    'Content-Type': 'application/vnd.android.package-archive',
  });

  const url = await client.presignedGetObject(BUCKET_NAME, objectName, ARTIFACT_EXPIRY_SECONDS);
  console.log(`[MINIO] Uploaded ${objectName} (${stat.size} bytes), presigned URL expires in 24h`);

  return { url, sizeBytes: stat.size };
}

/**
 * Deletes expired artifacts for a given job.
 */
export async function deleteArtifact(jobId: string): Promise<void> {
  const client = getMinioClient();
  const objectsStream = client.listObjects(BUCKET_NAME, `${jobId}/`, true);

  const objects: string[] = [];
  for await (const obj of objectsStream) {
    if (obj.name) objects.push(obj.name);
  }

  if (objects.length > 0) {
    await client.removeObjects(BUCKET_NAME, objects);
    console.log(`[MINIO] Deleted ${objects.length} artifacts for job ${jobId}`);
  }
}
