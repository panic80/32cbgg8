#!/bin/bash

# Script to verify all required files for Docker build are present

echo "Verifying required files for Docker build..."

MISSING_FILES=()

# Check configuration files
CONFIG_FILES=(
  "package.json"
  "package-lock.json"
  "vite.config.js"
  "tsconfig.json"
  "tsconfig.node.json"
  "vitest.config.js"
  "postcss.config.cjs"
  "tailwind.config.js"
  "components.json"
  "index.html"
  "Dockerfile"
  ".dockerignore"
)

# Check each config file
for file in "${CONFIG_FILES[@]}"; do
  if [ ! -f "$file" ]; then
    MISSING_FILES+=("$file")
    echo "❌ Missing: $file"
  else
    echo "✅ Found: $file"
  fi
done

# Check directories
REQUIRED_DIRS=(
  "src"
  "src/components"
  "src/components/ui"
  "src/pages"
  "src/api"
  "src/context"
  "src/hooks"
  "src/lib"
  "src/utils"
  "src/styles"
  "src/theme"
  "src/types"
  "src/services"
  "src/constants"
  "server"
  "server/middleware"
  "server/services"
)

for dir in "${REQUIRED_DIRS[@]}"; do
  if [ ! -d "$dir" ]; then
    MISSING_FILES+=("$dir/")
    echo "❌ Missing directory: $dir/"
  else
    echo "✅ Found directory: $dir/"
  fi
done

# Check specific important files
IMPORTANT_FILES=(
  "src/main.jsx"
  "src/App.jsx"
  "src/components/ui/button.tsx"
  "src/lib/utils.ts"
  "server/main.js"
)

for file in "${IMPORTANT_FILES[@]}"; do
  if [ ! -f "$file" ]; then
    MISSING_FILES+=("$file")
    echo "❌ Missing: $file"
  else
    echo "✅ Found: $file"
  fi
done

echo ""
echo "================================"
if [ ${#MISSING_FILES[@]} -eq 0 ]; then
  echo "✅ All required files are present!"
  echo "You can proceed with Docker build."
else
  echo "❌ Missing ${#MISSING_FILES[@]} required files/directories:"
  printf '%s\n' "${MISSING_FILES[@]}"
  echo ""
  echo "Please ensure all files are copied to the VPS before building."
fi
echo "================================"

# Additional check for PostCSS config
if [ -f "postcss.config.js" ] && [ -f "postcss.config.cjs" ]; then
  echo ""
  echo "⚠️  Warning: Both postcss.config.js and postcss.config.cjs exist."
  echo "   The project uses postcss.config.cjs. Consider removing postcss.config.js to avoid confusion."
fi