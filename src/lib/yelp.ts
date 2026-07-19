/**
 * Yelp Fusion API. Fetches a business's live rating, review count, and up to a
 * few recent review excerpts. Requires YELP_API_KEY (Netlify env). Yelp's terms
 * only expose rating, review_count, and 3 truncated review excerpts — full
 * reviews and replies live on Yelp itself, so we always link back.
 */

const API = 'https://api.yelp.com/v3';

export type YelpReview = {
  id: string;
  rating: number;
  text: string;
  time_created: string;
  user: string;
  url: string;
};

export type YelpBusiness = {
  id: string;
  name: string;
  rating: number;
  review_count: number;
  url: string;
  reviews: YelpReview[];
};

export const yelpConfigured = () => !!process.env.YELP_API_KEY;

/** Pull the business alias out of a Yelp page URL (…/biz/<alias>). */
export function yelpAliasFromUrl(url: string | null): string | null {
  if (!url) return null;
  const m = url.match(/\/biz\/([^/?#]+)/i);
  return m ? m[1] : null;
}

async function yfetch(path: string): Promise<Response | null> {
  const key = process.env.YELP_API_KEY;
  if (!key) return null;
  try {
    return await fetch(`${API}${path}`, {
      headers: { Authorization: `Bearer ${key}` },
      // Cache hourly to respect Yelp's rate limits.
      next: { revalidate: 3600 },
    });
  } catch {
    return null;
  }
}

/** Rating + review count + up to 3 recent excerpts for one business (id/alias). */
export async function getYelpBusiness(idOrAlias: string): Promise<YelpBusiness | null> {
  const bizRes = await yfetch(`/businesses/${encodeURIComponent(idOrAlias)}`);
  if (!bizRes || !bizRes.ok) return null;
  const b = await bizRes.json();

  let reviews: YelpReview[] = [];
  const revRes = await yfetch(`/businesses/${encodeURIComponent(idOrAlias)}/reviews?limit=3&sort_by=newest`);
  if (revRes && revRes.ok) {
    const r = await revRes.json();
    reviews = ((r.reviews ?? []) as Record<string, unknown>[]).map((rv) => ({
      id: String(rv.id),
      rating: Number(rv.rating) || 0,
      text: String(rv.text ?? ''),
      time_created: String(rv.time_created ?? ''),
      user: (rv.user as { name?: string })?.name ?? 'Yelp user',
      url: String(rv.url ?? b.url ?? ''),
    }));
  }

  return {
    id: String(b.id ?? idOrAlias),
    name: String(b.name ?? ''),
    rating: Number(b.rating) || 0,
    review_count: Number(b.review_count) || 0,
    url: String(b.url ?? ''),
    reviews,
  };
}
