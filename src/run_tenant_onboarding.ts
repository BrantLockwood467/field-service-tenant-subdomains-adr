import { onboardFieldServiceTenant } from './tenant_onboarding_route';

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function main() {
  const request = {
    tenantSlug: requiredEnv('TENANT_SLUG'),
    parentDomain: requiredEnv('PARENT_DOMAIN'),
    targetHostname: requiredEnv('TARGET_HOSTNAME'),
    workOrderId: 'wo_2048',
    technicianId: 'tech_77',
    dispatchStatus: 'completed',
    followUpNote: '',
    photoFileName: 'compressor-before.jpg',
    photoContentType: 'image/jpeg'
  };

  const result = await onboardFieldServiceTenant(request, { cleanupDnsRecord: true });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
