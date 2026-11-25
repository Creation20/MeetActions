# MeetActions: Elite AI Meeting Assistant

MeetActions is a high-performance, enterprise-grade AI platform designed to transform audio recordings and whiteboard visuals into structured, actionable insights. Built with a focus on premium UX, security, and productivity.

## 🚀 Project Overview

The project is divided into two main components:
- **Backend:** A Node.js/Express server using MongoDB for data persistence and Google Gemini 2.5 Flash for AI analysis.
- **Frontend:** A cross-platform mobile application built with React Native (Expo) and Expo Router.

## 📁 Project Structure

```
/
├── backend/            # Express Server (TypeScript)
│   ├── src/            # Application Logic
│   │   ├── controllers/# Route Handlers
│   │   ├── models/     # Mongoose Schemas
│   │   ├── routes/     # API Endpoints
│   │   └── services/   # AI, Transcription, and Translation logic
│   ├── scripts/        # Utility and Maintenance scripts
│   └── uploads/        # Local storage for audio and images
├── frontend/           # Mobile App (Expo SDK 54)
│   ├── app/            # Expo Router (Filesystem-based routing)
│   ├── src/            # Shared Components & Logic
│   │   ├── components/ # Reusable UI Components
│   │   ├── context/    # Auth and Theme state management
│   │   ├── services/   # API and Native integrations
│   │   └── styles/     # Dynamic theme-aware style engines
│   └── assets/         # App icons and static images
├── APP_FEATURES.md     # Detailed Catalog of all implemented features
└── README.md           # This file
```

## 🛠 Setup & Installation

### 1. Backend Setup
1. Navigate to the `backend` folder.
2. Install dependencies: `npm install`
3. Create a `.env` file (refer to `.env.example` or implementation notes).
4. Build the project: `npm run build`
5. Start in development mode: `npm run dev`

### 2. Frontend Setup
1. Navigate to the `frontend` folder.
2. Install dependencies: `npx expo install`
3. Start the development server: `npx expo start`

## 🧠 Core Technologies
- **AI:** Google Gemini 2.5 Flash (Transcription + Multimodal Extraction)
- **Database:** MongoDB
- **Styling:** Dynamic Theme Engine (Light/Dark Mode support)
- **Animations:** Lottie React Native

## 📄 Documentation
For a full list of every feature and technical detail, please refer to [APP_FEATURES.mdddd](./APP_FEATURES.md).

---
**Developed by William Bentil**
