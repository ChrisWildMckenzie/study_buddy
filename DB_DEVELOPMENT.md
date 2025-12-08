# Database Development Documentation

## Design Decisions

### Multi-Device Sync Consideration
**Decision**: Use GUID primary keys instead of auto-incrementing integers
**Rationale**: The application is offline-first and may need to sync data from multiple offline installations. Auto-incrementing integers would create primary key conflicts when merging data from different devices. GUIDs ensure globally unique identifiers.

### Composite Primary Keys
**Decision**: Use composite primary key (question_id, question_type) for questions and related tables
**Rationale**:
- Enforces referential integrity at the database level
- Prevents accidentally associating the wrong answer configuration with a question type
- Child tables include question_type with CHECK constraints to ensure type safety
- Example: `single_answer_config` has `CHECK (question_type = 'single_answer')` preventing a multi-choice config from being inserted

### Parallel Table Structure
**Decision**: Create separate question and config tables for each question type, rather than a single questions table with JSON config
**Rationale**:
- Keeps structure captured in DDL rather than application code
- Enables database-level constraints and validation
- Makes queries more efficient and type-safe
- Easier to maintain and evolve individual question types
- Avoids "stringly-typed" JSON configurations that are error-prone

### Minimal Core Tables
**Decision**: The core `questions` table only contains essential cross-cutting data (id, type, difficulty, timestamps)
**Rationale**:
- Question-specific data lives in type-specific tables (e.g., `single_answer_questions`)
- Answer validation logic lives in type-specific config tables (e.g., `single_answer_config`)
- This pattern scales as we add more question types with different requirements
- Keeps the core table lean and focused
- Tags are handled separately via many-to-many relationship, not stored in core table

### Type Safety via Lookup Table
**Decision**: Create `question_types` lookup table with valid type codes
**Rationale**:
- Centralizes valid question types
- Foreign key constraints prevent invalid types
- Makes it easy to query all available question types
- Documents the system's capabilities in the schema itself

### User-Defined Tagging System
**Decision**: Replace fixed `category` column with flexible many-to-many tag system
**Rationale**:
- Users can create their own organizational taxonomy
- Questions can have multiple tags (not just one category)
- Tags are normalized - stored once, referenced many times
- Shared across all question types via common `tags` and `question_tags` tables
- Supports autocomplete and tag suggestions in UI
- Unused tags can be cleaned up automatically

## Schema Overview

### Core Schema

```sql
question_types (lookup table)
├── type_code (PK)
└── description

questions (core metadata)
├── question_id (PK part 1) -- GUID
├── question_type (PK part 2, FK to question_types)
├── category
├── difficulty (1-5)
├── created_at
└── updated_at
```

### Single Answer Question Type

```sql
single_answer_questions
├── question_id (PK part 1, FK to questions)
├── question_type (PK part 2, FK to questions, CHECK = 'single_answer')
└── question_text

single_answer_config
├── question_id (PK part 1, FK to questions)
├── question_type (PK part 2, FK to questions, CHECK = 'single_answer')
├── correct_answer
├── case_sensitive (boolean as integer)
└── allow_partial_match (boolean as integer)
```

## Code Organization

### File Structure
- `src/storage/sqlite.ts` - Core SQLite setup, schema definitions, utility functions
- `src/storage/singleAnswerQuestions.ts` - CRUD operations for single_answer question type
- Future: `src/storage/multiChoiceQuestions.ts`, etc. for other question types

### Why Separate Files?
- `sqlite.ts` would become massive if all question type logic lived there
- Each question type is an independent concern
- Makes the codebase easier to navigate and maintain
- Developers can work on different question types without conflicts

## Patterns for Future Question Types

When adding a new question type (e.g., `multi_choice`):

1. **Add to question_types lookup table**
   ```sql
   INSERT INTO question_types (type_code, description) VALUES
     ('multi_choice', 'Multiple choice with one correct answer');
   ```

2. **Create type-specific question table**
   ```sql
   CREATE TABLE multi_choice_questions (
     question_id TEXT NOT NULL,
     question_type TEXT NOT NULL DEFAULT 'multi_choice',
     question_text TEXT NOT NULL,
     PRIMARY KEY (question_id, question_type),
     FOREIGN KEY (question_id, question_type) REFERENCES questions(...) ON DELETE CASCADE,
     CHECK (question_type = 'multi_choice')
   );
   ```

3. **Create type-specific config/options tables**
   ```sql
   CREATE TABLE multi_choice_options (
     id TEXT PRIMARY KEY,
     question_id TEXT NOT NULL,
     question_type TEXT NOT NULL DEFAULT 'multi_choice',
     option_text TEXT NOT NULL,
     is_correct INTEGER NOT NULL,
     display_order INTEGER NOT NULL,
     FOREIGN KEY (question_id, question_type) REFERENCES questions(...) ON DELETE CASCADE,
     CHECK (question_type = 'multi_choice')
   );
   ```

4. **Create dedicated module** (e.g., `multiChoiceQuestions.ts`)
   - Export interface for the question type
   - Implement create, read, update, delete functions
   - Handle all type-specific business logic

## Design Principles Applied

### Complexity Budget
"Make the structure as complex as necessary, but no more"

We chose:
- ✅ Composite keys for type safety (necessary complexity)
- ✅ Separate tables per question type (necessary for DDL-based validation)
- ✅ GUIDs for sync support (necessary for offline-first)
- ❌ No JSON config fields (unnecessary complexity, defeats type safety)
- ❌ No over-engineered polymorphic patterns (would add unnecessary abstraction)

### Offline-First Architecture
- All data stored in SQLite (runs in browser via sql.js)
- Database persisted to localStorage as base64
- No server dependencies for core functionality
- GUID keys enable future multi-device sync

### Transparency & Inspectability
- Schema is defined in readable SQL DDL
- No hidden magic or code generation
- Database can be exported and inspected directly
- Type constraints visible in schema, not buried in application code

## Migration Strategy

Since this is early development with no production data:
- Schema changes can be made directly
- Once users start storing data, migrations will need careful planning
- Consider versioning strategy for future schema changes
- GUIDs will make data merging easier during migrations

## Future Considerations

### When User Data Exists
- Cannot easily change composite key structure
- Adding new columns is safe
- Removing columns requires migration
- Type changes require careful migration with data transformation

### Sync Strategy (Future)
- GUIDs already in place for conflict-free merging
- Will need conflict resolution strategy (last-write-wins, manual merge, etc.)
- Timestamps (created_at, updated_at) support sync logic
- Consider adding device_id for tracking data origin
