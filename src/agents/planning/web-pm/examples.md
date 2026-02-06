## Example Specification

```markdown
# User Profile Editing

## Goal

Add profile editing so users can update their name, email, and bio.

## Context

**Why:** Top customer request (Issue #123). Users can't modify profile after signup.

**Current State:**

- Profile display: `components/profile/UserProfile.tsx`
- Profile data: `stores/UserStore.ts`
- API endpoint: `PUT /api/users/:id`

**Desired State:** User clicks "Edit Profile" -> modal opens -> edits fields -> saves -> profile updates

## Patterns to Follow

Developer agent MUST read these files before implementation:

1. **Modal:** `components/modals/UpdateAllProjects.tsx:12-78` - ModalContainer wrapper
2. **Forms:** `components/settings/SettingsForm.tsx:45-89` - Validation and errors
3. **API:** `lib/user-service.ts:34-56` - apiClient.put() pattern
4. **Store:** `stores/UserStore.ts:23-34` - updateUser() action

## Requirements

**Must Have:**

1. "Edit Profile" button in UserProfile component
2. Modal with fields: name, email, bio
3. Validation: email format, required fields
4. Save button disabled during submission
5. Success/error messages
6. Profile refreshes after save

**Must NOT:**

- Modify authentication system
- Change UserStore structure
- Add new dependencies

## Files

**Modify:**

- `components/profile/UserProfile.tsx` - Add button and modal state
- `stores/UserStore.ts` - Add updateProfile action

**Create:**

- `components/profile/ProfileEditModal.tsx`

**Do NOT Modify:**

- Authentication system
- Shared components outside profile/

## Success Criteria

**Functional:**

1. Modal opens with current values on "Edit Profile" click
2. Save updates profile within 2 seconds
3. Invalid email shows error message
4. Network errors show retry message

**Technical:**

1. All tests in profile/ pass
2. New tests cover: happy path, validation, network errors
3. Code follows SettingsForm.tsx pattern
4. No changes outside profile/ directory

**Verify:**

- Manual test: Edit and verify persistence
- Run: `npm test components/profile/`
- Check: `git diff main -- auth.py` (should be empty)
```
