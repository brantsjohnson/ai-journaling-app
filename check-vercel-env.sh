#!/bin/bash

# Script to check and compare local and Vercel environment variables
# This helps debug deployment issues

echo "================================================"
echo "Vercel Environment Variables Checker"
echo "================================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if backend/.env exists
if [ ! -f "backend/.env" ]; then
    echo -e "${RED}❌ backend/.env not found${NC}"
    echo "Please create backend/.env file with your environment variables"
    exit 1
fi

echo -e "${GREEN}✓ Found backend/.env${NC}"
echo ""

# Required backend environment variables
REQUIRED_VARS=(
    "NODE_ENV"
    "JWT_SECRET"
    "SUPABASE_URL"
    "SUPABASE_SERVICE_ROLE_KEY"
    "SUPABASE_ANON_KEY"
    "OPEN_AI_KEY"
    "SUPABASE_AUDIO_BUCKET"
)

# Required frontend environment variables
REQUIRED_FRONTEND_VARS=(
    "VITE_SUPABASE_URL"
    "VITE_SUPABASE_ANON_KEY"
)

echo "Checking BACKEND environment variables..."
echo "=========================================="
echo ""

# Check backend variables
for var in "${REQUIRED_VARS[@]}"; do
    value=$(grep "^${var}=" backend/.env | cut -d '=' -f2-)
    if [ -z "$value" ]; then
        echo -e "${RED}❌ MISSING: $var${NC}"
    else
        # Show truncated value for security
        if [ ${#value} -gt 20 ]; then
            display_value="${value:0:20}..."
        else
            display_value="$value"
        fi
        echo -e "${GREEN}✓ FOUND: $var${NC} = $display_value"
    fi
done

echo ""
echo "Checking FRONTEND environment variables..."
echo "=========================================="
echo ""

# Check frontend variables
if [ -f "frontend/.env" ]; then
    echo -e "${GREEN}✓ Found frontend/.env${NC}"
    echo ""
    
    for var in "${REQUIRED_FRONTEND_VARS[@]}"; do
        value=$(grep "^${var}=" frontend/.env | cut -d '=' -f2-)
        if [ -z "$value" ]; then
            echo -e "${RED}❌ MISSING: $var${NC}"
        else
            # Show truncated value for security
            if [ ${#value} -gt 20 ]; then
                display_value="${value:0:20}..."
            else
                display_value="$value"
            fi
            echo -e "${GREEN}✓ FOUND: $var${NC} = $display_value"
        fi
    done
else
    echo -e "${YELLOW}⚠️  frontend/.env not found (using fallback values)${NC}"
fi

echo ""
echo "================================================"
echo "NEXT STEPS:"
echo "================================================"
echo ""
echo "1. Copy these environment variables to Vercel:"
echo "   - Go to: https://vercel.com/dashboard"
echo "   - Select your project"
echo "   - Settings → Environment Variables"
echo ""
echo "2. For each variable above, add it to Vercel:"
echo "   - Name: <variable name>"
echo "   - Value: <copy from your .env file>"
echo "   - Environment: Select 'Production, Preview, Development'"
echo ""
echo "3. After adding all variables, redeploy:"
echo "   - Go to Deployments tab"
echo "   - Click '...' on latest deployment"
echo "   - Click 'Redeploy'"
echo ""
echo "4. Test your deployment at:"
echo "   https://ai-journaling-ffh8t3gc4-brant-johnsons-projects.vercel.app"
echo ""

# Check if vercel CLI is installed
if command -v vercel &> /dev/null; then
    echo ""
    echo "================================================"
    echo "OPTIONAL: Use Vercel CLI to set variables"
    echo "================================================"
    echo ""
    echo "You can use the Vercel CLI to set environment variables:"
    echo ""
    echo "  vercel login"
    echo "  vercel env add JWT_SECRET production"
    echo "  vercel env add SUPABASE_URL production"
    echo "  # ... etc for each variable"
    echo ""
else
    echo ""
    echo "================================================"
    echo "TIP: Install Vercel CLI for easier management"
    echo "================================================"
    echo ""
    echo "  npm install -g vercel"
    echo "  vercel login"
    echo ""
fi

echo "For detailed instructions, see: VERCEL_LOGIN_FIX.md"
echo ""
