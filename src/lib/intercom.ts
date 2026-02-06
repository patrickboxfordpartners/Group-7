// Intercom API client for agent notifications

const headers = () => ({
  Authorization: `Bearer ${process.env.INTERCOM_ACCESS_TOKEN}`,
  'Content-Type': 'application/json',
  'Intercom-Version': '2.11',
});

let contactId: string | null = null;

async function ensureContact(): Promise<string> {
  if (contactId) return contactId;

  const email =
    process.env.INTERCOM_TEST_USER_EMAIL || 'demo@boxfordpartners.com';

  // Try to find existing contact
  const searchRes = await fetch('https://api.intercom.io/contacts/search', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      query: { field: 'email', operator: '=', value: email },
    }),
  });

  if (searchRes.ok) {
    const data = await searchRes.json();
    if (data.data?.length > 0) {
      contactId = data.data[0].id;
      return contactId!;
    }
  }

  // Create contact if not found
  const createRes = await fetch('https://api.intercom.io/contacts', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      role: 'user',
      email,
      name: 'Demo Operator',
    }),
  });

  if (!createRes.ok) {
    const text = await createRes.text().catch(() => '');
    // Handle 409 conflict — contact already exists, extract ID from error
    if (createRes.status === 409) {
      const match = text.match(/id=([a-f0-9]+)/);
      if (match) {
        contactId = match[1];
        return contactId!;
      }
    }
    throw new Error(`Intercom contact creation failed (${createRes.status}): ${text}`);
  }

  const contact = await createRes.json();
  contactId = contact.id;
  return contactId!;
}

interface MessagePayload {
  body: string;
}

export async function sendIntercomMessage(
  data: MessagePayload
): Promise<{ skipped?: boolean }> {
  const token = process.env.INTERCOM_ACCESS_TOKEN;
  if (!token) {
    console.log('[Intercom] No access token configured, skipping');
    return { skipped: true };
  }

  const userContactId = await ensureContact();

  // Create a conversation with the full alert content.
  // This shows up directly in the Intercom Messenger and admin inbox.
  const convoRes = await fetch('https://api.intercom.io/conversations', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      from: { type: 'user', id: userContactId },
      body: data.body,
    }),
  });

  if (!convoRes.ok) {
    const text = await convoRes.text().catch(() => '');
    throw new Error(`Intercom conversation failed (${convoRes.status}): ${text}`);
  }

  return convoRes.json();
}
