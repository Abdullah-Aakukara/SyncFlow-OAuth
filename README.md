<div align="center">

# 🔗 SyncFlow — HubSpot OAuth Integration Engine

A backend OAuth 2.0 engine that connects a server to HubSpot CRM.  
Handles authorization, token exchange, CSRF validation, and live CRM data fetching — all backed by Redis.

[![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-000000?style=flat-square&logo=express&logoColor=white)](https://expressjs.com)
[![Redis](https://img.shields.io/badge/Redis_Cloud-DC382D?style=flat-square&logo=redis&logoColor=white)](https://redis.io)
[![HubSpot](https://img.shields.io/badge/HubSpot_API-FF7A59?style=flat-square&logo=hubspot&logoColor=white)](https://developers.hubspot.com)

</div>

---

**Live Demo:** [🔗 SyncFlow - OAuth](https://syncflow-oauth.onrender.com)  
**Status:** Production-Ready 

## Tech Stack

| | |
|---|---|
| **Runtime** | Node.js |
| **Framework** | Express.js v5 |
| **Token Storage** | Redis Cloud |
| **HTTP Client** | Axios |
| **CRM Provider** | HubSpot CRM API v3 |

---

## Project Structure

```
root/
├── public/                                       # Static Assets
|     ├── index.html
|     ├── style.css
|     └── app.js
├── main.js                                       # Entry point
├── .env                                          # Environment variables
├── redis/
│   └── redisClient.js                            # Redis Cloud connection (singleton)
└── src/
    ├── app.js                                    # Express setup — CORS, JSON, router
    ├── routes/
    │   └── hubspot.routes.js                     # Route definitions
    └── controllers/
        ├── hubspotAuth.controller.js             # POST /authorize
        ├── oauth2cbHubspot.controller.js         # GET  /oauth2callback
        ├── hubspotCredVerify.controller.js       # POST /credentials
        └── hubspotGetItems.controllers.js        # POST /load
```

---

## OAuth 2.0 Flow

```
Client          Backend             HubSpot          Redis
  │                │                   │               │
  │ POST /authorize│                   │               │
  │──────────────> │                   │               │
  │                │ SET state key     │               │
  │                │──────────────────────────────>    │
  │  { authUrl }   │                   │               │
  │<────────────── │                   │               │
  │                │                   │               │
  │  Opens authUrl (popup)             │               │
  │──────────────────────────────────> │               │
  │                │                   │               │
  │                │ GET /oauth2callback               │
  │                │<────────────────── │               │
  │                │ Validate state     │               │
  │                │<───────────────────────────────── │
  │                │ POST /oauth/v3/token              │
  │                │──────────────────>│               │
  │                │  { access_token } │               │
  │                │<────────────────── │               │
  │                │ SET access_token  │               │
  │                │──────────────────────────────>    │
  │  window.close()│                   │               │
  │<────────────── │                   │               │
```

---

## API Endpoints

Base URL: `http://localhost:8000/integrations/hubspot`

---

### `POST /authorize`
Stores `userId:orgId` state in Redis, returns a HubSpot OAuth authorization URL.

**Request:**
```json
{ "userId": "user_001", "orgId": "org_acme" }
```
**Response `200`:**
```json
{ "authUrl": "https://app-na2.hubspot.com/oauth/authorize?..." }
```

---

### `GET /oauth2callback`
HubSpot's redirect URI. Validates `state` against Redis (CSRF check), exchanges `code` for an `access_token`, and stores the token in Redis.

**Query Params:** `code`, `state`  
**Response `200`:** HTML with `window.close()`  
**Response `401`:** `{ "error": "You are not an Authorized person!" }`

---

### `POST /credentials`
Checks if a valid access token exists in Redis for the given `userId + orgId`.

**Request:**
```json
{ "userId": "user_001", "orgId": "org_acme" }
```
**Response `200`:** `{ "message": "Success!" }`  
**Response `401`:** `{ "error": "User Unauthorized!" }`

---

### `POST /load`
Fetches the stored access token from Redis and retrieves up to 10 contacts from the HubSpot CRM API.

**Request:**
```json
{ "userId": "user_001", "orgId": "org_acme" }
```
**Response `200`:**
```json
{
  "results": [
    { "id": "12345", "properties": { "firstname": "John", "lastname": "Doe", "email": "john@example.com" } }
  ]
}
```

---

## Design Decisions

**Redis Key Design**  
A single key pattern `"State of {userId}:{orgId}"` is used for both purposes — the initial value is the JSON state object, which is overwritten in-place with the access token after a successful callback. This eliminates stale state and keeps token lookup simple.

**CSRF Protection**  
The `state` parameter (JSON-encoded `{ userId, orgId }`) is stored in Redis before the user is redirected. On callback, the returned state is compared against the stored value. A mismatch returns `401`.

**Multi-Tenant Isolation**  
Tokens are scoped by `userId + orgId`, so multiple users and organizations can authorize independently without conflict.

---

## Getting Started

### 1. Clone & Install

```bash
git clone https://github.com/Abdullah-Aakukara/SyncFlow-OAuth.git
cd SyncFlow-OAuth/backend
npm install
```

### 2. Configure `.env`

```env
PORT=8000
CLIENT_ID=your_hubspot_client_id
CLIENT_SECRET=your_hubspot_client_secret
REDIS_USER=default
REDIS_PASSWORD=your_redis_password
```

### 3. HubSpot App Setup

In your [HubSpot Developer Portal](https://developers.hubspot.com/apps):
- Set the redirect URL to `http://localhost:8000/integrations/hubspot/oauth2callback`
- Add scopes: `oauth`, `crm.objects.contacts.read`

### 4. Run

```bash
npm run dev
```

Server starts on `http://localhost:8000`.

---

<div align="center">

**SyncFlow v1.0** · Built by [Abdullah Aakukara](https://github.com/Abdullah-Aakukara)

</div>
