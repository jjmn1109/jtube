const { convertSubtitleToVtt } = require('./server/subtitleUtils');
const fs = require('fs');

async function testEncodingDetection() {
  try {
    // Create a test SMI file with Korean text in EUC-KR encoding
    const koreanText = `<SAMI>
<HEAD>
<TITLE>Test</TITLE>
</HEAD>
<BODY>
<SYNC Start=1000><P>드래곤볼 카이</P>
<SYNC Start=3000><P>한국어 자막 테스트</P>
</BODY>
</SAMI>`;

    // Write the test file
    fs.writeFileSync('test-korean.smi', koreanText, 'utf-8');
    
    console.log('Testing encoding detection...');
    const result = await convertSubtitleToVtt('test-korean.smi');
    
    if (result && result.vtt) {
      console.log('VTT output:');
      console.log(result.vtt);
    } else {
      console.log('No result returned');
    }
    
    // Clean up
    fs.unlinkSync('test-korean.smi');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testEncodingDetection();
