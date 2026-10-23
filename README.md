# Knit Together · Stitch & Chat

Aanmeldsite voor de brei- en haakmeetup, gebouwd met [Astro](https://astro.build) en gehost op Netlify.

## Lokaal draaien

Vereist Node.js 18.20.8 of nieuwer.

```bash
npm install
npm run dev
```

`npm run build` maakt de statische site in `dist/`.

## Structuur

- `src/pages/index.astro`: de pagina
- `src/components/`: Hero, Card, EventFacts, SignupForm
- `src/data/event.ts`: datum, tijd, plek en contactmail op één plek
- `netlify/functions/submission-created.mjs`: stuurt de bevestigingsmail via Resend (heeft eigen kopie van de eventdetails)

Het formulier werkt via Netlify Forms en alleen op de gedeployde site, niet met `npm run dev`.
