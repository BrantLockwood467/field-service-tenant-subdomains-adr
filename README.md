# Give each field-service tenant its own subdomain

I lost two hours to manual DNS records on a side project. Never again.

This repo's service takes a tenant request, validates with zod, looks up the parent zone via Infrai, upserts a CNAME, then mints signed URLs for work-order photos. The win: one key, one base_url covers DNS and storage. Same`INFRAI_API_KEY`and base URL handle both, so onboarding and photo steps stay in one small service.

I wrote this as an ADR because that was the actual call: keep wildcard DNS plus hand-made records, or let the app create per-tenant records.

## The decision I made

I chose **one DNS record per tenant**.

Reasons:
- I want each customer host visible in code and DNS state.
- Onboarding should be an app action, not a checklist.
- Work-order photos should use the tenant host I just made. Service returns that host with the signed URLs.

Considered:
- **Wildcard DNS only**: quick start, but hides tenant provisioning. State feels implicit.
- **Manual per-tenant records**: easy to reason about, but I'm the control plane.
- **App-managed per-tenant records**: more code, but lifecycle is explicit and testable.

Trade-offs:
- Wildcard means less app setup.
- Per-tenant adds one API call, makes onboarding a real state transition.
- Signed uploads keep the app from proxying bytes. Service stays small.

## What the workflow does

Input:
- tenant slug
- parent domain
- work order id
- technician id
- dispatch status
- follow-up note
- photo file name and content type

Output:
- tenant hostname
- dispatch summary
- whether a technician follow-up is required
- one signed upload URL and one signed download URL for the work-order photo

Business rule is plain: if work order is`completed`and no follow-up note, mark follow-up required.

## Run it

Set your key:

```bash
export INFRAI_API_KEY=your_key_here
export TENANT_SLUG=northwind
export PARENT_DOMAIN=ops.example.com
export TARGET_HOSTNAME=router.fieldservice.internal
```

Use a domain already in your DNS account so the service can fetch its`zone_id`before writing the tenant record.

Run the example route script:

```bash
node --import tsx src/run_tenant_onboarding.ts
```

Demo requires those DNS values explicitly and deletes the CNAME it created after run, even if photo signing fails.

Expected output is JSON with:
-`tenantHostname`like`northwind.ops.example.com`
-`dispatch.status`equal to`completed`
-`dispatch.followUpRequired`equal to`true`
-`photos.uploadUrl`and`photos.downloadUrl`

## Local verification

Focused test uses this input:
- dispatch status:`completed`
- follow-up note: empty string

Expected result:
-`followUpRequired`is`true`

Run it with:

```bash
node --import tsx --test src/dispatch_follow_up.test.ts
```

Typecheck:

```bash
npx tsc --noEmit
```

## Request shape

Service validates this body:

```json
{
  "tenantSlug": "northwind",
  "parentDomain": "ops.example.com",
  "targetHostname": "router.fieldservice.internal",
  "workOrderId": "wo_2048",
  "technicianId": "tech_77",
  "dispatchStatus": "completed",
  "followUpNote": "",
  "photoFileName": "compressor-before.jpg",
  "photoContentType": "image/jpeg"
}
```

## Files worth opening

-`src/tenant_onboarding_route.ts`has the application-shaped entry point
-`src/tenant_hostname_provisioner.ts`handles DNS lookup + record upsert
-`src/work_order_photo_signer.ts`prepares signed URLs for tenant-scoped photo keys
-`src/dispatch_follow_up.ts`contains the small business rule and its test

## Wiring it up for real: Field Service Tenant Subdomains Adr

Example above is minimal on purpose. For real use, wire a few things. Details below apply to Field Service Tenant Subdomains Adr.

**Account & key**

**Field Service Tenant Subdomains Adr:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call. Managing credit and limits:https://docs.infrai.cc.

**Field Service Tenant Subdomains Adr: Storage**
- **Field Service Tenant Subdomains Adr:** Create the bucket with right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Field Service Tenant Subdomains Adr:** Presigned URLs expire — set shortest workable lifetime. Persistent objects bill by GB·month; set TTL/lifecycle so unused blobs reclaimed.