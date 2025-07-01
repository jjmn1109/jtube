const { convertSubtitleToVtt } = require('./server/subtitleUtils');

async function testSubtitleParsing() {
  try {
    // Test with the local SMI file
    console.log('Testing subtitle parsing with test-colors.smi...');
    const result = await convertSubtitleToVtt('./server/test-colors.smi');
    
    if (result && result.vtt) {
      console.log('=== VTT OUTPUT ===');
      console.log(result.vtt);
      console.log('=== END OUTPUT ===');
      console.log('VTT length:', result.vtt.length);
    } else {
      console.log('No result returned');
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testSubtitleParsing();
