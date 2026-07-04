import fs from 'fs';
import readline from 'readline';

async function main() {
  const fileStream = fs.createReadStream('C:/Users/lenovo/.gemini/antigravity-ide/brain/7749d55a-d813-4d77-8c3b-aa09426d011f/.system_generated/logs/transcript.jsonl');
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    const data = JSON.parse(line);
    if (data.step_index === 70) {
      console.log('Step 70 tool call:', JSON.stringify(data.tool_calls, null, 2));
      console.log('Step 70 content:', data.content);
    }
  }
}

main();
