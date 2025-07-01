const fs = require('fs-extra');
const path = require('path');
const he = require('he');
const iconv = require('iconv-lite');

// Convert SMI format to WebVTT format
const convertSmiToVtt = (smiContent) => {
  try {
    console.log('Converting SMI to VTT, content length:', smiContent.length);
    
    // Helper function to extract and normalize color from font tags
    const extractFontColor = (text) => {
      const fontColorRegex = /<font[^>]*color\s*=\s*["']?([^"'\s>]+)["']?[^>]*>/gi;
      const colors = [];
      const matches = text.matchAll(fontColorRegex);
      
      for (const match of matches) {
        let color = match[1].toLowerCase().trim();
        
        // Normalize color format
        if (color.startsWith('#')) {
          // Already hex format
          if (color.length === 4) {
            // Convert #RGB to #RRGGBB
            color = '#' + color[1] + color[1] + color[2] + color[2] + color[3] + color[3];
          }
        } else if (color.match(/^[a-f0-9]{6}$/i)) {
          // Hex without #
          color = '#' + color;
        } else if (color.match(/^[a-f0-9]{3}$/i)) {
          // Short hex without #
          const r = color[0];
          const g = color[1];
          const b = color[2];
          color = '#' + r + r + g + g + b + b;
        }
        // Keep named colors as-is (red, blue, etc.)
        
        colors.push(color);
      }
      
      return colors;
    };
    
    // Helper function to get CSS class name for a color
    const getColorClassName = (color, colorStyles) => {
      if (!colorStyles.has(color)) {
        const className = `color${colorStyles.size + 1}`;
        colorStyles.set(color, className);
      }
      return colorStyles.get(color);
    };
    
    // Helper function to process text with font color tags
    const processTextWithColors = (text, colorStyles) => {
      let processedText = text;
      
      // Find all font color tags and their content
      const fontRegex = /<font[^>]*color\s*=\s*["']?([^"'\s>]+)["']?[^>]*>(.*?)<\/font>/gi;
      const matches = Array.from(text.matchAll(fontRegex));
      
      // Process matches in reverse order to avoid index issues
      for (let i = matches.length - 1; i >= 0; i--) {
        const match = matches[i];
        const color = match[1].toLowerCase().trim();
        let normalizedColor = color;
        
        // Normalize color format (same logic as above)
        if (normalizedColor.startsWith('#')) {
          if (normalizedColor.length === 4) {
            normalizedColor = '#' + normalizedColor[1] + normalizedColor[1] + normalizedColor[2] + normalizedColor[2] + normalizedColor[3] + normalizedColor[3];
          }
        } else if (normalizedColor.match(/^[a-f0-9]{6}$/i)) {
          normalizedColor = '#' + normalizedColor;
        } else if (normalizedColor.match(/^[a-f0-9]{3}$/i)) {
          const r = normalizedColor[0];
          const g = normalizedColor[1];
          const b = normalizedColor[2];
          normalizedColor = '#' + r + r + g + g + b + b;
        }
        
        const className = getColorClassName(normalizedColor, colorStyles);
        const fontContent = match[2];
        
        // Replace the font tag with WebVTT color markup
        processedText = processedText.replace(match[0], `<c.${className}>${fontContent}</c>`);
      }
      
      return processedText;
    };
    
    // Parse SMI content
    let vttContent = 'WEBVTT\n\n';
    let sequenceNumber = 1;
    let colorStyles = new Map(); // Track unique colors and their CSS classes
    
    // Extract all SYNC tags with their content
    const syncPattern = /<SYNC\s+Start\s*=\s*(\d+)[^>]*>/gi;
    const matches = [];
    let match;
    
    while ((match = syncPattern.exec(smiContent)) !== null) {
      matches.push({
        time: parseInt(match[1]),
        index: match.index + match[0].length
      });
    }
    
    console.log('Found', matches.length, 'SYNC tags');
    
    // Process each sync block
    for (let i = 0; i < matches.length; i++) {
      const currentMatch = matches[i];
      const nextMatch = matches[i + 1];
      
      // Extract content between current and next SYNC tag
      let endIndex;
      if (nextMatch) {
        // Find the actual start of the next SYNC tag
        const nextSyncStart = smiContent.indexOf('<SYNC', currentMatch.index + 1);
        endIndex = nextSyncStart !== -1 ? nextSyncStart : smiContent.length;
      } else {
        endIndex = smiContent.length;
      }
      
      const content = smiContent.substring(currentMatch.index, endIndex);
      console.log(`Processing SYNC block ${i + 1}, content length: ${content.length}`);
      
      // Try multiple patterns to extract text from P tags - be more greedy
      let pTagMatch = content.match(/<P[^>]*?Class\s*=\s*[^>]*?>(.*?)(?:<\/P>|<SYNC|$)/is);
      if (!pTagMatch) {
        // Try simpler pattern
        pTagMatch = content.match(/<P[^>]*?>(.*?)(?:<\/P>|<SYNC|$)/is);
      }
      if (!pTagMatch) {
        // Try even simpler pattern - just look for P tag and grab everything until next tag or end
        pTagMatch = content.match(/<P[^>]*?>(.*?)(?:<[^>]*>|$)/is);
      }
      if (!pTagMatch) {
        // Last resort - grab everything after P tag
        const pIndex = content.search(/<P[^>]*?>/i);
        if (pIndex !== -1) {
          const afterP = content.substring(pIndex);
          const pEndIndex = afterP.search(/<P[^>]*?>/i);
          const textStart = afterP.indexOf('>') + 1;
          const textContent = pEndIndex !== -1 ? 
            afterP.substring(textStart, pEndIndex) : 
            afterP.substring(textStart);
          pTagMatch = [null, textContent];
        }
      }
      
      if (pTagMatch) {
        let text = pTagMatch[1];
        console.log(`Raw extracted text: "${text.substring(0, 100)}..."`);
        console.log(`Raw text contains &:`, text.includes('&'));
        console.log(`Raw text contains <br>:`, text.includes('<br>'));
        console.log(`Raw text character codes:`, text.split('').slice(0, 50).map(c => `${c}(${c.charCodeAt(0)})`).join(' '));
        
        // Process font color tags BEFORE cleaning HTML tags
        text = processTextWithColors(text, colorStyles);
        console.log(`Text after color processing: "${text}"`);
        
        // Clean up the text - handle HTML tags and entities
        text = text.replace(/<br\s*\/?>/gi, '\n'); // Replace <br> tags with line breaks FIRST
        text = text.replace(/<(?!\/?(c\.|\/c))[^>]*>/g, ''); // Remove HTML tags except WebVTT color tags
        text = he.decode(text); // Decode HTML entities
        text = text.replace(/&nbsp;/g, ' '); // Replace &nbsp; with space
        
        // Handle specific SMI line break patterns - be more careful with &
        // Common SMI patterns: &#13;&#10; (CRLF), &#10; (LF), &#13; (CR)
        text = text.replace(/&#13;&#10;/g, '\n'); // CRLF
        text = text.replace(/&#10;/g, '\n'); // LF
        text = text.replace(/&#13;/g, '\n'); // CR
        
        // Only replace standalone & if it's clearly meant as a line break
        text = text.replace(/&\s*$/gm, '\n'); // & at end of line
        text = text.replace(/&\s{2,}/g, '\n'); // & followed by multiple spaces
        text = text.replace(/\r\n/g, '\n'); // Normalize Windows line breaks
        text = text.replace(/\r/g, '\n'); // Normalize old Mac line breaks
        
        // Clean up whitespace around line breaks but preserve the breaks
        text = text.replace(/[ \t]*\n[ \t]*/g, '\n'); // Remove spaces around line breaks
        text = text.replace(/\n{3,}/g, '\n\n'); // Limit to max 2 consecutive line breaks
        text = text.trim();
        
        console.log(`Cleaned text: "${text}"`);
        console.log(`Text contains newlines:`, text.includes('\n'));
        console.log(`Number of newlines:`, (text.match(/\n/g) || []).length);
        
        // Skip empty or meaningless text
        if (text && text !== '&nbsp;' && text.length > 0 && !text.match(/^[\s\u00A0]*$/)) {
          const startTime = formatTime(currentMatch.time);
          const endTime = nextMatch ? formatTime(nextMatch.time) : formatTime(currentMatch.time + 3000);
          
          vttContent += `${sequenceNumber}\n`;
          vttContent += `${startTime} --> ${endTime}\n`;
          vttContent += `${text}\n\n`;
          sequenceNumber++;
          
          console.log(`Added subtitle ${sequenceNumber-1}: "${text}"`);
          console.log(`VTT entry preview: "${startTime} --> ${endTime}\\n${text}"`);
        }
      } else {
        console.log(`No P tag match found in content: "${content.substring(0, 200)}..."`);
      }
    }
    
    console.log('Generated', sequenceNumber - 1, 'subtitle entries');
    console.log('Color styles found:', colorStyles);
    
    // Generate CSS for the colors
    let cssStyles = '';
    for (const [color, className] of colorStyles) {
      cssStyles += `video::cue(.${className}) { color: ${color}; }\n`;
    }
    
    return {
      vtt: vttContent,
      css: cssStyles,
      colors: Object.fromEntries(colorStyles)
    };
  } catch (error) {
    console.error('Error converting SMI to VTT:', error);
    return null;
  }
};

// Convert SRT to WebVTT format
const convertSrtToVtt = (srtContent) => {
  try {
    let vttContent = 'WEBVTT\n\n';
    
    // Replace SRT time format with VTT format
    // SRT: 00:00:01,000 --> 00:00:04,000
    // VTT: 00:00:01.000 --> 00:00:04.000
    const timeRegex = /(\d{2}:\d{2}:\d{2}),(\d{3})/g;
    vttContent += srtContent.replace(timeRegex, '$1.$2');
    
    return vttContent;
  } catch (error) {
    console.error('Error converting SRT to VTT:', error);
    return null;
  }
};

// Format milliseconds to WebVTT time format
const formatTime = (milliseconds) => {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const ms = milliseconds % 1000;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
};

// Detect language from subtitle filename
const detectLanguage = (filename) => {
  const lowerFilename = filename.toLowerCase();
  
  // SMI files are commonly Korean, check extension first
  if (lowerFilename.endsWith('.smi')) {
    return 'ko';
  }
  
  // Common language patterns in filenames
  const languagePatterns = {
    'en': /[\._\-](en|eng|english)[\._\-]/i,
    'ko': /[\._\-](ko|kor|korean|한국어)[\._\-]/i,
    'ja': /[\._\-](ja|jp|jpn|japanese|日本語)[\._\-]/i,
    'zh': /[\._\-](zh|cn|chi|chinese|中文)[\._\-]/i,
    'es': /[\._\-](es|spa|spanish|español)[\._\-]/i,
    'fr': /[\._\-](fr|fra|french|français)[\._\-]/i,
    'de': /[\._\-](de|ger|german|deutsch)[\._\-]/i,
    'it': /[\._\-](it|ita|italian|italiano)[\._\-]/i,
    'pt': /[\._\-](pt|por|portuguese|português)[\._\-]/i,
    'ru': /[\._\-](ru|rus|russian|русский)[\._\-]/i
  };
  
  for (const [code, pattern] of Object.entries(languagePatterns)) {
    if (pattern.test(lowerFilename)) {
      return code;
    }
  }
  
  // Default to 'en' if no language detected
  return 'en';
};

// Get language label from code
const getLanguageLabel = (code) => {
  const labels = {
    'en': 'English',
    'ko': '한국어',
    'ja': '日本語',
    'zh': '中文',
    'es': 'Español',
    'fr': 'Français',
    'de': 'Deutsch',
    'it': 'Italiano',
    'pt': 'Português',
    'ru': 'Русский'
  };
  
  return labels[code] || 'Unknown';
};

// Find subtitle files for a video
const findSubtitleFiles = async (videoPath, videosDir) => {
  try {
    const videoBaseName = path.parse(videoPath).name;
    const subtitleExtensions = ['.srt', '.vtt', '.smi', '.sami'];
    const subtitleFiles = [];
    
    // Check if videosDir exists
    if (!(await fs.pathExists(videosDir))) {
      return subtitleFiles;
    }
    
    const files = await fs.readdir(videosDir);
    
    for (const file of files) {
      const filePath = path.join(videosDir, file);
      const fileExt = path.extname(file).toLowerCase();
      const fileName = path.parse(file).name;
      
      // Check if this subtitle file matches the video (same base name, different extension)
      if (subtitleExtensions.includes(fileExt) && fileName.startsWith(videoBaseName)) {
        const language = detectLanguage(file);
        const label = getLanguageLabel(language);
        
        subtitleFiles.push({
          filename: file,
          path: filePath,
          extension: fileExt,
          language: language,
          label: label,
          url: `/api/subtitles/${encodeURIComponent(file)}`
        });
      }
    }
    
    return subtitleFiles;
  } catch (error) {
    console.error('Error finding subtitle files:', error);
    return [];
  }
};

// Convert subtitle file to WebVTT format
const convertSubtitleToVtt = async (subtitlePath) => {
  try {
    let content;
    const extension = path.extname(subtitlePath).toLowerCase();
    
    // For SMI files, try different encodings since they're often in EUC-KR or CP949
    if (extension === '.smi' || extension === '.sami') {
      try {
        const buffer = await fs.readFile(subtitlePath);
        
        // Try different encodings in order of preference for Korean SMI files
        const encodings = ['euc-kr', 'cp949', 'utf-8', 'utf-16le'];
        
        let bestContent = null;
        let bestScore = 0;
        
        for (const encoding of encodings) {
          try {
            let testContent;
            if (encoding === 'utf-8') {
              testContent = buffer.toString('utf-8');
            } else if (iconv.encodingExists(encoding)) {
              testContent = iconv.decode(buffer, encoding);
            } else {
              continue;
            }
            
            // Score the content quality
            let score = 0;
            
            // Check for Korean characters (높은 점수)
            const koreanChars = (testContent.match(/[가-힣]/g) || []).length;
            score += koreanChars * 10;
            
            // Check for SMI structure (기본 점수)
            if (testContent.includes('<SAMI>')) score += 50;
            if (testContent.includes('<SYNC')) score += 30;
            if (testContent.includes('<P')) score += 20;
            
            // Penalize for replacement characters
            const replacementChars = (testContent.match(/�/g) || []).length;
            score -= replacementChars * 50;
            
            // Penalize for obviously garbled text patterns
            const garbledPatterns = /[¿À-ÿ]{3,}/g;
            const garbledMatches = (testContent.match(garbledPatterns) || []).length;
            score -= garbledMatches * 20;
            
            console.log(`Encoding ${encoding} score: ${score}, Korean chars: ${koreanChars}, replacement chars: ${replacementChars}`);
            
            if (score > bestScore) {
              bestScore = score;
              bestContent = testContent;
              console.log(`New best encoding: ${encoding} with score ${score}`);
            }
          } catch (err) {
            console.log(`Failed to decode with ${encoding}:`, err.message);
          }
        }
        
        if (bestContent) {
          content = bestContent;
          console.log(`Using best content with score ${bestScore}`);
        } else {
          // Fallback to UTF-8
          content = buffer.toString('utf-8');
          console.log('No good encoding found, falling back to UTF-8');
        }
      } catch (err) {
        console.error('Error reading SMI file:', err);
        // Final fallback
        const buffer = await fs.readFile(subtitlePath);
        content = buffer.toString('utf-8');
      }
    } else {
      // For other formats, use UTF-8
      content = await fs.readFile(subtitlePath, 'utf-8');
    }
    
    console.log('File content preview (first 300 chars):', content.substring(0, 300));
    
    switch (extension) {
      case '.smi':
      case '.sami':
        const smiResult = convertSmiToVtt(content);
        if (smiResult && typeof smiResult === 'object') {
          return {
            vtt: smiResult.vtt,
            css: smiResult.css,
            colors: smiResult.colors
          };
        }
        return smiResult;
      case '.srt':
        const srtVtt = convertSrtToVtt(content);
        return {
          vtt: srtVtt,
          css: '',
          colors: {}
        };
      case '.vtt':
        return {
          vtt: content,
          css: '',
          colors: {}
        }; // Already in VTT format
      default:
        console.warn(`Unsupported subtitle format: ${extension}`);
        return null;
    }
  } catch (error) {
    console.error('Error converting subtitle file:', error);
    return null;
  }
};

module.exports = {
  convertSmiToVtt,
  convertSrtToVtt,
  detectLanguage,
  getLanguageLabel,
  findSubtitleFiles,
  convertSubtitleToVtt
};
