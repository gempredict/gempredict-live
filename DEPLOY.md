# GemPredict — Deployment Checklist

Follow these steps in order. Takes about 20-30 minutes total.

---

## BEFORE YOU START — What you need

- [ ] Node.js installed (version 18+). Check with: `node -v`
      Download from: https://nodejs.org
- [ ] A GitHub account (free): https://github.com
- [ ] A Vercel account (free): https://vercel.com — sign up with GitHub
- [ ] Your Anthropic API key from: https://console.anthropic.com

---

## PART 1 — Set up the project locally (10 min)

**Step 1.** Copy all the project files into a folder on your computer called `gempredict`.

Your folder structure should look like this:
```
gempredict/
  pages/
    index.js
    _app.js
  pages/api/
    predict.js
  src/
    App.jsx
  emails.json
  package.json
  next.config.js
  .gitignore
  .env.local.example
```

**Step 2.** Create your local environment file.

In the `gempredict` folder, create a new file called `.env.local` (note the dot at the start).
Copy the contents of `.env.local.example` into it, then replace `your_anthropic_api_key_here`
with your actual Anthropic API key.

It should look like:
```
CLAUDE_API_KEY=sk-ant-api03-xxxxxxxxxxxxxxxxxxxxx
```

**Step 3.** Open a terminal (Mac: Terminal app, Windows: Command Prompt or PowerShell).
Navigate into your project folder:
```
cd path/to/gempredict
```

**Step 4.** Install dependencies:
```
npm install
```

**Step 5.** Run the development server:
```
npm run dev
```

**Step 6.** Open your browser and go to: http://localhost:3000

You should see GemPredict. Try searching for a card to confirm the API works.

---

## PART 2 — Push to GitHub (5 min)

**Step 7.** Go to https://github.com and click "New repository".
- Name it: `gempredict`
- Set it to Private (recommended)
- Do NOT add README, .gitignore, or license (you already have them)
- Click "Create repository"

**Step 8.** In your terminal, run these commands one at a time:
```
git init
git add .
git commit -m "Initial GemPredict commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/gempredict.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your actual GitHub username.

---

## PART 3 — Deploy to Vercel (5 min)

**Step 9.** Go to https://vercel.com and log in with your GitHub account.

**Step 10.** Click "Add New Project" then "Import Git Repository".

**Step 11.** Find and select your `gempredict` repository.

**Step 12.** On the configuration screen:
- Framework Preset: Next.js (Vercel detects this automatically)
- Root Directory: leave as-is
- Do NOT change anything else yet
- Do NOT click Deploy yet

**Step 13.** ADD YOUR API KEY — this is critical.
- Click "Environment Variables"
- Name:  `CLAUDE_API_KEY`
- Value: your Anthropic API key (starts with `sk-ant-`)
- Click "Add"

**Step 14.** Now click "Deploy".

Vercel will build and deploy your site. Takes about 2-3 minutes.

**Step 15.** When done, Vercel gives you a URL like `gempredict.vercel.app`.
Open it and test a card search.

---

## PART 4 — Connect your custom domain (5 min)

**Step 16.** In your Vercel project dashboard, go to Settings → Domains.

**Step 17.** Type `gempredict.com` and click Add.

**Step 18.** Vercel shows you DNS records to add. Copy them.

**Step 19.** Log into your domain registrar (GoDaddy, Namecheap, Google Domains, etc.).
Find the DNS settings for gempredict.com and add the records Vercel showed you.

**Step 20.** Wait 10-30 minutes. Your site will be live at https://gempredict.com.

---

## PART 5 — Future deployments (automatic after this)

Once connected to GitHub, every time you push code changes:
```
git add .
git commit -m "describe your change"
git push
```
Vercel automatically redeploys. No manual steps needed.

---

## TROUBLESHOOTING

**"API key is invalid" error on the live site:**
- Go to Vercel → your project → Settings → Environment Variables
- Check that CLAUDE_API_KEY is set correctly
- After changing env vars, go to Deployments and click "Redeploy"

**Card search works locally but not on Vercel:**
- Most common cause: CLAUDE_API_KEY not set in Vercel environment variables
- Check Vercel function logs: Project → Functions tab → click on predict

**Rate limit hits too quickly during testing:**
- The limit is 5 predictions per hour per IP
- To change it, edit `RATE_LIMIT_MAX` in `/pages/api/predict.js`

**"Module not found" error:**
- Run `npm install` again in your project folder

---

## IMPORTANT NOTES FOR FUTURE SCALING

1. **Email storage:** Currently emails are stored in memory only (they disappear on redeploy).
   To persist emails, add Vercel KV or a database. Search "Vercel KV quickstart" for instructions.

2. **Rate limiting:** The in-memory rate limiter resets on each server instance. For high traffic,
   use Upstash Redis with Vercel. Search "Vercel Upstash rate limiting" for instructions.

3. **API costs:** Each card prediction costs roughly $0.01-0.03 in Anthropic API fees.
   Monitor usage at https://console.anthropic.com/usage

4. **Monitoring:** Vercel shows function logs and errors in the dashboard under the Functions tab.
