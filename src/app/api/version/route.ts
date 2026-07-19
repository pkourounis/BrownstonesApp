export const dynamic = 'force-dynamic';

/** Current deploy's build id (inlined at build). Clients compare this to their
 *  own to detect a new deploy and reload. */
export async function GET() {
  return new Response(JSON.stringify({ v: process.env.NEXT_PUBLIC_BUILD_ID ?? 'dev' }), {
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store, max-age=0' },
  });
}
