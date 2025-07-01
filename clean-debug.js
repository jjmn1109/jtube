const fs = require('fs');

// Read the file
const content = fs.readFileSync('./server/subtitleUtils.js', 'utf8');

// Remove debug console.log statements while preserving structure
let cleanedContent = content
  // Remove specific debug lines
  .replace(/\s*console\.log\('Converting SMI to VTT, content length:', smiContent\.length\);\s*/g, '')
  .replace(/\s*console\.log\('Found', matches\.length, 'SYNC tags'\);\s*/g, '')
  .replace(/\s*console\.log\(`Processing SYNC block \$\{i \+ 1\}, content length: \$\{content\.length\}`\);\s*/g, '')
  .replace(/\s*console\.log\(`Raw extracted text: "\$\{text\.substring\(0, 100\)\}\.\.\."`\);\s*/g, '')
  .replace(/\s*console\.log\(`Raw text contains &:`, text\.includes\('&'\)\);\s*/g, '')
  .replace(/\s*console\.log\(`Raw text contains <br>:`, text\.includes\('<br>'\)\);\s*/g, '')
  .replace(/\s*console\.log\(`Raw text character codes:`, text\.split\(''\)\.slice\(0, 50\)\.map\(c => `\$\{c\}\(\$\{c\.charCodeAt\(0\)\}\)`\)\.join\(' '\)\);\s*/g, '')
  .replace(/\s*console\.log\(`Text after color processing: "\$\{text\}"`\);\s*/g, '')
  .replace(/\s*console\.log\(`Cleaned text: "\$\{text\}"`\);\s*/g, '')
  .replace(/\s*console\.log\(`Text contains newlines:`, text\.includes\('\\n'\)\);\s*/g, '')
  .replace(/\s*console\.log\(`Number of newlines:`, \(text\.match\(/\\n/g\) \|\| \[\]\)\.length\);\s*/g, '')
  .replace(/\s*console\.log\(`Added subtitle \$\{sequenceNumber-1\}: "\$\{text\}"`\);\s*/g, '')
  .replace(/\s*console\.log\(`VTT entry preview: "\$\{startTime\} --> \$\{endTime\}\\\\n\$\{text\}"`\);\s*/g, '')
  .replace(/\s*console\.log\(`No P tag match found in content: "\$\{content\.substring\(0, 200\)\}\.\.\."`\);\s*/g, '')
  .replace(/\s*console\.log\('Generated', sequenceNumber - 1, 'subtitle entries'\);\s*/g, '')
  .replace(/\s*console\.log\('Color styles found:', colorStyles\);\s*/g, '');

// Write the cleaned content back
fs.writeFileSync('./server/subtitleUtils.js', cleanedContent, 'utf8');

console.log('Removed debug statements from subtitleUtils.js');
