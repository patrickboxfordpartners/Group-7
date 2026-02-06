import { postToCrmInbox } from '../crm';
import { sendIntercomMessage } from '../intercom';
import { publishEvent } from '../redpanda';
import { log, type CredibilityEvent } from '../store';
import type { AnalysisResult } from './analyst';

interface ActionRecord {
  type: string;
  details: Record<string, unknown>;
  timestamp: string;
}

export async function executeActions(
  event: CredibilityEvent,
  analysis: AnalysisResult
): Promise<ActionRecord[]> {
  const actions: ActionRecord[] = [];
  const now = () => new Date().toISOString();
  const review = event.rawData as {
    author: string;
    rating: number;
    text: string;
  };

  // 1. Create inbox item in CRM
  try {
    const crmResult = await postToCrmInbox({
      workspace_id: process.env.CRM_WORKSPACE_ID || '',
      from: review.author,
      subject: `${analysis.classification.sentiment} review detected (${review.rating} star)`,
      preview: review.text?.substring(0, 200),
      classification:
        analysis.classification.sentiment === 'negative' ? 'risk' : 'opportunity',
      recommended_action: analysis.draftedResponse,
    });
    actions.push({
      type: 'crm_inbox',
      details: { status: 'created', id: crmResult?.id },
      timestamp: now(),
    });
    log('Created inbox item in CRM', 'success');
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    actions.push({
      type: 'crm_inbox',
      details: { status: 'failed', error: msg },
      timestamp: now(),
    });
    log(`CRM inbox failed: ${msg}`, 'error');
  }

  // 2. Send Intercom notification
  try {
    const urgencyLabel = analysis.classification.urgency.toUpperCase();
    const impactStr = `${analysis.classification.credibilityImpact > 0 ? '+' : ''}${analysis.classification.credibilityImpact}`;
    const dashboardUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'https://hackathon-agent-ruddy.vercel.app';
    const result = await sendIntercomMessage({
      body: `<b>${urgencyLabel}: ${review.rating}-star review from ${review.author}</b><br><br>"${review.text}"<br><br><b>Credibility impact:</b> ${impactStr} pts<br><br><b>Drafted response:</b><br>${analysis.draftedResponse}<br><br><a href="${dashboardUrl}">Open dashboard to accept or reject →</a>`,
    });
    actions.push({
      type: 'intercom_alert',
      details: { status: result.skipped ? 'skipped' : 'sent' },
      timestamp: now(),
    });
    if (!result.skipped) {
      log('Sent Intercom notification', 'success');
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    actions.push({
      type: 'intercom_alert',
      details: { status: 'failed', error: msg },
      timestamp: now(),
    });
    log(`Intercom failed: ${msg}`, 'error');
  }

  // 3. Publish to Redpanda event stream
  try {
    const result = await publishEvent('credibility-events', {
      id: event.id,
      businessId: event.businessId,
      eventType: event.eventType,
      severity: event.severity,
      classification: analysis.classification,
      detectedAt: event.detectedAt,
    });
    actions.push({
      type: 'redpanda_event',
      details: { status: result.skipped ? 'skipped' : 'published' },
      timestamp: now(),
    });
    if (!result.skipped) {
      log('Published event to Redpanda stream', 'success');
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    actions.push({
      type: 'redpanda_event',
      details: { status: 'failed', error: msg },
      timestamp: now(),
    });
  }

  return actions;
}
