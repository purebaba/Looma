const HONEYPOT_FIELD = "_loomaWebsite";
const WINDOW_MS = 60_000;
const MAX_SUBMISSIONS_PER_WINDOW = 10;

type Bucket = {
  resetAt: number;
  count: number;
};

const buckets = new Map<string, Bucket>();

export function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || null;
  }

  return (
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    null
  );
}

export function hasHoneypotValue(body: Record<string, unknown>) {
  return typeof body[HONEYPOT_FIELD] === "string" && body[HONEYPOT_FIELD].trim() !== "";
}

export function checkSubmissionRateLimit({
  formId,
  clientIp,
  now = Date.now(),
}: {
  formId: string;
  clientIp: string | null;
  now?: number;
}) {
  const key = `${formId}:${clientIp || "anonymous"}`;
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, retryAfter: 0 };
  }

  if (current.count >= MAX_SUBMISSIONS_PER_WINDOW) {
    return {
      allowed: false,
      retryAfter: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    };
  }

  current.count += 1;
  return { allowed: true, retryAfter: 0 };
}
