import * as dotenv from 'dotenv';
dotenv.config();

async function main() {
    console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'DEFINED' : 'UNDEFINED');
    console.log('Script iniciado...');
}

main().catch(console.error);
