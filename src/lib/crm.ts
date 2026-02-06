// Client for your existing Boxford CRM API

const CRM_BASE_URL =
  process.env.CRM_BASE_URL || 'https://app.boxfordpartners.com';

interface InboxPayload {
  workspace_id: string;
  from: string;
  subject: string;
  preview?: string;
  classification: string;
  recommended_action?: string;
}

export async function postToCrmInbox(data: InboxPayload) {
  if (!data.workspace_id) {
    console.log('[CRM] No workspace ID configured, skipping');
    return { skipped: true };
  }

  const res = await fetch(`${CRM_BASE_URL}/api/inbox`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      workspace_id: data.workspace_id,
      from: data.from,
      subject: data.subject,
      preview: data.preview,
      classification: data.classification,
      recommended_action: data.recommended_action,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`CRM inbox POST failed (${res.status}): ${text}`);
  }

  return res.json();
}

interface LeadPayload {
  workspace_id: string;
  source: string;
  name: string;
  email: string;
  phone?: string;
  classification?: string;
  trust_signals?: string[];
  recommended_action?: string;
}

export async function createCrmLead(data: LeadPayload) {
  if (!data.workspace_id) {
    console.log('[CRM] No workspace ID configured, skipping');
    return { skipped: true };
  }

  const res = await fetch(`${CRM_BASE_URL}/api/leads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`CRM lead POST failed (${res.status}): ${text}`);
  }

  return res.json();
}
