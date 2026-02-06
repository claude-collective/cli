## Example Research Output

### Component Research: Button Variants

````markdown
## Research Findings: Button Component Variants

**Research Type:** Design System Research
**Files Examined:** 8

---

### Component Inventory

| Component   | Location                                         | Purpose          | Key Props                        |
| ----------- | ------------------------------------------------ | ---------------- | -------------------------------- |
| Button      | `/packages/ui/src/button/button.tsx`             | Primary button   | variant, size, disabled, loading |
| IconButton  | `/packages/ui/src/icon-button/icon-button.tsx`   | Icon-only button | icon, label (aria), size         |
| ButtonGroup | `/packages/ui/src/button-group/button-group.tsx` | Groups buttons   | orientation, spacing             |

---

### Existing Pattern: Button with Variants

**File:** `/packages/ui/src/button/button.tsx:15-32`

```typescript
const buttonVariants = cva(styles.base, {
  variants: {
    variant: {
      primary: styles.primary,
      secondary: styles.secondary,
      ghost: styles.ghost,
    },
    size: { sm: styles.sm, md: styles.md, lg: styles.lg },
  },
  defaultVariants: { variant: "primary", size: "md" },
});
```
````

---

### Token System

- Base tokens: `/packages/ui/src/styles/tokens/base.css`
- Semantic tokens: `/packages/ui/src/styles/tokens/semantic.css`
- Component tokens: `/packages/ui/src/button/button.module.scss:1-20`

---

### Files to Reference

1. `/packages/ui/src/button/button.tsx` - Variant pattern
2. `/packages/ui/src/button/button.module.scss` - Token-based styling
3. `/packages/ui/src/input/input.tsx` - Similar variant pattern

````

---

### Pattern Discovery: Form Handling

```markdown
## Research Findings: Form Handling Patterns

**Research Type:** Pattern Discovery
**Files Examined:** 12

---

### Form Library

**Library:** React Hook Form v7.x
**Usage Count:** 15 forms found

---

### Primary Example

**File:** `/apps/client-next/src/features/settings/settings-form.tsx:12-35`

```typescript
const settingsSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
  bio: z.string().optional(),
});

type SettingsFormData = z.infer<typeof settingsSchema>;

export const SettingsForm = () => {
  const { register, handleSubmit, formState: { errors } } = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
  });

  const mutation = useMutation({
    mutationFn: updateSettings,
    onSuccess: () => toast.success('Settings saved'),
  });

  return <form onSubmit={handleSubmit(data => mutation.mutate(data))}>{/* fields */}</form>;
};
````

---

### Key Conventions

| Convention  | Location                | Description                      |
| ----------- | ----------------------- | -------------------------------- |
| Zod schemas | settings-form.tsx:12-18 | All forms use Zod for validation |
| zodResolver | settings-form.tsx:24    | Connects Zod to React Hook Form  |
| useMutation | settings-form.tsx:28-31 | React Query handles submission   |

---

### Files to Reference

1. `/apps/client-next/src/features/settings/settings-form.tsx` - Complete example
2. `/packages/ui/src/input/input.tsx` - Input with error handling
3. `/apps/client-next/src/lib/zod-schemas.ts` - Shared schema patterns

```

```
