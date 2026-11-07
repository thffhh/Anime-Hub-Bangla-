import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { pool } from '../db.js';
import { requireAuth, type AuthRequest } from '../auth.js';

const router = Router();
const registerSchema = z.object({ email:z.string().email().max(254), password:z.string().min(8).max(200), displayName:z.string().trim().min(2).max(60) });
const loginSchema = z.object({ email:z.string().email().max(254), password:z.string().min(1).max(200) });
const progressSchema = z.object({ episodeId:z.string().uuid(), positionSeconds:z.number().int().min(0), completed:z.boolean().optional().default(false) });

router.post('/register', async (req,res) => {
  const parsed=registerSchema.safeParse(req.body);
  if(!parsed.success) return res.status(400).json({error:'Name, valid email and password (at least 8 characters) are required'});
  if(!pool) return res.status(503).json({error:'Database not configured'});
  try {
    const {email,password,displayName}=parsed.data;
    const hash=await bcrypt.hash(password,12);
    const result=await pool.query(`INSERT INTO users(email,password_hash,display_name) VALUES($1,$2,$3) RETURNING id,email,display_name AS "displayName",role`,[email.toLowerCase(),hash,displayName]);
    res.status(201).json({user:result.rows[0],message:'Account created. Please sign in.'});
  } catch(e:any) {
    if(e?.code==='23505') return res.status(409).json({error:'An account with this email already exists'});
    console.error('register error',e); res.status(500).json({error:'Could not create account'});
  }
});

router.get('/me',requireAuth,async(req:AuthRequest,res)=>{
  if(!pool)return res.status(503).json({error:'Database not configured'});
  const r=await pool.query(`SELECT id,email,display_name AS "displayName",role,created_at AS "createdAt" FROM users WHERE id=$1`,[req.auth!.userId]);
  const m=await pool.query(`SELECT plan,status,starts_at AS "startsAt",ends_at AS "endsAt" FROM memberships WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1`,[req.auth!.userId]);
  res.json({user:r.rows[0],membership:m.rows[0]||{plan:'FREE',status:'ACTIVE'}});
});

router.get('/favorites',requireAuth,async(req:AuthRequest,res)=>{
 if(!pool)return res.status(503).json({error:'Database not configured'});
 const r=await pool.query(`SELECT a.id,a.slug,a.title,a.poster_url AS "posterUrl" FROM favorites f JOIN anime a ON a.id=f.anime_id WHERE f.user_id=$1 ORDER BY f.created_at DESC`,[req.auth!.userId]); res.json({data:r.rows});
});
router.post('/favorites/:animeId',requireAuth,async(req:AuthRequest,res)=>{
 if(!pool)return res.status(503).json({error:'Database not configured'});
 try { await pool.query(`INSERT INTO favorites(user_id,anime_id) SELECT $1,id FROM anime WHERE id=$2 ON CONFLICT DO NOTHING`,[req.auth!.userId,req.params.animeId]); res.status(201).json({saved:true}); }
 catch(e){console.error(e);res.status(400).json({error:'Could not save favorite'});}
});
router.delete('/favorites/:animeId',requireAuth,async(req:AuthRequest,res)=>{if(!pool)return res.status(503).json({error:'Database not configured'});await pool.query('DELETE FROM favorites WHERE user_id=$1 AND anime_id=$2',[req.auth!.userId,req.params.animeId]);res.json({saved:false});});

router.get('/history',requireAuth,async(req:AuthRequest,res)=>{
 if(!pool)return res.status(503).json({error:'Database not configured'});
 const r=await pool.query(`SELECT e.id AS "episodeId",e.episode_number AS "episodeNumber",e.title AS "episodeTitle",e.thumbnail_url AS "thumbnailUrl",w.position_seconds AS "positionSeconds",w.completed,w.updated_at AS "updatedAt",a.title AS "animeTitle",a.slug AS "animeSlug" FROM watch_progress w JOIN episodes e ON e.id=w.episode_id JOIN anime a ON a.id=e.anime_id WHERE w.user_id=$1 ORDER BY w.updated_at DESC LIMIT 100`,[req.auth!.userId]);res.json({data:r.rows});
});
router.put('/history',requireAuth,async(req:AuthRequest,res)=>{
 const p=progressSchema.safeParse(req.body);if(!p.success)return res.status(400).json({error:'Invalid watch progress'});if(!pool)return res.status(503).json({error:'Database not configured'});
 const {episodeId,positionSeconds,completed}=p.data;
 const valid=await pool.query('SELECT id FROM episodes WHERE id=$1 AND published=true',[episodeId]);if(!valid.rowCount)return res.status(404).json({error:'Episode not found'});
 await pool.query(`INSERT INTO watch_progress(user_id,episode_id,position_seconds,completed) VALUES($1,$2,$3,$4) ON CONFLICT(user_id,episode_id) DO UPDATE SET position_seconds=EXCLUDED.position_seconds,completed=EXCLUDED.completed,updated_at=now()`,[req.auth!.userId,episodeId,positionSeconds,completed]);res.json({saved:true});
});
router.delete('/history',requireAuth,async(req:AuthRequest,res)=>{if(!pool)return res.status(503).json({error:'Database not configured'});await pool.query('DELETE FROM watch_progress WHERE user_id=$1',[req.auth!.userId]);res.json({cleared:true});});

router.get('/membership',requireAuth,async(req:AuthRequest,res)=>{if(!pool)return res.status(503).json({error:'Database not configured'});const r=await pool.query(`SELECT plan,status,starts_at AS "startsAt",ends_at AS "endsAt" FROM memberships WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1`,[req.auth!.userId]);res.json({membership:r.rows[0]||{plan:'FREE',status:'ACTIVE'}});});
router.post('/membership/request',requireAuth,async(req:AuthRequest,res)=>{
 const p=z.object({
  plan:z.enum(['MONTHLY','YEARLY']),
  paymentMethod:z.enum(['BKASH','NAGAD','ROCKET','SSLCOMMERZ']),
  transactionReference:z.string().trim().min(4).max(120),
  amountBdt:z.number().positive().max(1000000)
 }).safeParse(req.body);
 if(!p.success)return res.status(400).json({error:'Plan, payment method, transaction reference and amount are required'});
 if(!pool)return res.status(503).json({error:'Database not configured'});
 try {
  const m=await pool.query(`INSERT INTO memberships(user_id,plan,status,payment_method,payment_reference) VALUES($1,$2,'PENDING',$3,$4) RETURNING id,plan,status,created_at AS "createdAt"`,[req.auth!.userId,p.data.plan,p.data.paymentMethod,p.data.transactionReference]);
  const payment=await pool.query(`INSERT INTO payment_submissions(user_id,membership_id,plan,payment_method,transaction_reference,amount_bdt) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,status,created_at AS "createdAt"`,[req.auth!.userId,m.rows[0].id,p.data.plan,p.data.paymentMethod,p.data.transactionReference,p.data.amountBdt]);
  res.status(202).json({membership:m.rows[0],payment:payment.rows[0],message:'Payment submitted for manual verification. Premium is not active until an admin verifies the transaction.'});
 } catch(e:any) {
  if(e?.code==='23505')return res.status(409).json({error:'This transaction reference has already been submitted'});
  console.error('membership payment submission failed',e);res.status(500).json({error:'Could not submit payment'});
 }
});
router.post('/playback-event',requireAuth,async(req:AuthRequest,res)=>{
 const p=z.object({episodeId:z.string().uuid(),eventType:z.enum(['PLAY','PROGRESS','COMPLETE']),watchedSeconds:z.number().int().min(0).max(86400).default(0)}).safeParse(req.body);
 if(!p.success)return res.status(400).json({error:'Invalid playback event'});if(!pool)return res.status(503).json({error:'Database not configured'});
 const episode=await pool.query('SELECT id,anime_id FROM episodes WHERE id=$1 AND published=true',[p.data.episodeId]);if(!episode.rowCount)return res.status(404).json({error:'Episode not found'});
 await pool.query('INSERT INTO playback_events(user_id,anime_id,episode_id,event_type,watched_seconds) VALUES($1,$2,$3,$4,$5)',[req.auth!.userId,episode.rows[0].anime_id,p.data.episodeId,p.data.eventType,p.data.watchedSeconds]);res.status(201).json({saved:true});
});

router.get('/payments',requireAuth,async(req:AuthRequest,res)=>{
 if(!pool)return res.status(503).json({error:'Database not configured'});
 const r=await pool.query(`SELECT id,plan,payment_method AS "paymentMethod",transaction_reference AS "transactionReference",amount_bdt AS "amountBdt",status,admin_note AS "adminNote",created_at AS "createdAt",reviewed_at AS "reviewedAt" FROM payment_submissions WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50`,[req.auth!.userId]);
 res.json({data:r.rows});
});


// Community reviews: one rating/review per user and title.
router.get('/reviews/:animeId', async (req,res)=>{
 if(!pool)return res.status(503).json({error:'Database not configured'});
 try{const r=await pool.query(`SELECT r.id,r.score,r.review,r.spoiler,r.created_at AS "createdAt",u.display_name AS "displayName" FROM ratings r JOIN users u ON u.id=r.user_id WHERE r.anime_id=$1 AND r.review IS NOT NULL ORDER BY r.created_at DESC LIMIT 100`,[req.params.animeId]);const avg=await pool.query('SELECT COALESCE(AVG(score),0)::numeric(3,1) AS average,COUNT(*)::int AS count FROM ratings WHERE anime_id=$1',[req.params.animeId]);res.json({data:r.rows,summary:avg.rows[0]});}catch{res.status(500).json({error:'Could not load reviews'});}
});
router.post('/reviews/:animeId',requireAuth,async(req:AuthRequest,res)=>{
 const p=z.object({score:z.number().int().min(1).max(10),review:z.string().trim().max(2000).optional().default(''),spoiler:z.boolean().optional().default(false)}).safeParse(req.body);
 if(!p.success)return res.status(400).json({error:'Rating must be 1–10 and review under 2,000 characters'});if(!pool)return res.status(503).json({error:'Database not configured'});
 try{const r=await pool.query(`INSERT INTO ratings(user_id,anime_id,score,review,spoiler) SELECT $1,id,$3,$4,$5 FROM anime WHERE id=$2 AND published=true ON CONFLICT(user_id,anime_id) DO UPDATE SET score=EXCLUDED.score,review=EXCLUDED.review,spoiler=EXCLUDED.spoiler,created_at=now() RETURNING id,score,review,spoiler`,[req.auth!.userId,req.params.animeId,p.data.score,p.data.review,p.data.spoiler]);if(!r.rowCount)return res.status(404).json({error:'Anime not found'});res.json({data:r.rows[0]});}catch{res.status(500).json({error:'Could not save review'});}
});
router.get('/comments/:animeId',async(req,res)=>{if(!pool)return res.status(503).json({error:'Database not configured'});try{const r=await pool.query(`SELECT c.id,c.body,c.created_at AS "createdAt",u.display_name AS "displayName" FROM comments c JOIN users u ON u.id=c.user_id WHERE c.anime_id=$1 AND c.status='PUBLISHED' ORDER BY c.created_at DESC LIMIT 100`,[req.params.animeId]);res.json({data:r.rows});}catch{res.status(500).json({error:'Could not load comments'});}});
router.post('/comments/:animeId',requireAuth,async(req:AuthRequest,res)=>{const p=z.object({body:z.string().trim().min(2).max(2000),episodeId:z.string().uuid().optional().nullable()}).safeParse(req.body);if(!p.success)return res.status(400).json({error:'Comment must be 2–2,000 characters'});if(!pool)return res.status(503).json({error:'Database not configured'});try{const r=await pool.query(`INSERT INTO comments(user_id,anime_id,episode_id,body,status) SELECT $1,id,$3,$4,CASE WHEN $5 IN ('SUPER_ADMIN','ADMIN','MODERATOR') THEN 'PUBLISHED' ELSE 'PENDING' END FROM anime WHERE id=$2 AND published=true RETURNING id,status,created_at AS "createdAt"`,[req.auth!.userId,req.params.animeId,p.data.episodeId||null,p.data.body,req.auth!.role]);if(!r.rowCount)return res.status(404).json({error:'Anime not found'});res.status(201).json({data:r.rows[0],message:r.rows[0].status==='PENDING'?'Comment submitted for moderation':'Comment published'});}catch{res.status(500).json({error:'Could not submit comment'});}});
router.post('/comments/:commentId/report',requireAuth,async(req:AuthRequest,res)=>{const p=z.object({reason:z.string().trim().min(3).max(500)}).safeParse(req.body);if(!p.success)return res.status(400).json({error:'Please provide a report reason'});if(!pool)return res.status(503).json({error:'Database not configured'});try{const r=await pool.query(`INSERT INTO content_reports(reporter_user_id,comment_id,reason) SELECT $1,id,$3 FROM comments WHERE id=$2 RETURNING id`,[req.auth!.userId,req.params.commentId,p.data.reason]);if(!r.rowCount)return res.status(404).json({error:'Comment not found'});res.status(201).json({submitted:true});}catch{res.status(500).json({error:'Could not submit report'});}});
router.get('/notifications',requireAuth,async(req:AuthRequest,res)=>{if(!pool)return res.status(503).json({error:'Database not configured'});const r=await pool.query(`SELECT id,title,body,href,read_at AS "readAt",created_at AS "createdAt" FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100`,[req.auth!.userId]);res.json({data:r.rows});});
router.patch('/notifications/:id/read',requireAuth,async(req:AuthRequest,res)=>{if(!pool)return res.status(503).json({error:'Database not configured'});const r=await pool.query('UPDATE notifications SET read_at=COALESCE(read_at,now()) WHERE id=$1 AND user_id=$2 RETURNING id',[req.params.id,req.auth!.userId]);if(!r.rowCount)return res.status(404).json({error:'Notification not found'});res.json({read:true});});

export default router;
