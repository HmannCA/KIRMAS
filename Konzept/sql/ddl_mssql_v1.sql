-- KIRMAS – SQL Server DDL v1 (vereinfachter Start)
CREATE TABLE EntityType (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  [key] NVARCHAR(100) NOT NULL UNIQUE,
  title NVARCHAR(200) NOT NULL,
  meta_json NVARCHAR(MAX) NULL
);

CREATE TABLE Entity (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  tenant_id UNIQUEIDENTIFIER NULL,
  type_id UNIQUEIDENTIFIER NOT NULL REFERENCES EntityType(id),
  name NVARCHAR(300) NOT NULL,
  geo_lat DECIMAL(9,6) NULL,
  geo_lng DECIMAL(9,6) NULL,
  meta_json NVARCHAR(MAX) NULL,
  created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
CREATE INDEX IX_Entity_Type ON Entity(type_id);
CREATE INDEX IX_Entity_Tenant ON Entity(tenant_id);

CREATE TABLE RelationType (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  [key] NVARCHAR(100) NOT NULL UNIQUE,
  title NVARCHAR(200) NOT NULL
);

CREATE TABLE Relation (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  src_id UNIQUEIDENTIFIER NOT NULL REFERENCES Entity(id),
  relation_type_id UNIQUEIDENTIFIER NOT NULL REFERENCES RelationType(id),
  dst_id UNIQUEIDENTIFIER NOT NULL REFERENCES Entity(id),
  valid_from DATE NULL,
  valid_to DATE NULL,
  note NVARCHAR(400) NULL
);
CREATE INDEX IX_Relation_Src ON Relation(src_id);
CREATE INDEX IX_Relation_Dst ON Relation(dst_id);
CREATE INDEX IX_Relation_Type ON Relation(relation_type_id);

CREATE TABLE EntityClosure (
  ancestor_id UNIQUEIDENTIFIER NOT NULL REFERENCES Entity(id),
  descendant_id UNIQUEIDENTIFIER NOT NULL REFERENCES Entity(id),
  depth INT NOT NULL,
  PRIMARY KEY (ancestor_id, descendant_id)
);

CREATE TABLE Survey (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  [key] NVARCHAR(120) NOT NULL UNIQUE,
  current_version INT NOT NULL DEFAULT 0,
  created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE TABLE SurveyVersion (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  survey_id UNIQUEIDENTIFIER NOT NULL REFERENCES Survey(id),
  version INT NOT NULL,
  title NVARCHAR(300) NOT NULL,
  status NVARCHAR(40) NOT NULL,
  published_at DATETIME2 NULL,
  snapshot_json NVARCHAR(MAX) NOT NULL
);
CREATE UNIQUE INDEX UX_SurveyVersion_Survey_Version ON SurveyVersion(survey_id, version);

CREATE TABLE SurveyField (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  survey_id UNIQUEIDENTIFIER NOT NULL REFERENCES Survey(id)
);

CREATE TABLE SurveyFieldVersion (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  field_id UNIQUEIDENTIFIER NOT NULL REFERENCES SurveyField(id),
  survey_version_id UNIQUEIDENTIFIER NOT NULL REFERENCES SurveyVersion(id),
  section NVARCHAR(200) NULL,
  [key] NVARCHAR(120) NULL,
  label NVARCHAR(300) NOT NULL,
  [type] NVARCHAR(40) NOT NULL,
  required BIT NOT NULL DEFAULT 0,
  width NVARCHAR(20) NULL,
  visibility_rule NVARCHAR(MAX) NULL,
  semantic_tag NVARCHAR(120) NULL,
  meta_json NVARCHAR(MAX) NULL
);
CREATE INDEX IX_FieldVersion_Field ON SurveyFieldVersion(field_id);
CREATE INDEX IX_FieldVersion_SurveyVer ON SurveyFieldVersion(survey_version_id);
CREATE INDEX IX_FieldVersion_Tag ON SurveyFieldVersion(semantic_tag);

CREATE TABLE SurveyOption (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  field_id UNIQUEIDENTIFIER NOT NULL REFERENCES SurveyField(id)
);

CREATE TABLE SurveyOptionVersion (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  option_id UNIQUEIDENTIFIER NOT NULL REFERENCES SurveyOption(id),
  field_version_id UNIQUEIDENTIFIER NOT NULL REFERENCES SurveyFieldVersion(id),
  value_code NVARCHAR(200) NOT NULL,
  label NVARCHAR(300) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  active BIT NOT NULL DEFAULT 1
);
CREATE INDEX IX_OptionVersion_FieldVer ON SurveyOptionVersion(field_version_id);
CREATE INDEX IX_OptionVersion_ValueCode ON SurveyOptionVersion(value_code);

CREATE TABLE SurveyResponse (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  survey_version_id UNIQUEIDENTIFIER NOT NULL REFERENCES SurveyVersion(id),
  entity_id UNIQUEIDENTIFIER NOT NULL REFERENCES Entity(id),
  period_from DATE NULL,
  period_to DATE NULL,
  submitted_by NVARCHAR(200) NULL,
  submitted_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  status NVARCHAR(40) NOT NULL DEFAULT 'submitted',
  meta_json NVARCHAR(MAX) NULL
);
CREATE INDEX IX_Response_Entity ON SurveyResponse(entity_id);
CREATE INDEX IX_Response_SurveyVersion ON SurveyResponse(survey_version_id);

CREATE TABLE AnswerText (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  response_id UNIQUEIDENTIFIER NOT NULL REFERENCES SurveyResponse(id),
  field_id UNIQUEIDENTIFIER NOT NULL REFERENCES SurveyField(id),
  value_text NVARCHAR(MAX) NULL
);
CREATE INDEX IX_AnswerText_Field ON AnswerText(field_id);

CREATE TABLE AnswerNumber (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  response_id UNIQUEIDENTIFIER NOT NULL REFERENCES SurveyResponse(id),
  field_id UNIQUEIDENTIFIER NOT NULL REFERENCES SurveyField(id),
  value_num DECIMAL(18,4) NULL,
  unit NVARCHAR(40) NULL
);
CREATE INDEX IX_AnswerNumber_Field ON AnswerNumber(field_id);
CREATE INDEX IX_AnswerNumber_Value ON AnswerNumber(value_num);

CREATE TABLE AnswerDate (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  response_id UNIQUEIDENTIFIER NOT NULL REFERENCES SurveyResponse(id),
  field_id UNIQUEIDENTIFIER NOT NULL REFERENCES SurveyField(id),
  value_date DATE NULL
);
CREATE INDEX IX_AnswerDate_Field ON AnswerDate(field_id);
CREATE INDEX IX_AnswerDate_Value ON AnswerDate(value_date);

CREATE TABLE AnswerSelect (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  response_id UNIQUEIDENTIFIER NOT NULL REFERENCES SurveyResponse(id),
  field_id UNIQUEIDENTIFIER NOT NULL REFERENCES SurveyField(id),
  option_id UNIQUEIDENTIFIER NOT NULL REFERENCES SurveyOption(id),
  value_code NVARCHAR(200) NOT NULL
);
CREATE INDEX IX_AnswerSelect_Field ON AnswerSelect(field_id);
CREATE INDEX IX_AnswerSelect_Option ON AnswerSelect(option_id);
CREATE INDEX IX_AnswerSelect_Code ON AnswerSelect(value_code);

CREATE TABLE AnswerMultiSelect (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  response_id UNIQUEIDENTIFIER NOT NULL REFERENCES SurveyResponse(id),
  field_id UNIQUEIDENTIFIER NOT NULL REFERENCES SurveyField(id),
  option_id UNIQUEIDENTIFIER NOT NULL REFERENCES SurveyOption(id)
);
CREATE INDEX IX_AnswerMultiSelect_Field ON AnswerMultiSelect(field_id);
CREATE INDEX IX_AnswerMultiSelect_Option ON AnswerMultiSelect(option_id);

CREATE TABLE Audit (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  actor NVARCHAR(200) NOT NULL,
  ts DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  action NVARCHAR(60) NOT NULL,
  object_type NVARCHAR(60) NOT NULL,
  object_id UNIQUEIDENTIFIER NULL,
  changes_json NVARCHAR(MAX) NULL
);
