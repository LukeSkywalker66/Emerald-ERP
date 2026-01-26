#!/bin/bash

# Get JWT token first
echo "=== Getting JWT Token ==="
TOKEN_RESPONSE=$(curl -s -X POST http://localhost:8500/api/v2/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@emerald.local","password":"admin123"}')

TOKEN=$(echo $TOKEN_RESPONSE | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)
echo "Token: $TOKEN"

# Test 1: Get all work orders
echo -e "\n=== Test 1: Get all work orders ==="
curl -s -X GET http://localhost:8500/api/v2/work-orders?limit=5 \
  -H "Authorization: Bearer $TOKEN" | jq '.items[0] | {id, status, created_at, technician}' 2>/dev/null | head -20

# Test 2: Filter by status (test all valid statuses)
echo -e "\n=== Test 2: Filter by pending_planning status ==="
curl -s -X GET "http://localhost:8500/api/v2/work-orders?status=pending_planning&limit=1" \
  -H "Authorization: Bearer $TOKEN" | jq '.items | length' 2>/dev/null

echo -e "\n=== Test 3: Filter by assigned status ==="
curl -s -X GET "http://localhost:8500/api/v2/work-orders?status=assigned&limit=1" \
  -H "Authorization: Bearer $TOKEN" | jq '.items | length' 2>/dev/null

echo -e "\n=== Test 4: Filter by in_progress status ==="
curl -s -X GET "http://localhost:8500/api/v2/work-orders?status=in_progress&limit=1" \
  -H "Authorization: Bearer $TOKEN" | jq '.items | length' 2>/dev/null

echo -e "\n=== Test 5: Invalid status (should not error) ==="
curl -s -X GET "http://localhost:8500/api/v2/work-orders?status=scheduled&limit=1" \
  -H "Authorization: Bearer $TOKEN" | jq '.detail' 2>/dev/null || echo "Bad status handling OK"

echo -e "\n=== Tests Complete ==="
