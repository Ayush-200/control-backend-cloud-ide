# AWS EC2 Deployment Guide for vercel-backend3

Complete step-by-step guide to deploy the proxy service on AWS EC2.

---

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Phase 1: Create EC2 Instance](#phase-1-create-ec2-instance)
3. [Phase 2: Setup EC2 Environment](#phase-2-setup-ec2-environment)
4. [Phase 3: Deploy Application](#phase-3-deploy-application)
5. [Phase 4: Test Deployment](#phase-4-test-deployment)
6. [Phase 5: Update Frontend](#phase-5-update-frontend)
7. [Phase 6: Production Improvements](#phase-6-production-improvements-optional)
8. [Useful Commands](#useful-commands)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- AWS Account with EC2 access
- SSH key pair for EC2 access
- Your code pushed to a Git repository (GitHub, GitLab, etc.)
- Database credentials (PostgreSQL)
- AWS credentials configured

---

## Phase 1: Create EC2 Instance

### Step 1: Launch EC2 Instance

1. **Go to AWS Console** → EC2 → Launch Instance

2. **Configure Instance:**
   - **Name:** `cloud-ide-backend`
   - **AMI:** Amazon Linux 2023 (or Ubuntu 22.04)
   - **Instance Type:** `t3.small` (2 vCPU, 2GB RAM) - minimum
   - **Key Pair:** Create new or select existing

3. **Network Settings:**
   - **VPC:** Select the SAME VPC as your ECS containers ⚠️ IMPORTANT
   - **Subnet:** Select a subnet that can reach your container private IPs
   - **Auto-assign Public IP:** Enable
   - **Security Group:** Create new with these rules:

   | Type | Protocol | Port | Source | Description |
   |------|----------|------|--------|-------------|
   | SSH | TCP | 22 | Your IP | SSH access |
   | Custom TCP | TCP | 4000 | 0.0.0.0/0 | API access |
   | All traffic | All | All | VPC CIDR | Container access |

4. **Storage:** 20 GB gp3

5. **Click "Launch Instance"**

6. **Note down:**
   - ✅ Public IP address: `_________________`
   - ✅ Private IP address: `_________________`

### Step 2: Connect to EC2

```bash
# Download your key pair (if new)
# Change permissions
chmod 400 your-key.pem

# SSH into EC2
ssh -i your-key.pem ec2-user@YOUR-EC2-PUBLIC-IP
```

---

## Phase 2: Setup EC2 Environment

### Step 3: Install Node.js

```bash
# Update system
sudo yum update -y

# Install Node.js 20
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs

# Verify installation
node --version  # Should show v20.x.x
npm --version
```

### Step 4: Install Git

```bash
# Install Git
sudo yum install -y git

# Configure git (optional)
git config --global user.name "Your Name"
git config --global user.email "your@email.com"
```

### Step 5: Install PM2 (Process Manager)

```bash
# Install PM2 globally
sudo npm install -g pm2

# Verify installation
pm2 --version
```

---

## Phase 3: Deploy Application

### Step 6: Clone Repository

**Option A: Clone from Git**
```bash
# Clone your repository
git clone https://github.com/YOUR-USERNAME/YOUR-REPO.git
cd YOUR-REPO/vercel-backend3
```

**Option B: Upload files manually**
```bash
# From your local machine:
scp -i your-key.pem -r vercel-backend3 ec2-user@YOUR-EC2-IP:~/
```

### Step 7: Install Dependencies and Build

```bash
# Navigate to project directory
cd ~/YOUR-REPO/vercel-backend3

# Install dependencies
npm ci

# Build TypeScript
npm run build

# Verify build succeeded
ls -la dist/
# You should see server.js and other compiled files
```

### Step 8: Setup Environment Variables

```bash
# Create production environment file
nano .env.production
```

**Paste this configuration (update the values):**

```env
# AWS Configuration
NEXT_PUBLIC_REGION=ap-south-1
NEXT_PUBLIC_CLUSTER_ID=cloud-ide-ECS-cluster
NEXT_PUBLIC_TASK_DEFINITION_ID=cloud-ide-fargate-task:19
NEXT_PUBLIC_SUBNTET_ID1=subnet-012af762b773d0c29
NEXT_PUBLIC_SUBNET_ID2=subnet-010f07e57a14a302e
NEXT_PUBLIC_SECURITY_ID=sg-0425b39234dec81e7
NEXT_PUBLIC_TARGET_GROUP_ARN=arn:aws:elasticloadbalancing:ap-south-1:585315266480:targetgroup/cloud-ide-target-group1/2e35381dc6791e8c

# EFS Configuration
EFS_FILE_SYSTEM_ID=fs-0cd014d72e65b1a47
SHARED_ACCESS_POINT_ID=fsap-01e9a48723d7c7039

# Server Configuration
PORT=4000
NODE_ENV=production

# Frontend URL (update with your actual domain)
NEXT_PUBLIC_FRONTEND_URL=http://YOUR-FRONTEND-URL

# Database (update with your actual database)
DATABASE_URL=postgresql://postgres:YOUR-PASSWORD@YOUR-DB-HOST:5432/myDB

# JWT Secrets (generate new ones - see below)
JWT_SECRET=PASTE-GENERATED-SECRET-HERE
JWT_REFRESH_SECRET=PASTE-GENERATED-SECRET-HERE
```

**Save the file:** Press `Ctrl+X`, then `Y`, then `Enter`

**Generate JWT secrets:**
```bash
# Generate JWT_SECRET
openssl rand -base64 32
# Copy the output and paste it as JWT_SECRET in .env.production

# Generate JWT_REFRESH_SECRET
openssl rand -base64 32
# Copy the output and paste it as JWT_REFRESH_SECRET in .env.production
```

### Step 9: Start Application with PM2

```bash
# Start the application
pm2 start dist/server.js --name cloud-ide-backend --env production

# Save PM2 configuration (persists across reboots)
pm2 save

# Setup PM2 to start on system boot
pm2 startup
# ⚠️ IMPORTANT: Copy and run the command that PM2 outputs
```

### Step 10: Verify Deployment

```bash
# Check PM2 status
pm2 status
# Should show: cloud-ide-backend | online

# View logs
pm2 logs cloud-ide-backend --lines 50

# Test locally on EC2
curl http://localhost:4000/health
# Expected output: {"status":"ok","message":"Server is running"}
```

---

## Phase 4: Test Deployment

### Step 11: Test from Your Local Machine

```bash
# Test health endpoint
curl http://YOUR-EC2-PUBLIC-IP:4000/health
# Expected: {"status":"ok","message":"Server is running"}

# Test session debug endpoint (use a real sessionId from your database)
curl "http://YOUR-EC2-PUBLIC-IP:4000/output/debug?sessionId=YOUR-SESSION-ID"
# Expected: Session info or 404 if session doesn't exist
```

### Step 12: Test Proxy (After Starting a Container)

```bash
# Start a project from your frontend to create a container
# Then test the proxy:
curl "http://YOUR-EC2-PUBLIC-IP:4000/output/5173?sessionId=REAL-SESSION-ID"
# Should proxy to the container's Vite server
```

---

## Phase 5: Update Frontend

### Step 13: Update Frontend Environment Variables

Edit `frontend/my-app/.env.local`:

```env
# Update this line:
NEXT_PUBLIC_VERCEL_BACKEND_URL=http://YOUR-EC2-PUBLIC-IP:4000

# Or if using a domain:
NEXT_PUBLIC_VERCEL_BACKEND_URL=https://api.your-domain.com
```

**Rebuild and restart your frontend:**
```bash
npm run build
npm start
```

---

## Phase 6: Production Improvements (Optional)

### Step 14: Setup Nginx Reverse Proxy (Recommended)

**Why?** Nginx provides SSL termination, better performance, and security.

```bash
# Install Nginx
sudo yum install -y nginx

# Create Nginx configuration
sudo nano /etc/nginx/conf.d/cloud-ide.conf
```

**Paste this configuration:**

```nginx
server {
    listen 80;
    server_name your-domain.com;  # Update with your domain

    # Increase timeouts for long-running requests
    proxy_read_timeout 300s;
    proxy_connect_timeout 75s;

    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        
        # WebSocket support
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        
        # Headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        proxy_cache_bypass $http_upgrade;
    }
}
```

**Start Nginx:**
```bash
# Start Nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Test configuration
sudo nginx -t

# Reload if needed
sudo systemctl reload nginx

# Test
curl http://YOUR-EC2-PUBLIC-IP/health
```

### Step 15: Setup SSL with Let's Encrypt (Optional)

**Prerequisites:** You need a domain name pointing to your EC2 IP.

```bash
# Install Certbot
sudo yum install -y certbot python3-certbot-nginx

# Get SSL certificate (replace with your domain)
sudo certbot --nginx -d your-domain.com

# Test auto-renewal
sudo certbot renew --dry-run

# Enable auto-renewal timer
sudo systemctl enable certbot-renew.timer
```

**Update frontend to use HTTPS:**
```env
NEXT_PUBLIC_VERCEL_BACKEND_URL=https://your-domain.com
```

---

## Useful Commands

### PM2 Commands

```bash
# View logs (live)
pm2 logs cloud-ide-backend

# View last 100 lines
pm2 logs cloud-ide-backend --lines 100

# Restart application
pm2 restart cloud-ide-backend

# Stop application
pm2 stop cloud-ide-backend

# Delete application from PM2
pm2 delete cloud-ide-backend

# Monitor resources
pm2 monit

# View detailed info
pm2 show cloud-ide-backend

# List all processes
pm2 list
```

### System Commands

```bash
# Check if port 4000 is listening
sudo netstat -tlnp | grep 4000

# Check system resources
htop  # or: top

# Check disk space
df -h

# Check memory
free -h

# View system logs
sudo journalctl -u nginx -f  # Nginx logs
```

### Git Commands (for updates)

```bash
# Pull latest changes
cd ~/YOUR-REPO/vercel-backend3
git pull

# Rebuild
npm run build

# Restart
pm2 restart cloud-ide-backend
```

---

## Troubleshooting

### Issue: Service Won't Start

```bash
# Check logs for errors
pm2 logs cloud-ide-backend --lines 100

# Try running manually to see errors
cd ~/YOUR-REPO/vercel-backend3
node dist/server.js

# Check if port is already in use
sudo netstat -tlnp | grep 4000

# Kill process on port 4000 if needed
sudo kill -9 $(sudo lsof -t -i:4000)
```

### Issue: Can't Reach from Outside

```bash
# 1. Check if service is running
pm2 status

# 2. Check if listening on correct port
sudo netstat -tlnp | grep 4000

# 3. Test locally first
curl http://localhost:4000/health

# 4. Check EC2 security group
# - Go to AWS Console → EC2 → Security Groups
# - Verify port 4000 is open to 0.0.0.0/0

# 5. Check if firewall is blocking
sudo iptables -L -n
```

### Issue: Can't Reach Containers

```bash
# 1. Verify EC2 is in same VPC as containers
# Check in AWS Console

# 2. Check security group allows outbound to container IPs
# Security group should allow all outbound traffic

# 3. Test connection to a container
curl http://CONTAINER-PRIVATE-IP:8080/health

# 4. Check routing table
ip route show

# 5. Verify container is running
# Check in ECS Console
```

### Issue: Database Connection Failed

```bash
# 1. Check DATABASE_URL in .env.production
cat .env.production | grep DATABASE_URL

# 2. Test database connection
psql "$DATABASE_URL"

# 3. Check if database security group allows EC2 IP
# Go to RDS → Security Groups

# 4. Verify database is running
# Check in RDS Console
```

### Issue: Out of Memory

```bash
# Check memory usage
free -h

# Check PM2 memory usage
pm2 monit

# Restart application
pm2 restart cloud-ide-backend

# Consider upgrading to larger instance type
# t3.small → t3.medium
```

---

## Deployment Checklist

Before going to production, verify:

- [ ] EC2 instance is in the same VPC as ECS containers
- [ ] Security groups allow traffic between EC2 and containers
- [ ] Database is accessible from EC2
- [ ] Environment variables are set correctly
- [ ] JWT secrets are generated and secure
- [ ] PM2 is configured to start on boot
- [ ] Health endpoint returns 200 OK
- [ ] Proxy endpoint works with a test session
- [ ] Frontend is updated with EC2 IP/domain
- [ ] SSL is configured (for production)
- [ ] Monitoring is set up (CloudWatch, PM2 monitoring)
- [ ] Backups are configured
- [ ] Auto-scaling is considered (if needed)

---

## Next Steps

1. **Monitor your application:**
   - Set up CloudWatch alarms
   - Monitor PM2 logs regularly
   - Track error rates

2. **Optimize performance:**
   - Enable Nginx caching
   - Use CDN for static assets
   - Optimize database queries

3. **Improve security:**
   - Restrict security group rules
   - Enable AWS WAF
   - Regular security updates

4. **Scale if needed:**
   - Add more EC2 instances behind ALB
   - Use Auto Scaling Groups
   - Implement Redis for session caching

---

## Support

If you encounter issues:
1. Check the logs: `pm2 logs cloud-ide-backend`
2. Review this troubleshooting guide
3. Check AWS service health dashboard
4. Verify all environment variables are correct

---

**Deployment completed successfully!** 🎉

Your proxy service is now running on EC2 and can route requests to containers based on sessionId.
