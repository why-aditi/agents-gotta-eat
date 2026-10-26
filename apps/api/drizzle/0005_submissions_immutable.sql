-- Submissions are frozen once written. Row triggers don't fire on TRUNCATE, which tests use for cleanup.
CREATE FUNCTION arena_submission_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'submissions are immutable: % rejected', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER submissions_immutable
  BEFORE UPDATE OR DELETE ON submissions
  FOR EACH ROW EXECUTE FUNCTION arena_submission_immutable();
