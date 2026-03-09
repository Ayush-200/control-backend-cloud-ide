#!/bin/bash

# EC2 Deployment Script for vercel-backend3

echo "🚀 Starting deployment..."

# 1. Update system
echo "📦 Updating system packages..."
sudo yum update -y

# 2. Install Node.js 20
echo "📦 Installing Node.js..."
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs

# 3. Install PM2 (process manager)
echo "📦 Installing PM2..."
sudo npm install -g pm2

# 4. Clone or pull repository
if [ -d "cloud-ide" ]; then
  echo "📂 Updating repository..."
  cd cloud-ide
  git pull
else
  echo "📂 Cloning repository..."
  git clone YOUR_REPO_URL cloud-ide
  cd cloud-ide
fi

# 5. Navigate to vercel-backend3
cd vercel-backend3

# 6. Install dependencies
echo "📦 Installing dependencies..."
npm ci

# 7. Build TypeScript
echo "🔨 Building application..."
npm run build

# 8. Setup environment variables
echo "⚙️ Setting up environment..."
cat > .env.production << EOF
NEXT_PUBLIC_REGION=ap-south-1
NEXT_PUBLIC_CLUSTER_ID=cloud-ide-ECS-cluster
NEXT_PUBLIC_TASK_DEFINITION_ID=cloud-ide-fargate-task:19
NEXT_PUBLIC_SUBNTET_ID1=subnet-012af762b773d0c29
NEXT_PUBLIC_SUBNET_ID2=subnet-010f07e57a14a302e
NEXT_PUBLIC_SECURITY_ID=sg-0425b39234dec81e7
PORT=4000
NEXT_PUBLIC_FRONTEND_URL=https://your-frontend-domain.com
NEXT_PUBLIC_TARGET_GROUP_ARN=arn:aws:elasticloadbalancing:ap-south-1:585315266480:targetgroup/cloud-ide-target-group1/2e35381dc6791e8c
EFS_FILE_SYSTEM_ID=fs-0cd014d72e65b1a47
SHARED_ACCESS_POINT_ID=fsap-01e9a48723d7c7039
DATABASE_URL=postgresql://postgres:PASSWORD@your-rds-endpoint:5432/myDB
JWT_SECRET=$(openssl rand -base64 32)
JWT_REFRESH_SECRET=$(openssl rand -base64 32)
EOF

# 9. Start with PM2
echo "🚀 Starting application with PM2..."
pm2 delete vercel-backend3 2>/dev/null || true
pm2 start dist/server.js --name vercel-backend3 --env production

# 10. Save PM2 configuration
pm2 save
pm2 startup

echo "✅ Deployment complete!"
echo "📊 Check status: pm2 status"
echo "📋 View logs: pm2 logs vercel-backend3"
echo "🔄 Restart: pm2 restart vercel-backend3"
