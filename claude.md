# Development Rules for Claude

## Git Workflow

### Commit Protocol
1. **Commit frequently** - After every meaningful change
2. **Pre-commit check** - ALWAYS run `git diff --staged` before committing
3. **Sensitive data check** - Look for:
   - API keys (anything containing 'key', 'secret', 'token')
   - Private keys
   - Wallet addresses
   - Passwords
   - .env file contents
4. **Commit messages** - Use descriptive messages:
   - "feat: add funding rate service"
   - "fix: handle network errors"
   - "docs: update implementation plan"

### .gitignore Management
- **Update before creating sensitive files**
- **Check .gitignore is working**: `git status` should not show .env
- **Add new patterns** when introducing:
  - New build outputs
  - New temporary files
  - New IDE configurations

## Package Management

### PNPM Only
- **Install packages**: `pnpm add package-name`
- **Install dev dependencies**: `pnpm add -D package-name`
- **Install all**: `pnpm install`
- **Never use**: npm or yarn

### Lock File
- **Always commit**: pnpm-lock.yaml
- **Never edit manually**
- **Regenerate if corrupted**: Delete and run `pnpm install`

## Configuration Management

### Environment Variables
- **All secrets in .env**:
  ```
  # Bybit Testnet
  BYBIT_TESTNET_API_KEY=your_key_here
  BYBIT_TESTNET_API_SECRET=your_secret_here
  
  # Hyperliquid Testnet  
  HYPERLIQUID_TESTNET_API_KEY=your_key_here
  HYPERLIQUID_TESTNET_API_SECRET=your_secret_here
  
  # Trading Configuration
  SYMBOLS=BTC/USDT,ETH/USDT
  ```
- **Template in .env.example** - Always keep updated
- **Load with dotenv**: At the start of the application
- **Validate on startup**: Check all required vars exist

### Security Rules
- **Never hardcode**:
  - API credentials
  - URLs with keys
  - Any sensitive data
- **Never log**:
  - Full API responses with keys
  - Request headers with auth
  - Any credentials

## TypeScript Standards

### Compilation
- **Before every commit**: Run `pnpm tsc`
- **Zero errors policy**: Fix all TypeScript errors
- **Strict mode**: Use strict TypeScript config
- **Type everything**: No implicit any

### Code Quality
- **Interfaces for data**: Define all shapes
- **Enums for constants**: For fixed sets of values
- **Error types**: Proper error handling
- **Async/await**: Prefer over callbacks

## Testing Protocol

### Manual Testing Steps
1. **Build check**: `pnpm tsc` - Must pass
2. **Basic run**: `pnpm start` - Should show help or data
3. **All commands**:
   - `pnpm start --help`
   - `pnpm start`
   - `pnpm start --symbol BTC/USDT`
   - `pnpm start --compare`
   - `pnpm start --json`
4. **Error cases**:
   - Missing .env
   - Invalid API keys
   - Network offline
   - Invalid symbols

### Validation Checklist
- [ ] TypeScript compiles
- [ ] CLI runs without crashes
- [ ] Handles missing config gracefully
- [ ] Shows helpful error messages
- [ ] All commands work as expected

## Directory Standards

### Project Structure
```
ccxt-funding/
├── plans/          # Implementation plans
├── docs/           # Documentation & findings
├── src/
│   ├── lib/       # Core library (reusable)
│   └── cli/       # CLI-specific code
├── dist/          # Compiled output (git ignored)
└── node_modules/  # Dependencies (git ignored)
```

### File Organization
- **One class per file**
- **Index files for exports**
- **Group by feature**: exchanges/, types/, utils/
- **Clear naming**: funding.service.ts, bybit.adapter.ts

## Development Workflow

### Starting Work
1. Check current branch: `git status`
2. Pull latest: `git pull`
3. Install deps: `pnpm install`
4. Create .env from template

### During Development
1. Make changes
2. Test locally
3. Run `pnpm tsc`
4. Test all commands
5. Check git diff
6. Commit with message

### Before Pushing
1. Run all tests
2. Check no secrets: `git diff origin/main`
3. Ensure .gitignore working
4. Verify clean commit history

## Common Commands

```bash
# Development
pnpm install          # Install dependencies
pnpm tsc             # Check TypeScript
pnpm start           # Run CLI
pnpm start --help    # Show help

# Git Safety
git diff --staged    # Check before commit
git status          # Check tracked files
git log --oneline   # Review commits

# Debugging
node --inspect dist/cli/index.js  # Debug mode
pnpm tsc --watch    # Watch mode
```

## Important Reminders

1. **Always use testnet** for development
2. **Check for secrets** before every commit
3. **Keep .gitignore updated**
4. **Test actual functionality**, not just compilation
5. **Document findings** in docs/ directory
6. **Use pnpm**, never npm or yarn