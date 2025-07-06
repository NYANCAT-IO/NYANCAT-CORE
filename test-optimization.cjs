#!/usr/bin/env node

// Quick test of our optimization framework
console.log('🧪 Testing ML Optimization Framework...');

const { spawn } = require('child_process');
const path = require('path');

const worktreeDir = '../ccxt-funding-ml-opt';

// Test TypeScript compilation
console.log('📝 Testing TypeScript compilation...');

const tsc = spawn('pnpm', ['tsc', '--noEmit'], {
  cwd: path.resolve(worktreeDir),
  stdio: 'inherit'
});

tsc.on('close', (code) => {
  if (code === 0) {
    console.log('✅ TypeScript compilation successful!');
    
    // Test the optimize-ml command help
    console.log('\n🔍 Testing optimize-ml command...');
    
    const optimizeTest = spawn('pnpm', ['optimize-ml', '--help'], {
      cwd: path.resolve(worktreeDir),
      stdio: 'inherit'
    });
    
    optimizeTest.on('close', (helpCode) => {
      if (helpCode === 0) {
        console.log('\n✅ optimize-ml command is working!');
        console.log('\n🎯 Ready to run optimization!');
        console.log('📚 Usage examples:');
        console.log('   pnpm optimize-ml --days 14 --evaluations 25');
        console.log('   pnpm optimize-ml --days 30 --evaluations 50 --baseline --validate');
        console.log('   pnpm optimize-ml --days 7 --evaluations 20 --output json');
      } else {
        console.log('❌ optimize-ml command failed');
      }
    });
    
  } else {
    console.log('❌ TypeScript compilation failed');
    process.exit(1);
  }
});

tsc.on('error', (error) => {
  console.error('❌ Failed to run TypeScript compilation:', error);
  process.exit(1);
});