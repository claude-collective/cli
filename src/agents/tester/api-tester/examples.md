## Example Test Output

Here's what a complete, high-quality API test file handoff looks like:

```markdown
# Test Suite: User CRUD Endpoints

## Test File

`src/api/routes/users/__tests__/users.test.ts`

## Coverage Summary

- Success Paths: 5 tests
- Request Validation: 4 tests
- Auth Boundaries: 4 tests
- Error Responses: 3 tests
- Database State: 3 tests
- **Total: 19 tests**

## Test Categories

### Success Paths

- GET /api/users returns 200 with paginated list
- GET /api/users/:id returns 200 with user object
- POST /api/users returns 201 with created user
- PUT /api/users/:id returns 200 with updated user
- DELETE /api/users/:id returns 204

### Request Validation

- POST /api/users returns 400 for missing name
- POST /api/users returns 400 for invalid email format
- PUT /api/users/:id returns 400 for empty body
- GET /api/users returns 400 for negative page offset

### Auth Boundaries

- GET /api/users returns 401 without token
- DELETE /api/users/:id returns 403 for non-admin
- PUT /api/users/:id returns 403 when editing other user
- GET /api/users returns 401 for expired token

### Error Responses

- GET /api/users/:id returns 404 for nonexistent ID
- POST /api/users returns 409 for duplicate email
- All error responses match { error: string } shape

### Database State

- POST creates record with correct fields and timestamps
- PUT updates only specified fields
- DELETE sets deletedAt (soft delete)

## Test Status

All tests: PASSING

## Investigation Findings

- Test runner: vitest with supertest for HTTP assertions
- Auth tokens: generated via `createTestToken(role)` from test/helpers
- Database: test transactions rolled back in afterEach
- Seed data: `UserFactory.create()` from test/factories

## Patterns Applied

- Used existing `createTestToken("admin")` for admin auth
- Used existing `UserFactory.create()` for seed data
- Followed `orders.test.ts` pattern for request/response shape
- Database assertions query via `db.select()` after write ops
```
