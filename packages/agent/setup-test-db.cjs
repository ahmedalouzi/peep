const { Client } = require('pg');

async function setup() {
  const client = new Client({ connectionString: 'postgres://postgres:postgres@localhost:5432/postgres' });
  await client.connect();
  
  try {
    const res = await client.query(`SELECT 1 FROM pg_roles WHERE rolname='testuser'`);
    if (res.rowCount === 0) {
      await client.query(`CREATE ROLE testuser WITH LOGIN PASSWORD 'testpass' NOSUPERUSER CREATEROLE CREATEDB BYPASSRLS`);
      console.log('Created testuser role with CREATEROLE CREATEDB BYPASSRLS.');
    } else {
      await client.query(`ALTER ROLE testuser WITH NOSUPERUSER CREATEROLE CREATEDB BYPASSRLS`);
      console.log('Altered testuser role to NOSUPERUSER CREATEROLE CREATEDB BYPASSRLS.');
      console.log('testuser role already exists.');
    }

    const res2 = await client.query(`SELECT 1 FROM pg_database WHERE datname='peep_test'`);
    if (res2.rowCount === 0) {
      await client.query(`CREATE DATABASE peep_test OWNER testuser`);
      console.log('Created peep_test database.');
    } else {
      console.log('peep_test database already exists.');
    }

  } catch (err) {
    console.error('Error setting up test DB:', err);
  } finally {
    await client.end();
  }
}

setup();
