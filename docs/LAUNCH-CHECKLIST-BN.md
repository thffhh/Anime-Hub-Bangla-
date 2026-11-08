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

## Homepage section controls
Super Admin → Website CMS থেকে Movies, Creative Community, Collaboration Partners এবং About দেখানো/লুকানো যায়। এই পরিবর্তনের জন্য নতুন frontend ও API দুটোই deploy করতে হবে। Catalog সবসময় দেখা যায়; admin login footer থেকে সরানো হলেও `/super-admin` ঠিকানায় পাওয়া যাবে। Backend role checks-ই admin access রক্ষা করে, লিংক লুকানো নয়।

## Homepage covers ও দাম
এই সংস্করণের জন্য database backup নিয়ে staging-এ পরীক্ষা করে `database/migrations/003_homepage_settings.sql` চালান। আগের schema-তে homepage settings-এর টেবিল না থাকলে নতুন controls কাজ করবে না। Existing table-এর গঠন আলাদা হলে আগে যাচাই করুন; `CREATE TABLE IF NOT EXISTS` বিদ্যমান table বদলায় না। এরপর API এবং web দুটোই deploy করুন।

Super Admin → Website CMS-এ accent, monthly/yearly price এবং homepage covers সেট করুন। ০ মানে দাম সেট করা হয়নি। দাম দেখানো বা manual request validation live payment gateway নয়। Cover-এর জন্য আগে ছবি HTTPS-এ host করুন; ছবির URL এবং published anime/episode নির্বাচন করে Save covers চাপুন। Episode video আগে Anime & Episodes-এ যোগ ও publish করতে হবে। Cover খোলা হলে ওই episode নির্বাচিত হবে; premium authorization আগের মতোই প্রযোজ্য। R2 কনফিগার থাকলে সরাসরি cover image upload-ও করা যায়।

## Manual Premium requests
Super Admin → Website CMS-এ plan price এবং **public** payment instructions দিন (শুধু প্রাপকের তথ্য ও নির্দেশনা, কোনো secret নয়)। Account → Membership থেকে ব্যবহারকারী transaction reference জমা দিতে পারে। Server configured price মিলিয়ে pending request রাখে; admin-কে provider portal-এ স্বাধীনভাবে যাচাই করে Payments-এ approve/reject করতে হবে। এটি টাকা সংগ্রহ করে না বা gateway webhook নয়। ০ বা unset price-এ request গ্রহণ করা হয় না। Live ব্যবহারের আগে staging-এ duplicate reference, price change, approval/rejection ও entitlement পরীক্ষা করুন।

## Cover image upload (Cloudflare R2)
Render API-তে `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, এবং bucket-এর সাথে যুক্ত public HTTPS domain/prefix `R2_PUBLIC_BASE_URL` দিন। R2 bucket ও public domain আগে তৈরি এবং serving যাচাই করতে হবে। API restart/redeploy-এর পর Website CMS থেকে JPEG/PNG/WebP (সর্বোচ্চ 5 MB) upload করা যাবে; server ছবি যাচাই করে WebP-তে রূপান্তর করে। অনুমোদিত admin ছাড়া upload করা যায় না। আগের URL দিয়েও cover দেওয়া যায়। Upload করলেই cover publish হয় না: Add cover ও Save covers চাপতে হবে। Cover সরালে বা draft বাতিল করলে storage থেকে uploaded file স্বয়ংক্রিয়ভাবে মুছে যায় না; storage cleanup প্রয়োজন। Credentials কখনও frontend-এ বা Git-এ দেবেন না।

## Collaboration partners
যদি আগের database-এ `collaboration_partners` ও `collaboration_partner_audit` না থাকে, backup নিয়ে staging-এ যাচাই করে `database/migrations/004_collaboration_partners.sql` চালান। বিদ্যমান table-এর গঠন আলাদা হলে আগে পরীক্ষা করুন। Render-এ Node.js 20.9+ দরকার। এরপর partner add, edit, publish এবং delete staging-এ যাচাই করুন।

Super Admin → Website CMS → Appearance & premium pricing-এ bKash ও Nagad-এর **public recipient mobile number** যোগ করুন (যেমন 01XXXXXXXXX বা +8801XXXXXXXXX; স্পেস নয়)। এগুলো সদস্যরা দেখতে পাবেন। কোনো PIN, password, OTP বা API secret দেবেন না। নম্বর ফাঁকা থাকলে সেই মাধ্যমের submission বন্ধ থাকবে; plan price-ও শূন্যের বেশি হতে হবে। Payment instructions-এ কোন পদ্ধতিতে টাকা পাঠাতে হবে তা স্পষ্ট করুন। Rocket/SSLCommerz-ও এখানে শুধু manual reference; কোনো automated checkout নয়। প্রতিটি payment provider portal-এ স্বাধীনভাবে যাচাই করুন।

## Login connection যাচাই
Vercel-এর `.vercel.app` ঠিকানায় default Render API ব্যবহার করলে `/api/*` same-origin proxy দিয়ে যায়। deploy-এর পর website-এর `/api/health` খুলে JSON দেখায় কি না পরীক্ষা করুন; HTML বা 404 এলে Vercel project root-এর `vercel.json` ও deploy settings যাচাই করুন। অন্য API বা custom domain হলে সঠিক `VITE_API_URL` এবং Render `WEB_ORIGIN`-এ exact website origin সেট করে আবার deploy করুন। `/api/health` সফল হলেও login-এর database/JWT বা account সমস্যা আলাদাভাবে থাকতে পারে। PIN/password কাউকে পাঠাবেন না।

## Android APK download
Super Admin → Android App-এ signed release APK-এর public HTTPS URL এবং চাইলে version দিন; save করলে homepage ও mobile menu-তে download link দেখাবে। URL ফাঁকা করে save করলে link লুকানো হবে। এই panel APK তৈরি, sign বা host করে না এবং অন্য কারও URL-এর নিরাপত্তা যাচাই করে না।

নিজের signed APK তৈরি করতে Android Studio ও Android SDK লাগবে। Repository root-এ dependencies install করার পর `npm run build`, প্রথমবার `npm run android:add`, এরপর `npm run android:sync` ও `npm run android:open` চালান। Android Studio-তে নিজস্ব নিরাপদ signing key ব্যবহার করে release APK তৈরি করুন এবং test device-এ যাচাই করুন। বিশ্বস্ত HTTPS hosting-এ সেই signed file দিন; browser-এ লিংক খুলে সত্যিই download হয় কি না পরীক্ষা করুন। Android wrapper `https://localhost` origin ব্যবহার করে; direct Render API-তে login কাজ করতে Render-এর `WEB_ORIGIN`-এ অতিরিক্তভাবে `https://localhost` দরকার হতে পারে (অন্য origin-গুলোর সঙ্গে comma-separated)। শুধু Android wrapper প্রয়োজন হলে এটি যোগ করুন; JWT secret বা signing key কখনও frontend বা chat-এ দেবেন না। App packaging, signing ও provider-সহ real-device test এই repository build একা নিশ্চিত করে না।

### Debug APK build
GitHub Actions → **Build Anime Hub Bangla APK** → Run workflow থেকে branch নির্বাচন করে চালানো যায়; successful run-এর Artifacts-এ `Anime-Hub-Bangla-debug-APK` পাবেন (ZIP খুললে APK)। এটি testing-এর debug build, Play Store বা production release নয়; স্থায়ী download link-ও নয়। এটি তৈরি করতে Android SDK 34, Java 17 ও Node 22 লাগে; local setup-এ `npm ci` তারপর `npm run android:build:debug` চালান। Build script প্রথমবার Android project তৈরি করে ও পরের বার sync করে। Google Play/public distribution-এর জন্য Android Studio দিয়ে নিজের signing key-সহ release তৈরি ও বাস্তব ফোনে পরীক্ষা করতে হবে। Android app-এর API access-এর জন্য Render `WEB_ORIGIN`-এ `https://localhost` origin যুক্ত করার প্রয়োজন হতে পারে।

Homepage cover এখন image-only slideshow; Super Admin → Website CMS থেকে cover এবং custom accent colour সেট করা যায়। এই setting কার্যকর হতে frontend ও API deploy করতে হবে।
