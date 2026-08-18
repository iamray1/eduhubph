// ============================================================
// EduHub PH — Express API Server
// Port 3001  ·  Nginx proxies /api/ → here (127.0.0.1 only)
// Stack: Express · pg · bcryptjs · JWT · Nodemailer · Helmet
// ============================================================

"use strict";

const express    = require("express");
const { Pool }   = require("pg");
const bcrypt     = require("bcryptjs");
const jwt        = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const helmet     = require("helmet");
const { v4: uuidv4 } = require("uuid");
const cors       = require("cors");
const rateLimit  = require("express-rate-limit");
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

const app  = express();
const PORT = process.env.API_PORT || 3001;
const PROD = process.env.NODE_ENV === "production";

// ─── TRUST PROXY (must be first — fixes IPs behind Nginx) ────────────────────
// "1" means trust exactly one hop (Nginx on localhost)
app.set("trust proxy", 1);

// ─── HIDE FINGERPRINTS ────────────────────────────────────────────────────────
app.disable("x-powered-by");

// ─── HELMET (HTTP security headers) ──────────────────────────────────────────
// This is a pure JSON API — CSP is locked down tight
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'none'"],
      scriptSrc:   ["'none'"],
      styleSrc:    ["'none'"],
      imgSrc:      ["'none'"],
      connectSrc:  ["'none'"],
      fontSrc:     ["'none'"],
      objectSrc:   ["'none'"],
      mediaSrc:    ["'none'"],
      frameSrc:    ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,   // not needed for API
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
}));

// ─── DATABASE ─────────────────────────────────────────────────────────────────

const db = new Pool({
  host:     process.env.DB_HOST     || "127.0.0.1",
  port:     parseInt(process.env.DB_PORT || "5432"),
  database: process.env.DB_NAME     || "eduhub",
  user:     process.env.DB_USER     || "eduhub",
  password: process.env.DB_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

db.on("error", (err) => {
  if (PROD) console.error("[DB] Pool error");
  else console.error("[DB] Pool error:", err.message);
});

// Clean up expired/used password-reset tokens on startup and every hour
async function purgeExpiredTokens() {
  try {
    await db.query(
      "DELETE FROM password_reset_tokens WHERE expires_at < NOW() OR used = TRUE"
    );
  } catch { /* non-fatal */ }
}
purgeExpiredTokens();
setInterval(purgeExpiredTokens, 60 * 60 * 1000);

// ─── MAILER ───────────────────────────────────────────────────────────────────

const mailer = nodemailer.createTransport({
  host:   process.env.SMTP_HOST || "smtp.zoho.com",
  port:   parseInt(process.env.SMTP_PORT || "465"),
  secure: true,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  pool: true,
  maxConnections: 3,
  socketTimeout: 10000,
});

async function sendEmail(to, subject, html) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    if (!PROD) console.log(`[MAIL] Not configured — would send: ${subject} → ${to}`);
    return;
  }
  await mailer.sendMail({
    from: `"${process.env.SMTP_NAME || "EduHub PH"}" <${process.env.SMTP_USER}>`,
    to, subject, html,
  });
}

// ─── INPUT HELPERS ────────────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,253}\.[^\s@]{2,}$/;
function isValidEmail(v) { return typeof v === "string" && EMAIL_RE.test(v.trim()); }

// Password: 8-128 chars, at least one letter and one digit
const PW_RE = /^(?=.*[A-Za-z])(?=.*\d).{8,128}$/;
function isValidPassword(v) { return typeof v === "string" && PW_RE.test(v); }

// Trim + cap length to prevent oversized DB writes
function sanitize(v, max = 255) {
  if (typeof v !== "string") return null;
  return v.trim().slice(0, max) || null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidUUID(v) { return typeof v === "string" && UUID_RE.test(v); }

// ─── CORS ─────────────────────────────────────────────────────────────────────

const allowedOrigins = [
  process.env.APP_URL || "https://eduhubph.tech",
  "http://localhost:5173",
  "http://localhost:4173",
];

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  maxAge: 600,
}));

// ─── BODY PARSING ─────────────────────────────────────────────────────────────
// Adaptive parser: post content routes get 2 mb, everything else 100 kb.
// Using a single global middleware avoids the express.json double-parse bug
// where a global parser marks req._body = true, causing route-level parsers
// to skip and silently leave the 2 mb limit unapplied on post routes.
const tightBody   = express.json({ limit: "100kb" });
const contentBody = express.json({ limit: "2mb" });
app.use((req, res, next) => {
  const isLargeContent =
    (req.method === "POST" || req.method === "PATCH") &&
    (/^\/api\/posts(\/\d+)?$/.test(req.path) || /^\/api\/static-pages\/\d+$/.test(req.path));
  (isLargeContent ? contentBody : tightBody)(req, res, next);
});

// ─── RATE LIMITERS ────────────────────────────────────────────────────────────

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,   // 15 min
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests. Please try again later." },
  skip: (req) => req.method === "OPTIONS",
});
app.use(globalLimiter);

// Auth endpoints: 10 attempts per 15 min per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many attempts. Please wait 15 minutes before trying again." },
});

// Forgot-password: 5 per hour to slow email abuse
const forgotLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many password reset requests. Please try again in an hour." },
});

// Feedback: 5 submissions per hour per IP
const feedbackLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many submissions. Please try again later." },
});

// Check account status: 15 per 15 min per IP (lightweight, just a DB read)
const checkAccountLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many attempts. Please wait before trying again." },
});

// Resend activation: 5 per hour per IP (each send costs email quota)
const resendActivationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many resend requests. Please wait an hour before trying again." },
});

// ─── JWT ──────────────────────────────────────────────────────────────────────

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.error("[FATAL] JWT_SECRET is missing or too short (min 32 chars). Set it in .env");
  process.exit(1);
}

function signToken(userId, email, role) {
  return jwt.sign(
    { sub: userId, email, role },
    JWT_SECRET,
    { expiresIn: "7d", algorithm: "HS256" }
  );
}

function verifyToken(token) {
  try { return jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] }); }
  catch { return null; }
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token  = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: "Unauthorized." });
  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ message: "Session expired. Please log in again." });
  req.user = payload;
  next();
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== "superadmin") return res.status(403).json({ message: "Forbidden." });
    next();
  });
}

// ─── ERROR HELPER ─────────────────────────────────────────────────────────────

function serverError(res, err, label = "Request") {
  if (!PROD) console.error(`[${label}]`, err);
  return res.status(500).json({ message: "An internal error occurred." });
}

// ─── AUTH ROUTES ──────────────────────────────────────────────────────────────

app.post("/api/auth/login", authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: "Email and password are required." });
    if (!isValidEmail(email)) return res.status(400).json({ message: "Invalid email format." });

    const normalized = email.toLowerCase().trim();
    const { rows } = await db.query(
      "SELECT id, email, password_hash, is_active FROM users WHERE email = $1",
      [normalized]
    );

    // Always run bcrypt (even on a dummy hash) to prevent timing-based enumeration
    const dummyHash = "$2b$12$AAAAAAAAAAAAAAAAAAAAAA.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
    const hash = rows.length ? rows[0].password_hash : dummyHash;
    const ok   = await bcrypt.compare(password, hash);

    // Check disabled AFTER bcrypt so response time doesn't leak account existence
    if (rows.length && !rows[0].is_active) {
      return res.status(403).json({ message: "Your account has been suspended. Please contact support at hello@eduhubph.tech." });
    }
    if (!rows.length || !ok) return res.status(401).json({ message: "Invalid email or password." });

    const { rows: profiles } = await db.query("SELECT role FROM profiles WHERE id = $1", [rows[0].id]);
    const role = profiles[0]?.role || "user";

    const token = signToken(rows[0].id, rows[0].email, role);
    res.json({ token, user: { id: rows[0].id, email: rows[0].email, role } });
  } catch (err) { return serverError(res, err, "Login"); }
});

app.post("/api/auth/register", authLimiter, async (req, res) => {
  try {
    const { email, first_name, last_name, middle_name, mobile_number } = req.body;

    if (!email || !first_name || !last_name)
      return res.status(400).json({ message: "First name, last name, and email are required." });
    if (!isValidEmail(email))
      return res.status(400).json({ message: "Invalid email format." });

    const normalized  = email.toLowerCase().trim();
    const sFirstName  = sanitize(first_name, 100);
    const sLastName   = sanitize(last_name, 100);
    const sMiddleName = sanitize(middle_name, 100);
    const sMobile     = sanitize(mobile_number, 30);

    if (!sFirstName || !sLastName)
      return res.status(400).json({ message: "Name fields cannot be empty." });

    const exists = await db.query("SELECT id FROM users WHERE email = $1", [normalized]);
    if (exists.rows.length) return res.status(409).json({ message: "An account with this email already exists." });

    // Placeholder hash — user must set real password via email link
    const hash       = await bcrypt.hash(uuidv4(), 12);
    const userId     = uuidv4();
    const resetToken = uuidv4();
    const expiresAt  = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Single atomic transaction: user + profile + reset token
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      await client.query("INSERT INTO users (id, email, password_hash) VALUES ($1, $2, $3)", [userId, normalized, hash]);
      await client.query(
        "INSERT INTO profiles (id, first_name, last_name, middle_name, mobile_number, role, is_active) VALUES ($1,$2,$3,$4,$5,'user',TRUE)",
        [userId, sFirstName, sLastName, sMiddleName, sMobile]
      );
      await client.query(
        "INSERT INTO password_reset_tokens (token, user_id, expires_at, type) VALUES ($1,$2,$3,'registration')",
        [resetToken, userId, expiresAt]
      );
      await client.query("COMMIT");
    } catch (e) { await client.query("ROLLBACK"); throw e; }
    finally { client.release(); }

    // Send welcome email — failure is non-fatal: account is created, user can use forgot-password
    const appUrl = process.env.APP_URL || "https://eduhubph.tech";
    try {
      await sendEmail(
        normalized,
        "Welcome to EduHub PH — Set Your Password",
        `<!DOCTYPE html><html><body style="font-family:sans-serif;color:#111;max-width:600px;margin:auto;padding:24px">
         <h2 style="margin-bottom:8px">Welcome to EduHub PH!</h2>
         <p>Hi ${sFirstName}, your account has been created. Click the button below to set your password and get started.</p>
         <p><a href="${appUrl}?reset=${resetToken}" style="display:inline-block;background:#000;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600">Set My Password</a></p>
         <p style="color:#666;font-size:13px">This link expires in 24 hours. If you did not create this account, you can safely ignore this email.</p>
         <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
         <p style="color:#999;font-size:12px">EduHub PH &mdash; Your go-to resource hub for Filipino students</p>
         </body></html>`
      );
    } catch (mailErr) {
      if (!PROD) console.error("[Register] Email send failed:", mailErr.message);
      // Account is created — user can request a new link via forgot-password
    }

    res.status(201).json({ message: "Account created. Check your email to set your password." });
  } catch (err) { return serverError(res, err, "Register"); }
});

// Returns account status for an email — used by the login flow BEFORE showing the password field.
// Never reveals whether an email exists for unknown addresses (returns "not_found" generically).
app.post("/api/auth/check-account", checkAccountLimiter, async (req, res) => {
  try {
    const raw = sanitize(String(req.body.email || ""), 200);
    if (!raw) return res.json({ status: "not_found" });
    const email = raw.toLowerCase().trim();
    if (!isValidEmail(email)) return res.json({ status: "not_found" });

    const { rows } = await db.query(
      `SELECT
         u.is_active,
         EXISTS(
           SELECT 1 FROM password_reset_tokens
           WHERE user_id = u.id AND type = 'registration' AND used = FALSE
         ) AS pending_activation
       FROM users u
       WHERE u.email = $1`,
      [email]
    );

    if (!rows.length) return res.json({ status: "not_found" });

    const { is_active, pending_activation } = rows[0];
    if (pending_activation) return res.json({ status: "pending" });
    if (!is_active)         return res.json({ status: "disabled" });
    return res.json({ status: "active" });
  } catch (err) { return serverError(res, err, "CheckAccount"); }
});

// Resends the activation email to a pending account.
// Always returns 200 — never reveals whether the email is registered.
app.post("/api/auth/resend-activation", resendActivationLimiter, async (req, res) => {
  const GENERIC_OK = { message: "If your account is pending, a new activation link has been sent to your email." };
  try {
    const raw = sanitize(String(req.body.email || ""), 200);
    if (!raw) return res.json(GENERIC_OK);
    const email = raw.toLowerCase().trim();
    if (!isValidEmail(email)) return res.json(GENERIC_OK);

    // Only act if there's a pending (unused registration token) account for this email
    const { rows } = await db.query(
      `SELECT u.id, u.email
       FROM users u
       JOIN password_reset_tokens prt ON prt.user_id = u.id
       WHERE u.email = $1
         AND prt.type = 'registration'
         AND prt.used = FALSE
       LIMIT 1`,
      [email]
    );

    if (!rows.length) return res.json(GENERIC_OK); // not found or already activated

    const userId = rows[0].id;

    // Invalidate all old registration tokens for this user
    await db.query(
      "UPDATE password_reset_tokens SET used = TRUE WHERE user_id = $1 AND type = 'registration'",
      [userId]
    );

    // Issue a fresh token (24h window)
    const newToken  = uuidv4();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await db.query(
      "INSERT INTO password_reset_tokens (token, user_id, expires_at, type) VALUES ($1,$2,$3,'registration')",
      [newToken, userId, expiresAt]
    );

    const appUrl = process.env.APP_URL || "https://eduhubph.tech";
    try {
      await sendEmail(
        email,
        "EduHub PH — New Account Activation Link",
        `<!DOCTYPE html><html><body style="font-family:sans-serif;color:#111;max-width:600px;margin:auto;padding:24px">
         <h2>Activate Your EduHub PH Account</h2>
         <p>You requested a new activation link. Click below to set your password and activate your account.</p>
         <p><a href="${appUrl}?reset=${newToken}" style="display:inline-block;background:#000;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600">Activate Account</a></p>
         <p style="color:#666;font-size:13px">This link expires in 24 hours. If you did not request this, you can safely ignore this email.</p>
         <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
         <p style="color:#999;font-size:12px">EduHub PH &mdash; Your go-to resource hub for Filipino students</p>
         </body></html>`
      );
    } catch (mailErr) {
      if (!PROD) console.error("[ResendActivation] Email send failed:", mailErr.message);
    }

    return res.json(GENERIC_OK);
  } catch (err) { return serverError(res, err, "ResendActivation"); }
});

app.get("/api/auth/validate-reset-token", async (req, res) => {
  try {
    const token = sanitize(String(req.query.token || ""), 200);
    if (!token) return res.status(400).json({ valid: false, reason: "missing" });

    // Include expired/used tokens too so we can return the type for a better error message
    const { rows } = await db.query(
      `SELECT type,
              used,
              (expires_at > NOW() AND used = FALSE) AS is_valid
       FROM password_reset_tokens WHERE token = $1`,
      [token]
    );

    if (!rows.length) return res.json({ valid: false, reason: "not_found", tokenType: null });
    if (!rows[0].is_valid) return res.json({ valid: false, reason: rows[0].used ? "used" : "expired", tokenType: rows[0].type });
    return res.json({ valid: true, tokenType: rows[0].type });
  } catch (err) { return serverError(res, err, "ValidateResetToken"); }
});

app.post("/api/auth/forgot-password", forgotLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !isValidEmail(email))
      return res.status(400).json({ message: "A valid email address is required." });

    const normalized = email.toLowerCase().trim();
    const { rows }   = await db.query("SELECT id FROM users WHERE email = $1 AND is_active = TRUE", [normalized]);

    // Always return the same response — never reveal whether email exists
    const msg = { message: "If that email is registered, a reset link has been sent." };

    if (rows.length) {
      // Invalidate any existing unused tokens first
      await db.query(
        "UPDATE password_reset_tokens SET used = TRUE WHERE user_id = $1 AND used = FALSE",
        [rows[0].id]
      );

      const resetToken = uuidv4();
      const expiresAt  = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      await db.query("INSERT INTO password_reset_tokens (token, user_id, expires_at) VALUES ($1,$2,$3)", [resetToken, rows[0].id, expiresAt]);

      const appUrl = process.env.APP_URL || "https://eduhubph.tech";
      await sendEmail(
        normalized,
        "EduHub PH — Reset Your Password",
        `<!DOCTYPE html><html><body style="font-family:sans-serif;color:#111;max-width:600px;margin:auto;padding:24px">
         <h2 style="margin-bottom:8px">Password Reset</h2>
         <p>We received a request to reset your EduHub PH password. Click the button below to choose a new password.</p>
         <p><a href="${appUrl}?reset=${resetToken}" style="display:inline-block;background:#000;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600">Reset Password</a></p>
         <p style="color:#666;font-size:13px">This link expires in 1 hour. If you did not request a password reset, you can safely ignore this email — your password will not change.</p>
         <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
         <p style="color:#999;font-size:12px">EduHub PH &mdash; Your go-to resource hub for Filipino students</p>
         </body></html>`
      );
    }

    res.json(msg);
  } catch (err) { return serverError(res, err, "ForgotPassword"); }
});

app.post("/api/auth/reset-password", authLimiter, async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password)
      return res.status(400).json({ message: "Token and password are required." });
    if (!isValidPassword(password))
      return res.status(400).json({ message: "Password must be at least 8 characters and include at least one letter and one number." });

    const { rows } = await db.query(
      "SELECT user_id FROM password_reset_tokens WHERE token = $1 AND expires_at > NOW() AND used = FALSE",
      [token]
    );
    if (!rows.length) return res.status(400).json({ message: "Reset link is invalid or has expired." });

    const hash   = await bcrypt.hash(password, 12);
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      await client.query("UPDATE users SET password_hash = $1 WHERE id = $2", [hash, rows[0].user_id]);
      await client.query("UPDATE password_reset_tokens SET used = TRUE WHERE token = $1", [token]);
      await client.query("COMMIT");
    } catch (e) { await client.query("ROLLBACK"); throw e; }
    finally { client.release(); }

    res.json({ message: "Password reset successfully. You can now log in." });
  } catch (err) { return serverError(res, err, "ResetPassword"); }
});


app.patch("/api/auth/password", requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword)
      return res.status(400).json({ message: "New password is required." });
    if (!isValidPassword(newPassword))
      return res.status(400).json({ message: "Password must be at least 8 characters and include at least one letter and one number." });

    const { rows } = await db.query("SELECT password_hash, role FROM users u JOIN profiles p ON p.id = u.id WHERE u.id = $1", [req.user.sub]);
    if (!rows.length) return res.status(404).json({ message: "User not found." });

    // Superadmin can change password without current password (admin reset flow)
    // All other users must provide their current password
    const isSuperadmin = req.user.role === "superadmin";
    if (!isSuperadmin) {
      if (!currentPassword)
        return res.status(400).json({ message: "Current password is required." });
      const ok = await bcrypt.compare(currentPassword, rows[0].password_hash);
      if (!ok) return res.status(401).json({ message: "Current password is incorrect." });
    }

    const hash = await bcrypt.hash(newPassword, 12);
    await db.query("UPDATE users SET password_hash = $1 WHERE id = $2", [hash, req.user.sub]);
    res.json({ message: "Password updated." });
  } catch (err) { return serverError(res, err, "ChangePassword"); }
});

// ─── PROFILES ─────────────────────────────────────────────────────────────────

app.get("/api/profiles/:id", requireAuth, async (req, res) => {
  try {
    if (!isValidUUID(req.params.id)) return res.status(400).json({ message: "Invalid ID." });
    if (req.user.sub !== req.params.id && req.user.role !== "superadmin")
      return res.status(403).json({ message: "Forbidden." });
    const { rows } = await db.query(
      "SELECT p.*, u.email FROM profiles p JOIN users u ON u.id = p.id WHERE p.id = $1",
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: "Profile not found." });
    res.json(rows[0]);
  } catch (err) { return serverError(res, err, "GetProfile"); }
});

app.patch("/api/profiles/:id", requireAuth, async (req, res) => {
  try {
    if (!isValidUUID(req.params.id)) return res.status(400).json({ message: "Invalid ID." });
    if (req.user.sub !== req.params.id && req.user.role !== "superadmin")
      return res.status(403).json({ message: "Forbidden." });

    const { first_name, last_name, middle_name, mobile_number, theme } = req.body;
    const VALID_THEMES = ["classic","ocean","emerald","rose","violet","teal","sunset","amber"];

    // Build SET clause dynamically — only update fields actually sent in the request
    // This prevents sending { theme: "ocean" } from accidentally nulling out middle_name/mobile_number
    const sets = [];
    const vals = [];
    let i = 1;

    if (first_name !== undefined) {
      const v = sanitize(first_name, 100);
      if (!v) return res.status(400).json({ message: "First name cannot be empty." });
      sets.push(`first_name = $${i++}`); vals.push(v);
    }
    if (last_name !== undefined) {
      const v = sanitize(last_name, 100);
      if (!v) return res.status(400).json({ message: "Last name cannot be empty." });
      sets.push(`last_name = $${i++}`); vals.push(v);
    }
    if (middle_name !== undefined) {
      sets.push(`middle_name = $${i++}`);
      vals.push(sanitize(middle_name, 100));
    }
    if (mobile_number !== undefined) {
      sets.push(`mobile_number = $${i++}`);
      vals.push(sanitize(mobile_number, 30));
    }
    if (theme !== undefined && VALID_THEMES.includes(theme)) {
      sets.push(`theme = $${i++}`);
      vals.push(theme);
    }

    if (!sets.length) return res.status(400).json({ message: "No valid fields to update." });

    sets.push("updated_at = NOW()");
    vals.push(req.params.id);

    const { rows } = await db.query(
      `UPDATE profiles SET ${sets.join(", ")} WHERE id = $${i} RETURNING *`,
      vals
    );
    if (!rows.length) return res.status(404).json({ message: "Profile not found." });
    res.json(rows[0]);
  } catch (err) { return serverError(res, err, "UpdateProfile"); }
});

// ─── USERS (admin) ────────────────────────────────────────────────────────────

app.get("/api/users", requireAdmin, async (req, res) => {
  try {
    const { rows } = await db.query(
      "SELECT p.*, u.email FROM profiles p JOIN users u ON u.id = p.id ORDER BY p.created_at DESC"
    );
    res.json(rows);
  } catch (err) { return serverError(res, err, "GetUsers"); }
});

app.patch("/api/users/:id/active", requireAdmin, async (req, res) => {
  try {
    if (!isValidUUID(req.params.id)) return res.status(400).json({ message: "Invalid ID." });
    const isActive = Boolean(req.body.is_active);
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      await client.query("UPDATE profiles SET is_active = $1 WHERE id = $2", [isActive, req.params.id]);
      await client.query("UPDATE users SET is_active = $1 WHERE id = $2", [isActive, req.params.id]);
      await client.query("COMMIT");
    } catch (e) { await client.query("ROLLBACK"); throw e; }
    finally { client.release(); }
    res.json({ message: "Updated." });
  } catch (err) { return serverError(res, err, "SetUserActive"); }
});

// ─── CATEGORIES ───────────────────────────────────────────────────────────────

app.get("/api/categories", async (req, res) => {
  try {
    const activeOnly = req.query.active === "true";
    const { rows } = await db.query(
      `SELECT * FROM categories ${activeOnly ? "WHERE is_active = TRUE" : ""} ORDER BY sort_order, name`
    );
    res.json(rows);
  } catch (err) { return serverError(res, err, "GetCategories"); }
});

app.post("/api/categories", requireAdmin, async (req, res) => {
  try {
    const { name, slug, type, description, is_active, sort_order } = req.body;
    if (!name || !slug || !type) return res.status(400).json({ message: "name, slug, and type are required." });
    const { rows } = await db.query(
      "INSERT INTO categories (name,slug,type,description,is_active,sort_order) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *",
      [sanitize(name,100), sanitize(slug,100), type, sanitize(description,500), is_active ?? true, sort_order ?? 0]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ message: "Slug already exists." });
    return serverError(res, err, "CreateCategory");
  }
});

app.patch("/api/categories/:id", requireAdmin, async (req, res) => {
  try {
    const { name, slug, type, description, is_active, sort_order } = req.body;
    const { rows } = await db.query(
      `UPDATE categories SET name=COALESCE($1,name),slug=COALESCE($2,slug),type=COALESCE($3,type),
       description=$4,is_active=COALESCE($5,is_active),sort_order=COALESCE($6,sort_order)
       WHERE id=$7 RETURNING *`,
      [sanitize(name,100), sanitize(slug,100), type, sanitize(description,500), is_active, sort_order, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: "Not found." });
    res.json(rows[0]);
  } catch (err) { return serverError(res, err, "UpdateCategory"); }
});

app.delete("/api/categories/:id", requireAdmin, async (req, res) => {
  try { await db.query("DELETE FROM categories WHERE id=$1", [req.params.id]); res.json({ message: "Deleted." }); }
  catch (err) { return serverError(res, err, "DeleteCategory"); }
});

// ─── SUBJECTS ─────────────────────────────────────────────────────────────────

app.get("/api/subjects", async (req, res) => {
  try {
    const activeOnly = req.query.active === "true";
    const { rows } = await db.query(
      `SELECT * FROM subjects ${activeOnly ? "WHERE is_active = TRUE" : ""} ORDER BY sort_order, name`
    );
    res.json(rows);
  } catch (err) { return serverError(res, err, "GetSubjects"); }
});

app.post("/api/subjects", requireAdmin, async (req, res) => {
  try {
    const { name, slug, description, is_active, sort_order } = req.body;
    if (!name || !slug) return res.status(400).json({ message: "name and slug are required." });
    const { rows } = await db.query(
      "INSERT INTO subjects (name,slug,description,is_active,sort_order) VALUES ($1,$2,$3,$4,$5) RETURNING *",
      [sanitize(name,100), sanitize(slug,100), sanitize(description,500), is_active ?? true, sort_order ?? 0]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ message: "Slug already exists." });
    return serverError(res, err, "CreateSubject");
  }
});

app.patch("/api/subjects/:id", requireAdmin, async (req, res) => {
  try {
    const { name, slug, description, is_active, sort_order } = req.body;
    const { rows } = await db.query(
      `UPDATE subjects SET name=COALESCE($1,name),slug=COALESCE($2,slug),description=$3,
       is_active=COALESCE($4,is_active),sort_order=COALESCE($5,sort_order) WHERE id=$6 RETURNING *`,
      [sanitize(name,100), sanitize(slug,100), sanitize(description,500), is_active, sort_order, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: "Not found." });
    res.json(rows[0]);
  } catch (err) { return serverError(res, err, "UpdateSubject"); }
});

app.delete("/api/subjects/:id", requireAdmin, async (req, res) => {
  try { await db.query("DELETE FROM subjects WHERE id=$1", [req.params.id]); res.json({ message: "Deleted." }); }
  catch (err) { return serverError(res, err, "DeleteSubject"); }
});

// ─── TAGS ─────────────────────────────────────────────────────────────────────

app.get("/api/tags", async (req, res) => {
  try { const { rows } = await db.query("SELECT * FROM tags ORDER BY name"); res.json(rows); }
  catch (err) { return serverError(res, err, "GetTags"); }
});

app.post("/api/tags", requireAdmin, async (req, res) => {
  try {
    const { name, slug } = req.body;
    if (!name || !slug) return res.status(400).json({ message: "name and slug are required." });
    const { rows } = await db.query(
      "INSERT INTO tags (name,slug) VALUES ($1,$2) RETURNING *",
      [sanitize(name,100), sanitize(slug,100)]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ message: "Tag already exists." });
    return serverError(res, err, "CreateTag");
  }
});

app.delete("/api/tags/:id", requireAdmin, async (req, res) => {
  try { await db.query("DELETE FROM tags WHERE id=$1", [req.params.id]); res.json({ message: "Deleted." }); }
  catch (err) { return serverError(res, err, "DeleteTag"); }
});

// ─── POSTS ────────────────────────────────────────────────────────────────────

const POST_SELECT = `
  SELECT p.*, row_to_json(c) AS categories, row_to_json(s) AS subjects
  FROM posts p
  LEFT JOIN categories c ON c.id = p.category_id
  LEFT JOIN subjects s   ON s.id = p.subject_id
`;

app.get("/api/posts", async (req, res) => {
  try {
    const { type, status, category_id, subject_id, search, is_featured, limit } = req.query;
    const conditions = []; const values = []; let i = 1;
    if (type)        { conditions.push(`p.type=$${i++}`);        values.push(type); }
    if (status)      { conditions.push(`p.status=$${i++}`);      values.push(status); }
    if (category_id) { conditions.push(`p.category_id=$${i++}`); values.push(Number(category_id)); }
    if (subject_id)  { conditions.push(`p.subject_id=$${i++}`);  values.push(Number(subject_id)); }
    if (is_featured !== undefined) { conditions.push(`p.is_featured=$${i++}`); values.push(is_featured === "true"); }
    if (search)      { conditions.push(`p.title ILIKE $${i++}`); values.push(`%${sanitize(search, 100)}%`); }
    const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";
    const parsedLimit = Math.min(parseInt(limit) || 1000, 500);
    const limitClause = `LIMIT $${i}`;
    values.push(parsedLimit);
    const { rows } = await db.query(`${POST_SELECT} ${where} ORDER BY p.created_at DESC ${limitClause}`, values);
    res.json(rows);
  } catch (err) { return serverError(res, err, "GetPosts"); }
});

app.get("/api/posts/slug/:slug", async (req, res) => {
  try {
    const { rows } = await db.query(`${POST_SELECT} WHERE p.slug=$1`, [req.params.slug]);
    if (!rows.length) return res.status(404).json({ message: "Post not found." });
    res.json(rows[0]);
  } catch (err) { return serverError(res, err, "GetPostBySlug"); }
});

app.post("/api/posts", requireAdmin, async (req, res) => {
  try {
    const { title,slug,excerpt,content,cover_image,category_id,subject_id,type,status,is_featured,published_at,meta_title,meta_description } = req.body;
    if (!title || !slug || !type || !status)
      return res.status(400).json({ message: "title, slug, type, and status are required." });
    const { rows } = await db.query(
      `INSERT INTO posts (title,slug,excerpt,content,cover_image,category_id,subject_id,author_id,type,status,is_featured,published_at,meta_title,meta_description)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [
        sanitize(title,255), sanitize(slug,255),
        excerpt ?? null, content ?? null,
        sanitize(cover_image,500) ?? null,
        category_id ?? null, subject_id ?? null,
        req.user.sub, type, status,
        is_featured ?? false, published_at ?? null,
        sanitize(meta_title,255) ?? null, sanitize(meta_description,500) ?? null,
      ]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ message: "Slug already exists." });
    return serverError(res, err, "CreatePost");
  }
});

app.patch("/api/posts/:id", requireAdmin, async (req, res) => {
  try {
    const { title,slug,excerpt,content,cover_image,category_id,subject_id,type,status,is_featured,published_at,meta_title,meta_description } = req.body;
    const { rows } = await db.query(
      `UPDATE posts SET title=COALESCE($1,title),slug=COALESCE($2,slug),excerpt=$3,content=$4,cover_image=$5,
       category_id=$6,subject_id=$7,type=COALESCE($8,type),status=COALESCE($9,status),
       is_featured=COALESCE($10,is_featured),published_at=$11,meta_title=$12,meta_description=$13,updated_at=NOW()
       WHERE id=$14 RETURNING *`,
      [
        sanitize(title,255), sanitize(slug,255),
        excerpt ?? null, content ?? null,
        sanitize(cover_image,500) ?? null,
        category_id ?? null, subject_id ?? null,
        type, status, is_featured,
        published_at ?? null,
        sanitize(meta_title,255) ?? null, sanitize(meta_description,500) ?? null,
        req.params.id,
      ]
    );
    if (!rows.length) return res.status(404).json({ message: "Not found." });
    res.json(rows[0]);
  } catch (err) { return serverError(res, err, "UpdatePost"); }
});

app.delete("/api/posts/:id", requireAdmin, async (req, res) => {
  try { await db.query("DELETE FROM posts WHERE id=$1", [req.params.id]); res.json({ message: "Deleted." }); }
  catch (err) { return serverError(res, err, "DeletePost"); }
});

// ─── SAVED POSTS ──────────────────────────────────────────────────────────────

app.get("/api/saved-posts/ids", requireAuth, async (req, res) => {
  try {
    const { rows } = await db.query("SELECT post_id FROM saved_posts WHERE user_id=$1", [req.user.sub]);
    res.json(rows.map(r => r.post_id));
  } catch (err) { return serverError(res, err, "GetSavedIds"); }
});

app.get("/api/saved-posts", requireAuth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT p.*, row_to_json(c) AS categories, row_to_json(s) AS subjects
       FROM saved_posts sp
       JOIN posts p ON p.id = sp.post_id
       LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN subjects s   ON s.id = p.subject_id
       WHERE sp.user_id=$1 ORDER BY sp.created_at DESC`,
      [req.user.sub]
    );
    res.json(rows);
  } catch (err) { return serverError(res, err, "GetSavedPosts"); }
});

app.post("/api/saved-posts", requireAuth, async (req, res) => {
  try {
    const postId = parseInt(req.body.post_id);
    if (!postId) return res.status(400).json({ message: "post_id is required." });
    await db.query(
      "INSERT INTO saved_posts (user_id,post_id) VALUES ($1,$2) ON CONFLICT DO NOTHING",
      [req.user.sub, postId]
    );
    res.status(201).json({ message: "Saved." });
  } catch (err) { return serverError(res, err, "SavePost"); }
});

app.delete("/api/saved-posts/:postId", requireAuth, async (req, res) => {
  try {
    await db.query("DELETE FROM saved_posts WHERE user_id=$1 AND post_id=$2", [req.user.sub, parseInt(req.params.postId)]);
    res.json({ message: "Removed." });
  } catch (err) { return serverError(res, err, "UnsavePost"); }
});

// ─── FEEDBACK ─────────────────────────────────────────────────────────────────

app.post("/api/feedback", feedbackLimiter, async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;
    if (!name || !email || !subject || !message)
      return res.status(400).json({ message: "All fields are required." });
    if (!isValidEmail(email))
      return res.status(400).json({ message: "Invalid email format." });
    await db.query(
      "INSERT INTO feedback (name,email,subject,message) VALUES ($1,$2,$3,$4)",
      [sanitize(name,100), email.toLowerCase().trim(), sanitize(subject,255), sanitize(message,2000)]
    );
    res.status(201).json({ message: "Feedback submitted. Thank you!" });
  } catch (err) { return serverError(res, err, "SubmitFeedback"); }
});

app.get("/api/feedback", requireAdmin, async (req, res) => {
  try { const { rows } = await db.query("SELECT * FROM feedback ORDER BY created_at DESC"); res.json(rows); }
  catch (err) { return serverError(res, err, "GetFeedback"); }
});

app.patch("/api/feedback/:id", requireAdmin, async (req, res) => {
  try {
    const allowed = ["unread", "read", "archived"];
    if (!allowed.includes(req.body.status)) return res.status(400).json({ message: "Invalid status." });
    await db.query("UPDATE feedback SET status=$1 WHERE id=$2", [req.body.status, req.params.id]);
    res.json({ message: "Updated." });
  } catch (err) { return serverError(res, err, "UpdateFeedback"); }
});

app.delete("/api/feedback/:id", requireAdmin, async (req, res) => {
  try { await db.query("DELETE FROM feedback WHERE id=$1", [req.params.id]); res.json({ message: "Deleted." }); }
  catch (err) { return serverError(res, err, "DeleteFeedback"); }
});

// ─── ACTIVITY LOGS ────────────────────────────────────────────────────────────

app.get("/api/activity-logs", requireAdmin, async (req, res) => {
  try {
    const { rows } = await db.query("SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT 200");
    res.json(rows);
  } catch (err) { return serverError(res, err, "GetActivityLogs"); }
});

app.post("/api/activity-logs", requireAuth, async (req, res) => {
  try {
    const action = sanitize(req.body.action, 255);
    const module = sanitize(req.body.module, 100);
    if (!action) return res.status(400).json({ message: "action is required." });
    const { rows } = await db.query(
      "SELECT first_name, last_name FROM profiles WHERE id=$1", [req.user.sub]
    );
    const name = rows.length ? `${rows[0].first_name} ${rows[0].last_name}`.trim() : "Unknown";
    await db.query(
      "INSERT INTO activity_logs (user_id,user_name,action,module,ip_address) VALUES ($1,$2,$3,$4,$5)",
      [req.user.sub, name, action, module, req.ip]
    );
    res.status(201).json({ message: "Logged." });
  } catch (err) { return serverError(res, err, "LogActivity"); }
});

// ─── STATIC PAGES ─────────────────────────────────────────────────────────────

app.get("/api/static-pages", async (req, res) => {
  try { const { rows } = await db.query("SELECT * FROM static_pages ORDER BY id"); res.json(rows); }
  catch (err) { return serverError(res, err, "GetStaticPages"); }
});

app.get("/api/static-pages/:slug", async (req, res) => {
  try {
    const { rows } = await db.query("SELECT * FROM static_pages WHERE slug=$1", [req.params.slug]);
    if (!rows.length) return res.status(404).json({ message: "Not found." });
    res.json(rows[0]);
  } catch (err) { return serverError(res, err, "GetStaticPage"); }
});

app.patch("/api/static-pages/:id", requireAdmin, async (req, res) => {
  try {
    const { title, content, meta_title, meta_description, is_published } = req.body;
    const { rows } = await db.query(
      `UPDATE static_pages SET title=COALESCE($1,title),content=$2,meta_title=$3,meta_description=$4,
       is_published=COALESCE($5,is_published),updated_at=NOW() WHERE id=$6 RETURNING *`,
      [sanitize(title,255), content ?? null, sanitize(meta_title,255) ?? null, sanitize(meta_description,500) ?? null, is_published, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: "Not found." });
    res.json(rows[0]);
  } catch (err) { return serverError(res, err, "UpdateStaticPage"); }
});

// ─── SITE SETTINGS ────────────────────────────────────────────────────────────

app.get("/api/site-settings", async (req, res) => {
  try {
    const { rows } = await db.query("SELECT key, value FROM site_settings");
    res.json(rows.reduce((acc, r) => ({ ...acc, [r.key]: r.value ?? "" }), {}));
  } catch (err) { return serverError(res, err, "GetSettings"); }
});

app.put("/api/site-settings", requireAdmin, async (req, res) => {
  try {
    const settings = req.body;
    if (!settings || typeof settings !== "object" || Array.isArray(settings))
      return res.status(400).json({ message: "Invalid settings payload." });
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      for (const [key, value] of Object.entries(settings)) {
        if (typeof key !== "string" || key.length > 100) continue;
        await client.query(
          "INSERT INTO site_settings (key,value,updated_at) VALUES ($1,$2,NOW()) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value,updated_at=NOW()",
          [key, sanitize(String(value), 1000)]
        );
      }
      await client.query("COMMIT");
    } catch (e) { await client.query("ROLLBACK"); throw e; }
    finally { client.release(); }
    res.json({ message: "Settings saved." });
  } catch (err) { return serverError(res, err, "SaveSettings"); }
});

// ─── DASHBOARD ────────────────────────────────────────────────────────────────

app.get("/api/dashboard/stats", requireAdmin, async (req, res) => {
  try {
    const results = await Promise.all([
      db.query("SELECT COUNT(*) FROM profiles WHERE role='user'"),
      db.query("SELECT COUNT(*) FROM posts WHERE status='published'"),
      db.query("SELECT COUNT(*) FROM posts WHERE status='draft'"),
      db.query("SELECT COUNT(*) FROM posts WHERE is_featured=TRUE"),
      db.query("SELECT COUNT(*) FROM posts WHERE type='resource'"),
      db.query("SELECT COUNT(*) FROM posts WHERE type='opportunity'"),
      db.query("SELECT COUNT(*) FROM saved_posts"),
      db.query("SELECT COUNT(*) FROM feedback"),
      db.query("SELECT COUNT(*) FROM feedback WHERE status='unread'"),
    ]);
    res.json({
      totalUsers:       parseInt(results[0].rows[0].count),
      publishedPosts:   parseInt(results[1].rows[0].count),
      draftPosts:       parseInt(results[2].rows[0].count),
      featuredPosts:    parseInt(results[3].rows[0].count),
      resourcePosts:    parseInt(results[4].rows[0].count),
      opportunityPosts: parseInt(results[5].rows[0].count),
      totalSaved:       parseInt(results[6].rows[0].count),
      totalFeedback:    parseInt(results[7].rows[0].count),
      unreadFeedback:   parseInt(results[8].rows[0].count),
    });
  } catch (err) { return serverError(res, err, "DashboardStats"); }
});

app.get("/api/dashboard/charts", requireAdmin, async (req, res) => {
  try {
    const [usersRaw, postsRaw, typeData, catData] = await Promise.all([
      db.query("SELECT created_at FROM profiles WHERE role='user' AND created_at>=NOW()-INTERVAL '30 days'"),
      db.query("SELECT published_at FROM posts WHERE status='published' AND published_at>=NOW()-INTERVAL '6 months'"),
      db.query("SELECT type FROM posts WHERE status='published'"),
      db.query(`SELECT c.name FROM posts p JOIN categories c ON c.id = p.category_id WHERE p.status='published'`),
    ]);

    const weekMap = new Map();
    for (const u of usersRaw.rows) {
      const label = new Date(u.created_at).toLocaleDateString("en-PH", { month: "short", day: "numeric" });
      weekMap.set(label, (weekMap.get(label) || 0) + 1);
    }
    const newUsers = Array.from(weekMap.entries()).map(([label, v]) => ({ label, v }));

    const monthMap = new Map();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i);
      monthMap.set(d.toLocaleDateString("en-PH", { month: "short" }), 0);
    }
    for (const p of postsRaw.rows) {
      if (p.published_at) {
        const key = new Date(p.published_at).toLocaleDateString("en-PH", { month: "short" });
        if (monthMap.has(key)) monthMap.set(key, monthMap.get(key) + 1);
      }
    }
    const postsMonthly = Array.from(monthMap.entries()).map(([month, posts]) => ({ month, posts }));
    const typeDist = [
      { name: "Resources",     value: typeData.rows.filter(p => p.type === "resource").length },
      { name: "Opportunities", value: typeData.rows.filter(p => p.type === "opportunity").length },
    ];
    const catMap = new Map();
    for (const p of catData.rows) if (p.name) catMap.set(p.name, (catMap.get(p.name) || 0) + 1);
    const catDist = Array.from(catMap.entries())
      .map(([name, count]) => ({ name: name.length > 13 ? name.slice(0, 13) + "…" : name, count }))
      .sort((a, b) => b.count - a.count).slice(0, 6);

    res.json({ newUsers, postsMonthly, typeDist, catDist });
  } catch (err) { return serverError(res, err, "DashboardCharts"); }
});

// ─── HEALTH ───────────────────────────────────────────────────────────────────

app.get("/api/health", async (_req, res) => {
  try { await db.query("SELECT 1"); res.json({ status: "ok" }); }
  catch { res.status(503).json({ status: "error" }); }
});

// ─── 404 / GLOBAL ERROR HANDLER ───────────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({ message: "Not found." });
});

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (!PROD) console.error("[Unhandled]", err);
  res.status(500).json({ message: "An internal error occurred." });
});

// ─── START ────────────────────────────────────────────────────────────────────

app.listen(PORT, "127.0.0.1", () => {
  console.log(`EduHub API running → http://127.0.0.1:${PORT} [${PROD ? "production" : "development"}]`);
});
