# Strapi + Next.js — Complete Guide
> Ye file humari conversation ka summary hai. Jab bhi koi naya developer aaye ya tum bhool jao — ye file padho.

---

## Table of Contents
1. [Strapi Kya Hai](#1-strapi-kya-hai)
2. [API Kaise Banti Hai](#2-api-kaise-banti-hai)
3. [Populate Kya Hai](#3-populate-kya-hai)
4. [URL se Populate vs Controller mein Populate](#4-url-se-populate-vs-controller-mein-populate)
5. [Next.js ka Architecture](#5-nextjs-ka-architecture)
6. [Server Actions vs API Routes](#6-server-actions-vs-api-routes)
7. [Security](#7-security)
8. [API Debugging Guide](#8-api-debugging-guide)
9. [Humara Project — Real Flow](#9-humara-project--real-flow)
10. [Answer Collection — Schema Explained](#10-answer-collection--schema-explained)
11. [Test Series — Shuffle Logic](#11-test-series--shuffle-logic)

---

## 1. Strapi Kya Hai

Strapi ek **headless CMS** hai jo automatically REST APIs bana deta hai.

### Node/Express se Comparison

```
Node/Express (Purana tarika)        Strapi (Naya tarika)
─────────────────────────────       ──────────────────────
app.get('/api/users', ...)    →     Schema banao → API ready
app.post('/api/users', ...)   →     CRUD automatic
Manual DB queries             →     entityService se query
Manual auth                   →     Auth built-in
```

### Strapi se Kya Milta Hai Automatically

Jab tum ek Content Type banate ho (jaise `test-serie`) — ye sab automatically milta hai:

```
GET    /api/test-series          ← List of all
GET    /api/test-series/:id      ← Single record
POST   /api/test-series          ← Create
PUT    /api/test-series/:id      ← Update
DELETE /api/test-series/:id      ← Delete
```

Kuch nahi likhna — bas schema define karo.

---

## 2. API Kaise Banti Hai

Har API **3 files** milke banati hai:

```
src/api/test-serie/
├── content-types/
│   └── test-serie/
│       └── schema.json      ← Step 1: Fields define karo
├── routes/
│   └── student.js           ← Step 2: URL define karo
└── controllers/
    └── student.js           ← Step 3: Logic likho
```

---

### Step 1 — schema.json (Fields Define Karo)

```json
{
  "attributes": {
    "title": { 
      "type": "string" 
    },
    "randomize_questions": { 
      "type": "boolean",
      "default": false
    },
    "papers": {
      "type": "relation",
      "relation": "oneToMany",
      "target": "api::test-serie.test-serie"
    }
  }
}
```

**Kya likhte hain:**
- Scalar fields — string, integer, boolean, datetime, json, text
- Relations — oneToMany, manyToOne, manyToMany
- Media fields — images, files, videos
- Enumerations — fixed values list
- Components — reusable field groups

---

### Step 2 — routes/student.js (URL Define Karo)

```js
module.exports = {
  routes: [
    {
      method: "GET",                                    // HTTP method
      path: "/test-series/:seriesId/student-session",  // URL pattern
      handler: "student.getStudentSeriesSession",       // Controller function
      config: {
        policies: [],      // Extra checks (optional)
        middlewares: [],   // Middleware (optional)
      },
    },
    {
      method: "POST",
      path: "/test-series/:seriesId/start-new-attempt",
      handler: "student.startNewAttempt",
    },
  ],
};
```

**Kya likhte hain:** Sirf URL aur method — koi logic nahi.

---

### Step 3 — controllers/student.js (Logic Likho)

```js
module.exports = createCoreController(
  "api::test-serie.test-serie",
  ({ strapi }) => ({

    async getStudentSeriesSession(ctx) {

      // 1. URL se params nikalo
      const { seriesId } = ctx.params;          // /test-series/:seriesId
      const queryParams = ctx.query;             // ?populate=papers

      // 2. JWT se user nikalo
      const user = ctx.state.user;
      if (!user) return ctx.unauthorized("Login required");

      // 3. DB query — populate yahan likhte hain
      const series = await strapi.entityService.findOne(
        "api::test-serie.test-serie",
        seriesId,
        {
          populate: {
            papers: {
              populate: {
                question_banks: {
                  fields: ["id"]
                }
              }
            }
          }
        }
      );

      // 4. Business logic
      const shuffled = applyQuestionOrder(series.papers);

      // 5. Response bhejo
      return ctx.send({ data: shuffled });
    },

  })
);
```

**Kya likhte hain:**
- Auth check (`ctx.state.user`)
- DB queries (`strapi.entityService`)
- Populate (related data fetch)
- Business logic (shuffle, calculations)
- Response (`ctx.send()`)

---

## 3. Populate Kya Hai

### Problem

Strapi mein by default **sirf scalar fields** aate hain:

```json
{
  "title": "My Series",
  "test_duration": 30,
  "randomize_questions": false
}
```

**Relations nahi aate** — `papers`, `question_banks`, `grade_subject` — ye sab alag tables mein hain.

### Solution — Populate

```
GET /api/test-series/477?populate=papers
```

Ab papers ka data bhi aayega:

```json
{
  "title": "My Series",
  "papers": {
    "data": [
      { "id": 478, "title": "Paper 1" },
      { "id": 480, "title": "Paper 2" }
    ]
  }
}
```

### Populate ke Types

```
Level 1 — Direct relation:
?populate=papers

Level 2 — Relation ke andar relation:
?populate[papers][populate]=question_banks

Level 3 — Aur deep:
?populate[papers][populate][question_banks][populate]=parts

Wildcard — Sab kuch (production mein avoid karo):
?populate=*
```

### Frontend mein Populate Kaise Likhte Hain

Tumhare project mein `qs` library use hoti hai:

```js
import qs from "qs";

const query = qs.stringify({
  populate: {
    question_banks: {
      populate: {
        parts: {
          populate: ["hints", "attachments"]
        },
        attachments: true,
      },
    },
    test_papers: { populate: true },
    grade_subject: true,
  },
});

const response = await fetch(
  `${STRAPI_URL}/api/test-series/${id}?${query}`
);
```

---

## 4. URL se Populate vs Controller mein Populate

### Kahan Kya Hota Hai

| | URL Populate | Controller Populate |
|---|---|---|
| Kahan likha jata hai | Frontend ke fetch() mein | Backend controller mein |
| Kaun control karta hai | Frontend/User | Developer |
| Default API mein | ✅ Automatic kaam karta hai | ✅ Kaam karta hai |
| Custom endpoint mein | ❌ Automatic nahi — `sanitizeQuery` chahiye | ✅ Hamesha kaam karta hai |

### Custom Endpoint mein URL Populate Enable Karna

```js
// controllers/student.js
async myCustomEndpoint(ctx) {
  // Ye ek line URL populate enable karti hai
  const sanitizedQuery = await this.sanitizeQuery(ctx);

  const data = await strapi.entityService.findOne(
    "api::test-serie.test-serie",
    id,
    sanitizedQuery  // Ab ?populate=papers kaam karega
  );
}
```

### Official Recommendation (Strapi Docs se)

> *"In production, always use explicit population instead of wildcards. Limit population depth to 2-3 levels."*

**Kyun hardcoded populate better hai custom endpoints mein:**
- Performance controlled rahti hai
- User heavy queries trigger nahi kar sakta
- Predictable response milta hai

**Kyun URL populate safe hai (permission ke wajah se):**
> *"The find permission must be enabled for the content-types that are being populated. If a role does not have access, it will not be populated."*

Matlab security ka issue nahi — sirf **performance** ka issue hai.

---

## 5. Next.js ka Architecture

### Tumhare Project mein 3 Layers Hain

```
┌─────────────────────────────────────┐
│   BROWSER (User)                    │
│   React Components                  │
│   page.tsx, useTestData.ts          │
└──────────────┬──────────────────────┘
               ↓ Function call / fetch()
┌─────────────────────────────────────┐
│   NEXT.JS SERVER                    │
│   Server Actions — "use server"     │
│   API Routes — app/api/             │
│   JWT handle karta hai              │
└──────────────┬──────────────────────┘
               ↓ fetch() with JWT
┌─────────────────────────────────────┐
│   STRAPI BACKEND                    │
│   Controllers, Routes               │
│   Business Logic                    │
└──────────────┬──────────────────────┘
               ↓ DB Query
┌─────────────────────────────────────┐
│   DATABASE                          │
│   PostgreSQL                        │
└─────────────────────────────────────┘
```

### Next.js Server Kyun Hai Beech Mein

```
Browser → Strapi Direct   ❌
                            JWT browser mein dikhega
                            Security risk

Browser → Next.js → Strapi  ✅
           Server
           JWT cookie mein safe rahta hai
           Browser ko kabhi nahi milta
```

---

## 6. Server Actions vs API Routes

### Server Actions — `actions/` folder

```js
// actions/student-test.action.ts
"use server"   // ← Ye line Next.js ko batati hai server pe chalega

export const getStudentTestData = async (paperId) => {
  const jwt = cookies().get("jwt")?.value;  // Cookie se JWT
  
  const res = await fetch(`${STRAPI_URL}/api/test-series/${paperId}`, {
    headers: { Authorization: `Bearer ${jwt}` }
  });
  
  return res.json();
};
```

Frontend se call karna:
```js
// useTestData.ts (component)
const data = await getStudentTestData(paperId);
// ↑ Koi URL nahi — seedha function call
// Next.js internally handle karta hai
```

### API Routes — `app/api/` folder

```js
// app/api/route.ts
export async function GET(req) {
  // Ye server pe chalta hai
  // Strapi ko proxy karta hai
  const res = await fetch(`${STRAPI_URL}/...`);
  return Response.json(await res.json());
}
```

Frontend se call karna:
```js
// Bilkul Node jaisa
fetch('/api/answers?filters...')
```

### Kab Kya Use Karo

| Use Case | Use Karo |
|---|---|
| Strapi se data fetch | Server Action |
| Form submit / mutation | Server Action |
| JWT secure rakhna | Server Action |
| Proxy banana (Strapi forward) | API Route |
| Webhook receive karna | API Route |
| Cron jobs | API Route |
| Browser se directly hit | API Route |

### Tumhare Project mein Kya Kya Use Hua

**Server Actions (`actions/` folder):**
- `student-test.action.ts` — Test data, answers save
- `user.action.ts` — User data, classrooms
- `lecture.action.ts` — Lectures
- `classroom.action.ts` — Classroom data
- `test-series.actions.ts` — Test series
- `ai-evaluation.action.ts` — AI evaluation

**API Routes (`app/api/` folder):**
- `app/api/route.ts` — Main Proxy (Strapi ko forward)
- `app/api/free-preview/status` — Free preview check
- `app/api/billing` — Payment
- `app/api/attendance` — Attendance
- `app/api/cron/` — Scheduled tasks
- `app/api/aigenerate` — AI content

---

## 7. Security

### Server Actions ki Built-in Security (Next.js Docs se)

> *"Next.js creates encrypted, non-deterministic IDs to allow the client to reference and call the Server Action."*

> *"Server Actions use POST method only. This prevents most CSRF vulnerabilities."*

> *"Next.js also compares Origin header to Host header."*

### Critical Warning

> *"A page-level authentication check does not extend to the Server Actions defined within it. Always re-verify inside the action."*

```js
// ❌ GALAT — page pe check kiya, action mein nahi
export const deleteData = async () => {
  await db.delete();  // Koi bhi call kar sakta hai!
}

// ✅ SAHI — har action mein auth check karo
export const deleteData = async () => {
  const jwt = cookies().get("jwt")?.value;
  if (!jwt) throw new Error("Unauthorized");
  await db.delete();
}
```

### API Routes ki Security

Docs mein koi built-in security mention nahi — **khud handle karna padta hai.**

### Server Actions vs API Routes Security

| | Server Actions | API Routes |
|---|---|---|
| CSRF Protection | ✅ Built-in | ❌ Manual |
| Encrypted IDs | ✅ Built-in | ❌ Nahi |
| Auth | ⚠️ Manual (har action mein) | ⚠️ Manual |

---

## 8. API Debugging Guide

### Golden Rule

> Jab bhi frontend mein kuch wrong aaye — pehle API directly hit karo.
> Agar API sahi → Frontend problem
> Agar API galat → Backend problem

### Basic Tools

- Browser address bar (GET requests)
- Postman (GET + POST + Auth)
- curl (terminal se)

### Common URL Patterns

```
Field exist karta hai ya nahi:
/api/test-series/480

Relations ke saath:
/api/test-series/480?populate=question_banks

Specific fields sirf:
/api/test-series/480?fields[0]=title&fields[1]=randomize_questions

Filter karo:
/api/test-series?filters[entity_type][$eq]=paper
/api/test-series?filters[parent_test_series][id][$eq]=477

Sort karo:
/api/answers?sort[0]=attempt_id:desc

Pagination:
/api/answers?pagination[limit]=5
/api/answers?pagination[limit]=-1   ← sab records

Combine sab:
/api/test-series?filters[parent_test_series][id][$eq]=477
  &fields[0]=id&fields[1]=title&fields[2]=randomize_questions
  &sort[0]=createdAt:desc
```

### Filter Operators

| Operator | Matlab | Example |
|---|---|---|
| `$eq` | Equal | `filters[completed][$eq]=true` |
| `$ne` | Not equal | `filters[is_attempt_marker][$ne]=true` |
| `$gt` | Greater than | `filters[marks][$gt]=50` |
| `$lt` | Less than | `filters[time_taken][$lt]=3600` |
| `$in` | Array mein | `filters[status][$in][0]=active` |
| `$null` | Is null | `filters[question_order][$null]=true` |

### Auth Required APIs

Postman mein:
```
Headers:
Authorization: Bearer <jwt_token>
```

JWT kahan milega:
```
Browser → DevTools → Application → Cookies → jwt
```

JWT decode karna (browser console mein):
```js
JSON.parse(atob(jwt.split('.')[1]))
// → { id: 414, role: "student", exp: 1234567890 }
```

### Real Debugging Scenarios

```
Scenario 1: Field deploy hui ya nahi
→ /api/test-series/480
→ Response mein field hai? ✅ Deploy hua / ❌ Deploy nahi hua

Scenario 2: Student ka attempt save hua ya nahi
→ /api/answers?filters[test_series][id][$eq]=480
  &filters[student][id][$eq]=414
  &fields[0]=attempt_id&fields[1]=completed&fields[2]=question_order

Scenario 3: Shuffle kaam kiya ya nahi
→ /api/answers?filters[is_attempt_marker][$eq]=true
  &filters[test_series][id][$eq]=480
  &fields[0]=question_order&sort[0]=attempt_id:asc
→ Attempt 1 aur 2 ka order same hai?

Scenario 4: Papers ka randomize status
→ /api/test-series?filters[parent_test_series][id][$eq]=477
  &fields[0]=id&fields[1]=title&fields[2]=randomize_questions

Scenario 5: 401 aa raha hai
→ JWT expire ho gayi — dobara login karo
→ Ya JWT header mein add nahi ki

Scenario 6: 404 aa raha hai
→ Route exist nahi karta
→ Ya ID galat hai

Scenario 7: 500 aa raha hai
→ Controller mein error — Strapi logs dekho
```

---

## 9. Humara Project — Real Flow

### Test Start karne ka Complete Flow

```
1. Student "Start Test" click karta hai
         ↓
2. page.tsx (React Component)
   router.push('/test-series/477/paper/480/test?attempt=1')
         ↓
3. useTestData.ts (Frontend Hook)
   getStudentTestData(paperId) call hota hai
         ↓
4. actions/student-test.action.ts (Next.js Server)
   "use server"
   Cookie se JWT nikalta hai
   Strapi ko fetch() karta hai:
   GET /api/test-series/480?populate[question_banks]...
         ↓
5. Strapi (controllers/test-serie.js)
   JWT verify
   DB se questions fetch karta hai
   Response bhejta hai
         ↓
6. useTestData.ts
   Questions aaye
   randomize_questions: true? → Shuffle check
   getPrefillAnswers() → Purane answers prefill
         ↓
7. Screen pe questions dikhte hain
```

### Shuffle Logic Flow

```
Student "Start New Attempt" click karta hai
         ↓
Strapi: startNewAttempt() controller
         ↓
Paper mein randomize_questions: true?
         ↓
         YES                    NO
          ↓                      ↓
Attempt 1 hai?           Questions as-is order
          ↓
    YES         NO
     ↓           ↓
Same order    Fisher-Yates shuffle
as attempt 1  (guaranteed different from original)
              question_order JSON mein save karo
              answers table mein (is_attempt_marker: true)
         ↓
Frontend ko shuffled order ke saath questions milte hain
```

---

## 10. Answer Collection — Schema Explained

`answers` table ka kaam — **ek row, kaafi kaam:**

| Field | Type | Kaam |
|---|---|---|
| `student` | relation | Kaun student |
| `test_series` | relation | Kaun paper |
| `attempt_id` | integer | Kaun sa attempt (1, 2, 3) |
| `is_attempt_marker` | boolean | `true` = attempt ka metadata row |
| `question_order` | json | `{"480": [10641, 10640, 10642]}` shuffled order |
| `question_n_answer` | component | Questions + answers array |
| `completed` | boolean | Submit hua ya nahi |
| `phase` | enum | reading / answering / completed |
| `violation_count` | integer | Tab switching count |
| `auto_submitted` | boolean | Violations se auto submit |
| `resume_status` | enum | none/requested/approved/rejected |
| `evaluation_status` | enum | pending/evaluated/needs_review |
| `time_taken` | integer | Seconds mein |
| `submission_type` | enum | online/offline/hybrid |

### Attempt Marker Row vs Answer Row

```
is_attempt_marker: true   ← Attempt ka metadata
  → question_order yahan store hota hai
  → phase, violation_count, resume_status yahan hote hain
  → question_n_answer empty hoti hai

is_attempt_marker: false  ← Actual answers
  → question_n_answer filled hoti hai (autosave)
  → completed: false (autosave) ya true (final submit)
```

---

## 11. Test Series — Shuffle Logic

### Backend mein Kahan Hai

```
src/api/test-serie/controllers/student.js
→ startNewAttempt() function
→ Line ~1216
```

### Algorithm

```js
// Fisher-Yates Shuffle — Guaranteed different from original
const shuffleGuaranteed = (ids) => {
  if (ids.length <= 1) return [...ids];
  
  let shuffled;
  let attempts = 0;
  
  do {
    shuffled = [...ids];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    attempts++;
  } while (
    attempts < 10 &&
    shuffled.every((id, idx) => id === ids[idx])  // Same as original? Retry
  );
  
  return shuffled;
};
```

### Rules

1. `randomize_questions: true` hona chahiye paper pe
2. Har student ko alag order milta hai
3. Reattempt pe **same order** milta hai (attempt 1 ka)
4. Shuffled order kabhi admin ke original order jaisa nahi hoga
5. Order `answers.question_order` mein save hota hai JSON format mein: `{ "paperId": [id1, id2, id3] }`

### Verify Karo Shuffle Kaam Kiya Ya Nahi

```
Browser mein hit karo:
/api/answers?filters[is_attempt_marker][$eq]=true
  &filters[test_series][id][$eq]=<paperId>
  &fields[0]=attempt_id&fields[1]=question_order
  &sort[0]=attempt_id:asc

Response mein:
- question_order null → Shuffle enable nahi tha paper pe
- question_order filled → Shuffle hua ✅
- Attempt 1 aur 2 same order → Reattempt logic sahi ✅
```

---

## Quick Reference

### Strapi entityService Methods

```js
// Single record fetch
strapi.entityService.findOne("api::collection.collection", id, { populate })

// Multiple records fetch
strapi.entityService.findMany("api::collection.collection", { filters, populate, sort })

// Create
strapi.entityService.create("api::collection.collection", { data })

// Update
strapi.entityService.update("api::collection.collection", id, { data })

// Delete
strapi.entityService.delete("api::collection.collection", id)
```

### ctx Object — Controller mein

```js
ctx.params        // URL params  → /test-series/:seriesId → ctx.params.seriesId
ctx.query         // URL query   → ?populate=papers → ctx.query.populate
ctx.request.body  // POST body   → { data: { ... } }
ctx.state.user    // JWT user    → { id: 414, role: "student" }

ctx.send()        // Response bhejo
ctx.badRequest()  // 400 error
ctx.unauthorized()// 401 error
ctx.forbidden()   // 403 error
ctx.notFound()    // 404 error
```

### Common Strapi Filter Patterns

```js
// Controller mein DB filter
filters: {
  student: { id: { $eq: user.id } },
  test_series: { id: { $eq: seriesId } },
  is_attempt_marker: { $eq: true },
  completed: { $ne: true },
}
```
