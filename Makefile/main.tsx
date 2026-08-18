# ============================================================
# EduHub PH — Makefile
# Run from /var/www/eduhub
# ============================================================

APP_DIR   := /var/www/eduhub
API_NAME  := eduhub-api
DB_NAME   := eduhub
DB_USER   := eduhub

.PHONY: build reload logs status restart db-shell db-backup api-logs api-restart update clean help

## Build frontend and restart API
build:
	@echo "▶ Installing frontend deps..."
	pnpm install --frozen-lockfile
	@echo "▶ Building React app..."
	pnpm build
	@echo "✓ Build complete → dist/"

## Reload Nginx config
reload:
	sudo nginx -t && sudo systemctl reload nginx
	@echo "✓ Nginx reloaded"

## Watch Nginx logs
logs:
	sudo tail -f /var/log/nginx/eduhub.access.log /var/log/nginx/eduhub.error.log

## Check all service status
status:
	@echo "── Nginx ──────────────────────────────"
	@sudo systemctl is-active nginx && echo "  nginx: running" || echo "  nginx: STOPPED"
	@echo "── PM2 API Server ─────────────────────"
	@pm2 show $(API_NAME) 2>/dev/null || echo "  $(API_NAME): NOT running"
	@echo "── PostgreSQL ─────────────────────────"
	@sudo systemctl is-active postgresql && echo "  postgresql: running" || echo "  postgresql: STOPPED"
	@echo "── Cloudflared ────────────────────────"
	@sudo systemctl is-active cloudflared && echo "  cloudflared: running" || echo "  cloudflared: STOPPED"

## Restart all services
restart:
	sudo systemctl restart nginx
	pm2 restart $(API_NAME)
	@echo "✓ Nginx + API restarted"

## Open PostgreSQL shell
db-shell:
	sudo -u postgres psql -d $(DB_NAME)

## Backup database
db-backup:
	@mkdir -p $(APP_DIR)/backups
	@FILE=$(APP_DIR)/backups/eduhub_$$(date +%Y%m%d_%H%M%S).sql; \
	sudo -u postgres pg_dump $(DB_NAME) > $$FILE && \
	echo "✓ Backup saved: $$FILE"

## Watch API server logs
api-logs:
	pm2 logs $(API_NAME)

## Restart API server only
api-restart:
	pm2 restart $(API_NAME)
	@echo "✓ API server restarted"

## Pull latest code, rebuild, reload
update:
	@echo "▶ Pulling latest code..."
	git pull
	@echo "▶ Installing server deps..."
	cd server && npm install --production && cd ..
	@$(MAKE) build
	pm2 restart $(API_NAME)
	sudo systemctl reload nginx
	@echo "✓ Update complete"

## Remove build artifacts
clean:
	rm -rf dist node_modules server/node_modules

## Show this help
help:
	@echo ""
	@echo "EduHub PH — Available Commands"
	@echo ""
	@echo "  make build        Rebuild frontend"
	@echo "  make reload       Reload Nginx"
	@echo "  make logs         Watch Nginx logs"
	@echo "  make status       Check all services"
	@echo "  make restart      Restart Nginx + API"
	@echo "  make db-shell     Open PostgreSQL shell"
	@echo "  make db-backup    Backup database"
	@echo "  make api-logs     Watch API server logs"
	@echo "  make api-restart  Restart API server"
	@echo "  make update       Pull + rebuild + reload"
	@echo "  make clean        Remove build artifacts"
	@echo ""
