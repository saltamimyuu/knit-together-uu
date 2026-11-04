// Netlify roept deze function automatisch aan bij elke geverifieerde formulierinzending
// (de bestandsnaam "submission-created" koppelt hem aan dat event).
// Stuurt de aanmelder een bevestigingsmail via Resend en zet hem als contact in Resend.
//
// Nodig in Netlify → Site configuration → Environment variables:
//   RESEND_API_KEY     bijv. re_xxxxxxxx  (Full access: contacts toevoegen kan niet met alleen Sending access)
//   MAIL_FROM          bijv. Knit Together <hallo@jouwdomein.nl>  (domein geverifieerd in Resend)
//   RESEND_SEGMENT_ID  optioneel: segment waar aanmelders in komen (Resend → Audience → Segments)

import { Resend } from 'resend';

const REPLY_TO = 'knittogether.uu@outlook.com';

const resend = new Resend(process.env.RESEND_API_KEY);

const escape = (s = '') =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Mislukt dit, dan loggen we het alleen: de bevestigingsmail is belangrijker.
const voegContactToe = async (email, naam) => {
  // Spaties of aanhalingstekens rond de waarde in Netlify maken het ID ongeldig.
  const segmentId = (process.env.RESEND_SEGMENT_ID || '').trim().replace(/^["']|["']$/g, '');
  if (!segmentId) console.warn('RESEND_SEGMENT_ID ontbreekt: contact komt niet in een segment');

  const [firstName = '', ...rest] = naam.trim().split(/\s+/);
  const contact = { email, firstName, lastName: rest.join(' '), unsubscribed: false };

  const { data, error } = await resend.contacts.create({
    ...contact,
    ...(segmentId && { segments: [{ id: segmentId }] }),
  });
  if (!error) return console.log('Resend contact aangemaakt', data?.id, segmentId ? `in segment ${segmentId}` : 'zonder segment');
  console.error('Resend contact error', error);
  if (!segmentId) return;

  // Bestaat het contact al (bijv. dubbele aanmelding), zet het dan alsnog in het segment.
  const { error: segmentError } = await resend.contacts.segments.add({ email, segmentId });
  if (!segmentError) return console.log('Resend bestaand contact aan segment toegevoegd', segmentId);
  console.error('Resend segment error', segmentId, segmentError);

  // Klopt het segment-ID niet, dan weigert Resend het hele contact. Maak het dan zonder segment aan.
  const { data: los, error: losError } = await resend.contacts.create(contact);
  if (!losError) return console.log('Resend contact aangemaakt zonder segment (segment-ID klopt niet?)', los?.id);
  console.error('Resend contact error (zonder segment)', losError);
};

export const handler = async (event) => {
  const { payload } = JSON.parse(event.body);
  if (payload.form_name !== 'aanmelding') return { statusCode: 200 };

  const { naam = '', email, wat = '' } = payload.data;
  if (!email) return { statusCode: 200 };

  const voornaam = naam.trim().split(/\s+/)[0] || 'daar';

  const text = `Hoi ${voornaam},

Je bent aangemeld voor Knit Together · Stitch & Chat!

Datum: donderdag 19 november
Tijd: 15:30 – 17:30
Plek: De Vagant, Budapestlaan 4c, Utrecht
Kosten: gratis
Je gaat: ${wat}

Neem je eigen brei- of haakproject mee. Geen les, gewoon gezellig samen breien of haken, kletsen en een kopje thee.

Vragen of toch verhinderd? Beantwoord gewoon deze mail.

Tot dan!
Knit Together`;

  const html = `<!doctype html>
<html lang="nl"><body style="margin:0;background:#FBF3EA;font-family:Calibri,'Segoe UI',sans-serif;color:#5B3B2F;">
  <div style="max-width:520px;margin:0 auto;padding:32px 20px;">
    <div style="background:#FFFBF6;border-radius:22px;padding:28px 24px;">
      <p style="margin:0 0 4px;font-size:14px;letter-spacing:.08em;text-transform:uppercase;color:#91766E;">Stitch &amp; Chat</p>
      <h1 style="margin:0 0 16px;font-family:Georgia,serif;font-size:30px;">Je bent aangemeld!</h1>
      <p style="font-size:17px;line-height:1.5;margin:0 0 20px;">Hoi ${escape(voornaam)}, leuk dat je komt! Hier nog even de details:</p>
      <table style="font-size:17px;line-height:1.6;border-collapse:collapse;">
        <tr><td style="color:#91766E;padding-right:16px;">Datum</td><td>donderdag 19 november</td></tr>
        <tr><td style="color:#91766E;padding-right:16px;">Tijd</td><td>15:30 – 17:30</td></tr>
        <tr><td style="color:#91766E;padding-right:16px;">Plek</td><td><a href="https://www.google.com/maps/search/?api=1&amp;query=De+Vagant+Budapestlaan+4c+Utrecht" style="color:#5B3B2F;">De Vagant, Budapestlaan 4c</a></td></tr>
        <tr><td style="color:#91766E;padding-right:16px;">Kosten</td><td>gratis</td></tr>
        <tr><td style="color:#91766E;padding-right:16px;">Je gaat</td><td>${escape(wat)}</td></tr>
      </table>
      <p style="font-size:17px;line-height:1.5;margin:20px 0 0;">Neem je eigen brei- of haakproject mee. Geen les, gewoon gezellig samen breien of haken, kletsen en een kopje thee.</p>
      <p style="font-size:15px;line-height:1.5;margin:20px 0 0;color:#7B5850;">Vragen of toch verhinderd? Beantwoord gewoon deze mail.</p>
    </div>
    <p style="text-align:center;font-size:14px;color:#7B5850;margin-top:20px;">Stitch &amp; Chat · Knit Together</p>
  </div>
</body></html>`;

  const [{ error }] = await Promise.all([
    resend.emails.send({
      from: process.env.MAIL_FROM,
      to: [email],
      replyTo: REPLY_TO,
      subject: 'Je bent aangemeld voor Knit Together 🧶',
      text,
      html,
    }),
    voegContactToe(email, naam).catch((err) => console.error('Resend contact error', err)),
  ]);

  if (error) {
    console.error('Resend error', error);
    return { statusCode: 502 };
  }
  return { statusCode: 200 };
};
