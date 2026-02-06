import { ApifyClient } from 'apify-client';
import { nextScanIndex } from '../store';

export interface ReviewFinding {
  author: string;
  rating: number;
  text: string;
  publishedAt: string;
  source: string;
}

export interface ScoutResult {
  reviews: ReviewFinding[];
  profileData?: {
    rating: number;
    totalReviews: number;
    name: string;
  };
}

export async function scoutBusiness(
  placeId: string,
  businessName: string
): Promise<ScoutResult> {
  // Try Apify for business profile data, fall back to seed reviews if none found
  let apifyProfile: ScoutResult['profileData'] | undefined;

  if (process.env.APIFY_DATASET_ID) {
    try {
      const result = await fetchApifyDataset(process.env.APIFY_DATASET_ID);
      apifyProfile = result.profileData;
      if (result.reviews.length > 0) return result;
    } catch (e) {
      console.error('[Scout] Dataset fetch failed:', e);
    }
  }

  if (process.env.APIFY_API_TOKEN && placeId && !apifyProfile) {
    try {
      const result = await runApifyActor(placeId);
      apifyProfile = result.profileData;
      if (result.reviews.length > 0) return result;
    } catch (e) {
      console.error('[Scout] Apify actor failed:', e);
    }
  }

  // Seed reviews with real profile data from Apify if available
  const seed = seedScout(businessName);
  if (apifyProfile) {
    seed.profileData = apifyProfile;
  }
  return seed;
}

async function fetchApifyDataset(datasetId: string): Promise<ScoutResult> {
  const client = new ApifyClient({
    token: process.env.APIFY_API_TOKEN,
  });

  const { items } = await client.dataset(datasetId).listItems({ limit: 10 });

  if (!items.length) throw new Error('Empty dataset');

  const reviews: ReviewFinding[] = [];
  for (const item of items) {
    const place = item as Record<string, unknown>;
    const placeReviews = (place.reviews as Array<Record<string, unknown>>) || [];
    for (const r of placeReviews) {
      reviews.push({
        author: (r.name as string) || (r.author as string) || 'Anonymous',
        rating: (r.stars as number) || (r.rating as number) || 3,
        text: (r.text as string) || (r.snippet as string) || '',
        publishedAt:
          (r.publishedAtDate as string) || new Date().toISOString(),
        source: 'google',
      });
    }
  }

  // Return one review per scan to simulate real-time detection
  const idx = nextScanIndex();
  return {
    reviews: reviews.length ? [reviews[idx % reviews.length]] : [],
    profileData: items[0]
      ? {
          rating:
            (items[0] as Record<string, unknown>).totalScore as number ||
            (items[0] as Record<string, unknown>).rating as number ||
            4.2,
          totalReviews:
            (items[0] as Record<string, unknown>).reviewsCount as number || 47,
          name:
            (items[0] as Record<string, unknown>).title as string ||
            'Business',
        }
      : undefined,
  };
}

async function runApifyActor(placeId: string): Promise<ScoutResult> {
  const client = new ApifyClient({
    token: process.env.APIFY_API_TOKEN!,
  });

  const actorId = process.env.APIFY_ACTOR_ID || 'apify/google-maps-scraper';

  const run = await client.actor(actorId).call(
    {
      startUrls: [
        {
          url: `https://www.google.com/maps/place/?q=place_id:${placeId}`,
        },
      ],
      maxReviews: 5,
      language: 'en',
    },
    { timeout: 120000 } as Record<string, unknown>
  );

  return fetchApifyDataset(run.defaultDatasetId);
}

function seedScout(businessName: string): ScoutResult {
  // Ordered for demo flow: positive → negative → neutral → critical → good
  const seedReviews: ReviewFinding[] = [
    {
      author: 'Michael R.',
      rating: 5,
      text: 'Outstanding service from start to finish. Professional, knowledgeable, and always available when I had questions. Closed on my dream home in 3 weeks.',
      publishedAt: new Date().toISOString(),
      source: 'google',
    },
    {
      author: 'Jane D.',
      rating: 2,
      text: 'Very slow to respond to my inquiries. I waited 3 days for a callback and when they finally reached out, the agent seemed unprepared. Would not recommend.',
      publishedAt: new Date(Date.now() - 86400000).toISOString(),
      source: 'google',
    },
    {
      author: 'Sarah K.',
      rating: 3,
      text: 'Decent experience overall but felt like they were juggling too many clients. Communication could be better. The end result was fine though.',
      publishedAt: new Date(Date.now() - 172800000).toISOString(),
      source: 'google',
    },
    {
      author: 'David L.',
      rating: 1,
      text: 'Terrible experience. Missed two scheduled showings and never apologized. Found a much better agent elsewhere. Save yourself the headache.',
      publishedAt: new Date(Date.now() - 259200000).toISOString(),
      source: 'google',
    },
    {
      author: 'Emily W.',
      rating: 4,
      text: 'Good overall. Very knowledgeable about the local market and helped us negotiate a fair price. Only downside was occasional slow email responses.',
      publishedAt: new Date(Date.now() - 345600000).toISOString(),
      source: 'google',
    },
  ];

  // Use random selection on serverless (scan counter resets per Lambda)
  const idx = typeof globalThis !== 'undefined' && (globalThis as Record<string, unknown>).__store
    ? nextScanIndex()
    : Math.floor(Math.random() * seedReviews.length);
  return {
    reviews: [seedReviews[idx % seedReviews.length]],
    profileData: {
      rating: 4.2,
      totalReviews: 47,
      name: businessName,
    },
  };
}
