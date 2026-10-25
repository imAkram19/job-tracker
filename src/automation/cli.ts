import readline from 'readline';
import jobsData from '../data/jobs.json';
import { JobItem } from '../types/job';
import { AutomationSession } from './runner';

async function main() {
  const args = process.argv.slice(2);
  let targetJobId = args[0];

  // Parse --job=X or --jobId=X
  for (const arg of args) {
    if (arg.startsWith('--job=')) targetJobId = arg.split('=')[1];
    if (arg.startsWith('--jobId=')) targetJobId = arg.split('=')[1];
  }

  const jobs = jobsData as JobItem[];

  if (!targetJobId) {
    console.log('\n=== Job Application Automation (Playwright) ===');
    console.log('Usage: npm run apply -- <jobId>');
    console.log('Example: npm run apply -- 7\n');
    console.log('Sample available jobs:');
    jobs.slice(0, 10).forEach((j) => {
      console.log(`  [${j.id}] ${j.company} - ${j.title} (${j.applyUrl.slice(0, 50)}...)`);
    });
    process.exit(1);
  }

  const job = jobs.find((j) => String(j.id) === String(targetJobId));
  if (!job) {
    console.error(`Error: Job ID "${targetJobId}" not found in jobs.json`);
    process.exit(1);
  }

  console.log(`\n======================================================`);
  console.log(` TARGET JOB: #${job.rank || job.id} - ${job.company}`);
  console.log(` ROLE:       ${job.title}`);
  console.log(` URL:        ${job.applyUrl}`);
  console.log(` AUTO_SUBMIT: false (Will pause at final review)`);
  console.log(`======================================================\n`);

  const session = new AutomationSession(job);

  // Setup CLI event logging
  session.stateManager.on('log', (log) => {
    const symbol =
      log.level === 'error' ? '❌' : log.level === 'warn' ? '⚠️' : log.level === 'success' ? '✅' : 'ℹ️';
    console.log(`${symbol} [${log.level.toUpperCase()}] ${log.message}`);
  });

  // Setup CLI human question prompt
  session.stateManager.on('humanQuestionRequired', (req) => {
    console.log('\n------------------------------------------------------');
    console.log('🚨 HUMAN INPUT REQUIRED');
    console.log(`Question: "${req.question}"`);
    if (req.options && req.options.length > 0) {
      console.log(`Options:`);
      req.options.forEach((opt: string, idx: number) => console.log(`  [${idx + 1}] ${opt}`));
    }
    console.log('------------------------------------------------------');

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question('Enter your answer (or type "skip" to skip this question): ', (answer) => {
      rl.close();
      const trimmed = answer.trim();
      if (trimmed.toLowerCase() === 'skip') {
        session.humanManager.resolvePrompt({ action: 'SKIP_FIELD' });
      } else {
        session.humanManager.resolvePrompt({ action: 'CONTINUE', answer: trimmed, rememberAnswer: true });
      }
    });
  });

  // Run session
  const success = await session.run({ headless: false, autoClose: false });

  if (success) {
    console.log('\n🎉 Application automation completed successfully!');
    console.log('Current page scan finished. Check the browser for missing answers or further steps.\n');
  } else {
    console.log('\n⚠️ Application automation paused or ended without completion.\n');
  }
}

main().catch((err) => {
  console.error('Fatal CLI Error:', err);
  process.exit(1);
});
