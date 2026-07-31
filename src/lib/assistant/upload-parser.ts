import pdf from 'pdf-parse';
import { Storage } from 'appwrite';

/**
 * Parse uploaded PDF file to extract text
 */
export async function parsePDF(fileBuffer: Buffer): Promise<string> {
  try {
    const data = await pdf(fileBuffer);
    return data.text;
  } catch (error) {
    console.error('Failed to parse PDF:', error);
    throw new Error('Could not extract text from PDF');
  }
}

/**
 * Analyze uploaded image with vision AI (placeholder for future)
 */
export async function analyzeImage(imageBuffer: Buffer, format: string): Promise<string> {
  // This would call a vision model like Claude's vision capability
  // For MVP, we can store the image and reference it
  // Return a placeholder that tells user to describe the image
  return `Image uploaded (${format}). Please describe the problem or question in the image.`;
}

/**
 * Store uploaded file in Appwrite Storage
 */
export async function storeUploadedFile(
  fileBuffer: Buffer,
  fileName: string,
  userId: string
): Promise<string> {
  const storage = new Storage(
    new (await import('appwrite')).Client()
      .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || '')
      .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || '')
  );

  try {
    // Note: In production, use Appwrite Admin SDK with API key
    // For now, this is a placeholder
    const fileId = `${userId}-${Date.now()}-${fileName}`;
    console.log('Would store file:', fileId);
    return fileId;
  } catch (error) {
    console.error('Failed to store file:', error);
    throw new Error('Could not upload file');
  }
}

/**
 * Process uploaded file - extract content and store reference
 */
export async function processUploadedFile(
  file: File,
  userId: string
): Promise<{ fileId: string; content: string; type: 'pdf' | 'image' }> {
  const buffer = await file.arrayBuffer();
  const uint8Array = new Uint8Array(buffer);

  // Determine file type
  if (file.type === 'application/pdf') {
    const nodeBuffer = Buffer.from(uint8Array.buffer, uint8Array.byteOffset, uint8Array.byteLength);
    const content = await parsePDF(nodeBuffer);
    const fileId = await storeUploadedFile(nodeBuffer, file.name, userId);
    return { fileId, content, type: 'pdf' };
  }

  // Image file
  if (file.type.startsWith('image/')) {
    const format = file.type.split('/')[1];
    const nodeBuffer = Buffer.from(uint8Array.buffer, uint8Array.byteOffset, uint8Array.byteLength);
    const description = await analyzeImage(nodeBuffer, format);
    const fileId = await storeUploadedFile(nodeBuffer, file.name, userId);
    return { fileId, content: description, type: 'image' };
  }

  throw new Error('Unsupported file type. Please upload PDF or image.');
}

/**
 * Format uploaded content for assistant context
 */
export function formatUploadedContent(fileType: 'pdf' | 'image', content: string): string {
  if (fileType === 'pdf') {
    return `PDF Content:\n${content}`;
  } else {
    return `Image Description:\n${content}`;
  }
}

/**
 * Extract key information from uploaded problem
 */
export async function extractProblemDetails(
  fileType: 'pdf' | 'image',
  content: string
): Promise<{ subject: string; difficulty: string; keyTerms: string[] }> {
  // TODO: Use AI to analyze and extract structured problem info
  // For MVP, return placeholder
  return {
    subject: 'Unknown',
    difficulty: 'medium',
    keyTerms: [],
  };
}

