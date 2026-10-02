const fs = require('fs');
const transcript = fs.readFileSync('C:/Users/Administrator/.gemini/antigravity-ide/brain/ab493573-ecc1-4ff8-a185-d5c0fe6825ba/.system_generated/logs/transcript_full.jsonl', 'utf8');

const regex = /.{0,500}P10.{0,2000}/g;
let m;
let count = 0;
while ((m = regex.exec(transcript)) !== null) {
    console.log("MATCH:");
    console.log(m[0]);
    count++;
    if(count > 5) break;
}
