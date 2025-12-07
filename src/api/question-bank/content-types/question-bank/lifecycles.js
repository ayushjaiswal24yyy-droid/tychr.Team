// src/api/question-bank/content-types/question-bank/lifecycles.js
'use strict';

module.exports = {
  async beforeCreate(event) {
    const { data } = event.params;
    await processContentFormats(data);
  },

  async beforeUpdate(event) {
    const { data } = event.params;
    await processContentFormats(data);
  }
};

async function processContentFormats(data) {
  // Helper to detect format
  const detectFormat = (content) => {
    if (!content || typeof content !== 'string') return 'plain_text';
    
    // Check for HTML tags
    if (content.includes('<li>') || content.includes('<p>') || content.includes('<div>')) {
      return 'html';
    }
    
    // Check for markdown
    if (content.includes('###') || content.includes('**') || content.includes('```')) {
      return 'markdown';
    }
    
    return 'plain_text';
  };

  // Process main question
  if (data.question && typeof data.question === 'string') {
    data.content_format = detectFormat(data.question);
  }

  // Process parts
  if (data.parts && Array.isArray(data.parts)) {
    data.parts = data.parts.map(part => {
      const processedPart = { ...part };
      
      // Auto-detect formats for each field
      if (processedPart.options) {
        processedPart.content_format = detectFormat(processedPart.options);
      }
      
      if (processedPart.question_text) {
        processedPart.content_format = detectFormat(processedPart.question_text);
      }
      
      if (processedPart.correct_answer) {
        processedPart.content_format = detectFormat(processedPart.correct_answer);
      }
      
      return processedPart;
    });
  }
}