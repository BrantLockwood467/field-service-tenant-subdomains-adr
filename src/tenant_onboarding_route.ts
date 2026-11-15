import { createInfraiFromEnv } from './infrai_client';
import { decideDispatchFollowUp } from './dispatch_follow_up';
import { deleteTenantHostname, provisionTenantHostname } from './tenant_hostname_provisioner';
import { tenantOnboardingRequestSchema, type TenantOnboardingRequest } from './tenant_onboarding_request';
import { signWorkOrderPhotoAccess } from './work_order_photo_signer';

export async function onboardFieldServiceTenant(rawBody: unknown, options: { cleanupDnsRecord?: boolean } = {}) {
  const body: TenantOnboardingRequest = tenantOnboardingRequestSchema.parse(rawBody);
  const infrai = createInfraiFromEnv();

  const hostname = await provisionTenantHostname(infrai, {
    tenantSlug: body.tenantSlug,
    parentDomain: body.parentDomain,
    targetHostname: body.targetHostname
  });

  try {
    const dispatch = decideDispatchFollowUp({
      status: body.dispatchStatus,
      followUpNote: body.followUpNote,
      technicianId: body.technicianId,
      workOrderId: body.workOrderId
    });

    const photos = await signWorkOrderPhotoAccess(infrai, {
      tenantSlug: body.tenantSlug,
      workOrderId: body.workOrderId,
      photoFileName: body.photoFileName,
      photoContentType: body.photoContentType
    });

    return { tenantHostname: hostname.tenantHostname, zoneId: hostname.zoneId, dispatch, photos };
  } finally {
    if (options.cleanupDnsRecord) {
      await deleteTenantHostname(infrai, hostname);
    }
  }
}
