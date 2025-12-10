# Netlify Deployment & Environment Variables Guide

## 1. Fast Fix for Netlify Deployment
When deploying to Netlify, your local `.env` files are **NOT** uploaded (they are git-ignored for security). You must verify the environment variables in the Netlify Dashboard.

1.  Log in to [Netlify](https://app.netlify.com/).
2.  Select your site.
3.  Go to **Site configuration** > **Environment variables**.
4.  Click **Add a variable** > **Add a single variable**.
5.  Add the following two variables (copy values from your local `.env` file):
    *   `VITE_SUPABASE_URL`
    *   `VITE_SUPABASE_ANON_KEY`
    *   (And any others like `OPENAI_API_KEY`, etc. if your backend functions need them)

## 2. Fix for Local "Missing Supabase environment variables"
Our checks detected that your `.env.local` file is missing the `VITE_` variables. Even if you have them in `.env`, `vite` might be prioritizing the (incomplete) `.env.local`.

**Action:** Open `.env.local` and assume the following lines are present:

```env
VITE_SUPABASE_URL=your_actual_url_here
VITE_SUPABASE_ANON_KEY=your_actual_key_here
```

## 3. Deployment Checklist
- [ ] Build Command: `npm run build`
- [ ] Publish Directory: `dist`
- [ ] Environment Variables set in Netlify Dashboard
