import { z } from 'zod';

export const tenantOnboardingRequestSchema = z.object({
  tenantSlug: z.string().min(2).max(30).regex(/^[a-z0-9-]+$/),
  parentDomain: z.string().min(3),
  targetHostname: z.string().min(3),
  workOrderId: z.string().min(1),
  technicianId: z.string().min(1),
  dispatchStatus: z.enum(['scheduled', 'en_route', 'completed']),
  followUpNote: z.string(),
  photoFileName: z.string().min(1),
  photoContentType: z.string().min(1)
});

export type TenantOnboardingRequest = z.infer<typeof tenantOnboardingRequestSchema>;
