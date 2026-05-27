# MeetActions: The Complete Feature Catalog (v1.0)

MeetActions is a high-performance, enterprise-grade AI meeting platform. This document serves as the absolute list of every feature, interaction, and capability currently implemented in the application.

---

## 🔐 1. Identity & Security
- **Email/Password Authentication:** Standard secure signup and login flow.
- **One-Tap Google Login:** Frictionless social authentication using Google Auth Session.
- **JWT (JSON Web Token) Security:** Every API request is signed and verified via a secure token stored in encrypted device storage.
- **Strict Data Isolation (Multi-Tenancy):** Users can only see, search, or interact with meetings they created or that have been explicitly shared with them.
- **Profile Management:** 
    - View user details (Name, Email, Account Tier).
    - Dynamic Avatar generation using user initials.
    - Full Sign-out functionality with complete storage and cache purging.

## 🎙️ 2. Advanced Recording & Capture
- **High-Fidelity Audio Recording:** Studio-quality capture using `expo-av`.
- **Dual Visualizer:** Real-time animated frequency bars that respond to voice input.
- **Precision Recording Controls:** 
    - **Pause/Resume:** Manually halt and continue a session.
    - **Discard:** Instantly stop and purge an unwanted recording with state cleanup.
    - **Save:** Finalize and move to the AI processing stage.
- **Voice Activity Detection (VAD) / Auto-AI:** 
    - **Intelligent Auto-Pause:** Detects silence (< -45dB) for 5 seconds and pauses to save data.
    - **Auto-Resume:** Instantly resumes recording the moment speech is detected.
    - **Toggle Control:** Manually enable or disable Auto-AI before starting.
- **Zen Mode:** Distraction-free interface showing only a massive timer and a subtle pulse animation.
- **Smart Bookmarks (In-Session Tagging):**
    - **"Important":** Highlights critical context for the AI.
    - **"Decision":** Marks a verbal agreement for extraction.
    - **"Capture":** (Multi-modal) Triggers the device camera to take a photo of a whiteboard or slide.
- **Live Insights:** Dynamic text pills that appear during recording to show the AI is "listening" for patterns.
- **Dynamic Header:** Adaptive status indicators (LIVE / PAUSED / READY) with colored glows.

## 📁 3. Ingestion & Organization
- **External Audio Import:** Import and analyze existing `.m4a`, `.mp3`, or `.wav` files from device files or iCloud/Google Drive.
- **Manual Audio Trimming:** A surgical review tool to set `Start Time` and `End Time` before the AI processes the audio.
- **Meeting Projects (Folders):**
    - Create custom folders (Folders/Projects) with names and colors.
    - **Move to Folder:** Categorize sessions at any time via the action menu.
    - **Ungrouped View:** Access sessions not assigned to any project.
- **Date-Based Grouping:** History is automatically partitioned into "Today", "Yesterday", and "Earlier".
- **Global Search Engine:** Deep search across titles, AI-generated summaries, transcripts, and hashtags.

## 🧠 4. AI Core (Google Gemini 2.5 Flash)
- **Diarized Transcription:** Identifies and labels speakers (Speaker A, Speaker B, etc.) natively from the audio stream.
- **Contextual Processing Templates:**
    - **Lecture Mode:** Focuses on definitions and academic concepts.
    - **Stand-up Mode:** Focuses on blockers, updates, and immediate next steps.
    - **Interview Mode:** Focuses on candidate answers and hiring impressions.
    - **Default Mode:** General purpose professional summary.
- **Intelligent Summarization:** Creates a narrative overview of the session.
- **Decision Engine:** Extracts clear, bulleted lists of agreements.
- **Task Extraction:** 
    - Auto-identifies "Action Items".
    - Auto-assigns "Owners" based on context.
    - Auto-assigns "Priority" (High, Medium, Low).
- **Sentiment Analysis:** Detects the overall mood (Positive, Neutral, Negative).
- **Tone Detection:** Describes the conversational style (e.g., "Highly Collaborative").
- **Conflict Warning:** Alerts the user if significant disagreement or tension was detected.
- **Auto-Tagging:** Generates 3-5 topical hashtags for every session.
- **Follow-up Detection:** Identifies mentioned dates for future meetings.

## 💬 5. Interactive Assistant Suite
- **Per-Meeting AI Chat:** A dedicated Q&A tab for every recording. Ask specific questions like "What was the price quoted?" or "Who said X?".
- **AI Hub (Cross-Meeting Knowledge):** A global search tool on the Home screen that queries your entire 10-meeting history simultaneously.
- **Multi-language Translation:** Instant, high-quality translation of the Summary, Decisions, and Transcript into:
    - Spanish, French, German, Chinese, Japanese.

## 🤝 6. Collaboration & Sharing
- **Secure Internal Sharing:** Grant access to another MeetActions user by entering their email.
- **Shared Access Logic:** Recipient can view summaries and chat with the meeting, but cannot delete it.
- **Professional PDF Generator:** Creates a beautiful, branded PDF report with your company info and meeting metadata.
- **Native Sharing:** One-tap export of the meeting recap text to Slack, WhatsApp, iMessage, etc.
- **Follow-up Email Drafter:** Opens the device's native mail app with a pre-filled professional recap ready to send.

## 🛠️ 7. Enterprise Integration & Productivity
- **Slack Webhook Integration:** Export your extracted tasks directly to a Slack channel.
- **Notion Integration:** Sync your meeting outcomes to your Notion workspace via webhook.
- **Smart Calendar Scheduling:** AI-detected follow-ups can be added to your real device calendar (Google/iOS) with one tap.
- **Automated Task Reminders:** Sends a push notification 10 minutes before an extracted task's due date.
- **Manual Calendar Sync:** Export individual tasks to your calendar at any time.
- **Task Status Management:** Toggle tasks between "Pending" and "Completed" with local state syncing to the database.

## 📊 8. User Experience (UX) & Polish
- **Dual Theme Engine:** Full support for **Dark Mode** and **Light Mode** across all screens, modals, and components.
- **Bottom-Sheet Modal Pattern:** All interactions (Rename, Share, Translate, Add Task) use professional slide-up sheets.
- **Keyboard-Aware Layouts:** Interface elements automatically shift up when the keyboard is active to maintain visibility.
- **Backdrop Dismissal:** Tap anywhere outside a modal or menu to close it instantly.
- **Haptic Feedback:** Subtle vibrations on button taps and successful actions for a tactile feel.
- **Splash Screen:** Premium startup animation with logo scaling and glow effects.
- **Guided Onboarding:** Multi-slide carousel explaining app value and the "Pro" tier benefits.
- **Monetization Gateway:** 
    - Functional "Free vs. Pro" tier system.
    - **Paywall Screen:** Displays premium benefits and subscription plans.
    - **Simulated Checkout:** 2-second mock processing state before unlocking all features.
- **Usage Analytics Dashboard:**
    - Visual progress bar for task completion.
    - Stats for Total Sessions, Total Tasks, and Recording Hours.
    - **Topic Cloud:** Visualizes your most frequent meeting tags.

---
**MeetActions v1.0** — *The Definitive AI Meeting Assistant.*
