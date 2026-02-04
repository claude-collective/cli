## Example Research Output

### API Route Research: User Endpoints

```markdown
## Research Findings: User API Routes

**Research Type:** API Route Discovery
**Files Examined:** 12

---

### Route Inventory

| Method | Path           | Handler Location                   | Auth | Description      |
| ------ | -------------- | ---------------------------------- | ---- | ---------------- |
| GET    | /api/users/:id | `/apps/api/src/routes/users.ts:15` | Yes  | Get user by ID   |
| PATCH  | /api/users/:id | `/apps/api/src/routes/users.ts:35` | Yes  | Update user      |
| GET    | /api/users/me  | `/apps/api/src/routes/users.ts:55` | Yes  | Get current user |

---

### Route Handler Pattern

**File:** `/apps/api/src/routes/users.ts:15-33`

```typescript
app.get(
  "/users/:id",
  zValidator("param", z.object({ id: z.string().uuid() })),
  authMiddleware,
  async (c) => {
    const { id } = c.req.valid("param");
    const user = await userService.findById(id);
    if (!user) return c.json({ error: "User not found" }, 404);
    return c.json(user);
  },
);
```

---

### Middleware

- **Auth:** `/apps/api/src/middleware/auth.ts:8-25` - Validates session, attaches user
- **Error:** `/apps/api/src/middleware/error.ts:5-20` - Catches errors, logs to Pino

---

### Files to Reference

1. `/apps/api/src/routes/users.ts` - User routes example
2. `/apps/api/src/middleware/auth.ts` - Auth middleware
3. `/apps/api/src/services/user-service.ts` - Service layer pattern
```

---

### Database Schema Research: Posts

```markdown
## Research Findings: Database Schema for Posts

**Research Type:** Database Pattern Research
**Files Examined:** 6

---

### Table Definition

**File:** `/packages/database/src/schema.ts:78-95`

```typescript
export const posts = pgTable('posts', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: varchar('title', { length: 255 }).notNull(),
  content: text('content'),
  authorId: uuid('author_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  status: varchar('status', { length: 50 }).notNull().default('draft'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
```

---

### Relationships

| Relation | Type         | Foreign Key | Target          |
| -------- | ------------ | ----------- | --------------- |
| author   | many-to-one  | authorId    | users.id        |
| comments | one-to-many  | -           | comments.postId |
| tags     | many-to-many | -           | posts_to_tags   |

---

### Query Patterns

- **Select with relations:** `db.query.posts.findMany({ with: { author: true } })`
- **Insert with returning:** `db.insert(posts).values({...}).returning()`

---

### Files to Reference

1. `/packages/database/src/schema.ts` - Table definitions
2. `/apps/api/src/services/post-service.ts` - Query patterns
3. `/packages/database/drizzle/` - Migration examples
```
