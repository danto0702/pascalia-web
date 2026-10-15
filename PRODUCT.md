# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Primary audience (confirmed, 2026-10-15):** contratistas de prestación de servicios (CPS) de entidades públicas colombianas who must prepare a cuenta de cobro every month and are the target users of **CuentaFacil**. pascalia.lat's most important job today is to convince them.
- **Secondary audiences (served by the site, lower priority):**
  - Organizations in public health: coordinators and managers of ESE, IPS and secretarías de salud evaluating the Suite de Salud Pública (Flota Vehicular, NANA DNT, SI-APS, Misión Médica).
  - Empresas y comercios looking for custom development (web, NFC, menús interactivos, dashboards, asistentes por WhatsApp, documentos, CRM, reservas, apps de campo).

## Product Purpose

PascalIA is a Colombian company that builds technology and AI solutions a la medida for organizations and people ("Ideas que hacen florecer tu organización"). pascalia.lat presents the company, its services (Consultoría, Desarrollo, Capacitación), its products and solutions, and turns visits into qualified requests through the contact form, which feeds the private request dashboard at `/panel/`.

Success for the site: a visitor from the primary audience understands what CuentaFacil does for them and leaves a request; secondary audiences find their solution page and leave a request.

## Positioning

**Cercanía y soluciones a la medida** (confirmed): direct, human contact with the people who build the solution; small solutions that work soon and adapt to each client, instead of generic software.

## Operating Context

- Contratistas prepare their cuenta de cobro monthly for the contracting entity and upload documents to SECOP II themselves; CuentaFacil accompanies them over WhatsApp. Interaction with the site is a first evaluation before using a WhatsApp service.
- The site's contact form is the conversion path; requests are tracked by the owner in `/panel/` (stages, next action, value, close reason, activity log).
- Visitors arrive mainly from their phone (confirmed by the owner 2026-10-15; not measured with analytics). Connection quality is not known.

## Capabilities and Constraints

- Static HTML/CSS/JS site, no build step, published from `main` to GitHub Pages at pascalia.lat (DNS at Porkbun). The publish workflow excludes internal folders (`.claude`, `supabase`, docs) from the site.
- Pages: `/` (PascalIA), `/desarrollos/`, `/cuentafacil/`, `/flota/`, `/nana-dnt/`, `/si-aps/`, `/mision-medica/`, `/politica-de-datos/`, `/terminos/`, `/panel/` (private, noindex).
- Contact form (`contacto.js`) posts to the Supabase Edge Function `pascalia-solicitud`, temporarily hosted in the client's SI-APS HRNO project and isolated with the `pascalia_` prefix and RLS; confirmation and notice emails via Resend from contacto@pascalia.lat.
- Sub-brands keep their own identity inside the PascalIA site: CuentaFacil (green, calendar-with-check logo), NANA DNT (own logo and palette), Misión Médica (official module logo; its emblem's use is regulated by Res. 4481 de 2012).
- Legal pages exist and are authoritative: Política de tratamiento de datos (v1.1) and Términos y condiciones of CuentaFacil.
- CuentaFacil pricing (confirmed 2026-10-15, matches `/terminos/#precios`): **$15.000** one-time per contract configuration (covers that contract's prórrogas and adiciones) and **$50.000** per generated cuenta de cobro (informe). Prices in COP, final value.
- Sales WhatsApp: **+57 312 388 5012** (`https://wa.me/573123885012`), also listed in the Términos as the attention line.
- Undecided product facts: how the other solutions (Suite de Salud Pública, desarrollos) are sold (licenses, subscriptions or projects) and their prices; none are published.

## Brand Commitments

- Name **PascalIA**, with "IA" emphasized. Tagline "Ideas que hacen florecer tu organización"; lines "Conocimiento. Tecnología. Personas. Resultados." and "Empresas que evolucionan, personas que florecen." Services named Consultoría (Analiza · Conecta · Transforma), Desarrollo (Automatiza · Integra · Escala) and Capacitación (Aprende · Aplica · Florece). Values: Innovación con propósito, Soluciones humanas, Crecimiento sostenible, Conocimiento sin límites.
- Binding brand-guide constraints supplied by the owner: flower logo; palette Amarillo PascalIA #FFC107, Gris grafito #1F1F1F, Gris claro #E9E8E9, Crema #FFF8E1.
- Voice: Spanish from Colombia, cordial, using tú. CuentaFacil's principle is binding: the user is responsible for what they sign; the assistant never invents activities and always asks for approval before generating final documents.

## Evidence on Hand

- None to publish yet (confirmed 2026-10-15): no client names, usage figures or testimonials. Future work must not fabricate customers, case studies, metrics, testimonials, prices or certifications.
- Do not claim an origin story tied to an ESE in Norte de Santander (owner decided to remove it, 2026-10-15).

## Product Principles

1. The contratista comes first: every page should make CuentaFacil's value obvious and easy to request.
2. Closeness over corporate distance: speak like the person who will build the solution, plainly and directly.
3. Promise only what exists: describe real capabilities and mark planned ones as planned.
4. AI assists, people decide: drafts and suggestions always end in human review and approval.
5. Respect the data: requests and personal data are handled under the published Política de tratamiento de datos.
