drop index if exists learning_items_canonical_idx;

create unique index if not exists learning_items_type_canonical_idx
  on learning_items(type, canonical_key);
