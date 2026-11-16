# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Primary audience (confirmed, 2026-10-15):** contratistas de prestación de servicios (CPS) de entidades públicas colombianas who must prepare a cuenta de cobro every month and are the target users of **CuentaFacil**. pascalia.lat's most important job today is to convince them.
- **Secondary audiences (served by the site, lower priority):**
  - Organizations in public health: coordinators and managers of ESE, IPS and secretarías de salud evaluating the Suite de Salud Pública (Flota Vehicular, NANA DNT, SI-APS, Misión Médica).
  - Empresas y comercios looking for custom development (web, NFC, menús interactivos, dashboards, asistentes por WhatsApp, documentos, CRM, reservas, apps de campo).
  - Added 2026-11-16 from the published pages; the owner confirmed they do not change the priority above:
    - Owners and managers of restaurants, bars, fast food and consultorios evaluating **MesaViva** (orders, bill splitting and payment from the table) and **Pascal Web** (a website for the business, built and maintained by PascalIA).
    - Organizers of amateur football championships evaluating **Fanátikos**.
    - People who need to edit or sign a PDF: **PascalPDF Studio** (edit and sign in the browser) and **Pascal Sign** (sign from the phone). These two are tools used on the site itself, not pages that ask for a request.

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
- Pages and products added after 2026-10-15 (recorded 2026-11-16 from the repository):
  - `/mesaviva/`: MesaViva sales page with a plan configurator and a simulated demo in `/mesaviva/demo/`. The page states the product is in development.
  - `/pascal-web/`: Pascal Web, websites with maintenance for restaurants, bars and consultorios, with three example sites (`restaurante`, `bar`, `odontologia`) and published plans.
  - `/fanatikos/`: Fanátikos, management of amateur football championships, with a demo in `/fanatikos/demo/` (noindex; data stays in the browser). The page states it is in testing with one championship.
  - `/PascalPDF_Studio/`: PascalPDF Studio, a browser tool to edit and sign PDF, with accounts, an admin area, a third-party signing flow (`firmar/`) and its own política and términos.
  - `/PascalSign/`: Pascal Sign, an installable app (web manifest and service worker) to sign PDF from the phone; signatures and documents stay on the device.
  - `/pascal/`: teaser page for Pascal ("Muy pronto"), noindex and outside the sitemap until the official launch.
  - `/reembolsos/`, `/politica-de-cookies/`, `/eliminar-mis-datos/`, `/aviso-legal/`: legal pages.
- PascalBot (`pascalbot/`) is a chat widget on `/` and `/cuentafacil/` that answers questions about the scope of CuentaFacil and sends anything about a specific cuenta to WhatsApp.
- `servicios/convertidor/` is a Word to PDF conversion service deployed on Railway; it is not part of the published site.
- Every new page or product must meet `CUMPLIMIENTO.md` before it is published; `.github/scripts/cumplimiento.py` blocks the publish workflow when the automatic checks fail.
- Contact form (`contacto.js`) posts to the Supabase Edge Function `pascalia-solicitud`, temporarily hosted in the client's SI-APS HRNO project and isolated with the `pascalia_` prefix and RLS; confirmation and notice emails via Resend from contacto@pascalia.lat.
- Sub-brands keep their own identity inside the PascalIA site: CuentaFacil (PascalIA yellow, calendar-with-check logo; green is not part of the PascalIA palette, owner correction 2026-11-16), NANA DNT (own logo and palette), Misión Médica (official module logo; its emblem's use is regulated by Res. 4481 de 2012).
- Legal pages exist and are authoritative: Política de tratamiento de datos and Términos y condiciones of CuentaFacil (both show version 1.3, in force since 2026-10-20), plus Política de reembolsos, Política de cookies, Aviso legal and Eliminar mis datos.
- CuentaFacil pricing (confirmed 2026-10-15, matches `/terminos/#precios`): **$15.000** one-time per contract configuration (covers that contract's prórrogas and adiciones) and **$50.000** per generated cuenta de cobro (informe). Prices in COP, final value.
- CuentaFacil is open in pilot (confirmed 2026-10-15): a contratista who writes on WhatsApp can start now; if their entity is not configured yet, it is configured with them. CuentaFacil CTAs say "Empezar", not "lista de espera".
- Documents a contratista sends over WhatsApp (contrato, PILA, cédula, soportes) are stored in Supabase, encrypted, and are the input used to configure the contract and each cuenta; retention and deletion follow the Política de datos (24 months, or earlier on "borrar mis datos").
- Sales WhatsApp: **+57 312 388 5012** (`https://wa.me/573123885012`), also listed in the Términos as the attention line.
- Undecided product facts: how the Suite de Salud Pública and desarrollos are sold (licenses, subscriptions or projects) and their prices; none are published. MesaViva and Pascal Web publish their plans on their own pages, and those pages are the source for any price; no price for Fanátikos is published.

## Brand Commitments

- Name **PascalIA**, with "IA" emphasized. Tagline "Ideas que hacen florecer tu organización"; lines "Conocimiento. Tecnología. Personas. Resultados." and "Empresas que evolucionan, personas que florecen." Services named Consultoría (Analiza · Conecta · Transforma), Desarrollo (Automatiza · Integra · Escala) and Capacitación (Aprende · Aplica · Florece). Values: Innovación con propósito, Soluciones humanas, Crecimiento sostenible, Conocimiento sin límites.
- Binding brand-guide constraints supplied by the owner: flower logo; palette Amarillo PascalIA #FFC107, Gris grafito #1F1F1F, Gris claro #E9E8E9, Crema #FFF8E1.
- Voice: Spanish from Colombia, cordial, using tú. CuentaFacil's principle is binding: the user is responsible for what they sign; the assistant never invents activities and always asks for approval before generating final documents.

## Evidence on Hand

- None to publish yet (confirmed 2026-10-15): no client names, usage figures or testimonials. Future work must not fabricate customers, case studies, metrics, testimonials, prices or certifications.
- Do not name a region on the site: no origin story tied to an ESE in Norte de Santander, no "piloto en Norte de Santander", and no real place names in examples (owner decisions, 2026-10-15).

## Product Principles

1. The contratista comes first: every page should make CuentaFacil's value obvious and easy to request.
2. Closeness over corporate distance: speak like the person who will build the solution, plainly and directly.
3. Promise only what exists: describe real capabilities and mark planned ones as planned.
4. AI assists, people decide: drafts and suggestions always end in human review and approval.
5. Respect the data: requests and personal data are handled under the published Política de tratamiento de datos.
