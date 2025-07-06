#!/bin/bash

# 🚀 ML Parameter Optimization - Quick Start Script
# Run this immediately when starting a new Claude session in the worktree

echo "🚀 ML Parameter Optimization - Quick Start"
echo "=========================================="
echo ""

# Check current directory
echo "📍 Current Directory:"
pwd
echo ""

# Check git status
echo "🔄 Git Status:"
git status --short
git log --oneline -3
echo ""

# Check if required files exist
echo "📁 Checking Key Files:"
files=(
    "ML-OPTIMIZATION-SETUP.md"
    "src/lib/backtest/fugle-optimizer.ts"
    "src/cli/optimize-ml.ts"
    "package.json"
    "data/historical"
)

for file in "${files[@]}"; do
    if [ -e "$file" ]; then
        echo "  ✅ $file"
    else
        echo "  ❌ MISSING: $file"
    fi
done
echo ""

# Check dependencies
echo "📦 Checking Dependencies:"
if pnpm list @fugle/backtest > /dev/null 2>&1; then
    echo "  ✅ @fugle/backtest installed"
else
    echo "  ❌ @fugle/backtest missing"
    echo "  💡 Run: pnpm add @fugle/backtest"
fi

if [ -d "node_modules" ]; then
    echo "  ✅ node_modules exists"
else
    echo "  ❌ node_modules missing"
    echo "  💡 Run: pnpm install"
fi
echo ""

# Check TypeScript compilation
echo "🔧 Testing TypeScript Compilation:"
if pnpm tsc --noEmit > /dev/null 2>&1; then
    echo "  ✅ TypeScript compiles successfully"
    
    # Test optimize-ml command
    echo ""
    echo "🎯 Testing optimize-ml Command:"
    if pnpm optimize-ml --help > /dev/null 2>&1; then
        echo "  ✅ optimize-ml command works!"
        echo ""
        echo "🚀 READY TO RUN OPTIMIZATION!"
        echo ""
        echo "Quick test command:"
        echo "  pnpm optimize-ml --days 14 --evaluations 10"
        echo ""
        echo "Full optimization command:"
        echo "  pnpm optimize-ml --days 30 --evaluations 50 --baseline --validate"
    else
        echo "  ❌ optimize-ml command failed"
        echo "  💡 Check TypeScript compilation errors"
        echo ""
        echo "Debug commands:"
        echo "  pnpm tsc --noEmit  # Check compilation"
        echo "  tsx src/cli/optimize-ml.ts --help  # Test directly"
    fi
else
    echo "  ❌ TypeScript compilation failed"
    echo ""
    echo "🔧 FIX NEEDED - Run this to see errors:"
    echo "  pnpm tsc --noEmit"
    echo ""
    echo "Common fixes:"
    echo "  1. Check imports in src/lib/backtest/fugle-optimizer.ts"
    echo "  2. Check exports in src/lib/backtest/index.ts"
    echo "  3. Ensure @fugle/backtest is installed"
fi

echo ""
echo "📚 For detailed instructions, read:"
echo "  cat ML-OPTIMIZATION-SETUP.md"
echo ""
echo "🎯 Goal: Find optimal parameters to make 59-day backtest profitable!"
echo "   Current: Demo (7d) = +1.26%, Production (59d) = negative"
echo "   Target: Optimize risk threshold, APR, filters for positive 59d returns"
echo ""