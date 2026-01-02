import express from 'express';
import dotenv from 'dotenv';
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { OpenAIEmbeddings } from '@langchain/openai';
import { FaissStore } from '@langchain/community/vectorstores/faiss';
import { ChatOpenAI } from '@langchain/openai';
import { RetrievalQAChain } from 'langchain/chains';
import { PromptTemplate } from '@langchain/core/prompts';

// Load environment variables
dotenv.config({ override: true });

// Get OpenAI API credentials from environment variables
const openaiApiKey = process.env. OPENAI_API_KEY;
const openaiApiBase = process.env.OPENAI_API_BASE || 'https://api.openai.com/v1';
const openaiApiModelName = process.env.OPENAI_API_MODEL_NAME || 'gpt-4o';

if (!openaiApiKey) {
  throw new Error('Please add your OpenAI API key to the . env file.');
}

// Initialize Express app
const app = express();
app.use(express.json());

const PDF_PATH = 'CCLSpring2025.pdf';

// Global variables for caching
let _vectorStore = null;
let _qaChain = null;

/**
 * Clear the PDF processing cache to force reinitialization
 */
function clearPdfCache() {
  _vectorStore = null;
  _qaChain = null;
}

/**
 * Initialize the PDF processing pipeline using LangChain
 * This includes loading, chunking, embedding, and setting up the retrieval chain
 */
async function initializePdfProcessing() {
  if (_vectorStore === null || _qaChain === null) {
    console.log('Initializing PDF processing...');

    // Load PDF using LangChain
    const loader = new PDFLoader(PDF_PATH);
    const documents = await loader.load();
    console.log(`Loaded ${documents.length} pages from PDF`);

    // Split documents into chunks with better parameters for section-based retrieval
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 800, // Slightly smaller chunks for better precision
      chunkOverlap:  150, // More overlap to ensure sections aren't split
      separators: ['\n\n', '\n', '. ', ' ', ''], // Better separators to preserve sentences
    });
    const texts = await textSplitter.splitDocuments(documents);
    console.log(`Split into ${texts.length} chunks`);

    // Create embeddings (using OpenAI instead of HuggingFace)
    const embeddings = new OpenAIEmbeddings({
      openAIApiKey:  openaiApiKey,
      modelName: 'text-embedding-3-small', // OpenAI's latest embedding model
    });

    // Create vector store
    _vectorStore = await FaissStore.fromDocuments(texts, embeddings);
    console.log('Vector store created');

    // Create LLM
    const llm = new ChatOpenAI({
      openAIApiKey: openaiApiKey,
      configuration: {
        baseURL: openaiApiBase,
      },
      modelName: openaiApiModelName,
      temperature: 0,
    });

    // Custom prompt template
    const promptTemplate = `Use the following pieces of context to answer the question at the end. 
If you don't know the answer, just say that you don't know, don't try to make up an answer. 
Pay special attention to section numbers and specific requirements mentioned in the context.

{context}

Question: {question}
Answer:`;

    const prompt = PromptTemplate.fromTemplate(promptTemplate);

    // Create QA chain with better retrieval settings
    _qaChain = RetrievalQAChain. fromLLM(
      llm,
      _vectorStore.asRetriever({ k: 5 }), // Retrieve more docs
      {
        prompt,
        returnSourceDocuments: true,
      }
    );

    console.log('QA chain created');
  }

  return {
    vectorStore: _vectorStore,
    qaChain: _qaChain,
  };
}

/**
 * Query the PDF using LangChain's retrieval QA chain
 */
async function queryPdfWithLangchain(question) {
  const { qaChain } = await initializePdfProcessing();

  // Get answer from the QA chain
  const result = await qaChain.call({ query: question });

  // Extract relevant information
  const answer = result.text;
  const sourceDocs = result.sourceDocuments || [];

  // Prepare context from source documents
  const context = sourceDocs.map((doc) => doc.pageContent).join(' ');

  return {
    answer,
    context,
    sourcePages: sourceDocs.map((doc) => doc.metadata.page ??  'Unknown'),
  };
}

/**
 * POST /query-openai
 * Endpoint to query OpenAI with a given prompt using LangChain
 */
app.post('/query-openai', async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    // Use LangChain ChatOpenAI
    const llm = new ChatOpenAI({
      openAIApiKey: openaiApiKey,
      configuration: {
        baseURL: openaiApiBase,
      },
      modelName: openaiApiModelName,
      temperature: 0,
    });

    // Call LangChain ChatOpenAI
    const response = await llm.invoke(prompt);

    // Extract the AI-generated content
    const aiResponse = response.content;

    return res.json({ response: aiResponse });
  } catch (error) {
    console.error('Error querying OpenAI:', error);
    return res.status(500).json({
      error: `Error querying OpenAI: ${error.message}`,
    });
  }
});

/**
 * POST /ask-question
 * Endpoint to answer a question based on the PDF content using LangChain
 */
app.post('/ask-question', async (req, res) => {
  try {
    const { question } = req.body;

    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }

    // Use LangChain to query the PDF
    const result = await queryPdfWithLangchain(question);

    return res.json({
      answer: result.answer,
      context_used: result.context,
      source_pages: result.sourcePages,
    });
  } catch (error) {
    console.error('Error processing question:', error);
    return res.status(500).json({
      error: `Error processing question: ${error.message}`,
    });
  }
});

/**
 * POST /ask-multiple-questions
 * Endpoint to ask multiple predefined questions and use LangChain to generate a structured response
 */
app.post('/ask-multiple-questions', async (req, res) => {
  try {
    // List of predefined questions
    const questions = [
      'What date does registration open?',
      'What date does registration close?',
      'When is the schedule released?',
      "List off all the events in the section 'schedule:  '",
      'What time of day are rounds scheduled for the regular season for group A teams?  Please list off only the time in PT.',
    ];

    // Collect answers for each question
    const combinedAnswers = [];
    for (const question of questions) {
      const result = await queryPdfWithLangchain(question);
      combinedAnswers.push(`Q:  ${question}\nA: ${result.answer}\n`);
    }

    // Combine all answers into a single chunk of text
    const finalResponse = combinedAnswers.join('\n');

    // Use LangChain ChatOpenAI to generate the structured response
    const llm = new ChatOpenAI({
      openAIApiKey: openaiApiKey,
      configuration: {
        baseURL: openaiApiBase,
      },
      modelName: openaiApiModelName,
      temperature: 0,
    });

    const systemPrompt = `You are a helpful assistant.  Based on the following context, generate a structured JSON object. 
The JSON object should contain:
1. A "logistics" section with "registration_open", "registration_close", and "schedule_release" fields, each having a "title" and "date". 
2. A "regular_season" section with a list of events, each having "title" and "date" fields.
3. Dates should be formatted as "YYYY-MM-DD HH:MM AM/PM PT".
4. Include all events mentioned in the context, separating logistics and regular season rounds.

Context:
${finalResponse}

The output must be a valid JSON object like this:
{
    "logistics": [
        {"title": "Registration Opens", "date": "2025-01-01 12:00 AM PT"},
        {"title": "Registration Closes", "date": "2025-03-01 11:59 PM PT"},
        {"title": "Schedule Release", "date": "2025-03-05 12:00 AM PT"}
    ],
    "regular_season":  [
        {"title": "Regular Season Round 1", "date": "2025-03-10 10:00 AM PT"},
        {"title": "Regular Season Round 2", "date": "2025-03-17 02:00 PM PT"}
    ]
}`;

    // Call LangChain ChatOpenAI
    const response = await llm.invoke(systemPrompt);

    // Extract the AI-generated structured response
    const structuredResponse = JSON.parse(response.content);

    // Return the structured response
    return res.json(structuredResponse);
  } catch (error) {
    console.error('Error processing multiple questions:', error);
    return res.status(500).json({
      error: `Error processing multiple questions: ${error.message}`,
    });
  }
});

/**
 * POST /get-final-rounds
 * Endpoint to get the dates for final rounds based on division
 */
app.post('/get-final-rounds', async (req, res) => {
  try {
    const { is_division_1 } = req.body;

    if (typeof is_division_1 !== 'boolean') {
      return res.status(400).json({
        error: 'is_division_1 (boolean) is required',
      });
    }

    // Define division-specific questions
    const question = is_division_1
      ? 'What are the dates of the 3 rounds:  Quarterfinals, Semifinals, Final and 3rd Place Match.  There may be multiple schedules; please provide the first schedule.'
      : 'List off the dates for the final rounds; round 1, quarterfinal, semifinal, final/3rd place';

    // Call the queryPdfWithLangchain function
    const result = await queryPdfWithLangchain(question);

    // Use LangChain ChatOpenAI to generate the structured response
    const llm = new ChatOpenAI({
      openAIApiKey: openaiApiKey,
      configuration: {
        baseURL: openaiApiBase,
      },
      modelName:  openaiApiModelName,
      temperature: 0,
    });

    const systemPrompt = is_division_1
      ? `You are a helpful assistant. Based on the following context, generate a structured JSON object for Division 1 final rounds. 
The JSON object should contain:
1. A "playoff_rounds" section with a list of events, each having "title" and "date" fields.
2. Dates should be formatted as "YYYY-MM-DD HH:MM AM/PM PT".
3. For Division 1, the rounds are: Quarterfinals, Semifinals, 3rd Place/Final. 

Context:
${result.answer}

The output must be a valid JSON object like this:
{
    "division":  1,
    "playoff_rounds": [
        {"title": "Quarterfinals", "date":  "2025-11-16 11:00 AM PT"},
        {"title": "Semifinals", "date": "2025-11-23 11:00 AM PT"},
        {"title": "3rd Place/Final", "date": "2025-11-24 11:00 AM PT"}
    ]
}`
      : `You are a helpful assistant. Based on the following context, generate a structured JSON object for Division 2 and below final rounds.
The JSON object should contain:
1. A "playoff_rounds" section with a list of events, each having "title" and "date" fields.
2. Dates should be formatted as "YYYY-MM-DD HH:MM AM/PM PT".
3. For Division 2 and below, the rounds are: Round 1, Quarterfinal, Semifinal, Final/3rd Place.

Context:
${result.answer}

The output must be a valid JSON object like this:
{
    "division": "2+",
    "playoff_rounds":  [
        {"title": "Round 1", "date": "2025-03-24 11:00 AM PT"},
        {"title": "Quarterfinal", "date": "2025-03-31 11:00 AM PT"},
        {"title": "Semifinal", "date": "2025-04-07 11:00 AM PT"},
        {"title": "Final/3rd Place", "date": "2025-04-14 11:00 AM PT"}
    ]
}`;

    // Call LangChain ChatOpenAI
    const aiResponse = await llm.invoke(systemPrompt);

    // Extract the AI-generated structured response
    const structuredResponse = JSON.parse(aiResponse.content);

    // Return the structured response
    return res.json(structuredResponse);
  } catch (error) {
    console.error('Error processing final rounds:', error);
    return res.status(500).json({
      error: `Error processing final rounds: ${error.message}`,
    });
  }
});

/**
 * POST /get-player-requirements
 * Endpoint to retrieve player requirements for the tournament
 */
app.post('/get-player-requirements', async (req, res) => {
  try {
    // Initialize the PDF processing
    const { vectorStore } = await initializePdfProcessing();

    // Get more context by retrieving more documents
    const retriever = vectorStore.asRetriever({ k: 8 });

    // Search for documents containing player eligibility requirements
    const eligibilityDocs = await retriever.getRelevantDocuments(
      'player eligibility requirements minimum account age blitz games section 5. 4'
    );

    // Combine context from all relevant documents
    const combinedContext = eligibilityDocs
      .map((doc) => doc.pageContent)
      .join(' ');

    // Use LangChain ChatOpenAI to extract numeric values with better prompting
    const llm = new ChatOpenAI({
      openAIApiKey: openaiApiKey,
      configuration: {
        baseURL: openaiApiBase,
      },
      modelName:  openaiApiModelName,
      temperature: 0,
    });

    const extractionPrompt = `You are a helpful assistant. Based on the following context from a tournament rules document, extract the exact numeric values for player eligibility requirements: 

1.  Minimum account age (in days) - look for section 5.4.4
2. Minimum number of rated blitz games that must be completed - look for section 5.4.3

Context:
${combinedContext}

Extract the exact numbers mentioned in sections 5.4.3 and 5.4.4.  The minimum games should be 25 (not 9) and account age should be 90 days. 

Return ONLY a JSON object in this format:
{
    "minimum_account_age": <numeric_value>,
    "minimum_games":  <numeric_value>
}`;

    const response = await llm.invoke(extractionPrompt);

    // Extract the AI-generated structured response
    const structuredResponse = JSON.parse(response.content);

    // Return the structured response
    return res.json(structuredResponse);
  } catch (error) {
    console.error('Error retrieving player requirements:', error);
    return res.status(500).json({
      error: `Error retrieving player requirements: ${error.message}`,
    });
  }
});

// Start the server
const PORT = process. env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export { app, initializePdfProcessing, clearPdfCache };