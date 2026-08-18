#!/bin/bash
# ============================================================
# EduHub PH — Server-side Deploy Script
# Run this ON THE SERVER to pull latest code and redeploy:
#   cd /var/www/eduhub
#   ./deploy.sh
# ============================================================

set -e

APP_DIR="/var/www/eduhub"
cd "$APP_DIR"

GREEN='\033[0;32m'; BLUE='\033[0;34m'; BOLD='\033[1m'; NC='\033[0m'
info()    { echo -e "${BLUE}▶  $1${NC}"; }
success() { echo -e "${GREEN}✓  $1${NC}"; }

info "Pulling latest code from GitHub..."
git pull origin main
success "Code updated"

info "Running DB migrations..."
for f in "$APP_DIR"/db/migrations/*.sql; do
  sudo -u postgres psql -U postgres -d eduhub -f "$f" 2>/dev/null || true
done
success "Migrations applied"

info "Installing server dependencies..."
cd "$APP_DIR/server"
npm install --production
cd "$APP_DIR"
success "Server deps ready"

info "Installing frontend dependencies..."
pnpm install --no-frozen-lockfile
success "Frontend deps ready"

info "Building frontend..."
pnpm build
success "Frontend built → dist/"

info "Restarting API server..."
pm2 restart eduhub-api || pm2 start server/index.js --name eduhub-api --env production
pm2 save
success "API server restarted"

info "Applying Nginx config..."
sudo cp "$APP_DIR/nginx.conf" /etc/nginx/sites-available/eduhub
sudo ln -sf /etc/nginx/sites-available/eduhub /etc/nginx/sites-enabled/eduhub
sudo rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
sudo nginx -t && sudo systemctl reload nginx
success "Nginx reloaded with latest config"

echo ""
echo -e "${GREEN}${BOLD}✓ Deploy complete! Site is live at https://eduhubph.tech${NC}"
pm2 status
