import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

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

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 600,
    messages: [
      {
        role: 'user',
        content: `You are a credibility intelligence agent analyzing a customer review for "${businessName}".

Review details:
- Author: ${review.author}
- Rating: ${review.rating}/5
- Text: "${review.text}"
${feedbackContext}

Analyze this review and respond with ONLY valid JSON (no markdown, no code fences):
{
  "classification": {
    "sentiment": "positive" or "neutral" or "negative",
    "themes": ["theme1", "theme2"],
    "credibilityImpact": <integer from -20 to +10, negative reviews should be negative>,
    "urgency": "low" or "medium" or "high"
  },
  "draftedResponse": "<professional, empathetic response to post as a reply to this review, 2-3 sentences>",
  "reasoning": "<one sentence explaining your analysis>"
}`,
      },
    ],
  });

  const text =
    message.content[0].type === 'text' ? message.content[0].text : '';

  try {
    return JSON.parse(text) as AnalysisResult;
  } catch {
    // Fallback if Claude returns markdown-wrapped JSON
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as AnalysisResult;
    }
    throw new Error(`Failed to parse analyst response: ${text.slice(0, 200)}`);
  }
}
