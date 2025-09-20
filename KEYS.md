# Secret Management Documentation

## Overview
This application uses secure Linux environment variables to manage API keys and secrets, keeping them separate from the codebase.

## Secure Files Location

### Main Application Secrets
- **Location**: `/etc/cbthis/env`
- **Permissions**: `600` (owner read/write only)
- **Contains**: API keys for OpenAI, Anthropic, Google, Redis password

### RAG Service Secrets  
- **Location**: `/etc/cbthis/rag-env`
- **Permissions**: `600` (owner read/write only)
- **Contains**: API keys for RAG service (OpenAI, Anthropic, Google)

## Managing Secrets

### Initial Setup or Update Keys
```bash
# Interactive script to set/update all secrets
./scripts/setup-secrets.sh
```

### Manual Update
```bash
# Edit main application secrets
sudo nano /etc/cbthis/env

# Edit RAG service secrets
sudo nano /etc/cbthis/rag-env

# Ensure proper permissions after editing
sudo chmod 600 /etc/cbthis/env
sudo chmod 600 /etc/cbthis/rag-env
```

### Restart Services After Key Changes
```bash
# Use the convenience script
./scripts/restart-services.sh

# Or manually:
pm2 restart all --update-env
cd rag-service && ./start-secure.sh
```

## Security Scripts

### Check for Exposed Secrets
```bash
# Run before committing code
./scripts/check-secrets.sh
```

### Setup New Environment
```bash
# Interactive setup wizard
./scripts/setup-secrets.sh
```

### Restart All Services
```bash
# Restart with updated environment
./scripts/restart-services.sh
```

## Required API Keys

1. **OpenAI API Key** (`OPENAI_API_KEY`)
   - Get from: https://platform.openai.com/api-keys
   - Used for: GPT models

2. **Anthropic API Key** (`ANTHROPIC_API_KEY`)
   - Get from: https://console.anthropic.com/
   - Used for: Claude models

3. **Google Gemini API Key** (`GEMINI_API_KEY`)
   - Get from: https://makersuite.google.com/app/apikey
   - Used for: Gemini models

4. **Google Maps API Key** (`GOOGLE_MAPS_API_KEY`, `VITE_GOOGLE_MAPS_API_KEY`)
   - Get from: https://console.cloud.google.com/
   - Used for: Distance calculations

5. **Redis Password** (`REDIS_PASSWORD`)
   - Generated locally
   - Used for: Cache authentication

## Environment Files Structure

### `/etc/cbthis/env` Format
```bash
# API Keys - SENSITIVE
OPENAI_API_KEY=your-key-here
ANTHROPIC_API_KEY=your-key-here
GEMINI_API_KEY=your-key-here
GOOGLE_MAPS_API_KEY=your-key-here
VITE_GOOGLE_MAPS_API_KEY=your-key-here

# Database Passwords - SENSITIVE
REDIS_PASSWORD=your-password-here
```

### Repository Files (NO SECRETS)
- `.env` - Non-sensitive configuration only
- `.env.template` - Template for developers
- `rag-service/.env` - RAG configuration without secrets

## Security Best Practices

### Key Rotation
- **Frequency**: Every 90 days
- **Process**:
  1. Generate new keys from provider dashboards
  2. Update `/etc/cbthis/env` and `/etc/cbthis/rag-env`
  3. Run `./scripts/restart-services.sh`
  4. Verify services are working
  5. Revoke old keys

### Backup
```bash
# Backup secrets (store securely!)
sudo cp /etc/cbthis/env /secure/backup/location/env.$(date +%Y%m%d)
sudo cp /etc/cbthis/rag-env /secure/backup/location/rag-env.$(date +%Y%m%d)
```

### Access Control
- Only root and application user should access `/etc/cbthis/`
- Never commit secrets to Git
- Use `.gitignore` to exclude sensitive files
- Run `./scripts/check-secrets.sh` before commits

## Troubleshooting

### Services Not Loading Keys
```bash
# Check if files exist and have correct permissions
ls -la /etc/cbthis/

# Verify keys are loaded
pm2 logs cf-travel-bot | grep "secure environment"

# Check RAG service logs
tail -f /var/log/cbthis/rag.log
```

### API Errors After Setup
1. Verify keys are correctly formatted in `/etc/cbthis/env`
2. Check for extra spaces or quotes around keys
3. Ensure all required keys are present
4. Restart services: `./scripts/restart-services.sh`

### Permission Denied Errors
```bash
# Fix permissions
sudo chown root:root /etc/cbthis/*
sudo chmod 600 /etc/cbthis/*
```

## Emergency Recovery

If services won't start after changes:

1. **Restore from backup**:
   ```bash
   sudo cp .env.backup.* .env
   pm2 restart all
   ```

2. **Check logs**:
   ```bash
   pm2 logs --lines 50
   tail -f /var/log/cbthis/rag.log
   ```

3. **Verify environment loading**:
   ```bash
   # Test loading manually
   source /etc/cbthis/env
   echo $OPENAI_API_KEY | head -c 10
   ```

## Development vs Production

### Development
- Can use `.env.development` for local testing
- Use test/sandbox API keys
- Lower rate limits acceptable

### Production  
- MUST use `/etc/cbthis/` secure files
- Use production API keys with proper limits
- Enable all security features
- Regular key rotation mandatory

## Monitoring

### Check Service Health
```bash
curl http://localhost:3000/health
curl http://localhost:8000/api/v1/health
```

### Monitor API Usage
- OpenAI: https://platform.openai.com/usage
- Anthropic: https://console.anthropic.com/usage
- Google: https://console.cloud.google.com/apis/dashboard

### Alert on Issues
Set up monitoring for:
- Failed API calls
- Rate limit errors
- Invalid key errors
- Unusual usage patterns

## Important Notes

⚠️ **NEVER**:
- Commit API keys to Git
- Share keys via email/chat
- Use production keys in development
- Log API keys in application logs

✅ **ALWAYS**:
- Use secure environment files
- Rotate keys regularly
- Monitor usage and costs
- Keep backups of configuration
- Run security checks before commits
