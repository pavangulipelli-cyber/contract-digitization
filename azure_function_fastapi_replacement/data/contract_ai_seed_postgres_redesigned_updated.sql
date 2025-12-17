-- contract_ai_seed_postgres_redesigned_updated.sql
-- Seeds demo data for versioned documents + extracted fields.
-- Includes many versions for doc-001 (v1..v13) to test horizontal version scrolling.

BEGIN;

INSERT INTO documents (id, title, uploadedAt, status, attributeCount, overallConfidence, reviewedBy, source, storageRef, currentVersionId, currentVersionNumber)
VALUES
  ('doc-001', 'Service Agreement – Acme Corp.pdf', '2024-01-15T18:00:00Z', 'Pending Review', 10, 78.0, NULL, 'salesforce', 'contracts/2024/acme-service-agreement_v13.pdf', 'doc-001-v13', 13),
  ('doc-002', 'NDA – TechStart Inc.pdf', '2024-01-14T18:00:00Z', 'Pending Review', 8, 89.75, NULL, 'conga', 'contracts/2024/techstart-nda_v3.pdf', 'doc-002-v3', 3),
  ('doc-003', 'Master Services Agreement – GlobalTech.pdf', '2024-01-12T18:00:00Z', 'Pending Review', 6, 87.67, NULL, 'sftp', 'contracts/2024/globaltech-msa_v3.pdf', 'doc-003-v3', 3),
  ('doc-004', 'Software License – DataFlow Systems.pdf', '2024-01-10T18:00:00Z', 'Pending Review', 5, 85.2, NULL, 'upload', 'contracts/2024/dataflow-license_v3.pdf', 'doc-004-v3', 3),
  ('doc-005', 'Consulting Agreement – Innovation Labs.pdf', '2024-01-11T18:00:00Z', 'Pending Review', 6, 84.83, NULL, 'conga', 'contracts/2024/innovation-consulting_v3.pdf', 'doc-005-v3', 3)
ON CONFLICT (id) DO UPDATE SET
  title=EXCLUDED.title,
  uploadedAt=EXCLUDED.uploadedAt,
  status=EXCLUDED.status,
  attributeCount=EXCLUDED.attributeCount,
  overallConfidence=EXCLUDED.overallConfidence,
  reviewedBy=EXCLUDED.reviewedBy,
  source=EXCLUDED.source,
  storageRef=EXCLUDED.storageRef,
  currentVersionId=EXCLUDED.currentVersionId,
  currentVersionNumber=EXCLUDED.currentVersionNumber;

INSERT INTO document_versions (id, documentId, versionNumber, isLatest, createdAt, createdBy, status, storageRef, notes)
VALUES
  ('doc-001-v1', 'doc-001', 1, FALSE, '2024-01-15T18:00:00Z', 'system', 'Original', 'contracts/2024/acme-service-agreement.pdf', ''),
  ('doc-001-v2', 'doc-001', 2, FALSE, '2024-01-17T18:00:00Z', 'system', 'Reviewed', 'contracts/2024/acme-service-agreement_v2.pdf', 'Minor updates after initial review'),
  ('doc-001-v3', 'doc-001', 3, FALSE, '2024-01-19T18:00:00Z', 'system', 'Approved', 'contracts/2024/acme-service-agreement_v3.pdf', 'Post-approval changes'),
  ('doc-001-v4', 'doc-001', 4, FALSE, '2024-01-21T18:00:00Z', 'system', 'Approved', 'contracts/2024/acme-service-agreement_v4.pdf', ''),
  ('doc-001-v5', 'doc-001', 5, FALSE, '2024-01-23T18:00:00Z', 'system', 'Approved', 'contracts/2024/acme-service-agreement_v5.pdf', ''),
  ('doc-001-v6', 'doc-001', 6, FALSE, '2024-01-25T18:00:00Z', 'system', 'Approved', 'contracts/2024/acme-service-agreement_v6.pdf', ''),
  ('doc-001-v7', 'doc-001', 7, FALSE, '2024-01-27T18:00:00Z', 'system', 'Approved', 'contracts/2024/acme-service-agreement_v7.pdf', ''),
  ('doc-001-v8', 'doc-001', 8, FALSE, '2024-01-29T18:00:00Z', 'system', 'Approved', 'contracts/2024/acme-service-agreement_v8.pdf', ''),
  ('doc-001-v9', 'doc-001', 9, FALSE, '2024-01-31T18:00:00Z', 'system', 'Approved', 'contracts/2024/acme-service-agreement_v9.pdf', ''),
  ('doc-001-v10', 'doc-001', 10, FALSE, '2024-02-02T18:00:00Z', 'system', 'Approved', 'contracts/2024/acme-service-agreement_v10.pdf', ''),
  ('doc-001-v11', 'doc-001', 11, FALSE, '2024-02-04T18:00:00Z', 'system', 'Approved', 'contracts/2024/acme-service-agreement_v11.pdf', ''),
  ('doc-001-v12', 'doc-001', 12, FALSE, '2024-02-06T18:00:00Z', 'system', 'Approved', 'contracts/2024/acme-service-agreement_v12.pdf', ''),
  ('doc-001-v13', 'doc-001', 13, TRUE, '2024-02-08T18:00:00Z', 'system', 'Pending Review', 'contracts/2024/acme-service-agreement_v13.pdf', 'New version available'),
  ('doc-002-v1', 'doc-002', 1, FALSE, '2024-01-14T18:00:00Z', 'system', 'Original', 'contracts/2024/techstart-nda.pdf', ''),
  ('doc-002-v2', 'doc-002', 2, FALSE, '2024-01-16T18:00:00Z', 'system', 'Reviewed', 'contracts/2024/techstart-nda_v2.pdf', 'Minor updates after initial review'),
  ('doc-002-v3', 'doc-002', 3, TRUE, '2024-01-18T18:00:00Z', 'system', 'Pending Review', 'contracts/2024/techstart-nda_v3.pdf', 'Post-approval changes'),
  ('doc-003-v1', 'doc-003', 1, FALSE, '2024-01-12T18:00:00Z', 'system', 'Original', 'contracts/2024/globaltech-msa.pdf', ''),
  ('doc-003-v2', 'doc-003', 2, FALSE, '2024-01-14T18:00:00Z', 'system', 'Reviewed', 'contracts/2024/globaltech-msa_v2.pdf', 'Minor updates after initial review'),
  ('doc-003-v3', 'doc-003', 3, TRUE, '2024-01-16T18:00:00Z', 'system', 'Pending Review', 'contracts/2024/globaltech-msa_v3.pdf', 'Post-approval changes'),
  ('doc-004-v1', 'doc-004', 1, FALSE, '2024-01-10T18:00:00Z', 'system', 'Original', 'contracts/2024/dataflow-license.pdf', ''),
  ('doc-004-v2', 'doc-004', 2, FALSE, '2024-01-12T18:00:00Z', 'system', 'Reviewed', 'contracts/2024/dataflow-license_v2.pdf', 'Minor updates after initial review'),
  ('doc-004-v3', 'doc-004', 3, TRUE, '2024-01-14T18:00:00Z', 'system', 'Pending Review', 'contracts/2024/dataflow-license_v3.pdf', 'Post-approval changes'),
  ('doc-005-v1', 'doc-005', 1, FALSE, '2024-01-11T18:00:00Z', 'system', 'Original', 'contracts/2024/innovation-consulting.pdf', ''),
  ('doc-005-v2', 'doc-005', 2, FALSE, '2024-01-13T18:00:00Z', 'system', 'Reviewed', 'contracts/2024/innovation-consulting_v2.pdf', 'Minor updates after initial review'),
  ('doc-005-v3', 'doc-005', 3, TRUE, '2024-01-15T18:00:00Z', 'system', 'Pending Review', 'contracts/2024/innovation-consulting_v3.pdf', 'Post-approval changes')
ON CONFLICT (id) DO UPDATE SET
  documentId=EXCLUDED.documentId,
  versionNumber=EXCLUDED.versionNumber,
  isLatest=EXCLUDED.isLatest,
  createdAt=EXCLUDED.createdAt,
  createdBy=EXCLUDED.createdBy,
  status=EXCLUDED.status,
  storageRef=EXCLUDED.storageRef,
  notes=EXCLUDED.notes;

INSERT INTO extracted_fields (
  document_id,
  version_id,
  attribute_key,
  field_name,
  category,
  section,
  page_number,
  confidence_score,
  confidence_level,
  confidence,
  field_value,
  corrected_value,
  bounding_box,
  highlighted_text
) VALUES
  ('doc-001', 'doc-001-v1', 'attr-001', 'Contract Start Date', 'Dates', 'Terms and Conditions', 1, 95, 'high', 95.0, 'January 1, 2024', '', '{"page":1,"x":0.1,"y":0.22,"w":0.8,"h":0.02}'::jsonb, 'This Agreement shall commence on January 1, 2024 (the "Effective Date") and shall continue for a period of twelve (12) months unless earlier terminated in accordance with the provisions herein.'),
  ('doc-001', 'doc-001-v1', 'attr-002', 'Contract End Date', 'Dates', 'Terms and Conditions', 1, 92, 'high', 92.0, 'December 31, 2024', '', '{"page":1,"x":0.1,"y":0.275,"w":0.8,"h":0.02}'::jsonb, 'The initial term of this Agreement shall expire on December 31, 2024, subject to renewal provisions outlined in Section 5.2.'),
  ('doc-001', 'doc-001-v1', 'attr-003', 'Total Contract Value', 'Financial', 'Payment Terms', 1, 76, 'medium', 76.0, '$150,000', '', '{"page":1,"x":0.1,"y":0.33,"w":0.8,"h":0.02}'::jsonb, 'The total value of services under this Agreement shall not exceed One Hundred Sixty Thousand Dollars ($160,000) unless mutually agreed in writing by both parties.'),
  ('doc-001', 'doc-001-v1', 'attr-004', 'Payment Terms', 'Financial', 'Payment Terms', 1, 88, 'high', 88.0, 'Net 30', '', '{"page":1,"x":0.1,"y":0.385,"w":0.8,"h":0.02}'::jsonb, 'Payment shall be due within forty-five (45) days of invoice receipt. Late payments shall accrue interest at a rate of 1.5% per month.'),
  ('doc-001', 'doc-001-v1', 'attr-005', 'Governing Law', 'Legal', 'General Provisions', 1, 98, 'high', 98.0, 'State of Delaware', '', '{"page":1,"x":0.1,"y":0.44,"w":0.8,"h":0.02}'::jsonb, 'This Agreement shall be governed by and construed in accordance with the laws of the State of Delaware, without regard to its conflict of laws principles.'),
  ('doc-001', 'doc-001-v1', 'attr-006', 'Termination Notice Period', 'Terms', 'Termination', 1, 40, 'low', 40.0, '30 days', '', '{"page":1,"x":0.1,"y":0.495,"w":0.8,"h":0.02}'::jsonb, 'Either party may terminate this Agreement upon providing written notice to the other party at least thirty (30) days prior to the effective date of termination.'),
  ('doc-001', 'doc-001-v1', 'attr-007', 'Liability Cap', 'Legal', 'Limitation of Liability', 1, 72, 'medium', 72.0, '$500,000', '', '{"page":1,"x":0.1,"y":0.55,"w":0.8,"h":0.02}'::jsonb, 'Aggregate liability under this Agreement shall not exceed Five Hundred Thousand Dollars ($500,000), except in cases of gross negligence or willful misconduct.'),
  ('doc-001', 'doc-001-v1', 'attr-008', 'Auto-Renewal', 'Terms', 'Terms and Conditions', 1, 35, 'low', 35.0, 'Yes', '', '{"page":1,"x":0.1,"y":0.605,"w":0.8,"h":0.02}'::jsonb, 'This Agreement shall automatically renew for successive one (1) year periods unless either party provides notice of non-renewal in accordance with Section 5.2.'),
  ('doc-001', 'doc-001-v1', 'attr-009', 'Client Name', 'Parties', 'Parties', 1, 99, 'high', 99.0, 'Acme Corporation', '', '{"page":1,"x":0.1,"y":0.66,"w":0.8,"h":0.02}'::jsonb, 'This Service Agreement is entered into by and between Acme Corporation ("Client") and Vendor.'),
  ('doc-001', 'doc-001-v1', 'attr-010', 'Confidentiality Period', 'Legal', 'Confidentiality', 1, 85, 'high', 85.0, '3 years', '', '{"page":1,"x":0.1,"y":0.715,"w":0.8,"h":0.02}'::jsonb, 'The Receiving Party shall maintain confidentiality of all disclosed information for a period of three (3) years from the date of disclosure.'),
  ('doc-001', 'doc-001-v2', 'attr-001', 'Contract Start Date', 'Dates', 'Terms and Conditions', 1, 95, 'high', 95.0, 'January 1, 2024', '', '{"page":1,"x":0.1,"y":0.22,"w":0.8,"h":0.02}'::jsonb, 'This Agreement shall commence on January 1, 2024 (the "Effective Date") and shall continue for a period of twelve (12) months unless earlier terminated in accordance with the provisions herein.'),
  ('doc-001', 'doc-001-v2', 'attr-002', 'Contract End Date', 'Dates', 'Terms and Conditions', 1, 92, 'high', 92.0, 'December 31, 2024', '', '{"page":1,"x":0.1,"y":0.275,"w":0.8,"h":0.02}'::jsonb, 'The initial term of this Agreement shall expire on December 31, 2024, subject to renewal provisions outlined in Section 5.2.'),
  ('doc-001', 'doc-001-v2', 'attr-003', 'Total Contract Value', 'Financial', 'Payment Terms', 1, 76, 'medium', 76.0, '$150,000', '', '{"page":1,"x":0.1,"y":0.33,"w":0.8,"h":0.02}'::jsonb, 'The total value of services under this Agreement shall not exceed One Hundred Sixty Thousand Dollars ($160,000) unless mutually agreed in writing by both parties.'),
  ('doc-001', 'doc-001-v2', 'attr-004', 'Payment Terms', 'Financial', 'Payment Terms', 1, 88, 'high', 88.0, 'Net 45', '', '{"page":1,"x":0.1,"y":0.385,"w":0.8,"h":0.02}'::jsonb, 'Payment shall be due within forty-five (45) days of invoice receipt. Late payments shall accrue interest at a rate of 1.5% per month.'),
  ('doc-001', 'doc-001-v2', 'attr-005', 'Governing Law', 'Legal', 'General Provisions', 1, 98, 'high', 98.0, 'State of Delaware', '', '{"page":1,"x":0.1,"y":0.44,"w":0.8,"h":0.02}'::jsonb, 'This Agreement shall be governed by and construed in accordance with the laws of the State of Delaware, without regard to its conflict of laws principles.'),
  ('doc-001', 'doc-001-v2', 'attr-006', 'Termination Notice Period', 'Terms', 'Termination', 1, 40, 'low', 40.0, '30 days', '', '{"page":1,"x":0.1,"y":0.495,"w":0.8,"h":0.02}'::jsonb, 'Either party may terminate this Agreement upon providing written notice to the other party at least thirty (30) days prior to the effective date of termination.'),
  ('doc-001', 'doc-001-v2', 'attr-007', 'Liability Cap', 'Legal', 'Limitation of Liability', 1, 72, 'medium', 72.0, '$500,000', '', '{"page":1,"x":0.1,"y":0.55,"w":0.8,"h":0.02}'::jsonb, 'Aggregate liability under this Agreement shall not exceed Five Hundred Thousand Dollars ($500,000), except in cases of gross negligence or willful misconduct.'),
  ('doc-001', 'doc-001-v2', 'attr-008', 'Auto-Renewal', 'Terms', 'Terms and Conditions', 1, 35, 'low', 35.0, 'Yes', '', '{"page":1,"x":0.1,"y":0.605,"w":0.8,"h":0.02}'::jsonb, 'This Agreement shall automatically renew for successive one (1) year periods unless either party provides notice of non-renewal in accordance with Section 5.2.'),
  ('doc-001', 'doc-001-v2', 'attr-009', 'Client Name', 'Parties', 'Parties', 1, 99, 'high', 99.0, 'Acme Corporation', '', '{"page":1,"x":0.1,"y":0.66,"w":0.8,"h":0.02}'::jsonb, 'This Service Agreement is entered into by and between Acme Corporation ("Client") and Vendor.'),
  ('doc-001', 'doc-001-v2', 'attr-010', 'Confidentiality Period', 'Legal', 'Confidentiality', 1, 85, 'high', 85.0, '3 years', '', '{"page":1,"x":0.1,"y":0.715,"w":0.8,"h":0.02}'::jsonb, 'The Receiving Party shall maintain confidentiality of all disclosed information for a period of three (3) years from the date of disclosure.'),
  ('doc-001', 'doc-001-v3', 'attr-001', 'Contract Start Date', 'Dates', 'Terms and Conditions', 1, 95, 'high', 95.0, 'January 1, 2024', '', '{"page":1,"x":0.1,"y":0.22,"w":0.8,"h":0.02}'::jsonb, 'This Agreement shall commence on January 1, 2024 (the "Effective Date") and shall continue for a period of twelve (12) months unless earlier terminated in accordance with the provisions herein.'),
  ('doc-001', 'doc-001-v3', 'attr-002', 'Contract End Date', 'Dates', 'Terms and Conditions', 1, 92, 'high', 92.0, 'December 31, 2024', '', '{"page":1,"x":0.1,"y":0.275,"w":0.8,"h":0.02}'::jsonb, 'The initial term of this Agreement shall expire on December 31, 2024, subject to renewal provisions outlined in Section 5.2.'),
  ('doc-001', 'doc-001-v3', 'attr-003', 'Total Contract Value', 'Financial', 'Payment Terms', 1, 76, 'medium', 76.0, '$160,000', '', '{"page":1,"x":0.1,"y":0.33,"w":0.8,"h":0.02}'::jsonb, 'The total value of services under this Agreement shall not exceed One Hundred Sixty Thousand Dollars ($160,000) unless mutually agreed in writing by both parties.'),
  ('doc-001', 'doc-001-v3', 'attr-004', 'Payment Terms', 'Financial', 'Payment Terms', 1, 88, 'high', 88.0, 'Net 45', '', '{"page":1,"x":0.1,"y":0.385,"w":0.8,"h":0.02}'::jsonb, 'Payment shall be due within forty-five (45) days of invoice receipt. Late payments shall accrue interest at a rate of 1.5% per month.'),
  ('doc-001', 'doc-001-v3', 'attr-005', 'Governing Law', 'Legal', 'General Provisions', 1, 98, 'high', 98.0, 'State of Delaware', '', '{"page":1,"x":0.1,"y":0.44,"w":0.8,"h":0.02}'::jsonb, 'This Agreement shall be governed by and construed in accordance with the laws of the State of Delaware, without regard to its conflict of laws principles.'),
  ('doc-001', 'doc-001-v3', 'attr-006', 'Termination Notice Period', 'Terms', 'Termination', 1, 40, 'low', 40.0, '30 days', '', '{"page":1,"x":0.1,"y":0.495,"w":0.8,"h":0.02}'::jsonb, 'Either party may terminate this Agreement upon providing written notice to the other party at least thirty (30) days prior to the effective date of termination.'),
  ('doc-001', 'doc-001-v3', 'attr-007', 'Liability Cap', 'Legal', 'Limitation of Liability', 1, 72, 'medium', 72.0, '$500,000', '', '{"page":1,"x":0.1,"y":0.55,"w":0.8,"h":0.02}'::jsonb, 'Aggregate liability under this Agreement shall not exceed Five Hundred Thousand Dollars ($500,000), except in cases of gross negligence or willful misconduct.'),
  ('doc-001', 'doc-001-v3', 'attr-008', 'Auto-Renewal', 'Terms', 'Terms and Conditions', 1, 35, 'low', 35.0, 'Yes', '', '{"page":1,"x":0.1,"y":0.605,"w":0.8,"h":0.02}'::jsonb, 'This Agreement shall automatically renew for successive one (1) year periods unless either party provides notice of non-renewal in accordance with Section 5.2.'),
  ('doc-001', 'doc-001-v3', 'attr-009', 'Client Name', 'Parties', 'Parties', 1, 99, 'high', 99.0, 'Acme Corporation', '', '{"page":1,"x":0.1,"y":0.66,"w":0.8,"h":0.02}'::jsonb, 'This Service Agreement is entered into by and between Acme Corporation ("Client") and Vendor.'),
  ('doc-001', 'doc-001-v3', 'attr-010', 'Confidentiality Period', 'Legal', 'Confidentiality', 1, 85, 'high', 85.0, '3 years', '', '{"page":1,"x":0.1,"y":0.715,"w":0.8,"h":0.02}'::jsonb, 'The Receiving Party shall maintain confidentiality of all disclosed information for a period of three (3) years from the date of disclosure.'),
  ('doc-001', 'doc-001-v4', 'attr-001', 'Contract Start Date', 'Dates', 'Terms and Conditions', 1, 95, 'high', 95.0, 'January 1, 2024', '', '{"page":1,"x":0.1,"y":0.22,"w":0.8,"h":0.02}'::jsonb, 'This Agreement shall commence on January 1, 2024 (the "Effective Date") and shall continue for a period of twelve (12) months unless earlier terminated in accordance with the provisions herein.'),
  ('doc-001', 'doc-001-v4', 'attr-002', 'Contract End Date', 'Dates', 'Terms and Conditions', 1, 92, 'high', 92.0, 'December 31, 2024', '', '{"page":1,"x":0.1,"y":0.275,"w":0.8,"h":0.02}'::jsonb, 'The initial term of this Agreement shall expire on December 31, 2024, subject to renewal provisions outlined in Section 5.2.'),
  ('doc-001', 'doc-001-v4', 'attr-003', 'Total Contract Value', 'Financial', 'Payment Terms', 1, 76, 'medium', 76.0, '$160,000', '', '{"page":1,"x":0.1,"y":0.33,"w":0.8,"h":0.02}'::jsonb, 'The total value of services under this Agreement shall not exceed One Hundred Sixty Thousand Dollars ($160,000) unless mutually agreed in writing by both parties.'),
  ('doc-001', 'doc-001-v4', 'attr-004', 'Payment Terms', 'Financial', 'Payment Terms', 1, 88, 'high', 88.0, 'Net 45', '', '{"page":1,"x":0.1,"y":0.385,"w":0.8,"h":0.02}'::jsonb, 'Payment shall be due within forty-five (45) days of invoice receipt. Late payments shall accrue interest at a rate of 1.5% per month.'),
  ('doc-001', 'doc-001-v4', 'attr-005', 'Governing Law', 'Legal', 'General Provisions', 1, 98, 'high', 98.0, 'State of Delaware', '', '{"page":1,"x":0.1,"y":0.44,"w":0.8,"h":0.02}'::jsonb, 'This Agreement shall be governed by and construed in accordance with the laws of the State of Delaware, without regard to its conflict of laws principles.'),
  ('doc-001', 'doc-001-v4', 'attr-006', 'Termination Notice Period', 'Terms', 'Termination', 1, 40, 'low', 40.0, '30 days', '', '{"page":1,"x":0.1,"y":0.495,"w":0.8,"h":0.02}'::jsonb, 'Either party may terminate this Agreement upon providing written notice to the other party at least thirty (30) days prior to the effective date of termination.'),
  ('doc-001', 'doc-001-v4', 'attr-007', 'Liability Cap', 'Legal', 'Limitation of Liability', 1, 72, 'medium', 72.0, '$500,000', '', '{"page":1,"x":0.1,"y":0.55,"w":0.8,"h":0.02}'::jsonb, 'Aggregate liability under this Agreement shall not exceed Five Hundred Thousand Dollars ($500,000), except in cases of gross negligence or willful misconduct.'),
  ('doc-001', 'doc-001-v4', 'attr-008', 'Auto-Renewal', 'Terms', 'Terms and Conditions', 1, 35, 'low', 35.0, 'Yes', '', '{"page":1,"x":0.1,"y":0.605,"w":0.8,"h":0.02}'::jsonb, 'This Agreement shall automatically renew for successive one (1) year periods unless either party provides notice of non-renewal in accordance with Section 5.2.'),
  ('doc-001', 'doc-001-v4', 'attr-009', 'Client Name', 'Parties', 'Parties', 1, 99, 'high', 99.0, 'Acme Corporation', '', '{"page":1,"x":0.1,"y":0.66,"w":0.8,"h":0.02}'::jsonb, 'This Service Agreement is entered into by and between Acme Corporation ("Client") and Vendor.'),
  ('doc-001', 'doc-001-v4', 'attr-010', 'Confidentiality Period', 'Legal', 'Confidentiality', 1, 85, 'high', 85.0, '3 years', '', '{"page":1,"x":0.1,"y":0.715,"w":0.8,"h":0.02}'::jsonb, 'The Receiving Party shall maintain confidentiality of all disclosed information for a period of three (3) years from the date of disclosure.'),
  ('doc-001', 'doc-001-v5', 'attr-001', 'Contract Start Date', 'Dates', 'Terms and Conditions', 1, 95, 'high', 95.0, 'January 1, 2024', '', '{"page":1,"x":0.1,"y":0.22,"w":0.8,"h":0.02}'::jsonb, 'This Agreement shall commence on January 1, 2024 (the "Effective Date") and shall continue for a period of twelve (12) months unless earlier terminated in accordance with the provisions herein.'),
  ('doc-001', 'doc-001-v5', 'attr-002', 'Contract End Date', 'Dates', 'Terms and Conditions', 1, 92, 'high', 92.0, 'December 31, 2024', '', '{"page":1,"x":0.1,"y":0.275,"w":0.8,"h":0.02}'::jsonb, 'The initial term of this Agreement shall expire on December 31, 2024, subject to renewal provisions outlined in Section 5.2.'),
  ('doc-001', 'doc-001-v5', 'attr-003', 'Total Contract Value', 'Financial', 'Payment Terms', 1, 76, 'medium', 76.0, '$160,000', '', '{"page":1,"x":0.1,"y":0.33,"w":0.8,"h":0.02}'::jsonb, 'The total value of services under this Agreement shall not exceed One Hundred Sixty Thousand Dollars ($160,000) unless mutually agreed in writing by both parties.'),
  ('doc-001', 'doc-001-v5', 'attr-004', 'Payment Terms', 'Financial', 'Payment Terms', 1, 88, 'high', 88.0, 'Net 45', '', '{"page":1,"x":0.1,"y":0.385,"w":0.8,"h":0.02}'::jsonb, 'Payment shall be due within forty-five (45) days of invoice receipt. Late payments shall accrue interest at a rate of 1.5% per month.'),
  ('doc-001', 'doc-001-v5', 'attr-005', 'Governing Law', 'Legal', 'General Provisions', 1, 98, 'high', 98.0, 'State of Delaware', '', '{"page":1,"x":0.1,"y":0.44,"w":0.8,"h":0.02}'::jsonb, 'This Agreement shall be governed by and construed in accordance with the laws of the State of Delaware, without regard to its conflict of laws principles.'),
  ('doc-001', 'doc-001-v5', 'attr-006', 'Termination Notice Period', 'Terms', 'Termination', 1, 40, 'low', 40.0, '30 days', '', '{"page":1,"x":0.1,"y":0.495,"w":0.8,"h":0.02}'::jsonb, 'Either party may terminate this Agreement upon providing written notice to the other party at least thirty (30) days prior to the effective date of termination.'),
  ('doc-001', 'doc-001-v5', 'attr-007', 'Liability Cap', 'Legal', 'Limitation of Liability', 1, 72, 'medium', 72.0, '$500,000', '', '{"page":1,"x":0.1,"y":0.55,"w":0.8,"h":0.02}'::jsonb, 'Aggregate liability under this Agreement shall not exceed Five Hundred Thousand Dollars ($500,000), except in cases of gross negligence or willful misconduct.'),
  ('doc-001', 'doc-001-v5', 'attr-008', 'Auto-Renewal', 'Terms', 'Terms and Conditions', 1, 35, 'low', 35.0, 'Yes', '', '{"page":1,"x":0.1,"y":0.605,"w":0.8,"h":0.02}'::jsonb, 'This Agreement shall automatically renew for successive one (1) year periods unless either party provides notice of non-renewal in accordance with Section 5.2.'),
  ('doc-001', 'doc-001-v5', 'attr-009', 'Client Name', 'Parties', 'Parties', 1, 99, 'high', 99.0, 'Acme Corporation', '', '{"page":1,"x":0.1,"y":0.66,"w":0.8,"h":0.02}'::jsonb, 'This Service Agreement is entered into by and between Acme Corporation ("Client") and Vendor.'),
  ('doc-001', 'doc-001-v5', 'attr-010', 'Confidentiality Period', 'Legal', 'Confidentiality', 1, 85, 'high', 85.0, '3 years', '', '{"page":1,"x":0.1,"y":0.715,"w":0.8,"h":0.02}'::jsonb, 'The Receiving Party shall maintain confidentiality of all disclosed information for a period of three (3) years from the date of disclosure.'),
  ('doc-001', 'doc-001-v6', 'attr-001', 'Contract Start Date', 'Dates', 'Terms and Conditions', 1, 95, 'high', 95.0, 'January 1, 2024', '', '{"page":1,"x":0.1,"y":0.22,"w":0.8,"h":0.02}'::jsonb, 'This Agreement shall commence on January 1, 2024 (the "Effective Date") and shall continue for a period of twelve (12) months unless earlier terminated in accordance with the provisions herein.'),
  ('doc-001', 'doc-001-v6', 'attr-002', 'Contract End Date', 'Dates', 'Terms and Conditions', 1, 92, 'high', 92.0, 'December 31, 2024', '', '{"page":1,"x":0.1,"y":0.275,"w":0.8,"h":0.02}'::jsonb, 'The initial term of this Agreement shall expire on December 31, 2024, subject to renewal provisions outlined in Section 5.2.'),
  ('doc-001', 'doc-001-v6', 'attr-003', 'Total Contract Value', 'Financial', 'Payment Terms', 1, 76, 'medium', 76.0, '$160,000', '', '{"page":1,"x":0.1,"y":0.33,"w":0.8,"h":0.02}'::jsonb, 'The total value of services under this Agreement shall not exceed One Hundred Sixty Thousand Dollars ($160,000) unless mutually agreed in writing by both parties.'),
  ('doc-001', 'doc-001-v6', 'attr-004', 'Payment Terms', 'Financial', 'Payment Terms', 1, 88, 'high', 88.0, 'Net 45', '', '{"page":1,"x":0.1,"y":0.385,"w":0.8,"h":0.02}'::jsonb, 'Payment shall be due within forty-five (45) days of invoice receipt. Late payments shall accrue interest at a rate of 1.5% per month.'),
  ('doc-001', 'doc-001-v6', 'attr-005', 'Governing Law', 'Legal', 'General Provisions', 1, 98, 'high', 98.0, 'State of Delaware', '', '{"page":1,"x":0.1,"y":0.44,"w":0.8,"h":0.02}'::jsonb, 'This Agreement shall be governed by and construed in accordance with the laws of the State of Delaware, without regard to its conflict of laws principles.'),
  ('doc-001', 'doc-001-v6', 'attr-006', 'Termination Notice Period', 'Terms', 'Termination', 1, 40, 'low', 40.0, '30 days', '', '{"page":1,"x":0.1,"y":0.495,"w":0.8,"h":0.02}'::jsonb, 'Either party may terminate this Agreement upon providing written notice to the other party at least thirty (30) days prior to the effective date of termination.'),
  ('doc-001', 'doc-001-v6', 'attr-007', 'Liability Cap', 'Legal', 'Limitation of Liability', 1, 72, 'medium', 72.0, '$500,000', '', '{"page":1,"x":0.1,"y":0.55,"w":0.8,"h":0.02}'::jsonb, 'Aggregate liability under this Agreement shall not exceed Five Hundred Thousand Dollars ($500,000), except in cases of gross negligence or willful misconduct.'),
  ('doc-001', 'doc-001-v6', 'attr-008', 'Auto-Renewal', 'Terms', 'Terms and Conditions', 1, 35, 'low', 35.0, 'Yes', '', '{"page":1,"x":0.1,"y":0.605,"w":0.8,"h":0.02}'::jsonb, 'This Agreement shall automatically renew for successive one (1) year periods unless either party provides notice of non-renewal in accordance with Section 5.2.'),
  ('doc-001', 'doc-001-v6', 'attr-009', 'Client Name', 'Parties', 'Parties', 1, 99, 'high', 99.0, 'Acme Corporation', '', '{"page":1,"x":0.1,"y":0.66,"w":0.8,"h":0.02}'::jsonb, 'This Service Agreement is entered into by and between Acme Corporation ("Client") and Vendor.'),
  ('doc-001', 'doc-001-v6', 'attr-010', 'Confidentiality Period', 'Legal', 'Confidentiality', 1, 85, 'high', 85.0, '3 years', '', '{"page":1,"x":0.1,"y":0.715,"w":0.8,"h":0.02}'::jsonb, 'The Receiving Party shall maintain confidentiality of all disclosed information for a period of three (3) years from the date of disclosure.'),
  ('doc-001', 'doc-001-v7', 'attr-001', 'Contract Start Date', 'Dates', 'Terms and Conditions', 1, 95, 'high', 95.0, 'January 1, 2024', '', '{"page":1,"x":0.1,"y":0.22,"w":0.8,"h":0.02}'::jsonb, 'This Agreement shall commence on January 1, 2024 (the "Effective Date") and shall continue for a period of twelve (12) months unless earlier terminated in accordance with the provisions herein.'),
  ('doc-001', 'doc-001-v7', 'attr-002', 'Contract End Date', 'Dates', 'Terms and Conditions', 1, 92, 'high', 92.0, 'December 31, 2024', '', '{"page":1,"x":0.1,"y":0.275,"w":0.8,"h":0.02}'::jsonb, 'The initial term of this Agreement shall expire on December 31, 2024, subject to renewal provisions outlined in Section 5.2.'),
  ('doc-001', 'doc-001-v7', 'attr-003', 'Total Contract Value', 'Financial', 'Payment Terms', 1, 76, 'medium', 76.0, '$160,000', '', '{"page":1,"x":0.1,"y":0.33,"w":0.8,"h":0.02}'::jsonb, 'The total value of services under this Agreement shall not exceed One Hundred Sixty Thousand Dollars ($160,000) unless mutually agreed in writing by both parties.'),
  ('doc-001', 'doc-001-v7', 'attr-004', 'Payment Terms', 'Financial', 'Payment Terms', 1, 88, 'high', 88.0, 'Net 45', '', '{"page":1,"x":0.1,"y":0.385,"w":0.8,"h":0.02}'::jsonb, 'Payment shall be due within forty-five (45) days of invoice receipt. Late payments shall accrue interest at a rate of 1.5% per month.'),
  ('doc-001', 'doc-001-v7', 'attr-005', 'Governing Law', 'Legal', 'General Provisions', 1, 98, 'high', 98.0, 'State of Delaware', '', '{"page":1,"x":0.1,"y":0.44,"w":0.8,"h":0.02}'::jsonb, 'This Agreement shall be governed by and construed in accordance with the laws of the State of Delaware, without regard to its conflict of laws principles.'),
  ('doc-001', 'doc-001-v7', 'attr-006', 'Termination Notice Period', 'Terms', 'Termination', 1, 40, 'low', 40.0, '30 days', '', '{"page":1,"x":0.1,"y":0.495,"w":0.8,"h":0.02}'::jsonb, 'Either party may terminate this Agreement upon providing written notice to the other party at least thirty (30) days prior to the effective date of termination.'),
  ('doc-001', 'doc-001-v7', 'attr-007', 'Liability Cap', 'Legal', 'Limitation of Liability', 1, 72, 'medium', 72.0, '$500,000', '', '{"page":1,"x":0.1,"y":0.55,"w":0.8,"h":0.02}'::jsonb, 'Aggregate liability under this Agreement shall not exceed Five Hundred Thousand Dollars ($500,000), except in cases of gross negligence or willful misconduct.'),
  ('doc-001', 'doc-001-v7', 'attr-008', 'Auto-Renewal', 'Terms', 'Terms and Conditions', 1, 35, 'low', 35.0, 'Yes', '', '{"page":1,"x":0.1,"y":0.605,"w":0.8,"h":0.02}'::jsonb, 'This Agreement shall automatically renew for successive one (1) year periods unless either party provides notice of non-renewal in accordance with Section 5.2.'),
  ('doc-001', 'doc-001-v7', 'attr-009', 'Client Name', 'Parties', 'Parties', 1, 99, 'high', 99.0, 'Acme Corporation', '', '{"page":1,"x":0.1,"y":0.66,"w":0.8,"h":0.02}'::jsonb, 'This Service Agreement is entered into by and between Acme Corporation ("Client") and Vendor.'),
  ('doc-001', 'doc-001-v7', 'attr-010', 'Confidentiality Period', 'Legal', 'Confidentiality', 1, 85, 'high', 85.0, '3 years', '', '{"page":1,"x":0.1,"y":0.715,"w":0.8,"h":0.02}'::jsonb, 'The Receiving Party shall maintain confidentiality of all disclosed information for a period of three (3) years from the date of disclosure.'),
  ('doc-001', 'doc-001-v8', 'attr-001', 'Contract Start Date', 'Dates', 'Terms and Conditions', 1, 95, 'high', 95.0, 'January 1, 2024', '', '{"page":1,"x":0.1,"y":0.22,"w":0.8,"h":0.02}'::jsonb, 'This Agreement shall commence on January 1, 2024 (the "Effective Date") and shall continue for a period of twelve (12) months unless earlier terminated in accordance with the provisions herein.'),
  ('doc-001', 'doc-001-v8', 'attr-002', 'Contract End Date', 'Dates', 'Terms and Conditions', 1, 92, 'high', 92.0, 'December 31, 2024', '', '{"page":1,"x":0.1,"y":0.275,"w":0.8,"h":0.02}'::jsonb, 'The initial term of this Agreement shall expire on December 31, 2024, subject to renewal provisions outlined in Section 5.2.'),
  ('doc-001', 'doc-001-v8', 'attr-003', 'Total Contract Value', 'Financial', 'Payment Terms', 1, 76, 'medium', 76.0, '$160,000', '', '{"page":1,"x":0.1,"y":0.33,"w":0.8,"h":0.02}'::jsonb, 'The total value of services under this Agreement shall not exceed One Hundred Sixty Thousand Dollars ($160,000) unless mutually agreed in writing by both parties.'),
  ('doc-001', 'doc-001-v8', 'attr-004', 'Payment Terms', 'Financial', 'Payment Terms', 1, 88, 'high', 88.0, 'Net 45', '', '{"page":1,"x":0.1,"y":0.385,"w":0.8,"h":0.02}'::jsonb, 'Payment shall be due within forty-five (45) days of invoice receipt. Late payments shall accrue interest at a rate of 1.5% per month.'),
  ('doc-001', 'doc-001-v8', 'attr-005', 'Governing Law', 'Legal', 'General Provisions', 1, 98, 'high', 98.0, 'State of Delaware', '', '{"page":1,"x":0.1,"y":0.44,"w":0.8,"h":0.02}'::jsonb, 'This Agreement shall be governed by and construed in accordance with the laws of the State of Delaware, without regard to its conflict of laws principles.'),
  ('doc-001', 'doc-001-v8', 'attr-006', 'Termination Notice Period', 'Terms', 'Termination', 1, 40, 'low', 40.0, '30 days', '', '{"page":1,"x":0.1,"y":0.495,"w":0.8,"h":0.02}'::jsonb, 'Either party may terminate this Agreement upon providing written notice to the other party at least thirty (30) days prior to the effective date of termination.'),
  ('doc-001', 'doc-001-v8', 'attr-007', 'Liability Cap', 'Legal', 'Limitation of Liability', 1, 72, 'medium', 72.0, '$500,000', '', '{"page":1,"x":0.1,"y":0.55,"w":0.8,"h":0.02}'::jsonb, 'Aggregate liability under this Agreement shall not exceed Five Hundred Thousand Dollars ($500,000), except in cases of gross negligence or willful misconduct.'),
  ('doc-001', 'doc-001-v8', 'attr-008', 'Auto-Renewal', 'Terms', 'Terms and Conditions', 1, 35, 'low', 35.0, 'Yes', '', '{"page":1,"x":0.1,"y":0.605,"w":0.8,"h":0.02}'::jsonb, 'This Agreement shall automatically renew for successive one (1) year periods unless either party provides notice of non-renewal in accordance with Section 5.2.'),
  ('doc-001', 'doc-001-v8', 'attr-009', 'Client Name', 'Parties', 'Parties', 1, 99, 'high', 99.0, 'Acme Corporation', '', '{"page":1,"x":0.1,"y":0.66,"w":0.8,"h":0.02}'::jsonb, 'This Service Agreement is entered into by and between Acme Corporation ("Client") and Vendor.'),
  ('doc-001', 'doc-001-v8', 'attr-010', 'Confidentiality Period', 'Legal', 'Confidentiality', 1, 85, 'high', 85.0, '3 years', '', '{"page":1,"x":0.1,"y":0.715,"w":0.8,"h":0.02}'::jsonb, 'The Receiving Party shall maintain confidentiality of all disclosed information for a period of three (3) years from the date of disclosure.'),
  ('doc-001', 'doc-001-v9', 'attr-001', 'Contract Start Date', 'Dates', 'Terms and Conditions', 1, 95, 'high', 95.0, 'January 1, 2024', '', '{"page":1,"x":0.1,"y":0.22,"w":0.8,"h":0.02}'::jsonb, 'This Agreement shall commence on January 1, 2024 (the "Effective Date") and shall continue for a period of twelve (12) months unless earlier terminated in accordance with the provisions herein.'),
  ('doc-001', 'doc-001-v9', 'attr-002', 'Contract End Date', 'Dates', 'Terms and Conditions', 1, 92, 'high', 92.0, 'December 31, 2024', '', '{"page":1,"x":0.1,"y":0.275,"w":0.8,"h":0.02}'::jsonb, 'The initial term of this Agreement shall expire on December 31, 2024, subject to renewal provisions outlined in Section 5.2.'),
  ('doc-001', 'doc-001-v9', 'attr-003', 'Total Contract Value', 'Financial', 'Payment Terms', 1, 76, 'medium', 76.0, '$160,000', '', '{"page":1,"x":0.1,"y":0.33,"w":0.8,"h":0.02}'::jsonb, 'The total value of services under this Agreement shall not exceed One Hundred Sixty Thousand Dollars ($160,000) unless mutually agreed in writing by both parties.'),
  ('doc-001', 'doc-001-v9', 'attr-004', 'Payment Terms', 'Financial', 'Payment Terms', 1, 88, 'high', 88.0, 'Net 45', '', '{"page":1,"x":0.1,"y":0.385,"w":0.8,"h":0.02}'::jsonb, 'Payment shall be due within forty-five (45) days of invoice receipt. Late payments shall accrue interest at a rate of 1.5% per month.'),
  ('doc-001', 'doc-001-v9', 'attr-005', 'Governing Law', 'Legal', 'General Provisions', 1, 98, 'high', 98.0, 'State of Delaware', '', '{"page":1,"x":0.1,"y":0.44,"w":0.8,"h":0.02}'::jsonb, 'This Agreement shall be governed by and construed in accordance with the laws of the State of Delaware, without regard to its conflict of laws principles.'),
  ('doc-001', 'doc-001-v9', 'attr-006', 'Termination Notice Period', 'Terms', 'Termination', 1, 40, 'low', 40.0, '30 days', '', '{"page":1,"x":0.1,"y":0.495,"w":0.8,"h":0.02}'::jsonb, 'Either party may terminate this Agreement upon providing written notice to the other party at least thirty (30) days prior to the effective date of termination.'),
  ('doc-001', 'doc-001-v9', 'attr-007', 'Liability Cap', 'Legal', 'Limitation of Liability', 1, 72, 'medium', 72.0, '$500,000', '', '{"page":1,"x":0.1,"y":0.55,"w":0.8,"h":0.02}'::jsonb, 'Aggregate liability under this Agreement shall not exceed Five Hundred Thousand Dollars ($500,000), except in cases of gross negligence or willful misconduct.'),
  ('doc-001', 'doc-001-v9', 'attr-008', 'Auto-Renewal', 'Terms', 'Terms and Conditions', 1, 35, 'low', 35.0, 'Yes', '', '{"page":1,"x":0.1,"y":0.605,"w":0.8,"h":0.02}'::jsonb, 'This Agreement shall automatically renew for successive one (1) year periods unless either party provides notice of non-renewal in accordance with Section 5.2.'),
  ('doc-001', 'doc-001-v9', 'attr-009', 'Client Name', 'Parties', 'Parties', 1, 99, 'high', 99.0, 'Acme Corporation', '', '{"page":1,"x":0.1,"y":0.66,"w":0.8,"h":0.02}'::jsonb, 'This Service Agreement is entered into by and between Acme Corporation ("Client") and Vendor.'),
  ('doc-001', 'doc-001-v9', 'attr-010', 'Confidentiality Period', 'Legal', 'Confidentiality', 1, 85, 'high', 85.0, '3 years', '', '{"page":1,"x":0.1,"y":0.715,"w":0.8,"h":0.02}'::jsonb, 'The Receiving Party shall maintain confidentiality of all disclosed information for a period of three (3) years from the date of disclosure.'),
  ('doc-001', 'doc-001-v10', 'attr-001', 'Contract Start Date', 'Dates', 'Terms and Conditions', 1, 95, 'high', 95.0, 'January 1, 2024', '', '{"page":1,"x":0.1,"y":0.22,"w":0.8,"h":0.02}'::jsonb, 'This Agreement shall commence on January 1, 2024 (the "Effective Date") and shall continue for a period of twelve (12) months unless earlier terminated in accordance with the provisions herein.'),
  ('doc-001', 'doc-001-v10', 'attr-002', 'Contract End Date', 'Dates', 'Terms and Conditions', 1, 92, 'high', 92.0, 'December 31, 2024', '', '{"page":1,"x":0.1,"y":0.275,"w":0.8,"h":0.02}'::jsonb, 'The initial term of this Agreement shall expire on December 31, 2024, subject to renewal provisions outlined in Section 5.2.'),
  ('doc-001', 'doc-001-v10', 'attr-003', 'Total Contract Value', 'Financial', 'Payment Terms', 1, 76, 'medium', 76.0, '$160,000', '', '{"page":1,"x":0.1,"y":0.33,"w":0.8,"h":0.02}'::jsonb, 'The total value of services under this Agreement shall not exceed One Hundred Sixty Thousand Dollars ($160,000) unless mutually agreed in writing by both parties.'),
  ('doc-001', 'doc-001-v10', 'attr-004', 'Payment Terms', 'Financial', 'Payment Terms', 1, 88, 'high', 88.0, 'Net 45', '', '{"page":1,"x":0.1,"y":0.385,"w":0.8,"h":0.02}'::jsonb, 'Payment shall be due within forty-five (45) days of invoice receipt. Late payments shall accrue interest at a rate of 1.5% per month.'),
  ('doc-001', 'doc-001-v10', 'attr-005', 'Governing Law', 'Legal', 'General Provisions', 1, 98, 'high', 98.0, 'State of Delaware', '', '{"page":1,"x":0.1,"y":0.44,"w":0.8,"h":0.02}'::jsonb, 'This Agreement shall be governed by and construed in accordance with the laws of the State of Delaware, without regard to its conflict of laws principles.'),
  ('doc-001', 'doc-001-v10', 'attr-006', 'Termination Notice Period', 'Terms', 'Termination', 1, 40, 'low', 40.0, '30 days', '', '{"page":1,"x":0.1,"y":0.495,"w":0.8,"h":0.02}'::jsonb, 'Either party may terminate this Agreement upon providing written notice to the other party at least thirty (30) days prior to the effective date of termination.'),
  ('doc-001', 'doc-001-v10', 'attr-007', 'Liability Cap', 'Legal', 'Limitation of Liability', 1, 72, 'medium', 72.0, '$500,000', '', '{"page":1,"x":0.1,"y":0.55,"w":0.8,"h":0.02}'::jsonb, 'Aggregate liability under this Agreement shall not exceed Five Hundred Thousand Dollars ($500,000), except in cases of gross negligence or willful misconduct.'),
  ('doc-001', 'doc-001-v10', 'attr-008', 'Auto-Renewal', 'Terms', 'Terms and Conditions', 1, 35, 'low', 35.0, 'Yes', '', '{"page":1,"x":0.1,"y":0.605,"w":0.8,"h":0.02}'::jsonb, 'This Agreement shall automatically renew for successive one (1) year periods unless either party provides notice of non-renewal in accordance with Section 5.2.'),
  ('doc-001', 'doc-001-v10', 'attr-009', 'Client Name', 'Parties', 'Parties', 1, 99, 'high', 99.0, 'Acme Corporation', '', '{"page":1,"x":0.1,"y":0.66,"w":0.8,"h":0.02}'::jsonb, 'This Service Agreement is entered into by and between Acme Corporation ("Client") and Vendor.'),
  ('doc-001', 'doc-001-v10', 'attr-010', 'Confidentiality Period', 'Legal', 'Confidentiality', 1, 85, 'high', 85.0, '3 years', '', '{"page":1,"x":0.1,"y":0.715,"w":0.8,"h":0.02}'::jsonb, 'The Receiving Party shall maintain confidentiality of all disclosed information for a period of three (3) years from the date of disclosure.'),
  ('doc-001', 'doc-001-v11', 'attr-001', 'Contract Start Date', 'Dates', 'Terms and Conditions', 1, 95, 'high', 95.0, 'January 1, 2024', '', '{"page":1,"x":0.1,"y":0.22,"w":0.8,"h":0.02}'::jsonb, 'This Agreement shall commence on January 1, 2024 (the "Effective Date") and shall continue for a period of twelve (12) months unless earlier terminated in accordance with the provisions herein.'),
  ('doc-001', 'doc-001-v11', 'attr-002', 'Contract End Date', 'Dates', 'Terms and Conditions', 1, 92, 'high', 92.0, 'December 31, 2024', '', '{"page":1,"x":0.1,"y":0.275,"w":0.8,"h":0.02}'::jsonb, 'The initial term of this Agreement shall expire on December 31, 2024, subject to renewal provisions outlined in Section 5.2.'),
  ('doc-001', 'doc-001-v11', 'attr-003', 'Total Contract Value', 'Financial', 'Payment Terms', 1, 76, 'medium', 76.0, '$160,000', '', '{"page":1,"x":0.1,"y":0.33,"w":0.8,"h":0.02}'::jsonb, 'The total value of services under this Agreement shall not exceed One Hundred Sixty Thousand Dollars ($160,000) unless mutually agreed in writing by both parties.'),
  ('doc-001', 'doc-001-v11', 'attr-004', 'Payment Terms', 'Financial', 'Payment Terms', 1, 88, 'high', 88.0, 'Net 45', '', '{"page":1,"x":0.1,"y":0.385,"w":0.8,"h":0.02}'::jsonb, 'Payment shall be due within forty-five (45) days of invoice receipt. Late payments shall accrue interest at a rate of 1.5% per month.'),
  ('doc-001', 'doc-001-v11', 'attr-005', 'Governing Law', 'Legal', 'General Provisions', 1, 98, 'high', 98.0, 'State of Delaware', '', '{"page":1,"x":0.1,"y":0.44,"w":0.8,"h":0.02}'::jsonb, 'This Agreement shall be governed by and construed in accordance with the laws of the State of Delaware, without regard to its conflict of laws principles.'),
  ('doc-001', 'doc-001-v11', 'attr-006', 'Termination Notice Period', 'Terms', 'Termination', 1, 40, 'low', 40.0, '30 days', '', '{"page":1,"x":0.1,"y":0.495,"w":0.8,"h":0.02}'::jsonb, 'Either party may terminate this Agreement upon providing written notice to the other party at least thirty (30) days prior to the effective date of termination.'),
  ('doc-001', 'doc-001-v11', 'attr-007', 'Liability Cap', 'Legal', 'Limitation of Liability', 1, 72, 'medium', 72.0, '$500,000', '', '{"page":1,"x":0.1,"y":0.55,"w":0.8,"h":0.02}'::jsonb, 'Aggregate liability under this Agreement shall not exceed Five Hundred Thousand Dollars ($500,000), except in cases of gross negligence or willful misconduct.'),
  ('doc-001', 'doc-001-v11', 'attr-008', 'Auto-Renewal', 'Terms', 'Terms and Conditions', 1, 35, 'low', 35.0, 'Yes', '', '{"page":1,"x":0.1,"y":0.605,"w":0.8,"h":0.02}'::jsonb, 'This Agreement shall automatically renew for successive one (1) year periods unless either party provides notice of non-renewal in accordance with Section 5.2.'),
  ('doc-001', 'doc-001-v11', 'attr-009', 'Client Name', 'Parties', 'Parties', 1, 99, 'high', 99.0, 'Acme Corporation', '', '{"page":1,"x":0.1,"y":0.66,"w":0.8,"h":0.02}'::jsonb, 'This Service Agreement is entered into by and between Acme Corporation ("Client") and Vendor.'),
  ('doc-001', 'doc-001-v11', 'attr-010', 'Confidentiality Period', 'Legal', 'Confidentiality', 1, 85, 'high', 85.0, '3 years', '', '{"page":1,"x":0.1,"y":0.715,"w":0.8,"h":0.02}'::jsonb, 'The Receiving Party shall maintain confidentiality of all disclosed information for a period of three (3) years from the date of disclosure.'),
  ('doc-001', 'doc-001-v12', 'attr-001', 'Contract Start Date', 'Dates', 'Terms and Conditions', 1, 95, 'high', 95.0, 'January 1, 2024', '', '{"page":1,"x":0.1,"y":0.22,"w":0.8,"h":0.02}'::jsonb, 'This Agreement shall commence on January 1, 2024 (the "Effective Date") and shall continue for a period of twelve (12) months unless earlier terminated in accordance with the provisions herein.'),
  ('doc-001', 'doc-001-v12', 'attr-002', 'Contract End Date', 'Dates', 'Terms and Conditions', 1, 92, 'high', 92.0, 'December 31, 2024', '', '{"page":1,"x":0.1,"y":0.275,"w":0.8,"h":0.02}'::jsonb, 'The initial term of this Agreement shall expire on December 31, 2024, subject to renewal provisions outlined in Section 5.2.'),
  ('doc-001', 'doc-001-v12', 'attr-003', 'Total Contract Value', 'Financial', 'Payment Terms', 1, 76, 'medium', 76.0, '$160,000', '', '{"page":1,"x":0.1,"y":0.33,"w":0.8,"h":0.02}'::jsonb, 'The total value of services under this Agreement shall not exceed One Hundred Sixty Thousand Dollars ($160,000) unless mutually agreed in writing by both parties.'),
  ('doc-001', 'doc-001-v12', 'attr-004', 'Payment Terms', 'Financial', 'Payment Terms', 1, 88, 'high', 88.0, 'Net 45', '', '{"page":1,"x":0.1,"y":0.385,"w":0.8,"h":0.02}'::jsonb, 'Payment shall be due within forty-five (45) days of invoice receipt. Late payments shall accrue interest at a rate of 1.5% per month.'),
  ('doc-001', 'doc-001-v12', 'attr-005', 'Governing Law', 'Legal', 'General Provisions', 1, 98, 'high', 98.0, 'State of Delaware', '', '{"page":1,"x":0.1,"y":0.44,"w":0.8,"h":0.02}'::jsonb, 'This Agreement shall be governed by and construed in accordance with the laws of the State of Delaware, without regard to its conflict of laws principles.'),
  ('doc-001', 'doc-001-v12', 'attr-006', 'Termination Notice Period', 'Terms', 'Termination', 1, 40, 'low', 40.0, '30 days', '', '{"page":1,"x":0.1,"y":0.495,"w":0.8,"h":0.02}'::jsonb, 'Either party may terminate this Agreement upon providing written notice to the other party at least thirty (30) days prior to the effective date of termination.'),
  ('doc-001', 'doc-001-v12', 'attr-007', 'Liability Cap', 'Legal', 'Limitation of Liability', 1, 72, 'medium', 72.0, '$500,000', '', '{"page":1,"x":0.1,"y":0.55,"w":0.8,"h":0.02}'::jsonb, 'Aggregate liability under this Agreement shall not exceed Five Hundred Thousand Dollars ($500,000), except in cases of gross negligence or willful misconduct.'),
  ('doc-001', 'doc-001-v12', 'attr-008', 'Auto-Renewal', 'Terms', 'Terms and Conditions', 1, 35, 'low', 35.0, 'Yes', '', '{"page":1,"x":0.1,"y":0.605,"w":0.8,"h":0.02}'::jsonb, 'This Agreement shall automatically renew for successive one (1) year periods unless either party provides notice of non-renewal in accordance with Section 5.2.'),
  ('doc-001', 'doc-001-v12', 'attr-009', 'Client Name', 'Parties', 'Parties', 1, 99, 'high', 99.0, 'Acme Corporation', '', '{"page":1,"x":0.1,"y":0.66,"w":0.8,"h":0.02}'::jsonb, 'This Service Agreement is entered into by and between Acme Corporation ("Client") and Vendor.'),
  ('doc-001', 'doc-001-v12', 'attr-010', 'Confidentiality Period', 'Legal', 'Confidentiality', 1, 85, 'high', 85.0, '3 years', '', '{"page":1,"x":0.1,"y":0.715,"w":0.8,"h":0.02}'::jsonb, 'The Receiving Party shall maintain confidentiality of all disclosed information for a period of three (3) years from the date of disclosure.'),
  ('doc-001', 'doc-001-v13', 'attr-001', 'Contract Start Date', 'Dates', 'Terms and Conditions', 1, 95, 'high', 95.0, 'January 1, 2024', '', '{"page":1,"x":0.1,"y":0.22,"w":0.8,"h":0.02}'::jsonb, 'This Agreement shall commence on January 1, 2024 (the "Effective Date") and shall continue for a period of twelve (12) months unless earlier terminated in accordance with the provisions herein.'),
  ('doc-001', 'doc-001-v13', 'attr-002', 'Contract End Date', 'Dates', 'Terms and Conditions', 1, 92, 'high', 92.0, 'December 31, 2024', '', '{"page":1,"x":0.1,"y":0.275,"w":0.8,"h":0.02}'::jsonb, 'The initial term of this Agreement shall expire on December 31, 2024, subject to renewal provisions outlined in Section 5.2.'),
  ('doc-001', 'doc-001-v13', 'attr-003', 'Total Contract Value', 'Financial', 'Payment Terms', 1, 76, 'medium', 76.0, '$170,000', '', '{"page":1,"x":0.1,"y":0.33,"w":0.8,"h":0.02}'::jsonb, 'The total value of services under this Agreement shall not exceed One Hundred Sixty Thousand Dollars ($160,000) unless mutually agreed in writing by both parties.'),
  ('doc-001', 'doc-001-v13', 'attr-004', 'Payment Terms', 'Financial', 'Payment Terms', 1, 88, 'high', 88.0, 'Net 45', '', '{"page":1,"x":0.1,"y":0.385,"w":0.8,"h":0.02}'::jsonb, 'Payment shall be due within forty-five (45) days of invoice receipt. Late payments shall accrue interest at a rate of 1.5% per month.'),
  ('doc-001', 'doc-001-v13', 'attr-005', 'Governing Law', 'Legal', 'General Provisions', 1, 98, 'high', 98.0, 'State of Delaware', '', '{"page":1,"x":0.1,"y":0.44,"w":0.8,"h":0.02}'::jsonb, 'This Agreement shall be governed by and construed in accordance with the laws of the State of Delaware, without regard to its conflict of laws principles.'),
  ('doc-001', 'doc-001-v13', 'attr-006', 'Termination Notice Period', 'Terms', 'Termination', 1, 40, 'low', 40.0, '30 days', '', '{"page":1,"x":0.1,"y":0.495,"w":0.8,"h":0.02}'::jsonb, 'Either party may terminate this Agreement upon providing written notice to the other party at least thirty (30) days prior to the effective date of termination.'),
  ('doc-001', 'doc-001-v13', 'attr-007', 'Liability Cap', 'Legal', 'Limitation of Liability', 1, 72, 'medium', 72.0, '$700,000', '', '{"page":1,"x":0.1,"y":0.55,"w":0.8,"h":0.02}'::jsonb, 'Aggregate liability under this Agreement shall not exceed Five Hundred Thousand Dollars ($500,000), except in cases of gross negligence or willful misconduct.'),
  ('doc-001', 'doc-001-v13', 'attr-008', 'Auto-Renewal', 'Terms', 'Terms and Conditions', 1, 35, 'low', 35.0, 'Yes', '', '{"page":1,"x":0.1,"y":0.605,"w":0.8,"h":0.02}'::jsonb, 'This Agreement shall automatically renew for successive one (1) year periods unless either party provides notice of non-renewal in accordance with Section 5.2.'),
  ('doc-001', 'doc-001-v13', 'attr-009', 'Client Name', 'Parties', 'Parties', 1, 99, 'high', 99.0, 'Acme Corporation', '', '{"page":1,"x":0.1,"y":0.66,"w":0.8,"h":0.02}'::jsonb, 'This Service Agreement is entered into by and between Acme Corporation ("Client") and Vendor.'),
  ('doc-001', 'doc-001-v13', 'attr-010', 'Confidentiality Period', 'Legal', 'Confidentiality', 1, 85, 'high', 85.0, '2 years', '', '{"page":1,"x":0.1,"y":0.715,"w":0.8,"h":0.02}'::jsonb, 'The Receiving Party shall maintain confidentiality of all disclosed information for a period of three (3) years from the date of disclosure.'),
  ('doc-002', 'doc-002-v1', 'attr-011', 'Effective Date', 'Dates', 'Preamble', 1, 97, 'high', 97.0, 'January 10, 2024', '', '{"page":1,"x":0.1,"y":0.22,"w":0.8,"h":0.02}'::jsonb, 'This Non-Disclosure Agreement is effective as of January 10, 2024 (the "Effective Date").'),
  ('doc-002', 'doc-002-v1', 'attr-012', 'Disclosing Party', 'Parties', 'Parties', 1, 99, 'high', 99.0, 'TechStart Inc.', '', '{"page":1,"x":0.1,"y":0.275,"w":0.8,"h":0.02}'::jsonb, 'TechStart Inc. ("Disclosing Party") and Contract AI Solutions ("Receiving Party") agree to the following terms.'),
  ('doc-002', 'doc-002-v1', 'attr-013', 'Confidentiality Duration', 'Terms', 'Obligations', 1, 94, 'high', 94.0, '5 years', '', '{"page":1,"x":0.1,"y":0.33,"w":0.8,"h":0.02}'::jsonb, 'The Receiving Party shall maintain confidentiality of all disclosed information for a period of five (5) years from the date of disclosure.'),
  ('doc-002', 'doc-002-v1', 'attr-014', 'Governing Law', 'Legal', 'General', 1, 96, 'high', 96.0, 'State of California', '', '{"page":1,"x":0.1,"y":0.385,"w":0.8,"h":0.02}'::jsonb, 'This Agreement shall be governed by and construed under the laws of the State of California.'),
  ('doc-002', 'doc-002-v1', 'attr-015', 'Return of Materials', 'Terms', 'Obligations', 1, 88, 'high', 88.0, 'Within 10 business days', '', '{"page":1,"x":0.1,"y":0.44,"w":0.8,"h":0.02}'::jsonb, 'Within ten (10) business days of termination, the Receiving Party shall return or destroy all confidential materials.'),
  ('doc-002', 'doc-002-v1', 'attr-016', 'Permitted Disclosures', 'Terms', 'Exceptions', 1, 82, 'high', 82.0, 'As required by law', '', '{"page":1,"x":0.1,"y":0.495,"w":0.8,"h":0.02}'::jsonb, 'Confidential Information may be disclosed to the extent required by law or court order, provided prompt notice is given when permitted.'),
  ('doc-002', 'doc-002-v1', 'attr-017', 'Non-Compete Clause', 'Terms', 'Restrictions', 1, 78, 'medium', 78.0, '12 months', '', '{"page":1,"x":0.1,"y":0.55,"w":0.8,"h":0.02}'::jsonb, 'The Receiving Party agrees not to compete with the Disclosing Party for a period of twelve (12) months following termination.'),
  ('doc-002', 'doc-002-v1', 'attr-018', 'Amendment Process', 'Terms', 'General', 1, 84, 'high', 84.0, 'Written amendment required', '', '{"page":1,"x":0.1,"y":0.605,"w":0.8,"h":0.02}'::jsonb, 'Any amendments to this Agreement must be in writing and signed by authorized representatives of both parties.'),
  ('doc-002', 'doc-002-v2', 'attr-011', 'Effective Date', 'Dates', 'Preamble', 1, 97, 'high', 97.0, 'January 10, 2024', '', '{"page":1,"x":0.1,"y":0.22,"w":0.8,"h":0.02}'::jsonb, 'This Non-Disclosure Agreement is effective as of January 10, 2024 (the "Effective Date").'),
  ('doc-002', 'doc-002-v2', 'attr-012', 'Disclosing Party', 'Parties', 'Parties', 1, 99, 'high', 99.0, 'TechStart Incorporated', '', '{"page":1,"x":0.1,"y":0.275,"w":0.8,"h":0.02}'::jsonb, 'TechStart Inc. ("Disclosing Party") and Contract AI Solutions ("Receiving Party") agree to the following terms.'),
  ('doc-002', 'doc-002-v2', 'attr-013', 'Confidentiality Duration', 'Terms', 'Obligations', 1, 94, 'high', 94.0, '5 years', '', '{"page":1,"x":0.1,"y":0.33,"w":0.8,"h":0.02}'::jsonb, 'The Receiving Party shall maintain confidentiality of all disclosed information for a period of five (5) years from the date of disclosure.'),
  ('doc-002', 'doc-002-v2', 'attr-014', 'Governing Law', 'Legal', 'General', 1, 96, 'high', 96.0, 'State of California', '', '{"page":1,"x":0.1,"y":0.385,"w":0.8,"h":0.02}'::jsonb, 'This Agreement shall be governed by and construed under the laws of the State of California.'),
  ('doc-002', 'doc-002-v2', 'attr-015', 'Return of Materials', 'Terms', 'Obligations', 1, 88, 'high', 88.0, 'Within 10 business days', '', '{"page":1,"x":0.1,"y":0.44,"w":0.8,"h":0.02}'::jsonb, 'Within ten (10) business days of termination, the Receiving Party shall return or destroy all confidential materials.'),
  ('doc-002', 'doc-002-v2', 'attr-016', 'Permitted Disclosures', 'Terms', 'Exceptions', 1, 82, 'high', 82.0, 'As required by law', '', '{"page":1,"x":0.1,"y":0.495,"w":0.8,"h":0.02}'::jsonb, 'Confidential Information may be disclosed to the extent required by law or court order, provided prompt notice is given when permitted.'),
  ('doc-002', 'doc-002-v2', 'attr-017', 'Non-Compete Clause', 'Terms', 'Restrictions', 1, 78, 'medium', 78.0, '12 months', '', '{"page":1,"x":0.1,"y":0.55,"w":0.8,"h":0.02}'::jsonb, 'The Receiving Party agrees not to compete with the Disclosing Party for a period of twelve (12) months following termination.'),
  ('doc-002', 'doc-002-v2', 'attr-018', 'Amendment Process', 'Terms', 'General', 1, 84, 'high', 84.0, 'Written amendment required', '', '{"page":1,"x":0.1,"y":0.605,"w":0.8,"h":0.02}'::jsonb, 'Any amendments to this Agreement must be in writing and signed by authorized representatives of both parties.'),
  ('doc-002', 'doc-002-v3', 'attr-011', 'Effective Date', 'Dates', 'Preamble', 1, 97, 'high', 97.0, 'January 10, 2024', '', '{"page":1,"x":0.1,"y":0.22,"w":0.8,"h":0.02}'::jsonb, 'This Non-Disclosure Agreement is effective as of January 10, 2024 (the "Effective Date").'),
  ('doc-002', 'doc-002-v3', 'attr-012', 'Disclosing Party', 'Parties', 'Parties', 1, 99, 'high', 99.0, 'TechStart Incorporated', '', '{"page":1,"x":0.1,"y":0.275,"w":0.8,"h":0.02}'::jsonb, 'TechStart Inc. ("Disclosing Party") and Contract AI Solutions ("Receiving Party") agree to the following terms.'),
  ('doc-002', 'doc-002-v3', 'attr-013', 'Confidentiality Duration', 'Terms', 'Obligations', 1, 94, 'high', 94.0, '4 years', '', '{"page":1,"x":0.1,"y":0.33,"w":0.8,"h":0.02}'::jsonb, 'The Receiving Party shall maintain confidentiality of all disclosed information for a period of five (5) years from the date of disclosure.'),
  ('doc-002', 'doc-002-v3', 'attr-014', 'Governing Law', 'Legal', 'General', 1, 96, 'high', 96.0, 'State of California', '', '{"page":1,"x":0.1,"y":0.385,"w":0.8,"h":0.02}'::jsonb, 'This Agreement shall be governed by and construed under the laws of the State of California.'),
  ('doc-002', 'doc-002-v3', 'attr-015', 'Return of Materials', 'Terms', 'Obligations', 1, 88, 'high', 88.0, 'Within 10 business days', '', '{"page":1,"x":0.1,"y":0.44,"w":0.8,"h":0.02}'::jsonb, 'Within ten (10) business days of termination, the Receiving Party shall return or destroy all confidential materials.'),
  ('doc-002', 'doc-002-v3', 'attr-016', 'Permitted Disclosures', 'Terms', 'Exceptions', 1, 82, 'high', 82.0, 'As required by law', '', '{"page":1,"x":0.1,"y":0.495,"w":0.8,"h":0.02}'::jsonb, 'Confidential Information may be disclosed to the extent required by law or court order, provided prompt notice is given when permitted.'),
  ('doc-002', 'doc-002-v3', 'attr-017', 'Non-Compete Clause', 'Terms', 'Restrictions', 1, 78, 'medium', 78.0, '12 months', '', '{"page":1,"x":0.1,"y":0.55,"w":0.8,"h":0.02}'::jsonb, 'The Receiving Party agrees not to compete with the Disclosing Party for a period of twelve (12) months following termination.'),
  ('doc-002', 'doc-002-v3', 'attr-018', 'Amendment Process', 'Terms', 'General', 1, 84, 'high', 84.0, 'Written amendment required', '', '{"page":1,"x":0.1,"y":0.605,"w":0.8,"h":0.02}'::jsonb, 'Any amendments to this Agreement must be in writing and signed by authorized representatives of both parties.'),
  ('doc-003', 'doc-003-v1', 'attr-019', 'Agreement Type', 'General', 'Preamble', 1, 93, 'high', 93.0, 'Master Services Agreement', '', '{"page":1,"x":0.1,"y":0.22,"w":0.8,"h":0.02}'::jsonb, 'This Master Services Agreement governs the provision of services between GlobalTech and the Service Provider.'),
  ('doc-003', 'doc-003-v1', 'attr-020', 'Term Length', 'Terms', 'Term', 1, 90, 'high', 90.0, '24 months', '', '{"page":1,"x":0.1,"y":0.275,"w":0.8,"h":0.02}'::jsonb, 'The initial term of this Agreement shall be twenty-four (24) months from the Effective Date.'),
  ('doc-003', 'doc-003-v1', 'attr-021', 'Service Scope', 'Services', 'Scope', 1, 86, 'high', 86.0, 'IT support and maintenance', '', '{"page":1,"x":0.1,"y":0.33,"w":0.8,"h":0.02}'::jsonb, 'Services include IT support, maintenance, and related professional services as described in the Statement of Work.'),
  ('doc-003', 'doc-003-v1', 'attr-022', 'Rate Card', 'Financial', 'Fees', 1, 81, 'high', 81.0, '$150/hr', '', '{"page":1,"x":0.1,"y":0.385,"w":0.8,"h":0.02}'::jsonb, 'Professional services shall be billed in accordance with the rate card at one hundred fifty dollars ($150) per hour.'),
  ('doc-003', 'doc-003-v1', 'attr-023', 'SLA Uptime', 'SLA', 'Service Levels', 1, 87, 'high', 87.0, '99.9%', '', '{"page":1,"x":0.1,"y":0.44,"w":0.8,"h":0.02}'::jsonb, 'Service availability will be maintained at 99.9% uptime, measured monthly.'),
  ('doc-003', 'doc-003-v1', 'attr-024', 'Data Protection', 'Legal', 'Security', 1, 89, 'high', 89.0, 'GDPR compliant', '', '{"page":1,"x":0.1,"y":0.495,"w":0.8,"h":0.02}'::jsonb, 'Each party shall comply with applicable data protection laws, including GDPR, when processing personal data.'),
  ('doc-003', 'doc-003-v2', 'attr-019', 'Agreement Type', 'General', 'Preamble', 1, 93, 'high', 93.0, 'Master Services Agreement', '', '{"page":1,"x":0.1,"y":0.22,"w":0.8,"h":0.02}'::jsonb, 'This Master Services Agreement governs the provision of services between GlobalTech and the Service Provider.'),
  ('doc-003', 'doc-003-v2', 'attr-020', 'Term Length', 'Terms', 'Term', 1, 90, 'high', 90.0, '24 months', '', '{"page":1,"x":0.1,"y":0.275,"w":0.8,"h":0.02}'::jsonb, 'The initial term of this Agreement shall be twenty-four (24) months from the Effective Date.'),
  ('doc-003', 'doc-003-v2', 'attr-021', 'Service Scope', 'Services', 'Scope', 1, 86, 'high', 86.0, 'IT support and maintenance', '', '{"page":1,"x":0.1,"y":0.33,"w":0.8,"h":0.02}'::jsonb, 'Services include IT support, maintenance, and related professional services as described in the Statement of Work.'),
  ('doc-003', 'doc-003-v2', 'attr-022', 'Rate Card', 'Financial', 'Fees', 1, 81, 'high', 81.0, '$150/hr', '', '{"page":1,"x":0.1,"y":0.385,"w":0.8,"h":0.02}'::jsonb, 'Professional services shall be billed in accordance with the rate card at one hundred fifty dollars ($150) per hour.'),
  ('doc-003', 'doc-003-v2', 'attr-023', 'SLA Uptime', 'SLA', 'Service Levels', 1, 87, 'high', 87.0, '99.9%', '', '{"page":1,"x":0.1,"y":0.44,"w":0.8,"h":0.02}'::jsonb, 'Service availability will be maintained at 99.9% uptime, measured monthly.'),
  ('doc-003', 'doc-003-v2', 'attr-024', 'Data Protection', 'Legal', 'Security', 1, 89, 'high', 89.0, 'GDPR compliant', '', '{"page":1,"x":0.1,"y":0.495,"w":0.8,"h":0.02}'::jsonb, 'Each party shall comply with applicable data protection laws, including GDPR, when processing personal data.'),
  ('doc-003', 'doc-003-v3', 'attr-019', 'Agreement Type', 'General', 'Preamble', 1, 93, 'high', 93.0, 'Master Services Agreement', '', '{"page":1,"x":0.1,"y":0.22,"w":0.8,"h":0.02}'::jsonb, 'This Master Services Agreement governs the provision of services between GlobalTech and the Service Provider.'),
  ('doc-003', 'doc-003-v3', 'attr-020', 'Term Length', 'Terms', 'Term', 1, 90, 'high', 90.0, '24 months', '', '{"page":1,"x":0.1,"y":0.275,"w":0.8,"h":0.02}'::jsonb, 'The initial term of this Agreement shall be twenty-four (24) months from the Effective Date.'),
  ('doc-003', 'doc-003-v3', 'attr-021', 'Service Scope', 'Services', 'Scope', 1, 86, 'high', 86.0, 'IT support and maintenance', '', '{"page":1,"x":0.1,"y":0.33,"w":0.8,"h":0.02}'::jsonb, 'Services include IT support, maintenance, and related professional services as described in the Statement of Work.'),
  ('doc-003', 'doc-003-v3', 'attr-022', 'Rate Card', 'Financial', 'Fees', 1, 81, 'high', 81.0, '$150/hr', '', '{"page":1,"x":0.1,"y":0.385,"w":0.8,"h":0.02}'::jsonb, 'Professional services shall be billed in accordance with the rate card at one hundred fifty dollars ($150) per hour.'),
  ('doc-003', 'doc-003-v3', 'attr-023', 'SLA Uptime', 'SLA', 'Service Levels', 1, 87, 'high', 87.0, '99.9%', '', '{"page":1,"x":0.1,"y":0.44,"w":0.8,"h":0.02}'::jsonb, 'Service availability will be maintained at 99.9% uptime, measured monthly.'),
  ('doc-003', 'doc-003-v3', 'attr-024', 'Data Protection', 'Legal', 'Security', 1, 89, 'high', 89.0, 'GDPR compliant', '', '{"page":1,"x":0.1,"y":0.495,"w":0.8,"h":0.02}'::jsonb, 'Each party shall comply with applicable data protection laws, including GDPR, when processing personal data.'),
  ('doc-004', 'doc-004-v1', 'attr-025', 'License Type', 'License', 'Grant', 1, 91, 'high', 91.0, 'Enterprise', '', '{"page":1,"x":0.1,"y":0.22,"w":0.8,"h":0.02}'::jsonb, 'Vendor grants an Enterprise license to use the Software in accordance with this Agreement.'),
  ('doc-004', 'doc-004-v1', 'attr-026', 'Licensed Users', 'License', 'Grant', 1, 85, 'high', 85.0, 'Up to 500 users', '', '{"page":1,"x":0.1,"y":0.275,"w":0.8,"h":0.02}'::jsonb, 'The license permits up to five hundred (500) authorized users.'),
  ('doc-004', 'doc-004-v1', 'attr-027', 'Annual Fee', 'Financial', 'Fees', 1, 83, 'high', 83.0, '$120,000', '', '{"page":1,"x":0.1,"y":0.33,"w":0.8,"h":0.02}'::jsonb, 'The annual license fee shall be One Hundred Twenty Thousand Dollars ($120,000), payable in advance.'),
  ('doc-004', 'doc-004-v1', 'attr-028', 'Support Level', 'Support', 'Support', 1, 79, 'medium', 79.0, 'Premium', '', '{"page":1,"x":0.1,"y":0.385,"w":0.8,"h":0.02}'::jsonb, 'Premium support includes 24x7 coverage and priority response times.'),
  ('doc-004', 'doc-004-v1', 'attr-029', 'Intellectual Property', 'Legal', 'IP', 1, 88, 'high', 88.0, 'Vendor retains IP', '', '{"page":1,"x":0.1,"y":0.44,"w":0.8,"h":0.02}'::jsonb, 'All intellectual property rights in the Software remain with Vendor.'),
  ('doc-004', 'doc-004-v2', 'attr-025', 'License Type', 'License', 'Grant', 1, 91, 'high', 91.0, 'Enterprise', '', '{"page":1,"x":0.1,"y":0.22,"w":0.8,"h":0.02}'::jsonb, 'Vendor grants an Enterprise license to use the Software in accordance with this Agreement.'),
  ('doc-004', 'doc-004-v2', 'attr-026', 'Licensed Users', 'License', 'Grant', 1, 85, 'high', 85.0, 'Up to 500 users', '', '{"page":1,"x":0.1,"y":0.275,"w":0.8,"h":0.02}'::jsonb, 'The license permits up to five hundred (500) authorized users.'),
  ('doc-004', 'doc-004-v2', 'attr-027', 'Annual Fee', 'Financial', 'Fees', 1, 83, 'high', 83.0, '$120,000', '', '{"page":1,"x":0.1,"y":0.33,"w":0.8,"h":0.02}'::jsonb, 'The annual license fee shall be One Hundred Twenty Thousand Dollars ($120,000), payable in advance.'),
  ('doc-004', 'doc-004-v2', 'attr-028', 'Support Level', 'Support', 'Support', 1, 79, 'medium', 79.0, 'Premium', '', '{"page":1,"x":0.1,"y":0.385,"w":0.8,"h":0.02}'::jsonb, 'Premium support includes 24x7 coverage and priority response times.'),
  ('doc-004', 'doc-004-v2', 'attr-029', 'Intellectual Property', 'Legal', 'IP', 1, 88, 'high', 88.0, 'Vendor retains IP', '', '{"page":1,"x":0.1,"y":0.44,"w":0.8,"h":0.02}'::jsonb, 'All intellectual property rights in the Software remain with Vendor.'),
  ('doc-004', 'doc-004-v3', 'attr-025', 'License Type', 'License', 'Grant', 1, 91, 'high', 91.0, 'Enterprise', '', '{"page":1,"x":0.1,"y":0.22,"w":0.8,"h":0.02}'::jsonb, 'Vendor grants an Enterprise license to use the Software in accordance with this Agreement.'),
  ('doc-004', 'doc-004-v3', 'attr-026', 'Licensed Users', 'License', 'Grant', 1, 85, 'high', 85.0, 'Up to 500 users', '', '{"page":1,"x":0.1,"y":0.275,"w":0.8,"h":0.02}'::jsonb, 'The license permits up to five hundred (500) authorized users.'),
  ('doc-004', 'doc-004-v3', 'attr-027', 'Annual Fee', 'Financial', 'Fees', 1, 83, 'high', 83.0, '$120,000', '', '{"page":1,"x":0.1,"y":0.33,"w":0.8,"h":0.02}'::jsonb, 'The annual license fee shall be One Hundred Twenty Thousand Dollars ($120,000), payable in advance.'),
  ('doc-004', 'doc-004-v3', 'attr-028', 'Support Level', 'Support', 'Support', 1, 79, 'medium', 79.0, 'Premium', '', '{"page":1,"x":0.1,"y":0.385,"w":0.8,"h":0.02}'::jsonb, 'Premium support includes 24x7 coverage and priority response times.'),
  ('doc-004', 'doc-004-v3', 'attr-029', 'Intellectual Property', 'Legal', 'IP', 1, 88, 'high', 88.0, 'Vendor retains IP', '', '{"page":1,"x":0.1,"y":0.44,"w":0.8,"h":0.02}'::jsonb, 'All intellectual property rights in the Software remain with Vendor.'),
  ('doc-005', 'doc-005-v1', 'attr-030', 'Consultant Name', 'Parties', 'Parties', 1, 99, 'high', 99.0, 'Innovation Labs LLC', '', '{"page":1,"x":0.1,"y":0.22,"w":0.8,"h":0.02}'::jsonb, 'This Consulting Agreement is between Innovation Labs LLC ("Consultant") and the Client.'),
  ('doc-005', 'doc-005-v1', 'attr-031', 'Project Duration', 'Terms', 'Term', 1, 86, 'high', 86.0, '6 months', '', '{"page":1,"x":0.1,"y":0.275,"w":0.8,"h":0.02}'::jsonb, 'The project duration shall be six (6) months from the Effective Date.'),
  ('doc-005', 'doc-005-v1', 'attr-032', 'Deliverables', 'Services', 'Deliverables', 1, 80, 'high', 80.0, 'Monthly reports', '', '{"page":1,"x":0.1,"y":0.33,"w":0.8,"h":0.02}'::jsonb, 'Consultant will provide monthly reports and deliverables as agreed in the project plan.'),
  ('doc-005', 'doc-005-v1', 'attr-033', 'Consulting Rate', 'Financial', 'Fees', 1, 84, 'high', 84.0, '$200/hr', '', '{"page":1,"x":0.1,"y":0.385,"w":0.8,"h":0.02}'::jsonb, 'Consulting services shall be billed at two hundred dollars ($200) per hour.'),
  ('doc-005', 'doc-005-v1', 'attr-034', 'Expense Policy', 'Financial', 'Expenses', 1, 78, 'medium', 78.0, 'Pre-approved expenses reimbursed', '', '{"page":1,"x":0.1,"y":0.44,"w":0.8,"h":0.02}'::jsonb, 'Reasonable, pre-approved expenses will be reimbursed in accordance with company policy.'),
  ('doc-005', 'doc-005-v1', 'attr-035', 'Work Product Ownership', 'Legal', 'IP', 1, 82, 'high', 82.0, 'Client owns work product', '', '{"page":1,"x":0.1,"y":0.495,"w":0.8,"h":0.02}'::jsonb, 'All work product created under this Agreement shall be owned by the Client upon full payment.'),
  ('doc-005', 'doc-005-v2', 'attr-030', 'Consultant Name', 'Parties', 'Parties', 1, 99, 'high', 99.0, 'Innovation Labs LLC', '', '{"page":1,"x":0.1,"y":0.22,"w":0.8,"h":0.02}'::jsonb, 'This Consulting Agreement is between Innovation Labs LLC ("Consultant") and the Client.'),
  ('doc-005', 'doc-005-v2', 'attr-031', 'Project Duration', 'Terms', 'Term', 1, 86, 'high', 86.0, '6 months', '', '{"page":1,"x":0.1,"y":0.275,"w":0.8,"h":0.02}'::jsonb, 'The project duration shall be six (6) months from the Effective Date.'),
  ('doc-005', 'doc-005-v2', 'attr-032', 'Deliverables', 'Services', 'Deliverables', 1, 80, 'high', 80.0, 'Monthly reports', '', '{"page":1,"x":0.1,"y":0.33,"w":0.8,"h":0.02}'::jsonb, 'Consultant will provide monthly reports and deliverables as agreed in the project plan.'),
  ('doc-005', 'doc-005-v2', 'attr-033', 'Consulting Rate', 'Financial', 'Fees', 1, 84, 'high', 84.0, '$200/hr', '', '{"page":1,"x":0.1,"y":0.385,"w":0.8,"h":0.02}'::jsonb, 'Consulting services shall be billed at two hundred dollars ($200) per hour.'),
  ('doc-005', 'doc-005-v2', 'attr-034', 'Expense Policy', 'Financial', 'Expenses', 1, 78, 'medium', 78.0, 'Pre-approved expenses reimbursed', '', '{"page":1,"x":0.1,"y":0.44,"w":0.8,"h":0.02}'::jsonb, 'Reasonable, pre-approved expenses will be reimbursed in accordance with company policy.'),
  ('doc-005', 'doc-005-v2', 'attr-035', 'Work Product Ownership', 'Legal', 'IP', 1, 82, 'high', 82.0, 'Client owns work product', '', '{"page":1,"x":0.1,"y":0.495,"w":0.8,"h":0.02}'::jsonb, 'All work product created under this Agreement shall be owned by the Client upon full payment.'),
  ('doc-005', 'doc-005-v3', 'attr-030', 'Consultant Name', 'Parties', 'Parties', 1, 99, 'high', 99.0, 'Innovation Labs LLC', '', '{"page":1,"x":0.1,"y":0.22,"w":0.8,"h":0.02}'::jsonb, 'This Consulting Agreement is between Innovation Labs LLC ("Consultant") and the Client.'),
  ('doc-005', 'doc-005-v3', 'attr-031', 'Project Duration', 'Terms', 'Term', 1, 86, 'high', 86.0, '6 months', '', '{"page":1,"x":0.1,"y":0.275,"w":0.8,"h":0.02}'::jsonb, 'The project duration shall be six (6) months from the Effective Date.'),
  ('doc-005', 'doc-005-v3', 'attr-032', 'Deliverables', 'Services', 'Deliverables', 1, 80, 'high', 80.0, 'Monthly reports', '', '{"page":1,"x":0.1,"y":0.33,"w":0.8,"h":0.02}'::jsonb, 'Consultant will provide monthly reports and deliverables as agreed in the project plan.'),
  ('doc-005', 'doc-005-v3', 'attr-033', 'Consulting Rate', 'Financial', 'Fees', 1, 84, 'high', 84.0, '$200/hr', '', '{"page":1,"x":0.1,"y":0.385,"w":0.8,"h":0.02}'::jsonb, 'Consulting services shall be billed at two hundred dollars ($200) per hour.'),
  ('doc-005', 'doc-005-v3', 'attr-034', 'Expense Policy', 'Financial', 'Expenses', 1, 78, 'medium', 78.0, 'Pre-approved expenses reimbursed', '', '{"page":1,"x":0.1,"y":0.44,"w":0.8,"h":0.02}'::jsonb, 'Reasonable, pre-approved expenses will be reimbursed in accordance with company policy.'),
  ('doc-005', 'doc-005-v3', 'attr-035', 'Work Product Ownership', 'Legal', 'IP', 1, 82, 'high', 82.0, 'Client owns work product', '', '{"page":1,"x":0.1,"y":0.495,"w":0.8,"h":0.02}'::jsonb, 'All work product created under this Agreement shall be owned by the Client upon full payment.')
ON CONFLICT (attribute_key, version_id) DO UPDATE SET
  field_name = EXCLUDED.field_name,
  category = EXCLUDED.category,
  section = EXCLUDED.section,
  page_number = EXCLUDED.page_number,
  confidence_score = EXCLUDED.confidence_score,
  confidence_level = EXCLUDED.confidence_level,
  confidence = EXCLUDED.confidence,
  field_value = EXCLUDED.field_value,
  corrected_value = EXCLUDED.corrected_value,
  bounding_box = EXCLUDED.bounding_box,
  highlighted_text = EXCLUDED.highlighted_text;


DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='extracted_fields' AND column_name='bounding_box'
  ) THEN
  UPDATE extracted_fields
  SET bounding_box = '{"page":1,"x":0.088235,"y":0.22636,"w":0.163778,"h":0.013889}'::jsonb
  WHERE document_id = 'doc-001' AND attribute_key = 'attr-001';
  UPDATE extracted_fields
  SET bounding_box = '{"page":1,"x":0.088235,"y":0.299592,"w":0.156786,"h":0.013889}'::jsonb
  WHERE document_id = 'doc-001' AND attribute_key = 'attr-002';
  UPDATE extracted_fields
  SET bounding_box = '{"page":1,"x":0.088235,"y":0.372824,"w":0.174778,"h":0.013889}'::jsonb
  WHERE document_id = 'doc-001' AND attribute_key = 'attr-003';
  UPDATE extracted_fields
  SET bounding_box = '{"page":1,"x":0.555753,"y":0.372824,"w":0.133851,"h":0.013889}'::jsonb
  WHERE document_id = 'doc-001' AND attribute_key = 'attr-004';
  UPDATE extracted_fields
  SET bounding_box = '{"page":1,"x":0.088235,"y":0.519289,"w":0.129843,"h":0.013889}'::jsonb
  WHERE document_id = 'doc-001' AND attribute_key = 'attr-005';
  UPDATE extracted_fields
  SET bounding_box = '{"page":1,"x":0.088235,"y":0.592521,"w":0.223721,"h":0.013889}'::jsonb
  WHERE document_id = 'doc-001' AND attribute_key = 'attr-006';
  UPDATE extracted_fields
  SET bounding_box = '{"page":1,"x":0.088235,"y":0.665754,"w":0.106873,"h":0.013889}'::jsonb
  WHERE document_id = 'doc-001' AND attribute_key = 'attr-007';
  UPDATE extracted_fields
  SET bounding_box = '{"page":1,"x":0.088235,"y":0.738986,"w":0.119832,"h":0.013889}'::jsonb
  WHERE document_id = 'doc-001' AND attribute_key = 'attr-008';
  UPDATE extracted_fields
  SET bounding_box = '{"page":1,"x":0.088235,"y":0.812218,"w":0.103871,"h":0.013889}'::jsonb
  WHERE document_id = 'doc-001' AND attribute_key = 'attr-009';
  UPDATE extracted_fields
  SET bounding_box = '{"page":1,"x":0.088235,"y":0.885451,"w":0.18576,"h":0.013889}'::jsonb
  WHERE document_id = 'doc-001' AND attribute_key = 'attr-010';
  UPDATE extracted_fields
  SET bounding_box = '{"page":1,"x":0.088235,"y":0.22636,"w":0.118861,"h":0.013889}'::jsonb
  WHERE document_id = 'doc-002' AND attribute_key = 'attr-011';
  UPDATE extracted_fields
  SET bounding_box = '{"page":1,"x":0.088235,"y":0.284441,"w":0.140843,"h":0.013889}'::jsonb
  WHERE document_id = 'doc-002' AND attribute_key = 'attr-012';
  UPDATE extracted_fields
  SET bounding_box = '{"page":1,"x":0.088235,"y":0.357673,"w":0.203716,"h":0.013889}'::jsonb
  WHERE document_id = 'doc-002' AND attribute_key = 'attr-013';
  UPDATE extracted_fields
  SET bounding_box = '{"page":1,"x":0.088235,"y":0.430905,"w":0.129843,"h":0.013889}'::jsonb
  WHERE document_id = 'doc-002' AND attribute_key = 'attr-014';
  UPDATE extracted_fields
  SET bounding_box = '{"page":1,"x":0.088235,"y":0.488986,"w":0.162789,"h":0.013889}'::jsonb
  WHERE document_id = 'doc-002' AND attribute_key = 'attr-015';
  UPDATE extracted_fields
  SET bounding_box = '{"page":1,"x":0.088235,"y":0.562218,"w":0.189786,"h":0.013889}'::jsonb
  WHERE document_id = 'doc-002' AND attribute_key = 'attr-016';
  UPDATE extracted_fields
  SET bounding_box = '{"page":1,"x":0.088235,"y":0.620299,"w":0.181752,"h":0.013889}'::jsonb
  WHERE document_id = 'doc-002' AND attribute_key = 'attr-017';
  UPDATE extracted_fields
  SET bounding_box = '{"page":1,"x":0.088235,"y":0.67838,"w":0.178786,"h":0.013889}'::jsonb
  WHERE document_id = 'doc-002' AND attribute_key = 'attr-018';
  UPDATE extracted_fields
  SET bounding_box = '{"page":1,"x":0.088235,"y":0.22636,"w":0.140825,"h":0.013889}'::jsonb
  WHERE document_id = 'doc-003' AND attribute_key = 'attr-019';
  UPDATE extracted_fields
  SET bounding_box = '{"page":1,"x":0.088235,"y":0.284441,"w":0.10885,"h":0.013889}'::jsonb
  WHERE document_id = 'doc-003' AND attribute_key = 'attr-020';
  UPDATE extracted_fields
  SET bounding_box = '{"page":1,"x":0.088235,"y":0.357673,"w":0.122887,"h":0.013889}'::jsonb
  WHERE document_id = 'doc-003' AND attribute_key = 'attr-021';
  UPDATE extracted_fields
  SET bounding_box = '{"page":1,"x":0.088235,"y":0.430905,"w":0.084891,"h":0.013889}'::jsonb
  WHERE document_id = 'doc-003' AND attribute_key = 'attr-022';
  UPDATE extracted_fields
  SET bounding_box = '{"page":1,"x":0.088235,"y":0.504138,"w":0.101858,"h":0.013889}'::jsonb
  WHERE document_id = 'doc-003' AND attribute_key = 'attr-023';
  UPDATE extracted_fields
  SET bounding_box = '{"page":1,"x":0.088235,"y":0.562218,"w":0.132827,"h":0.013889}'::jsonb
  WHERE document_id = 'doc-003' AND attribute_key = 'attr-024';
  UPDATE extracted_fields
  SET bounding_box = '{"page":1,"x":0.088235,"y":0.22636,"w":0.113882,"h":0.013889}'::jsonb
  WHERE document_id = 'doc-004' AND attribute_key = 'attr-025';
  UPDATE extracted_fields
  SET bounding_box = '{"page":1,"x":0.088235,"y":0.284441,"w":0.132863,"h":0.013889}'::jsonb
  WHERE document_id = 'doc-004' AND attribute_key = 'attr-026';
  UPDATE extracted_fields
  SET bounding_box = '{"page":1,"x":0.088235,"y":0.342521,"w":0.096879,"h":0.013889}'::jsonb
  WHERE document_id = 'doc-004' AND attribute_key = 'attr-027';
  UPDATE extracted_fields
  SET bounding_box = '{"page":1,"x":0.088235,"y":0.400602,"w":0.11985,"h":0.013889}'::jsonb
  WHERE document_id = 'doc-004' AND attribute_key = 'attr-028';
  UPDATE extracted_fields
  SET bounding_box = '{"page":1,"x":0.088235,"y":0.458683,"w":0.172801,"h":0.013889}'::jsonb
  WHERE document_id = 'doc-004' AND attribute_key = 'attr-029';
  UPDATE extracted_fields
  SET bounding_box = '{"page":1,"x":0.088235,"y":0.22636,"w":0.147799,"h":0.013889}'::jsonb
  WHERE document_id = 'doc-005' AND attribute_key = 'attr-030';
  UPDATE extracted_fields
  SET bounding_box = '{"page":1,"x":0.088235,"y":0.284441,"w":0.139819,"h":0.013889}'::jsonb
  WHERE document_id = 'doc-005' AND attribute_key = 'attr-031';
  UPDATE extracted_fields
  SET bounding_box = '{"page":1,"x":0.088235,"y":0.357673,"w":0.105902,"h":0.013889}'::jsonb
  WHERE document_id = 'doc-005' AND attribute_key = 'attr-032';
  UPDATE extracted_fields
  SET bounding_box = '{"page":1,"x":0.088235,"y":0.430905,"w":0.137806,"h":0.013889}'::jsonb
  WHERE document_id = 'doc-005' AND attribute_key = 'attr-033';
  UPDATE extracted_fields
  SET bounding_box = '{"page":1,"x":0.088235,"y":0.488986,"w":0.131874,"h":0.013889}'::jsonb
  WHERE document_id = 'doc-005' AND attribute_key = 'attr-034';
  UPDATE extracted_fields
  SET bounding_box = '{"page":1,"x":0.088235,"y":0.547067,"w":0.215722,"h":0.013889}'::jsonb
  WHERE document_id = 'doc-005' AND attribute_key = 'attr-035';
  END IF;
END $$;

COMMIT;
