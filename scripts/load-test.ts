/**
 * Minimal load test on the essential public journeys (no external tool needed).
 * Usage: pnpm tsx scripts/load-test.ts --base http://localhost:3200 --concurrency 20 --duration 20
 * Reports requests/s, error rate and latency percentiles per route. Numbers are
 * only meaningful against `pnpm build && pnpm start` (production build).
 */
type Sample = { route: string; ms: number; status: number };

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? (process.argv[i + 1] ?? fallback) : fallback;
}

const base = arg("base", "http://localhost:3200");
const concurrency = Number(arg("concurrency", "20"));
const durationSec = Number(arg("duration", "20"));
const routes = arg("routes", "/,/annuaire,/annuaire/garde-enfants-evenementielle,/tarifs,/api/health,/connexion").split(",");

async function worker(samples: Sample[], deadline: number) {
  let i = 0;
  while (Date.now() < deadline) {
    const route = routes[i++ % routes.length]!;
    const t0 = performance.now();
    try {
      const res = await fetch(base + route, { headers: { accept: "text/html" } });
      await res.arrayBuffer();
      samples.push({ route, ms: performance.now() - t0, status: res.status });
    } catch {
      samples.push({ route, ms: performance.now() - t0, status: 0 });
    }
  }
}

function pct(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] ?? 0;
}

async function main() {
  const samples: Sample[] = [];
  const deadline = Date.now() + durationSec * 1000;
  await Promise.all(Array.from({ length: concurrency }, () => worker(samples, deadline)));
  const byRoute = new Map<string, Sample[]>();
  for (const s of samples) byRoute.set(s.route, [...(byRoute.get(s.route) ?? []), s]);
  const rows = [...byRoute.entries()].map(([route, list]) => {
    const sorted = list.map((s) => s.ms).sort((a, b) => a - b);
    const errors = list.filter((s) => s.status === 0 || s.status >= 500).length;
    return { route, n: list.length, rps: (list.length / durationSec).toFixed(1), p50: pct(sorted, 50).toFixed(0), p95: pct(sorted, 95).toFixed(0), p99: pct(sorted, 99).toFixed(0), errors };
  });
  const total = samples.length;
  const totalErrors = samples.filter((s) => s.status === 0 || s.status >= 500).length;
  process.stdout.write(`${JSON.stringify(rows, null, 2)}\n`);
  process.stdout.write(`total ${total} req in ${durationSec}s @ ${concurrency} concurrent → ${(total / durationSec).toFixed(1)} req/s, ${totalErrors} errors (${((100 * totalErrors) / Math.max(1, total)).toFixed(2)}%)\n`);
}

main().catch((e) => {
  process.stderr.write(`${String(e)}\n`);
  process.exit(1);
});
