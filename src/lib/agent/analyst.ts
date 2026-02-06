// Groq API — OpenAI-compatible, fast inference
// Free tier at console.groq.com

export interface AnalysisResult {
  classification: {
    sentiment: 'positive' | 'neutral' | 'negative';
    themes: string[];
    credibilityImpact: number;
    urgency: 'low' | 'medium' | 'high';
  };
  draftedResponse: string;
  reasoning: string;
}

interface FeedbackEntry {
  eventId: string;
  feedback: string;
  original: string;
  modified?: string;
}

export async function analyzeFinding(
  review: { author: string; rating: number; text: string },
  businessName: string,
  feedbackHistory: FeedbackEntry[] = []
): Promise<AnalysisResult> {
  // Self-improvement: include past feedback in the prompt
  const feedbackContext =
    feedbackHistory.length > 0
      ? `\n\nPrevious feedback on your drafted responses (learn from this):
${feedbackHistory
  .slice(-5)
  .map(
    (f) =>
      `- You drafted: "${f.original}" → Operator ${f.feedback}${f.modified ? ` and changed to: "${f.modified}"` : ''}`
  )
  .join('\n')}
Adjust your tone and approach based on these signals.`
      : '';

  const prompt = `You are a credibility intelligence agent analyzing a customer review for "${businessName}".

Review details:
- Author: ${review.author}
- Rating: ${review.rating}/5
- Text: "${review.text}"
${feedbackContext}

Analyze this review and respond with ONLY valid JSON (no markdown, no code fences, no trailing commas).
IMPORTANT: Do NOT use quotation marks inside string values. Use single quotes or apostrophes instead.

Example format:
{"classification":{"sentiment":"negative","themes":["slow response","unprepared"],"credibilityImpact":-8,"urgency":"high"},"draftedResponse":"We sincerely apologize for your experience. We take response times seriously and are addressing this with our team. We would love the opportunity to make this right.","reasoning":"Negative review citing slow response and lack of preparation indicates service quality issues."}`;

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY not set in environment variables');
  }

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 600,
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Groq API request failed (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || '';

  // Try parsing, with progressively more aggressive cleanup
  const candidates = [
    text,
    text.match(/\{[\s\S]*\}/)?.[0],
  ].filter(Boolean) as string[];

  for (const raw of candidates) {
    try {
      return JSON.parse(raw) as AnalysisResult;
    } catch {
      // Try fixing common LLM JSON issues: trailing commas, unescaped quotes
      try {
        const fixed = raw
          .replace(/,\s*}/g, '}')
          .replace(/,\s*]/g, ']');
        return JSON.parse(fixed) as AnalysisResult;
      } catch {
        continue;
      }
    }
  }

  // Last resort: return a safe default so the pipeline doesn't break
  console.error('[Analyst] Failed to parse:', text.slice(0, 300));
  return {
    classification: {
      sentiment: review.rating >= 4 ? 'positive' : review.rating <= 2 ? 'negative' : 'neutral',
      themes: ['review'],
      credibilityImpact: review.rating >= 4 ? 5 : review.rating <= 2 ? -8 : 0,
      urgency: review.rating <= 2 ? 'high' : 'low',
    },
    draftedResponse: `Thank you for your feedback, ${review.author}. We appreciate you taking the time to share your experience and will use it to improve our service.`,
    reasoning: 'Fallback classification based on star rating (LLM response was malformed).',
  };
}
