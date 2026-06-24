// Supabase Edge Function: send-emergency-sms
// Twilio credentials are server-side only — never exposed to the client.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

interface EmergencyContact {
  name: string;
  phone: string;
}

interface RequestBody {
  contacts: EmergencyContact[];
  userName: string;
  locationText: string;
}

const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID') ?? '';
const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN') ?? '';
const TWILIO_FROM = Deno.env.get('TWILIO_FROM_NUMBER') ?? '';

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, content-type',
      },
    });
  }

  try {
    const { contacts, userName, locationText }: RequestBody = await req.json();

    const message = `BLINDAID EMERGENCY: ${userName} has activated their emergency alert.\n\nLive location: ${locationText}\n\nThis link updates in real time. Please call them or check on them immediately.\n\n— BlindAid by NeuroShine`;

    const results = await Promise.allSettled(
      contacts.map((contact) => sendSMS(contact.phone, message)),
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled').length;

    return new Response(
      JSON.stringify({ sent: succeeded, total: contacts.length }),
      { headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
});

async function sendSMS(to: string, body: string): Promise<void> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  const auth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);

  const params = new URLSearchParams({ To: to, From: TWILIO_FROM, Body: body });

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Twilio error ${resp.status}: ${text}`);
  }
}
