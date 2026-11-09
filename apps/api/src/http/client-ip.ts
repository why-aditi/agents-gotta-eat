// Who is the client behind the proxies (Cloudflare, then Render's own proxy, in front of the api)?
//
// The old rule trusted a fixed number of X-Forwarded-For entries counted from the right (`i < hops`). That is only
// right when the chain has exactly that many hops, and the hosted chain does not hold still (Render's internal
// proxy addresses and the Cloudflare edge addresses are appended per request). With the count off by one, req.ip
// became a proxy's own address, which changes from request to request, so no per-IP counter ever accumulated and
// the failed-auth limiter never answered 429.
//
// Now trust is decided by the address, not the position: walking X-Forwarded-For from the right (the socket peer
// first), an entry is skipped only when it is a private/loopback/link-local address (Render's internal network) or
// a published Cloudflare range (or one listed in TRUST_PROXY_CIDRS). The first entry that is neither is the client:
// it is what the outermost trusted proxy saw connect. Everything to its left is client-supplied and ignored, so a
// caller cannot pick its own bucket by forging X-Forwarded-For, and a caller that reaches the api without a proxy
// is keyed on its socket address. The number of hops no longer matters.
import { BlockList, isIP } from "node:net";

// https://www.cloudflare.com/ips-v4 and /ips-v6
const CLOUDFLARE_V4 = [
  "173.245.48.0/20",
  "103.21.244.0/22",
  "103.22.200.0/22",
  "103.31.4.0/22",
  "141.101.64.0/18",
  "108.162.192.0/18",
  "190.93.240.0/20",
  "188.114.96.0/20",
  "197.234.240.0/22",
  "198.41.128.0/17",
  "162.158.0.0/15",
  "104.16.0.0/13",
  "104.24.0.0/14",
  "172.64.0.0/13",
  "131.0.72.0/22",
];
const CLOUDFLARE_V6 = [
  "2400:cb00::/32",
  "2606:4700::/32",
  "2803:f800::/32",
  "2405:b500::/32",
  "2405:8100::/32",
  "2a06:98c0::/29",
  "2c0f:f248::/32",
];
const PRIVATE_V4 = ["10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16", "127.0.0.0/8", "169.254.0.0/16", "100.64.0.0/10"];
const PRIVATE_V6 = ["::1/128", "fc00::/7", "fe80::/10"];

function add(list: BlockList, cidrs: string[], family: "ipv4" | "ipv6") {
  for (const c of cidrs) {
    const [net, bits] = c.split("/");
    if (net && bits) list.addSubnet(net, Number(bits), family);
  }
}

// "::ffff:1.2.3.4" is the IPv4 address 1.2.3.4.
function normalize(addr: string): string {
  const m = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(addr.trim());
  return m?.[1] ?? addr.trim();
}

// Extra trusted proxy ranges: a comma-separated list of CIDRs or single addresses (TRUST_PROXY_CIDRS).
export function buildProxyTrust(extra?: string): (address: string) => boolean {
  const list = new BlockList();
  add(list, [...CLOUDFLARE_V4, ...PRIVATE_V4], "ipv4");
  add(list, [...CLOUDFLARE_V6, ...PRIVATE_V6], "ipv6");
  for (const raw of (extra ?? "").split(",")) {
    const entry = raw.trim();
    if (!entry) continue;
    const [net = "", bits] = entry.split("/");
    const family = isIP(net) === 6 ? "ipv6" : isIP(net) === 4 ? "ipv4" : undefined;
    if (!family) continue;
    if (bits === undefined) list.addAddress(net, family);
    else if (/^\d{1,3}$/.test(bits)) list.addSubnet(net, Number(bits), family);
  }
  return (address) => {
    const a = normalize(address);
    const family = isIP(a);
    return family === 0 ? false : list.check(a, family === 6 ? "ipv6" : "ipv4");
  };
}

// `trustProxy` function for Fastify (proxy-addr calls it with each address from the socket peer leftwards).
export function proxyTrustFn(extra?: string): (address: string, hop: number) => boolean {
  const trusted = buildProxyTrust(extra);
  return (address) => trusted(address);
}

// Whether TRUST_PROXY_HOPS asks for proxy trust at all: any positive number (its size no longer matters).
export function proxyTrustEnabled(hopsEnv: string | undefined): boolean {
  const hops = Number.parseInt(hopsEnv ?? "", 10);
  return Number.isInteger(hops) && hops > 0;
}

// The visitor address the web server forwards on /v1/demo/*: the first X-Forwarded-For entry. Client-supplied, so
// only for the casual demo limit; the failed-auth and request limits use req.ip. Without proxy trust: req.ip.
export function demoClientIp(
  req: { ip: string; headers: Record<string, string | string[] | undefined> },
  trustProxy: boolean,
): string {
  if (!trustProxy) return req.ip;
  const xff = req.headers["x-forwarded-for"];
  const first = (Array.isArray(xff) ? xff[0] : xff)?.split(",")[0]?.trim();
  return first && isIP(first) ? first : req.ip;
}
