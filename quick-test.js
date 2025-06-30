// Quick test of color extraction logic
const testSmi = `<SAMI>
<SYNC Start=1000><P Class=KRCC>
번역&싱크 불법미인(356.BI)<br><font color=FA0237>(http://www.bbmi.kr)</font>
</P>

<SYNC Start=5000><P Class=KRCC>
<font color="red">Hello World</font><br>
<font color="#00FF00">Green text</font>
</P>
</SAMI>`;

console.log('Testing with sample SMI content...');

// Test our regex patterns
const fontColorRegex = /<font[^>]*color\s*=\s*["']?([^"'\s>]+)["']?[^>]*>/gi;
let match;
const colors = [];

console.log('Raw SMI content:');
console.log(testSmi);

console.log('\nSearching for font colors...');
while ((match = fontColorRegex.exec(testSmi)) !== null) {
  console.log('Found color:', match[1]);
  colors.push(match[1]);
}

console.log('\nAll colors found:', colors);
