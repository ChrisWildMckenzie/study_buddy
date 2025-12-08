# LLM-Powered Revision Question Generation - Implementation Plan

## Overview
This document outlines the plan for adding LLM API integration to Study Buddy for generating revision questions from syllabus documents.

## Core Features
1. **API Key Management**: Securely store and manage multiple LLM provider API keys
2. **Syllabus Document Processing**: Upload, parse, and extract content from syllabi
3. **Prompt Engineering**: Customizable prompt templates for question generation
4. **Question Generation**: Call LLM APIs to generate revision questions
5. **Review & Approval**: Workflow to review, edit, and approve generated questions
6. **Study Plan Integration**: Add approved questions to study schedules

---

## 1. API Key Management & Storage

### Architecture
- **Storage**: IndexedDB `settings` store
- **Security**: Web Crypto API encryption with optional user password/PIN
- **Multi-provider support**: OpenAI, Anthropic, local models, etc.

### Data Schema
```typescript
interface LLMProvider {
  id: string;              // 'openai', 'anthropic', 'cohere', etc.
  name: string;            // Display name
  apiKey: string;          // Encrypted/obfuscated key
  baseUrl?: string;        // Custom endpoint (for local models, Azure, etc.)
  model?: string;          // Default model to use
  enabled: boolean;        // Active/inactive toggle
  createdAt: number;
  updatedAt: number;
}
```

### Security Features
- Client-side encryption using Web Crypto API
- Fallback to base64 obfuscation if no password set
- Clear UI warnings about local storage
- API key validation on save
- Import/export encrypted configurations

### UI Components
- Provider configuration form (add/edit/delete)
- Enable/disable toggles
- Test connection button
- Default provider selector
- Import/export functionality

---

## 2. Syllabus Document Management

### Architecture
- **Documents**: IndexedDB for binary blobs (PDF, DOCX, TXT)
- **Metadata**: SQLite for structured information

### SQLite Schema
```sql
CREATE TABLE syllabi (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  subject TEXT,
  exam_board TEXT,
  academic_year TEXT,
  document_id TEXT,           -- Reference to IndexedDB blob
  document_type TEXT,          -- 'pdf', 'docx', 'txt', 'markdown'
  extracted_text TEXT,         -- Cached plain text extraction
  topics_json TEXT,            -- JSON array of detected topics
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE syllabus_topics (
  id TEXT PRIMARY KEY,
  syllabus_id TEXT NOT NULL,
  topic_name TEXT NOT NULL,
  section_number TEXT,
  parent_topic_id TEXT,        -- For hierarchical topics
  description TEXT,
  keywords_json TEXT,          -- JSON array of key terms
  FOREIGN KEY (syllabus_id) REFERENCES syllabi(id) ON DELETE CASCADE
);
```

### IndexedDB Extension
```typescript
// Add to StudyBuddyDB interface:
documents: {
  key: string;
  value: {
    id: string;
    blob: Blob;
    filename: string;
    mimeType: string;
    size: number;
    uploadedAt: number;
  };
}
```

### Document Processing Pipeline
1. File upload handler (PDF, DOCX, TXT, MD)
2. Text extraction:
   - PDFs: `pdfjs-dist` library
   - DOCX: `mammoth.js` library
   - TXT/MD: Direct reading
3. Topic detection: Keyword extraction, section headers
4. Storage: Blob in IndexedDB, metadata + text in SQLite

---

## 3. Prompt Engineering & Question Generation

### Prompt Template System

#### SQLite Schema
```sql
CREATE TABLE prompt_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  system_prompt TEXT NOT NULL,
  user_prompt_template TEXT NOT NULL,  -- With {{variables}}
  provider_specific_json TEXT,         -- Provider-specific parameters
  version INTEGER DEFAULT 1,
  is_default BOOLEAN DEFAULT 0,
  created_at INTEGER NOT NULL
);
```

#### Template Variables
- `{{syllabus_text}}` - Extracted syllabus content
- `{{topic_name}}` - Specific topic/section
- `{{difficulty_level}}` - Easy/Medium/Hard
- `{{question_count}}` - Number of questions requested
- `{{question_types}}` - MCQ, Short Answer, Essay, etc.
- `{{exam_board}}` - Exam board specific formatting

#### Example Default Prompt
```
System: You are an expert educational content creator specializing in creating exam revision questions.

User: Generate {{question_count}} {{difficulty_level}} revision questions for the topic "{{topic_name}}" based on this syllabus content:

{{syllabus_text}}

Requirements:
- Question types: {{question_types}}
- Format: JSON array with structure: {question, answer, marks, difficulty, topic}
- Align with {{exam_board}} standards
- Include mark schemes and examiner tips
```

### Generation Parameters UI
- Select syllabus document
- Choose target topic(s)
- Number of questions (5-50)
- Question type checkboxes (MCQ, Short Answer, etc.)
- Difficulty distribution slider
- Prompt template selector with preview/edit
- LLM provider selector with cost estimate

### LLM API Integration Layer

#### Abstraction Interface
```typescript
interface LLMRequest {
  provider: string;
  model?: string;
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'text' | 'json';
}

interface LLMResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  provider: string;
  model: string;
}
```

#### Provider Adapters
- OpenAI API adapter
- Anthropic Claude API adapter
- Generic OpenAI-compatible adapter (local models, Azure)
- Error handling: network errors, rate limiting, invalid keys, token limits

---

## 4. Question Review & Approval Workflow

### SQLite Schema
```sql
CREATE TABLE question_generations (
  id TEXT PRIMARY KEY,
  syllabus_id TEXT NOT NULL,
  prompt_template_id TEXT,
  provider TEXT NOT NULL,
  model TEXT,
  generation_params_json TEXT,   -- Store original parameters
  status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  generated_at INTEGER NOT NULL,
  approved_at INTEGER,
  approved_by TEXT,
  FOREIGN KEY (syllabus_id) REFERENCES syllabi(id)
);

CREATE TABLE questions (
  id TEXT PRIMARY KEY,
  generation_id TEXT,
  question_text TEXT NOT NULL,
  answer_text TEXT NOT NULL,
  question_type TEXT,            -- 'mcq', 'short_answer', 'essay'
  difficulty INTEGER DEFAULT 1,  -- 1-5 scale
  marks INTEGER,
  topic TEXT,
  syllabus_id TEXT,
  exam_tips TEXT,
  status TEXT DEFAULT 'draft',   -- 'draft', 'active', 'archived'
  times_reviewed INTEGER DEFAULT 0,
  last_reviewed INTEGER,
  performance_score REAL,        -- Track student performance
  created_at INTEGER NOT NULL,
  FOREIGN KEY (generation_id) REFERENCES question_generations(id),
  FOREIGN KEY (syllabus_id) REFERENCES syllabi(id)
);

CREATE TABLE question_options (
  id TEXT PRIMARY KEY,
  question_id TEXT NOT NULL,
  option_text TEXT NOT NULL,
  is_correct BOOLEAN DEFAULT 0,
  position INTEGER,
  FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
);
```

### Review UI Components
- Generation preview card (metadata, tokens, cost)
- Question list view (expandable cards)
- Individual question editor:
  - Edit question/answer text
  - Adjust difficulty
  - Add tags/topics
  - Flag for revision
- Bulk actions toolbar
- AI-assisted refinement ("Improve this question" button)

### Approval Flow
1. Generate questions → `status='pending'`
2. Review UI displays pending questions
3. User actions:
   - Edit inline
   - Approve → `status='approved'`, copy to active questions
   - Reject → mark for deletion
   - Regenerate with modified prompt
4. Approved questions → study plan
5. Retain generation metadata for analytics

---

## 5. Integration with Study Plan

### Study Plan Schema
```sql
CREATE TABLE study_plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  syllabus_id TEXT,
  start_date INTEGER,
  exam_date INTEGER,
  status TEXT DEFAULT 'active',
  created_at INTEGER NOT NULL,
  FOREIGN KEY (syllabus_id) REFERENCES syllabi(id)
);

CREATE TABLE study_plan_items (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL,
  question_id TEXT,
  scheduled_date INTEGER,
  completed BOOLEAN DEFAULT 0,
  completed_at INTEGER,
  difficulty_rating INTEGER,  -- User-rated difficulty
  time_spent INTEGER,         -- Seconds
  FOREIGN KEY (plan_id) REFERENCES study_plans(id),
  FOREIGN KEY (question_id) REFERENCES questions(id)
);
```

### Integration Features
- Auto-schedule with spaced repetition
- Manual drag/drop to calendar
- Smart scheduling algorithm:
  - Consider exam date
  - Question difficulty
  - Historical performance
  - Workload balancing
- Practice modes: Quiz, flashcard, exam simulation

---

## 6. Additional Considerations

### Offline-First Strategy
- Queue failed API requests in IndexedDB
- Service Worker Background Sync for retries
- Clear offline indicator in UI
- Show queued requests

### Cost Tracking
```sql
CREATE TABLE llm_usage_log (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  model TEXT,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  total_tokens INTEGER,
  estimated_cost REAL,
  request_type TEXT,       -- 'generation', 'refinement', 'validation'
  timestamp INTEGER NOT NULL
);
```
- Track token usage per request
- Display cumulative costs
- Budget alerts/limits

### Privacy & Data Export
- Export all data as JSON
- Clear/delete provider keys
- Anonymize/encrypt exports
- "Clear all LLM data" button

### Testing & Validation
- Mock LLM responses for development
- Unit tests for prompt templates
- Integration tests with test keys
- JSON response validation

---

## 7. Implementation Phases

### Phase 1: Foundation (API Key Management)
- [ ] Design LLM provider configuration schema
- [ ] Extend IndexedDB settings store
- [ ] Implement Web Crypto API encryption
- [ ] Build settings UI for API key management
- [ ] Add API key validation with test requests
- [ ] Create enable/disable toggles
- [ ] Implement import/export functionality

### Phase 2: Document Management
- [ ] Extend IndexedDB schema for documents store
- [ ] Extend SQLite schema (syllabi, topics tables)
- [ ] Build document upload UI component
- [ ] Implement PDF text extraction (pdfjs-dist)
- [ ] Implement DOCX text extraction (mammoth.js)
- [ ] Add TXT/Markdown support
- [ ] Create basic topic detection algorithm
- [ ] Build syllabus management UI

### Phase 3: Prompt System
- [ ] Design prompt template SQLite schema
- [ ] Create default prompt templates
- [ ] Build prompt template CRUD operations
- [ ] Implement variable substitution engine
- [ ] Create prompt customization UI
- [ ] Add prompt preview functionality
- [ ] Build prompt version management

### Phase 4: LLM Integration
- [ ] Design provider adapter abstraction layer
- [ ] Implement OpenAI API adapter
- [ ] Implement Anthropic Claude API adapter
- [ ] Add generic OpenAI-compatible adapter
- [ ] Build request queue system (IndexedDB)
- [ ] Implement retry logic with exponential backoff
- [ ] Add error handling for all failure modes
- [ ] Create Service Worker background sync

### Phase 5: Question Generation
- [ ] Build generation UI with parameter controls
- [ ] Create syllabus/topic selector component
- [ ] Implement question type checkboxes
- [ ] Add difficulty distribution controls
- [ ] Integrate with LLM adapters
- [ ] Parse JSON responses from LLMs
- [ ] Store generated questions in SQLite
- [ ] Handle generation errors gracefully
- [ ] Add token usage tracking

### Phase 6: Review & Approval
- [ ] Design question review UI layout
- [ ] Build generation preview card component
- [ ] Create question list view with expand/collapse
- [ ] Implement inline question editor
- [ ] Add bulk approval actions toolbar
- [ ] Create refinement workflow (re-prompt LLM)
- [ ] Implement approval/rejection flow
- [ ] Build question filtering and search

### Phase 7: Study Plan Integration
- [ ] Design study plan SQLite schema
- [ ] Build scheduling algorithm (spaced repetition)
- [ ] Create study plan management UI
- [ ] Implement calendar/timeline view
- [ ] Add manual question scheduling
- [ ] Build practice mode: quiz interface
- [ ] Build practice mode: flashcard view
- [ ] Add exam simulation mode
- [ ] Track performance and adjust scheduling

### Phase 8: Polish & Advanced Features
- [ ] Implement cost tracking dashboard
- [ ] Add budget alerts and limits
- [ ] Build usage analytics view
- [ ] Create data export/import functionality
- [ ] Add "Clear all data" functionality
- [ ] Implement offline queue UI with status
- [ ] Add loading states and progress indicators
- [ ] Create onboarding/tutorial flow
- [ ] Write user documentation
- [ ] Add keyboard shortcuts

---

## 8. Technology Stack Additions

### New Dependencies
- `pdfjs-dist` - PDF text extraction
- `mammoth` - DOCX to text conversion
- `marked` or `remark` - Markdown parsing (optional)
- Web Crypto API (native) - Key encryption
- `dompurify` - Sanitize LLM-generated content
- `date-fns` - Date handling for spaced repetition

### API Providers to Support
- **OpenAI**: Standard REST API
- **Anthropic**: Claude API
- **Local models**: Ollama, LM Studio (OpenAI-compatible)
- **Alternative providers**: Groq, Together AI, Replicate

---

## 9. User Journey

1. **Setup**: User adds API key(s) in settings
2. **Upload**: User uploads syllabus document
3. **Process**: App extracts text, detects topics
4. **Configure**: User selects topics, parameters, prompt
5. **Generate**: User clicks "Generate Questions" → API call
6. **Review**: Questions appear in staging area
7. **Edit**: User reviews, edits, approves/rejects
8. **Integrate**: Approved questions → study plan
9. **Study**: User practices using generated questions

---

## 10. Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| API costs | Token estimates, cost tracking, budget limits |
| Offline access | Queue requests, graceful degradation |
| Key security | Client-side encryption, clear warnings |
| LLM quality | Allow regeneration, manual editing, prompt refinement |
| Rate limiting | Backoff, request throttling |
| Large syllabi | Chunk content, paginate requests |
| Storage limits | Compress old data, archive old generations |

---

## Notes

- Maintain offline-first PWA architecture throughout
- Use dual-storage strategy: IndexedDB for documents, SQLite for structured data
- Ensure all LLM interactions are queued for offline resilience
- Prioritize user control: always allow editing, regeneration, manual overrides
- Keep security warnings clear: client-side storage has limitations

---

**Status**: Planning complete, ready for implementation
**Last Updated**: 2025-10-14
