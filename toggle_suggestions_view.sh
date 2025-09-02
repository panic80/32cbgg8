#!/bin/bash

# Toggle script for switching between original and categorized suggestions view
# This allows quick switching without losing any code

echo "========================================"
echo "🔄 Toggle Suggestions View"
echo "========================================"

# Read current state
CURRENT_STATE=$(grep -n "USE_CATEGORIZED_VIEW.*=" src/pages/ChatPage/components/EmptyState.tsx | head -1)

if [[ $CURRENT_STATE == *"true"* ]]; then
    echo "📊 Current view: Categorized (Tabs)"
    echo "🔄 Switching to: Original (Simple Grid)"
    
    # Switch to false
    sed -i 's/const USE_CATEGORIZED_VIEW = true;/const USE_CATEGORIZED_VIEW = false;/' src/pages/ChatPage/components/EmptyState.tsx
    
    if [ $? -eq 0 ]; then
        echo "✅ Switched to original view"
        echo ""
        echo "🎯 You'll now see:"
        echo "   • 6 questions in a simple 2-column grid"
        echo "   • Original layout with familiar feel"
    else
        echo "❌ Failed to switch views"
        exit 1
    fi
    
elif [[ $CURRENT_STATE == *"false"* ]]; then
    echo "📋 Current view: Original (Simple Grid)"
    echo "🔄 Switching to: Categorized (Tabs)"
    
    # Switch to true
    sed -i 's/const USE_CATEGORIZED_VIEW = false;/const USE_CATEGORIZED_VIEW = true;/' src/pages/ChatPage/components/EmptyState.tsx
    
    if [ $? -eq 0 ]; then
        echo "✅ Switched to categorized view"
        echo ""
        echo "🎯 You'll now see:"
        echo "   • Tabbed interface with categories"
        echo "   • Popular, Travel & Claims, Benefits, Administration tabs"
        echo "   • 18 total questions organized by topic"
    else
        echo "❌ Failed to switch views"
        exit 1
    fi
    
else
    echo "❌ Could not determine current view state"
    echo "   Check src/pages/ChatPage/components/EmptyState.tsx manually"
    exit 1
fi

echo ""
echo "🚀 Next steps:"
echo "   1. Run 'npm run dev' to see changes"
echo "   2. Visit http://localhost:3001 to test the new view"
echo "   3. Run this script again to toggle back"
echo ""
echo "💡 Pro tip: You can run this script anytime to switch between views!"
echo "   Both implementations are preserved in the code."