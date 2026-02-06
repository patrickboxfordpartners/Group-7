// Intercom API client for agent notifications

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

  const res = await fetch('https://api.intercom.io/messages', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Intercom-Version': '2.11',
    },
    body: JSON.stringify({
      message_type: 'inapp',
      body: data.body,
      from: {
        type: 'admin',
        id: process.env.INTERCOM_ADMIN_ID || '',
      },
      to: {
        type: 'user',
        email: process.env.INTERCOM_TEST_USER_EMAIL || 'demo@boxfordpartners.com',
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Intercom message failed (${res.status}): ${text}`);
  }

  return res.json();
}
