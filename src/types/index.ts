export type Plan = 'free' | 'pro'
export type SourceType = 'youtube' | 'pdf' | 'url' | 'text' | 'audio'
export type BadgeType = 'micro' | 'skill' | 'master'
export type WorkspaceStatus = 'active' | 'archived'
export type SourceStatus = 'processing' | 'ready' | 'failed'

export type AssistantContextType = 'source' | 'quiz' | 'roadmap' | 'problem'

export type AssistantMode =
  | 'teacher'       
  | 'corrector'     
  | 'quiz_hint'     
  | 'roadmap_guide' 
  | 'problem_solver' 

export type InputType = 'text' | 'voice'

export interface AssistantMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  mode: AssistantMode
  inputType: InputType
  correction?: {
    original: string
    corrected: string
    explanation: string
    isCorrect: boolean
  }
  hint?: {
    nudge: string           
    relatedConcept: string  
    shouldReveal: boolean   
  }
}

export interface ChatSession {
  $id: string
  userId: string
  contextType: AssistantContextType
  contextId: string
  messages: AssistantMessage[]
  mode: AssistantMode
  inputType: InputType
  summary?: string        
  createdAt: string
  updatedAt: string
}

export interface AssistantContext {
  contextType: AssistantContextType
  sourceText?: string           
  noteContent?: string          
  currentQuestion?: string      
  questionOptions?: string[]    
  roadmapState?: {
    completedUnits: string[]
    currentUnit: string
    remainingUnits: string[]
    avgScore: number
  }
  uploadedContent?: string      
  uploadedMimeType?: string     
}

export interface User {
  $id: string
  userId: string
  email: string
  plan: Plan
  stripeCustomerId?: string
  stripeSubscriptionId?: string
  wallet?: string
  createdAt: string
}

export interface Workspace {
  $id: string
  userId: string
  title: string
  description?: string
  status: WorkspaceStatus
  sourceCount: number
  completedUnits: number
  totalUnits: number
  createdAt: string
  updatedAt: string
}

export interface Source {
  $id: string
  workspaceId: string
  userId: string
  type: SourceType
  title: string
  url?: string
  inputHash: string
  rawTextPath?: string
  metadata?: Record<string, unknown>
  status: SourceStatus
  createdAt: string
}

export interface Note {
  $id: string
  sourceId: string
  userId: string
  title: string
  content: string
  tags: string[]
  wordCount: number
  updatedAt: string
  createdAt: string
}

export interface Flashcard {
  id?: string
  front?: string
  back?: string
  title?: string
  explanation?: string
  example?: string
  checkpoint?: string
  timestamp?: number
  confidenceScore?: number
}

export interface FlashcardSet {
  $id: string
  sourceId: string
  userId: string
  cards: Flashcard[]
  promptVersion: string
  model: string
  generatedAt: string
}

export interface QuizQuestion {
  id: string
  question: string
  options: string[]
  correctIndex: number
  explanation: string
}

export interface QuizAttempt {
  $id: string
  sourceId: string
  userId: string
  questions: QuizQuestion[]
  answers: number[]
  score: number
  passed: boolean
  takenAt: string
}

export interface Badge {
  $id: string
  userId: string
  type: BadgeType
  title: string
  skill: string
  sourceId?: string
  workspaceId?: string
  evidenceIds: string[]
  componentBadgeIds?: string[]
  score: number
  tokenId?: string
  txHash?: string
  ipfsHash?: string
  metadataUri?: string
  mintedAt?: string
  createdAt: string
  idempotencyKey: string
}

export interface SourceText {
  text: string
  title: string
  chunks: string[]
  metadata: {
    type: SourceType
    sourceUrl?: string
    pageCount?: number
    duration?: number
    author?: string
    publishedAt?: string
    language?: string
  }
}

export interface FlashcardsOutput { cards: Flashcard[] }
export interface QuizOutput { questions: QuizQuestion[] }
export interface ConceptMapOutput {
  nodes: { id: string; label: string }[]
  edges: { from: string; to: string; label?: string }[]
}
export interface AssessmentOutput {
  score: number
  checkpoints: { label: string; passed: boolean; feedback: string }[]
  strengths: string[]
  gaps: string[]
  overallFeedback: string
}

export interface PlanLimits {
  workspaces: number
  aiCallsPerMonth: number
  assistantMessagesPerMonth: number
  pdfUploads: number
  badgeMints: number
  sourcesPerWorkspace: number
  problemUploadsPerMonth: number
}

export interface ApiError {
  error: string
  code: 'upgrade_required' | 'rate_limited' | 'not_found' | 'unauthorized' | 'invalid_input'
  retryAfter?: number
}
