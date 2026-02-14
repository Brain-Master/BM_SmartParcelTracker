# Production Deployment Guide

## Prerequisites

- Docker and Docker Compose
- Domain name with DNS configured
- SSL certificates (Let's Encrypt recommended)

## Setup Steps

### 1. Create Secrets

```bash
# Create secrets directory
mkdir -p secrets

# Generate strong passwords
openssl rand -hex 32 > secrets/db_password.txt
openssl rand -hex 32 > secrets/jwt_secret.txt

# Set proper permissions
chmod 600 secrets/*.txt
```

### 2. Environment Variables

Create `.env.prod` file:

```bash
# Database
DB_USER=postgres
DB_PASSWORD=your_strong_password
DB_NAME=smart_parcel

# Redis
REDIS_PASSWORD=your_redis_password

# Backend
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Monitoring (optional)
SENTRY_DSN=your_sentry_dsn
```

### 3. SSL Certificates

#### Option A: Let's Encrypt with Certbot

```bash
# Create nginx/ssl directory
mkdir -p nginx/ssl

# Get certificates (adjust email and domain)
docker run -it --rm \
  -v $(pwd)/nginx/ssl:/etc/letsencrypt \
  certbot/certbot certonly \
  --standalone \
  --email your@email.com \
  -d yourdomain.com \
  -d www.yourdomain.com

# Link certificates
ln -s /etc/letsencrypt/live/yourdomain.com/fullchain.pem nginx/ssl/
ln -s /etc/letsencrypt/live/yourdomain.com/privkey.pem nginx/ssl/
```

#### Option B: Self-signed (Development Only)

```bash
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/ssl/privkey.pem \
  -out nginx/ssl/fullchain.pem
```

### 4. Database Migrations

```bash
# Run migrations
docker-compose -f docker-compose.prod.yml run --rm backend \
  alembic upgrade head
```

### 5. Start Services

```bash
# Pull images
docker-compose -f docker-compose.prod.yml pull

# Start services
docker-compose -f docker-compose.prod.yml up -d

# Check status
docker-compose -f docker-compose.prod.yml ps
docker-compose -f docker-compose.prod.yml logs -f
```

### 6. Create Admin User

```bash
# Access backend container
docker-compose -f docker-compose.prod.yml exec backend bash

# Create admin user (implement user creation script)
python scripts/create_admin.py
```

## Monitoring

### Health Checks

- Backend: `https://yourdomain.com/health`
- Database: Check Docker health status
- Nginx: Check access logs

### Logs

```bash
# All services
docker-compose -f docker-compose.prod.yml logs -f

# Specific service
docker-compose -f docker-compose.prod.yml logs -f backend
docker-compose -f docker-compose.prod.yml logs -f nginx
```

## Backups

### Database Backup

```bash
# Manual backup
docker-compose -f docker-compose.prod.yml exec db \
  pg_dump -U postgres smart_parcel > backup_$(date +%Y%m%d).sql

# Restore
docker-compose -f docker-compose.prod.yml exec -T db \
  psql -U postgres smart_parcel < backup_20260214.sql
```

### Automated Backups

Add cron job:

```bash
# Daily backup at 2 AM
0 2 * * * cd /path/to/project && docker-compose -f docker-compose.prod.yml exec -T db pg_dump -U postgres smart_parcel | gzip > /backups/db_$(date +\%Y\%m\%d).sql.gz
```

## Security Checklist

- [ ] Strong passwords for all services
- [ ] SSL certificates configured
- [ ] Firewall configured (only 80, 443 open)
- [ ] Rate limiting enabled
- [ ] CORS origins restricted
- [ ] Security headers enabled
- [ ] Secrets not in version control
- [ ] Regular backups configured
- [ ] Monitoring and alerting set up
- [ ] Log rotation configured

## Updating

```bash
# Pull latest code
git pull origin main

# Rebuild images
docker-compose -f docker-compose.prod.yml build

# Apply migrations
docker-compose -f docker-compose.prod.yml run --rm backend alembic upgrade head

# Restart services
docker-compose -f docker-compose.prod.yml up -d
```

## Troubleshooting

### Backend won't start

```bash
# Check logs
docker-compose -f docker-compose.prod.yml logs backend

# Check database connection
docker-compose -f docker-compose.prod.yml exec backend \
  python -c "from app.core.database import engine; print('OK')"
```

### Database connection issues

```bash
# Check database is running
docker-compose -f docker-compose.prod.yml ps db

# Check database logs
docker-compose -f docker-compose.prod.yml logs db
```

### Nginx issues

```bash
# Test configuration
docker-compose -f docker-compose.prod.yml exec nginx nginx -t

# Reload configuration
docker-compose -f docker-compose.prod.yml exec nginx nginx -s reload
```

## Performance Tuning

### Database

- Adjust PostgreSQL `max_connections`
- Configure connection pooling in backend
- Set up read replicas for scaling

### Backend

- Increase worker processes (Gunicorn/Uvicorn)
- Configure Redis caching
- Enable Celery for background tasks

### Frontend

- Enable CDN for static assets
- Configure browser caching
- Optimize bundle size
