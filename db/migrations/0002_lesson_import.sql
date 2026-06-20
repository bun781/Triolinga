alter table lessons add column if not exists description text;
alter table lessons add column if not exists source text;
alter table lessons add column if not exists tags jsonb not null default '[]'::jsonb;

create table if not exists lesson_sentences (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references lessons(id) on delete cascade,
  sentence_id uuid not null references sentences(id) on delete cascade,
  position integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sentence_vocabulary_links (
  id uuid primary key default gen_random_uuid(),
  sentence_id uuid not null references sentences(id) on delete cascade,
  vocabulary_item_id uuid not null references learning_items(id) on delete cascade,
  surface_text text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sentence_grammar_links (
  id uuid primary key default gen_random_uuid(),
  sentence_id uuid not null references sentences(id) on delete cascade,
  grammar_item_id uuid not null references learning_items(id) on delete cascade,
  surface_text text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sentence_chunk_links (
  id uuid primary key default gen_random_uuid(),
  sentence_id uuid not null references sentences(id) on delete cascade,
  chunk_item_id uuid not null references learning_items(id) on delete cascade,
  surface_text text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists lesson_sentences_lesson_sentence_idx on lesson_sentences(lesson_id, sentence_id);
create unique index if not exists lesson_sentences_lesson_position_idx on lesson_sentences(lesson_id, position);
create unique index if not exists sentence_vocabulary_links_unique_idx on sentence_vocabulary_links(sentence_id, vocabulary_item_id, surface_text);
create index if not exists sentence_vocabulary_links_sentence_idx on sentence_vocabulary_links(sentence_id);
create index if not exists sentence_vocabulary_links_item_idx on sentence_vocabulary_links(vocabulary_item_id);
create unique index if not exists sentence_grammar_links_unique_idx on sentence_grammar_links(sentence_id, grammar_item_id, surface_text);
create index if not exists sentence_grammar_links_sentence_idx on sentence_grammar_links(sentence_id);
create index if not exists sentence_grammar_links_item_idx on sentence_grammar_links(grammar_item_id);
create unique index if not exists sentence_chunk_links_unique_idx on sentence_chunk_links(sentence_id, chunk_item_id, surface_text);
create index if not exists sentence_chunk_links_sentence_idx on sentence_chunk_links(sentence_id);
create index if not exists sentence_chunk_links_item_idx on sentence_chunk_links(chunk_item_id);

