# Casa Bella Hotel & Residence — Public Website

Customer-facing website for Casa Bella Hotel & Residence. Separate from the POS (`frontend/` / `backend/`). Structured for future API integration with the existing Casa Bella POS backend.

## Run locally

```bash
cd website
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

If port 3000 is used by the POS backend, run:

```bash
npm run dev -- -p 3001
```

## Environment

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SITE_URL` | Canonical site URL (SEO / Open Graph) |
| `NEXT_PUBLIC_API_BASE_URL` | Future Casa Bella POS/backend API base URL |
| `NEXT_PUBLIC_USE_MOCK_DATA` | `true` = local mock data (default) |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | WhatsApp contact (digits only, optional) |
| `NEXT_PUBLIC_GOOGLE_MAPS_EMBED_URL` | Maps embed URL when ready |

## Where data lives

| Content | Path |
|---------|------|
| Site config (brand, contact placeholders) | `src/data/site.ts` |
| Rooms | `src/data/rooms.ts` |
| Residences | `src/data/residences.ts` |
| Offers | `src/data/offers.ts` |
| Facilities | `src/data/facilities.ts` |
| Gallery | `src/data/gallery.ts` |
| FAQs | `src/data/faqs.ts` |
| Testimonials | `src/data/testimonials.ts` |
| Policies (placeholders) | `src/data/policies.ts` |

## Booking logic

- UI flow: `src/app/booking/page.tsx` + `src/components/booking/*`
- Pricing / nights / mock availability: `src/lib/booking.ts`
- API stubs (swap to real POS later): `src/lib/api/*`

## Future POS integration

1. Set `NEXT_PUBLIC_API_BASE_URL` to the Nest backend.
2. Set `NEXT_PUBLIC_USE_MOCK_DATA=false`.
3. Implement endpoints expected by `src/lib/api/*` (rooms, residences, availability, bookings).
4. Provide real Casa Bella content: address, phone, email, prices, room inventory, policies, photos, map coordinates.
