# চালু করার চেকলিস্ট

এই repository একটি starter; production চালুর আগে নিচের সেটআপ ও বাস্তব environment-এ পরীক্ষা প্রয়োজন। কোনো secret Git বা chat-এ দেবেন না।

## ১. Database ও API
1. PostgreSQL database তৈরি করে backup নিন এবং `database/schema.sql` চালান। পুরোনো database থাকলে আগে backup ও staging-এ migration পরীক্ষা করুন; schema চালালেই সব পুরোনো schema স্বয়ংক্রিয়ভাবে migrate হবে এমন নিশ্চয়তা নেই।
2. `apps/api/.env` তৈরি করতে `.env.example` কপি করুন। `DATABASE_URL`, অন্তত ৩২ অক্ষরের random `JWT_SECRET` এবং `WEB_ORIGIN` দিন। Production API host-এর environment settings-এ এই মানগুলো রাখুন, Git-এ নয়।
3. API deploy করুন এবং `/api/health`-এ `database: connected` আছে কি না দেখুন। `WEB_ORIGIN`-এ প্রতিটি অনুমোদিত frontend origin (যেমন `https://anime-hub-bangla-two.vercel.app`, path ছাড়া) comma দিয়ে দিন। API পরিবর্তন কার্যকর করতে পুনরায় deploy/restart দরকার।
4. প্রথম Super Admin না থাকলে `docs/ADMIN-SETUP.md` অনুসরণ করুন। আগে থেকে account থাকলে আবার তৈরি করতে হবে না।

## ২. Website
1. Vercel-এ web project-এর build output `apps/web/dist` এবং build command `npm run build -w apps/web` সেট করুন (repository root থেকে install/build করলে)। Project root `apps/web` হলে সেই অনুযায়ী Vercel build settings পরিবর্তন করুন।
2. Vercel build-time `VITE_API_URL`-এ deploy করা API-র HTTPS origin দিন, যেমন `https://your-api.example.com` (এটি উদাহরণ, প্রকৃত ঠিকানা নয়)। Website পুনরায় deploy করুন। Public frontend environment variable-এ কখনও secret দেবেন না।
3. Local development-এ `npm run dev` web ও API চালায়। Vite `/api` request স্থানীয় API-তে proxy করে; browser থেকে localhost API সরাসরি ডাকা লাগে না। API-তে `.env` ও database না থাকলে catalogue/account কাজ করবে না।

## ৩. Content ও পরিষেবা
- Admin → Anime & Episodes থেকে draft তৈরি, edit ও publish করুন। Episode এবং anime দুটোই publish করতে হবে। শুধুমাত্র অনুমোদিত content ব্যবহার করুন।
- Cloudflare Stream upload ব্যবহার করলে server-এ `CLOUDFLARE_STREAM_ACCOUNT_ID` এবং `CLOUDFLARE_STREAM_API_TOKEN` সেট করুন। বাস্তব upload/playback যাচাই করুন। Premium রক্ষায় provider-side signed playback এখনও প্রয়োজন; বর্তমান endpoint একা DRM নয়।
- Payment ব্যবস্থা বর্তমানে manual verification; live gateway, webhook ও automatic reconciliation তৈরি/কনফিগার করা নেই। অনুমোদনের আগে merchant account-এ transaction যাচাই করুন।
- Adsterra পরিসংখ্যান manual import; automated integration নয়। Email verification/reset, push delivery, Bunny Stream integration এবং production security review এখনও প্রয়োজন। Maintenance flag access বন্ধ করে না।

## ৪. যাচাই
`npm install`, `npm run build`, `npm test` চালান। Smoke test database ছাড়া API health ও protected-route checks করে; এটি database, payments বা ভিডিওর end-to-end test নয়। Staging environment-এ login, anime ও episode edit/publish, video, payment review, moderation, mobile layout এবং backup restore পরীক্ষা করুন। তারপর frontend ও API দুটো deploy করে আবার পরীক্ষা করুন।
