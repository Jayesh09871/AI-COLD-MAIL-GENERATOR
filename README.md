# AI Cold Email Generator

A fully dockerized full-stack MERN application that uses AI to generate customized cold emails, LinkedIn DMs, and follow-up emails based on user prompts.

## Features Added
- ** setup**: Single `package.json` to install and run the entire stack concurrently.
- **Docker & Docker Compose**: Bootstraps the Node API, React Frontend, and MongoDB database automatically in isolated containers.
- **CI/CD via GitHub Actions**: Ensures that all dependencies install correctly and frontend builds continuously upon pushing changes to GitHub.

---

## 🚀 How to Run Locally (Using Concurrently)

**1. Install all dependencies**  
Run this command from the root folder (it installs root, server, and client Node dependencies):
\`\`\`bash
npm run install:all
\`\`\`

**2. Setup your Environment Variables**  
- Create a `.env` in the `/server` folder based on `.env.example`. Make sure your `MONGODB_URI` is correctly pointing to your preferred MongoDB instance.  
- Create a `.env` in the `/client` folder with: `VITE_API_URL=http://localhost:5000/api`
- **Email (Brevo SMTP):** Sign up for free at [Brevo](https://www.brevo.com/) (300 emails/day forever), then copy the 6 SMTP variables from Brevo → Top-right menu → SMTP & API → SMTP tab into `server/.env`:
  ```env
  SMTP_HOST=smtp-relay.brevo.com
  SMTP_PORT=587
  SMTP_SECURE=false
  SMTP_USER=<your Brevo login>
  SMTP_PASS=<your Brevo master password>
  SMTP_FROM="SmartReach AI <noreply@your-domain.com>"
  ```
  For local-only testing you can also use Gmail SMTP with an App Password (see `.env.example`), but Gmail blocks Render/Heroku/Vercel datacenter IPs so Brevo is **required for live deployments**.

**3. Run the **  
Start both the Frontend and Backend simultaneously:
\`\`\`bash
npm run dev
\`\`\`
The GUI will be on `http://localhost:5173` and the API firmly rooted at `http://localhost:5000`.

---

## 🐳 How to Run with Docker

If you prefer using Docker, you don't even need to install Node locally. Docker Compose will spin up 3 instances automatically:
1. React Frontend Container
2. Node API Container
3. MongoDB Database Container

**Steps:**
1. Be in the root folder.
2. Ensure Docker Desktop is open and running.
3. Build and spin up the architecture:
   \`\`\`bash
   docker-compose up --build
   \`\`\`
   *(Note: This uses the environment variables configured within the `docker-compose.yml` file. Update the secrets inside that file before running it in production).*

To stop containers:
\`\`\`bash
docker-compose down
\`\`\`

---

## 🔁 CI/CD (GitHub Actions Pipeline)

This repository includes a `.github/workflows/pipeline.yml` file. 

Whenever you push to `main` (or create a Pull Request against it), GitHub Actions will automatically:
- Checkout your code.
- Setup Node.js v18.
- Install Root, Client, and Server dependencies respectively.
- Run a `npm run build` on your `/client` to ensure Vite successfully bundles the frontend. 

It prevents bad pushes from making it effectively resolving broken dependencies early on.

---

## Deployment Guide (Free Tier)

### Deploying Backend on Render

1. Create an account on [Render](https://render.com/).
2. Push this whole repository to GitHub.
3. On Render, click **New +** and select **Web Service**.
4. Connect your GitHub repository.
5. Configure the Web Service:
   - **Name**: ai-cold-email-backend
   - **Root Directory**: `server`
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`  *(Make sure to use node instead of nodemon for production)*
   - **Instance Type**: Free
6. Under **Environment Variables**, add all the variables from your `.env` file (e.g. `MONGODB_URI`, `JWT_SECRET`, `GROQ_API_KEY`, `FRONTEND_URL`). **To get real OTP emails on live, also add the 6 Brevo SMTP vars (`SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`) from `.env.example` — Gmail SMTP will NOT work on Render datacenter IPs.**
7. Click **Create Web Service**.

### Deploying Frontend on Vercel

1. Create an account on [Vercel](https://vercel.com/).
2. Click **Add New... > Project** and import your GitHub repository.
3. Configure the Project:
   - **Framework Preset**: Vite
   - **Root Directory**: `client`
4. Under **Environment Variables**, add:
   - `VITE_API_URL`: Your newly minted Backend URL + `/api` (e.g., `https://ai-backend.onrender.com/api`)
5. Click **Deploy**. Vercel will deploy your frontend seamlessly.
6. **Important**: Remember to go back to Render and update your backend `FRONTEND_URL` Variable to the Vercel domain to dodge tricky CORS errors.

---

## 🏗️ Architecture

```
                      ┌──────────────────────────────┐
                      │   Browser (Vite + React 18) │
                      │   Tailwind · lucide-react    │
                      │   Playfair Display + Inter   │
                      │   AuthContext + ThemeContext │
                      └─────────────┬────────────────┘
                                    │
                                    │ VITE_API_URL/api (CORS dev-only localhost)
                                    ▼
                      ┌──────────────────────────────┐
                      │   Express 4.x HTTP Server    │
                      │ helmet + CSP nonces  ·  pino │
                      │ express-rate-limit × 3 tiers │
                      │ express-validator per-route  │
                      └──────────┬───────────────────┘
         ┌───────────────────────┼───────────────────────┐
         ▼                       ▼                       ▼
┌─────────────────┐   ┌───────────────────┐   ┌───────────────────┐
│ JWT auth        │   │ AI + CRUD         │   │ Export            │
│ register        │   │ generate-email    │   │ /export?format=   │
│ verify-otp      │   │ (Groq, 4 tones,   │   │  pdf → pdfkit     │
│ resend-otp      │   │  numVariants 1-3) │   │  txt → plain text │
│ login           │   │ history $text     │   └───────────────────┘
│ bcrypt + OTP    │   │ PATCH edits       │
│ rate-limit 5/15 │   │ tags · favorite   │
└────────┬────────┘   └────────┬──────────┘
         ▼                     ▼
┌──────────────────┐  ┌───────────────────────┐
│  MongoDB Atlas   │  │  Nodemailer SMTP      │
│  Mongoose 7.x    │  │  Brevo smtp-relay (1°)│
│  User ·          │  │  Gmail SMTP (fallback │
│  EmailHistory    │  │   localhost only)     │
│  (tone/tags/     │  └───────────────────────┘
│   favorite/      │          │
│   status/        │          ▼
│   variants[])    │  ┌───────────────────────┐
└──────────────────┘  │ Groq API              │
                      │ llama-3.3-70b         │
                      └───────────────────────┘
```

**OTP / Password Recovery flows (all email-delivered via Brevo SMTP):**
- Register → email OTP → Verify OTP → Login
- Resend OTP (with 1 min rate-limit)
- Forgot Password → email reset OTP → Reset Password (with new password strength checks)

**Auth endpoints:**
```
POST  /api/auth/register          (rate-limited strictLimiter)
POST  /api/auth/verify-otp
POST  /api/auth/login             (rate-limited authLimiter, lockout after 5)
POST  /api/auth/resend-otp
POST  /api/auth/forgot-password
POST  /api/auth/reset-password
```

**Core data model:**
```
User           { _id, email, name, passwordHash, otpHash, otpExpiry,
                 isVerified, failedLoginAttempts, lockedUntil, lastLoginAt }

EmailHistory   { _id, userId, prompt, tone,
                 subject, emailBody, linkedInDM, followUpEmail,
                 tags[String], isFavorite: Boolean,
                 status: Enum(draft|sent|replied),
                 sentAt, repliedAt,
                 variants: [ { variantId, subject, emailBody,
                                linkedInDM, followUpEmail, selected } ] }
```

**Security hardening (non-negotiable, all active):**
- 3 tiers of `express-rate-limit` (login locked after 5 × 15 min; strict OTP routes 3 × 15 min; AI generate 20 × 1 min)
- Bcrypt on password *and* OTP (hashed; no plaintext anywhere)
- Body size cap on `express.json()`
- Errors: raw `err.message` stripped in production
- CORS: dev-only localhost
- Helmet + CSP with per-request nonces in headers

---

## 💡 Why I Built This

Generic AI cold-email tools look like chatbots with rounded cards, but writing outreach is a *drafting task* — it needs a desk, not a chat bubble. I wanted:

1. **Editorial tool, not a chatbot.** Warm paper background, serif document headings, justified body with a hanging indent. Split drafting-desk on the left, live document on the right. No gradients, no blobs, no "brewing magic" copy.
2. **Everything persists and is revisitable.** Too many wrappers throw away the output after you leave. Here every generation is saved, taggable, favorite-able, searchable, exportable. Mark one *sent*; mark the reply when it comes.
3. **Actually useful variants.** 2–3 parallel A/B drafts, not a spinner that re-rolls the whole thing. Pick a variant, edit it inline, Save — and the backend keeps the selected variant in sync with the document-level fields so older clients/exports still read cleanly.
4. **Portfolio-grade security, not a demo.** Most side projects skip rate limiting and hash only the password. This one has 3 tiers of rate limiting, OTP hashing *and* bcrypt, CSP nonces, production error masking, pino structured logs with redaction, Mongo text-indexed search with filter+pagination.
5. **Deploy on free tier.** Docker Compose for local; Render backend + Vercel frontend; Mongo Atlas free tier. No infra to babysit.

---

## 🎯 What I Learned

### Backend / Design
- **Variants without breaking legacy callers is tricky.** The Editor sends a `variants: [...]` array on Save, but exports and older reads still look at top-level `subject/emailBody/...`. Solution: on every PATCH, compute the selected variant (default to first if none selected) and mirror it into the top-level fields. This keeps historical records, the PDF export function, and the detail view all working without a migration.
- **Rate limits share a namespace by design.** Register + resend + verify are all under `strictLimiter` so a single IP can't hammer a 6-digit OTP space 3× per 15 min. During E2E I hit this repeatedly — which proved it was working, not that it was buggy.
- **Never assume the client matches your JSON shape.** `express-validator` with `matchedData()` on every handler + nested `variants.*.subject.isLength` caps means malformed arrays or 10 MB prompts are rejected before the controller sees them. Found and fixed 3 of these contract mismatches *during* the E2E pass.

### Frontend / UX
- **Tailwind opacity modifiers break silently if DEFAULT is missing.** `text-moss` and `bg-moss/10` were used everywhere but the `moss: { 50, 100, 600, 700 }` palette had no `DEFAULT`. Everything rendered as the *currentColor* fallback — invisible. Added `DEFAULT: '#6B705C'` and the whole History page and tone cards appeared.
- **`group-hover:flex` with no parent `group`** is the new "forgot to bind onclick". The Export dropdown used `.group-hover:flex` on the dropdown but its wrapper was only `className="relative"`. Added `group` and it instantly started working.
- **Error field naming matters.** Backend sent `{ field, message }` but Signup was reading `first.param` / `first.msg` from the old express-validator default. Same for root error — it was reading `payload.error` but the canonical key is `payload.message`. Fixed in Login/Verify/Signup together and users now see real explanations instead of "Something went wrong."

### Operations / Testing
- **Capture server logs for OTP in dev.** Without SMTP configured locally, `emailService` threw on every OTP send. Refactored to log a `[DEV EMAIL]` banner with the full message (OTP extractable via regex) and return success in dev. E2E tests then scrape OTPs from `/tmp/server_out.log` by line offset — no test accounts or manual copying needed.
- **Heredocs in shells hate quotes.** Both the prior agent and I lost 2 smoke runs to `sh -c` heredoc quoting mangling the Python script every time. The fix: `Write` file to `/tmp/final_smoke.py` first, then run `python3 /tmp/final_smoke.py` clean. 0 quoting issues after that.
