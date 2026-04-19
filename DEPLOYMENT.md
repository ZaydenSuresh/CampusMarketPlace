# Azure Deployment Guide - Campus Marketplace

## Project Overview
- **Project**: Campus Marketplace (Project Brief 6 - Campus Marketplace)
- **Stack**: Node.js/Express + Supabase (Backend), Static HTML/CSS/JS (Frontend)
- **Features**: Item listings, trade facility management, messaging, payments, ratings

## Prerequisites
- Azure subscription
- GitHub repository (for CI/CD)
- Supabase project deployed

---

## Step 1: Prepare for Azure Deployment

### 1.1 Update Environment Variables for Production
Create a `.env.production` file (DO NOT commit this):
```env
PORT=3000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_DB_PASSWORD=your_db_password
SUPABASE_DIRECT_URL=postgresql://postgres:your_password@db.your-project.supabase.co:5432/postgres
```

### 1.2 Update server.js for Production
The server already uses `process.env.PORT || 3000` - no changes needed.

---

## Step 2: Deploy via Azure Portal (Web App)

### 2.1 Create Azure Resources
1. Go to [Azure Portal](https://portal.azure.com)
2. Create **App Service** (Web App):
   - **Publish**: Code
   - **Runtime stack**: Node 20 LTS
   - **OS**: Linux
   - **Region**: Use one of: eastus, eastus2, westus2, centralus, westeurope, australiaeast (check which is allowed by your subscription)
   - **App Service Plan**: Free tier (F1) for dev

### 2.2 Configure Application Settings
In Azure Portal → Your App Service → **Configuration**:
Add these **Application Settings**:
| Name | Value |
|------|-------|
| `SUPABASE_URL` | `https://kaqxuufmifrtvxpycevo.supabase.co` |
| `SUPABASE_ANON_KEY` | Your anon key from Supabase |
| `SUPABASE_DB_PASSWORD` | Your database password |
| `SUPABASE_DIRECT_URL` | Your Supabase direct URL |
| `PORT` | `8080` (Azure uses this) |

### 2.3 Deployment
- **Deployment method**: GitHub Actions (recommended) or Local Git
- For GitHub: Connect your repo, Azure will auto-detect Node.js and create workflow

---

## Step 3: Deploy via Azure CLI

```bash
# Login
az login

# Create resource group
az group create --name campus-marketplace --location southafricanorth

# Create App Service plan
az appservice plan create --name campus-marketplace-plan --resource-group campus-marketplace --sku F1

# Create Web App
az webapp create --name campus-marketplace-app --resource-group campus-marketplace --plan campus-marketplace-plan --runtime "NODE:20"

# Set environment variables
az webapp config appsettings set --name campus-marketplace-app --resource-group campus-marketplace --settings SUPABASE_URL="https://kaqxuufmifrtvxpycevo.supabase.co" SUPABASE_ANON_KEY="your_key" PORT=8080

# Deploy from local git
az webapp deployment source config-local-git --name campus-marketplace-app --resource-group campus-marketplace
```

---

## Step 4: CI/CD with GitHub Actions

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Azure

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        run: npm test
      
      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: build
          path: .
          
  deploy:
    needs: build
    runs-on: ubuntu-latest
    
    steps:
      - name: Download artifacts
        uses: actions/download-artifact@v4
        with:
          name: build
          
      - name: Azure Login
        uses: azure/login@v2
        with:
          creds: ${{ secrets.AZURE_CREDENTIALS }}
          
      - name: Azure Web App
        uses: azure/webapps-deploy@v3
        with:
          app-name: campus-marketplace-app
          slot-name: production
          package: .
```

### Add Azure Credentials to GitHub
1. Create Service Principal:
   ```bash
   az ad sp create-for-rbac --name "campus-marketplace-cd" --role contributor --scopes /subscriptions/YOUR_SUB_ID/resourceGroups/campus-marketplace
   ```
2. Add to GitHub Secrets: `AZURE_CREDENTIALS` = JSON output

---

## Step 5: Verify Deployment

### Health Check
After deployment, verify:
```
GET https://your-app.azurewebsites.net/health
```

Response should be:
```json
{"ok": true, "service": "campus-marketplace-api"}
```

### Test Database Connection
```
GET https://your-app.azurewebsites.net/db-check
```

---

## Step 6: Custom Domain (Optional)

1. Go to Azure Portal → Your App Service → **Custom domains**
2. Add your custom domain
3. Update DNS records as instructed

---

## Troubleshooting

### Common Issues
1. **500 Error on startup**: Check environment variables in Azure Configuration
2. **Database connection failed**: Verify SUPABASE_DIRECT_URL is correct
3. **Static files not loading**: Check that `app.use(express.static('pages'))` serves your HTML files

### Logs
View logs in Azure Portal: **App Service** → **Log stream** or via CLI:
```bash
az webapp log tail --name campus-marketplace-app --resource-group campus-marketplace
```

---

## Environment Variable Reference

| Variable | Description | Required |
|----------|-------------|----------|
| `PORT` | Server port (Azure: 8080) | Yes |
| `SUPABASE_URL` | Supabase project URL | Yes |
| `SUPABASE_ANON_KEY` | Supabase anon key | Yes |
| `SUPABASE_DB_PASSWORD` | Database password | Yes |
| `SUPABASE_DIRECT_URL` | Direct PostgreSQL URL | Yes |
| `DB_CHECK_TABLE` | Table for health check (optional) | No |

---

## Testing in Production

Run tests against deployed endpoint:
```bash
# Update test base URL
# Run smoke tests
curl https://your-app.azurewebsites.net/health
```

---

## Summary

Your Campus Marketplace app is now ready for Azure deployment:
- ✅ Jest testing configured (`npm test`)
- ✅ `web.config` for IISNode (Azure Windows)
- ✅ `Dockerfile` for containers
- ✅ CI/CD workflow ready
- ✅ Environment variables ready for Azure Configuration

**Next steps**:
1. Update Supabase environment variables in Azure
2. Deploy via GitHub Actions or Azure CLI
3. Test health endpoint
4. Update frontend API calls to point to Azure URL