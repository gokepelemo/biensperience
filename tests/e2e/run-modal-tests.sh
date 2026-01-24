#!/bin/bash

# Biensperience E2E Modal Test Runner
# Runs comprehensive modal flow tests before Chakra UI migration
#
# Task: biensperience-b93c
# Prerequisites: Backend and frontend must be running
#
# Usage:
#   ./run-modal-tests.sh              # Run all tests
#   ./run-modal-tests.sh --headed     # Run with visible browser
#   ./run-modal-tests.sh --slow       # Run with 250ms delay between actions

set -e  # Exit on any error

# Configuration
export BACKEND_URL="${BACKEND_URL:-http://localhost:3001}"
export FRONTEND_URL="${FRONTEND_URL:-http://localhost:3000}"
export MONGODB_URI="${MONGODB_URI:-mongodb://localhost:27017/biensperience}"
export NODE_ENV="${NODE_ENV:-test}"

# Parse command line arguments
HEADLESS="true"
SLOW_MO="0"

while [[ $# -gt 0 ]]; do
  case $1 in
    --headed)
      HEADLESS="false"
      shift
      ;;
    --slow)
      SLOW_MO="250"
      shift
      ;;
    --help)
      echo "Usage: $0 [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --headed    Run tests with visible browser (default: headless)"
      echo "  --slow      Run tests with 250ms delay between actions"
      echo "  --help      Show this help message"
      echo ""
      echo "Environment Variables:"
      echo "  BACKEND_URL    Backend API URL (default: http://localhost:3001)"
      echo "  FRONTEND_URL   Frontend app URL (default: http://localhost:3000)"
      echo "  JWT_TOKEN      Authentication token for protected routes"
      echo "  HEADLESS       Run headless (default: true)"
      echo "  SLOW_MO        Delay between actions in ms (default: 0)"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      echo "Run with --help for usage information"
      exit 1
      ;;
  esac
done

export HEADLESS
export SLOW_MO

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}Biensperience E2E Modal Tests${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""

# Check if backend is running
echo -e "${YELLOW}Checking backend...${NC}"
if ! curl -s "${BACKEND_URL}/health" > /dev/null 2>&1; then
  echo -e "${RED}✗ Backend not responding at ${BACKEND_URL}${NC}"
  echo -e "${YELLOW}  Please start the backend server first:${NC}"
  echo -e "${YELLOW}    cd backend && npm start${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Backend is running${NC}"

# Check if frontend is running
echo -e "${YELLOW}Checking frontend...${NC}"
if ! curl -s "${FRONTEND_URL}" > /dev/null 2>&1; then
  echo -e "${RED}✗ Frontend not responding at ${FRONTEND_URL}${NC}"
  echo -e "${YELLOW}  Please start the frontend server first:${NC}"
  echo -e "${YELLOW}    npm start${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Frontend is running${NC}"
echo ""

# Create test user and get JWT token
echo -e "${YELLOW}Setting up test user...${NC}"
TEST_USER_SETUP=$(node tests/visual-regression/setup-test-user.js 2>&1)
if [ $? -ne 0 ]; then
  echo -e "${RED}✗ Failed to set up test user${NC}"
  echo "$TEST_USER_SETUP"
  exit 1
fi

# Extract JWT token from setup output
export JWT_TOKEN=$(echo "$TEST_USER_SETUP" | grep -o 'JWT_TOKEN=.*' | cut -d'=' -f2)

if [ -z "$JWT_TOKEN" ]; then
  echo -e "${YELLOW}⚠ No JWT token obtained (some tests may fail)${NC}"
else
  echo -e "${GREEN}✓ Test user authenticated${NC}"
fi
echo ""

# Run the E2E tests
echo -e "${BLUE}Running E2E modal tests...${NC}"
echo -e "${YELLOW}Configuration:${NC}"
echo -e "  Backend:  ${BACKEND_URL}"
echo -e "  Frontend: ${FRONTEND_URL}"
echo -e "  Headless: ${HEADLESS}"
echo -e "  Slow Mo:  ${SLOW_MO}ms"
echo ""

# Run Jest with E2E tests
if npx jest --testPathPattern=tests/e2e/modal-flows --verbose; then
  echo ""
  echo -e "${GREEN}======================================${NC}"
  echo -e "${GREEN}✓ All E2E modal tests passed!${NC}"
  echo -e "${GREEN}======================================${NC}"
  echo ""
  echo -e "${GREEN}Safe to proceed with modal abstraction layer.${NC}"
  echo -e "${BLUE}Next step: bd show biensperience-012c${NC}"
  exit 0
else
  echo ""
  echo -e "${RED}======================================${NC}"
  echo -e "${RED}✗ Some E2E tests failed${NC}"
  echo -e "${RED}======================================${NC}"
  echo ""
  echo -e "${RED}DO NOT PROCEED with Chakra UI migration.${NC}"
  echo -e "${YELLOW}Fix all failing tests before continuing.${NC}"
  exit 1
fi
