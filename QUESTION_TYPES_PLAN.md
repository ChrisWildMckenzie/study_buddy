# Question Types Implementation Plan

This document outlines the planned structure for different question types. We'll implement these incrementally as needed.

## Implementation Pattern

All question types follow a consistent pattern:

1. **Entry in question_types lookup table** - Defines valid type code
2. **Core questions table entry** - Stores (question_id, question_type) with metadata
3. **Type-specific questions table** - Stores question text and type-specific data
4. **Type-specific config/options table(s)** - Stores answer validation data
5. **Dedicated module** - TypeScript file with CRUD operations and interface

All tables use:
- GUID primary keys (for multi-device sync)
- Composite keys (question_id, question_type) for type safety
- CHECK constraints to prevent type mismatches
- CASCADE DELETE for referential integrity

**Shared across all question types:**
- Tags are stored in `tags` table and linked via `question_tags` many-to-many table
- Tag management functions in `src/storage/tags.ts`
- Tag selector UI component in `src/components/tagSelector.ts`

## Current Implementation

### single_answer ✅ IMPLEMENTED
**Use case**: Single correct one-word or short text answer (e.g., "What is the capital of France?" → "Paris")

**Tables**:
```
questions (core metadata)
├── question_id, question_type (composite PK)
├── difficulty
└── timestamps

single_answer_questions (question data)
├── question_id, question_type (composite PK)
└── question_text

single_answer_config (answer validation)
├── question_id, question_type (composite PK)
├── correct_answer
├── case_sensitive (0 or 1)
└── allow_partial_match (0 or 1)

tags (shared - many-to-many via question_tags)
├── tag_id (GUID PK)
├── tag_name (UNIQUE)
└── created_at
```

**Module**: `src/storage/singleAnswerQuestions.ts`
**Functions**: create, get, getAll, update, delete
**Interface**: Includes `tags: Tag[]` array
**UI**: Uses `TagSelector` component from `src/components/tagSelector.ts`

## Planned Question Types

### multi_choice ⏳ PLANNED
**Use case**: Multiple choice with exactly one correct answer (e.g., "What is 2+2? A) 3 B) 4 C) 5" → B)

**Planned tables**:
```
multi_choice_questions
├── question_id, question_type (composite PK)
├── question_text
└── shuffle_options (boolean)

multi_choice_options
├── option_id (GUID PK)
├── question_id, question_type (composite FK)
├── option_text
├── is_correct (0 or 1)
└── display_order
```

**Constraints**:
- Exactly one option must have is_correct = 1
- At least 2 options required

**Module**: `src/storage/multiChoiceQuestions.ts` (future)

### multi_select ⏳ PLANNED
**Use case**: "Name 5 concepts out of 7" type questions, select multiple correct answers

**Planned tables**:
```
multi_select_questions
├── question_id, question_type (composite PK)
├── question_text
└── instruction_text (e.g., "Select 3 of the following")

multi_select_config
├── question_id, question_type (composite PK)
├── required_correct_count (how many they must select)
└── allow_partial_credit (boolean)

multi_select_items
├── item_id (GUID PK)
├── question_id, question_type (composite FK)
├── item_text
├── is_correct (0 or 1)
└── display_order
```

**Example**: "Select 3 renewable energy sources from the following 7 options"

**Module**: `src/storage/multiSelectQuestions.ts` (future)

### calculation ⏳ PLANNED
**Use case**: Math/science calculations requiring working and final answer

**Planned tables**:
```
calculation_questions
├── question_id, question_type (composite PK)
├── question_text
└── formula_hint (optional LaTeX formula)

calculation_config
├── question_id, question_type (composite PK)
├── correct_answer (REAL - numeric answer)
├── requires_working (boolean - must show work)
├── tolerance (REAL - acceptable margin of error, e.g., 0.01)
└── unit (TEXT - expected unit, e.g., "meters", "kg")

calculation_working_keywords (optional table for partial credit)
├── keyword_id (GUID PK)
├── question_id, question_type (composite FK)
├── keyword (TEXT - expected term/concept in working)
└── points (INTEGER - partial credit for including this)
```

**Example**: "Calculate the velocity of an object after 5 seconds with acceleration 9.8 m/s²"
- correct_answer: 49.0
- unit: "m/s"
- tolerance: 0.1

**Module**: `src/storage/calculationQuestions.ts` (future)

### essay ⏳ PLANNED
**Use case**: Paragraph-length answers evaluated against a rubric

**Planned tables**:
```
essay_questions
├── question_id, question_type (composite PK)
├── question_text
├── min_words (optional)
└── max_words (optional)

essay_rubric_items
├── rubric_item_id (GUID PK)
├── question_id, question_type (composite FK)
├── criterion (TEXT - what is being evaluated)
├── max_points (INTEGER)
├── description (TEXT - what constitutes full marks)
└── display_order

essay_rubric_levels (optional - for detailed rubrics)
├── level_id (GUID PK)
├── rubric_item_id (FK)
├── level_name (TEXT - e.g., "Excellent", "Good", "Fair")
├── points (INTEGER)
└── description (TEXT)
```

**Example**: "Explain the causes of World War I (300-500 words)"
Rubric items:
- Economic factors (max 5 points)
- Political alliances (max 5 points)
- Immediate triggers (max 3 points)
- Writing clarity (max 2 points)

**Module**: `src/storage/essayQuestions.ts` (future)

## Design Principles

1. **Composite keys**: Each question type uses (question_id, question_type) composite primary key
2. **Type safety**: Child tables include question_type with CHECK constraints to prevent mismatched configs
3. **GUID keys**: All IDs are GUIDs to support offline multi-device sync
4. **Parallel structure**: Each question type has its own questions table and config table(s)
5. **Minimal top-level**: The `questions` table only contains the essentials (id, type, category, difficulty, timestamps)
6. **Cascading deletes**: All child tables use ON DELETE CASCADE for referential integrity
7. **Separate modules**: Each question type gets its own TypeScript module for CRUD operations

## Adding a New Question Type - Checklist

When implementing a new question type:

### Database Layer
- [ ] Add type to `question_types` table via INSERT in `sqlite.ts`
- [ ] Create type-specific questions table with composite PK
- [ ] Create type-specific config/options table(s) with composite FK
- [ ] Add CHECK constraint to enforce question_type value
- [ ] Add CASCADE DELETE to all foreign keys

### Storage Module
- [ ] Create new TypeScript module in `src/storage/` (e.g., `multiChoiceQuestions.ts`)
- [ ] Export interface for the question type (include `tags: Tag[]`)
- [ ] Import tag functions: `import { setQuestionTags, getQuestionTags, type Tag } from './tags'`
- [ ] Implement create function (call `setQuestionTags()` if tags provided)
- [ ] Implement get/getAll functions (call `getQuestionTags()` and include in result)
- [ ] Implement update function (call `setQuestionTags()` if tags provided)
- [ ] Implement delete function

### UI Layer
- [ ] Create form page in `src/pages/` (e.g., `multiChoiceForm.ts`)
- [ ] Import and use `TagSelector` component from `src/components/tagSelector.ts`
- [ ] Pass initial tags to TagSelector: `new TagSelector({ containerId, initialTags })`
- [ ] Get tags on submit: `tagSelector.getTags()`
- [ ] Create list page to display questions with tags
- [ ] Register routes in `src/main.ts`

### Documentation
- [ ] Update this plan document with ✅ IMPLEMENTED
- [ ] Consider backward compatibility if users have existing data
