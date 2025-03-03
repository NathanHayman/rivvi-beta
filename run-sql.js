// run-sql.js
import { env } from '@/env';
import { readFileSync } from 'fs';
import postgres from 'postgres';

// Check if a file path was provided
if (process.argv.length < 3) {
    console.error('Please provide a path to the SQL file');
    process.exit(1);
}

const sqlFilePath = process.argv[2];

async function runSqlFile() {
    try {
        // Read the SQL file
        const sqlContent = readFileSync(sqlFilePath, 'utf8');
        console.log(`Running SQL from file: ${sqlFilePath}`);

        // Connect to the database
        const conn = postgres(env.DATABASE_URL);

        // Execute the SQL
        await conn.unsafe(sqlContent);

        console.log('SQL executed successfully');

        // Close the connection
        await conn.end();
    } catch (error) {
        console.error('Error executing SQL:', error);
        process.exit(1);
    }
}

runSqlFile(); 