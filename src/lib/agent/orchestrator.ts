import * as Sentry from '@sentry/nextjs';
import { scoutBusiness } from './scout';
import { analyzeFinding } from './analyst';
import { executeActions } from './action';
import {
  addEvent,
  updateEvent,
  updateScore,
  log,
  getFeedbackHistory,
} from '../store';

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function runAgentCycle(
  businessId: string,
  businessName: string,
  placeId: string
) {
  log(`Scout scanning for ${businessName}...`, 'info');

  const findings = await scoutBusiness(placeId, businessName);
  log(
    `Found ${findings.reviews.length} review(s)${findings.profileData ? ` — profile rating: ${findings.profileData.rating}` : ''}`,
    'info'
  );

  for (const review of findings.reviews) {
    const event = addEvent({
      businessId,
      businessName,
      eventType: 'review_detected',
      source: review.source || 'google',
      severity:
        review.rating <= 2
          ? 'critical'
          : review.rating <= 3
            ? 'high'
            : review.rating <= 4
              ? 'medium'
              : 'low',
      rawData: { ...review } as Record<string, unknown>,
    });

    log(
      `${review.rating}-star review from ${review.author} — classifying...`,
      review.rating <= 2 ? 'error' : 'info'
    );
    updateEvent(event.id, { status: 'analyzing' });

    // Small delay so the polling dashboard catches intermediate states
    await sleep(600);

    try {
      const analysis = await analyzeFinding(
        review,
        businessName,
        getFeedbackHistory()
      );

      updateEvent(event.id, {
        classification: analysis.classification,
        responseDrafted: analysis.draftedResponse,
        status: 'acting',
      });

      log(
        `Classified: ${analysis.classification.sentiment} (${analysis.classification.credibilityImpact > 0 ? '+' : ''}${analysis.classification.credibilityImpact} pts) — ${analysis.reasoning}`,
        analysis.classification.sentiment === 'negative' ? 'error' : 'success'
      );

      await sleep(400);

      const actions = await executeActions(event, analysis);

      updateEvent(event.id, {
        actionsTaken: actions,
        status: 'complete',
      });

      updateScore(analysis.classification.credibilityImpact);

      const succeeded = actions.filter(
        (a) => a.details.status !== 'failed'
      ).length;
      log(
        `Pipeline complete: ${succeeded}/${actions.length} actions succeeded`,
        'success'
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      Sentry.captureException(err);
      updateEvent(event.id, { status: 'error' });
      log(`Error processing review: ${message}`, 'error');
    }
  }
}
