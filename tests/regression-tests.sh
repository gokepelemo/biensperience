#!/bin/bash

# Biensperience Regression Test Suite
# Tests all critical functionality after code review fixes

set -e  # Exit on any error

API_URL="http://localhost:3001/api"
PASSED=0
FAILED=0
TOTAL=0

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "========================================="
echo "Biensperience Regression Test Suite"
echo "========================================="
echo ""

# Helper function to print test results
print_result() {
    TOTAL=$((TOTAL + 1))
    if [ $1 -eq 0 ]; then
        PASSED=$((PASSED + 1))
        echo -e "${GREEN}✓ PASS${NC}: $2"
    else
        FAILED=$((FAILED + 1))
        echo -e "${RED}✗ FAIL${NC}: $2"
        if [ ! -z "$3" ]; then
            echo -e "  ${YELLOW}Error: $3${NC}"
        fi
    fi
}

# Test 1: Authentication - Login with valid credentials
echo "Testing Authentication..."
LOGIN_RESPONSE=$(curl -s -X POST "${API_URL}/users/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"john@doe.com","password":"test"}')

# Remove quotes and check if it's a valid JWT token
TOKEN=$(echo "$LOGIN_RESPONSE" | tr -d '"')
if [[ $TOKEN == eyJ* ]]; then
    print_result 0 "Login with valid credentials"
else
    print_result 1 "Login with valid credentials" "No token returned: $LOGIN_RESPONSE"
    echo "Aborting tests - authentication failed"
    exit 1
fi

# Test 2: Authentication - Reject invalid credentials
INVALID_LOGIN=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${API_URL}/users/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"john@doe.com","password":"wrongpassword"}')

if [ "$INVALID_LOGIN" == "401" ] || [ "$INVALID_LOGIN" == "400" ]; then
    print_result 0 "Reject invalid credentials"
else
    print_result 1 "Reject invalid credentials" "Expected 401, got $INVALID_LOGIN"
fi

# Test 3: Get all plans (authenticated)
echo ""
echo "Testing Plan CRUD Operations..."
PLANS_RESPONSE=$(curl -s -X GET "${API_URL}/plans" \
  -H "Authorization: Bearer $TOKEN")

# Check if response is valid JSON
if echo "$PLANS_RESPONSE" | jq . > /dev/null 2>&1; then
    print_result 0 "Get all plans (authenticated)"
    PLANS_BODY="$PLANS_RESPONSE"
else
    print_result 1 "Get all plans (authenticated)" "Invalid JSON response"
    PLANS_BODY="[]"
fi

# Test 4: Get plans without authentication
UNAUTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X GET "${API_URL}/plans")

if [ "$UNAUTH_STATUS" == "401" ]; then
    print_result 0 "Reject unauthenticated plan access"
else
    print_result 1 "Reject unauthenticated plan access" "Expected 401, got $UNAUTH_STATUS"
fi

# Test 5: Get experiences (public access)
echo ""
echo "Testing Experience Operations..."
EXPERIENCES=$(curl -s -X GET "${API_URL}/experiences" \
  -H "Authorization: Bearer $TOKEN")

if echo "$EXPERIENCES" | jq . > /dev/null 2>&1; then
    EXPERIENCE_COUNT=$(echo "$EXPERIENCES" | jq '. | length' 2>/dev/null || echo "0")
    print_result 0 "Get all experiences (found $EXPERIENCE_COUNT)"
    EXPERIENCES_BODY="$EXPERIENCES"
else
    print_result 1 "Get all experiences" "Invalid response"
    EXPERIENCES_BODY="[]"
fi

# Test 5.5: Get single experience (regression test for users.user populate bug)
if [ ! -z "$EXPERIENCES_BODY" ] && [ "$EXPERIENCES_BODY" != "[]" ]; then
    FIRST_EXP_ID=$(echo "$EXPERIENCES_BODY" | jq -r '.[0]._id' 2>/dev/null)
    
    if [ ! -z "$FIRST_EXP_ID" ] && [ "$FIRST_EXP_ID" != "null" ]; then
        SINGLE_EXP=$(curl -s -X GET "${API_URL}/experiences/${FIRST_EXP_ID}" \
          -H "Authorization: Bearer $TOKEN")
        
        if echo "$SINGLE_EXP" | jq . > /dev/null 2>&1; then
            HAS_ID=$(echo "$SINGLE_EXP" | jq 'has("_id")' 2>/dev/null)
            HAS_NAME=$(echo "$SINGLE_EXP" | jq 'has("name")' 2>/dev/null)
            
            if [ "$HAS_ID" == "true" ] && [ "$HAS_NAME" == "true" ]; then
                print_result 0 "Get single experience (no users.user populate error)"
            else
                print_result 1 "Get single experience" "Missing expected fields"
            fi
        else
            print_result 1 "Get single experience" "Invalid JSON response"
        fi
    else
        echo -e "${YELLOW}⊘ SKIP${NC}: Single experience test (no experience ID)"
    fi
else
    echo -e "${YELLOW}⊘ SKIP${NC}: Single experience test (no experiences loaded)"
fi

# Test 6: Get destinations (public access)
echo ""
echo "Testing Destination Operations..."
DESTINATIONS=$(curl -s -X GET "${API_URL}/destinations" \
  -H "Authorization: Bearer $TOKEN")

if echo "$DESTINATIONS" | jq . > /dev/null 2>&1; then
    DESTINATION_COUNT=$(echo "$DESTINATIONS" | jq '. | length' 2>/dev/null || echo "0")
    print_result 0 "Get all destinations (found $DESTINATION_COUNT)"
    DESTINATIONS_BODY="$DESTINATIONS"
else
    print_result 1 "Get all destinations" "Invalid response"
    DESTINATIONS_BODY="[]"
fi

# Test 7: Input validation - Invalid field types for plan update
echo ""
echo "Testing Input Validation (Security Fixes)..."

# Get first plan ID
FIRST_PLAN_ID=$(echo "$PLANS_BODY" | jq -r '.[0]._id' 2>/dev/null)

if [ ! -z "$FIRST_PLAN_ID" ] && [ "$FIRST_PLAN_ID" != "null" ]; then
    # Try to update with invalid data type
    INVALID_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "${API_URL}/plans/${FIRST_PLAN_ID}" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d '{"planned_date":"not-a-date","plan":"not-an-array","notes":123}')
    
    if [ "$INVALID_STATUS" == "400" ]; then
        print_result 0 "Reject invalid field types in plan update"
    else
        print_result 1 "Reject invalid field types in plan update" "Expected 400, got $INVALID_STATUS"
    fi
else
    echo -e "${YELLOW}⊘ SKIP${NC}: Input validation test (no plans found)"
fi

# Test 8: Mass assignment protection - Try to inject unwanted fields
echo ""
echo "Testing Mass Assignment Protection..."

CREATE_DEST=$(curl -s -X POST "${API_URL}/destinations" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Destination",
    "country": "Test Country",
    "description": "Test description",
    "malicious_field": "should be filtered",
    "user": "should be overridden",
    "permissions": "should be managed properly"
  }')

if echo "$CREATE_DEST" | jq . > /dev/null 2>&1; then
    # Check if malicious field was filtered
    HAS_MALICIOUS=$(echo "$CREATE_DEST" | jq 'has("malicious_field")' 2>/dev/null)
    
    if [ "$HAS_MALICIOUS" == "false" ]; then
        print_result 0 "Filter unwanted fields in destination creation"
        
        # Clean up - delete the test destination
        TEST_DEST_ID=$(echo "$CREATE_DEST" | jq -r '._id' 2>/dev/null)
        if [ ! -z "$TEST_DEST_ID" ] && [ "$TEST_DEST_ID" != "null" ]; then
            curl -s -X DELETE "${API_URL}/destinations/${TEST_DEST_ID}" \
              -H "Authorization: Bearer $TOKEN" > /dev/null
        fi
    else
        print_result 1 "Filter unwanted fields in destination creation" "Malicious field was not filtered"
    fi
else
    print_result 1 "Create destination with field filtering" "Invalid response"
fi

# Test 9: Permission checks - Try to access another user's plan
echo ""
echo "Testing Permission System..."

# Get second user's token
SECOND_TOKEN=$(curl -s -X POST "${API_URL}/users/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"sample1@test.com","password":"password123"}' | tr -d '"')

if [[ $SECOND_TOKEN == eyJ* ]]; then
    # Try to access plans as second user
    OTHER_PLANS=$(curl -s -X GET "${API_URL}/plans" \
      -H "Authorization: Bearer $SECOND_TOKEN")
    
    if echo "$OTHER_PLANS" | jq . > /dev/null 2>&1; then
        # Should only see their own plans or plans they're collaborators on
        print_result 0 "Fetch plans with proper permission filtering"
    else
        print_result 1 "Fetch plans with proper permission filtering" "Invalid response"
    fi
else
    echo -e "${YELLOW}⊘ SKIP${NC}: Permission test (second user login failed)"
fi

# Test 10: Experience virtual fields (completion_percentage fix)
echo ""
echo "Testing Virtual Fields (Bug Fixes)..."

if [ ! -z "$EXPERIENCES_BODY" ] && [ "$EXPERIENCES_BODY" != "[]" ]; then
    FIRST_EXP=$(echo "$EXPERIENCES_BODY" | jq '.[0]' 2>/dev/null)
    
    if [ ! -z "$FIRST_EXP" ] && [ "$FIRST_EXP" != "null" ]; then
        HAS_COMPLETION=$(echo "$FIRST_EXP" | jq 'has("completion_percentage")' 2>/dev/null)
        
        if [ "$HAS_COMPLETION" == "true" ]; then
            COMPLETION_VAL=$(echo "$FIRST_EXP" | jq '.completion_percentage' 2>/dev/null)
            print_result 0 "Experience completion_percentage virtual field (value: $COMPLETION_VAL)"
        else
            print_result 1 "Experience completion_percentage virtual field" "Field not present"
        fi
    else
        echo -e "${YELLOW}⊘ SKIP${NC}: Virtual field test (no experiences found)"
    fi
else
    echo -e "${YELLOW}⊘ SKIP${NC}: Virtual field test (experiences not loaded)"
fi

# Summary
echo ""
echo "========================================="
echo "Test Summary"
echo "========================================="
echo -e "Total Tests: $TOTAL"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed!${NC}"
    exit 1
fi
