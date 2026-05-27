# TyChr Strapi Backend — Agent Guide

## Project Overview
Strapi v4 backend for TyChr platform. REST API + Socket.io for real-time messaging.
Live backend: `https://backend-2.tychr.com`

---

## STEP 0 — Jab bhi koi error aaye, PEHLE YEH KARO

```
1. Browser mein F12 → Network tab kholo
2. Error wali red request pe click karo
3. Status code dekho:

   Status 403        → PERMISSION issue   → Section A padho
   Status (failed)/0 → CORS issue         → Section B padho
   Status 404        → ROUTE missing      → Section C padho
   Status 500        → BACKEND crash      → Section D padho
   Status 401        → TOKEN issue        → Section E padho
```

---

## SECTION A — 403 Forbidden (Permission Issue)

### Console mein aisa dikhta hai:
```
Failed to load resource: the server responded with a status of 403 ()
```

### Network tab → Response body mein:
```json
{
  "data": null,
  "error": {
    "status": 403,
    "name": "ForbiddenError",
    "message": "Forbidden"
  }
}
```

### Identify karo — kaunsi permission missing hai:

**Step 1** — Network tab mein Request URL dekho:
```
/api/messages         → Message controller
/api/conversations    → Conversation controller
/api/users            → Users controller
/api/third-party-...  → ThirdParty controller
```

**Step 2** — Request Method dekho:
```
GET    → find ya findOne action
POST   → create action
PUT    → update action
DELETE → delete action

EXCEPTION:
GET /api/conversations/tp-chat → getOrCreateTpChat action
```

**Step 3** — Kaun call kar raha tha? User ka role check karo:
```
Strapi Admin → Content Manager → User → record kholo → role field dekho
```

**Step 4 — Fix karo (2 jagah):**

**Jagah 1:** `src/index.js` — `AUTHENTICATED_ACTIONS` array mein add karo:
```js
const AUTHENTICATED_ACTIONS = [
  'api::message.message.create',       // format: api::<name>.<name>.<action>
  'api::conversation.conversation.getOrCreateTpChat',
  // naya action yahan add karo
];
```
Phir restart: `npm run develop`

**Jagah 2:** Admin Panel mein manually bhi set karo (turant effect):
```
https://backend-2.tychr.com/admin/settings/users-permissions/roles
→ Role select karo (Student / Third Party User / Authenticated)
→ Section expand karo (Message / Conversation)
→ Action tick karo
→ Save (top-right purple button)
```

### Kaunse roles mein kya permission chahiye:
| Feature | Roles |
|---------|-------|
| Message (send/read) | Student, Third Party User, Authenticated |
| Conversation | Student, Third Party User, Authenticated |
| AI Tutor | Student, Authenticated |

---

## SECTION B — CORS Error (Origin Block)

### Console mein aisa dikhta hai:
```
Access to fetch at 'https://...' from origin 'http://localhost:3000' 
has been blocked by CORS policy: 
No 'Access-Control-Allow-Origin' header is present on the requested resource.

Failed to load resource: net::ERR_FAILED
```

### Network tab se confirm karo:
```
Request pe click karo → Headers tab

Request Headers mein dekho:
  Origin: http://localhost:3000     ← browser ne yeh bheja

Response Headers mein dekho:
  Access-Control-Allow-Origin: *                  ← CORS OK hai
  Access-Control-Allow-Origin: http://localhost:3000  ← CORS OK hai
  (line hi nahi hai)                              ← CORS BLOCK hai
```

### CORS vs 403 — fark:
```
Status 403, response body hai      → Permission issue (Section A)
Status (failed), response body nahi → CORS block (Section B)
```

### Fix karo — 2 jagah check karo:

**Jagah 1:** `config/middlewares.js`:
```js
{
  name: 'strapi::cors',
  config: {
    origin: ['http://localhost:3000', 'http://localhost:3001', 'https://platform.tychr.com'],
  },
}
```

**Jagah 2:** `src/index.js` (Socket.io ke liye):
```js
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['https://tychr.pages.dev', 'https://platform.tychr.com', 'http://localhost:3000', 'http://localhost:3001'];
```

Naya origin dono jagah add karo. Production mein `.env` mein set karo:
```
ALLOWED_ORIGINS=https://platform.tychr.com,https://tychr.pages.dev
```

---

## SECTION C — 404 Not Found (Route Missing)

### Console mein:
```
Failed to load resource: the server responded with a status of 404 ()
```

### Cause aur fix:

**Cause 1:** `createCoreRouter` use kiya — custom controller bypass ho jata hai:
```js
// WRONG
module.exports = createCoreRouter('api::message.message');

// CORRECT
module.exports = {
  routes: [
    { method: 'POST', path: '/messages', handler: 'message.create', config: { policies: [] } },
    { method: 'GET',  path: '/messages', handler: 'message.find',   config: { policies: [] } },
  ],
};
```

**Cause 2:** Custom route `:id` ke baad hai — Strapi pehli matching route leta hai:
```js
// WRONG — /tp-chat kabhi match nahi hoga
{ path: '/conversations/:id' },
{ path: '/conversations/tp-chat' },   // yeh unreachable hai

// CORRECT — specific route pehle
{ path: '/conversations/tp-chat' },   // pehle
{ path: '/conversations/:id' },       // baad mein
```

---

## SECTION D2 — DYNAMIC_SERVER_USAGE (Next.js Static/Dynamic Conflict)

### Error logs mein aisa dikhta hai:
```
Error: Dynamic server usage: Route /api/educators/third-party couldn't be rendered 
statically because it used `request.url`.
digest: 'DYNAMIC_SERVER_USAGE'

Error: Dynamic server usage: Route /api/billing couldn't be rendered 
statically because it used `cookies`.

useSearchParams() should be wrapped in a suspense boundary at page "/individual-user/messages"
Error occurred prerendering page "/individual-user/messages"
```

### Yeh error kya hai:
```
Next.js App Router build ke waqt pages/routes ko STATIC banana chahta hai
(fast load ke liye pre-render karta hai)

Lekin agar route mein yeh use ho:
  request.url        → har request pe alag hota hai
  request.headers    → har request pe alag hota hai
  cookies()          → har user ka alag hota hai
  searchParams       → URL se aata hai, static nahi ho sakta
  no-store fetch     → cache nahi karta

To Next.js kehta hai: "Main isko statically render nahi kar sakta"
→ DYNAMIC_SERVER_USAGE error
```

### Identify karo — kya used ho raha hai:

```
"used `request.url`"      → route mein new URL(request.url) ya request.url.searchParams
"used `cookies`"          → cookies() function call ho raha hai
"used `request.headers`"  → request.headers.get(...) use ho raha hai  
"used `nextUrl.searchParams`" → request.nextUrl.searchParams use ho raha hai
"useSearchParams() should be wrapped in suspense" → Client component mein useSearchParams() hai
```

### Fix karo — 3 tarike hain:

**Fix 1 — Route ko dynamic mark karo (sabse simple):**

Route file mein yeh line add karo:
```ts
// app/api/your-route/route.ts ke top pe
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  // ...
}
```

**Fix 2 — `useSearchParams()` ke liye Suspense wrap karo:**

```tsx
// WRONG — page directly useSearchParams use kar raha hai
export default function MessagesPage() {
  const searchParams = useSearchParams(); // crash in build
}

// CORRECT — Suspense mein wrap karo
import { Suspense } from 'react';

function MessagesContent() {
  const searchParams = useSearchParams(); // safe
  return <div>...</div>;
}

export default function MessagesPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <MessagesContent />
    </Suspense>
  );
}
```

**Fix 3 — `no-store` fetch wale pages ke liye:**
```ts
// fetch mein cache: 'no-store' hai to route dynamic hoga
// upar export karo:
export const dynamic = 'force-dynamic';
```

### Is project mein affected routes (production logs se):
```
/api/educators/third-party    → export const dynamic = 'force-dynamic' add karo
/api/test-series              → export const dynamic = 'force-dynamic' add karo
/api/question-bank            → export const dynamic = 'force-dynamic' add karo
/api/billing                  → export const dynamic = 'force-dynamic' add karo
/api/university-data          → export const dynamic = 'force-dynamic' add karo
/api/third-party-offerings    → export const dynamic = 'force-dynamic' add karo
/api/student-qna-questions    → export const dynamic = 'force-dynamic' add karo
/api/search-university        → export const dynamic = 'force-dynamic' add karo
/api/ai-tracker/comprehensive → export const dynamic = 'force-dynamic' add karo
/api/university-ai/dashboard  → export const dynamic = 'force-dynamic' add karo
/individual-user/messages     → useSearchParams() ko Suspense mein wrap karo
```

---

## SECTION D — 500 Internal Server Error (Backend Crash)

### Console mein:
```
Failed to load resource: the server responded with a status of 500 ()
```

### Kahan dekho:
```
1. Strapi terminal logs dekho — exact error line wahan hogi
2. Network tab → Response body mein error message hoga
3. Aksar Next.js 500 bhi isi ki wajah se aata hai:
   API 403/500 → frontend unhandled error → hydration crash → 500
```

### Common causes:
```
- strapi.io undefined (socket.io register() mein tha, bootstrap() mein nahi)
- entityService.findOne null result pe .something access kiya
- DB relation populate nahi ki
```

---

## SECTION E — 401 Unauthorized (Token Issue)

### Console mein:
```
Failed to load resource: the server responded with a status of 401 ()
```

### Fix:
```
- Frontend mein Authorization header check karo: Bearer <token>
- Token expire hua? Re-login karo
- Cookie se token sahi aa raha hai? useAuthToken() hook check karo
```

---

## Architecture

```
src/
├── index.js                             # Bootstrap + Socket.io + ensurePermissions()
├── api/
│   ├── message/
│   │   ├── controllers/message.js       # create, find, update, delete
│   │   └── routes/message.js            # Manual routes (NOT createCoreRouter)
│   └── conversation/
│       ├── controllers/conversation.js  # getOrCreateTpChat
│       └── routes/conversation.js       # /tp-chat route MUST be before /:id
config/
├── middlewares.js                       # CORS config yahan hai
```

---

## Roles in this project

| Role | Description |
|------|-------------|
| `authenticated` | Default logged-in users |
| `Student` | Students — messaging, courses, AI tutor |
| `Third Party User` | Professors, NGOs, Mentors — messaging, offerings |
| `Tutor` | Tutors — classrooms, messaging |
| `Admin` | Platform admins |
| `Public` | Unauthenticated — very limited access |

---

## tp-chat (1:1 Third Party ↔ Student chat)

Naming convention: `tp-chat-{thirdPartyUserId}-{studentId}`

- Auto-created via `GET /api/conversations/tp-chat?thirdPartyUserId=X&studentId=Y`
- Access check: name parse karke userId match karo (DB participant nahi bhi ho to chalega)
- Auto-add to DB participants on first message/read

---

## Socket.io — Already Implemented Events

```
message:new       → naya message aaya
message:read      → message padha gaya
message:edited    → message edit hua
message:deleted   → message delete hua
typing:start      → user type kar raha hai
typing:stop       → user ne typing band ki
user:online       → user connected
user:offline      → user disconnected
conversation:created → naya conversation bana
```

Socket.io `bootstrap()` mein hona chahiye, `register()` mein nahi:
```js
module.exports = {
  register() {},        // EMPTY rakhna
  async bootstrap({ strapi }) {
    await ensurePermissions(strapi);
    initSocketIO(strapi);   // httpServer yahan ready hota hai
  },
};
```

---

## Naya Feature Banate Waqt Checklist

- [ ] Controller function banaya
- [ ] Route add kiya — manual, aur specific routes `:id` se pehle
- [ ] `AUTHENTICATED_ACTIONS` array mein action string add kiya (`src/index.js`)
- [ ] Admin panel mein relevant roles mein permission enable kiya
- [ ] Backend restart kiya: `npm run develop`
