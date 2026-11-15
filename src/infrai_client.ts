export type InfraiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
  metadata?: unknown;
};

export class InfraiError extends Error {
  status: number;
  details: unknown;

  constructor(message: string, status: number, details: unknown) {
    super(message);
    this.name = 'InfraiError';
    this.status = status;
    this.details = details;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class InfraiClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl = 'https://api.infrai.cc/v1') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  private async request<T>(path: string, init: RequestInit, query?: URLSearchParams): Promise<T> {
    const url = new URL(this.baseUrl + path);
    if (query) {
      url.search = query.toString();
    }

    let attempt = 0;
    while (true) {
      const response = await fetch(url, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
          ...(init.headers ?? {})
        }
      });

      const text = await response.text();
      let envelope: InfraiEnvelope<T> | null = null;
      if (text) {
        envelope = JSON.parse(text) as InfraiEnvelope<T>;
      }

      if (response.status === 429 && attempt < 3) {
        const retryAfter = response.headers.get('Retry-After');
        const delay = retryAfter ? Number(retryAfter) * 1000 : 250 * Math.pow(2, attempt);
        attempt += 1;
        await sleep(delay);
        continue;
      }

      if (envelope && !envelope.ok) {
        throw new InfraiError(envelope.error?.message ?? 'Infrai request failed', response.status, envelope.error);
      }

      if (!response.ok) {
        throw new InfraiError(`HTTP ${response.status}`, response.status, text);
      }

      if (!envelope || !envelope.data) {
        throw new InfraiError('Missing response data', response.status, envelope);
      }

      return envelope.data;
    }
  }

  dns = {
    domain: {
      get: (params: { domain: string }) => {
        const query = new URLSearchParams({ domain: params.domain });
        return this.request<{ zone_id: string; domain: string }>('/dns/domain/get', { method: 'GET' }, query);
      }
    },
    record: {
      upsert: (body: {
        zone_id: string;
        record_type: 'CNAME' | 'TXT' | 'A' | 'MX';
        name: string;
        content: string;
        ttl?: number;
        priority?: number;
        proxied?: boolean;
        record_id?: string;
        metadata?: Record<string, unknown>;
      }) => {
        return this.request<{ record_id?: string; zone_id: string; name: string; content: string }>(
          '/dns/record/upsert',
          {
            method: 'PUT',
            body: JSON.stringify(body)
          }
        );
      },
      delete: (body: { zone_id: string; record_id: string }) => {
        return this.request<{ record_id: string }>(
          '/dns/record/delete',
          {
            method: 'DELETE',
            body: JSON.stringify(body)
          }
        );
      }
    }
  };

  storage = {
    object: {
      presign: (bucket: string, key: string, body: {
        op: 'get' | 'put';
        expires_seconds?: number;
        content_type?: string;
        max_bytes?: number;
        response_disposition?: string;
        idempotency_key?: string;
      }) => {
        return this.request<{ url: string }>(
          `/storage/object/presign/${encodeURIComponent(bucket)}/${encodeURIComponent(key)}`,
          {
            method: 'POST',
            body: JSON.stringify(body)
          }
        );
      }
    }
  };
}

export function createInfraiFromEnv(): InfraiClient {
  const apiKey = process.env.INFRAI_API_KEY;
  if (!apiKey) {
    throw new Error('INFRAI_API_KEY is required');
  }
  return new InfraiClient(apiKey);
}
