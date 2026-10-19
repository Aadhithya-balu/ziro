import { getDb } from '@/lib/db';
import { AuditEventRecord } from '@/types';

export function logAuditEvent(params: {
  caseId?: string;
  eventType: string;
  previousState?: string;
  newState?: string;
  relevantEvidenceIds?: string[];
  approvalReference?: string;
  actionResult: string;
  errorDetails?: string;
  metadata?: Record<string, unknown>;
}): AuditEventRecord {
  const db = getDb();
  const id = `AUD-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const timestamp = new Date().toISOString();

  // Sanitize metadata to ensure no sensitive credentials or tokens are logged
  const safeMetadata = params.metadata ? { ...params.metadata } : {};
  delete safeMetadata.password;
  delete safeMetadata.token;
  delete safeMetadata.apiKey;
  delete safeMetadata.secret;

  const stmt = db.prepare(`
    INSERT INTO audit_events (
      id, case_id, event_type, timestamp, previous_state, new_state,
      relevant_evidence_ids, approval_reference, action_result, error_details, metadata
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    params.caseId || null,
    params.eventType,
    timestamp,
    params.previousState || null,
    params.newState || null,
    params.relevantEvidenceIds ? JSON.stringify(params.relevantEvidenceIds) : null,
    params.approvalReference || null,
    params.actionResult,
    params.errorDetails || null,
    JSON.stringify(safeMetadata)
  );

  return {
    id,
    caseId: params.caseId,
    eventType: params.eventType,
    timestamp,
    previousState: params.previousState,
    newState: params.newState,
    relevantEvidenceIds: params.relevantEvidenceIds,
    approvalReference: params.approvalReference,
    actionResult: params.actionResult,
    errorDetails: params.errorDetails,
    metadata: safeMetadata,
  };
}

export function getAuditEvents(caseId?: string, limit: number = 100): AuditEventRecord[] {
  const db = getDb();
  let query;
  if (caseId) {
    query = db.prepare(`
      SELECT * FROM audit_events WHERE case_id = ? ORDER BY timestamp DESC LIMIT ?
    `);
    const rows = query.all(caseId, limit) as any[];
    return rows.map(mapRowToAuditEvent);
  } else {
    query = db.prepare(`
      SELECT * FROM audit_events ORDER BY timestamp DESC LIMIT ?
    `);
    const rows = query.all(limit) as any[];
    return rows.map(mapRowToAuditEvent);
  }
}

function mapRowToAuditEvent(row: any): AuditEventRecord {
  return {
    id: row.id,
    caseId: row.case_id || undefined,
    eventType: row.event_type,
    timestamp: row.timestamp,
    previousState: row.previous_state || undefined,
    newState: row.new_state || undefined,
    relevantEvidenceIds: row.relevant_evidence_ids ? JSON.parse(row.relevant_evidence_ids) : undefined,
    approvalReference: row.approval_reference || undefined,
    actionResult: row.action_result,
    errorDetails: row.error_details || undefined,
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
  };
}
