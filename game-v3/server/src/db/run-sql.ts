import pool from './client.js';
const sql = process.argv[2];
if (!sql) { console.error('Usage: tsx run-sql.ts "SQL"'); process.exit(1); }
pool.query(sql).then(r => { console.log('OK:', r.command, r.rowCount); pool.end(); }).catch(e => { console.error(e.message); pool.end(); process.exit(1); });
