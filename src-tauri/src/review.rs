// Tauri commands for the review system: get_review_queue, update_review_item, reset_review_progress.
// SRS interval values here must stay in sync with lib/review/scheduler.ts.
use crate::{db, models::ReviewSentence};
use anyhow::Result;
use chrono::{DateTime, Duration, Utc};
use rusqlite::{params, Connection, OptionalExtension};
use serde::Deserialize;
use tauri::State;

#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ReviewResetScope {
    Lesson { lesson_id: String },
    Sentence { sentence_id: String },
    Item {
        item_type: String,
        canonical_key: String,
        lesson_id: Option<String>,
    },
}

#[tauri::command]
pub fn get_review_queue(state: State<db::AppState>) -> Result<Vec<ReviewSentence>, String> {
    let conn = state.conn.lock().map_err(|err| err.to_string())?;
    get_review_queue_inner(&conn).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn update_review_item(
    sentence_id: String,
    decision: String,
    state: State<db::AppState>,
) -> Result<ReviewSentence, String> {
    let grade = normalize_grade(&decision)
        .ok_or_else(|| "Missing sentenceId or valid review decision.".to_string())?;

    let conn = state.conn.lock().map_err(|err| err.to_string())?;
    ensure_review_items(&conn).map_err(|err| err.to_string())?;
    let current = get_sentence(&conn, &sentence_id)
        .map_err(|err| err.to_string())?
        .ok_or_else(|| "Sentence not found.".to_string())?;

    let reviewed_at = db::now();
    let due_at = next_due_at(&grade, &reviewed_at);
    let repetitions = if grade == "remembered" || grade == "easy" {
        current.repetitions + 1
    } else {
        current.repetitions
    };
    let lapses = if grade == "forgot" { current.lapses + 1 } else { current.lapses };
    let review_state = legacy_review_state(&grade);
    let review_streak = if grade == "remembered" || grade == "easy" {
        current.review_streak + 1
    } else if grade == "forgot" {
        0
    } else {
        current.review_streak
    };
    let difficulty = update_difficulty(current.difficulty, &grade);
    let stability = update_stability(current.stability, &grade);
    let recall_mode = next_recall_mode(&current.recall_mode, &grade);

    conn.execute(
        r#"
        INSERT INTO review_items
        (id, sentence_id, lesson_id, import_id, due_at, last_reviewed_at, repetitions, lapses, difficulty, stability, recall_mode, created_at, updated_at)
        VALUES (?1, ?2, ?3, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?5, ?5)
        ON CONFLICT(sentence_id) DO UPDATE SET
          lesson_id = excluded.lesson_id,
          import_id = excluded.import_id,
          due_at = excluded.due_at,
          last_reviewed_at = excluded.last_reviewed_at,
          repetitions = excluded.repetitions,
          lapses = excluded.lapses,
          difficulty = excluded.difficulty,
          stability = excluded.stability,
          recall_mode = excluded.recall_mode,
          updated_at = excluded.updated_at
        "#,
        params![
            db::id(),
            &sentence_id,
            current.lesson_id,
            due_at,
            reviewed_at,
            repetitions,
            lapses,
            difficulty,
            stability,
            recall_mode,
        ],
    )
    .map_err(|err| err.to_string())?;

    conn.execute(
        "UPDATE sentences SET review_state = ?1, review_streak = ?2, reviewed_at = ?3, updated_at = ?3 WHERE id = ?4",
        params![review_state, review_streak, reviewed_at, &sentence_id],
    )
    .map_err(|err| err.to_string())?;

    get_sentence(&conn, &sentence_id)
        .map_err(|err| err.to_string())?
        .ok_or_else(|| "Sentence not found.".to_string())
}

#[tauri::command]
pub fn reset_review_progress(
    scope: ReviewResetScope,
    state: State<db::AppState>,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|err| err.to_string())?;
    ensure_review_items(&conn).map_err(|err| err.to_string())?;

    match scope {
        ReviewResetScope::Lesson { lesson_id } => reset_lesson_progress(&conn, &lesson_id),
        ReviewResetScope::Sentence { sentence_id } => reset_sentences_progress(&conn, &[sentence_id]),
        ReviewResetScope::Item {
            item_type,
            canonical_key,
            lesson_id,
        } => {
            let sentence_ids = get_item_sentence_ids(&conn, &item_type, &canonical_key, lesson_id.as_deref())
                .map_err(|err| err.to_string())?;
            reset_sentences_progress(&conn, &sentence_ids)
        }
    }
    .map_err(|err| err.to_string())
}

fn get_review_queue_inner(conn: &Connection) -> Result<Vec<ReviewSentence>> {
    ensure_review_items(conn)?;
    let mut stmt = conn.prepare(
        r#"
        SELECT
          s.id,
          s.id,
          s.lesson_id,
          s.lesson_id,
          s.language,
          s.text,
          s.translation,
          s.review_state,
          s.review_streak,
          s.reviewed_at,
          ri.due_at,
          ri.last_reviewed_at,
          ri.repetitions,
          ri.lapses,
          ri.difficulty,
          ri.stability,
          ri.recall_mode,
          s.focus_display_text,
          s.focus_meaning,
          s.focus_explanation
        FROM sentences s
        JOIN review_items ri ON ri.sentence_id = s.id
        ORDER BY ri.due_at ASC, s.text ASC
        "#,
    )?;

    let rows = stmt.query_map([], map_review_sentence)?;
    rows.collect::<rusqlite::Result<Vec<_>>>().map_err(Into::into)
}

fn get_sentence(conn: &Connection, sentence_id: &str) -> Result<Option<ReviewSentence>> {
    ensure_review_items(conn)?;
    conn.query_row(
        r#"
        SELECT
          s.id,
          s.id,
          s.lesson_id,
          s.lesson_id,
          s.language,
          s.text,
          s.translation,
          s.review_state,
          s.review_streak,
          s.reviewed_at,
          ri.due_at,
          ri.last_reviewed_at,
          ri.repetitions,
          ri.lapses,
          ri.difficulty,
          ri.stability,
          ri.recall_mode,
          s.focus_display_text,
          s.focus_meaning,
          s.focus_explanation
        FROM sentences s
        JOIN review_items ri ON ri.sentence_id = s.id
        WHERE s.id = ?1
        "#,
        [sentence_id],
        map_review_sentence,
    )
    .optional()
    .map_err(Into::into)
}

fn reset_lesson_progress(conn: &Connection, lesson_id: &str) -> Result<()> {
    let mut stmt = conn.prepare("SELECT id FROM sentences WHERE lesson_id = ?1")?;
    let rows = stmt.query_map([lesson_id], |row| row.get::<_, String>(0))?;
    let sentence_ids = rows.collect::<rusqlite::Result<Vec<_>>>()?;
    reset_sentences_progress(conn, &sentence_ids)
}

fn reset_sentences_progress(conn: &Connection, sentence_ids: &[String]) -> Result<()> {
    let now = db::now();
    for sentence_id in sentence_ids {
        conn.execute(
            "UPDATE sentences SET review_state = 'unknown', review_streak = 0, reviewed_at = NULL, updated_at = ?1 WHERE id = ?2",
            params![now, sentence_id],
        )?;
        conn.execute(
            r#"
            UPDATE review_items
            SET due_at = ?1,
                last_reviewed_at = NULL,
                repetitions = 0,
                lapses = 0,
                difficulty = 0.3,
                stability = 0,
                recall_mode = 'full_support',
                updated_at = ?1
            WHERE sentence_id = ?2
            "#,
            params![now, sentence_id],
        )?;
    }
    Ok(())
}

fn get_item_sentence_ids(
    conn: &Connection,
    item_type: &str,
    canonical_key: &str,
    lesson_id: Option<&str>,
) -> Result<Vec<String>> {
    let (table, item_column) = match item_type {
        "word" => ("sentence_vocabulary_links", "vocabulary_item_id"),
        "grammar" => ("sentence_grammar_links", "grammar_item_id"),
        "chunk" => ("sentence_chunk_links", "chunk_item_id"),
        _ => return Ok(Vec::new()),
    };
    let lesson_filter = if lesson_id.is_some() { "AND s.lesson_id = ?3" } else { "" };
    let sql = format!(
        r#"
        SELECT DISTINCT s.id
        FROM sentences s
        JOIN {table} link ON link.sentence_id = s.id
        JOIN learning_items li ON li.id = link.{item_column}
        WHERE li.type = ?1 AND li.canonical_key = ?2 {lesson_filter}
        "#
    );
    let mut stmt = conn.prepare(&sql)?;
    if let Some(lesson_id) = lesson_id {
        let rows = stmt.query_map(params![item_type, canonical_key, lesson_id], |row| row.get::<_, String>(0))?;
        rows.collect::<rusqlite::Result<Vec<_>>>().map_err(Into::into)
    } else {
        let rows = stmt.query_map(params![item_type, canonical_key], |row| row.get::<_, String>(0))?;
        rows.collect::<rusqlite::Result<Vec<_>>>().map_err(Into::into)
    }
}

fn ensure_review_items(conn: &Connection) -> Result<()> {
    let now = db::now();
    conn.execute(
        r#"
        INSERT OR IGNORE INTO review_items
        (id, sentence_id, lesson_id, import_id, due_at, last_reviewed_at, repetitions, lapses, difficulty, stability, recall_mode, created_at, updated_at)
        SELECT id, id, lesson_id, lesson_id, ?1, reviewed_at, review_streak,
               CASE WHEN review_state = 'forgotten' THEN 1 ELSE 0 END,
               0.3, review_streak, 'full_support', ?1, ?1
        FROM sentences
        "#,
        [now],
    )?;
    Ok(())
}

fn map_review_sentence(row: &rusqlite::Row<'_>) -> rusqlite::Result<ReviewSentence> {
    Ok(ReviewSentence {
        id: row.get(0)?,
        sentence_id: row.get(1)?,
        lesson_id: row.get(2)?,
        import_id: row.get(3)?,
        language: row.get(4)?,
        text: row.get(5)?,
        translation: row.get(6)?,
        review_state: row.get(7)?,
        review_streak: row.get(8)?,
        reviewed_at: row.get(9)?,
        due_at: row.get(10)?,
        last_reviewed_at: row.get(11)?,
        repetitions: row.get(12)?,
        lapses: row.get(13)?,
        difficulty: row.get(14)?,
        stability: row.get(15)?,
        recall_mode: row.get(16)?,
        focus_text: row.get(17)?,
        focus_meaning: row.get(18)?,
        focus_explanation: row.get(19)?,
    })
}

fn normalize_grade(decision: &str) -> Option<String> {
    match decision {
        "forgot" | "forgotten" => Some("forgot".to_string()),
        "hard" => Some("hard".to_string()),
        "remembered" => Some("remembered".to_string()),
        "easy" => Some("easy".to_string()),
        _ => None,
    }
}

fn next_due_at(grade: &str, reviewed_at: &str) -> String {
    let parsed = DateTime::parse_from_rfc3339(reviewed_at)
        .map(|date| date.with_timezone(&Utc))
        .unwrap_or_else(|_| Utc::now());
    let next = match grade {
        "forgot" => parsed + Duration::minutes(10),
        "hard" => parsed + Duration::days(1),
        "remembered" => parsed + Duration::days(3),
        "easy" => parsed + Duration::days(7),
        _ => parsed + Duration::days(1),
    };
    next.to_rfc3339()
}

fn legacy_review_state(grade: &str) -> String {
    match grade {
        "forgot" => "forgotten",
        "hard" => "unknown",
        _ => "remembered",
    }
    .to_string()
}

fn update_difficulty(current: f64, grade: &str) -> f64 {
    let delta = match grade {
        "forgot" => 0.18,
        "hard" => 0.08,
        "remembered" => -0.04,
        "easy" => -0.08,
        _ => 0.0,
    };
    ((current + delta).clamp(0.0, 1.0) * 100.0).round() / 100.0
}

fn update_stability(current: f64, grade: &str) -> f64 {
    let next = match grade {
        "forgot" => (current * 0.45).max(0.5),
        "hard" => (current + 0.5).max(1.0),
        "remembered" => (current + 2.0).max(3.0),
        "easy" => (current + 4.0).max(7.0),
        _ => current,
    };
    (next * 100.0).round() / 100.0
}

fn next_recall_mode(current: &str, grade: &str) -> String {
    let modes = [
        "full_support",
        "translation_hidden",
        "sentence_only",
        "fill_blank",
        "reverse_translate",
    ];
    let index = modes.iter().position(|mode| *mode == current).unwrap_or(0) as i64;
    let next_index = match grade {
        "forgot" => (index - 1).max(0),
        "hard" => index,
        "easy" => (index + 2).min((modes.len() - 1) as i64),
        _ => (index + 1).min((modes.len() - 1) as i64),
    };
    modes[next_index as usize].to_string()
}
