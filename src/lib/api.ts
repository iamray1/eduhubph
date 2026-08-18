import { apiFetch, setAuth, clearAuth, getStoredUser, type AuthUser } from "./auth";

// ─── TYPES ────────────────────────────────────────────────────────────────────

export interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  middle_name: string | null;
  mobile_number: string | null;
  role: "user" | "superadmin";
  is_active: boolean;
  email?: string;
  theme?: string;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  type: "resource" | "opportunity";
  description: string | null;
  is_active: boolean;
  sort_order: number;
}

export interface Subject {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
}

export interface Tag {
  id: number;
  name: string;
  slug: string;
}

export interface Post {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string | null;
  cover_image: string | null;
  category_id: number | null;
  subject_id: number | null;
  author_id: string | null;
  type: "resource" | "opportunity";
  status: "draft" | "published" | "archived";
  is_featured: boolean;
  published_at: string | null;
  meta_title: string | null;
  meta_description: string | null;
  created_at: string;
  updated_at: string;
  categories: Category | null;
  subjects: Subject | null;
}

export interface FeedbackItem {
  id: number;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: "unread" | "read" | "archived";
  created_at: string;
}

export interface StaticPageItem {
  id: number;
  title: string;
  slug: string;
  content: string | null;
  meta_title: string | null;
  meta_description: string | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface ActivityLog {
  id: number;
  user_id: string | null;
  user_name: string | null;
  action: string;
  module: string | null;
  ip_address: string | null;
  created_at: string;
}

export interface DashboardStats {
  totalUsers: number;
  publishedPosts: number;
  draftPosts: number;
  featuredPosts: number;
  resourcePosts: number;
  opportunityPosts: number;
  totalSaved: number;
  totalFeedback: number;
  unreadFeedback: number;
}

// ─── AUTH ─────────────────────────────────────────────────────────────────────

export async function signIn(email: string, password: string) {
  const result = await apiFetch<{ token: string; user: AuthUser }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  if (result.data) setAuth(result.data.token, result.data.user);
  return result;
}

export function signOut() {
  clearAuth();
  return Promise.resolve({ error: null });
}

export function getSession() {
  const user = getStoredUser();
  if (!user) return Promise.resolve({ data: { session: null }, error: null });
  return Promise.resolve({
    data: { session: { user: { id: user.id, email: user.email } } },
    error: null,
  });
}

export async function registerUser(
  email: string,
  meta: { first_name: string; last_name: string; middle_name?: string; mobile_number?: string }
) {
  return apiFetch("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, ...meta }),
  });
}

export async function checkAccount(email: string) {
  return apiFetch<{ status: "active" | "pending" | "disabled" | "not_found" }>(
    "/auth/check-account",
    { method: "POST", body: JSON.stringify({ email }) }
  );
}

export async function resendActivation(email: string) {
  return apiFetch<{ message: string }>("/auth/resend-activation", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function validateResetToken(token: string) {
  return apiFetch<{ valid: boolean; reason?: string; tokenType?: "registration" | "reset" | null }>(
    `/auth/validate-reset-token?token=${encodeURIComponent(token)}`
  );
}

export async function forgotPassword(email: string) {
  return apiFetch("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword(token: string, password: string) {
  return apiFetch("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, password }),
  });
}

export async function changePassword(newPassword: string, currentPassword?: string) {
  return apiFetch("/auth/password", {
    method: "PATCH",
    body: JSON.stringify({ newPassword, currentPassword }),
  });
}

// ─── PROFILES ─────────────────────────────────────────────────────────────────

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data } = await apiFetch<Profile>(`/profiles/${userId}`);
  return data;
}

export async function updateProfile(userId: string, updates: Partial<Profile>) {
  return apiFetch<Profile>(`/profiles/${userId}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

// ─── DASHBOARD STATS ──────────────────────────────────────────────────────────

export async function getDashboardStats(): Promise<DashboardStats> {
  const { data } = await apiFetch<DashboardStats>("/dashboard/stats");
  return data ?? {
    totalUsers: 0, publishedPosts: 0, draftPosts: 0, featuredPosts: 0,
    resourcePosts: 0, opportunityPosts: 0, totalSaved: 0, totalFeedback: 0, unreadFeedback: 0,
  };
}

export async function getChartData() {
  const { data } = await apiFetch<{
    newUsers: { label: string; v: number }[];
    postsMonthly: { month: string; posts: number }[];
    typeDist: { name: string; value: number }[];
    catDist: { name: string; count: number }[];
  }>("/dashboard/charts");
  return data ?? { newUsers: [], postsMonthly: [], typeDist: [], catDist: [] };
}

// ─── POSTS ────────────────────────────────────────────────────────────────────

export async function getPosts(filters?: {
  type?: string; status?: string; category_id?: number; subject_id?: number;
  search?: string; is_featured?: boolean; limit?: number;
}) {
  const params = new URLSearchParams();
  if (filters?.type)        params.set("type",        filters.type);
  if (filters?.status)      params.set("status",      filters.status);
  if (filters?.category_id) params.set("category_id", String(filters.category_id));
  if (filters?.subject_id)  params.set("subject_id",  String(filters.subject_id));
  if (filters?.search)      params.set("search",      filters.search);
  if (filters?.is_featured !== undefined) params.set("is_featured", String(filters.is_featured));
  if (filters?.limit)       params.set("limit",       String(filters.limit));

  const qs = params.toString();
  const { data, error } = await apiFetch<Post[]>(`/posts${qs ? "?" + qs : ""}`);
  return { data: Array.isArray(data) ? data : [], error };
}

export async function getPostBySlug(slug: string): Promise<Post | null> {
  const { data } = await apiFetch<Post>(`/posts/slug/${slug}`);
  return data;
}

export async function createPost(post: {
  title: string; slug: string; excerpt?: string; content?: string;
  category_id?: number; subject_id?: number; type: string; status: string;
  is_featured?: boolean; published_at?: string; meta_title?: string; meta_description?: string;
}) {
  return apiFetch<Post>("/posts", { method: "POST", body: JSON.stringify(post) });
}

export async function updatePost(id: number, updates: Partial<Post>) {
  return apiFetch<Post>(`/posts/${id}`, { method: "PATCH", body: JSON.stringify(updates) });
}

export async function deletePost(id: number) {
  return apiFetch(`/posts/${id}`, { method: "DELETE" });
}

// ─── CATEGORIES ───────────────────────────────────────────────────────────────

export async function getCategories(activeOnly = false): Promise<Category[]> {
  const { data } = await apiFetch<Category[]>(`/categories${activeOnly ? "?active=true" : ""}`);
  return Array.isArray(data) ? data : [];
}

export async function createCategory(cat: { name: string; slug: string; type: string; description?: string; is_active?: boolean; sort_order?: number }) {
  return apiFetch<Category>("/categories", { method: "POST", body: JSON.stringify(cat) });
}

export async function updateCategory(id: number, updates: Partial<Category>) {
  return apiFetch<Category>(`/categories/${id}`, { method: "PATCH", body: JSON.stringify(updates) });
}

export async function deleteCategory(id: number) {
  return apiFetch(`/categories/${id}`, { method: "DELETE" });
}

// ─── SUBJECTS ─────────────────────────────────────────────────────────────────

export async function getSubjects(activeOnly = false): Promise<Subject[]> {
  const { data } = await apiFetch<Subject[]>(`/subjects${activeOnly ? "?active=true" : ""}`);
  return Array.isArray(data) ? data : [];
}

export async function createSubject(sub: { name: string; slug: string; description?: string; is_active?: boolean; sort_order?: number }) {
  return apiFetch<Subject>("/subjects", { method: "POST", body: JSON.stringify(sub) });
}

export async function updateSubject(id: number, updates: Partial<Subject>) {
  return apiFetch<Subject>(`/subjects/${id}`, { method: "PATCH", body: JSON.stringify(updates) });
}

export async function deleteSubject(id: number) {
  return apiFetch(`/subjects/${id}`, { method: "DELETE" });
}

// ─── TAGS ─────────────────────────────────────────────────────────────────────

export async function getTags(): Promise<Tag[]> {
  const { data } = await apiFetch<Tag[]>("/tags");
  return Array.isArray(data) ? data : [];
}

export async function createTag(tag: { name: string; slug: string }) {
  return apiFetch<Tag>("/tags", { method: "POST", body: JSON.stringify(tag) });
}

export async function deleteTag(id: number) {
  return apiFetch(`/tags/${id}`, { method: "DELETE" });
}

// ─── SAVED POSTS ──────────────────────────────────────────────────────────────

export async function getSavedPostIds(_userId: string): Promise<number[]> {
  const { data } = await apiFetch<number[]>("/saved-posts/ids");
  return Array.isArray(data) ? data : [];
}

export async function getSavedPosts(_userId: string): Promise<Post[]> {
  const { data } = await apiFetch<Post[]>("/saved-posts");
  return Array.isArray(data) ? data : [];
}

export async function savePost(_userId: string, postId: number) {
  return apiFetch("/saved-posts", { method: "POST", body: JSON.stringify({ post_id: postId }) });
}

export async function unsavePost(_userId: string, postId: number) {
  return apiFetch(`/saved-posts/${postId}`, { method: "DELETE" });
}

// ─── FEEDBACK ─────────────────────────────────────────────────────────────────

export async function submitFeedback(data: { name: string; email: string; subject: string; message: string }) {
  return apiFetch("/feedback", { method: "POST", body: JSON.stringify(data) });
}

export async function getFeedback(): Promise<FeedbackItem[]> {
  const { data } = await apiFetch<FeedbackItem[]>("/feedback");
  return Array.isArray(data) ? data : [];
}

export async function updateFeedbackStatus(id: number, status: "read" | "archived" | "unread") {
  return apiFetch(`/feedback/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
}

export async function deleteFeedbackItem(id: number) {
  return apiFetch(`/feedback/${id}`, { method: "DELETE" });
}

// ─── USERS ────────────────────────────────────────────────────────────────────

export async function getUsers(): Promise<Profile[]> {
  const { data } = await apiFetch<Profile[]>("/users");
  return Array.isArray(data) ? data : [];
}

export async function setUserActive(userId: string, isActive: boolean) {
  return apiFetch(`/users/${userId}/active`, {
    method: "PATCH",
    body: JSON.stringify({ is_active: isActive }),
  });
}

// ─── ACTIVITY LOGS ────────────────────────────────────────────────────────────

export async function getActivityLogs(): Promise<ActivityLog[]> {
  const { data } = await apiFetch<ActivityLog[]>("/activity-logs");
  return Array.isArray(data) ? data : [];
}

export async function logActivity(action: string, module: string) {
  return apiFetch("/activity-logs", {
    method: "POST",
    body: JSON.stringify({ action, module }),
  });
}

// ─── STATIC PAGES ─────────────────────────────────────────────────────────────

export async function getStaticPages(): Promise<StaticPageItem[]> {
  const { data } = await apiFetch<StaticPageItem[]>("/static-pages");
  return Array.isArray(data) ? data : [];
}

export async function getStaticPageBySlug(slug: string): Promise<StaticPageItem | null> {
  const { data } = await apiFetch<StaticPageItem>(`/static-pages/${slug}`);
  return data;
}

export async function updateStaticPage(id: number, updates: Partial<StaticPageItem>) {
  return apiFetch(`/static-pages/${id}`, { method: "PATCH", body: JSON.stringify(updates) });
}

// ─── SITE SETTINGS ────────────────────────────────────────────────────────────

export async function getSiteSettings(): Promise<Record<string, string>> {
  const { data } = await apiFetch<Record<string, string>>("/site-settings");
  return data ?? {};
}

export async function upsertSetting(key: string, value: string) {
  return apiFetch("/site-settings", { method: "PUT", body: JSON.stringify({ [key]: value }) });
}

export async function upsertSettings(settings: Record<string, string>) {
  return apiFetch("/site-settings", { method: "PUT", body: JSON.stringify(settings) });
}
