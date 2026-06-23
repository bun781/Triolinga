use crate::{db, models::*, normalize};
use anyhow::Result;
use rusqlite::{params, Connection, OptionalExtension, Transaction};
use serde_json::Value;
use std::collections::{HashMap, HashSet};
use tauri::State;

#[derive(Clone)]
struct ExistingItem {
    id: String,
    canonical_key: String,
    item_type: String,
    meaning: Option<String>,
    explanation: Option<String>,
}

#[derive(Clone)]
struct CandidateItem {
    canonical_key: String,
    item_type: String,
    display_text: String,
    meaning: Option<String>,
    explanation: Option<String>,
}

struct ImportPlan {
    source_hash: String,
    duplicate_import: bool,
    lesson: LessonImportInput,
    target_lesson: Option<TargetLesson>,
    existing_items_by_key: HashMap<String, ExistingItem>,
    existing_sentences_by_text: HashMap<String, String>,
    candidate_items: Vec<CandidateItem>,
}

struct TargetLesson {
    id: String,
    language: String,
    base_language: String,
    existing_sentence_ids: HashSet<String>,
    next_position: i64,
}

#[tauri::command]
pub fn get_lessons(state: State<db::AppState>) -> Result<Vec<StudyLessonMeta>, String> {
    let conn = state.conn.lock().map_err(|err| err.to_string())?;
    get_lessons_inner(&conn).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn get_lesson(lesson_id: String, state: State<db::AppState>) -> Result<Option<StudyLesson>, String> {
    let conn = state.conn.lock().map_err(|err| err.to_string())?;
    get_lesson_inner(&conn, &lesson_id).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn export_lesson(lesson_id: String, state: State<db::AppState>) -> Result<LessonImportInput, String> {
    let conn = state.conn.lock().map_err(|err| err.to_string())?;
    export_lesson_inner(&conn, &lesson_id).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn preview_lesson_import(source: String, lesson_id: Option<String>, state: State<db::AppState>) -> Result<LessonImportPreviewResult, String> {
    let conn = state.conn.lock().map_err(|err| err.to_string())?;
    let (lesson, raw_value) = parse_lesson_json(&source).map_err(|errors| errors.join("\n"))?;
    let plan = build_import_plan(&conn, lesson, raw_value, lesson_id.as_deref()).map_err(|err| err.to_string())?;
    Ok(build_preview(&plan))
}

#[tauri::command]
pub fn import_lesson(source: String, lesson_id: Option<String>, state: State<db::AppState>) -> Result<LessonImportSummary, String> {
    let mut conn = state.conn.lock().map_err(|err| err.to_string())?;
    let (lesson, raw_value) = parse_lesson_json(&source).map_err(|errors| errors.join("\n"))?;
    let plan = build_import_plan(&conn, lesson, raw_value, lesson_id.as_deref()).map_err(|err| err.to_string())?;

    if plan.duplicate_import {
        return Ok(empty_summary_with_error("This lesson has already been imported."));
    }

    import_plan(&mut conn, plan).map_err(|err| err.to_string())
}

pub fn get_lessons_inner(conn: &Connection) -> Result<Vec<StudyLessonMeta>> {
    let mut stmt = conn.prepare(
        r#"
        SELECT l.id, l.target_language, l.base_language, l.title, l.description, l.level, l.tags,
               COUNT(ls.sentence_id) AS sentence_count
        FROM lessons l
        LEFT JOIN lesson_sentences ls ON ls.lesson_id = l.id
        GROUP BY l.id
        ORDER BY l.imported_at DESC
        "#,
    )?;

    let rows = stmt.query_map([], |row| {
        Ok(StudyLessonMeta {
            id: row.get(0)?,
            language: row.get(1)?,
            base_language: row.get(2)?,
            title: row.get(3)?,
            description: row.get(4)?,
            level: row.get(5)?,
            tags: db::parse_json_array(row.get(6)?),
            sentence_count: row.get(7)?,
        })
    })?;

    rows.collect::<rusqlite::Result<Vec<_>>>().map_err(Into::into)
}

pub fn get_lesson_inner(conn: &Connection, lesson_id: &str) -> Result<Option<StudyLesson>> {
    let lesson = conn
        .query_row(
            "SELECT id, target_language, base_language, title, description, source, level, tags FROM lessons WHERE id = ?1",
            [lesson_id],
            |row| {
                Ok(StudyLesson {
                    id: row.get(0)?,
                    language: row.get(1)?,
                    base_language: row.get(2)?,
                    title: row.get(3)?,
                    description: row.get(4)?,
                    source: row.get(5)?,
                    level: row.get(6)?,
                    tags: db::parse_json_array(row.get(7)?),
                    sentences: Vec::new(),
                })
            },
        )
        .optional()?;

    let Some(mut lesson) = lesson else {
        return Ok(None);
    };

    let mut stmt = conn.prepare(
        r#"
        SELECT s.id, s.text, s.translation
        FROM lesson_sentences ls
        JOIN sentences s ON s.id = ls.sentence_id
        WHERE ls.lesson_id = ?1
        ORDER BY ls.position
        "#,
    )?;
    let rows = stmt.query_map([lesson_id], |row| {
        Ok(StudySentence {
            id: row.get(0)?,
            text: row.get(1)?,
            translation: row.get(2)?,
            audio_url: None,
            words: Vec::new(),
            grammar: Vec::new(),
            chunks: Vec::new(),
        })
    })?;

    let mut sentences = rows.collect::<rusqlite::Result<Vec<_>>>()?;
    for sentence in &mut sentences {
        sentence.words = load_words(conn, &sentence.id)?;
        sentence.grammar = load_grammar(conn, &sentence.id)?;
        sentence.chunks = load_chunks(conn, &sentence.id)?;
    }
    lesson.sentences = sentences;

    Ok(Some(lesson))
}

fn export_lesson_inner(conn: &Connection, lesson_id: &str) -> Result<LessonImportInput> {
    let lesson = get_lesson_inner(conn, lesson_id)?
        .ok_or_else(|| anyhow::anyhow!("Selected lesson was not found."))?;

    Ok(LessonImportInput {
        language: lesson.language,
        base_language: lesson.base_language,
        title: lesson.title,
        description: lesson.description.and_then(non_empty_string),
        source: lesson.source.and_then(non_empty_string),
        level: lesson.level.and_then(non_empty_string),
        tags: if lesson.tags.is_empty() { None } else { Some(lesson.tags) },
        sentences: lesson
            .sentences
            .into_iter()
            .map(|sentence| LessonSentenceInput {
                text: sentence.text,
                translation: non_empty_string(sentence.translation),
                words: if sentence.words.is_empty() {
                    None
                } else {
                    Some(
                        sentence
                            .words
                            .into_iter()
                            .map(|word| {
                                let surface = word.surface;
                                let display_text = word.display_text;
                                let meaning = word.meaning;
                                let explanation = word.explanation;
                                LessonWordInput {
                                    surface: surface.clone(),
                                    lemma: if display_text == surface {
                                        None
                                    } else {
                                        non_empty_string(display_text)
                                    },
                                    meaning: meaning.and_then(non_empty_string),
                                    role: None,
                                    explanation: explanation.and_then(non_empty_string),
                                }
                            })
                            .collect(),
                    )
                },
                grammar: if sentence.grammar.is_empty() {
                    None
                } else {
                    Some(
                        sentence
                            .grammar
                            .into_iter()
                            .map(|grammar| {
                                let pattern = grammar.pattern;
                                let surface_text = grammar.surface_text;
                                let meaning = grammar.meaning;
                                let explanation = grammar.explanation;
                                LessonGrammarInput {
                                    pattern: pattern.clone(),
                                    surface: if surface_text == pattern {
                                        None
                                    } else {
                                        non_empty_string(surface_text)
                                    },
                                    meaning: meaning.and_then(non_empty_string),
                                    explanation: explanation.and_then(non_empty_string),
                                }
                            })
                            .collect(),
                    )
                },
                chunks: if sentence.chunks.is_empty() {
                    None
                } else {
                    Some(
                        sentence
                            .chunks
                            .into_iter()
                            .map(|chunk| LessonChunkInput {
                                surface: chunk.surface_text,
                                meaning: chunk.meaning.and_then(non_empty_string),
                                explanation: chunk.explanation.and_then(non_empty_string),
                                item_type: None,
                                level: None,
                                tags: None,
                            })
                            .collect(),
                    )
                },
            })
            .collect(),
    })
}

fn non_empty_string(value: String) -> Option<String> {
    if value.trim().is_empty() {
        None
    } else {
        Some(value)
    }
}

fn load_words(conn: &Connection, sentence_id: &str) -> Result<Vec<StudyWord>> {
    let mut stmt = conn.prepare(
        r#"
        SELECT svl.surface_text, li.display_text, li.meaning, li.explanation, li.common_mistakes, li.canonical_key
        FROM sentence_vocabulary_links svl
        JOIN learning_items li ON li.id = svl.vocabulary_item_id
        WHERE svl.sentence_id = ?1
        ORDER BY svl.rowid
        "#,
    )?;
    let rows = stmt.query_map([sentence_id], |row| {
        Ok(StudyWord {
            surface: row.get(0)?,
            display_text: row.get(1)?,
            meaning: row.get(2)?,
            explanation: row.get(3)?,
            common_mistakes: db::parse_json_array(row.get(4)?),
            canonical_key: row.get(5)?,
        })
    })?;
    rows.collect::<rusqlite::Result<Vec<_>>>().map_err(Into::into)
}

fn load_grammar(conn: &Connection, sentence_id: &str) -> Result<Vec<StudyGrammar>> {
    let mut stmt = conn.prepare(
        r#"
        SELECT sgl.surface_text, li.display_text, li.meaning, li.explanation, li.common_mistakes, li.canonical_key
        FROM sentence_grammar_links sgl
        JOIN learning_items li ON li.id = sgl.grammar_item_id
        WHERE sgl.sentence_id = ?1
        ORDER BY sgl.rowid
        "#,
    )?;
    let rows = stmt.query_map([sentence_id], |row| {
        Ok(StudyGrammar {
            surface_text: row.get(0)?,
            pattern: row.get(1)?,
            meaning: row.get(2)?,
            explanation: row.get(3)?,
            common_mistakes: db::parse_json_array(row.get(4)?),
            canonical_key: row.get(5)?,
        })
    })?;
    rows.collect::<rusqlite::Result<Vec<_>>>().map_err(Into::into)
}

fn load_chunks(conn: &Connection, sentence_id: &str) -> Result<Vec<StudyChunk>> {
    let mut stmt = conn.prepare(
        r#"
        SELECT scl.surface_text, li.meaning, li.explanation, li.canonical_key
        FROM sentence_chunk_links scl
        JOIN learning_items li ON li.id = scl.chunk_item_id
        WHERE scl.sentence_id = ?1
        ORDER BY scl.rowid
        "#,
    )?;
    let rows = stmt.query_map([sentence_id], |row| {
        Ok(StudyChunk {
            surface_text: row.get(0)?,
            meaning: row.get(1)?,
            explanation: row.get(2)?,
            canonical_key: row.get(3)?,
        })
    })?;
    rows.collect::<rusqlite::Result<Vec<_>>>().map_err(Into::into)
}

fn parse_lesson_json(source: &str) -> Result<(LessonImportInput, Value), Vec<String>> {
    let raw_value: Value = serde_json::from_str(source).map_err(|_| vec!["Invalid JSON.".to_string()])?;
    let mut lesson: LessonImportInput = serde_json::from_value(raw_value.clone())
        .map_err(|err| vec![format!("Invalid lesson shape: {err}")])?;
    trim_lesson(&mut lesson);

    let mut errors = Vec::new();
    required("language", &lesson.language, &mut errors);
    required("baseLanguage", &lesson.base_language, &mut errors);
    required("title", &lesson.title, &mut errors);
    if lesson.sentences.is_empty() {
        errors.push("At least one sentence is required.".to_string());
    }

    let mut sentence_texts = HashSet::new();
    for (index, sentence) in lesson.sentences.iter().enumerate() {
        required("sentence text", &sentence.text, &mut errors);
        let normalized = normalize::normalize_sentence_text(&sentence.text);
        if !sentence_texts.insert(normalized) {
            errors.push(format!("Duplicate sentence text at sentence {}.", index + 1));
        }

        for word in sentence.words.as_deref().unwrap_or(&[]) {
            required("word surface", &word.surface, &mut errors);
            if !contains_surface(&sentence.text, &word.surface) {
                errors.push(format!("Sentence {}: word surface \"{}\" does not appear in the sentence.", index + 1, word.surface));
            }
        }
        for grammar in sentence.grammar.as_deref().unwrap_or(&[]) {
            required("grammar pattern", &grammar.pattern, &mut errors);
            if let Some(surface) = &grammar.surface {
                if !contains_surface(&sentence.text, surface) {
                    errors.push(format!("Sentence {}: grammar surface \"{}\" does not appear in the sentence.", index + 1, surface));
                }
            }
        }
        for chunk in sentence.chunks.as_deref().unwrap_or(&[]) {
            required("chunk surface", &chunk.surface, &mut errors);
            if !contains_surface(&sentence.text, &chunk.surface) {
                errors.push(format!("Sentence {}: chunk surface \"{}\" does not appear in the sentence.", index + 1, chunk.surface));
            }
        }
    }

    if errors.is_empty() {
        Ok((lesson, raw_value))
    } else {
        Err(errors)
    }
}

fn build_import_plan(conn: &Connection, lesson: LessonImportInput, raw_value: Value, target_lesson_id: Option<&str>) -> Result<ImportPlan> {
    let source_hash = normalize::hash_json_value(&raw_value);
    let target_lesson = if let Some(target_lesson_id) = target_lesson_id {
        Some(load_target_lesson(conn, target_lesson_id, &lesson)?)
    } else {
        None
    };
    let duplicate_import = if target_lesson.is_some() {
        false
    } else {
        conn
            .query_row("SELECT id FROM lessons WHERE source_hash = ?1 LIMIT 1", [&source_hash], |_| Ok(()))
            .optional()?
            .is_some()
    };

    let normalized_texts = lesson
        .sentences
        .iter()
        .map(|sentence| normalize::normalize_sentence_text(&sentence.text))
        .collect::<Vec<_>>();
    let mut existing_sentences_by_text = HashMap::new();
    for normalized in &normalized_texts {
        if let Some(id) = conn
            .query_row(
                "SELECT id FROM sentences WHERE language = ?1 AND normalized_text = ?2",
                params![lesson.language, normalized],
                |row| row.get::<_, String>(0),
            )
            .optional()?
        {
            existing_sentences_by_text.insert(normalized.clone(), id);
        }
    }

    let candidate_items = collect_candidates(&lesson);
    let mut existing_items_by_key = HashMap::new();
    for candidate in &candidate_items {
        if let Some(item) = conn
            .query_row(
                "SELECT id, canonical_key, type, meaning, explanation FROM learning_items WHERE canonical_key = ?1 AND type = ?2",
                params![candidate.canonical_key, candidate.item_type],
                |row| {
                    Ok(ExistingItem {
                        id: row.get(0)?,
                        canonical_key: row.get(1)?,
                        item_type: row.get(2)?,
                        meaning: row.get(3)?,
                        explanation: row.get(4)?,
                    })
                },
            )
            .optional()?
        {
            existing_items_by_key.insert(item_lookup_key(&item.item_type, &item.canonical_key), item);
        }
    }

    Ok(ImportPlan {
        source_hash,
        duplicate_import,
        lesson,
        target_lesson,
        existing_items_by_key,
        existing_sentences_by_text,
        candidate_items,
    })
}

fn load_target_lesson(conn: &Connection, lesson_id: &str, source_lesson: &LessonImportInput) -> Result<TargetLesson> {
    let target = conn
        .query_row(
            "SELECT id, target_language, base_language FROM lessons WHERE id = ?1",
            [lesson_id],
            |row| {
                Ok(TargetLesson {
                    id: row.get(0)?,
                    language: row.get(1)?,
                    base_language: row.get(2)?,
                    existing_sentence_ids: HashSet::new(),
                    next_position: 0,
                })
            },
        )
        .optional()?;

    let Some(mut target) = target else {
        return Err(anyhow::anyhow!("Selected lesson was not found."));
    };

    if target.language != source_lesson.language || target.base_language != source_lesson.base_language {
        return Err(anyhow::anyhow!(
            "The selected lesson uses {} → {}, but the import source uses {} → {}.",
            target.language,
            target.base_language,
            source_lesson.language,
            source_lesson.base_language
        ));
    }

    let mut stmt = conn.prepare("SELECT sentence_id FROM lesson_sentences WHERE lesson_id = ?1")?;
    let rows = stmt.query_map([lesson_id], |row| row.get::<_, String>(0))?;
    let existing_sentence_ids = rows.collect::<rusqlite::Result<HashSet<_>>>()?;

    let next_position = conn
        .query_row(
            "SELECT COALESCE(MAX(position), -1) + 1 FROM lesson_sentences WHERE lesson_id = ?1",
            [lesson_id],
            |row| row.get::<_, i64>(0),
        )?;

    target.existing_sentence_ids = existing_sentence_ids;
    target.next_position = next_position;
    Ok(target)
}

fn build_preview(plan: &ImportPlan) -> LessonImportPreviewResult {
    LessonImportPreviewResult {
        lesson: LessonImportPreviewLesson {
            language: plan.lesson.language.clone(),
            base_language: plan.lesson.base_language.clone(),
            title: plan.lesson.title.clone(),
            description: plan.lesson.description.clone(),
            source: plan.lesson.source.clone(),
            level: plan.lesson.level.clone(),
            tags: plan.lesson.tags.clone().unwrap_or_default(),
        },
        sentence_count: plan.lesson.sentences.len(),
        duplicate_import: plan.duplicate_import,
        validation_errors: Vec::new(),
        sentences: plan
            .lesson
            .sentences
            .iter()
            .enumerate()
            .map(|(index, sentence)| LessonImportPreviewSentence {
                index,
                text: sentence.text.clone(),
                translation: sentence.translation.clone().unwrap_or_default(),
                duplicate_sentence: plan
                    .existing_sentences_by_text
                    .contains_key(&normalize::normalize_sentence_text(&sentence.text)),
                words: sentence.words.as_deref().unwrap_or(&[]).iter().map(word_output).collect(),
                grammar: sentence.grammar.as_deref().unwrap_or(&[]).iter().map(grammar_output).collect(),
                chunks: sentence.chunks.as_deref().unwrap_or(&[]).iter().map(chunk_output).collect(),
            })
            .collect(),
        vocabulary: preview_items(plan, "word"),
        grammar: preview_items(plan, "grammar"),
        chunks: preview_items(plan, "chunk"),
    }
}

fn import_plan(conn: &mut Connection, plan: ImportPlan) -> Result<LessonImportSummary> {
    let tx = conn.transaction()?;
    let now = db::now();
    let lesson_id = if let Some(target_lesson) = &plan.target_lesson {
        target_lesson.id.clone()
    } else {
        let lesson_id = db::id();
        tx.execute(
            r#"
            INSERT INTO lessons
            (id, target_language, base_language, description, source, level, title, source_hash, tags, imported_at, created_at, updated_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?10, ?10)
            "#,
            params![
                lesson_id,
                plan.lesson.language,
                plan.lesson.base_language,
                plan.lesson.description,
                plan.lesson.source,
                plan.lesson.level,
                plan.lesson.title,
                plan.source_hash,
                db::json_array(&plan.lesson.tags.clone().unwrap_or_default()),
                now,
            ],
        )?;
        lesson_id
    };

    let mut item_id_by_key = HashMap::new();
    for item in plan.existing_items_by_key.values() {
        item_id_by_key.insert(item_lookup_key(&item.item_type, &item.canonical_key), item.id.clone());
    }

    let new_items = plan
        .candidate_items
        .iter()
        .filter(|candidate| !plan.existing_items_by_key.contains_key(&item_lookup_key(&candidate.item_type, &candidate.canonical_key)))
        .cloned()
        .collect::<Vec<_>>();
    for item in &new_items {
        let item_id = db::id();
        tx.execute(
            r#"
            INSERT INTO learning_items
            (id, language, type, canonical_key, display_text, meaning, explanation, common_mistakes, created_at, updated_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, '[]', ?8, ?8)
            "#,
            params![
                item_id,
                plan.lesson.language,
                item.item_type,
                item.canonical_key,
                item.display_text,
                item.meaning,
                item.explanation,
                db::now(),
            ],
        )?;
        item_id_by_key.insert(item_lookup_key(&item.item_type, &item.canonical_key), item_id);
    }

    for candidate in &plan.candidate_items {
        if let Some(existing) = plan.existing_items_by_key.get(&item_lookup_key(&candidate.item_type, &candidate.canonical_key)) {
            if existing.meaning.is_none() && candidate.meaning.is_some() {
                tx.execute("UPDATE learning_items SET meaning = ?1, updated_at = ?2 WHERE id = ?3", params![candidate.meaning, db::now(), existing.id])?;
            }
            if existing.explanation.is_none() && candidate.explanation.is_some() {
                tx.execute("UPDATE learning_items SET explanation = ?1, updated_at = ?2 WHERE id = ?3", params![candidate.explanation, db::now(), existing.id])?;
            }
        }
    }

    let summary_counts = summarize_item_occurrences(&plan);
    let mut sentences_imported = 0;
    let mut sentences_skipped = 0;
    let mut links_created = 0;
    let mut next_position = plan.target_lesson.as_ref().map(|target| target.next_position).unwrap_or(0);

    for (index, sentence) in plan.lesson.sentences.iter().enumerate() {
        let normalized = normalize::normalize_sentence_text(&sentence.text);
        let sentence_id = if let Some(existing_id) = plan.existing_sentences_by_text.get(&normalized) {
            sentences_skipped += 1;
            existing_id.clone()
        } else {
            let sentence_id = db::id();
            tx.execute(
                r#"
                INSERT INTO sentences
                (id, lesson_id, language, text, normalized_text, translation, review_state, review_streak, reviewed_at, created_at, updated_at)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'unknown', 0, NULL, ?7, ?7)
                "#,
                params![
                    sentence_id,
                    lesson_id,
                    plan.lesson.language,
                    sentence.text,
                    normalized,
                    sentence.translation.clone().unwrap_or_default(),
                    db::now(),
                ],
            )?;
            sentences_imported += 1;
            sentence_id
        };

        let should_link_sentence = plan
            .target_lesson
            .as_ref()
            .map(|target| !target.existing_sentence_ids.contains(&sentence_id))
            .unwrap_or(true);

        if should_link_sentence {
            let position = if plan.target_lesson.is_some() { next_position } else { index as i64 };
            tx.execute(
                "INSERT INTO lesson_sentences (id, lesson_id, sentence_id, position, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?5)",
                params![db::id(), lesson_id, sentence_id, position, db::now()],
            )?;
            links_created += 1;
            if plan.target_lesson.is_some() {
                next_position += 1;
            }
        }
        links_created += create_sentence_item_links(&tx, &plan.lesson.language, &sentence_id, sentence, &item_id_by_key)?;
    }

    tx.commit()?;

    Ok(LessonImportSummary {
        lesson_created: plan.target_lesson.is_none(),
        lesson_updated: plan.target_lesson.is_some(),
        sentences_imported,
        sentences_skipped,
        vocabulary_created: summary_counts.0,
        vocabulary_reused: summary_counts.1,
        grammar_created: summary_counts.2,
        grammar_reused: summary_counts.3,
        chunks_created: summary_counts.4,
        chunks_reused: summary_counts.5,
        links_created,
        errors: Vec::new(),
    })
}

fn create_sentence_item_links(
    tx: &Transaction<'_>,
    language: &str,
    sentence_id: &str,
    sentence: &LessonSentenceInput,
    item_id_by_key: &HashMap<String, String>,
) -> Result<i64> {
    let mut seen = HashSet::new();
    let mut inserted = 0;

    for word in sentence.words.as_deref().unwrap_or(&[]) {
        let key = normalize::build_canonical_key(language, word.lemma.as_deref().unwrap_or(&word.surface));
        let Some(item_id) = item_id_by_key.get(&item_lookup_key("word", &key)) else { continue };
        let unique = format!("word:{item_id}:{}", word.surface);
        if !seen.insert(unique) {
            continue;
        }
        inserted += insert_link(tx, "sentence_vocabulary_links", "vocabulary_item_id", sentence_id, item_id, &word.surface)?;
    }

    for grammar in sentence.grammar.as_deref().unwrap_or(&[]) {
        let key = normalize::build_canonical_key(language, &grammar.pattern);
        let Some(item_id) = item_id_by_key.get(&item_lookup_key("grammar", &key)) else { continue };
        let surface = grammar.surface.as_deref().unwrap_or(&grammar.pattern);
        let unique = format!("grammar:{item_id}:{surface}");
        if !seen.insert(unique) {
            continue;
        }
        inserted += insert_link(tx, "sentence_grammar_links", "grammar_item_id", sentence_id, item_id, surface)?;
    }

    for chunk in sentence.chunks.as_deref().unwrap_or(&[]) {
        let key = normalize::build_canonical_key(language, &chunk.surface);
        let Some(item_id) = item_id_by_key.get(&item_lookup_key("chunk", &key)) else { continue };
        let unique = format!("chunk:{item_id}:{}", chunk.surface);
        if !seen.insert(unique) {
            continue;
        }
        inserted += insert_link(tx, "sentence_chunk_links", "chunk_item_id", sentence_id, item_id, &chunk.surface)?;
    }

    Ok(inserted)
}

fn insert_link(tx: &Transaction<'_>, table: &str, item_column: &str, sentence_id: &str, item_id: &str, surface: &str) -> Result<i64> {
    let sql = format!(
        "INSERT OR IGNORE INTO {table} (id, sentence_id, {item_column}, surface_text, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?5)"
    );
    let changed = tx.execute(&sql, params![db::id(), sentence_id, item_id, surface, db::now()])?;
    Ok(changed as i64)
}

fn collect_candidates(lesson: &LessonImportInput) -> Vec<CandidateItem> {
    let mut items: HashMap<String, CandidateItem> = HashMap::new();
    for sentence in &lesson.sentences {
        for word in sentence.words.as_deref().unwrap_or(&[]) {
            upsert_candidate(&mut items, CandidateItem {
                canonical_key: normalize::build_canonical_key(&lesson.language, word.lemma.as_deref().unwrap_or(&word.surface)),
                item_type: "word".to_string(),
                display_text: word.lemma.clone().unwrap_or_else(|| word.surface.clone()),
                meaning: word.meaning.clone(),
                explanation: word.explanation.clone(),
            });
        }
        for grammar in sentence.grammar.as_deref().unwrap_or(&[]) {
            upsert_candidate(&mut items, CandidateItem {
                canonical_key: normalize::build_canonical_key(&lesson.language, &grammar.pattern),
                item_type: "grammar".to_string(),
                display_text: grammar.pattern.clone(),
                meaning: grammar.meaning.clone(),
                explanation: grammar.explanation.clone(),
            });
        }
        for chunk in sentence.chunks.as_deref().unwrap_or(&[]) {
            upsert_candidate(&mut items, CandidateItem {
                canonical_key: normalize::build_canonical_key(&lesson.language, &chunk.surface),
                item_type: "chunk".to_string(),
                display_text: chunk.surface.clone(),
                meaning: chunk.meaning.clone(),
                explanation: chunk.explanation.clone(),
            });
        }
    }
    items.into_values().collect()
}

fn upsert_candidate(items: &mut HashMap<String, CandidateItem>, candidate: CandidateItem) {
    let key = item_lookup_key(&candidate.item_type, &candidate.canonical_key);
    if let Some(existing) = items.get_mut(&key) {
        if existing.meaning.is_none() {
            existing.meaning = candidate.meaning;
        }
        if existing.explanation.is_none() {
            existing.explanation = candidate.explanation;
        }
    } else {
        items.insert(key, candidate);
    }
}

fn preview_items(plan: &ImportPlan, item_type: &str) -> Vec<LessonImportPreviewItem> {
    plan.candidate_items
        .iter()
        .filter(|item| item.item_type == item_type)
        .map(|item| {
            let key = item_lookup_key(&item.item_type, &item.canonical_key);
            LessonImportPreviewItem {
                canonical_key: item.canonical_key.clone(),
                item_type: item.item_type.clone(),
                display_text: item.display_text.clone(),
                meaning: item.meaning.clone(),
                explanation: item.explanation.clone(),
                status: if plan.existing_items_by_key.contains_key(&key) { "existing" } else { "new" }.to_string(),
            }
        })
        .collect()
}

fn summarize_item_occurrences(plan: &ImportPlan) -> (i64, i64, i64, i64, i64, i64) {
    let mut seen = HashSet::new();
    let mut counts = (0, 0, 0, 0, 0, 0);
    for sentence in &plan.lesson.sentences {
        for word in sentence.words.as_deref().unwrap_or(&[]) {
            bump_count(&mut counts.0, &mut counts.1, &mut seen, &plan.existing_items_by_key, "word", &normalize::build_canonical_key(&plan.lesson.language, word.lemma.as_deref().unwrap_or(&word.surface)));
        }
        for grammar in sentence.grammar.as_deref().unwrap_or(&[]) {
            bump_count(&mut counts.2, &mut counts.3, &mut seen, &plan.existing_items_by_key, "grammar", &normalize::build_canonical_key(&plan.lesson.language, &grammar.pattern));
        }
        for chunk in sentence.chunks.as_deref().unwrap_or(&[]) {
            bump_count(&mut counts.4, &mut counts.5, &mut seen, &plan.existing_items_by_key, "chunk", &normalize::build_canonical_key(&plan.lesson.language, &chunk.surface));
        }
    }
    counts
}

fn bump_count(
    created: &mut i64,
    reused: &mut i64,
    seen: &mut HashSet<String>,
    existing: &HashMap<String, ExistingItem>,
    item_type: &str,
    canonical_key: &str,
) {
    let key = item_lookup_key(item_type, canonical_key);
    if existing.contains_key(&key) || seen.contains(&key) {
        *reused += 1;
    } else {
        *created += 1;
        seen.insert(key);
    }
}

fn trim_lesson(lesson: &mut LessonImportInput) {
    lesson.language = normalize::normalize_text(&lesson.language);
    lesson.base_language = normalize::normalize_text(&lesson.base_language);
    lesson.title = normalize::normalize_text(&lesson.title);
    trim_option(&mut lesson.description);
    trim_option(&mut lesson.source);
    trim_option(&mut lesson.level);
    if let Some(tags) = &mut lesson.tags {
        for tag in tags {
            *tag = normalize::normalize_text(tag);
        }
    }
    for sentence in &mut lesson.sentences {
        sentence.text = normalize::normalize_text(&sentence.text);
        trim_option(&mut sentence.translation);
        for word in sentence.words.as_deref_mut().unwrap_or(&mut []) {
            word.surface = normalize::normalize_text(&word.surface);
            trim_option(&mut word.lemma);
            trim_option(&mut word.meaning);
            trim_option(&mut word.role);
            trim_option(&mut word.explanation);
        }
        for grammar in sentence.grammar.as_deref_mut().unwrap_or(&mut []) {
            grammar.pattern = normalize::normalize_text(&grammar.pattern);
            trim_option(&mut grammar.surface);
            trim_option(&mut grammar.meaning);
            trim_option(&mut grammar.explanation);
        }
        for chunk in sentence.chunks.as_deref_mut().unwrap_or(&mut []) {
            chunk.surface = normalize::normalize_text(&chunk.surface);
            trim_option(&mut chunk.meaning);
            trim_option(&mut chunk.explanation);
            trim_option(&mut chunk.item_type);
            trim_option(&mut chunk.level);
            if let Some(tags) = &mut chunk.tags {
                for tag in tags {
                    *tag = normalize::normalize_text(tag);
                }
            }
        }
    }
}

fn trim_option(value: &mut Option<String>) {
    if let Some(inner) = value {
        *inner = normalize::normalize_text(inner);
    }
}

fn required(label: &str, value: &str, errors: &mut Vec<String>) {
    if value.is_empty() {
        errors.push(format!("{label} is required."));
    }
}

fn contains_surface(sentence_text: &str, surface: &str) -> bool {
    normalize::normalize_sentence_text(sentence_text).contains(&normalize::normalize_sentence_text(surface))
}

fn item_lookup_key(item_type: &str, canonical_key: &str) -> String {
    format!("{item_type}:{canonical_key}")
}

fn word_output(word: &LessonWordInput) -> LessonWordOutput {
    LessonWordOutput {
        surface: word.surface.clone(),
        lemma: word.lemma.clone(),
        meaning: word.meaning.clone(),
        role: word.role.clone(),
        explanation: word.explanation.clone(),
    }
}

fn grammar_output(grammar: &LessonGrammarInput) -> LessonGrammarOutput {
    LessonGrammarOutput {
        pattern: grammar.pattern.clone(),
        surface: grammar.surface.clone(),
        meaning: grammar.meaning.clone(),
        explanation: grammar.explanation.clone(),
    }
}

fn chunk_output(chunk: &LessonChunkInput) -> LessonChunkOutput {
    LessonChunkOutput {
        surface: chunk.surface.clone(),
        meaning: chunk.meaning.clone(),
        explanation: chunk.explanation.clone(),
        item_type: chunk.item_type.clone(),
        level: chunk.level.clone(),
        tags: chunk.tags.clone(),
    }
}

fn empty_summary_with_error(error: &str) -> LessonImportSummary {
    LessonImportSummary {
        lesson_created: false,
        lesson_updated: false,
        sentences_imported: 0,
        sentences_skipped: 0,
        vocabulary_created: 0,
        vocabulary_reused: 0,
        grammar_created: 0,
        grammar_reused: 0,
        chunks_created: 0,
        chunks_reused: 0,
        links_created: 0,
        errors: vec![error.to_string()],
    }
}
