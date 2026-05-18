"""Apply a single migration file by path. Usage: python apply_migration.py <path>"""
import os, sys, psycopg

path = sys.argv[1]
sql = open(path).read()
c = psycopg.connect(os.environ["SUPABASE_DB_URL"], prepare_threshold=None, autocommit=True)
c.execute(sql)
c.close()
print(f"applied {path}")
