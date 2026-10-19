import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';

const DB_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const DB_PATH = path.join(DB_DIR, 'ziro_credit.db');

// Singleton database instance
let dbInstance: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (!dbInstance) {
    dbInstance = new DatabaseSync(DB_PATH);
    initSchema(dbInstance);
  }
  return dbInstance;
}

function initSchema(db: DatabaseSync) {
  // WAL mode for high performance concurrency
  try {
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec('PRAGMA foreign_keys = ON;');
  } catch (err) {
    console.warn('Pragma setup warning:', err);
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS cases (
      id TEXT PRIMARY KEY,
      client_name TEXT NOT NULL,
      account_reference TEXT NOT NULL,
      issue_type TEXT NOT NULL,
      workflow_status TEXT NOT NULL,
      classification TEXT,
      confidence_score REAL,
      report_record_id TEXT,
      active_draft_id TEXT,
      active_approval_id TEXT,
      active_dispute_id TEXT,
      consent_given_for_id_upload INTEGER DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS credit_reports (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL,
      account_reference TEXT NOT NULL,
      creditor_name TEXT NOT NULL,
      account_type TEXT NOT NULL,
      reported_balance REAL NOT NULL,
      payment_status TEXT NOT NULL,
      payment_history TEXT NOT NULL,
      opened_date TEXT,
      reported_date TEXT NOT NULL,
      delinquency_date TEXT,
      user_confirmed_facts TEXT NOT NULL,
      discrepancy_reason TEXT NOT NULL,
      user_fact_confirmed INTEGER NOT NULL DEFAULT 1,
      source_report_ref TEXT NOT NULL,
      extraction_timestamp TEXT NOT NULL,
      extracted_values TEXT NOT NULL,
      attached_evidence_notes TEXT,
      FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS evidence (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL,
      source_name TEXT NOT NULL,
      mock_source_record_id TEXT NOT NULL,
      retrieval_timestamp TEXT NOT NULL,
      relevant_extracted_values TEXT NOT NULL,
      source_url_or_route TEXT NOT NULL,
      verification_status TEXT NOT NULL,
      label TEXT NOT NULL,
      details TEXT,
      FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS classifications (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL,
      classification TEXT NOT NULL,
      reasoning_summary TEXT NOT NULL,
      supporting_facts TEXT NOT NULL,
      contradicting_facts TEXT NOT NULL,
      evidence_ids TEXT NOT NULL,
      missing_information TEXT NOT NULL,
      recommended_next_step TEXT NOT NULL,
      human_review_required INTEGER NOT NULL DEFAULT 1,
      confidence_score REAL NOT NULL,
      engine_mode TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS dispute_drafts (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      bureau_account_reference TEXT NOT NULL,
      disputed_field TEXT NOT NULL,
      user_confirmed_statement TEXT NOT NULL,
      relevant_supporting_evidence TEXT NOT NULL,
      explanation_of_discrepancy TEXT NOT NULL,
      requested_correction TEXT NOT NULL,
      evidence_references TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS approvals (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL,
      approved_draft_version INTEGER NOT NULL,
      approval_timestamp TEXT NOT NULL,
      user_action TEXT NOT NULL,
      submission_eligibility INTEGER NOT NULL,
      reviewed_by TEXT NOT NULL,
      notes TEXT,
      FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS mock_bureau_disputes (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL,
      approved_draft_version INTEGER NOT NULL,
      approval_id TEXT NOT NULL,
      mock_portal_reference TEXT NOT NULL,
      idempotency_key TEXT UNIQUE NOT NULL,
      submission_timestamp TEXT NOT NULL,
      submission_response TEXT NOT NULL,
      current_status TEXT NOT NULL,
      verification_status TEXT NOT NULL DEFAULT 'PENDING',
      id_request_reason TEXT,
      last_bureau_update_timestamp TEXT NOT NULL,
      FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS status_history (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL,
      dispute_id TEXT,
      status TEXT NOT NULL,
      notes TEXT NOT NULL,
      actor TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS verification_results (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL,
      dispute_id TEXT NOT NULL,
      target_field TEXT NOT NULL,
      original_reported_value TEXT NOT NULL,
      latest_observed_value TEXT NOT NULL,
      intended_correction TEXT NOT NULL,
      outcome TEXT NOT NULL,
      report_re_download_ref TEXT NOT NULL,
      verified_timestamp TEXT NOT NULL,
      comparison_details TEXT NOT NULL,
      explanation TEXT NOT NULL,
      FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS audit_events (
      id TEXT PRIMARY KEY,
      case_id TEXT,
      event_type TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      previous_state TEXT,
      new_state TEXT,
      relevant_evidence_ids TEXT,
      approval_reference TEXT,
      action_result TEXT NOT NULL,
      error_details TEXT,
      metadata TEXT
    );

    CREATE TABLE IF NOT EXISTS mock_bureau_accounts (
      account_reference TEXT PRIMARY KEY,
      consumer_name TEXT NOT NULL,
      consumer_ssn_last4 TEXT NOT NULL,
      creditor_name TEXT NOT NULL,
      account_type TEXT NOT NULL,
      balance REAL NOT NULL,
      payment_status TEXT NOT NULL,
      payment_history TEXT NOT NULL,
      opened_date TEXT,
      reported_date TEXT NOT NULL,
      is_fraudulent_or_unauthorized INTEGER DEFAULT 0,
      bureau_notes TEXT
    );

    CREATE TABLE IF NOT EXISTS mock_bureau_reports (
      report_id TEXT PRIMARY KEY,
      consumer_ssn_last4 TEXT NOT NULL,
      report_data TEXT NOT NULL,
      generated_date TEXT NOT NULL,
      version INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS test_runs (
      id TEXT PRIMARY KEY,
      scenario_id TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL,
      result_payload TEXT NOT NULL,
      run_timestamp TEXT NOT NULL
    );
  `);
}
