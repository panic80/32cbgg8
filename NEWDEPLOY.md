# Complete Deployment Guide for 32cbgg8.com

## Server Information

### VPS Specifications

- **Provider**: Hostinger VPS
- **IP Address**: 46.202.177.230
- **Domain**: 32cbgg8.com
- **OS**: Ubuntu 24.04.2 LTS
- **CPU**: AMD EPYC 9354P 32-Core Processor (2 cores allocated)
- **RAM**: 8GB total (7GB available)
- **Storage**: 96GB total, 83GB available
- **Current Usage**: ~14% disk, ~1GB RAM used

### Pre-installed Software

- **Node.js**: v20.18.3
- **npm**: 11.1.0
- **Python**: 3.12.3
- **Nginx**: 1.24.0
- **PM2**: 5.4.3
- **SSL**: Let's Encrypt certificates already configured

### Missing Components

- **Redis**: Not installed (required for caching)
- **Container runtime**: None installed (deployment relies on PM2/systemd)
- **Python venv**: Needs setup for RAG service

### Current Deployment Status

- **Existing deployment**: `/home/root/apps/cf-travel-bot/current` (PM2 managed)
- **Old deployment**: `/var/www/32cbgg8.com` (outdated)
- **Nginx**: Configured and running with SSL
- **PM2**: Running 1 instance using ~73MB RAM

## Optimal Resource Allocation

Based on 2 CPU cores and 8GB RAM:

```
Service          | CPU | Memory | Instances/Workers
-----------------|-----|--------|------------------
Node.js (PM2)    | 50% | 2-3GB  | 2 instances
RAG Service      | 30% | 2GB    | 2 workers
Redis            | 10% | 1GB    | 1 instance
System/Buffer    | 10% | 2GB    | -
```

## Deployment Strategy

### Phase 1: Preparation and Backup

```bash
# 1. SSH into server
ssh root@46.202.177.230

# 2. Backup current deployment
pm2 save
cp -r /home/root/apps/cf-travel-bot/current /home/root/apps/cf-travel-bot/backup-$(date +%Y%m%d)

# 3. Create new deployment directory
mkdir -p /var/www/cbthis
mkdir -p /var/log/cbthis
mkdir -p /etc/cbthis

# 4. Set permissions
chown -R www-data:www-data /var/www/cbthis
chown -R www-data:www-data /var/log/cbthis
```

### Phase 2: Install Missing Dependencies

```bash
# 1. Install Redis
apt update
apt install -y redis-server

# 2. Configure Redis for production
cat > /etc/redis/redis.conf.local << 'EOF'
# Memory management
maxmemory 1gb
maxmemory-policy allkeys-lru

# Persistence
appendonly yes
appendfsync everysec

# Performance
tcp-keepalive 60
timeout 300

# Security
protected-mode yes
bind 127.0.0.1 ::1
EOF

# 3. Include local config
echo "include /etc/redis/redis.conf.local" >> /etc/redis/redis.conf

# 4. Start Redis
systemctl restart redis-server
systemctl enable redis-server

# 5. Install Python dependencies for RAG
apt install -y python3-venv python3-dev build-essential
```

### Phase 3: Deploy Application Files

#### Option A: Using Git (Recommended)

```bash
cd /var/www
git clone https://github.com/yourusername/cbthis.git
cd cbthis
```

#### Option B: Using SCP from local machine

```bash
# From your local machine
cd /Users/mattermost/Projects/32cbgg8/cbthis

# Create deployment package
tar -czf cbthis-deploy.tar.gz \
  --exclude=node_modules \
  --exclude=.git \
  --exclude=.env \
  --exclude=venv \
  --exclude=__pycache__ \
  --exclude=logs \
  --exclude=chroma_db \
  .

# Transfer to VPS
scp cbthis-deploy.tar.gz root@46.202.177.230:/tmp/

# On VPS
cd /var/www/cbthis
tar -xzf /tmp/cbthis-deploy.tar.gz
rm /tmp/cbthis-deploy.tar.gz
```

### Phase 4: Configure Environment

```bash
# 1. Create production .env file
cat > /var/www/cbthis/.env << 'EOF'
# Environment
NODE_ENV=production
PORT=3000

# API Keys (replace with your actual keys)
GEMINI_API_KEY=your_gemini_key_here
OPENAI_API_KEY=your_openai_key_here
ANTHROPIC_API_KEY=your_anthropic_key_here
GOOGLE_MAPS_API_KEY=your_google_maps_key_here

# Redis
REDIS_URL=redis://localhost:6379
ENABLE_CACHE=true
CACHE_TTL=3600000

# Rate Limiting
ENABLE_RATE_LIMIT=true
RATE_LIMIT_MAX=60
RATE_LIMIT_WINDOW=60000

# RAG Service
RAG_SERVICE_URL=http://localhost:8000

# Production URLs
VITE_API_BASE_URL=https://32cbgg8.com
CANADA_CA_URL=https://www.canada.ca/en/department-national-defence/services/benefits-military/pay-pension-benefits/benefits/canadian-forces-temporary-duty-travel-instructions.html
EOF

# 2. Set permissions
chmod 600 /var/www/cbthis/.env
chown www-data:www-data /var/www/cbthis/.env
```

### Phase 5: Setup Node.js Application

```bash
cd /var/www/cbthis

# 1. Install dependencies
npm ci --production

# 2. Build frontend
npm run build:production

# 3. Update PM2 ecosystem config
cat > ecosystem.config.cjs << 'EOF'
module.exports = {
  apps: [{
    name: 'cf-travel-bot',
    script: './server/main.js',
    cwd: '/var/www/cbthis',
    instances: 2,  // Use both CPU cores
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    max_memory_restart: '2G',
    error_file: '/var/log/cbthis/pm2-error.log',
    out_file: '/var/log/cbthis/pm2-out.log',
    merge_logs: true,
    autorestart: true,
    watch: false,
    restart_delay: 4000
  }]
};
EOF
```

### Phase 6: Setup RAG Service

```bash
cd /var/www/cbthis/rag-service

# 1. Create virtual environment
python3 -m venv venv
source venv/bin/activate

# 2. Install dependencies
pip install --upgrade pip
pip install -r requirements.txt

# 3. Create directories
mkdir -p chroma_db logs

# 4. Create systemd service
cat > /etc/systemd/system/cbthis-rag.service << 'EOF'
[Unit]
Description=CF Travel Bot RAG Service
After=network.target redis.service
Requires=redis.service

[Service]
Type=notify
User=www-data
Group=www-data
WorkingDirectory=/var/www/cbthis/rag-service
Environment="PATH=/var/www/cbthis/rag-service/venv/bin:/usr/local/bin:/usr/bin:/bin"
Environment="PYTHONPATH=/var/www/cbthis/rag-service"
EnvironmentFile=/var/www/cbthis/.env
ExecStart=/var/www/cbthis/rag-service/venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 2
Restart=always
RestartSec=10
StandardOutput=append:/var/log/cbthis/rag-service.log
StandardError=append:/var/log/cbthis/rag-service-error.log
LimitNOFILE=65536
MemoryLimit=2G

[Install]
WantedBy=multi-user.target
EOF

# 5. Set permissions
chown -R www-data:www-data /var/www/cbthis/rag-service

# 6. Enable service
systemctl daemon-reload
systemctl enable cbthis-rag.service
```

### Phase 7: Configure Nginx

```bash
# 1. Backup existing config
cp /etc/nginx/sites-available/32cbgg8.com /etc/nginx/sites-available/32cbgg8.com.backup

# 2. Update nginx config
cat > /etc/nginx/sites-available/cbthis << 'EOF'
# Upstream definitions
upstream app_backend {
    server localhost:3000 max_fails=3 fail_timeout=30s;
    keepalive 32;
}

upstream rag_backend {
    server localhost:8000 max_fails=3 fail_timeout=30s;
    keepalive 16;
}

# Rate limiting
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=30r/m;
limit_req_zone $binary_remote_addr zone=general_limit:10m rate=100r/m;

# HTTP redirect
server {
    listen 80;
    listen [::]:80;
    server_name 32cbgg8.com www.32cbgg8.com;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name 32cbgg8.com www.32cbgg8.com;

    # SSL (managed by Certbot)
    ssl_certificate /etc/letsencrypt/live/32cbgg8.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/32cbgg8.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Security headers
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    # Logging
    access_log /var/log/nginx/32cbgg8.com.access.log;
    error_log /var/log/nginx/32cbgg8.com.error.log;

    # Root directory
    root /var/www/cbthis/dist;

    # Compression
    gzip on;
    gzip_types text/plain text/css text/xml text/javascript application/json application/javascript;

    # Main application
    location / {
        limit_req zone=general_limit burst=20 nodelay;
        proxy_pass http://app_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_buffering off;
    }

    # API endpoints
    location /api/ {
        limit_req zone=api_limit burst=10 nodelay;
        proxy_pass http://app_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # RAG service
    location /api/rag/ {
        limit_req zone=api_limit burst=5 nodelay;
        rewrite ^/api/rag/(.*) /$1 break;
        proxy_pass http://rag_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 600s;
    }

    # Health check
    location /health {
        access_log off;
        proxy_pass http://app_backend/health;
    }

    # Static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

# 3. Enable new config
ln -sf /etc/nginx/sites-available/cbthis /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/32cbgg8.com

# 4. Test nginx config
nginx -t
```

### Phase 8: Start Services

```bash
# 1. Stop old deployment
pm2 stop all
pm2 delete all

# 2. Start services in order
systemctl start redis-server
systemctl start cbthis-rag

# 3. Start Node.js app with PM2
cd /var/www/cbthis
pm2 start ecosystem.config.cjs --env production
pm2 save
pm2 startup systemd -u www-data --hp /home/www-data

# 4. Reload nginx
systemctl reload nginx
```

### Phase 9: Verify Deployment

```bash
# 1. Check service status
systemctl status redis-server
systemctl status cbthis-rag
pm2 status

# 2. Test endpoints
curl -I https://32cbgg8.com
curl http://localhost:3000/health
curl http://localhost:8000/api/v1/health

# 3. Check logs
tail -f /var/log/cbthis/pm2-out.log
tail -f /var/log/cbthis/rag-service.log

# 4. Monitor resources
htop
```

## Post-Deployment Tasks

### 1. Setup Log Rotation

```bash
cat > /etc/logrotate.d/cbthis << 'EOF'
/var/log/cbthis/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data www-data
    sharedscripts
    postrotate
        systemctl reload cbthis-rag >/dev/null 2>&1 || true
        pm2 reloadLogs >/dev/null 2>&1 || true
    endscript
}
EOF
```

### 2. Setup Monitoring

```bash
# Install monitoring tools
apt install -y htop iotop nethogs

# Setup PM2 monitoring
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 100M
pm2 set pm2-logrotate:retain 7
```

### 3. Security Hardening

```bash
# Install fail2ban
apt install -y fail2ban

# Configure fail2ban for nginx
cat > /etc/fail2ban/jail.local << 'EOF'
[nginx-limit-req]
enabled = true
filter = nginx-limit-req
logpath = /var/log/nginx/*error.log
maxretry = 10
findtime = 60
bantime = 3600
EOF

systemctl restart fail2ban
```

## Troubleshooting

### Common Issues and Solutions

1. **RAG Service Won't Start**

```bash
# Check Python environment
/var/www/cbthis/rag-service/venv/bin/python --version
# Check for missing dependencies
/var/www/cbthis/rag-service/venv/bin/pip list
# Check service logs
journalctl -u cbthis-rag -n 50
```

2. **PM2 Process Crashes**

```bash
# Check PM2 logs
pm2 logs cf-travel-bot --lines 100
# Increase memory limit if needed
pm2 set cf-travel-bot:max_memory_restart 3G
pm2 restart cf-travel-bot
```

3. **502 Bad Gateway**

```bash
# Check if services are running
netstat -tlnp | grep -E ':3000|:8000'
# Check nginx error log
tail -f /var/log/nginx/32cbgg8.com.error.log
```

4. **Redis Connection Issues**

```bash
# Test Redis connection
redis-cli ping
# Check Redis logs
journalctl -u redis-server -n 50
```

## Rollback Procedure

If deployment fails:

```bash
# 1. Stop new services
pm2 stop all
systemctl stop cbthis-rag

# 2. Restore old deployment
cd /home/root/apps/cf-travel-bot
pm2 start current/ecosystem.config.cjs

# 3. Restore nginx config
cp /etc/nginx/sites-available/32cbgg8.com.backup /etc/nginx/sites-available/32cbgg8.com
ln -sf /etc/nginx/sites-available/32cbgg8.com /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/cbthis
systemctl reload nginx
```

## Maintenance Commands

```bash
# View logs
pm2 logs
tail -f /var/log/cbthis/*.log

# Restart services
pm2 restart all
systemctl restart cbthis-rag

# Update application
cd /var/www/cbthis
git pull
npm ci --production
npm run build:production
pm2 reload ecosystem.config.cjs

# Clear cache
redis-cli FLUSHALL

# Check disk usage
df -h
du -sh /var/www/cbthis/*
```

## Performance Optimization

1. **Enable PM2 Cluster Mode**: Already configured with 2 instances
2. **Redis Persistence**: AOF enabled for reliability
3. **Nginx Caching**: Static assets cached for 1 year
4. **Rate Limiting**: Configured to prevent abuse
5. **Resource Limits**: Memory limits set for all services

## Security Checklist

- [ ] Environment variables secured (chmod 600)
- [ ] Services running as non-root user (www-data)
- [ ] Firewall configured (UFW)
- [ ] SSL certificates valid
- [ ] Rate limiting enabled
- [ ] Fail2ban configured
- [ ] Log rotation configured
- [ ] Sensitive files protected in nginx

## Monitoring URLs

- **Main Application**: https://32cbgg8.com
- **Health Check**: https://32cbgg8.com/health
- **PM2 Monitoring**: `pm2 monit`
- **System Resources**: `htop`
- **Nginx Access Logs**: `tail -f /var/log/nginx/32cbgg8.com.access.log`

## Contact Information

- **Server IP**: 46.202.177.230
- **Domain**: 32cbgg8.com
- **SSH Access**: `ssh root@46.202.177.230`

---

Last Updated: June 28, 2025
