import { execSync } from 'node:child_process';

export default function globalSetup() {
	execSync('bash e2e/gen-fixtures.sh', { stdio: 'inherit' });
}
