#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}=== Starting Authentication Flow Tests ===${NC}"

# Generate session secret if not exists
if [ ! -f .session-secret ]; then
    echo -e "${YELLOW}Generating new session secret...${NC}"
    openssl rand -base64 32 > .session-secret
fi

# Load session secret
export SESSION_SECRET=$(cat .session-secret)
echo -e "${GREEN}Session secret loaded${NC}"

# Check if port 4080 is available
if lsof -i:4080 > /dev/null; then
    echo -e "${RED}Error: Port 4080 is already in use${NC}"
    echo "Please stop any running instances first"
    exit 1
fi

# Check if server is already running
if pgrep -f "next-server" > /dev/null; then
    echo -e "${YELLOW}Warning: Next.js server already running, stopping it...${NC}"
    pkill -f "next-server"
    sleep 2
fi

# Check for start.sh and make it executable
if [ ! -f ./start.sh ]; then
    echo -e "${RED}Error: start.sh not found${NC}"
    exit 1
fi

if [ ! -x ./start.sh ]; then
    echo -e "${YELLOW}Making start.sh executable...${NC}"
    chmod +x ./start.sh
fi

# Cleanup function
cleanup() {
    echo "Cleaning up..."
    pkill -f "next-server" 2>/dev/null
    rm -f cookies.txt
    echo -e "${GREEN}Tests completed${NC}"
}

trap cleanup EXIT

# Clean start
echo -e "\n${YELLOW}Preparing clean environment...${NC}"
rm -f /etc/darkflows/admin_credentials.json
pkill -f "next-server"

# Function to wait for server to be ready
wait_for_server() {
    echo "Waiting for server to start..."
    for i in {1..30}; do
        if curl -s http://localhost:4080/api/health > /dev/null; then
            echo -e "${GREEN}Server is ready${NC}"
            return 0
        fi
        echo -n "."
        sleep 1
    done
    echo -e "\n${RED}Server failed to start within 30 seconds${NC}"
    exit 1
}

# Start server
echo -e "\n${YELLOW}Starting server...${NC}"
NODE_ENV=production \
NEXT_TELEMETRY_DISABLED=1 \
SESSION_SECRET=$(cat .session-secret) \
./start.sh &
wait_for_server

# Test first-time setup
echo -e "\n${YELLOW}1. Testing first-time setup${NC}"
SETUP_RESPONSE=$(curl -s -X POST http://localhost:4080/api/auth/save-credentials \
  -H "Content-Type: application/json" \
  -d '{"password":"testpass123"}')

if echo "$SETUP_RESPONSE" | grep -q "success\":true"; then
    echo -e "${GREEN}✓ First-time setup successful${NC}"
    sleep 2
else
    echo -e "${RED}✗ First-time setup failed: $SETUP_RESPONSE${NC}"
    exit 1
fi

# Test system password update
echo -e "\n${YELLOW}2. Testing system password update${NC}"
SYSPASS_RESPONSE=$(curl -s -X POST http://localhost:4080/api/auth/update-system-passwords \
  -H "Content-Type: application/json" \
  -d '{"password":"testpass123"}')

if echo "$SYSPASS_RESPONSE" | grep -q "success\":true"; then
    echo -e "${GREEN}✓ System password update successful${NC}"
    sleep 2
else
    echo -e "${RED}✗ System password update failed: $SYSPASS_RESPONSE${NC}"
    exit 1
fi

# Test login
echo -e "\n${YELLOW}3. Testing login${NC}"
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:4080/api/login \
  -H "Content-Type: application/json" \
  -d '{"password":"testpass123"}' \
  -c cookies.txt)

if echo "$LOGIN_RESPONSE" | grep -q "success\":true"; then
    echo -e "${GREEN}✓ Login successful${NC}"
    sleep 2
else
    echo -e "${RED}✗ Login failed: $LOGIN_RESPONSE${NC}"
    exit 1
fi

# Test protected route
echo -e "\n${YELLOW}4. Testing protected route${NC}"
STATUS_RESPONSE=$(curl -s http://localhost:4080/api/status \
  -b cookies.txt \
  -w "\nStatus: %{http_code}")

if echo "$STATUS_RESPONSE" | grep -q "Status: 200"; then
    echo -e "${GREEN}✓ Protected route accessible${NC}"
    sleep 2
else
    echo -e "${RED}✗ Protected route inaccessible: $STATUS_RESPONSE${NC}"
    exit 1
fi

# Test logout
echo -e "\n${YELLOW}5. Testing logout${NC}"
LOGOUT_RESPONSE=$(curl -s -X POST http://localhost:4080/api/logout \
  -b cookies.txt \
  -c cookies.txt \
  -v 2>&1)

if echo "$LOGOUT_RESPONSE" | grep -q "success\":true"; then
    echo -e "${GREEN}✓ Logout successful${NC}"
    sleep 2
    
    # Verify cookie is cleared by checking Set-Cookie header
    if echo "$LOGOUT_RESPONSE" | grep -q "Set-Cookie:.*session=.*expires=Thu, 01 Jan 1970"; then
        echo -e "${GREEN}✓ Session cookie properly expired${NC}"
        # Clear the cookies file to ensure clean state
        rm -f cookies.txt
        touch cookies.txt
    else
        echo -e "${RED}✗ Session cookie not properly expired${NC}"
        echo "$LOGOUT_RESPONSE" | grep "Set-Cookie"
    fi

    # Verify we can't access protected route after logout
    echo -e "${YELLOW}5.1 Verifying protected route inaccessible after logout${NC}"
    POST_LOGOUT_RESPONSE=$(curl -s -L http://localhost:4080/api/status \
      -b cookies.txt \
      -w "\nStatus: %{http_code}")
    
    # Check if we got unauthorized (401)
    if echo "$POST_LOGOUT_RESPONSE" | grep -q "Status: 401"; then
        echo -e "${GREEN}✓ Protected route properly restricted after logout${NC}"
    else
        echo -e "${RED}✗ Protected route still accessible after logout${NC}"
        echo "Response: $POST_LOGOUT_RESPONSE"
    fi
else
    echo -e "${RED}✗ Logout failed: $LOGOUT_RESPONSE${NC}"
fi

echo -e "\n${GREEN}All tests completed${NC}" 