import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log("\x1b[36m? Please select your preferred framework:\x1b[0m");
console.log("\x1b[7m\x1b[32m❯ 1. React (A JavaScript library for building user interfaces)\x1b[0m");
console.log("  2. Vue.js (The Progressive JavaScript Framework)");
console.log("  3. Svelte (Cybernetically enhanced web apps)");

// Keep alive for 30 seconds to allow observation
setTimeout(() => {
  process.exit(0);
}, 30000);
