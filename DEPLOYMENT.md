# framedInsight Deployment Guide

## 🚀 Quick Deployment to Vercel (Recommended)

### Prerequisites
1. GitHub account
2. Vercel account (free tier works)
3. All environment variables ready

### Steps

**1. Push to GitHub**
```bash
cd framedinsight-web
git init
git add .
git commit -m "Initial commit: framedInsight web platform"
git remote add origin https://github.com/YOUR_USERNAME/framedinsight-web.git
git push -u origin main
```

**2. Deploy to Vercel**
1. Go to [vercel.com](https://vercel.com)
2. Click "New Project"
3. Import your GitHub repository
4. Vercel will auto-detect Next.js
5. Add environment variables (from .env.example)
6. Click "Deploy"

**3. Configure Custom Domain (Optional)**
1. In Vercel dashboard → Settings → Domains
2. Add `framedinsight.com` and `www.framedinsight.com`
3. Update DNS records as instructed

### Environment Variables in Vercel

Add these in: **Project Settings → Environment Variables**

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
LIPACHAT_API_KEY
LIPACHAT_WEBHOOK_SECRET
OPENAI_API_KEY
AGROMONITORING_API_KEY
NEXT_PUBLIC_SITE_URL (use your vercel.app URL)
```

---

## 🗄️ Deploy Location Data to Supabase

### What Gets Deployed
- ✅ **Database Schema** (47 tables): Farms, Coffee, Dairy, Sheep/Goats, WhatsApp, Markets
- ✅ **Kenya Location Data** (1450 wards): 47 counties, 290+ constituencies, verified IEBC data
- ✅ **Ward Name Corrections** (automatic): Compound names like "Songhor/Soba" properly spaced

### Before Deployment
```bash
# Ensure ward names are corrected
npm run prepare:locations
# Output: ✓ Fixed 2 ward names and ready to deploy
```

### Option 1: Supabase Web Console (Easiest - No Installation)

**Step 1:** Open SQL Editor
1. Go to https://app.supabase.com/ → Select your project
2. Click **SQL Editor** (left sidebar) → **+ New Query**

**Step 2:** Deploy Schema
1. Open [lib/schema_complete.sql](./lib/schema_complete.sql)
2. Copy all content (Ctrl+A → Ctrl+C)
3. Paste into Supabase SQL Editor → Click **Run**

**Step 3:** Seed Locations
1. Open [lib/seed_kenya_locations.sql](./lib/seed_kenya_locations.sql)
2. Copy all content → Paste in **new Supabase SQL query** → Click **Run**

**Step 4:** Verify Deployment
```sql
SELECT 'counties' as table_name, COUNT(*) as rows FROM counties
UNION ALL SELECT 'constituencies', COUNT(*) FROM constituencies
UNION ALL SELECT 'wards', COUNT(*) FROM wards;

-- Expected: counties=47, constituencies=290+, wards=1450
```

### Option 2: Deploy via CLI (Requires psql Installation)

**Windows:**
```powershell
# Install PostgreSQL client
choco install postgresql

# Then deploy
psql -h vwevegzvqjoppsbkowfl.supabase.co -U postgres -d postgres -f lib/schema_complete.sql
psql -h vwevegzvqjoppsbkowfl.supabase.co -U postgres -d postgres -f lib/seed_kenya_locations.sql
```

**Mac/Linux:**
```bash
brew install postgresql  # or: apt install postgresql-client

psql -h vwevegzvqjoppsbkowfl.supabase.co -U postgres -d postgres -f lib/schema_complete.sql
psql -h vwevegzvqjoppsbkowfl.supabase.co -U postgres -d postgres -f lib/seed_kenya_locations.sql
```

### Test Deployment in App
```bash
npm run dev
# Navigate to: http://localhost:3000/dashboard/settings
# Test Farm Profile → Location Dropdown should load all 1450 wards
```

---

## 🔧 Local Development Setup

**1. Clone & Install**
```bash
git clone https://github.com/YOUR_USERNAME/framedinsight-web.git
cd framedinsight-web
npm install
```

**2. Environment Variables**
```bash
cp .env.example .env.local
# Edit .env.local with your actual values
```

**3. Run Development Server**
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## 📦 Build for Production

```bash
# Create optimized production build
npm run build

# Test production build locally
npm run start
```

---

## 🌐 Alternative Deployment Platforms

### Railway
1. Install Railway CLI: `npm i -g @railway/cli`
2. Run: `railway login`
3. Run: `railway init`
4. Run: `railway up`
5. Add environment variables in Railway dashboard

### Netlify
1. Install Netlify CLI: `npm i -g netlify-cli`
2. Run: `netlify deploy --build`
3. Follow prompts
4. Add environment variables in Netlify dashboard

### AWS Amplify
1. Go to AWS Amplify console
2. Connect GitHub repository
3. Amplify auto-detects Next.js
4. Add environment variables
5. Deploy

---

## 📱 WhatsApp Webhook Configuration

After deployment, configure LipaChat webhook:

**1. Get Your Webhook URL**
```
https://your-domain.com/api/whatsapp
```

**2. Set in LipaChat Dashboard**
- Go to LipaChat dashboard
- Settings → Webhooks
- Add webhook URL
- Set HTTP method: POST
- Add webhook secret (same as in .env)

**3. Test Webhook**
Send a WhatsApp message to your bot number:
```
Hello
```

Check Vercel logs to confirm webhook received.

---

## 🗄️ Database Setup

**1. Supabase Project**
- Create project at [supabase.com](https://supabase.com)
- Note your project URL and anon key

**2. Run Schema**
- Go to SQL Editor in Supabase dashboard
- Paste contents of `framedInsight_Complete_Database_Schema.sql`
- Click Run

**3. Enable Row Level Security (RLS)**
```sql
-- Enable RLS on all tables
ALTER TABLE farms ENABLE ROW LEVEL SECURITY;
ALTER TABLE cows ENABLE ROW LEVEL SECURITY;
-- ... repeat for all tables

-- Create policy: Users can only access their own farm data
CREATE POLICY "Users can access own farm"
  ON farms
  FOR ALL
  USING (phone = auth.jwt() ->> 'phone');
```

**4. Enable PostGIS Extension**
```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

---

## 🔐 Security Checklist

Before going live:

- [ ] All environment variables set
- [ ] Database RLS policies enabled
- [ ] API keys restricted to production domain
- [ ] HTTPS enabled (auto with Vercel)
- [ ] WhatsApp webhook secret configured
- [ ] Google Maps API key restricted
- [ ] Rate limiting enabled on API routes
- [ ] CORS configured properly

---

## 📊 Monitoring & Analytics

### Vercel Analytics (Built-in)
- Auto-enabled on deploy
- View in Vercel dashboard

### Add Plausible (Privacy-friendly)
```tsx
// app/layout.tsx
<Script defer data-domain="framedinsight.com" src="https://plausible.io/js/script.js" />
```

### Error Tracking (Optional)
```bash
npm install @sentry/nextjs
```

---

## 🚨 Troubleshooting

### Build Fails
```bash
# Clear cache
rm -rf .next
npm run build
```

### Environment Variables Not Loading
- Check variable names match exactly
- Restart development server after changes
- For client-side vars, ensure `NEXT_PUBLIC_` prefix

### Google Maps Not Showing
- Verify API key
- Check API is enabled in Google Cloud Console
- Verify domain is whitelisted

### WhatsApp Webhook Not Receiving
- Check webhook URL is correct
- Verify HTTPS (required by LipaChat)
- Check Vercel function logs

---

## 📈 Performance Optimization

**1. Enable Caching**
```typescript
// lib/supabase.ts
export const supabase = createClient(url, key, {
  auth: { persistSession: true },
  db: { schema: 'public' },
  global: { headers: { 'x-cache-control': 'max-age=3600' } }
})
```

**2. Image Optimization**
```tsx
import Image from 'next/image'

<Image 
  src="/hero-image.jpg"
  alt="Farmer"
  width={800}
  height={600}
  priority
/>
```

**3. Route Segment Config**
```tsx
// app/dashboard/page.tsx
export const revalidate = 60 // Revalidate every 60 seconds
```

---

## 🔄 Continuous Deployment

With Vercel/Netlify, every push to `main` auto-deploys:

```bash
git add .
git commit -m "Add new feature"
git push origin main
# Auto-deploys!
```

---

## 📞 Support

**Deployment Issues:**
- Vercel Docs: https://vercel.com/docs
- Next.js Docs: https://nextjs.org/docs

**Database Issues:**
- Supabase Docs: https://supabase.com/docs

---

## ✅ Post-Deployment Checklist

After successful deployment:

- [ ] Homepage loads correctly
- [ ] All links work
- [ ] Sign-up flow tested
- [ ] WhatsApp webhook tested
- [ ] GPS mapper loads
- [ ] Mobile responsive
- [ ] SEO meta tags present
- [ ] Analytics tracking
- [ ] SSL certificate active
- [ ] Custom domain connected (if applicable)

**Your framedInsight platform is now live! 🎉**
