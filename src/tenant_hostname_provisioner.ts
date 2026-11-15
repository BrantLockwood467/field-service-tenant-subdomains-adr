import type { InfraiClient } from './infrai_client';

export type TenantHostnameProvisionInput = {
  tenantSlug: string;
  parentDomain: string;
  targetHostname: string;
};

export type TenantHostnameProvisionResult = {
  zoneId: string;
  tenantHostname: string;
  recordId: string;
};

export async function provisionTenantHostname(
  infrai: InfraiClient,
  input: TenantHostnameProvisionInput
): Promise<TenantHostnameProvisionResult> {
  const zone = await infrai.dns.domain.get({ domain: input.parentDomain });

  const tenantHostname = `${input.tenantSlug}.${input.parentDomain}`;
  const record = await infrai.dns.record.upsert({
    zone_id: zone.zone_id,
    record_type: 'CNAME',
    name: input.tenantSlug,
    content: input.targetHostname,
    ttl: 300,
    proxied: false,
    metadata: {
      tenant_slug: input.tenantSlug
    }
  });

  return {
    zoneId: zone.zone_id,
    tenantHostname,
    recordId: record.record_id ?? `${zone.zone_id}:${input.tenantSlug}`
  };
}

export async function deleteTenantHostname(
  infrai: InfraiClient,
  input: Pick<TenantHostnameProvisionResult, 'zoneId' | 'recordId'>
): Promise<void> {
  await infrai.dns.record.delete({ zone_id: input.zoneId, record_id: input.recordId });
}
