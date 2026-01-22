# Code Examples & Templates

This directory contains representative examples that demonstrate the "right way" to write code in the TG-CLNDR project. Use these as references when implementing new features.

## Files

### 01-value-model-pattern.ts
**What it demonstrates:**
- Custom Value Model (VM) pattern for reactive state management
- Using # private fields (ES2022 syntax)
- Subscribe/unsubscribe pattern
- Integration with React hooks
- Managing collections with VMs

**When to use:**
- Creating new client-side modules
- Managing reactive state on the frontend
- Building observable data structures

**Key takeaways:**
- VM is lightweight alternative to Redux/MobX
- Always use `useVMvalue` hook in React components
- Create Map of VMs for collections
- Use `subscribe` for manual side effects

---

### 02-server-module-template.ts
**What it demonstrates:**
- Complete server module structure
- Dependency injection with TSyringe
- MongoDB transaction patterns
- Optimistic concurrency control with sequence numbers
- Soft delete pattern
- Pub/sub with Subject
- In-memory caching with expiration
- Socket.io integration

**When to use:**
- Creating new server-side modules
- Implementing CRUD operations
- Working with MongoDB
- Broadcasting updates to clients

**Key takeaways:**
- Always use `@singleton()` decorator
- Use transactions for multi-document operations
- Always end session in `finally` block
- Soft delete instead of hard delete
- Broadcast updates via Subject
- Cache with expiration for frequently accessed data

---

### 03-react-component-template.tsx
**What it demonstrates:**
- Complete React component structure
- WithModel HOC pattern
- React hooks best practices
- Form handling with local state
- Async operations with error handling
- Navigation patterns
- Telegram WebApp integration
- UI Kit component usage
- Memoization for performance

**When to use:**
- Creating new screens
- Building forms
- Handling user input
- Integrating with Telegram WebApp

**Key takeaways:**
- Use `WithModel` for SessionModel access
- Memoize list items with `React.memo`
- Use `useCallback` for event handlers
- Use `useMemo` for computed values
- Always use Telegram CSS variables for styling
- Use Telegram controllers (BackButton, MainButton, etc.)
- Confirm destructive actions with `showConfirm`

---

## How to Use These Examples

### For New Features
1. Identify what you need (server module, client module, component)
2. Copy the relevant template
3. Rename to match your feature
4. Fill in your specific logic
5. Follow the patterns and best practices

### For Code Review
1. Compare your code to these templates
2. Check that you're following the same patterns
3. Ensure you haven't missed any best practices
4. Verify error handling and edge cases

### For Learning
1. Read through each example
2. Understand the "why" behind each pattern
3. See how patterns connect (VM → Component → Module)
4. Reference when you're unsure

## Pattern Quick Reference

### Client-Side Patterns
- **State Management**: Value Model (VM) pattern
- **Components**: Functional with hooks
- **Model Access**: WithModel HOC
- **Reactive State**: useVMvalue hook
- **Event Handlers**: React.useCallback
- **Computed Values**: React.useMemo
- **List Items**: React.memo
- **Navigation**: useGoBack, useGoHome
- **Styling**: Inline with Telegram CSS variables

### Server-Side Patterns
- **Modules**: @singleton with dependency injection
- **Database**: MongoDB with transactions
- **Concurrency**: Sequence numbers (seq field)
- **Deletes**: Soft delete (deleted: true)
- **Queries**: Exclude deleted ({ deleted: { $ne: true } })
- **Updates**: Subject pattern for pub/sub
- **Caching**: In-memory Map with expiration
- **Errors**: Try-catch with console.error

### Communication Patterns
- **Client → Server**: Socket.io emit with acknowledgment callback
- **Server → Client**: Socket.io broadcast to chat rooms
- **Server → Server**: Subject.subscribe for module communication

## Common Gotchas

1. **Forgetting to end MongoDB session**: Always use `finally` block
2. **Not using useCallback**: Causes unnecessary re-renders
3. **Hardcoding styles**: Use Telegram CSS variables
4. **Hard deleting data**: Use soft delete pattern
5. **Missing error handling**: Wrap async operations
6. **Not memoizing list items**: Performance issues with long lists
7. **Forgetting to broadcast updates**: Changes won't sync to other clients
8. **Not using transactions**: Data inconsistency risk

## Additional Resources

- **Project Overview**: `/tg-clndr/.claude/PROJECT_OVERVIEW.md`
- **Coding Standards**: `/tg-clndr/.claude/CODING_STANDARDS.md`
- **Dev Guidelines**: `/tg-clndr/.claude/DEV_GUIDELINES.md`

## Contributing Examples

When adding new patterns or examples:
1. Follow the same format as existing examples
2. Include inline comments explaining the "why"
3. Add to this README with description
4. Keep examples focused on one concept
5. Show both correct and incorrect approaches
