# 🚀 FarmQ — Vercel Deployment Guide (Step-by-Step)

यह गाइड आपको FarmQ प्रोजेक्ट को Vercel पर आसानी से डिप्लॉय करने के लिए सभी स्टेप्स समझाती है।

---

## 🛠️ प्रोजेक्ट में क्या-क्या कॉन्फ़िगर किया गया है?

1. **`vercel.json` (Root Directory)**:
   - Frontend Build command: `cd frontend && npm install && npm run build`
   - Output Directory: `frontend/dist`
   - Routing:
     - `/api/*` → Serverless Python Backend (`api/index.py`)
     - `/*` → React SPA Frontend (`index.html`)

2. **`api/index.py`**:
   - Vercel Serverless Function entry point जो FastAPI backend (`backend.app.main:app`) को Vercel पर रन करता है।

3. **`requirements.txt`**:
   - Vercel Python runtime के लिए सभी आवश्यक dependencies clean UTF-8 फॉर्मेट में सेट कर दी गई हैं।

4. **`frontend/vercel.json`**:
   - React Router के client-side routes (जैसे `/farmer/dashboard`, `/login`, `/centers`) के लिए SPA rewrites कॉन्फ़िगर किए गए हैं ताकि पेज रिफ्रेश करने पर 404 Error न आए।

5. **`QueueSocketContext.tsx`**:
   - Production WebSocket / Fallback logic अपडेट कर दी गई है ताकि Vercel पर बिना पोर्ट एरर के स्मूथ चले।

---

## 📋 Vercel पर अपलोड करने के स्टेप्स:

### Step 1: कोड को GitHub पर Push करें
अगर आपने अभी तक Git commit नहीं किया है, तो टर्मिनल में ये कमांड चलाएं:
```bash
git add .
git commit -m "Configure Vercel deployment with serverless FastAPI and Vite frontend"
git push origin main
```

---

### Step 2: Vercel पर Project Import करें
1. [vercel.com](https://vercel.com) पर लॉगिन करें।
2. **"Add New..."** पर क्लिक करके **"Project"** चुनें।
3. अपनी GitHub रिपॉजिटरी (**`sihproject`**) को खोजें और **"Import"** पर क्लिक करें।

---

### Step 3: Project Settings चेक करें
Vercel स्क्रीन पर:
- **Framework Preset**: `Vite` (या `Other`)
- **Root Directory**: `./` (Default ही रहने दें, खाली रखें)
- **Build Command & Output Directory**: `vercel.json` से automatically सेट हो जाएगा।

---

### Step 4: Environment Variables (पर्यावरण चर) जोड़ें ⚠️ ज़रूरी
Vercel पर **"Environment Variables"** सेक्शन खोलें और निम्नलिखित वेरिएबल्स ऐड करें:

| Variable Name | Value / Example | Description |
| :--- | :--- | :--- |
| `MONGODB_URL` | `mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority` | **आवश्यक**: Cloud MongoDB (MongoDB Atlas) URL |
| `DATABASE_NAME` | `farmq` | Database का नाम |
| `JWT_SECRET_KEY` | `farmq_super_secret_jwt_key_2026_crop_queue_ai` | टोकन ऑथेंटिकेशन के लिए सीक्रेट की |
| `JWT_ALGORITHM` | `HS256` | JWT Algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `1440` | लॉगिन सेशन समय (24 घंटे) |
| `GEMINI_API_KEY` | `आपका_Gemini_API_Key` | AI Mandi Assistant के लिए |
| `SMTP_HOST` | `smtp.gmail.com` | Email OTP के लिए |
| `SMTP_PORT` | `587` | Email port |
| `SMTP_USER` | `your_email@gmail.com` | Email address |
| `SMTP_PASS` | `your_app_password` | Gmail 16-digit App Password |
| `SMTP_FROM` | `FarmQ Security <your_email@gmail.com>` | Sender header |

> 💡 **MongoDB Atlas Note**:
> लोकल MongoDB (`127.0.0.1:27017`) Vercel के क्लाउड सर्वर से कनेक्ट नहीं हो सकता। इसके लिए [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas) पर जाकर एक Free (M0) Cluster बनाएं, "Network Access" में `0.0.0.0/0` (Allow Access from Anywhere) सेट करें, और कनेक्शन स्ट्रिंग को `MONGODB_URL` में डालें।

---

### Step 5: "Deploy" पर क्लिक करें 🎉
अब सीधे **"Deploy"** बटन पर क्लिक करें।
Vercel:
1. Frontend को बिल्ड करेगा (`dist/`).
2. Python API को Serverless फंक्शन के रूप में डिप्लॉय करेगा (`/api/*`).
3. कुछ ही पलों में आपको लाइव URL (उदा. `https://farmq-yourname.vercel.app`) मिल जाएगा!

---

## 🔍 डिप्लॉयमेंट टेस्ट करने के लिए URLs:
- **Frontend Home**: `https://your-domain.vercel.app/`
- **Farmer Dashboard**: `https://your-domain.vercel.app/farmer/dashboard`
- **Backend Health Check**: `https://your-domain.vercel.app/api/health`
- **Backend API Status**: `https://your-domain.vercel.app/api`
