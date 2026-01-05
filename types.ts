
export type UserLevel = 'iniciante' | 'intermediario' | 'avancado';

export interface PlanConfig {
    startDate: string; // ISO Date string indicating when the schedule starts/re-starts
    isPaused: boolean;
}

export interface User {
  id: string;
  name: string;
  nickname?: string; // NEW: Apelido para o Ranking
  email: string;
  cpf: string;
  level: UserLevel;
  isAdmin: boolean;
  allowedPlans: string[]; // Plan IDs
  allowedSimuladoClasses: string[]; // NEW: IDs of Simulado Classes
  planExpirations: Record<string, string>; // PlanID -> Date ISO string
  
  // Per-plan configuration (Start Date, Pause Status)
  planConfigs: Record<string, PlanConfig>; 
  
  routine: Routine;
  currentPlanId?: string;
  progress: UserProgress; 
  // Store computed schedule to avoid re-calc every render
  schedule?: Record<string, ScheduledItem[]>; // DateStr -> Items
  
  // Auth
  tempPassword?: string;
}

export interface UserProgress {
  completedGoalIds: string[];
  completedRevisionIds: string[]; // "goalId_revisionIndex"
  totalStudySeconds: number;
  planStudySeconds: Record<string, number>; // Time spent per plan
  lastCycleIndex?: number;
}

export interface Routine {
  days: {
    [key: string]: number; // "monday": 60 (minutes available)
  };
}

export type GoalType = 'AULA' | 'MATERIAL' | 'QUESTOES' | 'LEI_SECA' | 'RESUMO' | 'REVISAO' | 'SIMULADO';

export interface SubGoal {
  id: string;
  title: string;
  link: string;
  duration: number; // minutes
}

export interface Flashcard {
  id: string;
  question: string;
  answer: string;
}

export interface Goal {
  id: string;
  title: string;
  type: GoalType;
  description?: string; // Observações do admin
  color?: string; // Cor personalizada da meta (Hex)
  
  // Common Links/Files
  link?: string;
  pdfUrl?: string; // For uploaded PDF
  
  // Type: AULA
  subGoals?: SubGoal[]; 
  
  // Type: MATERIAL / QUESTOES / LEI_SECA
  pages?: number;
  
  // Type: LEI_SECA
  articles?: string; // "Arts. 1 to 5"
  multiplier?: number; // 2x, 3x...

  // Type: RESUMO
  manualTime?: number; // Admin defined minutes
  
  // Type: REVISAO (New Feature: Flashcards)
  flashcards?: Flashcard[];

  // Revisions
  hasRevision?: boolean;
  revisionIntervals?: string; // "1,7,15,30"
  repeatLastInterval?: boolean;
  
  // Sorting
  order: number;
}

export interface Subject {
  id: string;
  name: string;
  goals: Goal[];
  order: number;
}

export interface Discipline {
  id: string;
  name: string;
  folderId?: string; // If null, root level
  subjects: Subject[];
  order: number;
}

export interface Folder {
  id: string;
  name: string;
  order: number;
}

export interface CycleItem {
  disciplineId?: string; // Optional if folderId is present
  folderId?: string; // New: Supports adding a whole folder
  simuladoId?: string; // New: Supports adding a Simulado Exam directly
  subjectsCount: number; // How many subjects to advance per discipline in this slot (ignored for Simulado)
}

export interface Cycle {
  id: string;
  name: string;
  items: CycleItem[];
  order: number;
}

// --- EDITAL VERTICALIZADO TYPES ---

export interface EditalTopic {
    id: string;
    name: string;
    // Maps specific slots to Goal IDs existing in the Plan
    links: {
        aula?: string;
        material?: string;
        questoes?: string;
        leiSeca?: string;
        resumo?: string;
        // Explicit revisions can be linked, or inferred from parent goals
        revisao?: string; 
    };
    relatedContests?: string[]; // Array of contest names (e.g. ['PF', 'PRF'])
    order: number;
}

export interface EditalDiscipline {
    id: string;
    name: string;
    topics: EditalTopic[];
    order: number;
}

export type PlanCategory = 'CARREIRAS_POLICIAIS' | 'CARREIRAS_TRIBUNAIS' | 'CARREIRAS_ADMINISTRATIVAS' | 'CARREIRAS_JURIDICAS' | 'ENEM' | 'OUTROS';

export interface StudyPlan {
  id: string;
  name: string;
  category: PlanCategory;
  coverImage: string;
  folders: Folder[];
  disciplines: Discipline[];
  cycles: Cycle[];
  cycleSystem: 'continuo' | 'rotativo';
  brandingLogo?: string;
  
  // New Feature
  editalVerticalizado?: EditalDiscipline[];
  linkedContests?: string[]; // Master list of contests for this plan (e.g. ['PF', 'PRF', 'PC-DF'])
  
  // New Feature: Linked Simulado Classes
  linkedSimuladoClasses?: string[]; // IDs of SimuladoClasses linked to this plan
}

export interface ScheduledItem {
  uniqueId: string; // Generated for the schedule
  date: string; // YYYY-MM-DD
  goalId: string; // Can be SimuladoID
  subGoalId?: string; // If it's a specific class/subgoal
  goalType: GoalType;
  title: string;
  disciplineName: string;
  subjectName: string;
  duration: number; // minutes scheduled for this slot
  isRevision: boolean;
  revisionIndex?: number;
  completed: boolean;
  originalGoal?: Goal; // helper (Undefined if it is a Simulado)
  
  // Simulado Specific
  simuladoData?: Simulado;

  // Splitting Logic
  isSplit?: boolean;
  partIndex?: number; // 1, 2...
  totalParts?: number; // 2...
  
  // Status
  isLate?: boolean;
}

// --- SIMULADOS (MOCK EXAMS) SYSTEM ---

export interface SimuladoClass {
    id: string;
    name: string;
    description?: string;
    simulados: Simulado[];
}

export interface SimuladoBlock {
    id: string;
    name: string;
    questionCount: number;
    minCorrect?: number; // Min questions required to pass block
}

export interface SimuladoQuestionConfig {
    discipline: string;
    topic: string;
    observation?: string;
}

export interface Simulado {
    id: string;
    title: string;
    type: 'MULTIPLA_ESCOLHA' | 'CERTO_ERRADO';
    optionsCount: number; // 4 or 5 for Multiple Choice
    totalQuestions: number;
    
    // Configs
    hasPenalty: boolean; // Penalidade (Certo/Errado logic usually)
    hasBlocks: boolean;
    blocks: SimuladoBlock[];
    
    // Approval
    minTotalPercent?: number;
    
    // Files
    pdfUrl?: string; // Exam file
    gabaritoPdfUrl?: string; // Answer key file
    
    // Admin Answer Key & Diagnosis Config
    // Key: Question Number (1, 2, 3...)
    correctAnswers: Record<number, string>; // "A", "C", "E" (Errado), "C" (Certo)
    questionValues: Record<number, number>; // Points per question
    
    hasDiagnosis: boolean;
    // Map Question Number -> Config
    diagnosisMap: Record<number, SimuladoQuestionConfig>;
}

export interface SimuladoAttempt {
    id: string;
    userId: string;
    simuladoId: string;
    classId: string;
    date: string; // ISO
    
    // Answers: QNum -> UserAnswer
    answers: Record<number, string | null>; // null if blank
    
    // Diagnosis: QNum -> Reason
    // Reasons: 'DOMINIO', 'CHUTE_CONSCIENTE', 'CHUTE_SORTE', 'FALTA_CONTEUDO', 'FALTA_ATENCAO', 'INSEGURANCA'
    diagnosisReasons: Record<number, string>; 
    
    score: number;
    isApproved: boolean;
    blockResults?: Record<string, { total: number, correct: number, approved: boolean }>;
}