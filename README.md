# framedInsight Web Platform

**The Intelligent Backbone for Kenyan Agriculture.**

framedInsight is a high-performance, AI-driven farm management platform designed for the modern Kenyan farmer. It bridges the gap between field-level operations and high-tech insights using Satellite imagery, AI predictive models, and a WhatsApp-first conversational interface.

---

## 🌟 Key Pillars

### 🛰️ EUDR Satellite Compliance (Coffee)
Built for the upcoming EU Deforestation Regulation (EUDR) deadline.
- **Plot Mapping**: Precision GPS polygon mapping of coffee plots using Leaflet.
- **Deforestation Baseline**: Automatic verification against 2020 forest cover baselines.
- **Field Evidence**: Native mobile camera integration for geo-tagged "ground-truth" photo evidence.
- **Compliance Export**: Standards-compliant GeoJSON export for cooperatives and international buyers.

### 🤖 AI Early Warning System (Livestock)
Sensor-less health and breeding monitoring using advanced pattern recognition.
- **Dairy EWS**: AI-powered prediction of heat (estrus) cycles, mastitis risk, and milk decline anomalies.
- **Small Ruminants EWS**: Species-specific (Goat/Sheep) growth tracking and weight loss alerts for early disease detection.
- **Proactive Alerts**: Critical warnings are pushed directly to the farmer's WhatsApp.

### 📱 LipaChat WhatsApp Integration
The primary interface for field data entry and expert advice.
- **Conversational Entry**: Record harvests, milk yields, and health events using natural language (English/Sheng).
- **AI Intent Processor**: Deep-parsing engine that understands commands like *"I harvested 50kg cherry from Hillside plot"* and updates the database instantly.
- **Expert On-Demand**: Instant access to AI agronomy and veterinary advice.

### 📍 IEBC-Verified Location Data
- Full hierarchy of **47 Counties**, **302 Constituencies**, and **1,450 Wards**.
- Verified against official IEBC shapefiles for 100% accuracy in plot registration.

---

## 🛠️ Tech Stack

- **Framework**: [Next.js 14+](https://nextjs.org/) (App Router)
- **Database**: [Supabase](https://supabase.com/) (PostgreSQL with JSONB for GPS polygons)
- **AI Engine**: [Vercel AI SDK](https://sdk.vercel.ai/) with OpenAI GPT-4o
- **WhatsApp Gateway**: [LipaChat API](https://lipachat.com/)
- **Mapping**: Leaflet.js for lightweight, offline-capable GIS visualization
- **Styling**: TailwindCSS with a high-contrast dark theme for field visibility

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Supabase Project
- OpenAI API Key
- LipaChat API Key

### Installation

```bash
# Clone the repository
git clone https://github.com/your-repo/framedinsight-web

# Install dependencies
npm install

# Run the development server
npm run dev
```

### Configuration
Create a `.env.local` file:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# AI
OPENAI_API_KEY=

# WhatsApp (LipaChat)
LIPACHAT_API_KEY=
LIPACHAT_WHATSAPP_NUMBER=

# Maps
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY= (Optional, for fallback)
```

---

## 📁 Core Structure

- `app/api/webhooks/whatsapp`: The "Brain" receiving incoming LipaChat messages.
- `lib/ai/intent-processor.ts`: The parser translating chat to database actions.
- `app/dashboard/coffee/eudr-check`: The Satellite/GIS compliance engine.
- `app/api/ai/livestock-warnings`: The Early Warning System (EWS) logic.

---

**Built with ❤️ for the future of Kenyan Agriculture.**
