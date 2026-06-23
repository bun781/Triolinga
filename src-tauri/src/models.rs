use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct LessonWordInput {
    pub surface: String,
    pub lemma: Option<String>,
    pub meaning: Option<String>,
    pub role: Option<String>,
    pub explanation: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct LessonGrammarInput {
    pub pattern: String,
    pub surface: Option<String>,
    pub meaning: Option<String>,
    pub explanation: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct LessonChunkInput {
    pub surface: String,
    pub meaning: Option<String>,
    pub explanation: Option<String>,
    #[serde(rename = "type")]
    pub item_type: Option<String>,
    pub level: Option<String>,
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct LessonSentenceInput {
    pub text: String,
    pub translation: Option<String>,
    pub words: Option<Vec<LessonWordInput>>,
    pub grammar: Option<Vec<LessonGrammarInput>>,
    pub chunks: Option<Vec<LessonChunkInput>>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct LessonImportInput {
    pub language: String,
    pub base_language: String,
    pub title: String,
    pub description: Option<String>,
    pub source: Option<String>,
    pub level: Option<String>,
    pub tags: Option<Vec<String>>,
    pub sentences: Vec<LessonSentenceInput>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StudyLessonMeta {
    pub id: String,
    pub language: String,
    pub base_language: String,
    pub title: String,
    pub description: Option<String>,
    pub level: Option<String>,
    pub tags: Vec<String>,
    pub sentence_count: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StudyWord {
    pub surface: String,
    pub display_text: String,
    pub meaning: Option<String>,
    pub explanation: Option<String>,
    pub common_mistakes: Vec<String>,
    pub canonical_key: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StudyGrammar {
    pub surface_text: String,
    pub pattern: String,
    pub meaning: Option<String>,
    pub explanation: Option<String>,
    pub common_mistakes: Vec<String>,
    pub canonical_key: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StudyChunk {
    pub surface_text: String,
    pub meaning: Option<String>,
    pub explanation: Option<String>,
    pub canonical_key: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StudySentence {
    pub id: String,
    pub text: String,
    pub translation: String,
    pub audio_url: Option<String>,
    pub words: Vec<StudyWord>,
    pub grammar: Vec<StudyGrammar>,
    pub chunks: Vec<StudyChunk>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StudyLesson {
    pub id: String,
    pub language: String,
    pub base_language: String,
    pub title: String,
    pub description: Option<String>,
    pub source: Option<String>,
    pub level: Option<String>,
    pub tags: Vec<String>,
    pub sentences: Vec<StudySentence>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReviewSentence {
    pub id: String,
    pub language: String,
    pub text: String,
    pub translation: String,
    pub review_state: String,
    pub review_streak: i64,
    pub reviewed_at: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LessonImportPreviewLesson {
    pub language: String,
    pub base_language: String,
    pub title: String,
    pub description: Option<String>,
    pub source: Option<String>,
    pub level: Option<String>,
    pub tags: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LessonImportPreviewSentence {
    pub index: usize,
    pub text: String,
    pub translation: String,
    pub duplicate_sentence: bool,
    pub words: Vec<LessonWordOutput>,
    pub grammar: Vec<LessonGrammarOutput>,
    pub chunks: Vec<LessonChunkOutput>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LessonWordOutput {
    pub surface: String,
    pub lemma: Option<String>,
    pub meaning: Option<String>,
    pub role: Option<String>,
    pub explanation: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LessonGrammarOutput {
    pub pattern: String,
    pub surface: Option<String>,
    pub meaning: Option<String>,
    pub explanation: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LessonChunkOutput {
    pub surface: String,
    pub meaning: Option<String>,
    pub explanation: Option<String>,
    #[serde(rename = "type")]
    pub item_type: Option<String>,
    pub level: Option<String>,
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LessonImportPreviewItem {
    pub canonical_key: String,
    #[serde(rename = "type")]
    pub item_type: String,
    pub display_text: String,
    pub meaning: Option<String>,
    pub explanation: Option<String>,
    pub status: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LessonImportPreviewResult {
    pub lesson: LessonImportPreviewLesson,
    pub sentence_count: usize,
    pub duplicate_import: bool,
    pub validation_errors: Vec<String>,
    pub sentences: Vec<LessonImportPreviewSentence>,
    pub vocabulary: Vec<LessonImportPreviewItem>,
    pub grammar: Vec<LessonImportPreviewItem>,
    pub chunks: Vec<LessonImportPreviewItem>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LessonImportSummary {
    pub lesson_created: bool,
    pub lesson_updated: bool,
    pub sentences_imported: i64,
    pub sentences_skipped: i64,
    pub vocabulary_created: i64,
    pub vocabulary_reused: i64,
    pub grammar_created: i64,
    pub grammar_reused: i64,
    pub chunks_created: i64,
    pub chunks_reused: i64,
    pub links_created: i64,
    pub errors: Vec<String>,
}
