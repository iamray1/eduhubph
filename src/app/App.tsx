import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Search, Bookmark, BookmarkCheck, Menu, X, ChevronDown, ChevronRight,
  Users, FileText, MessageSquare, LayoutDashboard, LogOut, Eye, EyeOff,
  ArrowLeft, Plus, Edit2, Trash2, Tag, BookOpen, Star, Check, AlertCircle,
  Settings, TrendingUp, Activity, List, Globe, Archive,
  UserCheck, UserX, Key, Copy, Shield, Zap, Save, Palette,
  Facebook, Twitter, Instagram, Youtube, Linkedin, Award,
  Wrench, Calculator, Trash, ChevronLeft, Info,
} from "lucide-react";
import {
  BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import eduhubIcoUrl from "@/imports/eduhubico.svg";
import { clearAuth, getStoredUser } from "../lib/auth";
import * as api from "../lib/api";
import type { Post, Category, Subject, Tag as TagType, FeedbackItem, Profile, ActivityLog, StaticPageItem, DashboardStats } from "../lib/api";

// ─── ERROR BOUNDARY ──────────────────────────────────────────────────────────

class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode; fallback?: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }
  render() {
    if (this.state.error) {
      return this.props.fallback ?? (
        <div className="min-h-screen flex items-center justify-center bg-white px-6">
          <div className="max-w-md text-center">
            <h2 className="text-xl font-bold mb-2">Something went wrong</h2>
            <p className="text-sm text-gray-500 mb-6">This section encountered an error. The rest of the site is still working.</p>
            <button onClick={() => this.setState({ error: null })}
              className="px-5 py-2.5 text-sm font-semibold th-btn-primary rounded-xl">
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── THEME SYSTEM ────────────────────────────────────────────────────────────

const THEME_KEY = "eduhub_theme";

// lt  = navbar bg (Classic → white, preserving original look)
// bg  = page body bg (Classic → white, others → barely-there tint)
// p   = footer bg + buttons (Classic → near-black, looks same as original black footer)
const THEMES = [
  { id: "classic", name: "Classic", p: "#18181b", dk: "#09090b", lt: "#ffffff", bg: "#ffffff", fg: "#ffffff" },
  { id: "ocean",   name: "Ocean",   p: "#2563eb", dk: "#1d4ed8", lt: "#dbeafe", bg: "#f5f9ff", fg: "#ffffff" },
  { id: "emerald", name: "Emerald", p: "#059669", dk: "#047857", lt: "#d1fae5", bg: "#f4fdf8", fg: "#ffffff" },
  { id: "rose",    name: "Rose",    p: "#e11d48", dk: "#be123c", lt: "#ffe4e6", bg: "#fff6f7", fg: "#ffffff" },
  { id: "violet",  name: "Violet",  p: "#7c3aed", dk: "#6d28d9", lt: "#ede9fe", bg: "#f9f6ff", fg: "#ffffff" },
  { id: "teal",    name: "Teal",    p: "#0d9488", dk: "#0f766e", lt: "#ccfbf1", bg: "#f2fdf9", fg: "#ffffff" },
  { id: "sunset",  name: "Sunset",  p: "#ea580c", dk: "#c2410c", lt: "#ffedd5", bg: "#fff9f4", fg: "#ffffff" },
  { id: "amber",   name: "Amber",   p: "#d97706", dk: "#b45309", lt: "#fef3c7", bg: "#fffdf0", fg: "#ffffff" },
] as const;
type ThemeId = typeof THEMES[number]["id"];

function applyTheme(id: ThemeId) {
  const t = THEMES.find(x => x.id === id) ?? THEMES[0];
  const r = document.documentElement;
  r.style.setProperty("--th-p",    t.p);
  r.style.setProperty("--th-p-dk", t.dk);
  r.style.setProperty("--th-p-lt", t.lt);
  r.style.setProperty("--th-p-bg", t.bg);
  r.style.setProperty("--th-p-fg", t.fg);
}

// ─── TYPES ────────────────────────────────────────────────────────────────────

type Role = "guest" | "user" | "superadmin";
type AuthStep = "email" | "login" | "register" | "forgot";
type Page =
  | "home" | "resources" | "opportunities" | "feedback" | "about"
  | "post-detail" | "privacy" | "terms"
  | "saved-posts" | "profile" | "account-settings"
  | "tools"
  | "admin-dashboard" | "admin-content" | "admin-create-post"
  | "admin-categories" | "admin-subjects" | "admin-tags"
  | "admin-users" | "admin-feedback"
  | "admin-static-pages" | "admin-site-settings" | "admin-activity-logs"
  | "admin-profile" | "admin-tools";


// ─── GOOGLE ADS ───────────────────────────────────────────────────────────────
// ─── COOKIE CONSENT ──────────────────────────────────────────────────────────

const NOTICE_KEY = "eduhub_cookie_notice";
const PREFS_KEY  = "eduhub_cookie_prefs";

export function getAdConsent(): boolean {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return false;
    return JSON.parse(raw).advertising === true;
  } catch { return false; }
}

function useCookieNotice() {
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try { return localStorage.getItem(NOTICE_KEY) === "1"; } catch { return false; }
  });

  const dismiss = (advertising = true) => {
    localStorage.setItem(NOTICE_KEY, "1");
    localStorage.setItem(PREFS_KEY, JSON.stringify({ analytics: true, advertising }));
    setDismissed(true);
  };

  return { dismissed, dismiss };
}

function CookieNotice({ onDismiss, onViewPolicy }: {
  onDismiss: (advertising: boolean) => void;
  onViewPolicy: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [prefs, setPrefs] = useState({ analytics: true, advertising: true });

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 600);
    return () => clearTimeout(t);
  }, []);

  const dismiss = (advertising: boolean) => { setVisible(false); setTimeout(() => onDismiss(advertising), 300); };

  return (
    <>
      {/* Main banner */}
      <div className={`fixed bottom-0 left-0 right-0 z-[70] transition-all duration-300 ease-out ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-full"}`}>
        <div className="bg-[#1a1a1a] border-t border-white/10 px-4 sm:px-8 py-5">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center gap-4">
            {/* Text */}
            <div className="flex-1 min-w-0">
              <p className="text-[13px] text-gray-300 leading-relaxed">
                EduHub PH and our partners use technology, including cookies, to operate the site, analyse site usage, improve your experience, and help us show ads that support this platform. Click{" "}
                <span className="text-white font-medium">"Cookie Settings"</span> to manage your privacy choices. By continuing to use our site, you agree to these data practices as described in our{" "}
                <button onClick={onViewPolicy} className="text-[13px] text-white underline underline-offset-2 hover:text-gray-200 transition-colors font-medium">
                  Cookie Notice
                </button>.
              </p>
            </div>
            {/* Actions */}
            <div className="flex items-center gap-2.5 flex-none">
              <button onClick={() => setShowSettings(true)}
                className="px-4 py-2 text-[13px] font-medium text-gray-300 hover:text-white border border-white/20 hover:border-white/40 rounded-lg transition-all whitespace-nowrap">
                Cookie Settings
              </button>
              <button onClick={() => dismiss(true)}
                className="px-5 py-2 text-[13px] font-semibold bg-white text-black rounded-lg hover:bg-gray-100 active:scale-[0.98] transition-all whitespace-nowrap">
                Accept All
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Cookie Settings modal */}
      {showSettings && (
        <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-base font-bold tracking-tight">Cookie Settings</h3>
              <button onClick={() => setShowSettings(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-black transition-colors"><X size={16} /></button>
            </div>
            <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
              <p className="text-[13px] text-gray-500 leading-relaxed">
                Manage your cookie preferences below. Strictly necessary cookies cannot be disabled as they are required for the site to function.
              </p>

              {/* Strictly Necessary — always on */}
              <div className="flex items-start justify-between gap-4 py-3 border-b border-gray-100">
                <div>
                  <p className="text-sm font-semibold">Strictly Necessary</p>
                  <p className="text-[12px] text-gray-400 mt-0.5 leading-relaxed">Required for the site to work — login sessions, security, basic functionality.</p>
                </div>
                <div className="flex-none mt-0.5">
                  <span className="text-[11px] font-medium text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">Always on</span>
                </div>
              </div>

              {/* Analytics */}
              <div className="flex items-start justify-between gap-4 py-3 border-b border-gray-100">
                <div>
                  <p className="text-sm font-semibold">Analytics & Performance</p>
                  <p className="text-[12px] text-gray-400 mt-0.5 leading-relaxed">Helps us understand how visitors use the site so we can improve it.</p>
                </div>
                <button onClick={() => setPrefs(p => ({ ...p, analytics: !p.analytics }))}
                  className={`flex-none w-10 h-6 rounded-full transition-colors relative mt-0.5 ${prefs.analytics ? "bg-black" : "bg-gray-200"}`}>
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${prefs.analytics ? "left-5" : "left-1"}`} />
                </button>
              </div>

              {/* Advertising */}
              <div className="flex items-start justify-between gap-4 py-3">
                <div>
                  <p className="text-sm font-semibold">Advertising & Targeting</p>
                  <p className="text-[12px] text-gray-400 mt-0.5 leading-relaxed">Used to show you relevant ads and measure ad performance. Helps keep EduHub PH free.</p>
                </div>
                <button onClick={() => setPrefs(p => ({ ...p, advertising: !p.advertising }))}
                  className={`flex-none w-10 h-6 rounded-full transition-colors relative mt-0.5 ${prefs.advertising ? "bg-black" : "bg-gray-200"}`}>
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${prefs.advertising ? "left-5" : "left-1"}`} />
                </button>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-2.5">
              <button onClick={() => dismiss(prefs.advertising)}
                className="px-4 py-2 text-[13px] font-medium text-gray-500 hover:text-black border border-gray-200 hover:border-gray-400 rounded-lg transition-all">
                Save preferences
              </button>
              <button onClick={() => dismiss(true)}
                className="px-5 py-2 text-[13px] font-semibold th-btn-primary rounded-lg">
                Accept all
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── GOOGLE ADSENSE ───────────────────────────────────────────────────────────
// Publisher: ca-pub-5466628256819321
// Script is injected dynamically at runtime (no index.html available in this build).
// Set VITE_ADSENSE_CLIENT=ca-pub-5466628256819321 in .env to activate ads.
// In dev (no VITE_ADSENSE_CLIENT) a grey placeholder box is shown instead.

const AD_SLOTS = {
  HOME_LEADERBOARD: "5780889379",   // Homepage — below hero
  HOME_MID:         "1974144330",   // Homepage — between sections
  RESOURCES_TOP:    "2611800553",   // Resources/Opportunities — below page title
  POST_INLINE:      "7672555541",   // Post detail — in-article (in-article format)
} as const;

type AdSlot = typeof AD_SLOTS[keyof typeof AD_SLOTS];
// "display"  → standard responsive display ad (auto-sizes, best general use)
// "in-article" → native in-article format (blends with content, higher CTR)
type AdVariant = "display" | "in-article";

const ADSENSE_CLIENT = import.meta.env.VITE_ADSENSE_CLIENT as string | undefined;
const IS_DEV = !ADSENSE_CLIENT;

// Inject the AdSense loader script once into <head> at runtime.
// Called from the root App component on first mount.
function injectAdSenseScript() {
  if (!ADSENSE_CLIENT) return;
  if (!getAdConsent()) return;
  if (document.querySelector("script[data-ad-client]")) return;
  const s = document.createElement("script");
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;
  s.async = true;
  s.crossOrigin = "anonymous";
  s.setAttribute("data-ad-client", ADSENSE_CLIENT);
  document.head.appendChild(s);
}

function GoogleAd({ slot, variant = "display", className = "" }: {
  slot: AdSlot;
  variant?: AdVariant;
  className?: string;
}) {
  const ref = useRef<HTMLModElement>(null);
  const pushed = useRef(false);

  useEffect(() => {
    if (IS_DEV || !ref.current || pushed.current) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || pushed.current) return;
      pushed.current = true;
      observer.disconnect();
      try {
        // @ts-expect-error adsbygoogle injected by injectAdSenseScript()
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch { /* script not yet ready */ }
    }, { rootMargin: "200px" });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  // Dev placeholder — visible so you can verify placement before going live
  if (IS_DEV) {
    const h = variant === "in-article" ? "min-h-[100px]" : "h-[90px] sm:h-[100px]";
    return (
      <div className={`w-full ${className}`}>
        <p className="text-[9px] font-semibold text-gray-300 uppercase tracking-widest text-center mb-1 select-none">Advertisement</p>
        <div className={`w-full ${h} flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50/60 gap-1`}>
          <span className="text-[10px] text-gray-300 font-mono">{slot}</span>
          <span className="text-[9px] text-gray-200 font-mono">{variant} · responsive</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full overflow-hidden ${className}`}>
      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest text-center mb-1 select-none">Advertisement</p>
      <ins
        ref={ref}
        className="adsbygoogle"
        style={{ display: "block", textAlign: "center" }}
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={slot}
        data-ad-format={variant === "in-article" ? "fluid" : "auto"}
        data-ad-layout={variant === "in-article" ? "in-article" : undefined}
        data-full-width-responsive="true"
      />
    </div>
  );
}

const STATIC_PAGES_CONTENT = {
  privacy: {
    title: "Privacy Policy",
    slug: "privacy-policy",
    fallback: `Last updated: August 2026

EduHub PH ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and share information when you use eduhubph.tech.

Information We Collect:
We collect information you provide directly, such as your name and email address when you register for an account or contact us. We also automatically collect certain technical information when you visit the site, including your IP address, browser type, pages visited, and time spent on the site.

Cookies and Tracking Technologies:
We use cookies and similar technologies to operate the site, remember your preferences, and measure site usage. Third-party advertising partners, including Google AdSense, may also set cookies on your device to serve personalized ads based on your interests. You can control cookie preferences through our Cookie Settings panel.

Google AdSense:
We use Google AdSense to display advertisements on this site. Google uses cookies to serve ads based on your prior visits to this and other websites. You may opt out of personalized advertising by visiting https://www.google.com/settings/ads. Google's use of advertising cookies enables it and its partners to serve ads to users based on their visit to our site. For more information on how Google uses data, see https://policies.google.com/technologies/partner-sites.

How We Use Information:
We use the information we collect to operate and improve the site, send you account-related communications, respond to your messages, display relevant advertising, and comply with legal obligations. We do not sell your personal information to third parties.

Data Sharing:
We share data with Google for advertising purposes as described above. We may share information with service providers who assist in operating our platform, subject to confidentiality agreements. We may disclose information when required by law.

Data Retention:
We retain your account information for as long as your account is active. You may request deletion of your account by contacting us.

Your Rights:
You have the right to access, correct, or delete your personal information. To exercise these rights, contact us via the Feedback page.

Children's Privacy:
EduHub PH is not directed at children under 13. We do not knowingly collect personal information from children under 13.

Changes to This Policy:
We may update this Privacy Policy from time to time. We will notify users of significant changes by posting the updated policy on this page with a new effective date.

Contact:
For privacy-related questions, use the Contact/Feedback page on this site.`,
  },
  terms: {
    title: "Terms of Use",
    slug: "terms-of-use",
    fallback: `Last updated: August 2026

Welcome to EduHub PH. By accessing or using eduhubph.tech, you agree to be bound by these Terms of Use. Please read them carefully.

1. Acceptance of Terms
By using EduHub PH, you confirm that you are at least 13 years old and agree to these Terms of Use. If you do not agree, please do not use the site.

2. Description of Service
EduHub PH is a free educational platform that provides Filipino students with access to study reviewers, learning modules, scholarship information, and other educational resources. The platform is provided "as is" and is free to use.

3. User Accounts
You may create an account to access additional features such as saving posts. You are responsible for maintaining the confidentiality of your login credentials and for all activities under your account. You must provide accurate information when registering.

4. Acceptable Use
You agree not to use EduHub PH to post or transmit any content that is unlawful, harmful, abusive, harassing, defamatory, or otherwise objectionable. You may not attempt to gain unauthorized access to any part of the site or its systems. You may not use the site for any commercial purpose without written permission.

5. Content
Educational materials on EduHub PH are provided for informational and educational purposes only. While we strive for accuracy, we make no warranties about the completeness or reliability of any content. Always verify information with authoritative sources, especially for exam preparation.

6. Intellectual Property
All content created by EduHub PH is protected by copyright. You may access content for personal, non-commercial use only. You may not reproduce, distribute, or create derivative works without express written permission.

7. Advertising
EduHub PH displays advertisements provided by Google AdSense. Advertising revenue helps keep the platform free. We are not responsible for the content of third-party advertisements.

8. Privacy
Your use of EduHub PH is also governed by our Privacy Policy, which is incorporated into these Terms by reference.

9. Disclaimer of Warranties
EduHub PH is provided on an "as is" and "as available" basis without warranties of any kind. We do not guarantee that the site will be uninterrupted, error-free, or free of viruses.

10. Limitation of Liability
To the fullest extent permitted by law, EduHub PH and its operators shall not be liable for any indirect, incidental, or consequential damages arising from your use of the site.

11. Changes to Terms
We reserve the right to modify these Terms at any time. Continued use of the site after changes constitutes acceptance of the updated Terms.

12. Contact
For questions about these Terms, please use the Contact/Feedback page on this site.`,
  },
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────

const URL_RE = /(https?:\/\/[^\s,)]+)/g;

function renderTextWithLinks(text: string): React.ReactNode {
  const parts = text.split(URL_RE);
  return parts.map((part, i) =>
    URL_RE.test(part)
      ? <a key={i} href={part} target="_blank" rel="noopener noreferrer"
          className="text-blue-600 underline underline-offset-2 hover:text-blue-800 break-all">{part}</a>
      : part
  );
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
}
function fmtShort(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
}
function toSlug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

// ─── SKELETON / LOADING ───────────────────────────────────────────────────────

/** Strip non-digits, cap at 11 chars */
function sanitizePhone(v: string) {
  return v.replace(/\D/g, "").slice(0, 11);
}
function validatePhone(v: string): string | undefined {
  if (!v) return undefined; // optional field — only validate if filled
  if (!/^\d+$/.test(v)) return "Mobile number must contain digits only.";
  if (!v.startsWith("09")) return "Mobile number must start with 09.";
  if (v.length !== 11) return "Mobile number must be exactly 11 digits.";
  return undefined;
}

function PhoneField({ label = "Mobile Number", value, onChange, error }: {
  label?: string; value: string; onChange: (v: string) => void; error?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[13px] font-semibold text-gray-500 tracking-[0.06em] uppercase">{label}</label>
      <input
        type="tel"
        inputMode="numeric"
        pattern="[0-9]*"
        value={value}
        maxLength={11}
        placeholder="09XX XXX XXXX"
        onChange={e => onChange(sanitizePhone(e.target.value))}
        onKeyDown={e => {
          // Allow: backspace, delete, tab, escape, enter, arrows, home, end
          const allowed = ["Backspace","Delete","Tab","Escape","Enter","ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Home","End"];
          if (allowed.includes(e.key)) return;
          // Block anything that isn't a digit
          if (!/^\d$/.test(e.key)) e.preventDefault();
        }}
        className={`w-full px-4 py-3 text-[15px] bg-gray-50 border rounded-xl focus:outline-none focus:bg-white transition-all placeholder:text-gray-400
          ${error ? "border-red-400 bg-red-50/30 focus:border-red-500" : "border-gray-200 focus:border-black"}`}
      />
      {error && (
        <p className="flex items-center gap-1.5 text-[12px] text-red-500 font-medium">
          <AlertCircle size={12} className="flex-none" /> {error}
        </p>
      )}
    </div>
  );
}

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-100 rounded-lg ${className}`} />;
}
function CardSkeleton() {
  return (
    <div className="bg-white border border-black/[0.08] rounded-xl p-5 space-y-3">
      <Skeleton className="h-5 w-20" />
      <Skeleton className="h-5 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  );
}

function LoadingDots({ size = "sm", className = "" }: { size?: "xs" | "sm" | "md" | "lg"; className?: string }) {
  const sz = { xs: "w-1 h-1", sm: "w-1.5 h-1.5", md: "w-2 h-2", lg: "w-2.5 h-2.5" }[size];
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      {[0, 1, 2].map(i => (
        <span key={i} className={`${sz} rounded-full bg-current dot-pulse`}
          style={{ animationDelay: `${i * 0.18}s` }} />
      ))}
    </span>
  );
}

function ThemePicker({ theme, setTheme }: { theme: ThemeId; setTheme: (id: ThemeId) => void }) {
  return (
    <div className="bg-white border border-black/[0.08] rounded-2xl p-6 sm:p-8">
      <h2 className="text-lg font-bold mb-1">Site Theme</h2>
      <p className="text-sm text-gray-500 mb-6">Choose an accent color for your EduHubPH experience.</p>
      <div className="flex flex-wrap gap-4">
        {THEMES.map(t => (
          <button key={t.id} onClick={() => setTheme(t.id)}
            className={`flex flex-col items-center gap-2 p-2 rounded-2xl border-2 transition-all ${theme === t.id ? "border-black shadow-md scale-105" : "border-transparent hover:border-gray-200"}`}
            title={t.name}>
            <span className="w-9 h-9 rounded-full shadow-sm flex-none" style={{ backgroundColor: t.p }} />
            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">{t.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── UI PRIMITIVES ────────────────────────────────────────────────────────────

function BackButton({ onClick, className = "" }: { onClick: () => void; className?: string }) {
  return (
    <button onClick={onClick} aria-label="Go back"
      className={`flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-br from-gray-700 to-black text-white hover:opacity-80 transition-opacity ${className}`}>
      <ArrowLeft size={15} />
    </button>
  );
}

function Pill({ label, dark = false }: { label: string; dark?: boolean }) {
  return (
    <span className={`inline-block px-2.5 py-0.5 text-[11px] font-semibold rounded-full tracking-wide ${dark ? "th-bg" : "bg-gray-100 text-gray-600"}`}>
      {label}
    </span>
  );
}

function Btn({ children, variant = "primary", size = "md", onClick, type = "button", disabled, className = "" }: {
  children: React.ReactNode; variant?: "primary" | "secondary" | "ghost" | "outline" | "danger";
  size?: "sm" | "md" | "lg"; onClick?: () => void; type?: "button" | "submit";
  disabled?: boolean; className?: string;
}) {
  const base = "inline-flex items-center justify-center gap-1.5 font-semibold rounded-lg transition-all focus:outline-none cursor-pointer";
  const sizes = { sm: "px-3 py-1.5 text-xs", md: "px-4 py-2 text-sm", lg: "px-5 py-2.5 text-sm" };
  const variants = {
    primary: "th-btn-primary",
    secondary: "bg-gray-100 text-black hover:bg-gray-200",
    ghost: "text-black hover:bg-gray-100",
    outline: "th-btn-outline",
    danger: "bg-white border border-red-200 text-red-600 hover:bg-red-50",
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={`${base} ${sizes[size]} ${variants[variant]} ${disabled ? "opacity-40 cursor-not-allowed" : ""} ${className}`}>
      {children}
    </button>
  );
}

function InputField({ label, type = "text", value, onChange, placeholder, disabled, showToggle, onToggle, isPasswordVisible, error }: {
  label?: string; type?: string; value: string; onChange: (v: string) => void;
  placeholder?: string; disabled?: boolean;
  showToggle?: boolean; onToggle?: () => void; isPasswordVisible?: boolean; error?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-[13px] font-semibold text-gray-500 tracking-[0.06em] uppercase">{label}</label>}
      <div className="relative">
        <input
          type={showToggle ? (isPasswordVisible ? "text" : "password") : type}
          value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder} disabled={disabled}
          className={`w-full px-4 py-3 text-[15px] bg-gray-50 border rounded-xl focus:outline-none focus:bg-white transition-all disabled:opacity-50 disabled:cursor-not-allowed placeholder:text-gray-400
            ${error ? "border-red-400 bg-red-50/30 focus:border-red-500" : "border-gray-200 focus:border-black"}`}
          style={{ paddingRight: showToggle ? "2.75rem" : undefined }}
        />
        {showToggle && (
          <button type="button" onClick={onToggle} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black transition-colors">
            {isPasswordVisible ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>
      {error && <p className="flex items-center gap-1.5 text-[12px] text-red-500 font-medium"><AlertCircle size={12} className="flex-none" /> {error}</p>}
    </div>
  );
}

function AdminInputField({ label, value, onChange, placeholder, type = "text", disabled }: {
  label?: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-sm font-semibold text-black">{label}</label>}
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} disabled={disabled}
        className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-black focus:bg-white transition-colors placeholder:text-gray-400 disabled:opacity-50" />
    </div>
  );
}

function SelectField({ label, value, onChange, options, placeholder }: {
  label?: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-sm font-semibold text-black">{label}</label>}
      <div className="relative">
        <select value={value} onChange={e => onChange(e.target.value)}
          className="w-full appearance-none px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-black focus:bg-white transition-colors cursor-pointer pr-9">
          {placeholder && <option value="">{placeholder}</option>}
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
      </div>
    </div>
  );
}

function SectionHeader({ title, onViewAll }: { title: string; onViewAll?: () => void }) {
  return (
    <div className="flex items-end justify-between mb-6">
      <div><h2 className="text-xl font-bold tracking-tight">{title}</h2></div>
      {onViewAll && (
        <button onClick={onViewAll} className="flex items-center gap-1 text-sm font-medium text-[var(--th-p)] hover:opacity-70 transition-opacity group">
          View all <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
        </button>
      )}
    </div>
  );
}

function EmptyState({ icon, title, desc, action }: { icon: React.ReactNode; title: string; desc?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-4 text-gray-300">{icon}</div>
      <p className="font-semibold text-gray-800">{title}</p>
      {desc && <p className="text-sm text-gray-400 mt-1 max-w-xs">{desc}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

function PostCard({ post, isSaved, onSave, onRead, role }: {
  post: Post; isSaved: boolean; onSave: (id: number) => void; onRead: (id: number) => void; role: Role;
}) {
  return (
    <article className="bg-white border border-black/[0.08] rounded-xl p-5 hover:shadow-lg hover:shadow-black/5 hover:-translate-y-0.5 transition-all duration-200 flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        {post.categories && <Pill label={post.categories.name} dark />}
        {post.subjects && <Pill label={post.subjects.name} />}
        {post.is_featured && <Star size={11} className="text-gray-400 ml-auto" fill="currentColor" />}
      </div>
      <h3 className="font-bold text-[15px] leading-snug mb-2 line-clamp-2 flex-none">{post.title}</h3>
      <p className="text-sm text-gray-500 leading-relaxed line-clamp-3 flex-1">{post.excerpt}</p>
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
        <span className="text-xs text-gray-400">{fmtShort(post.published_at)}</span>
        <div className="flex items-center gap-2">
          {role === "user" && (
            <button onClick={() => onSave(post.id)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors" aria-label={isSaved ? "Remove" : "Save"}>
              {isSaved ? <BookmarkCheck size={15} className="text-black" /> : <Bookmark size={15} className="text-gray-300 hover:text-gray-600" />}
            </button>
          )}
          <button onClick={() => onRead(post.id)} className="text-xs font-semibold text-black hover:text-gray-500 transition-colors flex items-center gap-1">
            Read more <ChevronRight size={12} />
          </button>
        </div>
      </div>
    </article>
  );
}

// ─── LOGO ─────────────────────────────────────────────────────────────────────

/**
 * Inline wordmark SVG — paths extracted from eduhublogo.svg, background rect omitted.
 * viewBox crops to the text region (x:35–780, y:308–490) so there's no whitespace.
 * Works on any background color without blending tricks.
 */
function LogoWordmark({ className = "", edu = "#134c7a", hub = "#080b4a" }: { className?: string; edu?: string; hub?: string }) {
  return (
    <svg
      viewBox="35 308 745 182"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      focusable="false"
    >

      {/* "Edu" — medium blue */}
      <path fill={edu} fillOpacity="1" fillRule="nonzero" d="M 100.574219 481.5 C 87.824219 481.5 76.726562 478.875 67.273438 473.625 C 57.976562 468.226562 50.773438 460.949219 45.675781 451.800781 C 40.726562 442.648438 38.25 432.300781 38.25 420.75 C 38.25 407.25 40.949219 395.773438 46.351562 386.324219 C 51.898438 376.726562 59.101562 369.375 67.949219 364.273438 C 76.800781 359.175781 86.175781 356.625 96.074219 356.625 C 103.726562 356.625 110.925781 358.199219 117.675781 361.351562 C 124.574219 364.5 130.648438 368.851562 135.898438 374.398438 C 141.148438 379.800781 145.273438 386.101562 148.273438 393.300781 C 151.425781 400.5 153 408.148438 153 416.25 C 152.851562 419.851562 151.425781 422.773438 148.726562 425.023438 C 146.023438 427.273438 142.875 428.398438 139.273438 428.398438 L 53.324219 428.398438 L 46.574219 405.898438 L 129.148438 405.898438 L 124.199219 410.398438 L 124.199219 404.324219 C 123.898438 399.976562 122.324219 396.074219 119.476562 392.625 C 116.773438 389.175781 113.324219 386.476562 109.125 384.523438 C 105.074219 382.425781 100.726562 381.375 96.074219 381.375 C 91.574219 381.375 87.375 381.976562 83.476562 383.175781 C 79.574219 384.375 76.199219 386.398438 73.351562 389.25 C 70.5 392.101562 68.25 395.925781 66.601562 400.726562 C 64.949219 405.523438 64.125 411.601562 64.125 418.949219 C 64.125 427.050781 65.773438 433.949219 69.074219 439.648438 C 72.523438 445.199219 76.875 449.476562 82.125 452.476562 C 87.523438 455.324219 93.226562 456.75 99.226562 456.75 C 104.773438 456.75 109.199219 456.300781 112.5 455.398438 C 115.800781 454.5 118.425781 453.449219 120.375 452.25 C 122.476562 450.898438 124.351562 449.773438 126 448.875 C 128.699219 447.523438 131.25 446.851562 133.648438 446.851562 C 136.949219 446.851562 139.648438 447.976562 141.75 450.226562 C 144 452.476562 145.125 455.101562 145.125 458.101562 C 145.125 462.148438 143.023438 465.824219 138.824219 469.125 C 134.925781 472.425781 129.449219 475.351562 122.398438 477.898438 C 115.351562 480.300781 108.074219 481.5 100.574219 481.5 Z M 263.890625 312.75 C 267.789062 312.75 271.015625 314.023438 273.566406 316.574219 C 276.113281 319.125 277.390625 322.425781 277.390625 326.476562 L 277.390625 465.523438 C 277.390625 469.425781 276.113281 472.726562 273.566406 475.425781 C 271.015625 477.976562 267.789062 479.25 263.890625 479.25 C 259.988281 479.25 256.765625 477.976562 254.214844 475.425781 C 251.664062 472.726562 250.390625 469.425781 250.390625 465.523438 L 250.390625 454.5 L 255.339844 456.523438 C 255.339844 458.476562 254.289062 460.875 252.191406 463.726562 C 250.089844 466.425781 247.238281 469.125 243.640625 471.824219 C 240.039062 474.523438 235.765625 476.851562 230.816406 478.800781 C 226.015625 480.601562 220.765625 481.5 215.066406 481.5 C 204.714844 481.5 195.339844 478.875 186.941406 473.625 C 178.539062 468.226562 171.863281 460.875 166.914062 451.574219 C 162.113281 442.125 159.714844 431.324219 159.714844 419.175781 C 159.714844 406.875 162.113281 396.074219 166.914062 386.773438 C 171.863281 377.324219 178.464844 369.976562 186.714844 364.726562 C 194.964844 359.324219 204.113281 356.625 214.164062 356.625 C 220.613281 356.625 226.539062 357.601562 231.941406 359.550781 C 237.339844 361.5 241.988281 363.976562 245.890625 366.976562 C 249.941406 369.976562 253.015625 373.050781 255.113281 376.199219 C 257.363281 379.199219 258.488281 381.75 258.488281 383.851562 L 250.390625 386.773438 L 250.390625 326.476562 C 250.390625 322.574219 251.664062 319.351562 254.214844 316.800781 C 256.765625 314.101562 259.988281 312.75 263.890625 312.75 Z M 218.441406 456.75 C 225.039062 456.75 230.816406 455.101562 235.765625 451.800781 C 240.714844 448.5 244.539062 444 247.238281 438.300781 C 250.089844 432.601562 251.515625 426.226562 251.515625 419.175781 C 251.515625 411.976562 250.089844 405.523438 247.238281 399.824219 C 244.539062 394.125 240.714844 389.625 235.765625 386.324219 C 230.816406 383.023438 225.039062 381.375 218.441406 381.375 C 211.988281 381.375 206.289062 383.023438 201.339844 386.324219 C 196.390625 389.625 192.488281 394.125 189.640625 399.824219 C 186.941406 405.523438 185.589844 411.976562 185.589844 419.175781 C 185.589844 426.226562 186.941406 432.601562 189.640625 438.300781 C 192.488281 444 196.390625 448.5 201.339844 451.800781 C 206.289062 455.101562 211.988281 456.75 218.441406 456.75 Z M 388.214844 358.875 C 392.113281 358.875 395.339844 360.226562 397.890625 362.925781 C 400.441406 365.476562 401.714844 368.699219 401.714844 372.601562 L 401.714844 429.75 C 401.714844 445.648438 397.289062 458.25 388.441406 467.550781 C 379.589844 476.851562 366.839844 481.5 350.191406 481.5 C 333.539062 481.5 320.789062 476.851562 311.941406 467.550781 C 303.238281 458.25 298.890625 445.648438 298.890625 429.75 L 298.890625 372.601562 C 298.890625 368.699219 300.164062 365.476562 302.714844 362.925781 C 305.265625 360.226562 308.488281 358.875 312.390625 358.875 C 316.289062 358.875 319.515625 360.226562 322.066406 362.925781 C 324.613281 365.476562 325.890625 368.699219 325.890625 372.601562 L 325.890625 429.75 C 325.890625 438.898438 327.914062 445.726562 331.964844 450.226562 C 336.015625 454.574219 342.089844 456.75 350.191406 456.75 C 358.441406 456.75 364.589844 454.574219 368.640625 450.226562 C 372.691406 445.726562 374.714844 438.898438 374.714844 429.75 L 374.714844 372.601562 C 374.714844 368.699219 375.988281 365.476562 378.539062 362.925781 C 381.089844 360.226562 384.316406 358.875 388.214844 358.875 Z" />
      {/* "Hub" — dark navy */}
      <path fill={hub} fillOpacity="1" fillRule="nonzero" d="M 482.921875 356.625 C 493.71875 356.625 501.894531 358.949219 507.445312 363.601562 C 513.144531 368.25 517.046875 374.476562 519.144531 382.273438 C 521.246094 389.925781 522.296875 398.476562 522.296875 407.925781 L 522.296875 465.523438 C 522.296875 469.425781 521.019531 472.726562 518.46875 475.425781 C 515.921875 477.976562 512.695312 479.25 508.796875 479.25 C 504.894531 479.25 501.671875 477.976562 499.121094 475.425781 C 496.570312 472.726562 495.296875 469.425781 495.296875 465.523438 L 495.296875 407.925781 C 495.296875 402.976562 494.695312 398.550781 493.496094 394.648438 C 492.296875 390.601562 490.121094 387.375 486.96875 384.976562 C 483.820312 382.574219 479.320312 381.375 473.46875 381.375 C 467.769531 381.375 462.894531 382.574219 458.84375 384.976562 C 454.796875 387.375 451.71875 390.601562 449.621094 394.648438 C 447.671875 398.550781 446.695312 402.976562 446.695312 407.925781 L 446.695312 465.523438 C 446.695312 469.425781 445.421875 472.726562 442.871094 475.425781 C 440.320312 477.976562 437.09375 479.25 433.195312 479.25 C 429.296875 479.25 426.070312 477.976562 423.519531 475.425781 C 420.96875 472.726562 419.695312 469.425781 419.695312 465.523438 L 419.695312 326.476562 C 419.695312 322.574219 420.96875 319.351562 423.519531 316.800781 C 426.070312 314.101562 429.296875 312.75 433.195312 312.75 C 437.09375 312.75 440.320312 314.101562 442.871094 316.800781 C 445.421875 319.351562 446.695312 322.574219 446.695312 326.476562 L 446.695312 382.273438 L 443.320312 381.601562 C 444.671875 379.050781 446.546875 376.351562 448.945312 373.5 C 451.34375 370.5 454.269531 367.726562 457.71875 365.175781 C 461.171875 362.625 464.996094 360.601562 469.195312 359.101562 C 473.394531 357.449219 477.96875 356.625 482.921875 356.625 Z M 629.605469 358.875 C 633.507812 358.875 636.730469 360.226562 639.28125 362.925781 C 641.832031 365.476562 643.105469 368.699219 643.105469 372.601562 L 643.105469 429.75 C 643.105469 445.648438 638.679688 458.25 629.832031 467.550781 C 620.980469 476.851562 608.230469 481.5 591.582031 481.5 C 574.929688 481.5 562.179688 476.851562 553.332031 467.550781 C 544.632812 458.25 540.28125 445.648438 540.28125 429.75 L 540.28125 372.601562 C 540.28125 368.699219 541.554688 365.476562 544.105469 362.925781 C 546.65625 360.226562 549.882812 358.875 553.78125 358.875 C 557.679688 358.875 560.90625 360.226562 563.457031 362.925781 C 566.007812 365.476562 567.28125 368.699219 567.28125 372.601562 L 567.28125 429.75 C 567.28125 438.898438 569.304688 445.726562 573.355469 450.226562 C 577.40625 454.574219 583.480469 456.75 591.582031 456.75 C 599.832031 456.75 605.980469 454.574219 610.03125 450.226562 C 614.082031 445.726562 616.105469 438.898438 616.105469 429.75 L 616.105469 372.601562 C 616.105469 368.699219 617.382812 365.476562 619.929688 362.925781 C 622.480469 360.226562 625.707031 358.875 629.605469 358.875 Z M 723.410156 356.625 C 733.910156 356.625 743.285156 359.324219 751.539062 364.726562 C 759.9375 369.976562 766.539062 377.25 771.335938 386.550781 C 776.289062 395.851562 778.761719 406.648438 778.761719 418.949219 C 778.761719 431.25 776.289062 442.125 771.335938 451.574219 C 766.539062 460.875 760.011719 468.226562 751.761719 473.625 C 743.660156 478.875 734.511719 481.5 724.3125 481.5 C 718.3125 481.5 712.6875 480.523438 707.4375 478.574219 C 702.1875 476.625 697.535156 474.148438 693.488281 471.148438 C 689.585938 468.148438 686.511719 465.148438 684.261719 462.148438 C 682.160156 459 681.113281 456.375 681.113281 454.273438 L 688.085938 451.351562 L 688.085938 467.773438 C 688.085938 471.675781 686.8125 474.976562 684.261719 477.675781 C 681.710938 480.226562 678.488281 481.5 674.585938 481.5 C 670.6875 481.5 667.460938 480.226562 664.910156 477.675781 C 662.363281 475.125 661.085938 471.824219 661.085938 467.773438 L 661.085938 326.476562 C 661.085938 322.574219 662.363281 319.351562 664.910156 316.800781 C 667.460938 314.101562 670.6875 312.75 674.585938 312.75 C 678.488281 312.75 681.710938 314.101562 684.261719 316.800781 C 686.8125 319.351562 688.085938 322.574219 688.085938 326.476562 L 688.085938 383.625 L 684.261719 381.601562 C 684.261719 379.648438 685.3125 377.324219 687.410156 374.625 C 689.511719 371.773438 692.363281 369 695.960938 366.300781 C 699.5625 363.449219 703.6875 361.125 708.335938 359.324219 C 713.136719 357.523438 718.160156 356.625 723.410156 356.625 Z M 720.035156 381.375 C 713.4375 381.375 707.660156 383.023438 702.710938 386.324219 C 697.761719 389.625 693.863281 394.125 691.011719 399.824219 C 688.3125 405.375 686.960938 411.75 686.960938 418.949219 C 686.960938 426 688.3125 432.449219 691.011719 438.300781 C 693.863281 444 697.761719 448.5 702.710938 451.800781 C 707.660156 455.101562 713.4375 456.75 720.035156 456.75 C 726.636719 456.75 732.335938 455.101562 737.136719 451.800781 C 742.085938 448.5 745.910156 444 748.613281 438.300781 C 751.460938 432.449219 752.886719 426 752.886719 418.949219 C 752.886719 411.75 751.460938 405.375 748.613281 399.824219 C 745.910156 394.125 742.085938 389.625 737.136719 386.324219 C 732.335938 383.023438 726.636719 381.375 720.035156 381.375 Z" />
    </svg>
  );
}

function Logo({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="hover:opacity-75 transition-opacity" aria-label="EduHub PH home">
      <LogoWordmark className="h-5 w-auto sm:h-8" />
    </button>
  );
}

// ─── NAVBAR ───────────────────────────────────────────────────────────────────

function Navbar({ page, role, profile, setPage, setRole, setUserId, openAuth, appTheme }: {
  page: Page; role: Role; profile: Profile | null;
  setPage: (p: Page) => void; setRole: (r: Role) => void;
  setUserId: (id: string | null) => void; openAuth: (step?: AuthStep) => void;
  appTheme?: ThemeId;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const publicLinks = [
    { label: "Home", page: "home" as Page },
    { label: "Resources", page: "resources" as Page },
    { label: "Opportunities", page: "opportunities" as Page },
    { label: "Tools", page: "tools" as Page },
    { label: "Feedback", page: "feedback" as Page },
  ];

  const go = (p: Page) => { setPage(p); setMobileOpen(false); setProfileOpen(false); };
  const isActive = (p: Page) => page === p;

  const handleSignOut = async () => {
    await api.signOut();
    setRole("guest"); setUserId(null); go("home");
  };

  const displayName = profile ? `${profile.first_name} ${profile.last_name[0]}.` : "Account";
  const initial = profile?.first_name[0]?.toUpperCase() ?? "U";

  return (
    <nav className="sticky top-0 z-40 border-b border-black/[0.08]" style={{ backgroundColor: "var(--th-p-lt)" }}>
      <div className="max-w-6xl mx-auto px-5 sm:px-8 h-[68px] flex items-center justify-between gap-6">
        <Logo onClick={() => go("home")} />
        <div className="hidden md:flex items-center gap-0.5">
          {publicLinks.map(l => (
            <button key={l.page} onClick={() => go(l.page)}
              className={`px-4 py-2 rounded-lg text-[14px] font-medium transition-colors ${isActive(l.page) ? "th-bg" : "text-gray-700 hover:text-black hover:bg-black/10"}`}>
              {l.label}
            </button>
          ))}
          {role === "user" && (
            <button onClick={() => go("saved-posts")}
              className={`px-4 py-2 rounded-lg text-[14px] font-medium transition-colors flex items-center gap-1.5 ${isActive("saved-posts") ? "th-bg" : "text-gray-700 hover:text-black hover:bg-black/10"}`}>
              <Bookmark size={14} /> Saved
            </button>
          )}
        </div>
        <div className="hidden md:flex items-center gap-3">
          {role === "guest" && (
            <>
              <button onClick={() => openAuth("email")}
                className="px-4 py-2 text-[14px] font-semibold text-gray-700 hover:text-black rounded-lg hover:bg-black/10 transition-colors">
                Sign in
              </button>
              <button onClick={() => openAuth("register")}
                className="px-5 py-2 text-[14px] font-semibold th-btn-primary rounded-xl transition-opacity hover:opacity-90">
                Create account
              </button>
            </>
          )}
          {role === "user" && (
            <div className="relative" ref={profileRef}>
              <button onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-2 px-3.5 py-2 rounded-lg hover:bg-black/10 transition-colors text-[14px] font-medium">
                <div className="w-7 h-7 rounded-full th-bg text-xs font-bold flex items-center justify-center">{initial}</div>
                {displayName} <ChevronDown size={13} className={`transition-transform ${profileOpen ? "rotate-180" : ""}`} />
              </button>
              {profileOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-48 bg-white border border-black/10 rounded-xl shadow-xl py-1 text-sm z-50">
                  <button onClick={() => go("profile")} className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center gap-2 text-gray-700"><Settings size={13} /> Profile</button>
                  <button onClick={() => go("account-settings")} className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center gap-2 text-gray-700">
                    <span className="flex-none w-[13px] h-[13px] rounded-full border border-black/10" style={{ backgroundColor: THEMES.find(t => t.id === appTheme)?.p ?? "#18181b" }} />
                    Appearance
                  </button>
                  <button onClick={() => go("account-settings")} className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center gap-2 text-gray-700"><Key size={13} /> Security</button>
                  <div className="border-t border-gray-100 my-1" />
                  <button onClick={handleSignOut} className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center gap-2 text-gray-700"><LogOut size={13} /> Sign out</button>
                </div>
              )}
            </div>
          )}
          {role === "superadmin" && (
            <button onClick={() => go("admin-dashboard")}
              className="px-5 py-2 text-[14px] font-semibold th-btn-primary rounded-xl">
              Admin Panel
            </button>
          )}
        </div>
        <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden p-2.5 rounded-lg hover:bg-black/10" aria-label="Toggle menu">
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>
      {mobileOpen && (
        <div className="md:hidden border-t border-black/[0.08] px-4 pb-4 pt-2 space-y-1" style={{ backgroundColor: "var(--th-p-lt)" }}>
          {publicLinks.map(l => (
            <button key={l.page} onClick={() => go(l.page)}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium ${isActive(l.page) ? "th-bg" : "text-gray-700 hover:bg-black/10"}`}>
              {l.label}
            </button>
          ))}
          <div className="border-t border-black/[0.08] pt-2 mt-2 space-y-1">
            {role === "guest" && (
              <>
                <button onClick={() => { setMobileOpen(false); openAuth("email"); }} className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-black/10">Sign in</button>
                <button onClick={() => { setMobileOpen(false); openAuth("register"); }} className="w-full px-3 py-2.5 rounded-lg text-sm font-semibold th-btn-primary text-center">Create account</button>
              </>
            )}
            {role === "user" && (
              <>
                <button onClick={() => go("saved-posts")} className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-black/10">Saved Posts</button>
                <button onClick={() => go("profile")} className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-black/10">Profile</button>
                <button onClick={() => go("account-settings")} className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-black/10 flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full border border-black/10 flex-none" style={{ backgroundColor: THEMES.find(t => t.id === appTheme)?.p ?? "#18181b" }} />
                  Appearance
                </button>
                <button onClick={handleSignOut} className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-black/10">Sign out</button>
              </>
            )}
            {role === "superadmin" && (
              <button onClick={() => go("admin-dashboard")} className="w-full px-3 py-2.5 rounded-lg text-sm font-semibold th-btn-primary text-center">Admin Panel</button>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}

// ─── FOOTER ───────────────────────────────────────────────────────────────────

function Footer({ setPage, role }: { setPage: (p: Page) => void; role: Role }) {
  const year = new Date().getFullYear();
  const [cats, setCats] = useState<Category[]>([]);

  useEffect(() => {
    api.getCategories(true).then(data => setCats(data.slice(0, 5)));
  }, []);

  return (
    <footer className="text-white mt-20" style={{ backgroundColor: "var(--th-p)" }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
          <div>
            <div className="mb-4">
              <LogoWordmark className="h-6 w-auto" edu="#ffffff" hub="rgba(255,255,255,0.8)" />
            </div>
            <p className="text-sm text-white/65 leading-relaxed">A student-focused platform for educational resources, scholarship updates, and learning modules in the Philippines.</p>
            <p className="text-xs text-white/40 mt-3">Built for Filipino learners.</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-white/50 mb-4">Explore</p>
            <ul className="space-y-2.5">
              {[{ label: "Home", page: "home" as Page }, { label: "Resources", page: "resources" as Page }, { label: "Opportunities", page: "opportunities" as Page }, { label: "Tools", page: "tools" as Page }, { label: "About", page: "about" as Page }, { label: "Feedback", page: "feedback" as Page }, ...(role !== "guest" ? [{ label: "Saved Posts", page: "saved-posts" as Page }] : [])].map(l => (
                <li key={l.label}><button onClick={() => setPage(l.page)} className="text-sm text-white/65 hover:text-white transition-colors">{l.label}</button></li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-white/50 mb-4">Resources</p>
            <ul className="space-y-2.5">
              {cats.length > 0
                ? cats.map(c => (
                    <li key={c.id}>
                      <button onClick={() => setPage(c.type === "opportunity" ? "opportunities" : "resources")} className="text-sm text-white/65 hover:text-white transition-colors text-left">
                        {c.name}
                      </button>
                    </li>
                  ))
                : ["Reviewers", "Modules", "Scholarships"].map(l => (
                    <li key={l}><button onClick={() => setPage("resources")} className="text-sm text-white/65 hover:text-white transition-colors">{l}</button></li>
                  ))
              }
            </ul>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-white/50 mb-4">Support</p>
            <ul className="space-y-2.5">
              {[{ label: "About", page: "about" as Page }, { label: "Contact", page: "feedback" as Page }, { label: "Privacy Policy", page: "privacy" as Page }, { label: "Terms of Use", page: "terms" as Page }].map(l => (
                <li key={l.label}><button onClick={() => setPage(l.page)} className="text-sm text-white/65 hover:text-white transition-colors">{l.label}</button></li>
              ))}
            </ul>
          </div>
        </div>
        {/* About the Dev */}
        <div className="border-t border-white/10 pt-8 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8">
            <div className="flex-none">
              <p className="text-sm font-semibold text-white leading-none">Raymond Bautista</p>
              <p className="text-[11px] text-white/50 mt-0.5">Developer &amp; Creator</p>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <p className="text-[13px] text-white/60 leading-relaxed">Enjoying EduHub PH? Help keep it running.</p>
              <a href="https://buymeacoffee.com/raidev" target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium text-white/80 hover:text-white border border-white/10 hover:border-white/25 bg-white/5 hover:bg-white/10 backdrop-blur-sm transition-all w-fit">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8h1a4 4 0 0 1 0 8h-1" /><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" /><line x1="6" y1="1" x2="6" y2="4" /><line x1="10" y1="1" x2="10" y2="4" /><line x1="14" y1="1" x2="14" y2="4" />
                </svg>
                Support the creator
              </a>
            </div>
          </div>
        </div>
        <div className="border-t border-white/10 pt-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-white/40">
          <span>© {year} EduHub PH. All rights reserved.</span>
        </div>
      </div>
    </footer>
  );
}

// ─── AUTH RATE LIMITING ───────────────────────────────────────────────────────

function useRateLimit(key: string, maxAttempts: number, windowMs: number) {
  const storageKey = `rl_${key}`;

  const getAttempts = (): number[] => {
    try { return JSON.parse(localStorage.getItem(storageKey) || "[]"); } catch { return []; }
  };

  const isLimited = (): boolean => {
    const now = Date.now();
    const attempts = getAttempts().filter(t => now - t < windowMs);
    return attempts.length >= maxAttempts;
  };

  const record = () => {
    const now = Date.now();
    const attempts = getAttempts().filter(t => now - t < windowMs);
    attempts.push(now);
    localStorage.setItem(storageKey, JSON.stringify(attempts));
  };

  const secondsLeft = (): number => {
    const now = Date.now();
    const attempts = getAttempts().filter(t => now - t < windowMs);
    if (attempts.length < maxAttempts) return 0;
    const oldest = Math.min(...attempts);
    return Math.ceil((oldest + windowMs - now) / 1000);
  };

  return { isLimited, record, secondsLeft };
}

function useResendCooldown(key: string, cooldownSec = 60) {
  const storageKey = `resend_${key}`;
  const [secs, setSecs] = useState(0);

  useEffect(() => {
    const calc = () => {
      try {
        const last = parseInt(localStorage.getItem(storageKey) || "0", 10);
        const remaining = Math.max(0, Math.ceil((last + cooldownSec * 1000 - Date.now()) / 1000));
        setSecs(remaining);
        return remaining;
      } catch { return 0; }
    };
    if (calc() > 0) {
      const id = setInterval(() => { if (calc() <= 0) clearInterval(id); }, 1000);
      return () => clearInterval(id);
    }
  }, [storageKey, cooldownSec]);

  const start = () => {
    localStorage.setItem(storageKey, String(Date.now()));
    setSecs(cooldownSec);
    const id = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((parseInt(localStorage.getItem(storageKey) || "0", 10) + cooldownSec * 1000 - Date.now()) / 1000));
      setSecs(remaining);
      if (remaining <= 0) clearInterval(id);
    }, 1000);
  };

  return { secs, start, ready: secs <= 0 };
}

// ─── AUTH MODAL ───────────────────────────────────────────────────────────────

const MODAL_WIDTH = "max-w-[440px]";

function AuthModal({ onClose, onSuccess, initialStep = "email", resetToken, resetTokenType, tokenExpired }: {
  onClose: () => void;
  onSuccess: (role: Role, userId: string, profile: Profile) => void;
  initialStep?: AuthStep;
  resetToken?: string | null;
  resetTokenType?: "registration" | "reset" | null;
  tokenExpired?: { type: "registration" | "reset" } | null;
}) {
  const [step, setStep] = useState<AuthStep>(initialStep);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [regSuccess, setRegSuccess] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [resetDone, setResetDone] = useState(false);
  const [resetPwForm, setResetPwForm] = useState({ newPw: "", confirm: "" });
  const [form, setForm] = useState({ firstName: "", lastName: "", middleName: "", noMiddleName: false, mobile: "" });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const overlayRef = useRef<HTMLDivElement>(null);
  const submitToken = useRef<string>("");

  const [accountStatus, setAccountStatus] = useState<"active" | "pending" | "disabled" | null>(null);

  const loginLimit = useRateLimit("login", 5, 15 * 60 * 1000);
  const registerLimit = useRateLimit("register", 3, 60 * 60 * 1000);
  const forgotLimit = useRateLimit("forgot", 3, 15 * 60 * 1000);
  const regResend = useResendCooldown("reg_resend", 60);
  const forgotResend = useResendCooldown("forgot_resend", 60);
  const activationResend = useResendCooldown("activation_resend", 60);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", h); document.body.style.overflow = ""; };
  }, [onClose]);

  const setF = (k: string) => (v: string) => { setForm(f => ({ ...f, [k]: v })); setErrs(e => ({ ...e, [k]: "" })); };
  const clearErr = (k: string) => () => setErrs(e => ({ ...e, [k]: "" }));

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { setErrs({ email: "Email is required." }); return; }
    if (!isValidEmail(email)) { setErrs({ email: "Enter a valid email address." }); return; }
    setErrs({});
    setLoading(true);
    const { data } = await api.checkAccount(email).catch(() => ({ data: null, error: null }));
    setLoading(false);
    const status = data?.status ?? "active";
    if (status === "pending") { setAccountStatus("pending"); activationResend.start(); return; }
    if (status === "disabled") { setAccountStatus("disabled"); return; }
    // "active" or "not_found" — show password step (don't reveal non-existence)
    setAccountStatus("active");
    setStep("login");
  };

  const makeToken = () => { const t = Math.random().toString(36).slice(2); submitToken.current = t; return t; };
  const tokenValid = (t: string) => t === submitToken.current;

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) { setErrs({ password: "Password is required." }); return; }
    if (loginLimit.isLimited()) { setErrs({ password: `Too many attempts. Try again in ${loginLimit.secondsLeft()}s.` }); return; }
    const token = makeToken();
    setLoading(true); loginLimit.record();
    const { data, error } = await api.signIn(email, password);
    setLoading(false);
    if (!tokenValid(token)) return;
    if (error) { setErrs({ password: error.message }); return; }
    const profile = await api.getProfile(data.user.id);
    if (!profile) { setErrs({ password: "Account not found. Please try again." }); return; }
    onSuccess(profile.role as Role, data.user.id, profile);
    onClose();
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const e2: Record<string, string> = {};
    if (!form.firstName.trim()) e2.firstName = "First name is required.";
    if (!form.lastName.trim()) e2.lastName = "Last name is required.";
    if (!email.trim()) e2.email = "Email is required.";
    else if (!isValidEmail(email)) e2.email = "Enter a valid email address.";
    const phoneErr = form.mobile ? validatePhone(form.mobile) : undefined;
    if (phoneErr) e2.mobile = phoneErr;
    if (Object.keys(e2).length) { setErrs(e2); return; }
    if (registerLimit.isLimited()) { setErrs({ email: `Too many attempts. Try again in ${registerLimit.secondsLeft()}s.` }); return; }
    const token = makeToken();
    setLoading(true); registerLimit.record();
    const { error } = await api.registerUser(email, {
      first_name: form.firstName,
      last_name: form.lastName,
      middle_name: form.noMiddleName ? undefined : form.middleName || undefined,
      mobile_number: form.mobile || undefined,
    });
    setLoading(false);
    if (!tokenValid(token)) return;
    if (error) { setErrs({ email: error.message }); return; }
    setRegSuccess(true); regResend.start();
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { setErrs({ email: "Email is required." }); return; }
    if (!isValidEmail(email)) { setErrs({ email: "Enter a valid email address." }); return; }
    if (forgotLimit.isLimited()) { setErrs({ email: `Too many attempts. Try again in ${forgotLimit.secondsLeft()}s.` }); return; }
    const token = makeToken();
    setLoading(true); forgotLimit.record();
    await api.forgotPassword(email);
    setLoading(false);
    if (!tokenValid(token)) return;
    setForgotSuccess(true); forgotResend.start();
  };

  const handleResendActivation = async () => {
    if (!activationResend.ready || loading) return;
    const token = makeToken();
    setLoading(true);
    await api.resendActivation(email).catch(() => {});
    setLoading(false);
    if (tokenValid(token)) activationResend.start();
  };

  const handleResendReg = async () => {
    if (!regResend.ready || loading) return;
    const token = makeToken();
    setLoading(true);
    await api.registerUser(email, { first_name: form.firstName, last_name: form.lastName });
    setLoading(false);
    if (tokenValid(token)) regResend.start();
  };

  const handleResendForgot = async () => {
    if (!forgotResend.ready || loading) return;
    const token = makeToken();
    setLoading(true);
    await api.forgotPassword(email);
    setLoading(false);
    if (tokenValid(token)) forgotResend.start();
  };

  const ModalHeader = () => (
    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
      <div className="flex items-center">
        <LogoWordmark className="h-6 w-auto" />
      </div>
      <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-black" aria-label="Close"><X size={16} /></button>
    </div>
  );

  const handleResetPwSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetToken) return;
    if (!resetPwForm.newPw || resetPwForm.newPw.length < 8) { setErrs({ newPw: "Password must be at least 8 characters." }); return; }
    if (resetPwForm.newPw !== resetPwForm.confirm) { setErrs({ newPw: "Passwords do not match." }); return; }
    setLoading(true);
    const { error } = await api.resetPassword(resetToken, resetPwForm.newPw);
    setLoading(false);
    if (error) { setErrs({ newPw: error.message }); return; }
    setResetDone(true);
  };

  const SubmitBtn = ({ label, blocked }: { label: string; blocked?: boolean }) => (
    <button type="submit" disabled={loading || blocked}
      className="w-full py-3.5 text-[15px] font-semibold th-btn-primary rounded-xl active:scale-[0.99] transition-all mt-1 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
      {loading && <LoadingDots size="sm" />}
      {label}
    </button>
  );

  const ResendBtn = ({ ready, secs, onClick, label = "Resend email" }: { ready: boolean; secs: number; onClick: () => void; label?: string }) => (
    <button type="button" onClick={onClick} disabled={!ready || loading}
      className="w-full mt-3 py-2.5 text-[13px] font-medium border border-gray-200 rounded-xl text-gray-500 hover:text-black hover:border-gray-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5">
      {loading && <LoadingDots size="xs" />}
      {ready ? label : `Resend in ${secs}s`}
    </button>
  );

  return (
    <div ref={overlayRef} onClick={e => { if (e.target === overlayRef.current) onClose(); }}
      className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-8 pb-8 bg-black/50 backdrop-blur-sm overflow-y-auto" aria-modal="true" role="dialog">
      <style>{`@keyframes modalIn{from{opacity:0;transform:scale(0.96) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}`}</style>
      <div className={`w-full ${MODAL_WIDTH} bg-white rounded-2xl shadow-2xl shadow-black/20 overflow-hidden my-auto`}
        style={{ animation: "modalIn 0.18s cubic-bezier(0.16,1,0.3,1)" }}>
        <ModalHeader />
        <div className="px-6 py-5">
          {step === "email" && accountStatus === "pending" && (
            <>
              <h2 className="text-[22px] font-bold tracking-tight text-black mb-1">Account pending</h2>
              <p className="text-[14px] text-gray-500 leading-relaxed mb-1">
                <span className="font-semibold text-black">{email}</span> is registered but not yet activated.
              </p>
              <p className="text-[13px] text-gray-400 mb-6">Check your inbox for the setup email, or request a new link below.</p>
              <ResendBtn
                ready={activationResend.ready}
                secs={activationResend.secs}
                onClick={handleResendActivation}
                label="Resend"
              />
              <button onClick={() => { setAccountStatus(null); setErrs({}); }} className="w-full mt-3 text-[13px] text-gray-400 hover:text-black transition-colors">
                Use a different email
              </button>
            </>
          )}

          {step === "email" && accountStatus === "disabled" && (
            <>
              <h2 className="text-[22px] font-bold tracking-tight text-black mb-1">Account suspended</h2>
              <p className="text-[14px] text-gray-500 leading-relaxed mb-1">
                The account for <span className="font-semibold text-black">{email}</span> has been suspended.
              </p>
              <p className="text-[13px] text-gray-400 mb-6">If you believe this is a mistake, please reach out to our support team.</p>
              <a href="mailto:hello@eduhubph.tech"
                className="w-full py-3.5 text-[15px] font-semibold rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2">
                Contact Support
              </a>
              <button onClick={() => { setAccountStatus(null); setErrs({}); }} className="w-full mt-3 text-[13px] text-gray-400 hover:text-black transition-colors">
                Use a different email
              </button>
            </>
          )}

          {step === "email" && !accountStatus && (
            <>
              <h2 className="text-[22px] font-bold tracking-tight text-black mb-1">Sign in to EduHub PH</h2>
              <p className="text-[14px] text-gray-500 leading-relaxed mb-6">Enter your email to continue. New users will be prompted to create an account.</p>
              <form onSubmit={handleEmailSubmit} className="space-y-4" noValidate>
                <InputField label="Email address" type="email" value={email} onChange={v => { setEmail(v); clearErr("email")(); setAccountStatus(null); }} placeholder="you@example.com" error={errs.email} />
                <SubmitBtn label="Continue" />
              </form>
              <p className="text-center text-[13px] text-gray-400 mt-5">No account yet?{" "}<button onClick={() => { setErrs({}); setStep("register"); }} className="text-black font-semibold hover:underline text-sm">Create one</button></p>
            </>
          )}
          {step === "login" && (
            <>
              <BackButton onClick={() => { setErrs({}); setAccountStatus(null); setStep("email"); }} className="mb-5" />
              <h2 className="text-[22px] font-bold tracking-tight text-black mb-1">Welcome back</h2>
              <p className="text-[14px] text-gray-500 leading-relaxed mb-6">Enter your password to sign in.</p>
              <form onSubmit={handleLoginSubmit} className="space-y-4" noValidate>
                <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl">
                  <div className="w-7 h-7 rounded-full th-bg text-[13px] font-bold flex items-center justify-center flex-none">{email[0]?.toUpperCase() || "?"}</div>
                  <span className="text-[14px] text-gray-600 truncate flex-1">{email}</span>
                </div>
                <InputField label="Password" value={password} onChange={v => { setPassword(v); clearErr("password")(); }} placeholder="Enter your password"
                  showToggle isPasswordVisible={showPass} onToggle={() => setShowPass(s => !s)} error={errs.password} />
                <div className="flex justify-end"><button type="button" onClick={() => { setErrs({}); setForgotSuccess(false); setStep("forgot"); }} className="text-[13px] font-medium text-gray-400 hover:text-black transition-colors">Forgot password?</button></div>
                <SubmitBtn label="Login" blocked={loginLimit.isLimited()} />
              </form>
            </>
          )}
          {step === "forgot" && resetToken && (
            <>
              {resetDone ? (
                <div className="py-4 text-center">
                  <div className="w-12 h-12 rounded-full th-bg flex items-center justify-center mx-auto mb-5"><Check size={20} /></div>
                  <h2 className="text-[22px] font-bold tracking-tight mb-2">{resetTokenType === "registration" ? "Account ready!" : "Password updated!"}</h2>
                  <p className="text-[14px] text-gray-500 mb-6">{resetTokenType === "registration" ? "Your account is set up. You can now sign in." : "Your password has been updated. You can now sign in."}</p>
                  <button onClick={() => { setStep("email"); setResetDone(false); setEmail(""); }} className="w-full py-3.5 text-[15px] font-semibold th-btn-primary rounded-xl">Sign In</button>
                </div>
              ) : (
                <>
                  <BackButton onClick={onClose} className="mb-5" />
                  <h2 className="text-[22px] font-bold tracking-tight text-black mb-1">
                    {resetTokenType === "registration" ? "Set up your account" : "Set your password"}
                  </h2>
                  <p className="text-[14px] text-gray-500 leading-relaxed mb-6">
                    {resetTokenType === "registration"
                      ? "Welcome to EduHub PH! Choose a password to complete your account setup."
                      : "Choose a new password for your account."}
                  </p>
                  <form onSubmit={handleResetPwSubmit} className="space-y-4" noValidate>
                    <InputField label="New Password" type="password" value={resetPwForm.newPw} onChange={v => { setResetPwForm(f => ({ ...f, newPw: v })); setErrs({}); }} placeholder="At least 8 characters" error={errs.newPw} showToggle isPasswordVisible={showPass} onToggle={() => setShowPass(s => !s)} />
                    <InputField label="Confirm Password" type="password" value={resetPwForm.confirm} onChange={v => { setResetPwForm(f => ({ ...f, confirm: v })); setErrs({}); }} placeholder="Repeat password" showToggle isPasswordVisible={showPass} onToggle={() => setShowPass(s => !s)} />
                    <SubmitBtn label={resetTokenType === "registration" ? "Create Password" : "Set Password"} />
                  </form>
                </>
              )}
            </>
          )}
          {step === "forgot" && !resetToken && (
            <>
              <BackButton onClick={() => { setErrs({}); setForgotSuccess(false); setStep("login"); }} className="mb-5" />
              {tokenExpired && !forgotSuccess && (
                <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5">
                  <p className="text-[13px] font-semibold text-amber-800 mb-0.5">
                    {tokenExpired.type === "registration" ? "Your account setup link has expired" : "Your reset link has expired"}
                  </p>
                  <p className="text-[12px] text-amber-700 leading-relaxed">
                    {tokenExpired.type === "registration"
                      ? "Your account is pending — but the 24-hour setup link in your email has expired. Enter your email below to receive a new link."
                      : "Your password reset link is no longer valid. Enter your email below to receive a new one."}
                  </p>
                </div>
              )}
              {forgotSuccess ? (
                <div className="py-4">
                  <div className="w-12 h-12 rounded-full bg-black flex items-center justify-center mx-auto mb-5">
                    <Check size={20} className="text-white" />
                  </div>
                  <h2 className="text-[22px] font-bold tracking-tight text-black text-center mb-2">Email sent</h2>
                  <p className="text-[14px] text-gray-500 text-center leading-relaxed mb-1">We sent a password reset link to</p>
                  <p className="text-[14px] font-semibold text-black text-center mb-6 break-all">{email}</p>
                  <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-[13px] text-gray-500 text-center leading-relaxed">
                    Click the link in the email to reset your password. Check your spam folder if you don&apos;t see it.
                  </div>
                  <ResendBtn ready={forgotResend.ready} secs={forgotResend.secs} onClick={handleResendForgot} />
                  <button onClick={onClose} className="w-full mt-2 py-2.5 text-[13px] font-medium text-gray-400 hover:text-black transition-colors">Close</button>
                </div>
              ) : (
                <>
                  <h2 className="text-[22px] font-bold tracking-tight text-black mb-1">Reset your password</h2>
                  <p className="text-[14px] text-gray-500 leading-relaxed mb-6">Enter your email and we&apos;ll send you a link to reset your password.</p>
                  <form onSubmit={handleForgotSubmit} className="space-y-4" noValidate>
                    <InputField label="Email address" type="email" value={email} onChange={v => { setEmail(v); clearErr("email")(); }} placeholder="you@example.com" error={errs.email} />
                    <SubmitBtn label="Send reset link" blocked={forgotLimit.isLimited()} />
                  </form>
                  <p className="text-center text-[13px] text-gray-400 mt-5">
                    Remember it?{" "}
                    <button onClick={() => { setErrs({}); setStep("login"); }} className="text-black font-semibold hover:underline text-sm">Sign in</button>
                  </p>
                </>
              )}
            </>
          )}
          {step === "register" && (
            <>
              {!regSuccess && (
                <BackButton onClick={() => { setErrs({}); setStep("email"); }} className="mb-5" />
              )}

              {regSuccess ? (
                /* ── Success state ── */
                <div className="py-4">
                  <div className="w-12 h-12 rounded-full bg-black flex items-center justify-center mx-auto mb-5">
                    <Check size={20} className="text-white" />
                  </div>
                  <h2 className="text-[22px] font-bold tracking-tight text-black text-center mb-2">Check your inbox</h2>
                  <p className="text-[14px] text-gray-500 text-center leading-relaxed mb-1">
                    We sent a password setup link to
                  </p>
                  <p className="text-[14px] font-semibold text-black text-center mb-6 break-all">{email}</p>
                  <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-[13px] text-gray-500 text-center leading-relaxed">
                    Click the link in the email to set your password and activate your account. Check your spam folder if you don&apos;t see it.
                  </div>
                  <ResendBtn ready={regResend.ready} secs={regResend.secs} onClick={handleResendReg} label="Resend setup email" />
                  <button onClick={onClose} className="w-full mt-2 py-2.5 text-[13px] font-medium text-gray-400 hover:text-black transition-colors">Close</button>
                </div>
              ) : (
                /* ── Register form ── */
                <>
                  <h2 className="text-[22px] font-bold tracking-tight text-black mb-1">Create your account</h2>
                  <p className="text-[14px] text-gray-500 leading-relaxed mb-4">
                    Enter your details — we&apos;ll email you a link to set your password.
                  </p>
                  <form onSubmit={handleRegisterSubmit} className="space-y-3" noValidate>
                    <div className="grid grid-cols-2 gap-3">
                      <InputField label="First Name" value={form.firstName} onChange={setF("firstName")} placeholder="Maria" error={errs.firstName} />
                      <InputField label="Last Name" value={form.lastName} onChange={setF("lastName")} placeholder="Santos" error={errs.lastName} />
                    </div>
                    <div>
                      <InputField label="Middle Name" value={form.middleName} onChange={setF("middleName")} placeholder="Optional" disabled={form.noMiddleName} />
                      <label className="flex items-center gap-2 mt-1.5 cursor-pointer select-none">
                        <input type="checkbox" checked={form.noMiddleName} onChange={e => setForm(f => ({ ...f, noMiddleName: e.target.checked, middleName: "" }))} className="w-3.5 h-3.5 rounded accent-black" />
                        <span className="text-[12px] text-gray-400">I don&apos;t have a middle name</span>
                      </label>
                    </div>
                    <PhoneField value={form.mobile} onChange={setF("mobile")} error={errs.mobile} />
                    <InputField label="Email Address" type="email" value={email} onChange={v => { setEmail(v); clearErr("email")(); }} placeholder="you@example.com" error={errs.email} />
                    <SubmitBtn label="Create Account" blocked={registerLimit.isLimited()} />
                  </form>
                  <p className="text-center text-[13px] text-gray-400 mt-4">
                    Already have an account?{" "}
                    <button onClick={() => { setErrs({}); setStep("email"); }} className="text-black font-semibold hover:underline">Sign in</button>
                  </p>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── HOME PAGE ────────────────────────────────────────────────────────────────

function HomePage({ setPage, setSelectedSlug, savedIds, onSave, role }: {
  setPage: (p: Page) => void; setSelectedSlug: (s: string) => void;
  savedIds: Set<number>; onSave: (id: number) => void; role: Role;
}) {
  const [q, setQ] = useState("");
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getPosts({ status: "published" }).then(res => {
      setPosts(res.data);
      setLoading(false);
    });
  }, []);

  const onRead = (id: number) => {
    const p = posts.find(x => x.id === id);
    if (p) { setSelectedSlug(p.slug); setPage("post-detail"); }
  };

  const latestOpps = posts.filter(p => p.type === "opportunity").slice(0, 3);
  const featReviewers = posts.filter(p => p.categories?.slug === "reviewer" && p.is_featured).slice(0, 2);
  const featModules = posts.filter(p => p.categories?.slug === "module" && p.is_featured).slice(0, 2);
  const announcements = posts.filter(p => p.categories?.slug === "announcement").slice(0, 2);

  const handleSearch = () => { setPage("resources"); };

  const QUICK_CATS = [
    { label: "Reviewers", icon: BookOpen, page: "resources" as Page },
    { label: "Modules", icon: FileText, page: "resources" as Page },
    { label: "Scholarships", icon: Award, page: "opportunities" as Page },
  ];

  return (
    <div>
      <section className="bg-white py-10 md:py-14 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          <p className="text-base text-[#080b4a] max-w-xl leading-relaxed mb-5 font-semibold">Find educational resources, reviewers, modules, scholarships, and college application opportunities in one place.</p>
          <div className="flex flex-row gap-2.5 mb-4">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSearch()} placeholder="Search title or keyword…"
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-black bg-gray-50 focus:bg-white transition-colors" />
            </div>
            <Btn onClick={handleSearch} size="sm" className="!rounded-xl !px-4 !py-2 whitespace-nowrap shrink-0">Search</Btn>
          </div>
          <div className="flex items-center gap-2">
            {QUICK_CATS.map(({ label, icon: Icon, page: dest }) => (
              <button key={label} onClick={() => setPage(dest)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-gray-200 bg-gray-50 hover:bg-black hover:text-white hover:border-black text-sm font-medium text-gray-700 transition-colors">
                <Icon size={13} />{label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Ad: homepage leaderboard — below hero, above feed */}
      <div className="bg-white py-4 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <GoogleAd slot={AD_SLOTS.HOME_LEADERBOARD} variant="display" />
        </div>
      </div>

      {[
        { title: "Latest Opportunities", posts: latestOpps, nav: "opportunities" as Page, cols: 3, adAfter: false },
        { title: "Featured Reviewers", posts: featReviewers, nav: "resources" as Page, cols: 2, adAfter: true },
        { title: "Featured Modules", posts: featModules, nav: "resources" as Page, cols: 2, adAfter: false },
        { title: "Latest Announcements", posts: announcements, nav: null, cols: 2, adAfter: false },
      ].map((section, si) => (
        <div key={section.title}>
          <section className={`${si % 2 === 0 ? "bg-gray-50" : "bg-white"} py-14 px-4 sm:px-6`}>
          <div className="max-w-6xl mx-auto">
            <SectionHeader title={section.title} onViewAll={section.nav ? () => setPage(section.nav!) : undefined} />
            {loading
              ? <div className={section.cols === 3 ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" : "grid grid-cols-1 sm:grid-cols-2 gap-4"}>{Array.from({ length: section.cols }).map((_, i) => <CardSkeleton key={i} />)}</div>
              : section.posts.length === 0
                ? <p className="text-sm text-gray-400">Nothing here yet — check back soon.</p>
                : <div className={section.cols === 3 ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" : "grid grid-cols-1 sm:grid-cols-2 gap-4"}>
                  {section.posts.map(p => <PostCard key={p.id} post={p} isSaved={savedIds.has(p.id)} onSave={onSave} onRead={onRead} role={role} />)}
                </div>
            }
          </div>
          </section>
          {section.adAfter && (
            <div className="bg-white py-6 px-4 sm:px-6">
              <div className="max-w-6xl mx-auto">
                <GoogleAd slot={AD_SLOTS.HOME_MID} variant="display" />
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── POSTS LIST PAGE ──────────────────────────────────────────────────────────

// Category icon map — keyed by slug, fallback to Tag icon
const CAT_ICONS: Record<string, React.ElementType> = {
  reviewer: BookOpen,
  module: FileText,
  scholarship: Award,
  "study-guide": BookOpen,
  "scholarship-guide": Award,
  "college-application": Star,
  announcement: MessageSquare,
};

function CategoryDropdown({ cats, value, onChange }: {
  cats: Category[]; value: string; onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = cats.find(c => String(c.id) === value);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const Icon = selected ? (CAT_ICONS[selected.slug] ?? Tag) : List;

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-2 px-3.5 py-2 rounded-lg border text-sm font-medium transition-all
          ${open || value ? "th-bg border-transparent" : "bg-white text-gray-700 border-gray-200 hover:border-gray-400"}`}>
        <Icon size={14} />
        <span>{selected ? selected.name : "Categories"}</span>
        <ChevronDown size={13} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1.5 w-52 bg-white border border-gray-200 rounded-xl shadow-lg shadow-black/8 z-20 overflow-hidden py-1">
          <button onClick={() => { onChange(""); setOpen(false); }}
            className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm transition-colors text-left
              ${!value ? "th-bg font-medium" : "text-gray-600 hover:bg-gray-50"}`}>
            <List size={14} />
            All Categories
          </button>
          <div className="h-px bg-gray-100 mx-3 my-1" />
          {cats.map(c => {
            const CIcon = CAT_ICONS[c.slug] ?? Tag;
            const active = String(c.id) === value;
            return (
              <button key={c.id} onClick={() => { onChange(String(c.id)); setOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm transition-colors text-left
                  ${active ? "th-bg font-medium" : "text-gray-600 hover:bg-gray-50"}`}>
                <CIcon size={14} />
                {c.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PostsListPage({ title, typeFilter, setPage, setSelectedSlug, savedIds, onSave, role }: {
  title: string; typeFilter: "resource" | "opportunity";
  setPage: (p: Page) => void; setSelectedSlug: (s: string) => void;
  savedIds: Set<number>; onSave: (id: number) => void; role: Role;
}) {
  const [q, setQ] = useState(""); const [cat, setCat] = useState(""); const [sort, setSort] = useState("latest");
  const [posts, setPosts] = useState<Post[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.getPosts({ type: typeFilter, status: "published", search: q || undefined, category_id: cat ? Number(cat) : undefined }),
      api.getCategories(true),
    ]).then(([postsRes, catsRes]) => {
      let sorted = [...postsRes.data];
      if (sort === "oldest") sorted.sort((a, b) => new Date(a.published_at ?? 0).getTime() - new Date(b.published_at ?? 0).getTime());
      else if (sort === "featured") sorted.sort((a, b) => (b.is_featured ? 1 : 0) - (a.is_featured ? 1 : 0));
      setPosts(sorted);
      setCats(catsRes.filter(c => c.type === typeFilter));
      setLoading(false);
    });
  }, [typeFilter, q, cat, sort]);

  const onRead = (id: number) => {
    const p = posts.find(x => x.id === id);
    if (p) { setSelectedSlug(p.slug); setPage("post-detail"); }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight mb-1">{title}</h1>
      </div>

      {/* Ad: top of list page */}
      <GoogleAd slot={AD_SLOTS.RESOURCES_TOP} variant="display" className="mb-6" />

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 mb-8">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search…"
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:border-black transition-colors" />
        </div>
        <CategoryDropdown cats={cats} value={cat} onChange={setCat} />
        <select value={sort} onChange={e => setSort(e.target.value)}
          className="appearance-none px-3.5 py-2 border border-gray-200 rounded-lg text-sm bg-white text-gray-700 font-medium focus:outline-none focus:border-black cursor-pointer hover:border-gray-400 transition-colors">
          <option value="latest">Latest</option>
          <option value="oldest">Oldest</option>
          <option value="featured">Featured first</option>
        </select>
        {cat && (
          <button onClick={() => setCat("")} className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-500 hover:text-black transition-colors">
            <X size={13} /> Clear
          </button>
        )}
      </div>

      {loading
        ? <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}</div>
        : posts.length === 0
          ? <EmptyState icon={<Search size={24} />} title="No results found" desc="Try adjusting your search or filters." />
          : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{posts.map(p => <PostCard key={p.id} post={p} isSaved={savedIds.has(p.id)} onSave={onSave} onRead={onRead} role={role} />)}</div>
      }
    </div>
  );
}

// ─── POST DETAIL ──────────────────────────────────────────────────────────────

function PostDetailPage({ slug, setPage, savedIds, onSave, role }: {
  slug: string; setPage: (p: Page) => void; savedIds: Set<number>; onSave: (id: number) => void; role: Role;
}) {
  const [post, setPost] = useState<Post | null>(null);
  const [related, setRelated] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getPostBySlug(slug).then(async p => {
      setPost(p);
      if (p?.category_id) {
        const { data } = await api.getPosts({ category_id: p.category_id, status: "published" });
        setRelated(data.filter(r => r.id !== p.id).slice(0, 2));
      }
      setLoading(false);
    });
  }, [slug]);

  if (loading) return <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-4"><Skeleton className="h-8 w-3/4" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-2/3" /></div>;
  if (!post) return <div className="max-w-3xl mx-auto px-4 py-20 text-center text-gray-400">Post not found.</div>;

  const isSaved = savedIds.has(post.id);
  const renderContent = (text: string) => text.split("\n").map((line, i) => {
    if (!line.trim()) return <div key={i} className="h-3" />;
    if (line.startsWith("•")) return <p key={i} className="text-gray-700 text-[15px] leading-relaxed pl-4 flex gap-2"><span className="flex-none mt-2 w-1 h-1 rounded-full bg-gray-400 inline-block" /><span>{renderTextWithLinks(line.slice(1).trim())}</span></p>;
    if (line.match(/^\d+\./)) return <p key={i} className="text-gray-700 text-[15px] leading-relaxed pl-4">{renderTextWithLinks(line)}</p>;
    if (line.endsWith(":")) return <p key={i} className="font-semibold text-black text-[15px] mt-4 mb-1">{line}</p>;
    return <p key={i} className="text-gray-700 text-[15px] leading-relaxed">{renderTextWithLinks(line)}</p>;
  });

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <BackButton onClick={() => setPage("home")} className="mb-8" />
      <div className="flex flex-wrap items-center gap-2 mb-5">
        {post.categories && <Pill label={post.categories.name} dark />}
        {post.subjects && <Pill label={post.subjects.name} />}
      </div>
      <h1 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight mb-4">{post.title}</h1>
      <div className="flex items-center justify-between mb-8 pb-8 border-b border-gray-100">
        <p className="text-sm text-gray-400">Published {fmtDate(post.published_at)}</p>
        {role === "user" && <button onClick={() => onSave(post.id)} className="flex items-center gap-2 text-sm font-medium px-3 py-1.5 border border-gray-200 rounded-lg hover:border-black transition-colors">{isSaved ? <><BookmarkCheck size={14} className="text-black" /> Saved</> : <><Bookmark size={14} /> Save</>}</button>}
      </div>
      <p className="text-base text-gray-600 leading-relaxed mb-8 font-medium italic border-l-2 border-gray-200 pl-4">{post.excerpt}</p>
      <div className="space-y-1.5">
        {(() => {
          const lines = renderContent(post.content ?? "");
          const mid = Math.min(3, Math.floor(lines.length / 2));
          return <>
            {lines.slice(0, mid)}
            {lines.length > 3 && <GoogleAd slot={AD_SLOTS.POST_INLINE} variant="in-article" className="my-6" />}
            {lines.slice(mid)}
          </>;
        })()}
      </div>
      {related.length > 0 && (
        <div className="mt-14 pt-10 border-t border-gray-100">
          <SectionHeader title="Related Posts" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{related.map(p => <PostCard key={p.id} post={p} isSaved={savedIds.has(p.id)} onSave={onSave} onRead={() => {}} role={role} />)}</div>
        </div>
      )}
    </div>
  );
}

// ─── ABOUT PAGE ───────────────────────────────────────────────────────────────

function AboutPage({ setPage }: { setPage: (p: Page) => void }) {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      <BackButton onClick={() => setPage("home")} className="mb-8" />

      <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">About EduHubPH</h1>
      <p className="text-base text-gray-500 leading-relaxed mb-10">A free educational platform built for Filipino students.</p>

      <div className="space-y-8 text-gray-700 leading-relaxed">
        <section>
          <h2 className="text-xl font-bold tracking-tight text-black mb-3">What is EduHubPH?</h2>
          <p className="text-[15px] leading-relaxed">
            EduHubPH is a free online platform designed to help Filipino students access high-quality educational resources,
            including study reviewers, learning modules, and scholarship opportunities — all in one place.
            Our goal is to make quality education more accessible to every student across the Philippines,
            regardless of location or economic background.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold tracking-tight text-black mb-3">Our Mission</h2>
          <p className="text-[15px] leading-relaxed">
            We believe every Filipino student deserves access to learning materials that prepare them for board exams,
            college entrance tests, and professional licensure examinations. EduHubPH curates and organizes these
            resources so students spend less time searching and more time learning.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold tracking-tight text-black mb-3">What We Offer</h2>
          <ul className="list-disc pl-5 space-y-2 text-[15px]">
            <li><span className="font-semibold">Reviewers</span> — Curated study guides and practice materials for board and entrance exams.</li>
            <li><span className="font-semibold">Modules</span> — Learning modules across various subjects and grade levels.</li>
            <li><span className="font-semibold">Scholarships</span> — Up-to-date information on scholarship programs and opportunities.</li>
            <li><span className="font-semibold">Free access</span> — All content is freely available. No paywalls, no subscriptions.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold tracking-tight text-black mb-3">Who Runs EduHubPH?</h2>
          <p className="text-[15px] leading-relaxed">
            EduHubPH is an independent project operated by a Filipino developer passionate about education technology.
            The platform is community-oriented and not affiliated with any government agency, school, or institution.
          </p>
          <p className="text-[15px] leading-relaxed mt-3">
            The site is supported by Google AdSense advertising. Revenue from ads helps cover server costs and keeps the
            platform free for everyone. We do not sell user data.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold tracking-tight text-black mb-3">Contact Us</h2>
          <p className="text-[15px] leading-relaxed">
            Have a suggestion, resource to share, or a concern? We welcome your feedback.
          </p>
          <button onClick={() => setPage("feedback")}
            className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 th-btn-primary text-sm font-semibold rounded-xl">
            Send us a message
          </button>
        </section>
      </div>
    </div>
  );
}

// ─── FEEDBACK PAGE ────────────────────────────────────────────────────────────

function FeedbackPage() {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitErr, setSubmitErr] = useState("");
  const clearErr = (k: string) => (v: string) => { setForm(f => ({ ...f, [k]: v })); setErrs(e => ({ ...e, [k]: "" })); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitErr("");
    const e2: Record<string, string> = {};
    if (!form.name.trim()) e2.name = "Name is required.";
    if (!form.email.trim()) e2.email = "Email is required.";
    else if (!isValidEmail(form.email)) e2.email = "Enter a valid email address.";
    if (!form.subject.trim()) e2.subject = "Subject is required.";
    if (!form.message.trim()) e2.message = "Message is required.";
    if (Object.keys(e2).length) { setErrs(e2); return; }
    setLoading(true);
    const { error } = await api.submitFeedback(form);
    setLoading(false);
    if (error) {
      setSubmitErr(error.message.includes("Too many") ? "You've sent too many messages recently. Please wait an hour and try again." : error.message || "Something went wrong. Please try again.");
      return;
    }
    setSubmitted(true);
  };

  if (submitted) return (
    <div className="max-w-lg mx-auto px-4 py-20 text-center">
      <div className="w-14 h-14 rounded-full th-bg flex items-center justify-center mx-auto mb-6"><Check size={24} /></div>
      <h2 className="text-2xl font-bold mb-2">Thank you for your feedback!</h2>
      <p className="text-gray-500 text-sm">We've received your message and will review it shortly.</p>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-8"><h1 className="text-3xl font-bold tracking-tight mb-1">Feedback</h1><p className="text-gray-500 text-sm">Share your thoughts, suggestions, or questions with us.</p></div>
      <form onSubmit={handleSubmit} noValidate className="bg-white border border-black/[0.08] rounded-2xl p-6 sm:p-8 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <InputField label="Name" value={form.name} onChange={clearErr("name")} placeholder="Your full name" error={errs.name} />
          <InputField label="Email" type="email" value={form.email} onChange={clearErr("email")} placeholder="your@email.com" error={errs.email} />
        </div>
        <InputField label="Subject" value={form.subject} onChange={clearErr("subject")} placeholder="What is this about?" error={errs.subject} />
        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-semibold text-gray-500 tracking-[0.06em] uppercase">Message</label>
          <textarea value={form.message} onChange={e => { setForm(f => ({ ...f, message: e.target.value })); setErrs(x => ({ ...x, message: "" })); }}
            placeholder="Write your message here…" rows={5}
            className={`w-full px-4 py-3 text-[15px] bg-gray-50 border rounded-xl focus:outline-none focus:bg-white transition-all resize-none placeholder:text-gray-400 ${errs.message ? "border-red-400 bg-red-50/30 focus:border-red-500" : "border-gray-200 focus:border-black"}`} />
          {errs.message && <p className="flex items-center gap-1.5 text-[12px] text-red-500 font-medium"><AlertCircle size={12} className="flex-none" /> {errs.message}</p>}
        </div>
        {submitErr && (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
            <AlertCircle size={15} className="flex-none mt-0.5" /> {submitErr}
          </div>
        )}
        <button type="submit" disabled={loading}
          className="w-full py-3.5 text-[15px] font-semibold th-btn-primary rounded-xl transition-all disabled:opacity-60 flex items-center justify-center gap-2">
          {loading && <LoadingDots size="sm" />} Submit Feedback
        </button>
      </form>
    </div>
  );
}

// ─── SAVED POSTS ──────────────────────────────────────────────────────────────

function SavedPostsPage({ setPage, setSelectedSlug, userId, savedIds, onSave, role }: {
  setPage: (p: Page) => void; setSelectedSlug: (s: string) => void;
  userId: string | null; savedIds: Set<number>; onSave: (id: number) => void; role: Role;
}) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    api.getSavedPosts(userId).then(p => { setPosts(p); setLoading(false); });
  }, [userId, savedIds]);

  const onRead = (id: number) => {
    const p = posts.find(x => x.id === id);
    if (p) { setSelectedSlug(p.slug); setPage("post-detail"); }
  };

  const filtered = posts.filter(p => !q || p.title.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-8"><h1 className="text-3xl font-bold tracking-tight mb-1">Saved Posts</h1><p className="text-gray-500 text-sm">{loading ? "Loading…" : `${posts.length} saved post${posts.length !== 1 ? "s" : ""}`}</p></div>
      {!loading && posts.length > 0 && <div className="relative mb-8 max-w-sm"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search saved posts…" className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:border-black transition-colors" /></div>}
      {loading ? <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)}</div>
        : filtered.length === 0
          ? <EmptyState icon={<Bookmark size={24} />} title={posts.length === 0 ? "No saved posts yet" : "No results"} desc={posts.length === 0 ? "Browse posts and tap the bookmark icon to save them here." : "Try a different search term."} action={posts.length === 0 ? <Btn onClick={() => setPage("resources")}>Browse Resources</Btn> : undefined} />
          : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{filtered.map(p => <PostCard key={p.id} post={p} isSaved={true} onSave={onSave} onRead={onRead} role={role} />)}</div>
      }
    </div>
  );
}

// ─── USER PROFILE ─────────────────────────────────────────────────────────────

function UserProfilePage({ userId }: { userId: string | null }) {
  const [form, setForm] = useState({ firstName: "", lastName: "", middleName: "", mobile: "", email: "" });
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    const storedUser = getStoredUser();
    api.getProfile(userId).then(p => {
      if (p) setForm({ firstName: p.first_name, lastName: p.last_name, middleName: p.middle_name ?? "", mobile: p.mobile_number ?? "", email: p.email ?? storedUser?.email ?? "" });
      setLoading(false);
    });
  }, [userId]);

  const set = (k: string) => (v: string) => { setForm(f => ({ ...f, [k]: v })); setSaved(false); };

  const handleSave = async () => {
    if (!userId) return;
    await api.updateProfile(userId, { first_name: form.firstName, last_name: form.lastName, middle_name: form.middleName, mobile_number: form.mobile });
    setSaved(true);
  };

  if (loading) return <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 space-y-4"><Skeleton className="h-8 w-1/3" /><Skeleton className="h-48 w-full" /></div>;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="text-3xl font-bold tracking-tight mb-8">Profile</h1>
      <div className="bg-white border border-black/[0.08] rounded-2xl p-6 sm:p-8">
        <div className="flex items-center gap-4 mb-8 pb-8 border-b border-gray-100">
          <div className="w-16 h-16 rounded-2xl th-bg flex items-center justify-center text-2xl font-bold flex-none">{form.firstName[0]?.toUpperCase() ?? "U"}</div>
          <div><p className="font-bold text-lg">{form.firstName} {form.lastName}</p><p className="text-sm text-gray-500">{form.email}</p><Pill label="User" /></div>
        </div>
        {saved && <div className="flex items-center gap-2 p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 mb-5"><Check size={14} className="text-black" /> Profile updated successfully.</div>}
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputField label="First Name" value={form.firstName} onChange={set("firstName")} />
            <InputField label="Last Name" value={form.lastName} onChange={set("lastName")} />
          </div>
          <InputField label="Middle Name" value={form.middleName} onChange={set("middleName")} />
          <PhoneField value={form.mobile} onChange={set("mobile")} />
          <InputField label="Email Address" type="email" value={form.email} onChange={set("email")} disabled />
          <Btn onClick={handleSave} size="lg">Save Changes</Btn>
        </div>
      </div>
    </div>
  );
}

function AccountSettingsPage({ theme, setTheme }: { theme: ThemeId; setTheme: (id: ThemeId) => void }) {
  const [pwForm, setPwForm] = useState({ newPw: "", confirm: "" });
  const [showPw, setShowPw] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [msg, setMsg] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const setP = (k: string) => (v: string) => { setPwForm(f => ({ ...f, [k]: v })); setMsg(""); };

  const handleUpdatePw = async () => {
    if (!pwForm.newPw || pwForm.newPw.length < 8) { setMsg("Password must be at least 8 characters."); return; }
    if (pwForm.newPw !== pwForm.confirm) { setMsg("Passwords do not match."); return; }
    setPwLoading(true);
    const { error } = await api.changePassword(pwForm.newPw);
    setPwLoading(false);
    if (error) { setMsg(error.message); return; }
    setMsg("Password updated successfully.");
    setPwForm({ newPw: "", confirm: "" });
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="text-3xl font-bold tracking-tight mb-8">Account Settings</h1>
      <div className="space-y-6">
        <ThemePicker theme={theme} setTheme={setTheme} />
        <div className="bg-white border border-black/[0.08] rounded-2xl p-6 sm:p-8">
          <h2 className="text-lg font-bold mb-6">Change Password</h2>
          {msg && <p className={`text-sm mb-4 p-3 rounded-lg ${msg.includes("success") ? "bg-gray-50 text-gray-700" : "bg-red-50 text-red-600"}`}>{msg}</p>}
          <div className="space-y-4">
            <InputField label="New Password" value={pwForm.newPw} onChange={setP("newPw")} placeholder="At least 8 characters" showToggle isPasswordVisible={showPw} onToggle={() => setShowPw(s => !s)} />
            <InputField label="Confirm New Password" value={pwForm.confirm} onChange={setP("confirm")} placeholder="Repeat new password" showToggle isPasswordVisible={showPw} onToggle={() => setShowPw(s => !s)} />
            <Btn size="lg" onClick={handleUpdatePw} disabled={pwLoading}>{pwLoading ? <><LoadingDots size="xs" /> Updating…</> : "Update Password"}</Btn>
          </div>
        </div>
        <div className="bg-white border border-red-100 rounded-2xl p-6 sm:p-8">
          <h2 className="text-lg font-bold mb-2 text-red-600">Danger Zone</h2>
          <p className="text-sm text-gray-500 mb-5">Once you delete your account, all your data will be permanently removed.</p>
          {!showDelete
            ? <Btn variant="danger" onClick={() => setShowDelete(true)}>Delete Account</Btn>
            : <div className="space-y-3 p-4 border border-red-200 rounded-xl bg-red-50">
              <p className="text-sm font-medium text-gray-700">Type <span className="font-bold font-mono">DELETE</span> to confirm.</p>
              <input value={confirmText} onChange={e => setConfirmText(e.target.value)} className="w-full px-3 py-2 border border-red-200 rounded-lg text-sm focus:outline-none focus:border-red-400" placeholder="Type DELETE" />
              <div className="flex gap-2">
                <Btn variant="danger" disabled={confirmText !== "DELETE"}>Confirm Delete</Btn>
                <Btn variant="secondary" onClick={() => { setShowDelete(false); setConfirmText(""); }}>Cancel</Btn>
              </div>
            </div>}
        </div>
      </div>
    </div>
  );
}

// ─── TOOLS ────────────────────────────────────────────────────────────────────

const GRADE_EQUIVALENTS = [
  { grade: 1.00, range: "99–100%", label: "Excellent" },
  { grade: 1.25, range: "96–98%",  label: "Outstanding" },
  { grade: 1.50, range: "93–95%",  label: "Superior" },
  { grade: 1.75, range: "90–92%",  label: "Very Good" },
  { grade: 2.00, range: "87–89%",  label: "Good" },
  { grade: 2.25, range: "84–86%",  label: "Satisfactory" },
  { grade: 2.50, range: "81–83%",  label: "Fairly Satisfactory" },
  { grade: 2.75, range: "78–80%",  label: "Fair" },
  { grade: 3.00, range: "75–77%",  label: "Passing" },
  { grade: 5.00, range: "Below 75%", label: "Failed" },
];

function getGradeLabel(gwa: number) {
  if (gwa <= 1.00) return GRADE_EQUIVALENTS[0];
  if (gwa <= 1.25) return GRADE_EQUIVALENTS[1];
  if (gwa <= 1.50) return GRADE_EQUIVALENTS[2];
  if (gwa <= 1.75) return GRADE_EQUIVALENTS[3];
  if (gwa <= 2.00) return GRADE_EQUIVALENTS[4];
  if (gwa <= 2.25) return GRADE_EQUIVALENTS[5];
  if (gwa <= 2.50) return GRADE_EQUIVALENTS[6];
  if (gwa <= 2.75) return GRADE_EQUIVALENTS[7];
  if (gwa <= 3.00) return GRADE_EQUIVALENTS[8];
  return GRADE_EQUIVALENTS[9];
}

interface SubjectRow { id: number; name: string; grade: string; units: string; }

function GWACalculator() {
  const [rows, setRows] = useState<SubjectRow[]>([
    { id: 1, name: "", grade: "", units: "" },
    { id: 2, name: "", grade: "", units: "" },
    { id: 3, name: "", grade: "", units: "" },
  ]);
  const [result, setResult] = useState<{ gwa: number; label: string; range: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const nextId = useRef(4);

  const addRow = () => {
    setRows(r => [...r, { id: nextId.current++, name: "", grade: "", units: "" }]);
  };

  const removeRow = (id: number) => {
    setRows(r => r.filter(row => row.id !== id));
    setResult(null);
  };

  const updateRow = (id: number, field: keyof SubjectRow, value: string) => {
    setRows(r => r.map(row => row.id === id ? { ...row, [field]: value } : row));
    setResult(null);
    setError(null);
  };

  const calculate = () => {
    const valid = rows.filter(r => r.grade.trim() !== "" && r.units.trim() !== "");
    if (valid.length === 0) { setError("Please add at least one subject with a grade and units."); return; }
    for (const r of valid) {
      const g = parseFloat(r.grade);
      const u = parseFloat(r.units);
      if (isNaN(g) || g < 1.0 || g > 5.0) { setError(`Invalid grade "${r.grade}" — must be between 1.00 and 5.00.`); return; }
      if (isNaN(u) || u <= 0) { setError(`Invalid units "${r.units}" — must be a positive number.`); return; }
    }
    const totalUnits = valid.reduce((s, r) => s + parseFloat(r.units), 0);
    const weightedSum = valid.reduce((s, r) => s + parseFloat(r.grade) * parseFloat(r.units), 0);
    const gwa = Math.round((weightedSum / totalUnits) * 10000) / 10000;
    const eq = getGradeLabel(gwa);
    setResult({ gwa, label: eq.label, range: eq.range });
    setError(null);
  };

  const reset = () => {
    setRows([
      { id: nextId.current++, name: "", grade: "", units: "" },
      { id: nextId.current++, name: "", grade: "", units: "" },
      { id: nextId.current++, name: "", grade: "", units: "" },
    ]);
    setResult(null);
    setError(null);
  };

  const resultColor = result
    ? result.gwa <= 1.5 ? "text-emerald-600" : result.gwa <= 2.5 ? "text-blue-600" : result.gwa <= 3.0 ? "text-amber-600" : "text-red-600"
    : "";

  return (
    <div className="space-y-6">
      {/* Input table */}
      <div className="rounded-2xl border border-border overflow-hidden">
        <div className="grid grid-cols-[1fr_120px_100px_40px] gap-0 bg-muted/50 border-b border-border px-4 py-2.5">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Subject Name</span>
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide text-center">Grade</span>
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide text-center">Units</span>
          <span />
        </div>
        <div className="divide-y divide-border">
          {rows.map((row, i) => (
            <div key={row.id} className="grid grid-cols-[1fr_120px_100px_40px] gap-0 items-center px-4 py-2.5">
              <input
                type="text"
                placeholder={`Subject ${i + 1} (optional)`}
                value={row.name}
                onChange={e => updateRow(row.id, "name", e.target.value)}
                className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 outline-none w-full pr-3"
              />
              <input
                type="number"
                placeholder="e.g. 1.75"
                min="1.00" max="5.00" step="0.25"
                value={row.grade}
                onChange={e => updateRow(row.id, "grade", e.target.value)}
                className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 outline-none text-center w-full"
              />
              <input
                type="number"
                placeholder="e.g. 3"
                min="1" max="10" step="1"
                value={row.units}
                onChange={e => updateRow(row.id, "units", e.target.value)}
                className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 outline-none text-center w-full"
              />
              <button
                onClick={() => removeRow(row.id)}
                disabled={rows.length === 1}
                className="flex items-center justify-center text-muted-foreground hover:text-red-500 transition-colors disabled:opacity-20"
              >
                <Trash size={14} />
              </button>
            </div>
          ))}
        </div>
        <div className="px-4 py-3 border-t border-border bg-muted/30">
          <button
            onClick={addRow}
            className="flex items-center gap-1.5 text-sm font-medium text-[var(--th-p)] hover:opacity-80 transition-opacity"
          >
            <Plus size={14} /> Add Subject
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <AlertCircle size={15} className="text-red-500 mt-0.5 flex-none" />
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={calculate}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold th-btn-primary transition-opacity hover:opacity-90"
        >
          Calculate GWA
        </button>
        <button
          onClick={reset}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold border border-border text-foreground hover:bg-muted transition-colors"
        >
          Reset
        </button>
      </div>

      {/* Result */}
      {result && (
        <div className="rounded-2xl border border-border bg-card p-6 flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <div className="text-center sm:text-left">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Your GWA</p>
            <p className={`text-5xl font-black tabular-nums ${resultColor}`}>{result.gwa.toFixed(4)}</p>
          </div>
          <div className="h-px sm:h-16 w-full sm:w-px bg-border" />
          <div>
            <p className={`text-xl font-bold ${resultColor}`}>{result.label}</p>
            <p className="text-sm text-muted-foreground mt-0.5">{result.range} equivalent</p>
            {result.gwa <= 1.5 && <p className="text-xs text-emerald-600 mt-2 font-medium">Excellent standing — Latin honors eligible</p>}
            {result.gwa > 3.0 && <p className="text-xs text-red-600 mt-2 font-medium">Below passing — consider consulting your academic adviser</p>}
          </div>
        </div>
      )}
    </div>
  );
}

const TOOL_CARDS = [
  {
    id: "gwa",
    icon: Calculator,
    title: "GWA Calculator",
    desc: "Compute your General Weighted Average using the Philippine 1.00–5.00 grading scale.",
    badge: "Academic",
  },
];

function ToolsPage({ setPage, isAdmin = false }: { setPage: (p: Page) => void; isAdmin?: boolean }) {
  const [activeTool, setActiveTool] = useState<string | null>(null);

  if (activeTool === "gwa") {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <GoogleAd slot={AD_SLOTS.RESOURCES_TOP} variant="display" className="mb-6" />
        <button
          onClick={() => setActiveTool(null)}
          className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ChevronLeft size={16} /> Back to Tools
        </button>

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--th-p)]/10 flex items-center justify-center">
              <Calculator size={20} className="text-[var(--th-p)]" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-foreground">GWA Calculator Philippines</h1>
              <p className="text-sm text-muted-foreground">Free and Fast Calculation</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Compute your General Weighted Average (GWA) by entering your subject grades and credit units. Follows the Philippine 1.00–5.00 academic grading scale.
          </p>
        </div>

        <div className="mb-4 flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
          <Info size={14} className="text-blue-500 mt-0.5 flex-none" />
          <p className="text-xs text-blue-700 leading-relaxed">
            <span className="font-semibold">Philippine GWA Scale:</span> 1.00 = Excellent &nbsp;·&nbsp; 3.00 = Passing &nbsp;·&nbsp; 5.00 = Failed
          </p>
        </div>

        <GWACalculator />

        {/* Educational content */}
        <div className="mt-12 space-y-8">
          <div>
            <h2 className="text-lg font-bold text-foreground mb-3">What is GWA in the Philippines?</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              General Weighted Average (GWA) is an academic grading system widely used in colleges and universities in the Philippines as a measure of students' overall academic performance. It is based on the weighted average formula, where subjects with higher credit units carry more academic weight. GWA is recorded in your Transcript of Records (TOR) and may follow specific rounding rules set by your university registrar under Commission on Higher Education (CHED) guidelines.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-bold text-foreground mb-3">How to Compute GWA</h2>
            <div className="rounded-2xl border border-border bg-muted/40 px-5 py-4 mb-4 text-center">
              <p className="text-base font-mono font-bold text-foreground">GWA = Σ (Grade × Units) ÷ Σ (Total Units)</p>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Each subject grade is multiplied by its credit units. The total is then divided by the sum of all units taken.
            </p>
            {/* Example table */}
            <div className="rounded-2xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    {["Subject", "Units", "Grade", "Grade × Units"].map(h => (
                      <th key={h} className="text-left px-4 py-2.5 font-semibold text-xs text-muted-foreground uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[["Math", "3", "1.50", "4.50"], ["English", "3", "1.75", "5.25"], ["Physics", "4", "2.00", "8.00"]].map(r => (
                    <tr key={r[0]}>
                      {r.map((c, i) => <td key={i} className="px-4 py-2.5 text-foreground">{c}</td>)}
                    </tr>
                  ))}
                  <tr className="font-semibold bg-muted/30">
                    <td className="px-4 py-2.5 text-foreground">TOTAL</td>
                    <td className="px-4 py-2.5 text-foreground">10</td>
                    <td className="px-4 py-2.5 text-muted-foreground">–</td>
                    <td className="px-4 py-2.5 text-foreground">17.75</td>
                  </tr>
                </tbody>
              </table>
              <div className="px-4 py-3 border-t border-border bg-muted/20">
                <p className="text-sm font-semibold text-foreground">GWA = 17.75 ÷ 10 = <span className="text-blue-600">1.775</span></p>
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-lg font-bold text-foreground mb-3">Philippine Grade Equivalent Table</h2>
            <div className="rounded-2xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    {["Grade", "% Range", "Meaning"].map(h => (
                      <th key={h} className="text-left px-4 py-2.5 font-semibold text-xs text-muted-foreground uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {GRADE_EQUIVALENTS.map(row => (
                    <tr key={row.grade} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-2.5 font-mono font-bold text-foreground">{row.grade.toFixed(2)}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{row.range}</td>
                      <td className="px-4 py-2.5">
                        <span className={`font-semibold ${row.grade <= 1.5 ? "text-emerald-600" : row.grade <= 2.5 ? "text-blue-600" : row.grade <= 3.0 ? "text-amber-600" : "text-red-600"}`}>
                          {row.label}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h2 className="text-lg font-bold text-foreground mb-3">Typical PH Credit Units</h2>
            <div className="rounded-2xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Course Type</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Common Units</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[["Gen Ed Lecture", "3"], ["Major Lecture", "3–5"], ["Lab (standalone)", "1–2"], ["PE", "2"], ["NSTP", "3 (often excluded)"]].map(r => (
                    <tr key={r[0]} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-2.5 text-foreground">{r[0]}</td>
                      <td className="px-4 py-2.5 font-mono font-semibold text-foreground">{r[1]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <h2 className="text-base font-bold text-foreground mb-2">Semester GWA vs Cumulative GWA</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              <span className="font-semibold text-foreground">Semester GWA</span> is the weighted average of grades for subjects taken in a single semester. <span className="font-semibold text-foreground">Cumulative GWA</span> is the overall weighted average across multiple semesters — used for academic standing, scholarships, and Latin honors (Summa Cum Laude, Magna Cum Laude, Cum Laude).
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      {!isAdmin && (
        <button
          onClick={() => setPage("home")}
          className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ChevronLeft size={16} /> Back to Home
        </button>
      )}

      <div className="mb-10">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--th-p)]/10 flex items-center justify-center">
            <Wrench size={20} className="text-[var(--th-p)]" />
          </div>
          <h1 className="text-2xl font-black text-foreground">Student Tools</h1>
        </div>
        <p className="text-sm text-muted-foreground max-w-xl">
          Free tools designed for Filipino students. No account needed — just open and use.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {TOOL_CARDS.map(tool => {
          const Icon = tool.icon;
          return (
            <button
              key={tool.id}
              onClick={() => setActiveTool(tool.id)}
              className="group text-left rounded-2xl border border-border bg-card p-5 hover:border-[var(--th-p)]/50 hover:shadow-md transition-all duration-200"
            >
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-xl bg-[var(--th-p)]/10 flex items-center justify-center flex-none group-hover:bg-[var(--th-p)]/20 transition-colors">
                  <Icon size={22} className="text-[var(--th-p)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--th-p)] bg-[var(--th-p)]/10 px-2 py-0.5 rounded-full">{tool.badge}</span>
                  </div>
                  <h3 className="text-base font-bold text-foreground group-hover:text-[var(--th-p)] transition-colors">{tool.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed mt-1">{tool.desc}</p>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-[var(--th-p)]">
                Open tool <ChevronRight size={13} />
              </div>
            </button>
          );
        })}

        {/* Coming soon placeholder */}
        <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-5 flex flex-col items-start justify-center gap-2 opacity-60">
          <div className="w-11 h-11 rounded-xl bg-muted flex items-center justify-center">
            <Plus size={20} className="text-muted-foreground" />
          </div>
          <p className="text-sm font-semibold text-muted-foreground">More tools coming soon</p>
          <p className="text-xs text-muted-foreground">Study timer, grade tracker, and more.</p>
        </div>
      </div>
    </div>
  );
}

// ─── STATIC PAGE ──────────────────────────────────────────────────────────────

function StaticPage({ slug, setPage }: { slug: "privacy" | "terms"; setPage: (p: Page) => void }) {
  const { title, slug: dbSlug, fallback } = STATIC_PAGES_CONTENT[slug];
  const [displayContent, setDisplayContent] = useState<string>(fallback);
  const [displayTitle, setDisplayTitle] = useState<string>(title);

  useEffect(() => {
    api.getStaticPageBySlug(dbSlug).then(data => {
      if (data?.content) setDisplayContent(data.content);
      if (data?.title) setDisplayTitle(data.title);
    });
  }, [dbSlug]);

  const lines = displayContent.split("\n");
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <BackButton onClick={() => setPage("home")} className="mb-8" />
      <h1 className="text-3xl font-bold tracking-tight mb-8">{displayTitle}</h1>
      <div className="space-y-3">{lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-2" />;
        if (line.match(/^\d+\./)) return <h3 key={i} className="font-bold text-base mt-6">{renderTextWithLinks(line)}</h3>;
        if (line.endsWith(":")) return <p key={i} className="font-semibold text-black text-[15px] mt-4 mb-1">{line}</p>;
        return <p key={i} className="text-gray-600 text-[15px] leading-relaxed">{renderTextWithLinks(line)}</p>;
      })}</div>
    </div>
  );
}

// ─── ADMIN LAYOUT ─────────────────────────────────────────────────────────────

const ADMIN_NAV = [
  { label: "Dashboard", page: "admin-dashboard" as Page, icon: LayoutDashboard },
  { label: "Content Management", page: "admin-content" as Page, icon: FileText },
  { label: "Categories", page: "admin-categories" as Page, icon: List },
  { label: "Subjects", page: "admin-subjects" as Page, icon: BookOpen },
  { label: "Tags", page: "admin-tags" as Page, icon: Tag },
  { label: "Users", page: "admin-users" as Page, icon: Users },
  { label: "Feedback", page: "admin-feedback" as Page, icon: MessageSquare },
  { label: "Static Pages", page: "admin-static-pages" as Page, icon: Globe },
  { label: "Site Settings", page: "admin-site-settings" as Page, icon: Settings },
  { label: "Activity Logs", page: "admin-activity-logs" as Page, icon: Activity },
  { label: "Tools", page: "admin-tools" as Page, icon: Wrench },
];

function AdminLayout({ page, setPage, setRole, setUserId, children }: {
  page: Page; setPage: (p: Page) => void; setRole: (r: Role) => void; setUserId: (id: string | null) => void; children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const handleSignOut = async () => { await api.signOut(); setRole("guest"); setUserId(null); setPage("home"); };

  const sidebar = (
    <div className="h-full flex flex-col bg-black text-white overflow-hidden">
      <div className="px-5 py-5 border-b border-white/10 flex-none">
        <div>
          <LogoWordmark className="h-5 w-auto mb-0.5" />
          <p className="text-[10px] text-gray-500">Super Admin</p>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {ADMIN_NAV.map(item => {
          const Icon = item.icon;
          const active = page === item.page;
          return (
            <button key={item.page} onClick={() => { setPage(item.page); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${active ? "bg-white text-black" : "text-gray-400 hover:text-white hover:bg-white/10"}`}>
              <Icon size={15} className="flex-none" /> {item.label}
            </button>
          );
        })}
      </nav>
      <div className="px-3 py-4 border-t border-white/10 space-y-0.5 flex-none">
        <button onClick={() => { setPage("admin-profile"); setSidebarOpen(false); }}
          className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${page === "admin-profile" ? "bg-white text-black" : "text-gray-400 hover:text-white hover:bg-white/10"}`}>
          <Settings size={15} /> Profile
        </button>
        <button onClick={() => setPage("home")} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/10 transition-colors"><Globe size={15} /> View Site</button>
        <button onClick={handleSignOut} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/10 transition-colors"><LogOut size={15} /> Logout</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-gray-50">
      <aside className="hidden lg:block w-56 xl:w-60 flex-none h-screen sticky top-0 border-r border-black/10 overflow-hidden">{sidebar}</aside>
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="w-60 flex-none border-r border-black/10 h-full">{sidebar}</div>
          <div className="flex-1 bg-black/40" onClick={() => setSidebarOpen(false)} />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="lg:hidden sticky top-0 z-30 bg-white border-b border-black/[0.08] px-4 h-12 flex items-center gap-3">
          <button onClick={() => setSidebarOpen(true)} className="p-1.5 rounded-lg hover:bg-gray-100"><Menu size={16} /></button>
          <span className="font-semibold text-sm">Admin Panel</span>
        </div>
        <main className="p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

// ─── ADMIN DASHBOARD ──────────────────────────────────────────────────────────

function AdminDashboard({ setPage }: { setPage: (p: Page) => void }) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [charts, setCharts] = useState<any>(null);
  const [recentPosts, setRecentPosts] = useState<Post[]>([]);
  const [recentFeedback, setRecentFeedback] = useState<FeedbackItem[]>([]);
  const [recentUsers, setRecentUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.getDashboardStats(),
      api.getChartData(),
      api.getPosts({ limit: 5 }),
      api.getFeedback(),
      api.getUsers(),
    ]).then(([s, c, postsRes, fb, users]) => {
      setStats(s);
      setCharts(c);
      setRecentPosts(postsRes.data);
      setRecentFeedback(fb.slice(0, 3));
      setRecentUsers(users.filter(u => u.role === "user").slice(0, 4));
      setLoading(false);
    });
  }, []);

  const statCards = stats ? [
    { label: "Total Users", val: stats.totalUsers, sub: "Registered users", icon: Users },
    { label: "Published Posts", val: stats.publishedPosts, sub: "Live content", icon: FileText },
    { label: "Draft Posts", val: stats.draftPosts, sub: "Pending review", icon: Archive },
    { label: "Featured Posts", val: stats.featuredPosts, sub: "Highlighted", icon: Star },
    { label: "Total Resources", val: stats.resourcePosts, sub: "Learning materials", icon: BookOpen },
    { label: "Total Opportunities", val: stats.opportunityPosts, sub: "Scholarships & more", icon: Zap },
    { label: "Total Saved", val: stats.totalSaved, sub: "By all users", icon: Bookmark },
    { label: "Total Feedback", val: stats.totalFeedback, sub: `${stats.unreadFeedback} unread`, icon: MessageSquare },
  ] : [];

  const quickActions = [
    { label: "Create Resource", page: "admin-create-post" as Page, icon: Plus },
    { label: "Create Opportunity", page: "admin-create-post" as Page, icon: Plus },
    { label: "Create Category", page: "admin-categories" as Page, icon: List },
    { label: "Create Subject", page: "admin-subjects" as Page, icon: BookOpen },
    { label: "View Feedback", page: "admin-feedback" as Page, icon: MessageSquare },
  ];

  return (
    <div>
      <div className="mb-8"><h1 className="text-2xl font-bold tracking-tight">Dashboard</h1><p className="text-sm text-gray-500 mt-0.5">Welcome back, Super Admin. Here&apos;s what&apos;s happening on EduHub PH.</p></div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-8">
        {loading
          ? Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28" />)
          : statCards.map(s => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="bg-white border border-black/[0.08] rounded-xl p-4">
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center mb-3"><Icon size={15} className="text-gray-600" /></div>
                <p className="text-2xl font-bold">{s.val}</p>
                <p className="text-xs font-semibold text-gray-700 mt-0.5">{s.label}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">{s.sub}</p>
              </div>
            );
          })}
      </div>

      {/* Quick actions */}
      <div className="mb-8">
        <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-3">Quick Actions</h2>
        <div className="flex flex-wrap gap-2">
          {quickActions.map(a => {
            const Icon = a.icon;
            return (
              <button key={a.label} onClick={() => setPage(a.page)}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-black/[0.08] rounded-xl text-sm font-medium hover:border-black hover:bg-gray-50 transition-all">
                <Icon size={14} /> {a.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Charts */}
      {!loading && charts && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
          <div className="bg-white border border-black/[0.08] rounded-xl p-5">
            <p className="font-semibold text-sm mb-4">New Users — Last 30 Days</p>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={charts.newUsers.length ? charts.newUsers : [{ label: "No data", v: 0 }]} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs><linearGradient id="ugr" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#000" stopOpacity={0.12} /><stop offset="95%" stopColor="#000" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#999" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#999" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ border: "1px solid #e5e5e5", borderRadius: "8px", fontSize: "12px" }} />
                <Area type="monotone" dataKey="v" stroke="#000" strokeWidth={2} fill="url(#ugr)" name="Users" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white border border-black/[0.08] rounded-xl p-5">
            <p className="font-semibold text-sm mb-4">Published Posts — Per Month</p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={charts.postsMonthly} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#999" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#999" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ border: "1px solid #e5e5e5", borderRadius: "8px", fontSize: "12px" }} />
                <Bar dataKey="posts" fill="#000" radius={[4, 4, 0, 0]} name="Posts" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white border border-black/[0.08] rounded-xl p-5">
            <p className="font-semibold text-sm mb-4">Resources vs Opportunities</p>
            <div className="flex items-center gap-6">
              <ResponsiveContainer width="50%" height={160}>
                <PieChart>
                  <Pie data={charts.typeDist} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" paddingAngle={3}>
                    {charts.typeDist.map((d: any, i: number) => <Cell key={`type-${d.name}`} fill={i === 0 ? "#000" : "#ccc"} />)}
                  </Pie>
                  <Tooltip contentStyle={{ border: "1px solid #e5e5e5", borderRadius: "8px", fontSize: "12px" }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2">
                {charts.typeDist.map((d: any, i: number) => (
                  <div key={d.name} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full flex-none" style={{ background: i === 0 ? "#000" : "#ccc" }} />
                    <span className="text-sm text-gray-700">{d.name}</span>
                    <span className="text-sm font-bold ml-auto">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="bg-white border border-black/[0.08] rounded-xl p-5">
            <p className="font-semibold text-sm mb-4">Category Distribution</p>
            {charts.catDist.length === 0 ? <p className="text-sm text-gray-400 py-10 text-center">No data yet.</p> : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={charts.catDist} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: "#999" }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#666" }} axisLine={false} tickLine={false} width={80} />
                  <Tooltip contentStyle={{ border: "1px solid #e5e5e5", borderRadius: "8px", fontSize: "12px" }} />
                  <Bar dataKey="count" fill="#000" radius={[0, 4, 4, 0]} name="Posts" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {/* Recent activity */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <div className="bg-white border border-black/[0.08] rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100"><p className="font-semibold text-sm">Recent Posts</p><button onClick={() => setPage("admin-content")} className="text-xs text-gray-500 hover:text-black">View all</button></div>
          <div className="divide-y divide-gray-50">
            {loading ? Array.from({ length: 4 }).map((_, i) => <div key={i} className="px-5 py-3"><Skeleton className="h-4 w-full mb-1" /><Skeleton className="h-3 w-1/2" /></div>)
              : recentPosts.map(p => (
                <div key={p.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{p.title}</p><div className="flex items-center gap-1.5 mt-0.5">{p.categories && <Pill label={p.categories.name} dark />}<span className="text-[11px] text-gray-400">{fmtShort(p.published_at)}</span></div></div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-none ${p.status === "published" ? "th-bg" : "bg-gray-100 text-gray-500"}`}>{p.status}</span>
                </div>
              ))}
          </div>
        </div>
        <div className="bg-white border border-black/[0.08] rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100"><p className="font-semibold text-sm">New Users</p><button onClick={() => setPage("admin-users")} className="text-xs text-gray-500 hover:text-black">View all</button></div>
          <div className="divide-y divide-gray-50">
            {loading ? Array.from({ length: 4 }).map((_, i) => <div key={i} className="px-5 py-3 flex gap-3 items-center"><Skeleton className="w-7 h-7 rounded-full" /><Skeleton className="h-4 flex-1" /></div>)
              : recentUsers.map(u => (
                <div key={u.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="w-7 h-7 rounded-full th-bg text-xs font-bold flex items-center justify-center flex-none">{u.first_name[0]?.toUpperCase()}</div>
                  <div className="flex-1 min-w-0"><p className="text-sm font-medium">{u.first_name} {u.last_name}</p><p className="text-[11px] text-gray-400">{fmtShort(u.created_at)}</p></div>
                  {u.is_active ? <UserCheck size={13} className="text-gray-400" /> : <UserX size={13} className="text-gray-400" />}
                </div>
              ))}
          </div>
        </div>
        <div className="bg-white border border-black/[0.08] rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100"><p className="font-semibold text-sm">Recent Feedback</p><button onClick={() => setPage("admin-feedback")} className="text-xs text-gray-500 hover:text-black">View all</button></div>
          <div className="divide-y divide-gray-50">
            {loading ? Array.from({ length: 3 }).map((_, i) => <div key={i} className="px-5 py-3"><Skeleton className="h-4 w-3/4 mb-1" /><Skeleton className="h-3 w-1/2" /></div>)
              : recentFeedback.map(f => (
                <div key={f.id} className="px-5 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0"><p className="text-sm font-medium">{f.name}</p><p className="text-xs text-gray-500 truncate">{f.subject}</p><p className="text-[11px] text-gray-400 mt-0.5">{fmtShort(f.created_at)}</p></div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-none ${f.status === "unread" ? "th-bg" : "bg-gray-100 text-gray-500"}`}>{f.status}</span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── CONFIRM DIALOG ───────────────────────────────────────────────────────────

function ConfirmDialog({ open, title, message, confirmLabel = "Delete", onConfirm, onCancel, danger = true }: {
  open: boolean; title: string; message: string; confirmLabel?: string;
  onConfirm: () => void; onCancel: () => void; danger?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
        <h3 className="text-base font-bold tracking-tight mb-1">{title}</h3>
        <p className="text-sm text-gray-500 mb-6">{message}</p>
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="px-4 py-2 text-sm font-medium bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">Cancel</button>
          <button onClick={onConfirm} className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors text-white ${danger ? "bg-red-500 hover:bg-red-600" : "th-btn-primary"}`}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

// ─── CONTENT MANAGEMENT ───────────────────────────────────────────────────────

function ContentManagement({ setPage }: { setPage: (p: Page) => void }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState(""); const [catF, setCatF] = useState(""); const [typeF, setTypeF] = useState(""); const [statusF, setStatusF] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [deleting, setDeleting] = useState<number | null>(null);
  const [publishing, setPublishing] = useState<number | null>(null);
  const [confirm, setConfirm] = useState<{ type: "single"; id: number; title: string } | { type: "bulk" } | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.getPosts({ search: q || undefined, category_id: catF ? Number(catF) : undefined, type: typeF || undefined, status: statusF || undefined }),
      api.getCategories(),
    ]).then(([postsRes, catsRes]) => { setPosts(postsRes.data); setCats(catsRes); setLoading(false); });
  }, [q, catF, typeF, statusF]);

  useEffect(() => { load(); }, [load]);

  const toggleAll = () => setSelected(s => s.size === posts.length ? new Set() : new Set(posts.map(p => p.id)));
  const toggle = (id: number) => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const handleDelete = async (id: number) => {
    setConfirm(null);
    setDeleting(id);
    await api.deletePost(id);
    await api.logActivity("Deleted post", "Content");
    setPosts(p => p.filter(x => x.id !== id));
    setDeleting(null);
  };

  const handlePublish = async (id: number, status: "published" | "draft") => {
    setPublishing(id);
    await api.updatePost(id, { status, published_at: status === "published" ? new Date().toISOString() : undefined });
    await api.logActivity(`${status === "published" ? "Published" : "Unpublished"} post`, "Content");
    setPosts(p => p.map(x => x.id === id ? { ...x, status } : x));
    setPublishing(null);
  };

  const handleBulkDelete = async () => {
    setConfirm(null);
    await Promise.all([...selected].map(id => api.deletePost(id)));
    await api.logActivity(`Bulk deleted ${selected.size} posts`, "Content");
    setPosts(p => p.filter(x => !selected.has(x.id)));
    setSelected(new Set());
  };

  return (
    <div>
      <ConfirmDialog
        open={confirm !== null}
        title={confirm?.type === "bulk" ? `Delete ${selected.size} posts?` : "Delete post?"}
        message={confirm?.type === "bulk"
          ? `This will permanently delete all ${selected.size} selected posts. This cannot be undone.`
          : `"${confirm?.type === "single" ? confirm.title : ""}" will be permanently deleted.`}
        onConfirm={() => confirm?.type === "bulk" ? handleBulkDelete() : confirm?.type === "single" ? handleDelete(confirm.id) : undefined}
        onCancel={() => setConfirm(null)}
      />
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold tracking-tight">Content Management</h1><p className="text-sm text-gray-500 mt-0.5">{loading ? "Loading…" : `${posts.length} posts`}</p></div>
        <Btn onClick={() => setPage("admin-create-post")} size="sm"><Plus size={14} /> Create Post</Btn>
      </div>
      <div className="flex flex-wrap gap-2 mb-4 p-4 bg-white border border-black/[0.08] rounded-xl">
        <div className="relative flex-1 min-w-[160px]"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search posts…" className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:border-black transition-colors" /></div>
        <select value={catF} onChange={e => setCatF(e.target.value)} className="appearance-none px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:border-black cursor-pointer"><option value="">All Categories</option>{cats.map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}</select>
        <select value={typeF} onChange={e => setTypeF(e.target.value)} className="appearance-none px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:border-black cursor-pointer"><option value="">All Types</option><option value="resource">Resource</option><option value="opportunity">Opportunity</option></select>
        <select value={statusF} onChange={e => setStatusF(e.target.value)} className="appearance-none px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:border-black cursor-pointer"><option value="">All Status</option><option value="published">Published</option><option value="draft">Draft</option><option value="archived">Archived</option></select>
      </div>
      {selected.size > 0 && (
        <div className="flex items-center gap-2 mb-4 px-4 py-2 th-bg rounded-xl text-sm">
          <span className="font-medium">{selected.size} selected</span><div className="flex-1" />
          <button onClick={() => setConfirm({ type: "bulk" })} className="flex items-center gap-1.5 px-3 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-medium"><Trash2 size={12} /> Delete</button>
        </div>
      )}
      <div className="bg-white border border-black/[0.08] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-4 py-3 w-10"><input type="checkbox" checked={selected.size === posts.length && posts.length > 0} onChange={toggleAll} className="w-4 h-4 accent-black rounded" /></th>
              <th className="text-left px-4 py-3 font-semibold text-xs text-gray-500 uppercase tracking-wide">Title</th>
              <th className="text-left px-4 py-3 font-semibold text-xs text-gray-500 uppercase tracking-wide hidden sm:table-cell">Category</th>
              <th className="text-left px-4 py-3 font-semibold text-xs text-gray-500 uppercase tracking-wide hidden md:table-cell">Type</th>
              <th className="text-left px-4 py-3 font-semibold text-xs text-gray-500 uppercase tracking-wide">Status</th>
              <th className="text-left px-4 py-3 font-semibold text-xs text-gray-500 uppercase tracking-wide hidden lg:table-cell">Date</th>
              <th className="px-4 py-3" />
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}><td colSpan={7} className="px-4 py-3"><Skeleton className="h-5 w-full" /></td></tr>
              )) : posts.map(p => (
                <tr key={p.id} className={`hover:bg-gray-50 transition-colors ${selected.has(p.id) ? "bg-gray-50" : ""}`}>
                  <td className="px-4 py-3 w-10"><input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} className="w-4 h-4 accent-black rounded" /></td>
                  <td className="px-4 py-3"><div className="flex items-center gap-2"><p className="font-medium text-sm truncate max-w-[140px] sm:max-w-[220px] lg:max-w-[320px]">{p.title}</p>{p.is_featured && <Star size={11} fill="currentColor" className="text-gray-400 flex-none" />}</div></td>
                  <td className="px-4 py-3 hidden sm:table-cell">{p.categories && <Pill label={p.categories.name} dark />}</td>
                  <td className="px-4 py-3 capitalize text-xs text-gray-500 hidden md:table-cell">{p.type}</td>
                  <td className="px-4 py-3"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${p.status === "published" ? "th-bg" : p.status === "draft" ? "bg-gray-100 text-gray-500" : "bg-gray-200 text-gray-400"}`}>{p.status}</span></td>
                  <td className="px-4 py-3 text-xs text-gray-400 hidden lg:table-cell">{fmtShort(p.published_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      {p.status !== "published"
                        ? <button onClick={() => handlePublish(p.id, "published")} disabled={publishing === p.id} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-black transition-colors disabled:opacity-40" title="Publish">{publishing === p.id ? <LoadingDots size="xs" /> : <Check size={13} />}</button>
                        : <button onClick={() => handlePublish(p.id, "draft")} disabled={publishing === p.id} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-black transition-colors disabled:opacity-40" title="Unpublish">{publishing === p.id ? <LoadingDots size="xs" /> : <Archive size={13} />}</button>}
                      <button onClick={() => setConfirm({ type: "single", id: p.id, title: p.title })} disabled={deleting === p.id} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-40" title="Delete">{deleting === p.id ? <LoadingDots size="xs" /> : <Trash2 size={13} />}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── ADMIN CREATE POST ────────────────────────────────────────────────────────

function AdminCreatePost({ setPage }: { setPage: (p: Page) => void }) {
  const [form, setForm] = useState({ title: "", slug: "", excerpt: "", content: "", category: "", subject: "", type: "resource", status: "draft", is_featured: false, cover_image: "", meta_title: "", meta_description: "" });
  const [cats, setCats] = useState<Category[]>([]);
  const [subs, setSubs] = useState<Subject[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const set = (k: string) => (v: string) => setForm(f => ({ ...f, [k]: v }));
  const handleTitle = (v: string) => setForm(f => ({ ...f, title: v, slug: toSlug(v) }));

  useEffect(() => {
    Promise.all([api.getCategories(), api.getSubjects()]).then(([c, s]) => { setCats(c); setSubs(s); });
  }, []);

  const handleSave = async (status: "draft" | "published") => {
    if (!form.title.trim()) { setError("Title is required."); return; }
    setSaving(true); setError("");
    const { error: err } = await api.createPost({
      title: form.title, slug: form.slug || toSlug(form.title),
      excerpt: form.excerpt || undefined, content: form.content || undefined,
      category_id: form.category ? Number(form.category) : undefined,
      subject_id: form.subject ? Number(form.subject) : undefined,
      type: form.type, status,
      is_featured: form.is_featured,
      cover_image: form.cover_image.trim() || undefined,
      published_at: status === "published" ? new Date().toISOString() : undefined,
      meta_title: form.meta_title || undefined, meta_description: form.meta_description || undefined,
    });
    setSaving(false);
    if (err) { setError(err.message); return; }
    await api.logActivity(`Created post: ${form.title}`, "Content");
    setSaved(true);
    setTimeout(() => setPage("admin-content"), 1200);
  };

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => setPage("admin-content")} className="p-1.5 rounded-lg hover:bg-gray-100"><ArrowLeft size={16} /></button>
        <div><h1 className="text-2xl font-bold tracking-tight">Create Post</h1><p className="text-sm text-gray-500">Add new content to EduHub PH</p></div>
      </div>
      {saved && <div className="mb-5 flex items-center gap-2 p-3 th-bg rounded-xl text-sm"><Check size={14} /> Post saved! Redirecting…</div>}
      {error && <div className="mb-5 flex items-center gap-2 p-3 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm"><AlertCircle size={14} /> {error}</div>}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-5">
          <div className="bg-white border border-black/[0.08] rounded-xl p-5 space-y-4">
            <AdminInputField label="Title" value={form.title} onChange={handleTitle} placeholder="Post title" />
            <AdminInputField label="Slug" value={form.slug} onChange={set("slug")} placeholder="post-slug" />
            <div className="flex flex-col gap-1.5"><label className="text-sm font-semibold">Excerpt</label><textarea value={form.excerpt} onChange={e => set("excerpt")(e.target.value)} placeholder="Brief description…" rows={3} className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-black focus:bg-white transition-colors resize-none" /></div>
            <div className="flex flex-col gap-1.5"><label className="text-sm font-semibold">Content</label><textarea value={form.content} onChange={e => set("content")(e.target.value)} placeholder="Write your content here…" rows={14} className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-black focus:bg-white transition-colors resize-none font-mono text-xs" /></div>
          </div>
          <div className="bg-white border border-black/[0.08] rounded-xl p-5 space-y-4">
            <p className="font-semibold text-sm">SEO</p>
            <AdminInputField label="Meta Title" value={form.meta_title} onChange={set("meta_title")} placeholder="SEO title (optional)" />
            <div className="flex flex-col gap-1.5"><label className="text-sm font-semibold">Meta Description</label><textarea value={form.meta_description} onChange={e => set("meta_description")(e.target.value)} placeholder="SEO description (optional)" rows={3} className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-black focus:bg-white transition-colors resize-none" /></div>
          </div>
        </div>
        <div className="space-y-4">
          <div className="bg-white border border-black/[0.08] rounded-xl p-5 space-y-4">
            <p className="font-semibold text-sm">Publish</p>
            <SelectField label="Type" value={form.type} onChange={set("type")} options={[{ value: "resource", label: "Resource" }, { value: "opportunity", label: "Opportunity" }]} />
            <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={form.is_featured} onChange={e => setForm(f => ({ ...f, is_featured: e.target.checked }))} className="w-4 h-4 rounded accent-black" /><span className="text-sm font-medium">Featured post</span></label>
            <div className="flex flex-col gap-1.5">
              <AdminInputField label="Cover Image URL" value={form.cover_image} onChange={set("cover_image")} placeholder="https://example.com/image.jpg" />
              {form.cover_image.trim() && (
                <img src={form.cover_image.trim()} alt="Cover preview" onError={e => (e.currentTarget.style.display = "none")}
                  className="mt-1 w-full h-36 object-cover rounded-lg border border-gray-100" />
              )}
            </div>
            <div className="flex gap-2">
              <Btn variant="secondary" onClick={() => handleSave("draft")} className="flex-1" disabled={saving}>Save draft</Btn>
              <Btn onClick={() => handleSave("published")} className="flex-1" disabled={saving}>{saving ? <LoadingDots size="xs" /> : null} Publish</Btn>
            </div>
          </div>
          <div className="bg-white border border-black/[0.08] rounded-xl p-5 space-y-4">
            <p className="font-semibold text-sm">Categorization</p>
            <SelectField label="Category" value={form.category} onChange={set("category")} placeholder="Select category" options={cats.map(c => ({ value: String(c.id), label: c.name }))} />
            <SelectField label="Subject" value={form.subject} onChange={set("subject")} placeholder="Select subject" options={subs.map(s => ({ value: String(s.id), label: s.name }))} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── ADMIN CATEGORIES ─────────────────────────────────────────────────────────

function AdminCategories() {
  const [items, setItems] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [newItem, setNewItem] = useState({ name: "", type: "resource" });

  useEffect(() => { api.getCategories().then(d => { setItems(d); setLoading(false); }); }, []);

  const handleAdd = async () => {
    if (!newItem.name.trim()) return;
    setSaving(true);
    const { data } = await api.createCategory({ name: newItem.name, slug: toSlug(newItem.name), type: newItem.type, is_active: true, sort_order: items.length + 1 });
    if (data) { setItems(p => [...p, data as Category]); setAdding(false); setNewItem({ name: "", type: "resource" }); await api.logActivity(`Added category: ${newItem.name}`, "Categories"); }
    setSaving(false);
  };

  const handleDelete = async (id: number) => {
    setConfirmId(null);
    setDeleting(id);
    await api.deleteCategory(id);
    setItems(p => p.filter(x => x.id !== id));
    await api.logActivity("Deleted category", "Categories");
    setDeleting(null);
  };

  const handleToggle = async (item: Category) => {
    await api.updateCategory(item.id, { is_active: !item.is_active });
    setItems(p => p.map(x => x.id === item.id ? { ...x, is_active: !x.is_active } : x));
  };

  const confirmItem = items.find(x => x.id === confirmId);

  return (
    <div>
      <ConfirmDialog
        open={confirmId !== null}
        title="Delete category?"
        message={`"${confirmItem?.name}" will be permanently deleted and removed from all posts.`}
        onConfirm={() => confirmId !== null && handleDelete(confirmId)}
        onCancel={() => setConfirmId(null)}
      />
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold tracking-tight">Categories</h1><p className="text-sm text-gray-500 mt-0.5">{items.length} categories</p></div>
        <Btn size="sm" onClick={() => setAdding(true)}><Plus size={14} /> Add Category</Btn>
      </div>
      {adding && (
        <div className="mb-4 p-4 bg-white border border-black/[0.08] rounded-xl flex gap-3 items-end">
          <div className="flex-1"><AdminInputField label="Name" value={newItem.name} onChange={v => setNewItem(n => ({ ...n, name: v }))} placeholder="Category name" /></div>
          <SelectField label="Type" value={newItem.type} onChange={v => setNewItem(n => ({ ...n, type: v }))} options={[{ value: "resource", label: "Resource" }, { value: "opportunity", label: "Opportunity" }]} />
          <Btn onClick={handleAdd} disabled={saving}>{saving ? <LoadingDots size="xs" /> : "Add"}</Btn>
          <Btn variant="secondary" onClick={() => setAdding(false)}>Cancel</Btn>
        </div>
      )}
      <div className="bg-white border border-black/[0.08] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-100 bg-gray-50">
            <th className="text-left px-4 py-3 font-semibold text-xs text-gray-500 uppercase tracking-wide">Name</th>
            <th className="text-left px-4 py-3 font-semibold text-xs text-gray-500 uppercase tracking-wide hidden sm:table-cell">Slug</th>
            <th className="text-left px-4 py-3 font-semibold text-xs text-gray-500 uppercase tracking-wide">Type</th>
            <th className="text-left px-4 py-3 font-semibold text-xs text-gray-500 uppercase tracking-wide">Status</th>
            <th className="px-4 py-3" />
          </tr></thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? Array.from({ length: 5 }).map((_, i) => <tr key={i}><td colSpan={5} className="px-4 py-3"><Skeleton className="h-5 w-full" /></td></tr>)
              : items.map(c => (
                <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-4 py-3 hidden sm:table-cell"><code className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{c.slug}</code></td>
                  <td className="px-4 py-3 capitalize text-xs text-gray-500">{c.type}</td>
                  <td className="px-4 py-3"><button onClick={() => handleToggle(c)} className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${c.is_active ? "th-bg" : "bg-gray-100 text-gray-500"}`}>{c.is_active ? "active" : "inactive"}</button></td>
                  <td className="px-4 py-3"><div className="flex gap-1 justify-end"><button onClick={() => setConfirmId(c.id)} disabled={deleting === c.id} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-40">{deleting === c.id ? <LoadingDots size="xs" /> : <Trash2 size={13} />}</button></div></td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── ADMIN SUBJECTS ───────────────────────────────────────────────────────────

function AdminSubjects() {
  const [items, setItems] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [newName, setNewName] = useState("");

  useEffect(() => { api.getSubjects().then(d => { setItems(d); setLoading(false); }); }, []);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    const { data } = await api.createSubject({ name: newName, slug: toSlug(newName), is_active: true, sort_order: items.length + 1 });
    if (data) { setItems(p => [...p, data as Subject]); setAdding(false); setNewName(""); await api.logActivity(`Added subject: ${newName}`, "Subjects"); }
    setSaving(false);
  };

  const handleDelete = async (id: number) => {
    setConfirmId(null);
    setDeleting(id);
    await api.deleteSubject(id);
    setItems(p => p.filter(x => x.id !== id));
    setDeleting(null);
  };

  const confirmItem = items.find(x => x.id === confirmId);

  return (
    <div>
      <ConfirmDialog
        open={confirmId !== null}
        title="Delete subject?"
        message={`"${confirmItem?.name}" will be permanently deleted.`}
        onConfirm={() => confirmId !== null && handleDelete(confirmId)}
        onCancel={() => setConfirmId(null)}
      />
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold tracking-tight">Subjects</h1><p className="text-sm text-gray-500 mt-0.5">{items.length} subjects</p></div>
        <Btn size="sm" onClick={() => setAdding(true)}><Plus size={14} /> Add Subject</Btn>
      </div>
      {adding && (
        <div className="mb-4 p-4 bg-white border border-black/[0.08] rounded-xl flex gap-3 items-end">
          <div className="flex-1"><AdminInputField label="Name" value={newName} onChange={setNewName} placeholder="Subject name" /></div>
          <Btn onClick={handleAdd} disabled={saving}>{saving ? <LoadingDots size="xs" /> : "Add"}</Btn>
          <Btn variant="secondary" onClick={() => setAdding(false)}>Cancel</Btn>
        </div>
      )}
      <div className="bg-white border border-black/[0.08] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-100 bg-gray-50">
            <th className="text-left px-4 py-3 font-semibold text-xs text-gray-500 uppercase tracking-wide">Name</th>
            <th className="text-left px-4 py-3 font-semibold text-xs text-gray-500 uppercase tracking-wide">Slug</th>
            <th className="text-left px-4 py-3 font-semibold text-xs text-gray-500 uppercase tracking-wide">Status</th>
            <th className="px-4 py-3" />
          </tr></thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? Array.from({ length: 4 }).map((_, i) => <tr key={i}><td colSpan={4} className="px-4 py-3"><Skeleton className="h-5 w-full" /></td></tr>)
              : items.map(s => (
                <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium">{s.name}</td>
                  <td className="px-4 py-3"><code className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{s.slug}</code></td>
                  <td className="px-4 py-3"><span className="text-[10px] font-bold px-2 py-0.5 rounded-full th-bg">{s.is_active ? "active" : "inactive"}</span></td>
                  <td className="px-4 py-3"><div className="flex gap-1 justify-end"><button onClick={() => setConfirmId(s.id)} disabled={deleting === s.id} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-40">{deleting === s.id ? <LoadingDots size="xs" /> : <Trash2 size={13} />}</button></div></td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── ADMIN TAGS ───────────────────────────────────────────────────────────────

function AdminTags() {
  const [items, setItems] = useState<TagType[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [newName, setNewName] = useState("");

  useEffect(() => { api.getTags().then(d => { setItems(d); setLoading(false); }); }, []);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    const { data } = await api.createTag({ name: newName, slug: toSlug(newName) });
    if (data) { setItems(p => [...p, data as TagType]); setAdding(false); setNewName(""); }
    setSaving(false);
  };

  const handleDelete = async (id: number) => {
    setConfirmId(null);
    setDeleting(id);
    await api.deleteTag(id);
    setItems(p => p.filter(x => x.id !== id));
    setDeleting(null);
  };

  const confirmItem = items.find(x => x.id === confirmId);

  return (
    <div>
      <ConfirmDialog
        open={confirmId !== null}
        title="Delete tag?"
        message={`"${confirmItem?.name}" will be permanently deleted and removed from all posts.`}
        onConfirm={() => confirmId !== null && handleDelete(confirmId)}
        onCancel={() => setConfirmId(null)}
      />
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold tracking-tight">Tags</h1><p className="text-sm text-gray-500 mt-0.5">{items.length} tags</p></div>
        <Btn size="sm" onClick={() => setAdding(true)}><Plus size={14} /> Add Tag</Btn>
      </div>
      {adding && (
        <div className="mb-4 p-4 bg-white border border-black/[0.08] rounded-xl flex gap-3 items-end">
          <div className="flex-1"><AdminInputField label="Name" value={newName} onChange={setNewName} placeholder="Tag name" /></div>
          <Btn onClick={handleAdd} disabled={saving}>{saving ? <LoadingDots size="xs" /> : "Add"}</Btn>
          <Btn variant="secondary" onClick={() => setAdding(false)}>Cancel</Btn>
        </div>
      )}
      <div className="bg-white border border-black/[0.08] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-100 bg-gray-50">
            <th className="text-left px-4 py-3 font-semibold text-xs text-gray-500 uppercase tracking-wide">Name</th>
            <th className="text-left px-4 py-3 font-semibold text-xs text-gray-500 uppercase tracking-wide">Slug</th>
            <th className="px-4 py-3" />
          </tr></thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? Array.from({ length: 5 }).map((_, i) => <tr key={i}><td colSpan={3} className="px-4 py-3"><Skeleton className="h-5 w-full" /></td></tr>)
              : items.map(t => (
                <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium">{t.name}</td>
                  <td className="px-4 py-3"><code className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{t.slug}</code></td>
                  <td className="px-4 py-3"><div className="flex gap-1 justify-end"><button onClick={() => setConfirmId(t.id)} disabled={deleting === t.id} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-40">{deleting === t.id ? <LoadingDots size="xs" /> : <Trash2 size={13} />}</button></div></td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── ADMIN USERS ──────────────────────────────────────────────────────────────

function AdminUsers() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [toggling, setToggling] = useState<string | null>(null);
  const [confirmUser, setConfirmUser] = useState<Profile | null>(null);

  useEffect(() => { api.getUsers().then(d => { setUsers(d); setLoading(false); }); }, []);

  const toggleActive = async (u: Profile) => {
    setConfirmUser(null);
    setToggling(u.id);
    await api.setUserActive(u.id, !u.is_active);
    await api.logActivity(`${u.is_active ? "Disabled" : "Enabled"} user: ${u.first_name} ${u.last_name}`, "Users");
    setUsers(p => p.map(x => x.id === u.id ? { ...x, is_active: !x.is_active } : x));
    setToggling(null);
  };

  const filtered = users.filter(u => !q || `${u.first_name} ${u.last_name}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      <ConfirmDialog
        open={confirmUser !== null}
        title={confirmUser?.is_active ? "Disable user?" : "Enable user?"}
        message={confirmUser?.is_active
          ? `${confirmUser?.first_name} ${confirmUser?.last_name} will be blocked from signing in.`
          : `${confirmUser?.first_name} ${confirmUser?.last_name} will be able to sign in again.`}
        confirmLabel={confirmUser?.is_active ? "Disable" : "Enable"}
        danger={!!confirmUser?.is_active}
        onConfirm={() => confirmUser && toggleActive(confirmUser)}
        onCancel={() => setConfirmUser(null)}
      />
      <div className="flex items-center justify-between mb-6"><div><h1 className="text-2xl font-bold tracking-tight">Users</h1><p className="text-sm text-gray-500 mt-0.5">{loading ? "Loading…" : `${users.length} registered users`}</p></div></div>
      <div className="mb-4"><div className="relative max-w-sm"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search users…" className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:border-black transition-colors" /></div></div>
      <div className="bg-white border border-black/[0.08] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-4 py-3 font-semibold text-xs text-gray-500 uppercase tracking-wide">User</th>
              <th className="text-left px-4 py-3 font-semibold text-xs text-gray-500 uppercase tracking-wide hidden sm:table-cell">Mobile</th>
              <th className="text-left px-4 py-3 font-semibold text-xs text-gray-500 uppercase tracking-wide">Role</th>
              <th className="text-left px-4 py-3 font-semibold text-xs text-gray-500 uppercase tracking-wide">Status</th>
              <th className="text-left px-4 py-3 font-semibold text-xs text-gray-500 uppercase tracking-wide hidden lg:table-cell">Joined</th>
              <th className="px-4 py-3" />
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? Array.from({ length: 5 }).map((_, i) => <tr key={i}><td colSpan={6} className="px-4 py-3"><Skeleton className="h-5 w-full" /></td></tr>)
                : filtered.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3"><div className="flex items-center gap-2.5"><div className="w-7 h-7 rounded-full th-bg text-xs font-bold flex items-center justify-center flex-none">{u.first_name[0]?.toUpperCase()}</div><span className="font-medium">{u.first_name} {u.last_name}</span></div></td>
                    <td className="px-4 py-3 text-xs text-gray-500 hidden sm:table-cell">{u.mobile_number || "—"}</td>
                    <td className="px-4 py-3"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${u.role === "superadmin" ? "th-bg" : "bg-gray-100 text-gray-500"}`}>{u.role === "superadmin" ? "Admin" : "User"}</span></td>
                    <td className="px-4 py-3"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${u.is_active ? "th-bg" : "bg-gray-100 text-gray-400"}`}>{u.is_active ? "active" : "disabled"}</span></td>
                    <td className="px-4 py-3 text-xs text-gray-400 hidden lg:table-cell">{fmtShort(u.created_at)}</td>
                    <td className="px-4 py-3"><div className="flex gap-1 justify-end"><button onClick={() => setConfirmUser(u)} disabled={toggling === u.id} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-black transition-colors disabled:opacity-40" title={u.is_active ? "Disable" : "Enable"}>{toggling === u.id ? <LoadingDots size="xs" /> : u.is_active ? <UserX size={13} /> : <UserCheck size={13} />}</button></div></td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── ADMIN FEEDBACK ───────────────────────────────────────────────────────────

function AdminFeedback() {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { api.getFeedback().then(d => { setItems(d); setLoading(false); }); }, []);

  const markRead = async (id: number) => {
    await api.updateFeedbackStatus(id, "read");
    setItems(p => p.map(f => f.id === id ? { ...f, status: "read" as const } : f));
  };

  const archive = async (id: number) => {
    await api.updateFeedbackStatus(id, "archived");
    setItems(p => p.map(f => f.id === id ? { ...f, status: "archived" as const } : f));
  };

  const remove = async (id: number) => {
    await api.deleteFeedbackItem(id);
    setItems(p => p.filter(f => f.id !== id));
  };

  return (
    <div>
      <div className="mb-6"><h1 className="text-2xl font-bold tracking-tight">Feedback</h1><p className="text-sm text-gray-500 mt-0.5">{loading ? "Loading…" : `${items.filter(f => f.status === "unread").length} unread messages`}</p></div>
      {loading ? <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}</div>
        : items.length === 0 ? <EmptyState icon={<MessageSquare size={24} />} title="No feedback yet" desc="Submitted feedback will appear here." />
          : (
            <div className="space-y-3">
              {items.map(f => (
                <div key={f.id} className={`bg-white border rounded-xl p-5 transition-all ${f.status === "unread" ? "border-black/20" : "border-black/[0.06]"}`}>
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <div className="flex items-center gap-2"><p className="font-semibold text-sm">{f.name}</p>{f.status === "unread" && <span className="text-[10px] font-bold px-2 py-0.5 th-bg rounded-full">new</span>}</div>
                      <p className="text-xs text-gray-500">{f.email} · {fmtDate(f.created_at)}</p>
                    </div>
                    <div className="flex gap-1">
                      {f.status === "unread" && <button onClick={() => markRead(f.id)} className="text-xs font-medium text-gray-500 hover:text-black transition-colors flex-none px-2 py-1 rounded hover:bg-gray-100">Mark read</button>}
                      {f.status !== "archived" && <button onClick={() => archive(f.id)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-black transition-colors" title="Archive"><Archive size={13} /></button>}
                      <button onClick={() => remove(f.id)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-red-500 transition-colors" title="Delete"><Trash2 size={13} /></button>
                    </div>
                  </div>
                  <p className="font-medium text-sm mb-1">{f.subject}</p>
                  <p className="text-sm text-gray-600 leading-relaxed">{f.message}</p>
                </div>
              ))}
            </div>
          )}
    </div>
  );
}

// ─── ADMIN STATIC PAGES ───────────────────────────────────────────────────────

function AdminStaticPages() {
  const [pages, setPages] = useState<StaticPageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<StaticPageItem | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.getStaticPages().then(d => { setPages(d); setLoading(false); }); }, []);

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    await api.updateStaticPage(editing.id, { title: editing.title, content: editing.content, is_published: editing.is_published });
    await api.logActivity(`Updated static page: ${editing.title}`, "Static Pages");
    setPages(p => p.map(x => x.id === editing.id ? editing : x));
    setEditing(null); setSaving(false);
  };

  if (editing) return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => setEditing(null)} className="p-1.5 rounded-lg hover:bg-gray-100"><ArrowLeft size={16} /></button>
        <h1 className="text-2xl font-bold tracking-tight">Edit: {editing.title}</h1>
      </div>
      <div className="max-w-3xl bg-white border border-black/[0.08] rounded-xl p-6 space-y-4">
        <AdminInputField label="Title" value={editing.title} onChange={v => setEditing(e => e ? { ...e, title: v } : e)} />
        <div className="flex flex-col gap-1.5"><label className="text-sm font-semibold">Content</label><textarea value={editing.content ?? ""} onChange={e => setEditing(x => x ? { ...x, content: e.target.value } : x)} rows={16} className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-black transition-colors resize-none" /></div>
        <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={editing.is_published} onChange={e => setEditing(x => x ? { ...x, is_published: e.target.checked } : x)} className="w-4 h-4 rounded accent-black" /><span className="text-sm font-medium">Published</span></label>
        <div className="flex gap-2"><Btn onClick={handleSave} disabled={saving}>{saving ? <LoadingDots size="xs" /> : <Save size={13} />} Save</Btn><Btn variant="secondary" onClick={() => setEditing(null)}>Cancel</Btn></div>
      </div>
    </div>
  );

  return (
    <div>
      <div className="mb-6"><h1 className="text-2xl font-bold tracking-tight">Static Pages</h1><p className="text-sm text-gray-500 mt-0.5">Manage editable public pages</p></div>
      <div className="bg-white border border-black/[0.08] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-100 bg-gray-50">
            <th className="text-left px-4 py-3 font-semibold text-xs text-gray-500 uppercase tracking-wide">Page</th>
            <th className="text-left px-4 py-3 font-semibold text-xs text-gray-500 uppercase tracking-wide hidden sm:table-cell">Slug</th>
            <th className="text-left px-4 py-3 font-semibold text-xs text-gray-500 uppercase tracking-wide">Status</th>
            <th className="text-left px-4 py-3 font-semibold text-xs text-gray-500 uppercase tracking-wide hidden md:table-cell">Updated</th>
            <th className="px-4 py-3" />
          </tr></thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? Array.from({ length: 4 }).map((_, i) => <tr key={i}><td colSpan={5} className="px-4 py-3"><Skeleton className="h-5 w-full" /></td></tr>)
              : pages.map(p => (
                <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium">{p.title}</td>
                  <td className="px-4 py-3 hidden sm:table-cell"><code className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{p.slug}</code></td>
                  <td className="px-4 py-3"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${p.is_published ? "th-bg" : "bg-gray-100 text-gray-500"}`}>{p.is_published ? "published" : "draft"}</span></td>
                  <td className="px-4 py-3 text-xs text-gray-400 hidden md:table-cell">{fmtShort(p.updated_at)}</td>
                  <td className="px-4 py-3"><div className="flex gap-1 justify-end"><button onClick={() => setEditing(p)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-black transition-colors"><Edit2 size={13} /></button></div></td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── ADMIN SITE SETTINGS ──────────────────────────────────────────────────────

function AdminSiteSettings() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { api.getSiteSettings().then(d => { setSettings(d); setLoading(false); }); }, []);

  const set = (key: string) => (v: string) => { setSettings(s => ({ ...s, [key]: v })); setSaved(false); };

  const handleSave = async () => {
    setSaving(true);
    await api.upsertSettings(settings);
    await api.logActivity("Updated site settings", "Settings");
    setSaving(false); setSaved(true);
  };

  if (loading) return <div className="space-y-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>;

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="bg-white border border-black/[0.08] rounded-xl p-5 sm:p-6 space-y-4">
      <h2 className="font-semibold text-base">{title}</h2>{children}
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold tracking-tight">Site Settings</h1><p className="text-sm text-gray-500 mt-0.5">Manage global website configuration</p></div>
        <Btn onClick={handleSave} disabled={saving}>{saving ? <LoadingDots size="xs" /> : <Save size={13} />} Save Changes</Btn>
      </div>
      {saved && <div className="mb-5 flex items-center gap-2 p-3 th-bg rounded-xl text-sm"><Check size={14} /> Settings saved successfully.</div>}
      <div className="space-y-5">
        <Section title="General">
          <AdminInputField label="Site Name" value={settings.site_name ?? ""} onChange={set("site_name")} />
          <AdminInputField label="Site Tagline" value={settings.site_tagline ?? ""} onChange={set("site_tagline")} />
          <AdminInputField label="Contact Email" type="email" value={settings.contact_email ?? ""} onChange={set("contact_email")} />
        </Section>
        <Section title="Homepage">
          <AdminInputField label="Hero Title" value={settings.hero_title ?? ""} onChange={set("hero_title")} />
          <div className="flex flex-col gap-1.5"><label className="text-sm font-semibold">Hero Subtitle</label><textarea value={settings.hero_subtitle ?? ""} onChange={e => set("hero_subtitle")(e.target.value)} rows={3} className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-black transition-colors resize-none" /></div>
        </Section>
        <Section title="Footer">
          <div className="flex flex-col gap-1.5"><label className="text-sm font-semibold">Footer Description</label><textarea value={settings.footer_desc ?? ""} onChange={e => set("footer_desc")(e.target.value)} rows={3} className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-black transition-colors resize-none" /></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <AdminInputField label="Phone Number" value={settings.phone ?? ""} onChange={set("phone")} />
            <AdminInputField label="Address" value={settings.address ?? ""} onChange={set("address")} />
          </div>
          <AdminInputField label="Copyright Text" value={settings.copyright ?? ""} onChange={set("copyright")} />
        </Section>
        <Section title="Social Links">
          {[{ label: "Facebook", key: "facebook", icon: Facebook }, { label: "X (Twitter)", key: "twitter", icon: Twitter }, { label: "Instagram", key: "instagram", icon: Instagram }, { label: "YouTube", key: "youtube", icon: Youtube }, { label: "LinkedIn", key: "linkedin", icon: Linkedin }].map(s => (
            <div key={s.key} className="flex items-center gap-3"><s.icon size={16} className="text-gray-400 flex-none" /><input value={settings[s.key] ?? ""} onChange={e => set(s.key)(e.target.value)} placeholder={`${s.label} URL`} className="flex-1 px-3.5 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-black transition-colors" /></div>
          ))}
        </Section>
        <Section title="SEO">
          <AdminInputField label="Default Meta Title" value={settings.meta_title ?? ""} onChange={set("meta_title")} />
          <div className="flex flex-col gap-1.5"><label className="text-sm font-semibold">Default Meta Description</label><textarea value={settings.meta_desc ?? ""} onChange={e => set("meta_desc")(e.target.value)} rows={3} placeholder="Default SEO description…" className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-black transition-colors resize-none" /></div>
        </Section>
      </div>
    </div>
  );
}

// ─── ADMIN ACTIVITY LOGS ──────────────────────────────────────────────────────

function AdminActivityLogs() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { api.getActivityLogs().then(d => { setLogs(d); setLoading(false); }); }, []);

  return (
    <div>
      <div className="mb-6"><h1 className="text-2xl font-bold tracking-tight">Activity Logs</h1><p className="text-sm text-gray-500 mt-0.5">Read-only audit trail of admin actions</p></div>
      <div className="bg-white border border-black/[0.08] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-4 py-3 font-semibold text-xs text-gray-500 uppercase tracking-wide">User</th>
              <th className="text-left px-4 py-3 font-semibold text-xs text-gray-500 uppercase tracking-wide">Action</th>
              <th className="text-left px-4 py-3 font-semibold text-xs text-gray-500 uppercase tracking-wide hidden sm:table-cell">Module</th>
              <th className="text-left px-4 py-3 font-semibold text-xs text-gray-500 uppercase tracking-wide">Date</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? Array.from({ length: 5 }).map((_, i) => <tr key={i}><td colSpan={4} className="px-4 py-3"><Skeleton className="h-5 w-full" /></td></tr>)
                : logs.length === 0 ? <tr><td colSpan={4} className="px-4 py-10 text-center text-sm text-gray-400">No activity logged yet.</td></tr>
                  : logs.map(l => (
                    <tr key={l.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3"><div className="flex items-center gap-2"><Shield size={13} className="text-gray-400 flex-none" /><span className="font-medium text-sm">{l.user_name ?? "Admin"}</span></div></td>
                      <td className="px-4 py-3 text-sm text-gray-700">{l.action}</td>
                      <td className="px-4 py-3 hidden sm:table-cell"><span className="text-[11px] font-medium px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">{l.module}</span></td>
                      <td className="px-4 py-3 text-xs text-gray-400">{fmtDate(l.created_at)}</td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── ADMIN PROFILE ────────────────────────────────────────────────────────────

function AdminProfile({ userId }: { userId: string | null }) {
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", mobile: "" });
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pwForm, setPwForm] = useState({ newPw: "", confirm: "" });
  const [showPw, setShowPw] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    if (!userId) return;
    const storedUser = getStoredUser();
    api.getProfile(userId).then(p => {
      if (p) setForm({ firstName: p.first_name, lastName: p.last_name, mobile: p.mobile_number ?? "", email: p.email ?? storedUser?.email ?? "" });
      setLoading(false);
    });
  }, [userId]);

  const handleSave = async () => {
    if (!userId) return;
    await api.updateProfile(userId, { first_name: form.firstName, last_name: form.lastName, mobile_number: form.mobile });
    await api.logActivity("Updated admin profile", "Profile");
    setSaved(true);
  };

  const handleUpdatePw = async () => {
    setPwMsg(null);
    if (!pwForm.newPw || pwForm.newPw.length < 8) { setPwMsg({ type: "err", text: "Password must be at least 8 characters." }); return; }
    if (pwForm.newPw !== pwForm.confirm) { setPwMsg({ type: "err", text: "Passwords do not match." }); return; }
    setPwLoading(true);
    const { error } = await api.changePassword(pwForm.newPw);
    setPwLoading(false);
    if (error) { setPwMsg({ type: "err", text: error.message }); return; }
    await api.logActivity("Changed admin password", "Profile");
    setPwMsg({ type: "ok", text: "Password updated successfully." });
    setPwForm({ newPw: "", confirm: "" });
  };

  if (loading) return <div className="space-y-4"><Skeleton className="h-8 w-1/3" /><Skeleton className="h-48 w-full max-w-xl" /></div>;

  return (
    <div>
      <div className="mb-6"><h1 className="text-2xl font-bold tracking-tight">Profile</h1><p className="text-sm text-gray-500 mt-0.5">Manage your admin account</p></div>
      <div className="max-w-xl space-y-5">
        <div className="bg-white border border-black/[0.08] rounded-xl p-5 sm:p-6">
          <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-100">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-black flex items-center justify-center text-white text-xl sm:text-2xl font-bold flex-none">{form.firstName[0]?.toUpperCase() ?? "A"}</div>
            <div><p className="font-bold text-base sm:text-lg">{form.firstName} {form.lastName}</p><p className="text-sm text-gray-500 break-all">{form.email}</p><Pill label="Super Admin" dark /></div>
          </div>
          {saved && <div className="flex items-center gap-2 p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm mb-4"><Check size={14} /> Profile updated.</div>}
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <AdminInputField label="First Name" value={form.firstName} onChange={v => { setForm(f => ({ ...f, firstName: v })); setSaved(false); }} />
              <AdminInputField label="Last Name" value={form.lastName} onChange={v => { setForm(f => ({ ...f, lastName: v })); setSaved(false); }} />
            </div>
            <AdminInputField label="Email" type="email" value={form.email} onChange={() => {}} disabled />
            <PhoneField value={form.mobile} onChange={v => { setForm(f => ({ ...f, mobile: sanitizePhone(v) })); setSaved(false); }} />
            <Btn onClick={handleSave}>Save Changes</Btn>
          </div>
        </div>
        <div className="bg-white border border-black/[0.08] rounded-xl p-5 sm:p-6">
          <h2 className="font-semibold text-base mb-4">Change Password</h2>
          {pwMsg && (
            <div className={`flex items-center gap-2 p-3 rounded-lg text-sm mb-4 ${pwMsg.type === "ok" ? "bg-gray-50 border border-gray-200" : "bg-red-50 border border-red-200 text-red-700"}`}>
              {pwMsg.type === "ok" ? <Check size={14} /> : <AlertCircle size={14} />} {pwMsg.text}
            </div>
          )}
          <div className="space-y-3">
            <InputField label="New Password" value={pwForm.newPw} onChange={v => { setPwForm(f => ({ ...f, newPw: v })); setPwMsg(null); }} placeholder="At least 8 characters" showToggle isPasswordVisible={showPw} onToggle={() => setShowPw(s => !s)} />
            <InputField label="Confirm New Password" value={pwForm.confirm} onChange={v => { setPwForm(f => ({ ...f, confirm: v })); setPwMsg(null); }} placeholder="Repeat new password" showToggle isPasswordVisible={showPw} onToggle={() => setShowPw(s => !s)} />
            <Btn onClick={handleUpdatePw} disabled={pwLoading}>
              {pwLoading ? "Updating…" : "Update Password"}
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── APP ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [page, setPage] = useState<Page>("home");
  const [role, setRole] = useState<Role>("guest");
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set());
  const [selectedSlug, setSelectedSlug] = useState<string>("");
  const [authModal, setAuthModal] = useState<{ open: boolean; step: AuthStep }>({ open: false, step: "email" });
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [resetTokenType, setResetTokenType] = useState<"registration" | "reset" | null>(null);
  const [resetTokenExpired, setResetTokenExpired] = useState<{ type: "registration" | "reset" } | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const { dismissed, dismiss } = useCookieNotice();

  const [appTheme, setAppTheme] = useState<ThemeId>(() => {
    try { return (localStorage.getItem(THEME_KEY) as ThemeId) ?? "classic"; } catch { return "classic"; }
  });

  // When profile loads, override theme with the server-stored value
  useEffect(() => {
    if (profile?.theme && THEMES.find(t => t.id === profile.theme)) {
      const t = profile.theme as ThemeId;
      setAppTheme(t);
      applyTheme(t);
    }
  }, [profile?.theme]);

  // Reset to default theme on logout (userId → null)
  useEffect(() => {
    if (userId === null && !sessionLoading) {
      setAppTheme("classic");
      applyTheme("classic");
      try { localStorage.removeItem(THEME_KEY); } catch { /* noop */ }
    }
  }, [userId, sessionLoading]);

  useEffect(() => { applyTheme(appTheme); }, [appTheme]);

  const handleSetTheme = (id: ThemeId) => {
    setAppTheme(id);
    applyTheme(id);
    // Logged-in: persist to profile so it syncs across devices
    if (userId) {
      api.updateProfile(userId, { theme: id });
    } else {
      // Guest: persist to localStorage only
      try { localStorage.setItem(THEME_KEY, id); } catch { /* noop */ }
    }
  };

  // Set page title, favicon, and AdSense ownership meta tag on first mount
  useEffect(() => {
    document.title = "EduHubPH";

    // Favicon
    const existingIcon = document.querySelector("link[rel~='icon']");
    if (!existingIcon) {
      const link = document.createElement("link");
      link.rel = "icon";
      link.type = "image/svg+xml";
      link.href = "/favicon.svg";
      document.head.appendChild(link);
    } else {
      (existingIcon as HTMLLinkElement).href = "/favicon.svg";
      (existingIcon as HTMLLinkElement).type = "image/svg+xml";
    }

    // Google AdSense site ownership verification
    if (!document.querySelector("meta[name='google-adsense-account']")) {
      const meta = document.createElement("meta");
      meta.name = "google-adsense-account";
      meta.content = "ca-pub-5466628256819321";
      document.head.appendChild(meta);
    }
  }, []);

  // Inject AdSense script on first mount
  useEffect(() => { injectAdSenseScript(); }, []);

  // Detect password reset token in URL (?reset=TOKEN)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("reset");
    if (!token) return;
    window.history.replaceState({}, "", window.location.pathname);
    api.validateResetToken(token).then(({ data }) => {
      if (data?.valid) {
        setResetToken(token);
        setResetTokenType(data.tokenType ?? "reset");
        setResetTokenExpired(null);
      } else {
        // Token expired or already used — don't show the form, show expired state
        setResetToken(null);
        setResetTokenType(null);
        setResetTokenExpired({ type: data?.tokenType ?? "reset" });
      }
      setAuthModal({ open: true, step: "forgot" });
    }).catch(() => {
      // Network error — fall back to letting the server reject it on submit
      setResetToken(token);
      setResetTokenType("reset");
      setAuthModal({ open: true, step: "forgot" });
    });
  }, []);

  // Scroll to top on every page change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [page]);

  // Favicon — use the full EduHub wordmark logo
  useEffect(() => {
    const existing = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
    const link: HTMLLinkElement = existing ?? document.createElement("link");
    link.rel = "icon"; link.type = "image/svg+xml"; link.href = "/favicon.svg";
    if (!existing) document.head.appendChild(link);
  }, []);

  // Restore session on load from localStorage JWT
  useEffect(() => {
    const storedUser = getStoredUser();
    if (!storedUser) { setSessionLoading(false); return; }
    api.getProfile(storedUser.id).then(async (p) => {
      if (p && p.is_active) {
        setUserId(storedUser.id);
        setProfile(p);
        setRole(p.role as Role);
        if (p.role === "user") {
          const ids = await api.getSavedPostIds(storedUser.id);
          setSavedIds(new Set(ids));
        }
      } else {
        clearAuth();
      }
      setSessionLoading(false);
    }).catch(() => { clearAuth(); setSessionLoading(false); });
  }, []);

  const openAuth = (step: AuthStep = "email") => setAuthModal({ open: true, step });
  const closeAuth = () => {
    setAuthModal(m => ({ ...m, open: false }));
    setResetToken(null);
    setResetTokenType(null);
    setResetTokenExpired(null);
  };

  const handleAuthSuccess = async (r: Role, uid: string, p: Profile) => {
    setRole(r); setUserId(uid); setProfile(p);
    if (r === "user") {
      const ids = await api.getSavedPostIds(uid);
      setSavedIds(new Set(ids));
    }
    if (r === "superadmin") setPage("admin-dashboard");
  };

  const onSave = async (postId: number) => {
    if (!userId) { openAuth("email"); return; }
    if (savedIds.has(postId)) {
      await api.unsavePost(userId, postId);
      setSavedIds(p => { const n = new Set(p); n.delete(postId); return n; });
    } else {
      await api.savePost(userId, postId);
      setSavedIds(p => new Set([...p, postId]));
    }
  };

  const isAdminPage = page.startsWith("admin");

  if (sessionLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <LoadingDots size="md" className="text-gray-300" />
    </div>
  );

  const renderPage = () => {
    if (isAdminPage) {
      // Defense-in-depth: role is server-derived (fetched via JWT), but guard
      // here prevents rendering admin UI if state is ever inconsistent.
      if (role !== "superadmin") { setPage("home"); return null; }
      const content = (() => {
        if (page === "admin-dashboard") return <AdminDashboard setPage={setPage} />;
        if (page === "admin-content") return <ContentManagement setPage={setPage} />;
        if (page === "admin-create-post") return <AdminCreatePost setPage={setPage} />;
        if (page === "admin-categories") return <AdminCategories />;
        if (page === "admin-subjects") return <AdminSubjects />;
        if (page === "admin-tags") return <AdminTags />;
        if (page === "admin-users") return <AdminUsers />;
        if (page === "admin-feedback") return <AdminFeedback />;
        if (page === "admin-static-pages") return <AdminStaticPages />;
        if (page === "admin-site-settings") return <AdminSiteSettings />;
        if (page === "admin-activity-logs") return <AdminActivityLogs />;
        if (page === "admin-profile") return <AdminProfile userId={userId} />;
        if (page === "admin-tools") return <ToolsPage setPage={setPage} isAdmin />;
        return null;
      })();
      return <AdminLayout page={page} setPage={setPage} setRole={setRole} setUserId={setUserId}>{content}</AdminLayout>;
    }
    if (page === "home") return <HomePage setPage={setPage} setSelectedSlug={setSelectedSlug} savedIds={savedIds} onSave={onSave} role={role} />;
    if (page === "resources") return <PostsListPage title="Resources" typeFilter="resource" setPage={setPage} setSelectedSlug={setSelectedSlug} savedIds={savedIds} onSave={onSave} role={role} />;
    if (page === "opportunities") return <PostsListPage title="Opportunities" typeFilter="opportunity" setPage={setPage} setSelectedSlug={setSelectedSlug} savedIds={savedIds} onSave={onSave} role={role} />;
    if (page === "post-detail") return <PostDetailPage slug={selectedSlug} setPage={setPage} savedIds={savedIds} onSave={onSave} role={role} />;
    if (page === "feedback") return <FeedbackPage />;
    if (page === "saved-posts") return <SavedPostsPage setPage={setPage} setSelectedSlug={setSelectedSlug} userId={userId} savedIds={savedIds} onSave={onSave} role={role} />;
    if (page === "profile") return <UserProfilePage userId={userId} />;
    if (page === "account-settings") return <AccountSettingsPage theme={appTheme} setTheme={handleSetTheme} />;
    if (page === "about") return <AboutPage setPage={setPage} />;
    if (page === "tools") return <ToolsPage setPage={setPage} />;
    if (page === "privacy") return <StaticPage slug="privacy" setPage={setPage} />;
    if (page === "terms") return <StaticPage slug="terms" setPage={setPage} />;
    return null;
  };

  return (
    <div style={{ fontFamily: "'Poppins', sans-serif", backgroundColor: "var(--th-p-bg)" }} className="min-h-screen flex flex-col text-black">
      {!isAdminPage && <Navbar page={page} role={role} profile={profile} setPage={setPage} setRole={setRole} setUserId={setUserId} openAuth={openAuth} appTheme={appTheme} />}
      <main className="flex-1"><ErrorBoundary>{renderPage()}</ErrorBoundary></main>
      {!isAdminPage && <Footer setPage={setPage} role={role} />}
      {authModal.open && <AuthModal initialStep={authModal.step} onClose={closeAuth} onSuccess={handleAuthSuccess} resetToken={resetToken} resetTokenType={resetTokenType} tokenExpired={resetTokenExpired} />}
      {!dismissed && (
        <CookieNotice
          onDismiss={(advertising) => { dismiss(advertising); if (advertising) injectAdSenseScript(); }}
          onViewPolicy={() => { setPage("privacy"); dismiss(true); }}
        />
      )}
    </div>
  );
}
