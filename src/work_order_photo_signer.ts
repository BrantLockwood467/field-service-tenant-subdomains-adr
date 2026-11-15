import type { InfraiClient } from './infrai_client';

export type WorkOrderPhotoSigningInput = {
  tenantSlug: string;
  workOrderId: string;
  photoFileName: string;
  photoContentType: string;
};

export type WorkOrderPhotoSigningResult = {
  objectKey: string;
  uploadUrl: string;
  downloadUrl: string;
};

export async function signWorkOrderPhotoAccess(
  infrai: InfraiClient,
  input: WorkOrderPhotoSigningInput
): Promise<WorkOrderPhotoSigningResult> {
  const bucket = 'field-service-work-order-photos';
  const objectKey = `${input.tenantSlug}/work-orders/${input.workOrderId}/${input.photoFileName}`;
  const idempotencyKey = `${input.tenantSlug}:${input.workOrderId}:${input.photoFileName}`;

  const upload = await infrai.storage.object.presign(bucket, objectKey, {
    op: 'put',
    expires_seconds: 900,
    content_type: input.photoContentType,
    max_bytes: 10_000_000,
    idempotency_key: idempotencyKey
  });

  const download = await infrai.storage.object.presign(bucket, objectKey, {
    op: 'get',
    expires_seconds: 3600,
    response_disposition: `inline; filename="${input.photoFileName}"`,
    idempotency_key: `${idempotencyKey}:download`
  });

  return {
    objectKey,
    uploadUrl: upload.url,
    downloadUrl: download.url
  };
}
