# MeetActions: API Specification (v1.0)

This document provides a technical overview of the MeetActions Backend API. It is designed for developers, technical evaluators, and system architects.

## 📡 Base Configuration
- **Base URL:** `http://[YOUR_IP]:5005`
- **Protocol:** HTTP (Production should use HTTPS)
- **Data Format:** JSON
- **Authentication:** Bearer Token (JWT) in Header

---

## 🔐 1. Authentication (`/api/auth`)

| Endpoint | Method | Description | Auth |
| :--- | :--- | :--- | :--- |
| `/register` | POST | Create a new user account | No |
| `/login` | POST | Standard email/password login | No |
| `/google` | POST | Secure Google OAuth token verification | No |
| `/profile` | PATCH | Update name, email, or password | Yes |
| `/image/:filename` | GET | Securely fetch a user's profile picture | Yes |
| `/account` | DELETE | **GDPR Compliance:** Delete user and all associated data | Yes |

---

## 🎙️ 2. Meetings & AI (`/api/meetings`)

| Endpoint | Method | Description | Auth |
| :--- | :--- | :--- | :--- |
| `/` | GET | List user's meetings (includes shared access) | Yes |
| `/` | POST | Upload and start AI processing (Multi-part form) | Yes |
| `/:id` | GET | Fetch deep-dive details, transcript, and AI analysis | Yes |
| `/:id` | PATCH | Update title, notes, or speaker names | Yes |
| `/:id` | DELETE | Delete meeting and purge physical audio file | Yes |
| `/search` | GET | Global semantic search across history | Yes |
| `/analytics` | GET | Aggregated usage stats for the dashboard | Yes |
| `/proactive-insights` | GET | Daily action plan and recent meeting brief | Yes |
| `/media/:filename` | GET | Securely stream audio recording (Access verified) | Yes |

---

## 📁 3. Organization & Projects (`/api/projects`)

| Endpoint | Method | Description | Auth |
| :--- | :--- | :--- | :--- |
| `/` | GET | List all user projects/folders | Yes |
| `/` | POST | Create a new project | Yes |
| `/:id` | DELETE | Remove project | Yes |

---

## 🧠 AI Pipeline Workflow
1. **Ingestion:** Backend receives Multi-part form with `audio` and optional `image`.
2. **Transcription:** Audio is sent to Gemini 2.5 Flash for diarized speech-to-text.
3. **Extraction:** Transcript + Image are analyzed by Gemini to generate structured JSON (Summary, Tasks, Decisions).
4. **Post-Processing:** Translation and Sharing endpoints enable collaborative workflows.

## 🛡️ Security Implementation
- **JWT Middleware:** Verifies session integrity before allowing access to user data.
- **CORS:** Restricted to trusted origins and local development network.
- **Rate Limiting:** Protects expensive AI endpoints from automated abuse.
- **FS Isolation:** Sensitive media is proxied; never served via open static routes.

---
**Build:** v2024.05.26 | **Author:** William Bentil
