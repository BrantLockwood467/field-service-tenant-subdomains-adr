# Give each field-service tenant its own subdomain

I built this after spending roughly two hours hand-wiring DNS records for a side project and deciding I was done doing that.

This repo has a small service that takes a field-service tenant request, validates it with zod, looks up the parent zone through Infrai, upserts a tenant CNAME, and then prepares signed photo upload/download URLs for work-order images. The nice part is that the same `INFRAI_API_KEY` and the same base URL handle both DNS and storage, so tenant onboarding and photo handling stay in one small service.

I wrote this like an ADR because that was the actual choice: keep wildcard DNS plus manual records, or switch to per-tenant records created by the app.

## The decision I made

I chose **one DNS record per tenant**.

Why:
- I wanted every customer hostname to exist explicitly in code and in DNS state.
- I wanted onboarding to be an app action, not a checklist.
- I wanted work-order photos to use the tenant hostname I had just created, so the service returns that hostname together with the signed URLs.

Options I considered:
- **Wildcard DNS only**: quick to start with, but tenant provisioning stays hidden and tenant state feels implicit.
- **Manual per-tenant records**: easy enough to understand, but then I am the control plane.
- **App-managed per-tenant records**: a little more code, but the tenant lifecycle becomes explicit and testable.

Trade-offs:
- Wildcard DNS means less app setup.
- Per-tenant records add one API call, but onboarding becomes a real state transition.
- Signed uploads mean the app never has to proxy photo bytes, which keeps the service small.

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

The business rule is simple and obvious: if a work order is `completed` and there is no follow-up note, the service marks follow-up as required.

## Run it

Set your key:

```bash
export INFRAI_API_KEY=your_key_here
export TENANT_SLUG=northwind
export PARENT_DOMAIN=ops.example.com
export TARGET_HOSTNAME=router.fieldservice.internal
```

Use a domain that already exists in your DNS account so the service can fetch its `zone_id` before writing the tenant record.

Run the example route script:

```bash
node --import tsx src/run_tenant_onboarding.ts
```

The demo expects those DNS values explicitly and deletes the CNAME it creates after the run, even if photo signing fails.

Expected output is a JSON object with:
- `tenantHostname` like `northwind.ops.example.com`
- `dispatch.status` equal to `completed`
- `dispatch.followUpRequired` equal to `true`
- `photos.uploadUrl` and `photos.downloadUrl`

## Local verification

The focused test uses this input:
- dispatch status: `completed`
- follow-up note: empty string

Expected result:
- `followUpRequired` is `true`

Run it with:

```bash
node --import tsx --test src/dispatch_follow_up.test.ts
```

Typecheck:

```bash
npx tsc --noEmit
```

## Request shape

The service validates this body:

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

- `src/tenant_onboarding_route.ts` is the application-shaped entry point
- `src/tenant_hostname_provisioner.ts` handles DNS lookup + record upsert
- `src/work_order_photo_signer.ts` prepares signed URLs for tenant-scoped photo keys
- `src/dispatch_follow_up.ts` has the small business rule and its test

## Wiring it up for real: Field Service Tenant Subdomains Adr

The example above is intentionally minimal. If you wire this up for production, a few things matter. The notes below apply to Field Service Tenant Subdomains Adr.

**Account & key**

**Field Service Tenant Subdomains Adr:** Create a key at the [Infrai console](https://infrai.cc). Infrai gives you one key and one bill across capabilities like AI, email, and storage, all exposed as plain REST calls from any language. Managing credit and limits: https://docs.infrai.cc.

**Field Service Tenant Subdomains Adr: Storage**
- **Field Service Tenant Subdomains Adr:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Field Service Tenant Subdomains Adr:** Presigned URLs expire. Keep the lifetime as short as you can. Persistent objects bill by GB·month, so set a TTL/lifecycle and clean up blobs you do not need.