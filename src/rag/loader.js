import { promises as fs } from 'fs';
import { join } from 'path';
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { Document } from '@langchain/core/documents';
import { parseWhatsAppChat } from './chatParser.js';
import config from '../config.js';
import logger from '../utils/logger.js';

/**
 * Load markdown files from documents folder
 */
async function loadMarkdownDocuments(docsFolder) {
    const files = await fs.readdir(docsFolder);
    const mdFiles = files.filter(f => f.toLowerCase().endsWith('.md'));

    if (mdFiles.length === 0) {
        return [];
    }

    logger.info(`Found ${mdFiles.length} Markdown files to load`);
    const documents = [];

    for (const mdFile of mdFiles) {
        const filePath = join(docsFolder, mdFile);

        try {
            logger.info(`Loading: ${mdFile}`);
            const content = await fs.readFile(filePath, 'utf-8');

            const doc = new Document({
                pageContent: content,
                metadata: {
                    source: mdFile,
                    fileName: mdFile,
                    type: 'markdown'
                }
            });

            documents.push(doc);
            logger.info(`  ✓ Loaded ${mdFile}`);

        } catch (error) {
            logger.error(`  ✗ Failed to load ${mdFile}:`, error.message);
        }
    }

    return documents;
}

/**
 * Load all PDF files from the documents folder
 */
export async function loadPDFDocuments() {
    const docsFolder = config.rag.docsFolder;

    // Check if folder exists
    try {
        await fs.access(docsFolder);
    } catch {
        logger.warn(`Documents folder not found: ${docsFolder}`);
        await fs.mkdir(docsFolder, { recursive: true });
        logger.info(`Created documents folder: ${docsFolder}`);
        return [];
    }

    // Get all PDF files
    const files = await fs.readdir(docsFolder);
    const pdfFiles = files.filter(f => f.toLowerCase().endsWith('.pdf'));

    if (pdfFiles.length === 0) {
        logger.info('No PDF files found in documents folder');
    } else {
        logger.info(`Found ${pdfFiles.length} PDF files to load`);
    }

    const allDocuments = [];

    // Load each PDF
    for (const pdfFile of pdfFiles) {
        const filePath = join(docsFolder, pdfFile);

        try {
            logger.info(`Loading: ${pdfFile}`);
            const loader = new PDFLoader(filePath, {
                splitPages: true,
            });

            const docs = await loader.load();

            // Add source metadata
            docs.forEach(doc => {
                doc.metadata.source = pdfFile;
                doc.metadata.fileName = pdfFile;
                doc.metadata.type = 'pdf';
            });

            allDocuments.push(...docs);
            logger.info(`  ✓ Loaded ${docs.length} pages from ${pdfFile}`);

        } catch (error) {
            logger.error(`  ✗ Failed to load ${pdfFile}:`, error.message);
        }
    }

    return allDocuments;
}

/**
 * Load chat history from .txt files
 */
async function loadChatDocuments(docsFolder) {
    const files = await fs.readdir(docsFolder);
    const txtFiles = files.filter(f => f.toLowerCase().endsWith('.txt'));

    if (txtFiles.length === 0) {
        return [];
    }

    logger.info(`Found ${txtFiles.length} Chat History files to load`);
    const documents = [];

    for (const txtFile of txtFiles) {
        const filePath = join(docsFolder, txtFile);

        try {
            logger.info(`Loading chat: ${txtFile}`);
            const content = await fs.readFile(filePath, 'utf-8');

            const docs = parseWhatsAppChat(content, txtFile);
            documents.push(...docs);

            if (docs.length > 0) {
                logger.info(`  ✓ Parsed ${docs.length} pairs from ${txtFile}`);
            }

        } catch (error) {
            logger.error(`  ✗ Failed to load ${txtFile}:`, error.message);
        }
    }

    return documents;
}

/**
 * Load all documents (PDF + Markdown + Chat)
 */
export async function loadAllDocuments() {
    const docsFolder = config.rag.docsFolder;

    // Check if folder exists
    try {
        await fs.access(docsFolder);
    } catch {
        logger.warn(`Documents folder not found: ${docsFolder}`);
        await fs.mkdir(docsFolder, { recursive: true });
        logger.info(`Created documents folder: ${docsFolder}`);
        return [];
    }

    // Load all document types
    // Load all document types
    const pdfDocs = await loadPDFDocuments();
    const mdDocs = await loadMarkdownDocuments(docsFolder);
    const chatDocs = await loadChatDocuments(docsFolder);

    const allDocs = [...pdfDocs, ...mdDocs, ...chatDocs];
    logger.info(`Total documents loaded: ${allDocs.length}`);

    return allDocs;
}

/**
 * Split documents into chunks for embedding
 */
export async function splitDocuments(documents) {
    if (!documents || documents.length === 0) {
        return [];
    }

    const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: config.rag.chunkSize,
        chunkOverlap: config.rag.chunkOverlap,
        separators: ['\n\n', '\n', '. ', ' ', ''],
    });

    logger.info('Splitting documents into chunks...');
    const chunks = await splitter.splitDocuments(documents);
    logger.info(`Created ${chunks.length} chunks`);

    return chunks;
}

/**
 * Load and split all documents (now includes markdown)
 */
export async function loadAndSplitDocuments() {
    const documents = await loadAllDocuments();
    const chunks = await splitDocuments(documents);
    return chunks;
}

/**
 * Get list of all files in the documents folder with metadata
 */
export async function getIngestedFilesList() {
    const docsFolder = config.rag.docsFolder;
    const files = [];

    try {
        const dirFiles = await fs.readdir(docsFolder);

        for (const file of dirFiles) {
            const ext = file.toLowerCase().split('.').pop();
            if (['pdf', 'md', 'txt'].includes(ext)) {
                const filePath = join(docsFolder, file);
                const stats = await fs.stat(filePath);

                files.push({
                    name: file,
                    type: ext === 'txt' ? 'chat-history' : ext,
                    size: stats.size,
                    modified: stats.mtime.toISOString()
                });
            }
        }
    } catch (error) {
        logger.error('Failed to list ingested files:', error.message);
    }

    return files;
}

export default { loadPDFDocuments, loadAllDocuments, splitDocuments, loadAndSplitDocuments, getIngestedFilesList };
