#!/bin/bash

echo "==================================================="
echo "  NeoTavern Frontend"
echo "==================================================="

# 1. Install dependencies if missing or package.json changed
PKG_HASH_FILE="node_modules/.package-json.hash"
CURRENT_PKG_HASH=$(node -p "require('crypto').createHash('sha256').update(require('fs').readFileSync('package.json')).digest('hex')")
LAST_PKG_HASH="none"
if [ -f "$PKG_HASH_FILE" ]; then
    LAST_PKG_HASH=$(cat "$PKG_HASH_FILE")
fi

NEED_INSTALL=false
if [ ! -d "node_modules" ]; then
    echo "[1/3] First run detected. Installing dependencies..."
    NEED_INSTALL=true
elif [ ! -f "$PKG_HASH_FILE" ]; then
    echo "[1/3] Dependency hash missing. Reinstalling dependencies..."
    NEED_INSTALL=true
elif [ "$CURRENT_PKG_HASH" != "$LAST_PKG_HASH" ]; then
    echo "[1/3] package.json changed. Reinstalling dependencies..."
    NEED_INSTALL=true
else
    echo "[1/3] Dependencies up-to-date."
fi

if [ "$NEED_INSTALL" = true ]; then
    npm ci
    if [ $? -ne 0 ]; then
        echo "Error installing dependencies."
        exit 1
    fi

    # Persist the dependency hash for the next run
    echo "$CURRENT_PKG_HASH" > "$PKG_HASH_FILE"
fi

# 2. Check for updates / rebuild requirements
NEED_BUILD=false

# Get current git hash (if git exists)
if command -v git &> /dev/null && [ -d ".git" ]; then
    CURRENT_HASH=$(git rev-parse HEAD)
else
    CURRENT_HASH="unknown"
fi

# Read the hash of the last build
if [ -f "dist/version.txt" ]; then
    LAST_BUILD_HASH=$(cat dist/version.txt)
else
    LAST_BUILD_HASH="none"
fi

# Compare
if [ ! -d "dist" ]; then
    echo "[2/3] Dist folder missing. Build required."
    NEED_BUILD=true
elif [ "$CURRENT_HASH" != "unknown" ] && [ "$CURRENT_HASH" != "$LAST_BUILD_HASH" ]; then
    echo "[2/3] Update detected (Git hash changed). Rebuilding..."
    NEED_BUILD=true
elif [ "$1" == "rebuild" ]; then
    echo "[2/3] Forced rebuild requested."
    NEED_BUILD=true
else
    echo "[2/3] No updates detected. Skipping build."
fi

# Execute Build if needed
if [ "$NEED_BUILD" = true ]; then
    npm run build:deploy
    if [ $? -ne 0 ]; then
        echo "Error building application."
        exit 1
    fi

    # Save the current hash to dist so we know for next time
    if [ "$CURRENT_HASH" != "unknown" ]; then
        echo "$CURRENT_HASH" > dist/version.txt
    fi
fi

# 3. Run Preview
echo "[3/3] Starting server..."
echo "App running at http://localhost:4173"
npm run preview