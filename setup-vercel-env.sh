#!/bin/bash

# Color codes for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Vercel Environment Setup Script${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Load environment variables from backend/.env
if [ ! -f "backend/.env" ]; then
    echo -e "${RED}Error: backend/.env file not found!${NC}"
    exit 1
fi

echo -e "${YELLOW}Loading environment variables from backend/.env...${NC}"
source backend/.env

cd backend

echo ""
echo -e "${YELLOW}Checking Vercel authentication...${NC}"
vercel whoami

if [ $? -ne 0 ]; then
    echo -e "${RED}Error: Not logged in to Vercel. Please run 'vercel login' first.${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}Setting environment variables in Vercel...${NC}"
echo ""

# Function to set environment variable
set_env() {
    local key=$1
    local value=$2

    if [ -z "$value" ]; then
        echo -e "${YELLOW}Skipping $key (empty value)${NC}"
        return
    fi

    echo -e "${GREEN}Setting $key...${NC}"
    echo "$value" | vercel env add "$key" production --yes > /dev/null 2>&1

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ $key set successfully${NC}"
    else
        echo -e "${YELLOW}⚠ $key might already exist or there was an issue${NC}"
    fi
}

# Set all required environment variables
set_env "OPEN_AI_KEY" "$OPEN_AI_KEY"
set_env "SUPABASE_URL" "$SUPABASE_URL"
set_env "SUPABASE_ANON_KEY" "$SUPABASE_ANON_KEY"
set_env "SUPABASE_SERVICE_ROLE_KEY" "$SUPABASE_SERVICE_ROLE_KEY"
set_env "SUPABASE_AUDIO_BUCKET" "$SUPABASE_AUDIO_BUCKET"
set_env "DATABASE_URL" "$DATABASE_URL"
set_env "JWT_SECRET" "$JWT_SECRET"
set_env "NODE_ENV" "production"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Environment variables setup complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo -e "1. Redeploy your backend: ${GREEN}vercel --prod${NC}"
echo -e "2. Check the logs: ${GREEN}vercel logs --follow${NC}"
echo -e "3. Test transcription on: ${GREEN}https://frontend-mu-wheat-65.vercel.app${NC}"
echo ""
