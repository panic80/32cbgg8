#!/bin/bash

# Rollback script for categorized suggestions feature
# This script will restore the original state before categorized suggestions were implemented

echo "========================================"
echo "🔄 Rolling back Categorized Suggestions"
echo "========================================"

# Check if backup files exist
BACKUP_COUNT=0
if [ -f "src/pages/ChatPage/constants/suggestions.ts.backup" ]; then
    BACKUP_COUNT=$((BACKUP_COUNT + 1))
fi
if [ -f "src/pages/ChatPage/components/EmptyState.tsx.backup" ]; then
    BACKUP_COUNT=$((BACKUP_COUNT + 1))
fi

if [ $BACKUP_COUNT -eq 0 ]; then
    echo "❌ No backup files found. Nothing to restore."
    echo "   Make sure you're in the correct directory (/var/www/cbthis)"
    exit 1
fi

echo "📁 Found $BACKUP_COUNT backup file(s)"
echo ""

# Confirm with user
read -p "⚠️  This will permanently overwrite your current files. Continue? (y/N): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Rollback cancelled."
    exit 1
fi

echo "🔄 Starting rollback process..."
echo ""

# Restore original files
if [ -f "src/pages/ChatPage/constants/suggestions.ts.backup" ]; then
    echo "📄 Restoring suggestions.ts..."
    cp src/pages/ChatPage/constants/suggestions.ts.backup src/pages/ChatPage/constants/suggestions.ts
    if [ $? -eq 0 ]; then
        echo "   ✅ suggestions.ts restored"
    else
        echo "   ❌ Failed to restore suggestions.ts"
        exit 1
    fi
fi

if [ -f "src/pages/ChatPage/components/EmptyState.tsx.backup" ]; then
    echo "📄 Restoring EmptyState.tsx..."
    cp src/pages/ChatPage/components/EmptyState.tsx.backup src/pages/ChatPage/components/EmptyState.tsx
    if [ $? -eq 0 ]; then
        echo "   ✅ EmptyState.tsx restored"
    else
        echo "   ❌ Failed to restore EmptyState.tsx"
        exit 1
    fi
fi

# Remove the new component file
if [ -f "src/pages/ChatPage/components/CategorizedSuggestions.tsx" ]; then
    echo "🗑️  Removing CategorizedSuggestions.tsx..."
    rm src/pages/ChatPage/components/CategorizedSuggestions.tsx
    if [ $? -eq 0 ]; then
        echo "   ✅ CategorizedSuggestions.tsx removed"
    else
        echo "   ⚠️  Failed to remove CategorizedSuggestions.tsx (you may need to remove it manually)"
    fi
fi

echo ""
echo "🎉 Rollback completed successfully!"
echo ""
echo "📋 What was restored:"
echo "   • Original suggestions.ts (6 basic questions)"
echo "   • Original EmptyState.tsx (simple grid layout)" 
echo "   • Removed CategorizedSuggestions.tsx component"
echo ""
echo "🚀 Next steps:"
echo "   1. Run 'npm run dev' to start the development server"
echo "   2. Check http://localhost:3001 to verify the original layout"
echo "   3. The backup files (.backup) are preserved for safety"
echo ""
echo "💡 To re-enable categorized view later:"
echo "   Set USE_CATEGORIZED_VIEW = true in EmptyState.tsx"
echo ""

# Optional: Ask if user wants to clean up backup files
echo ""
read -p "🗑️  Remove backup files? (y/N): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if [ -f "src/pages/ChatPage/constants/suggestions.ts.backup" ]; then
        rm src/pages/ChatPage/constants/suggestions.ts.backup
        echo "   ✅ suggestions.ts.backup removed"
    fi
    if [ -f "src/pages/ChatPage/components/EmptyState.tsx.backup" ]; then
        rm src/pages/ChatPage/components/EmptyState.tsx.backup
        echo "   ✅ EmptyState.tsx.backup removed"
    fi
    echo "   🧹 Cleanup complete"
else
    echo "   📁 Backup files preserved for safety"
fi

echo ""
echo "✨ All done! Your application is back to the original state."