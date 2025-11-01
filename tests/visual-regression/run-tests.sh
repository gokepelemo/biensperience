#!/bin/bash

# Biensperience Visual Regression Test Runner
# Orchestrates test user creation, JWT token acquisition, and Puppeteer tests

set -e  # Exit on any error

# Configuration
export BACKEND_URL="${BACKEND_URL:-http://localhost:3001}"
export FRONTEND_URL="${FRONTEND_URL:-http://localhost:3000}"
export MONGODB_URI="${MONGODB_URI:-mongodb://localhost:27017/biensperience}"
export UPDATE_BASELINE="${UPDATE_BASELINE:-false}"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "========================================="
echo "Biensperience Visual Regression Tests"
echo "========================================="
echo ""
echo "Backend URL: $BACKEND_URL"
echo "Frontend URL: $FRONTEND_URL"
echo "MongoDB URI: $MONGODB_URI"
echo ""

# Function to run visual tests
run_visual_tests() {
    echo -e "${BLUE}Step 1: Setting up test user and obtaining JWT token...${NC}"

    # Run setup and capture output
    SETUP_OUTPUT=$(node "$SCRIPT_DIR/setup-test-user.js" 2>&1)
    SETUP_EXIT_CODE=$?

    if [ $SETUP_EXIT_CODE -ne 0 ]; then
        echo -e "${RED}Failed to setup test user${NC}"
        echo "$SETUP_OUTPUT"
        exit 1
    fi

    # Extract JWT token from output
    export JWT_TOKEN=$(echo "$SETUP_OUTPUT" | grep "JWT Token:" | sed 's/JWT Token: //')

    if [ -z "$JWT_TOKEN" ]; then
        echo -e "${RED}Failed to obtain JWT token${NC}"
        echo "$SETUP_OUTPUT"
        exit 1
    fi

    echo -e "${GREEN}Test user setup complete${NC}"
    echo ""

    echo -e "${BLUE}Step 2: Running Puppeteer visual tests...${NC}"
    echo ""

    # Run visual tests
    node "$SCRIPT_DIR/test-ui.js"
    TEST_RESULT=$?

    echo ""
    echo -e "${BLUE}Step 3: Cleaning up test user...${NC}"

    # Cleanup
    node "$SCRIPT_DIR/setup-test-user.js" cleanup || true

    echo -e "${GREEN}Cleanup completed${NC}"
    echo ""

    echo "========================================="
    echo "Visual Regression Tests Complete"
    echo "========================================="

    if [ $TEST_RESULT -eq 0 ]; then
        echo -e "${GREEN}All tests passed!${NC}"
        exit 0
    else
        echo -e "${RED}Some tests failed!${NC}"
        exit 1
    fi
}

# Handle script arguments
case "${1:-}" in
    --update-baseline)
        echo -e "${YELLOW}Running in UPDATE BASELINE mode${NC}"
        echo ""
        export UPDATE_BASELINE=true
        run_visual_tests
        ;;
    --cleanup-only)
        echo -e "${BLUE}Cleaning up test user only...${NC}"
        node "$SCRIPT_DIR/setup-test-user.js" cleanup
        echo -e "${GREEN}Cleanup completed${NC}"
        ;;
    --help)
        echo "Usage: $0 [OPTIONS]"
        echo ""
        echo "Options:"
        echo "  --update-baseline   Update baseline screenshots instead of comparing"
        echo "  --cleanup-only      Only cleanup test data and user"
        echo "  --help              Show this help message"
        echo ""
        echo "Environment Variables:"
        echo "  BACKEND_URL         Backend API URL (default: http://localhost:3001)"
        echo "  FRONTEND_URL        Frontend URL (default: http://localhost:3000)"
        echo "  MONGODB_URI         MongoDB connection URI (default: mongodb://localhost:27017/biensperience)"
        echo "  UPDATE_BASELINE     Set to 'true' to update baselines (default: false)"
        echo ""
        echo "Examples:"
        echo "  # Run visual regression tests"
        echo "  ./tests/visual-regression/run-tests.sh"
        echo ""
        echo "  # Update baseline screenshots"
        echo "  ./tests/visual-regression/run-tests.sh --update-baseline"
        echo ""
        echo "  # Use custom URLs"
        echo "  BACKEND_URL=http://staging:3001 FRONTEND_URL=http://staging:3000 ./tests/visual-regression/run-tests.sh"
        echo ""
        echo "  # Run via npm"
        echo "  npm run test:visual"
        echo "  npm run test:visual:update"
        ;;
    *)
        run_visual_tests
        ;;
esac
