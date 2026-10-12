-- Custom SQL: ledger invariants the schema DSL can't express.

-- Every journal must balance and have at least two entries, checked at commit.
CREATE FUNCTION ledger_journal_balanced() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  d bigint;
  c bigint;
  n integer;
BEGIN
  SELECT coalesce(sum(debit_cents), 0), coalesce(sum(credit_cents), 0), count(*)
    INTO d, c, n
    FROM ledger_entries
    WHERE journal_id = NEW.journal_id;
  IF n < 2 OR d <> c THEN
    RAISE EXCEPTION 'journal % is unbalanced: % entries, debits %, credits %', NEW.journal_id, n, d, c
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL;
END;
$$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER journal_balanced
  AFTER INSERT ON ledger_entries
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION ledger_journal_balanced();
--> statement-breakpoint

-- Append-only. Row triggers don't fire on TRUNCATE, which tests use for cleanup.
CREATE FUNCTION ledger_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only: % rejected', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER journals_append_only
  BEFORE UPDATE OR DELETE ON journals
  FOR EACH ROW EXECUTE FUNCTION ledger_append_only();
--> statement-breakpoint
CREATE TRIGGER ledger_entries_append_only
  BEFORE UPDATE OR DELETE ON ledger_entries
  FOR EACH ROW EXECUTE FUNCTION ledger_append_only();
--> statement-breakpoint

INSERT INTO ledger_accounts (id, type) VALUES ('platform:fees', 'revenue'), ('paypal:clearing', 'asset');
