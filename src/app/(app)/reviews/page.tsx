import Link from 'next/link';
import { ExternalLink, Star } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { getYelpBusiness, yelpConfigured, type YelpBusiness } from '@/lib/yelp';
import { Stars } from '@/components/stars';

export const dynamic = 'force-dynamic';

const fmtDate = (iso: string) => (iso ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(iso)) : '');

export default async function ReviewsPage() {
  await requireRole('super_admin', 'manager');
  const supabase = await createClient();
  const { data: locs } = await supabase
    .from('locations')
    .select('id, name, yelp_url, yelp_business_id')
    .eq('is_active', true)
    .order('name');
  const locations = (locs ?? []) as { id: string; name: string; yelp_url: string | null; yelp_business_id: string | null }[];
  const configured = yelpConfigured();

  const results = await Promise.all(
    locations.map(async (l) => {
      const id = l.yelp_business_id || null;
      const biz = configured && id ? await getYelpBusiness(id) : null;
      return { loc: l, biz };
    })
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-brand-900">Reviews</h1>
        <p className="text-sm text-brand-600">Live Yelp ratings &amp; recent reviews by store.</p>
      </div>

      {!configured && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Yelp isn&apos;t connected yet. Add the <span className="font-medium">YELP_API_KEY</span> in Netlify, then paste each store&apos;s Yelp page URL in <span className="font-medium">Admin → each location → Reviews</span>.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {results.map(({ loc, biz }) => (
          <ReviewCard key={loc.id} name={loc.name} url={loc.yelp_url} biz={biz} configured={configured} fmtDate={fmtDate} />
        ))}
      </div>

      <p className="flex items-center justify-center gap-1 text-center text-xs text-brand-400">
        <Star size={11} className="text-gold-500" /> Ratings &amp; reviews from Yelp · full reviews on yelp.com
      </p>
    </div>
  );
}

function ReviewCard({
  name, url, biz, configured, fmtDate,
}: {
  name: string;
  url: string | null;
  biz: YelpBusiness | null;
  configured: boolean;
  fmtDate: (iso: string) => string;
}) {
  return (
    <section className="card space-y-3">
      <div className="flex items-start justify-between gap-2">
        <h2 className="font-semibold text-brand-900">{name}</h2>
        {url && (
          <a href={url} target="_blank" rel="noopener noreferrer" className="flex shrink-0 items-center gap-1 text-xs font-medium text-brand-700 hover:underline">
            Yelp <ExternalLink size={12} />
          </a>
        )}
      </div>

      {!url ? (
        <p className="text-sm text-brand-500">No Yelp page linked — add it in Admin → this location.</p>
      ) : !configured ? (
        <p className="text-sm text-brand-500">Connect the Yelp API key to load this rating.</p>
      ) : !biz ? (
        <p className="text-sm text-brand-500">Couldn&apos;t load Yelp data right now.</p>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <Stars rating={biz.rating} size={18} />
            <span className="text-lg font-bold tabular-nums text-brand-900">{biz.rating.toFixed(1)}</span>
            <span className="text-sm text-brand-500">· {biz.review_count.toLocaleString()} reviews</span>
          </div>
          {biz.reviews.length > 0 && (
            <ul className="space-y-2 border-t border-brand-50 pt-2">
              {biz.reviews.map((r) => (
                <li key={r.id}>
                  <a href={r.url} target="_blank" rel="noopener noreferrer" className="block rounded-lg p-1 hover:bg-brand-50">
                    <div className="mb-0.5 flex items-center gap-2">
                      <Stars rating={r.rating} size={12} />
                      <span className="text-xs font-medium text-brand-700">{r.user}</span>
                      <span className="text-[10px] text-brand-400">{fmtDate(r.time_created)}</span>
                    </div>
                    <p className="line-clamp-3 text-sm text-brand-700">{r.text}</p>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
