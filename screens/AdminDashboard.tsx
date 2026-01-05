import React, { useState, useEffect } from 'react';
import { User, StudyPlan, Folder, Discipline, Subject, Goal, SubGoal, Cycle, CycleItem, EditalDiscipline, EditalTopic, PlanCategory, SimuladoClass, Simulado, Flashcard } from '../types';
import { Icon } from '../components/Icons';
import { uuid } from '../constants';
import { fetchUsersFromDB, saveUserToDB, deleteUserFromDB, fetchPlansFromDB, savePlanToDB, deletePlanFromDB, fetchSimuladoClassesFromDB, saveSimuladoClassToDB, deleteSimuladoClassFromDB } from '../services/db';
import { uploadFileToStorage } from '../services/storage';
import { generateFlashcardsFromPDF } from '../services/ai';

// --- COMPONENTS HELPER ---

interface SafeDeleteBtnProps {
    onDelete: () => void;
    label?: string;
    className?: string;
}

const SafeDeleteBtn: React.FC<SafeDeleteBtnProps> = ({ onDelete, label = "", className = "" }) => {
    const [confirming, setConfirming] = useState(false);

    if (confirming) {
        if (label) {
             return (
                <div className="flex items-center gap-2 animate-fade-in h-full min-h-[34px]">
                    <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="flex-1 bg-red-600 hover:bg-red-500 text-white text-xs font-bold py-2 rounded shadow-neon transition uppercase">Confirmar</button>
                    <button onClick={(e) => { e.stopPropagation(); setConfirming(false); }} className="bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-xs font-bold px-3 py-2 rounded border border-gray-700 transition uppercase">X</button>
                </div>
             );
        }
        return (
            <div className="flex items-center gap-1 animate-fade-in">
                <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold px-2 py-1 rounded">SIM</button>
                <button onClick={(e) => { e.stopPropagation(); setConfirming(false); }} className="bg-gray-700 hover:bg-gray-600 text-white text-[10px] font-bold px-2 py-1 rounded">NÃO</button>
            </div>
        );
    }

    return (
        <button onClick={(e) => { e.stopPropagation(); setConfirming(true); }} className={`transition-colors flex items-center justify-center ${className}`}>
            <Icon.Trash className="w-4 h-4" />
            {label && <span className="ml-2">{label}</span>}
        </button>
    );
};

// --- SUB-COMPONENT: EMBED MODAL ---
interface EmbedModalProps {
    onClose: () => void;
}

const EmbedModal: React.FC<EmbedModalProps> = ({ onClose }) => {
    const appUrl = window.location.origin;
    // Generated iframe code - Responsive width/height
    const embedCode = `<iframe 
  src="${appUrl}" 
  width="100%" 
  height="800" 
  style="border: none; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); width: 100%; min-height: 100vh;" 
  allow="fullscreen" 
  title="Insanus Planner">
</iframe>`;

    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(embedCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="fixed inset-0 z-[70] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-[#121212] border border-[#333] p-8 rounded-2xl w-full max-w-2xl relative shadow-2xl">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white transition">
                    <Icon.LogOut className="w-6 h-6"/>
                </button>

                <div className="mb-6 flex items-center gap-4">
                    <div className="w-12 h-12 bg-insanus-red/10 rounded-full flex items-center justify-center border border-insanus-red/30">
                        <Icon.Share2 className="w-6 h-6 text-insanus-red"/>
                    </div>
                    <div>
                        <h3 className="text-2xl font-black text-white uppercase tracking-tight">Código Embed</h3>
                        <p className="text-sm text-gray-400">Incorpore o sistema em sites externos ou plataformas LMS.</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="bg-[#1E1E1E] p-4 rounded-xl border border-[#333]">
                        <label className="text-[10px] font-bold text-gray-500 uppercase block mb-2">HTML Iframe (Responsivo)</label>
                        <div className="relative">
                            <textarea 
                                readOnly 
                                value={embedCode}
                                className="w-full h-32 bg-black border border-white/10 rounded-lg p-3 text-xs font-mono text-green-400 focus:outline-none resize-none"
                            />
                            <button 
                                onClick={handleCopy} 
                                className={`absolute top-2 right-2 px-3 py-1.5 rounded-md text-xs font-bold uppercase transition flex items-center gap-2 ${copied ? 'bg-green-600 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
                            >
                                {copied ? <Icon.Check className="w-3 h-3"/> : <Icon.Copy className="w-3 h-3"/>}
                                {copied ? 'Copiado!' : 'Copiar'}
                            </button>
                        </div>
                    </div>

                    <div className="bg-blue-900/10 border border-blue-500/20 p-4 rounded-xl">
                        <h4 className="text-blue-400 font-bold text-xs uppercase mb-2 flex items-center gap-2"><Icon.Code className="w-4 h-4"/> Instruções de Uso</h4>
                        <p className="text-gray-400 text-xs leading-relaxed">
                            1. Copie o código acima.<br/>
                            2. Cole no HTML do seu site, Elementor (Wordpress), ou área de "Código Embed" da sua plataforma.<br/>
                            3. O sistema se ajustará automaticamente à largura da página (Responsivo).
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- SUB-COMPONENT: USER FORM MODAL (CREATE/EDIT) ---
interface UserFormModalProps {
    initialUser?: User | null;
    onSave: (u: User) => void;
    onCancel: () => void;
}

const UserFormModal: React.FC<UserFormModalProps> = ({ initialUser, onSave, onCancel }) => {
    const [name, setName] = useState(initialUser?.name || '');
    const [email, setEmail] = useState(initialUser?.email || '');
    const [cpf, setCpf] = useState(initialUser?.cpf || '');
    const [password, setPassword] = useState(initialUser?.tempPassword || '123');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        if(!name.trim() || !email.trim()) return alert("Nome e Email são obrigatórios");
        
        setLoading(true);
        
        let userToSave: User;

        if (initialUser) {
            // Editing existing user
            userToSave = {
                ...initialUser,
                name: name.trim(),
                email: email.trim().toLowerCase(),
                cpf: cpf || '000.000.000-00',
                tempPassword: password
            };
        } else {
            // Creating new user
            userToSave = {
                id: uuid(),
                name: name.trim(),
                email: email.trim().toLowerCase(),
                cpf: cpf || '000.000.000-00',
                level: 'iniciante',
                isAdmin: false,
                allowedPlans: [],
                allowedSimuladoClasses: [],
                planExpirations: {},
                planConfigs: {},
                routine: { days: {} },
                progress: { completedGoalIds: [], completedRevisionIds: [], totalStudySeconds: 0, planStudySeconds: {} },
                tempPassword: password
            };
        }

        await onSave(userToSave);
        setLoading(false);
    }

    return (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-[#121212] border border-[#333] p-6 rounded-xl w-full max-w-md space-y-4 shadow-2xl relative">
                <button onClick={onCancel} className="absolute top-4 right-4 text-gray-500 hover:text-white"><Icon.LogOut className="w-5 h-5"/></button>
                
                <div className="text-center mb-6">
                    <h3 className="text-xl font-black text-white uppercase tracking-tight">{initialUser ? 'Editar Aluno' : 'Novo Aluno'}</h3>
                    <p className="text-xs text-gray-500">{initialUser ? 'Atualize os dados de acesso.' : 'Preencha os dados de acesso inicial.'}</p>
                </div>
                
                <div className="space-y-3">
                    <div>
                        <label className="text-[10px] text-gray-500 font-bold uppercase block mb-1">Nome Completo</label>
                        <input value={name} onChange={e => setName(e.target.value)} className="w-full bg-black p-3 rounded-lg border border-white/10 text-white text-sm focus:border-insanus-red focus:outline-none" placeholder="Ex: João da Silva" />
                    </div>
                    <div>
                        <label className="text-[10px] text-gray-500 font-bold uppercase block mb-1">Email (Login)</label>
                        <input value={email} type="email" onChange={e => setEmail(e.target.value)} className="w-full bg-black p-3 rounded-lg border border-white/10 text-white text-sm focus:border-insanus-red focus:outline-none" placeholder="aluno@email.com" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] text-gray-500 font-bold uppercase block mb-1">CPF (Opcional)</label>
                            <input value={cpf} onChange={e => setCpf(e.target.value)} className="w-full bg-black p-3 rounded-lg border border-white/10 text-white text-sm focus:border-insanus-red focus:outline-none" placeholder="000.000.000-00" />
                        </div>
                        <div>
                            <label className="text-[10px] text-gray-500 font-bold uppercase block mb-1">Senha de Acesso</label>
                            <input value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-black p-3 rounded-lg border border-white/10 text-white text-sm focus:border-insanus-red focus:outline-none" />
                        </div>
                    </div>
                </div>

                <div className="flex gap-3 pt-4 mt-4 border-t border-[#333]">
                    <button onClick={onCancel} className="flex-1 py-3 rounded-lg border border-white/10 text-gray-400 hover:text-white hover:bg-white/5 text-xs font-bold transition">CANCELAR</button>
                    <button onClick={handleSubmit} disabled={loading} className="flex-1 py-3 rounded-lg bg-insanus-red text-white text-xs font-bold hover:bg-red-600 transition shadow-neon disabled:opacity-50 disabled:cursor-not-allowed">
                        {loading ? 'SALVANDO...' : (initialUser ? 'SALVAR ALTERAÇÕES' : 'CRIAR ALUNO')}
                    </button>
                </div>
            </div>
        </div>
    )
}

// --- SUB-COMPONENT: EDITAL TOPIC EDITOR ---
interface EditalTopicEditorProps {
    topic: EditalTopic;
    plan: StudyPlan;
    onUpdate: (t: EditalTopic) => void;
    onDelete: () => void;
}

const EditalTopicEditor: React.FC<EditalTopicEditorProps> = ({ topic, plan, onUpdate, onDelete }) => {
    const [expanded, setExpanded] = useState(false);

    const toggleContest = (contest: string) => {
        const current = topic.relatedContests || [];
        const updated = current.includes(contest)
            ? current.filter(c => c !== contest)
            : [...current, contest];
        onUpdate({ ...topic, relatedContests: updated });
    };

    const renderGoalSelector = (
        label: string, 
        currentId: string | undefined, 
        onChange: (val: string) => void,
        icon: any
    ) => {
        return (
            <div className="flex-1 min-w-[200px]">
                <div className="flex items-center gap-2 mb-1 text-[10px] font-bold text-gray-500 uppercase">
                    {icon} {label}
                </div>
                <select 
                    value={currentId || ''}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-full bg-[#121212] border border-[#333] rounded p-2 text-xs text-white focus:outline-none focus:border-white/30 truncate"
                >
                    <option value="">(Não vinculado)</option>
                    {plan.disciplines.map(d => (
                        <optgroup key={d.id} label={d.name}>
                            {d.subjects.map(s => (
                                s.goals.map(g => (
                                    <option key={g.id} value={g.id}>
                                        {s.name} - {g.title} ({g.type})
                                    </option>
                                ))
                            ))}
                        </optgroup>
                    ))}
                </select>
            </div>
        );
    };

    return (
        <div className="bg-[#1E1E1E] border border-[#333] rounded-lg mb-2 overflow-hidden w-full">
            <div className="flex items-center p-3 gap-3 w-full">
                <button onClick={() => setExpanded(!expanded)} className="text-gray-500 hover:text-white shrink-0">
                    {expanded ? <Icon.ChevronDown className="w-4 h-4 rotate-180" /> : <Icon.ChevronRight className="w-4 h-4" />}
                </button>
                <input 
                    value={topic.name}
                    onChange={(e) => onUpdate({...topic, name: e.target.value})}
                    className="flex-1 bg-transparent text-sm font-bold text-white focus:outline-none w-full"
                    placeholder="Nome do Tópico (Ex: Atos Administrativos)"
                />
                <div className="flex gap-1 shrink-0">
                    {topic.relatedContests?.map(c => (
                        <span key={c} className="text-[9px] bg-insanus-red/20 text-insanus-red px-1 rounded font-bold">{c}</span>
                    ))}
                </div>
                <SafeDeleteBtn onDelete={onDelete} />
            </div>

            {expanded && (
                <div className="p-3 bg-[#121212] border-t border-[#333] animate-fade-in grid gap-4 w-full">
                    {plan.category === 'CARREIRAS_POLICIAIS' && plan.linkedContests && plan.linkedContests.length > 0 && (
                        <div className="mb-2 p-2 bg-[#1E1E1E] rounded border border-[#333]">
                            <label className="text-[10px] font-bold text-gray-400 uppercase mb-2 block">Aplicável aos Concursos:</label>
                            <div className="flex flex-wrap gap-2">
                                {plan.linkedContests.map(contest => {
                                    const isSelected = topic.relatedContests?.includes(contest);
                                    return (
                                        <button 
                                            key={contest}
                                            onClick={() => toggleContest(contest)}
                                            className={`text-[10px] px-2 py-1 rounded border transition-all ${isSelected ? 'bg-insanus-red text-white border-insanus-red shadow-neon' : 'bg-black text-gray-500 border-gray-700 hover:border-gray-500'}`}
                                        >
                                            {contest}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                        {renderGoalSelector("Aula", topic.links.aula, (v) => onUpdate({...topic, links: {...topic.links, aula: v}}), <Icon.Play className="w-3 h-3"/>)}
                        {renderGoalSelector("PDF / Material", topic.links.material, (v) => onUpdate({...topic, links: {...topic.links, material: v}}), <Icon.FileText className="w-3 h-3"/>)}
                        {renderGoalSelector("Questões", topic.links.questoes, (v) => onUpdate({...topic, links: {...topic.links, questoes: v}}), <Icon.Code className="w-3 h-3"/>)}
                        {renderGoalSelector("Lei Seca", topic.links.leiSeca, (v) => onUpdate({...topic, links: {...topic.links, leiSeca: v}}), <Icon.Book className="w-3 h-3"/>)}
                        {renderGoalSelector("Resumo", topic.links.resumo, (v) => onUpdate({...topic, links: {...topic.links, resumo: v}}), <Icon.Edit className="w-3 h-3"/>)}
                        {renderGoalSelector("Revisão Específica", topic.links.revisao, (v) => onUpdate({...topic, links: {...topic.links, revisao: v}}), <Icon.RefreshCw className="w-3 h-3"/>)}
                    </div>
                </div>
            )}
        </div>
    );
};

// --- SUB-COMPONENT: CYCLE EDITOR ---

interface CycleEditorProps {
    cycle: Cycle;
    allDisciplines: Discipline[];
    allFolders: Folder[];
    linkedSimulados: SimuladoClass[];
    onUpdate: (c: Cycle) => void;
    onDelete: () => void;
}

const CycleEditor: React.FC<CycleEditorProps> = ({ cycle, allDisciplines, allFolders, linkedSimulados, onUpdate, onDelete }) => {
    const [selectedId, setSelectedId] = useState('');

    const addItem = () => {
        if (!selectedId) return;
        const [type, id] = selectedId.split(':');
        
        let newItem: CycleItem;
        if (type === 'FOLDER') {
            newItem = { folderId: id, subjectsCount: 1 };
        } else if (type === 'SIMULADO') {
             newItem = { simuladoId: id, subjectsCount: 1 };
        } else {
            newItem = { disciplineId: id, subjectsCount: 1 };
        }
        
        onUpdate({ ...cycle, items: [...cycle.items, newItem] });
        setSelectedId('');
    };

    const updateItem = (index: number, field: keyof CycleItem, value: any) => {
        const newItems = [...cycle.items];
        newItems[index] = { ...newItems[index], [field]: value };
        onUpdate({ ...cycle, items: newItems });
    };

    const removeItem = (index: number) => {
        const newItems = cycle.items.filter((_, i) => i !== index);
        onUpdate({ ...cycle, items: newItems });
    };

    const getItemName = (item: CycleItem) => {
        if (item.simuladoId) {
            for (const sc of linkedSimulados) {
                const sim = sc.simulados.find(s => s.id === item.simuladoId);
                if (sim) return `SIMULADO: ${sim.title}`;
            }
            return 'Simulado Removido/Não Encontrado';
        }
        if (item.folderId) {
            const f = allFolders.find(f => f.id === item.folderId);
            return f ? `PASTA: ${f.name}` : 'Pasta Removida';
        }
        const d = allDisciplines.find(d => d.id === item.disciplineId);
        return d ? d.name : 'Disciplina Removida';
    }

    return (
        <div className="bg-[#121212] rounded-xl border border-[#333] overflow-hidden mb-6 w-full">
            <div className="bg-[#1E1E1E] p-4 flex justify-between items-center border-b border-[#333]">
                <div className="flex items-center gap-3 flex-1">
                    <div className="w-8 h-8 rounded-full bg-insanus-red/20 text-insanus-red flex items-center justify-center font-black text-xs border border-insanus-red">
                        {cycle.order + 1}
                    </div>
                    <input 
                        value={cycle.name} 
                        onChange={e => onUpdate({...cycle, name: e.target.value})}
                        className="bg-transparent font-bold text-white focus:outline-none w-full text-lg placeholder-gray-600"
                        placeholder="Nome do Ciclo"
                    />
                </div>
                <SafeDeleteBtn onDelete={onDelete} />
            </div>

            <div className="p-4 w-full">
                <div className="space-y-2 mb-4 w-full">
                    {cycle.items.map((item, idx) => {
                        const name = getItemName(item);
                        const isFolder = !!item.folderId;
                        const isSimulado = !!item.simuladoId;
                        return (
                            <div key={idx} className={`flex items-center gap-4 p-2 rounded border border-[#333] w-full ${isSimulado ? 'bg-blue-900/10 border-blue-500/30' : isFolder ? 'bg-insanus-red/10 border-insanus-red/30' : 'bg-[#1A1A1A]'}`}>
                                <div className="text-gray-500 font-mono text-xs w-6 text-center shrink-0">{idx + 1}.</div>
                                <div className="flex-1 flex items-center gap-2 text-sm font-bold text-gray-200 truncate">
                                    {isFolder && <Icon.Folder className="w-4 h-4 text-insanus-red shrink-0" />}
                                    {isSimulado && <Icon.List className="w-4 h-4 text-blue-400 shrink-0" />}
                                    <span className="truncate">{name}</span>
                                </div>
                                {!isSimulado && (
                                    <div className="flex items-center gap-2 bg-black/50 rounded px-2 py-1 border border-white/5 shrink-0">
                                        <span className="text-[10px] text-gray-500 uppercase">Qtd. Metas{isFolder ? '/Disc' : ''}:</span>
                                        <input 
                                            type="number" 
                                            min="1"
                                            value={item.subjectsCount}
                                            onChange={(e) => updateItem(idx, 'subjectsCount', parseInt(e.target.value) || 1)}
                                            className="w-12 bg-transparent text-center text-white text-sm font-bold focus:outline-none"
                                        />
                                    </div>
                                )}
                                <button onClick={() => removeItem(idx)} className="text-gray-600 hover:text-red-500 p-1 shrink-0"><Icon.Trash className="w-4 h-4" /></button>
                            </div>
                        );
                    })}
                </div>
                <div className="flex gap-2 pt-2 border-t border-[#333]">
                    <select 
                        value={selectedId}
                        onChange={(e) => setSelectedId(e.target.value)}
                        className="flex-1 bg-[#1E1E1E] text-gray-300 text-xs rounded p-2 outline-none"
                    >
                        <option value="">Adicionar ao ciclo...</option>
                        {linkedSimulados.length > 0 && (
                            <optgroup label="Simulados Vinculados">
                                {linkedSimulados.map(sc => (
                                    sc.simulados.map(s => (
                                        <option key={s.id} value={`SIMULADO:${s.id}`}>{s.title} ({sc.name})</option>
                                    ))
                                ))}
                            </optgroup>
                        )}
                        <optgroup label="Pastas (Inclui todas as disciplinas)">
                            {allFolders.map(f => <option key={f.id} value={`FOLDER:${f.id}`}>{f.name}</option>)}
                        </optgroup>
                        <optgroup label="Disciplinas Individuais">
                            {allDisciplines.map(d => <option key={d.id} value={`DISC:${d.id}`}>{d.name}</option>)}
                        </optgroup>
                    </select>
                    <button onClick={addItem} disabled={!selectedId} className="bg-insanus-red/20 text-insanus-red hover:bg-insanus-red hover:text-white px-4 py-2 rounded text-xs font-bold transition-all">ADICIONAR</button>
                </div>
            </div>
        </div>
    );
};

interface GoalEditorProps {
    goal: Goal;
    onUpdate: (g: Goal) => void;
    onDelete: () => void;
}

const GoalEditor: React.FC<GoalEditorProps> = ({ goal, onUpdate, onDelete }) => {
    const [uploading, setUploading] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const [generatingFlashcards, setGeneratingFlashcards] = useState(false);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || !e.target.files[0]) return;
        setUploading(true);
        try {
            const url = await uploadFileToStorage(e.target.files[0]);
            onUpdate({ ...goal, pdfUrl: url });
        } catch (err) { alert("Erro no upload"); } 
        finally { setUploading(false); }
    };

    const addSubGoal = () => {
        const newSub: SubGoal = { id: uuid(), title: 'Nova Aula', link: '', duration: 30 };
        onUpdate({ ...goal, subGoals: [...(goal.subGoals || []), newSub] });
    };

    const updateSubGoal = (index: number, field: keyof SubGoal, value: any) => {
        if (!goal.subGoals) return;
        const newSubs = [...goal.subGoals];
        newSubs[index] = { ...newSubs[index], [field]: value };
        onUpdate({ ...goal, subGoals: newSubs });
    };

    const removeSubGoal = (index: number) => {
        if (!goal.subGoals) return;
        const newSubs = goal.subGoals.filter((_, i) => i !== index);
        onUpdate({ ...goal, subGoals: newSubs });
    };

    // --- FLASHCARDS LOGIC ---
    const handleGenerateFlashcards = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || !e.target.files[0]) return;
        
        setGeneratingFlashcards(true);
        const file = e.target.files[0];
        const reader = new FileReader();

        reader.onload = async (evt) => {
            const base64 = evt.target?.result as string;
            if (!base64) {
                alert("Erro ao ler arquivo.");
                setGeneratingFlashcards(false);
                return;
            }

            try {
                const newCards = await generateFlashcardsFromPDF(base64);
                // Append new cards to existing ones
                onUpdate({ ...goal, flashcards: [...(goal.flashcards || []), ...newCards] });
                alert(`${newCards.length} flashcards gerados com sucesso!`);
            } catch (error: any) {
                alert(error.message || "Erro na geração de flashcards.");
            } finally {
                setGeneratingFlashcards(false);
            }
        };

        reader.readAsDataURL(file);
    };

    const addManualFlashcard = () => {
        const newCard: Flashcard = { id: uuid(), question: 'Nova Pergunta', answer: 'Nova Resposta' };
        onUpdate({ ...goal, flashcards: [...(goal.flashcards || []), newCard] });
    };

    const updateFlashcard = (index: number, field: keyof Flashcard, value: string) => {
        if (!goal.flashcards) return;
        const newCards = [...goal.flashcards];
        newCards[index] = { ...newCards[index], [field]: value };
        onUpdate({ ...goal, flashcards: newCards });
    };

    const removeFlashcard = (index: number) => {
        if (!goal.flashcards) return;
        const newCards = goal.flashcards.filter((_, i) => i !== index);
        onUpdate({ ...goal, flashcards: newCards });
    };

    const totalDuration = goal.subGoals?.reduce((acc, curr) => acc + (Number(curr.duration)||0), 0) || 0;

    return (
        <div className="bg-[#1E1E1E] p-3 rounded border border-[#333] hover:border-white/20 transition-all mb-2 w-full">
            <div className="flex items-center gap-2 mb-2">
                <div 
                    className="w-3 h-8 rounded shrink-0 cursor-pointer border border-white/10"
                    style={{ backgroundColor: goal.color || '#333' }}
                >
                    <input type="color" className="opacity-0 w-full h-full cursor-pointer" value={goal.color || '#333333'} onChange={(e) => onUpdate({...goal, color: e.target.value})} />
                </div>
                <select value={goal.type} onChange={e => onUpdate({...goal, type: e.target.value as any})} className="bg-[#121212] text-[10px] font-bold rounded p-2 text-gray-300 border-none outline-none uppercase shrink-0">
                    <option value="AULA">AULA</option>
                    <option value="MATERIAL">PDF</option>
                    <option value="QUESTOES">QUESTÕES</option>
                    <option value="LEI_SECA">LEI SECA</option>
                    <option value="RESUMO">RESUMO</option>
                    <option value="REVISAO">REVISÃO</option>
                </select>
                <input value={goal.title} onChange={e => onUpdate({...goal, title: e.target.value})} className="bg-transparent flex-1 text-sm font-bold text-white focus:outline-none border-b border-transparent focus:border-insanus-red placeholder-gray-600 w-full" placeholder="Título da Meta" />
                <button onClick={() => setExpanded(!expanded)} className="text-gray-500 hover:text-white shrink-0">{expanded ? <Icon.ArrowUp className="w-4 h-4" /> : <Icon.Edit className="w-4 h-4" />}</button>
                <SafeDeleteBtn onDelete={onDelete} />
            </div>
            
            {expanded && (
                <div className="mt-4 pt-4 border-t border-[#333] space-y-4 animate-fade-in w-full">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input value={goal.description || ''} onChange={e => onUpdate({...goal, description: e.target.value})} placeholder="Observações..." className="col-span-1 md:col-span-2 bg-[#121212] p-2 rounded text-xs text-gray-300 focus:outline-none w-full" />
                        
                        {(goal.type === 'MATERIAL' || goal.type === 'LEI_SECA' || goal.type === 'QUESTOES') && (
                            <div className="flex items-center gap-2 bg-[#121212] p-2 rounded w-full">
                                <span className="text-[10px] text-gray-500 font-bold uppercase shrink-0">Páginas/Qtd:</span>
                                <input type="number" value={goal.pages || 0} onChange={e => onUpdate({...goal, pages: Number(e.target.value)})} className="bg-transparent w-full text-white font-mono text-sm focus:outline-none text-right" />
                            </div>
                        )}
                        {goal.type === 'RESUMO' && (
                             <div className="flex items-center gap-2 bg-[#121212] p-2 rounded w-full">
                                <span className="text-[10px] text-gray-500 font-bold uppercase shrink-0">Tempo Manual (min):</span>
                                <input type="number" value={goal.manualTime || 0} onChange={e => onUpdate({...goal, manualTime: Number(e.target.value)})} className="bg-transparent w-full text-white font-mono text-sm focus:outline-none text-right" />
                            </div>
                        )}
                        
                        <input value={goal.link || ''} onChange={e => onUpdate({...goal, link: e.target.value})} placeholder="Link Geral (Opcional)" className="bg-[#121212] p-2 rounded text-xs text-gray-400 focus:text-white focus:outline-none w-full" />
                        
                        {/* Generic PDF Upload for Download */}
                        <div className="relative w-full">
                            <input type="file" id={`file-${goal.id}`} className="hidden" onChange={handleFileUpload} accept="application/pdf" />
                            <label htmlFor={`file-${goal.id}`} className={`block w-full text-center p-2 rounded cursor-pointer text-xs font-bold transition-colors ${goal.pdfUrl ? 'bg-green-900/30 text-green-500 border border-green-900' : 'bg-[#121212] text-gray-500 hover:bg-white/10'}`}>
                                {uploading ? 'ENVIANDO...' : goal.pdfUrl ? 'PDF ANEXADO' : 'ANEXAR PDF (DOWNLOAD)'}
                            </label>
                        </div>

                        <div className="col-span-1 md:col-span-2 border-t border-[#333] pt-4 mt-2">
                             <div className="flex items-center gap-2 mb-2">
                                <input type="checkbox" id={`rev-${goal.id}`} checked={goal.hasRevision || false} onChange={e => onUpdate({...goal, hasRevision: e.target.checked})} className="cursor-pointer accent-insanus-red w-4 h-4" />
                                <label htmlFor={`rev-${goal.id}`} className="text-xs font-bold text-gray-300 cursor-pointer select-none hover:text-white flex items-center gap-2">ATIVAR REVISÕES AUTOMÁTICAS</label>
                             </div>
                             {goal.hasRevision && (
                                 <div className="pl-6 space-y-2 bg-[#121212] p-3 rounded-lg border border-[#333]">
                                     <label className="text-[10px] text-gray-500 uppercase font-bold">Intervalos (Dias):</label>
                                     <input value={goal.revisionIntervals || '1,7,15,30'} onChange={e => onUpdate({...goal, revisionIntervals: e.target.value})} placeholder="Ex: 1, 7, 15, 30" className="bg-black/30 p-2 rounded text-xs text-white focus:outline-none border border-white/10 w-full font-mono tracking-widest" />
                                 </div>
                             )}
                        </div>
                    </div>

                    {goal.type === 'AULA' && (
                        <div className="bg-[#121212] p-3 rounded border border-[#333] w-full">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-[10px] font-bold text-gray-500 uppercase">Aulas ({goal.subGoals?.length || 0})</span>
                                <span className="text-[10px] font-mono text-insanus-red">{totalDuration} min total</span>
                            </div>
                            <div className="space-y-2">
                                {goal.subGoals?.map((sub, idx) => (
                                    <div key={sub.id} className="flex gap-2 items-center w-full">
                                        <span className="text-gray-600 font-mono text-xs shrink-0">{idx + 1}.</span>
                                        <input value={sub.title} onChange={(e) => updateSubGoal(idx, 'title', e.target.value)} className="flex-1 bg-[#1E1E1E] p-1 px-2 rounded text-xs text-white focus:outline-none" placeholder="Título da Aula" />
                                        <input value={sub.link} onChange={(e) => updateSubGoal(idx, 'link', e.target.value)} className="w-1/4 bg-[#1E1E1E] p-1 px-2 rounded text-xs text-gray-400 focus:text-white focus:outline-none" placeholder="Link URL" />
                                        <input type="number" value={sub.duration} onChange={(e) => updateSubGoal(idx, 'duration', Number(e.target.value))} className="w-16 bg-[#1E1E1E] p-1 px-2 rounded text-xs text-white text-center focus:outline-none shrink-0" placeholder="Min" />
                                        <button onClick={() => removeSubGoal(idx)} className="text-gray-600 hover:text-red-500 shrink-0"><Icon.Trash className="w-3 h-3" /></button>
                                    </div>
                                ))}
                            </div>
                            <button onClick={addSubGoal} className="w-full mt-2 py-1 bg-[#1E1E1E] hover:bg-white/10 text-gray-400 hover:text-white text-[10px] font-bold rounded transition">+ ADICIONAR AULA</button>
                        </div>
                    )}

                    {/* FLASHCARDS MANAGER (ONLY FOR REVISAO) */}
                    {goal.type === 'REVISAO' && (
                        <div className="bg-[#121212] p-4 rounded-xl border border-blue-900/30 w-full relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                            <div className="flex justify-between items-center mb-4">
                                <h4 className="text-sm font-bold text-blue-400 uppercase flex items-center gap-2">
                                    <Icon.List className="w-4 h-4"/> Flashcards de Revisão
                                </h4>
                                <div className="flex gap-2">
                                    <div className="relative">
                                        <input 
                                            type="file" 
                                            id={`flash-pdf-${goal.id}`} 
                                            className="hidden" 
                                            accept="application/pdf"
                                            onChange={handleGenerateFlashcards}
                                            disabled={generatingFlashcards}
                                        />
                                        <label 
                                            htmlFor={`flash-pdf-${goal.id}`} 
                                            className="cursor-pointer bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase shadow-neon flex items-center gap-2 transition"
                                        >
                                            {generatingFlashcards ? <Icon.RefreshCw className="w-3 h-3 animate-spin"/> : <Icon.Code className="w-3 h-3"/>}
                                            {generatingFlashcards ? 'Gerando...' : 'Gerar com IA (PDF)'}
                                        </label>
                                    </div>
                                    <button onClick={addManualFlashcard} className="bg-[#1E1E1E] hover:bg-[#252525] text-gray-300 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase border border-white/10 transition">
                                        + Manual
                                    </button>
                                </div>
                            </div>

                            {(!goal.flashcards || goal.flashcards.length === 0) ? (
                                <div className="text-center py-6 border border-dashed border-[#333] rounded-lg text-gray-600 text-xs">
                                    Nenhum flashcard criado. Envie um PDF para gerar automaticamente ou crie manualmente.
                                </div>
                            ) : (
                                <div className="space-y-3 max-h-64 overflow-y-auto custom-scrollbar pr-2">
                                    {goal.flashcards.map((card, idx) => (
                                        <div key={card.id} className="bg-black/30 p-3 rounded border border-white/5 flex flex-col gap-2 relative group">
                                            <div className="flex justify-between">
                                                <span className="text-[10px] text-blue-500 font-bold uppercase">Card {idx + 1}</span>
                                                <button onClick={() => removeFlashcard(idx)} className="text-gray-600 hover:text-red-500"><Icon.Trash className="w-3 h-3"/></button>
                                            </div>
                                            <input 
                                                value={card.question} 
                                                onChange={(e) => updateFlashcard(idx, 'question', e.target.value)} 
                                                className="bg-[#1E1E1E] p-2 rounded text-xs text-white border border-[#333] focus:border-blue-500 outline-none placeholder-gray-600"
                                                placeholder="Pergunta..."
                                            />
                                            <textarea 
                                                value={card.answer} 
                                                onChange={(e) => updateFlashcard(idx, 'answer', e.target.value)} 
                                                className="bg-[#1E1E1E] p-2 rounded text-xs text-gray-300 border border-[#333] focus:border-blue-500 outline-none placeholder-gray-600 resize-none h-16"
                                                placeholder="Resposta..."
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

interface SimuladoEditorProps {
    simClass: SimuladoClass;
    onUpdate: (sc: SimuladoClass) => void;
    onBack: () => void;
}

const SimuladoEditor: React.FC<SimuladoEditorProps> = ({ simClass, onUpdate, onBack }) => {
    const [selectedSimulado, setSelectedSimulado] = useState<Simulado | null>(null);
    const [uploading, setUploading] = useState(false);

    const addSimulado = () => {
        const newSim: Simulado = {
            id: uuid(), title: "Novo Simulado", type: "MULTIPLA_ESCOLHA", optionsCount: 5, totalQuestions: 10,
            hasPenalty: false, hasBlocks: false, blocks: [], correctAnswers: {}, questionValues: {}, hasDiagnosis: false, diagnosisMap: {}
        };
        onUpdate({ ...simClass, simulados: [...simClass.simulados, newSim] });
        setSelectedSimulado(newSim);
    };

    const updateSimulado = (sim: Simulado) => {
        const updatedList = simClass.simulados.map(s => s.id === sim.id ? sim : s);
        onUpdate({ ...simClass, simulados: updatedList });
        setSelectedSimulado(sim);
    };

    const deleteSimulado = (id: string) => {
        if (!confirm("Excluir simulado?")) return;
        const updatedList = simClass.simulados.filter(s => s.id !== id);
        onUpdate({ ...simClass, simulados: updatedList });
        setSelectedSimulado(null);
    };

    const handleFile = async (e: React.ChangeEvent<HTMLInputElement>, sim: Simulado, field: 'pdfUrl' | 'gabaritoPdfUrl') => {
        if (!e.target.files || !e.target.files[0]) return;
        setUploading(true);
        try {
            const url = await uploadFileToStorage(e.target.files[0], 'simulados');
            updateSimulado({ ...sim, [field]: url });
        } catch(err) { alert("Erro upload"); }
        finally { setUploading(false); }
    }

    if (selectedSimulado) {
        const s = selectedSimulado;
        return (
            <div className="flex flex-col h-full w-full bg-[#050505]">
                <div className="flex items-center gap-4 border-b border-[#333] p-4 bg-[#0F0F0F] shrink-0 w-full">
                    <button onClick={() => setSelectedSimulado(null)} className="text-gray-400 hover:text-white shrink-0"><Icon.ArrowUp className="-rotate-90 w-6 h-6"/></button>
                    <span className="font-bold text-white uppercase">{s.title}</span>
                </div>
                
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8 w-full">
                    <div className="w-full space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
                            <div>
                                <label className="text-[10px] text-gray-500 uppercase font-bold">Título</label>
                                <input value={s.title} onChange={e => updateSimulado({...s, title: e.target.value})} className="w-full bg-[#121212] border border-[#333] p-2 rounded text-white"/>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] text-gray-500 uppercase font-bold">Tipo</label>
                                    <select value={s.type} onChange={e => updateSimulado({...s, type: e.target.value as any})} className="w-full bg-[#121212] border border-[#333] p-2 rounded text-white">
                                        <option value="MULTIPLA_ESCOLHA">Múltipla Escolha</option>
                                        <option value="CERTO_ERRADO">Certo / Errado</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] text-gray-500 uppercase font-bold">Qtd. Questões</label>
                                    <input type="number" value={s.totalQuestions} onChange={e => updateSimulado({...s, totalQuestions: Number(e.target.value)})} className="w-full bg-[#121212] border border-[#333] p-2 rounded text-white"/>
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] text-gray-500 uppercase font-bold block mb-1">Caderno de Questões (PDF)</label>
                                <input type="file" onChange={e => handleFile(e, s, 'pdfUrl')} className="text-xs text-gray-400"/>
                                {s.pdfUrl && <span className="text-xs text-green-500 ml-2">Anexado</span>}
                            </div>
                            <div>
                                <label className="text-[10px] text-gray-500 uppercase font-bold block mb-1">Gabarito Comentado (PDF)</label>
                                <input type="file" onChange={e => handleFile(e, s, 'gabaritoPdfUrl')} className="text-xs text-gray-400"/>
                                {s.gabaritoPdfUrl && <span className="text-xs text-green-500 ml-2">Anexado</span>}
                            </div>
                            <div className="col-span-1 md:col-span-2 flex flex-col md:flex-row gap-6">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" checked={s.hasPenalty} onChange={e => updateSimulado({...s, hasPenalty: e.target.checked})} className="accent-insanus-red"/>
                                    <span className="text-xs font-bold text-white">Sistema de Penalidade (1 Errada anula 1 Certa)</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" checked={s.hasDiagnosis} onChange={e => updateSimulado({...s, hasDiagnosis: e.target.checked})} className="accent-insanus-red"/>
                                    <span className="text-xs font-bold text-white">Ativar Autodiagnóstico</span>
                                </label>
                            </div>
                        </div>

                        <div className="bg-[#121212] p-4 rounded-xl border border-[#333] w-full">
                            <div className="flex justify-between items-center mb-2">
                                <h4 className="text-sm font-bold text-white">Divisão de Blocos</h4>
                                <button onClick={() => updateSimulado({...s, hasBlocks: !s.hasBlocks})} className={`text-[10px] px-2 py-1 rounded ${s.hasBlocks ? 'bg-insanus-red text-white' : 'bg-gray-700 text-gray-400'}`}>{s.hasBlocks ? 'ATIVADO' : 'DESATIVADO'}</button>
                            </div>
                            {s.hasBlocks && (
                                <div className="space-y-2">
                                    {s.blocks.map((b, idx) => (
                                        <div key={idx} className="flex gap-2">
                                            <input value={b.name} onChange={e => { const nb = [...s.blocks]; nb[idx].name = e.target.value; updateSimulado({...s, blocks: nb}); }} placeholder="Nome Bloco" className="bg-black p-1 text-xs text-white border border-white/10 rounded"/>
                                            <input type="number" value={b.questionCount} onChange={e => { const nb = [...s.blocks]; nb[idx].questionCount = Number(e.target.value); updateSimulado({...s, blocks: nb}); }} placeholder="Qtd" className="w-16 bg-black p-1 text-xs text-white border border-white/10 rounded"/>
                                            <input type="number" value={b.minCorrect} onChange={e => { const nb = [...s.blocks]; nb[idx].minCorrect = Number(e.target.value); updateSimulado({...s, blocks: nb}); }} placeholder="Mín. Acertos" className="w-20 bg-black p-1 text-xs text-white border border-white/10 rounded"/>
                                            <button onClick={() => { const nb = s.blocks.filter((_, i) => i !== idx); updateSimulado({...s, blocks: nb}); }} className="text-red-500"><Icon.Trash className="w-4 h-4"/></button>
                                        </div>
                                    ))}
                                    <button onClick={() => updateSimulado({...s, blocks: [...s.blocks, {id: uuid(), name: `Bloco ${s.blocks.length+1}`, questionCount: 10}]})} className="text-xs text-insanus-red hover:underline">+ Adicionar Bloco</button>
                                </div>
                            )}
                            <div className="mt-4 pt-2 border-t border-[#333]">
                                <label className="text-[10px] text-gray-500 font-bold uppercase">Mínimo % Geral para Aprovação</label>
                                <input type="number" value={s.minTotalPercent || 0} onChange={e => updateSimulado({...s, minTotalPercent: Number(e.target.value)})} className="ml-2 w-16 bg-black p-1 text-xs text-white border border-white/10 rounded"/> <span className="text-xs">%</span>
                            </div>
                        </div>

                        <div className="bg-[#121212] p-4 rounded-xl border border-[#333] w-full">
                            <h4 className="text-sm font-bold text-white mb-4">Gabarito e Configuração das Questões</h4>
                            <div className="grid grid-cols-1 gap-2">
                                {Array.from({length: s.totalQuestions}).map((_, i) => {
                                    const qNum = i + 1;
                                    const diag = s.diagnosisMap[qNum] || { discipline: '', topic: '' };
                                    const ans = s.correctAnswers[qNum] || '';
                                    const val = s.questionValues[qNum] || 1;
                                    return (
                                        <div key={qNum} className="flex flex-wrap items-center gap-2 bg-[#1E1E1E] p-2 rounded border border-[#333] hover:border-white/20">
                                            <div className="w-8 h-8 flex items-center justify-center bg-white/10 rounded font-bold text-xs shrink-0">{qNum}</div>
                                            <div className="flex flex-col shrink-0">
                                                <label className="text-[8px] uppercase text-gray-500">Resp.</label>
                                                <input value={ans} onChange={e => updateSimulado({ ...s, correctAnswers: {...s.correctAnswers, [qNum]: e.target.value.toUpperCase()} })} className="w-10 bg-black text-center text-xs font-bold text-insanus-red p-1 rounded border border-white/10" maxLength={1} />
                                            </div>
                                            <div className="flex flex-col shrink-0">
                                                <label className="text-[8px] uppercase text-gray-500">Pontos</label>
                                                <input type="number" value={val} onChange={e => updateSimulado({ ...s, questionValues: {...s.questionValues, [qNum]: Number(e.target.value)} })} className="w-12 bg-black text-center text-xs p-1 rounded border border-white/10" />
                                            </div>
                                            {s.hasDiagnosis && (
                                                <>
                                                    <div className="flex flex-col flex-1 min-w-[100px]">
                                                        <label className="text-[8px] uppercase text-gray-500">Disciplina</label>
                                                        <input value={diag.discipline} onChange={e => updateSimulado({ ...s, diagnosisMap: {...s.diagnosisMap, [qNum]: {...diag, discipline: e.target.value}} })} className="bg-black text-xs p-1 rounded border border-white/10 w-full" placeholder="Ex: Direito Const." />
                                                    </div>
                                                    <div className="flex flex-col flex-1 min-w-[100px]">
                                                        <label className="text-[8px] uppercase text-gray-500">Assunto/Tópico</label>
                                                        <input value={diag.topic} onChange={e => updateSimulado({ ...s, diagnosisMap: {...s.diagnosisMap, [qNum]: {...diag, topic: e.target.value}} })} className="bg-black text-xs p-1 rounded border border-white/10 w-full" placeholder="Ex: Direitos Fund." />
                                                    </div>
                                                    <div className="flex flex-col flex-1 min-w-[100px]">
                                                        <label className="text-[8px] uppercase text-gray-500">Obs (Opcional)</label>
                                                        <input value={diag.observation || ''} onChange={e => updateSimulado({ ...s, diagnosisMap: {...s.diagnosisMap, [qNum]: {...diag, observation: e.target.value}} })} className="bg-black text-xs p-1 rounded border border-white/10 w-full" placeholder="Comentário..." />
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
    
    // List view when no simulado selected
    return (
         <div className="flex flex-col h-full w-full bg-[#050505]">
            <div className="flex items-center justify-between border-b border-[#333] p-4 bg-[#0F0F0F] shrink-0 w-full">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="text-gray-400 hover:text-white shrink-0"><Icon.ArrowUp className="-rotate-90 w-6 h-6"/></button>
                    <div>
                        <h2 className="font-bold text-white uppercase">{simClass.name}</h2>
                        <input 
                            value={simClass.name} 
                            onChange={e => onUpdate({...simClass, name: e.target.value})} 
                            className="bg-transparent text-xs text-gray-400 focus:text-white border-b border-transparent focus:border-white/20 outline-none"
                            placeholder="Editar nome da turma..."
                        />
                    </div>
                </div>
                <button onClick={addSimulado} className="bg-insanus-red text-white px-4 py-2 rounded text-xs font-bold uppercase shadow-neon shrink-0">+ Novo Simulado</button>
            </div>
            <div className="flex-1 p-6 overflow-y-auto custom-scrollbar w-full">
                {simClass.simulados.length === 0 ? (
                    <div className="text-center py-20 text-gray-600 italic">Nenhum simulado nesta turma.</div>
                ) : (
                    <div className="grid gap-4 w-full grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {simClass.simulados.map((sim, idx) => (
                            <div key={sim.id} className="bg-[#121212] border border-[#333] p-4 rounded flex justify-between items-center hover:bg-[#1E1E1E] transition w-full">
                                <div className="flex items-center gap-4">
                                    <span className="text-gray-500 font-mono text-sm shrink-0">{idx + 1}.</span>
                                    <div>
                                        <h4 className="text-white font-bold">{sim.title}</h4>
                                        <span className="text-xs text-gray-500">{sim.totalQuestions} Questões • {sim.type}</span>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => setSelectedSimulado(sim)} className="bg-blue-600/20 text-blue-400 px-3 py-1 rounded text-xs font-bold border border-blue-600/20 hover:bg-blue-600 hover:text-white transition">EDITAR</button>
                                    <button onClick={() => deleteSimulado(sim.id)} className="text-gray-500 hover:text-red-500 p-2"><Icon.Trash className="w-4 h-4"/></button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
         </div>
    );
};

interface PlanDetailEditorProps {
    plan: StudyPlan;
    onUpdate: (p: StudyPlan) => void;
    onBack: () => void;
}

const PlanDetailEditor: React.FC<PlanDetailEditorProps> = ({ plan, onUpdate, onBack }) => {
    const [tab, setTab] = useState<'struct' | 'cycles' | 'edital'>('struct');
    const [saving, setSaving] = useState(false);
    const [uploadingCover, setUploadingCover] = useState(false);
    const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({});
    const [editalExpandedMap, setEditalExpandedMap] = useState<Record<string, boolean>>({}); 
    const [newContestName, setNewContestName] = useState('');
    const [showSimuladoLinks, setShowSimuladoLinks] = useState(false);
    
    // New: Fetch all classes to allow linking
    const [allSimuladoClasses, setAllSimuladoClasses] = useState<SimuladoClass[]>([]);

    useEffect(() => {
        const loadClasses = async () => {
            const classes = await fetchSimuladoClassesFromDB();
            setAllSimuladoClasses(classes);
        };
        loadClasses();
    }, []);

    const toggleExpand = (id: string) => setExpandedMap(prev => ({ ...prev, [id]: !prev[id] }));
    const isExpanded = (id: string) => !!expandedMap[id];

    // New: Helper for Edital Accordion
    const toggleEditalExpand = (id: string) => setEditalExpandedMap(prev => ({ ...prev, [id]: !prev[id] }));
    const isEditalExpanded = (id: string) => !!editalExpandedMap[id];
    
    const handleSync = async () => {
        setSaving(true);
        try {
            await savePlanToDB(plan);
            await new Promise(r => setTimeout(r, 800)); 
            alert("Plano sincronizado com sucesso!");
        } catch (e) { alert("Erro ao salvar."); } 
        finally { setSaving(false); }
    };

    const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || !e.target.files[0]) return;
        setUploadingCover(true);
        try {
            const url = await uploadFileToStorage(e.target.files[0], 'covers');
            onUpdate({ ...plan, coverImage: url });
        } catch (err) { alert("Erro ao enviar imagem."); } 
        finally { setUploadingCover(false); }
    };

    const addContest = () => {
        if(!newContestName.trim()) return;
        const current = plan.linkedContests || [];
        if(current.includes(newContestName.toUpperCase())) return;
        onUpdate({ ...plan, linkedContests: [...current, newContestName.toUpperCase()] });
        setNewContestName('');
    }
    const removeContest = (name: string) => {
        onUpdate({ ...plan, linkedContests: (plan.linkedContests || []).filter(c => c !== name) });
    }

    const toggleLinkedSimuladoClass = (classId: string) => {
        const current = plan.linkedSimuladoClasses || [];
        const updated = current.includes(classId)
            ? current.filter(id => id !== classId)
            : [...current, classId];
        onUpdate({ ...plan, linkedSimuladoClasses: updated });
    }

    // Structure Helpers
    const addFolder = () => {
        const newFolder: Folder = { id: uuid(), name: 'Nova Pasta', order: plan.folders.length };
        setExpandedMap(prev => ({ ...prev, [newFolder.id]: true }));
        onUpdate({ ...plan, folders: [...plan.folders, newFolder] });
    };
    const deleteFolder = (fid: string) => {
        const updatedDisciplines = plan.disciplines.map(d => d.folderId === fid ? { ...d, folderId: undefined } : d);
        onUpdate({ ...plan, folders: plan.folders.filter(f => f.id !== fid), disciplines: updatedDisciplines as Discipline[] });
    };
    const addDiscipline = (folderId?: string) => {
        const newDisc: Discipline = { id: uuid(), name: 'Nova Disciplina', folderId, subjects: [], order: 99 };
        setExpandedMap(prev => ({ ...prev, [newDisc.id]: true }));
        onUpdate({ ...plan, disciplines: [...plan.disciplines, newDisc] });
    };
    const deleteDiscipline = (did: string) => onUpdate({ ...plan, disciplines: plan.disciplines.filter(d => d.id !== did) });
    const moveDiscipline = (discId: string, newFolderId: string) => {
        const updatedDiscs = plan.disciplines.map(d => d.id === discId ? { ...d, folderId: newFolderId || undefined } : d);
        onUpdate({ ...plan, disciplines: updatedDiscs as Discipline[] });
    };
    const addSubject = (discId: string) => {
        const discIndex = plan.disciplines.findIndex(d => d.id === discId);
        if (discIndex === -1) return;
        const newSub: Subject = { id: uuid(), name: 'Novo Assunto', goals: [], order: 99 };
        setExpandedMap(prev => ({ ...prev, [newSub.id]: true }));
        const newDiscs = [...plan.disciplines];
        newDiscs[discIndex].subjects.push(newSub);
        onUpdate({ ...plan, disciplines: newDiscs });
    };
    const deleteSubject = (discId: string, subId: string) => {
        const discIndex = plan.disciplines.findIndex(d => d.id === discId);
        if (discIndex === -1) return;
        const newDiscs = [...plan.disciplines];
        newDiscs[discIndex].subjects = newDiscs[discIndex].subjects.filter(s => s.id !== subId);
        onUpdate({ ...plan, disciplines: newDiscs });
    };
    const addGoal = (discId: string, subId: string) => {
        const discIndex = plan.disciplines.findIndex(d => d.id === discId);
        if (discIndex === -1) return;
        const subIndex = plan.disciplines[discIndex].subjects.findIndex(s => s.id === subId);
        if (subIndex === -1) return;
        const newGoal: Goal = { id: uuid(), title: 'Nova Meta', type: 'AULA', order: 99, link: '', pdfUrl: '', subGoals: [], pages: 0, color: '#333333' };
        const newDiscs = [...plan.disciplines];
        newDiscs[discIndex].subjects[subIndex].goals.push(newGoal);
        onUpdate({ ...plan, disciplines: newDiscs });
    };
    const updateGoal = (discId: string, subId: string, goal: Goal) => {
        const discIndex = plan.disciplines.findIndex(d => d.id === discId);
        const subIndex = plan.disciplines[discIndex].subjects.findIndex(s => s.id === subId);
        const goalIndex = plan.disciplines[discIndex].subjects[subIndex].goals.findIndex(g => g.id === goal.id);
        const newDiscs = [...plan.disciplines];
        newDiscs[discIndex].subjects[subIndex].goals[goalIndex] = goal;
        onUpdate({ ...plan, disciplines: newDiscs });
    };
    const deleteGoal = (discId: string, subId: string, goalId: string) => {
        const discIndex = plan.disciplines.findIndex(d => d.id === discId);
        const subIndex = plan.disciplines[discIndex].subjects.findIndex(s => s.id === subId);
        const newDiscs = [...plan.disciplines];
        newDiscs[discIndex].subjects[subIndex].goals = newDiscs[discIndex].subjects[subIndex].goals.filter(g => g.id !== goalId);
        onUpdate({ ...plan, disciplines: newDiscs });
    };

    // Cycles & Edital
    const addCycle = () => onUpdate({ ...plan, cycles: [...plan.cycles, { id: uuid(), name: 'Novo Ciclo', items: [], order: plan.cycles.length }] });
    const updateCycle = (uc: Cycle) => onUpdate({ ...plan, cycles: plan.cycles.map(c => c.id === uc.id ? uc : c) });
    const deleteCycle = (cid: string) => onUpdate({ ...plan, cycles: plan.cycles.filter(c => c.id !== cid) });
    
    // Edital Actions
    const addEditalDiscipline = () => {
        const newDisc: EditalDiscipline = { id: uuid(), name: 'Nova Disciplina', topics: [], order: 0 };
        setEditalExpandedMap(prev => ({ ...prev, [newDisc.id]: true })); // Auto expand new
        onUpdate({ ...plan, editalVerticalizado: [...(plan.editalVerticalizado || []), newDisc] });
    };
    const updateEditalDiscipline = (i: number, n: string) => { const ne = [...(plan.editalVerticalizado||[])]; ne[i].name = n; onUpdate({...plan, editalVerticalizado: ne}); };
    const deleteEditalDiscipline = (i: number) => onUpdate({ ...plan, editalVerticalizado: (plan.editalVerticalizado||[]).filter((_, idx) => idx !== i) });
    const addEditalTopic = (i: number) => { const ne = [...(plan.editalVerticalizado||[])]; ne[i].topics.push({id: uuid(), name: 'Novo Tópico', links: {}, order: 0}); onUpdate({...plan, editalVerticalizado: ne}); };
    const updateEditalTopic = (di: number, ti: number, t: EditalTopic) => { const ne = [...(plan.editalVerticalizado||[])]; ne[di].topics[ti] = t; onUpdate({...plan, editalVerticalizado: ne}); };
    const deleteEditalTopic = (di: number, ti: number) => { const ne = [...(plan.editalVerticalizado||[])]; ne[di].topics = ne[di].topics.filter((_, idx) => idx !== ti); onUpdate({...plan, editalVerticalizado: ne}); };

    const renderDiscipline = (disc: Discipline) => (
        <div key={disc.id} className="ml-4 border-l-2 border-[#333] pl-4 mb-6">
            <div className="flex justify-between items-center mb-4 bg-[#1E1E1E] p-2 rounded-lg hover:bg-white/10 transition w-full">
                <div className="flex items-center gap-3 flex-1">
                    <button onClick={() => toggleExpand(disc.id)} className={`text-gray-400 hover:text-white transition-transform shrink-0 ${isExpanded(disc.id) ? 'rotate-180' : ''}`}><Icon.ChevronDown className="w-5 h-5" /></button>
                    <div className="w-2 h-2 rounded-full bg-insanus-red shadow-neon shrink-0"></div>
                    <input value={disc.name} onChange={e => { const nd = plan.disciplines.map(d => d.id === disc.id ? {...d, name: e.target.value} : d); onUpdate({...plan, disciplines: nd}); }} className="bg-transparent font-bold text-gray-200 focus:outline-none text-base w-full" />
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <select className="bg-black text-[10px] text-gray-400 border border-[#333] rounded p-1 outline-none max-w-[120px]" value={disc.folderId || ''} onChange={(e) => moveDiscipline(disc.id, e.target.value)}>
                        <option value="">(Sem Pasta)</option>
                        {plan.folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                    <button onClick={() => addSubject(disc.id)} className="text-[10px] bg-white/10 hover:bg-white/20 text-white px-3 py-1 rounded font-bold uppercase transition">+ Assunto</button>
                    <SafeDeleteBtn onDelete={() => deleteDiscipline(disc.id)} />
                </div>
            </div>
            {isExpanded(disc.id) && (
                <div className="space-y-4 pl-2 animate-fade-in w-full">
                    {disc.subjects.map(sub => (
                        <div key={sub.id} className="bg-[#121212] rounded-xl border border-[#333] p-4 relative group w-full">
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-white/10 group-hover:bg-insanus-red/50 transition-colors"></div>
                            <div className="flex justify-between items-center mb-4 w-full">
                                <div className="flex items-center gap-2 flex-1">
                                    <button onClick={() => toggleExpand(sub.id)} className={`text-gray-500 hover:text-white transition-transform shrink-0 ${isExpanded(sub.id) ? 'rotate-180' : ''}`}><Icon.ChevronDown className="w-4 h-4" /></button>
                                    <input value={sub.name} onChange={e => { const idx = plan.disciplines.findIndex(d => d.id === disc.id); const nd = [...plan.disciplines]; const subIdx = nd[idx].subjects.findIndex(s => s.id === sub.id); nd[idx].subjects[subIdx].name = e.target.value; onUpdate({...plan, disciplines: nd}); }} className="bg-transparent font-bold text-insanus-red focus:text-white focus:outline-none text-sm w-full uppercase" />
                                </div>
                                <div className="flex gap-2 shrink-0">
                                    <button onClick={() => addGoal(disc.id, sub.id)} className="text-[10px] bg-insanus-red hover:bg-red-600 px-3 py-1 rounded text-white font-bold shadow-neon">+ META</button>
                                    <SafeDeleteBtn onDelete={() => deleteSubject(disc.id, sub.id)} />
                                </div>
                            </div>
                            {isExpanded(sub.id) && (
                                <div className="space-y-2 animate-fade-in w-full">
                                    {sub.goals.map(goal => (
                                        <GoalEditor key={goal.id} goal={goal} onUpdate={(g) => updateGoal(disc.id, sub.id, g)} onDelete={() => deleteGoal(disc.id, sub.id, goal.id)} />
                                    ))}
                                    {sub.goals.length === 0 && <div className="text-[10px] text-gray-600 italic text-center py-2">Nenhuma meta criada.</div>}
                                </div>
                            )}
                        </div>
                    ))}
                    {disc.subjects.length === 0 && <div className="text-gray-600 italic text-xs ml-4">Nenhum assunto cadastrado.</div>}
                </div>
            )}
        </div>
    );

    return (
        <div className="flex flex-col h-full w-full bg-[#050505] text-white overflow-hidden">
             <div className="h-16 border-b border-[#333] flex items-center justify-between px-6 shrink-0 bg-[#0F0F0F] z-20 w-full">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="text-gray-500 hover:text-white shrink-0"><Icon.ArrowUp className="-rotate-90 w-6 h-6" /></button>
                    <span className="text-gray-500 font-mono text-xs uppercase shrink-0">Editando Plano</span>
                </div>
                <div className="flex gap-4 shrink-0">
                    <button onClick={handleSync} disabled={saving} className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 shadow-neon">
                        {saving ? <Icon.RefreshCw className="w-4 h-4 animate-spin" /> : <Icon.Check className="w-4 h-4" />} {saving ? 'SALVANDO...' : 'SALVAR E SINCRONIZAR'}
                    </button>
                    <div className="h-8 w-px bg-white/10 mx-2"></div>
                    <button onClick={() => setTab('struct')} className={`px-4 py-2 text-xs font-bold rounded ${tab==='struct' ? 'bg-insanus-red text-white' : 'text-gray-500 hover:text-white'}`}>ESTRUTURA</button>
                    <button onClick={() => setTab('cycles')} className={`px-4 py-2 text-xs font-bold rounded ${tab==='cycles' ? 'bg-insanus-red text-white' : 'text-gray-500 hover:text-white'}`}>CICLOS</button>
                    <button onClick={() => setTab('edital')} className={`px-4 py-2 text-xs font-bold rounded flex items-center gap-2 ${tab==='edital' ? 'bg-insanus-red text-white' : 'text-gray-500 hover:text-white'}`}><Icon.List className="w-3 h-3"/> EDITAL</button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar w-full">
                <div className="w-full">
                    <div className="flex flex-col md:flex-row gap-8 mb-10 items-start border-b border-[#333] pb-8 w-full">
                        <div className="shrink-0 group relative w-40 h-40 rounded-2xl border-2 border-dashed border-[#333] bg-[#121212] overflow-hidden hover:border-insanus-red transition-colors shadow-lg">
                            {plan.coverImage ? ( <img src={plan.coverImage} className="w-full h-full object-cover" /> ) : ( <div className="flex flex-col items-center justify-center h-full text-gray-500"><Icon.Image className="w-8 h-8 mb-2" /><span className="text-[10px] uppercase font-bold text-center px-2">Sem Capa</span></div> )}
                            <label className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white text-xs font-bold text-center p-2">
                                {uploadingCover ? <Icon.RefreshCw className="w-6 h-6 animate-spin mb-1"/> : <Icon.Edit className="w-6 h-6 mb-1 text-insanus-red" />} {uploadingCover ? 'ENVIANDO' : 'ALTERAR CAPA'}
                                <input type="file" className="hidden" accept="image/*" onChange={handleCoverUpload} disabled={uploadingCover} />
                            </label>
                        </div>
                        <div className="flex-1 pt-2 w-full">
                            <div className="flex justify-between items-start">
                                <div className="flex-1">
                                    <label className="text-xs font-bold text-insanus-red uppercase tracking-widest mb-2 block">Nome do Plano</label>
                                    <input value={plan.name} onChange={e => onUpdate({...plan, name: e.target.value})} className="bg-transparent text-4xl font-black text-white focus:outline-none border-b border-[#333] focus:border-insanus-red placeholder-gray-700 w-full mb-6 pb-2" placeholder="Digite o nome do plano..." />
                                </div>
                                <div className="ml-8">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1 block">Categoria</label>
                                    <select value={plan.category || 'CARREIRAS_POLICIAIS'} onChange={e => onUpdate({...plan, category: e.target.value as PlanCategory})} className="bg-black border border-[#333] rounded-lg p-2 text-xs text-white uppercase font-bold outline-none focus:border-insanus-red mb-4 w-full">
                                        <option value="CARREIRAS_POLICIAIS">Carreiras Policiais</option>
                                        <option value="CARREIRAS_TRIBUNAIS">Carreiras de Tribunais</option>
                                        <option value="CARREIRAS_ADMINISTRATIVAS">Carreiras Administrativas</option>
                                        <option value="CARREIRAS_JURIDICAS">Carreiras Jurídicas</option>
                                        <option value="ENEM">ENEM</option>
                                        <option value="OUTROS">Outros</option>
                                    </select>

                                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1 block">Sistema de Ciclo</label>
                                    <select 
                                        value={plan.cycleSystem || 'continuo'} 
                                        onChange={e => onUpdate({...plan, cycleSystem: e.target.value as 'continuo' | 'rotativo'})} 
                                        className="bg-black border border-[#333] rounded-lg p-2 text-xs text-white uppercase font-bold outline-none focus:border-insanus-red w-full"
                                    >
                                        <option value="continuo">CONTÍNUO (Terminar Ciclo para Avançar)</option>
                                        <option value="rotativo">ROTATIVO (Rodadas entre Ciclos)</option>
                                    </select>
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <div className="bg-[#121212] px-6 py-3 rounded-xl border border-[#333] flex flex-col"><span className="text-2xl font-black text-white leading-none">{plan.disciplines.length}</span><span className="text-[9px] text-gray-500 uppercase font-bold tracking-wider mt-1">Disciplinas</span></div>
                                <div className="bg-[#121212] px-6 py-3 rounded-xl border border-[#333] flex flex-col"><span className="text-2xl font-black text-white leading-none">{plan.cycles.length}</span><span className="text-[9px] text-gray-500 uppercase font-bold tracking-wider mt-1">Ciclos</span></div>
                                <div className="bg-[#121212] px-6 py-3 rounded-xl border border-[#333] flex flex-col">
                                    <span className="text-2xl font-black text-white leading-none">{plan.linkedSimuladoClasses?.length || 0}</span>
                                    <span className="text-[9px] text-gray-500 uppercase font-bold tracking-wider mt-1">Turmas Vinc.</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {tab === 'struct' && (
                        <div className="w-full space-y-12">
                            <div className="flex justify-end">
                                <button onClick={() => setShowSimuladoLinks(!showSimuladoLinks)} className="text-xs font-bold text-gray-500 hover:text-white flex items-center gap-2 transition">
                                    <Icon.Link className="w-4 h-4"/> {showSimuladoLinks ? 'Ocultar Vínculos' : 'Gerenciar Vínculos de Simulados'}
                                </button>
                            </div>
                            
                            {showSimuladoLinks && (
                                <div className="bg-[#1E1E1E] p-6 rounded-xl border border-[#333] mb-8 animate-fade-in w-full">
                                    <h4 className="text-sm font-bold text-white uppercase mb-4 flex items-center gap-2">Vincular Turmas de Simulado</h4>
                                    <div className="flex flex-wrap gap-3">
                                        {allSimuladoClasses.map(cls => {
                                            const isLinked = plan.linkedSimuladoClasses?.includes(cls.id);
                                            return (
                                                <button 
                                                    key={cls.id}
                                                    onClick={() => toggleLinkedSimuladoClass(cls.id)}
                                                    className={`px-4 py-2 rounded-lg border text-xs font-bold uppercase transition-all flex items-center gap-2 ${isLinked ? 'bg-blue-900/30 border-blue-500 text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.2)]' : 'bg-black/30 border-white/10 text-gray-500 hover:border-white/30 hover:text-gray-300'}`}
                                                >
                                                    {isLinked && <Icon.Check className="w-4 h-4"/>}
                                                    {cls.name}
                                                </button>
                                            )
                                        })}
                                        {allSimuladoClasses.length === 0 && <span className="text-gray-600 italic text-xs">Nenhuma turma de simulado cadastrada no sistema.</span>}
                                    </div>
                                </div>
                            )}

                            <div className="bg-[#121212] rounded-xl border border-[#333] overflow-hidden w-full">
                                <div className="bg-[#1E1E1E] p-4 flex justify-between items-center border-b border-[#333]">
                                    <div className="flex items-center gap-3"><Icon.BookOpen className="w-5 h-5 text-gray-400" /><span className="font-black text-gray-200 uppercase tracking-widest text-sm">Disciplinas Gerais (Sem Pasta)</span></div>
                                    <button onClick={() => addDiscipline()} className="text-[10px] bg-white/10 hover:bg-white/20 text-white px-3 py-1 rounded font-bold transition">+ NOVA DISCIPLINA</button>
                                </div>
                                <div className="p-6 bg-[#121212] w-full">
                                    {plan.disciplines.filter(d => !d.folderId).map(renderDiscipline)}
                                    {plan.disciplines.filter(d => !d.folderId).length === 0 && (<div className="text-center py-8 text-gray-600 text-xs font-mono border border-dashed border-[#333] rounded">Nenhuma disciplina solta. Crie uma aqui ou mova de uma pasta.</div>)}
                                </div>
                            </div>
                            <div className="space-y-8 w-full">
                                <div className="flex items-center justify-between border-b border-[#333] pb-4 w-full">
                                    <h3 className="text-lg font-black text-white uppercase">Pastas de Organização</h3>
                                    <button onClick={addFolder} className="text-xs bg-insanus-red hover:bg-red-600 text-white px-4 py-2 rounded font-bold flex items-center gap-2"><Icon.FolderPlus className="w-4 h-4" /> NOVA PASTA</button>
                                </div>
                                {plan.folders.map(folder => (
                                    <div key={folder.id} className="bg-[#121212] rounded-xl border border-[#333] overflow-hidden transition-all duration-300 w-full">
                                        <div className="bg-[#1E1E1E] p-4 flex justify-between items-center border-b border-[#333]">
                                            <div className="flex items-center gap-3">
                                                <button onClick={() => toggleExpand(folder.id)} className={`text-gray-400 hover:text-white transition-transform ${isExpanded(folder.id) ? 'rotate-180' : ''}`}><Icon.ChevronDown className="w-5 h-5" /></button>
                                                <Icon.Folder className="w-5 h-5 text-insanus-red" />
                                                <input value={folder.name} onChange={e => { const nf = plan.folders.map(f => f.id === folder.id ? {...f, name: e.target.value} : f); onUpdate({...plan, folders: nf}); }} className="bg-transparent font-bold text-white focus:outline-none w-64 text-lg" />
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <button onClick={() => addDiscipline(folder.id)} className="text-[10px] bg-insanus-red/20 text-insanus-red px-3 py-1 rounded hover:bg-insanus-red hover:text-white font-bold transition">+ DISCIPLINA</button>
                                                <SafeDeleteBtn onDelete={() => deleteFolder(folder.id)} />
                                            </div>
                                        </div>
                                        {isExpanded(folder.id) && (
                                            <div className="p-6 animate-fade-in w-full">
                                                {plan.disciplines.filter(d => d.folderId === folder.id).map(renderDiscipline)}
                                                {plan.disciplines.filter(d => d.folderId === folder.id).length === 0 && <div className="text-xs text-gray-600 italic ml-4">Esta pasta está vazia.</div>}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    
                    {tab === 'cycles' && (
                        <div className="w-full">
                            <div className="flex justify-between items-center mb-8 border-b border-[#333] pb-4 w-full">
                                <div><h3 className="text-2xl font-black text-white uppercase">Gestão de Ciclos</h3><p className="text-gray-500 text-xs">Crie sequências de estudo rotativas. Você pode incluir simulados das turmas vinculadas.</p></div>
                                <button onClick={addCycle} className="bg-insanus-red hover:bg-red-600 text-white px-4 py-2 rounded font-bold flex items-center gap-2"><Icon.Plus className="w-4 h-4" /> NOVO CICLO</button>
                            </div>
                            {plan.cycles.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-64 text-gray-500 border border-dashed border-[#333] rounded-2xl w-full"><Icon.RefreshCw className="w-12 h-12 mb-4 opacity-50"/><p>Nenhum ciclo criado.</p><button onClick={addCycle} className="mt-4 text-insanus-red hover:underline text-sm font-bold">Criar Primeiro Ciclo</button></div>
                            ) : ( 
                                <div className="w-full">
                                    {plan.cycles.map(cycle => ( 
                                        <CycleEditor 
                                            key={cycle.id} 
                                            cycle={cycle} 
                                            allDisciplines={plan.disciplines} 
                                            allFolders={plan.folders}
                                            linkedSimulados={allSimuladoClasses.filter(c => plan.linkedSimuladoClasses?.includes(c.id))}
                                            onUpdate={updateCycle} 
                                            onDelete={() => deleteCycle(cycle.id)} 
                                        /> 
                                    ))}
                                </div> 
                            )}
                        </div>
                    )}
                    
                    {tab === 'edital' && (
                        <div className="w-full space-y-8 animate-fade-in">
                            <div className="flex justify-between items-center mb-8 border-b border-[#333] pb-4 w-full">
                                <div><h3 className="text-2xl font-black text-white uppercase">Edital Verticalizado</h3><p className="text-gray-500 text-xs">Organize os tópicos e vincule as metas.</p></div>
                                <button onClick={addEditalDiscipline} className="bg-insanus-red hover:bg-red-600 text-white px-4 py-2 rounded font-bold flex items-center gap-2"><Icon.Plus className="w-4 h-4" /> NOVA DISCIPLINA DO EDITAL</button>
                            </div>
                            {plan.category === 'CARREIRAS_POLICIAIS' && (
                                <div className="mb-8 p-6 bg-[#121212] border border-[#333] rounded-xl w-full">
                                    <div className="flex items-center justify-between mb-4"><h4 className="text-lg font-bold text-white uppercase flex items-center gap-2"><Icon.User className="w-5 h-5 text-insanus-red" /> IDENTIFICAR CONCURSOS</h4></div>
                                    <div className="flex gap-2 mb-4">
                                        <input value={newContestName} onChange={(e) => setNewContestName(e.target.value)} className="bg-black border border-white/10 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-insanus-red flex-1" placeholder="Ex: PF, PRF..." />
                                        <button onClick={addContest} className="bg-insanus-red text-white px-6 rounded-lg font-bold text-xs uppercase hover:bg-red-600 transition">Adicionar</button>
                                    </div>
                                    <div className="flex flex-wrap gap-2">{plan.linkedContests?.map(c => ( <div key={c} className="bg-insanus-red/20 border border-insanus-red text-insanus-red px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2">{c}<button onClick={() => removeContest(c)} className="hover:text-white"><Icon.Trash className="w-3 h-3" /></button></div> ))}</div>
                                </div>
                            )}
                            {(!plan.editalVerticalizado || plan.editalVerticalizado.length === 0) ? (
                                <div className="flex flex-col items-center justify-center h-64 text-gray-500 border border-dashed border-[#333] rounded-2xl w-full"><Icon.List className="w-12 h-12 mb-4 opacity-50"/><p>Edital vazio.</p><button onClick={addEditalDiscipline} className="mt-4 text-insanus-red hover:underline text-sm font-bold">Criar Estrutura</button></div>
                            ) : (
                                <div className="grid gap-8 w-full">
                                    {plan.editalVerticalizado.map((disc, dIdx) => (
                                        <div key={disc.id} className="bg-[#121212] rounded-xl border border-[#333] overflow-hidden w-full">
                                            <div className="bg-[#1E1E1E] p-4 flex justify-between items-center border-b border-[#333]">
                                                <div className="flex items-center gap-3 flex-1">
                                                    <button onClick={() => toggleEditalExpand(disc.id)} className={`text-gray-400 hover:text-white transition-transform ${isEditalExpanded(disc.id) ? 'rotate-180' : ''}`}>
                                                        <Icon.ChevronDown className="w-5 h-5"/>
                                                    </button>
                                                    <div className="w-2 h-8 bg-insanus-red rounded shrink-0"></div>
                                                    <input value={disc.name} onChange={e => updateEditalDiscipline(dIdx, e.target.value)} className="bg-transparent font-black text-white focus:outline-none w-full text-lg uppercase" placeholder="NOME DA DISCIPLINA" />
                                                </div>
                                                <div className="flex items-center gap-3"><button onClick={() => addEditalTopic(dIdx)} className="text-[10px] bg-insanus-red/20 text-insanus-red px-3 py-1 rounded hover:bg-insanus-red hover:text-white font-bold transition">+ TÓPICO</button><SafeDeleteBtn onDelete={() => deleteEditalDiscipline(dIdx)} /></div>
                                            </div>
                                            
                                            {isEditalExpanded(disc.id) && (
                                                <div className="p-4 bg-[#121212] w-full animate-fade-in">
                                                    {disc.topics.map((topic, tIdx) => ( <EditalTopicEditor key={topic.id} topic={topic} plan={plan} onUpdate={(updatedTopic) => updateEditalTopic(dIdx, tIdx, updatedTopic)} onDelete={() => deleteEditalTopic(dIdx, tIdx)} /> ))}
                                                    {disc.topics.length === 0 && <div className="text-center text-gray-600 text-xs italic py-4">Nenhum tópico cadastrado.</div>}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

interface AdminDashboardProps {
    user: User;
    onSwitchToUser: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ user, onSwitchToUser }) => {
    const [view, setView] = useState<'PLANS' | 'USERS' | 'SIMULADOS'>('PLANS');
    const [plans, setPlans] = useState<StudyPlan[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [classes, setClasses] = useState<SimuladoClass[]>([]);
    
    const [editingPlan, setEditingPlan] = useState<StudyPlan | null>(null);
    const [editingClass, setEditingClass] = useState<SimuladoClass | null>(null);
    const [isCreatingUser, setIsCreatingUser] = useState(false);
    const [userToEdit, setUserToEdit] = useState<User | null>(null);
    
    const [showEmbedModal, setShowEmbedModal] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        const [p, u, c] = await Promise.all([
            fetchPlansFromDB(),
            fetchUsersFromDB(),
            fetchSimuladoClassesFromDB()
        ]);
        setPlans(p);
        setUsers(u);
        setClasses(c);
    };

    const handleCreatePlan = async () => {
        const newPlan: StudyPlan = {
            id: uuid(),
            name: 'Novo Plano',
            category: 'CARREIRAS_POLICIAIS',
            coverImage: '',
            folders: [],
            disciplines: [],
            cycles: [],
            cycleSystem: 'continuo',
            linkedSimuladoClasses: []
        };
        await savePlanToDB(newPlan);
        setEditingPlan(newPlan);
        loadData();
    };

    const handleCreateClass = async () => {
        const newClass: SimuladoClass = {
            id: uuid(),
            name: 'Nova Turma de Simulados',
            simulados: []
        };
        await saveSimuladoClassToDB(newClass);
        setEditingClass(newClass);
        loadData();
    };

    const handleUserSave = async (updatedUser: User) => {
        try {
            await saveUserToDB(updatedUser);
            setIsCreatingUser(false);
            setUserToEdit(null);
            loadData();
        } catch(e) {
            alert("Erro ao salvar usuário.");
        }
    };

    const toggleUserPlan = async (u: User, planId: string) => {
        const allowed = u.allowedPlans.includes(planId) 
            ? u.allowedPlans.filter(id => id !== planId)
            : [...u.allowedPlans, planId];
        const updated = { ...u, allowedPlans: allowed };
        await saveUserToDB(updated);
        loadData();
    };

    const toggleUserClass = async (u: User, classId: string) => {
        const allowed = u.allowedSimuladoClasses?.includes(classId)
            ? u.allowedSimuladoClasses.filter(id => id !== classId)
            : [...(u.allowedSimuladoClasses || []), classId];
        const updated = { ...u, allowedSimuladoClasses: allowed };
        await saveUserToDB(updated);
        loadData();
    };

    const deleteUser = async (uid: string) => {
        if (confirm("Deletar usuário permanentemente?")) {
            await deleteUserFromDB(uid);
            loadData();
        }
    };

    const renderContent = () => {
        if (editingPlan) {
            return <PlanDetailEditor plan={editingPlan} onUpdate={setEditingPlan} onBack={() => { setEditingPlan(null); loadData(); }} />;
        }
        if (editingClass) {
            return <SimuladoEditor simClass={editingClass} onUpdate={setEditingClass} onBack={() => { setEditingClass(null); loadData(); }} />;
        }

        return (
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 w-full animate-fade-in">
                <div className="w-full">
                    {view === 'PLANS' && (
                        <div className="animate-fade-in w-full">
                                <div className="flex justify-between items-center mb-6 border-b border-[#333] pb-4">
                                <h2 className="text-2xl font-black uppercase text-white">Planos Cadastrados</h2>
                                <button onClick={handleCreatePlan} className="bg-insanus-red hover:bg-red-600 px-6 py-3 rounded-lg font-bold text-xs text-white shadow-neon transition transform hover:scale-105">+ CRIAR PLANO</button>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 w-full">
                                    {plans.map(p => (
                                        <div key={p.id} className="bg-[#121212] border border-[#333] p-6 rounded-xl flex flex-col gap-4 justify-between hover:border-insanus-red/50 transition group w-full">
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-center gap-4 w-full">
                                                    {p.coverImage ? <img src={p.coverImage} className="w-24 h-24 rounded-lg object-cover border border-white/10 shrink-0" /> : <div className="w-24 h-24 bg-white/5 rounded-lg flex items-center justify-center border border-white/10 shrink-0"><Icon.Image className="w-10 h-10 text-gray-500"/></div>}
                                                    <div className="flex-1 min-w-0">
                                                        <h3 className="font-bold text-xl text-white leading-tight group-hover:text-insanus-red transition break-words">{p.name}</h3>
                                                        <span className="text-[10px] bg-white/5 border border-white/5 px-2 py-0.5 rounded text-gray-400 font-mono uppercase mt-2 inline-block">{(p.category || '').replace(/_/g, ' ')}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex gap-3">
                                                <button onClick={() => setEditingPlan(p)} className="flex-1 bg-white/5 hover:bg-white/10 py-2 rounded-lg text-xs font-bold text-white transition border border-white/5 hover:border-white/20">EDITAR</button>
                                                <SafeDeleteBtn onDelete={async () => { await deletePlanFromDB(p.id); loadData(); }} className="px-3 hover:bg-red-900/20 rounded-lg transition" />
                                            </div>
                                        </div>
                                    ))}
                                    {plans.length === 0 && <div className="col-span-3 text-center text-gray-500 py-20 border border-dashed border-[#333] rounded-xl">Nenhum plano cadastrado. Comece criando um!</div>}
                                </div>
                        </div>
                    )}

                    {view === 'USERS' && (
                        <div className="animate-fade-in w-full">
                                <div className="flex justify-between items-center mb-6 border-b border-[#333] pb-4">
                                <h2 className="text-2xl font-black uppercase text-white">Gestão de Usuários</h2>
                                <button onClick={() => setIsCreatingUser(true)} className="bg-insanus-red hover:bg-red-600 px-6 py-3 rounded-lg font-bold text-xs text-white shadow-neon transition transform hover:scale-105">+ NOVO ALUNO</button>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 w-full">
                                    {users.map(u => (
                                        <div key={u.id} className="bg-[#121212] border border-[#333] p-6 rounded-xl hover:border-white/20 transition w-full">
                                            <div className="flex justify-between items-start mb-6">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 bg-gradient-to-br from-gray-800 to-black rounded-full flex items-center justify-center border border-white/10 text-white font-bold text-xl">{u.name.charAt(0)}</div>
                                                    <div>
                                                        <h3 className="font-bold text-lg text-white flex items-center gap-2">{u.name} {u.isAdmin && <span className="text-[9px] bg-red-600 text-white px-2 py-0.5 rounded uppercase tracking-wider">ADMIN</span>}</h3>
                                                        <p className="text-xs text-gray-400 font-mono">{u.email}</p>
                                                        <div className="flex items-center gap-4 mt-1">
                                                            <span className="text-[10px] text-gray-500">CPF: {u.cpf}</span>
                                                            <span className="text-[10px] text-gray-500">Senha Temp: <span className="text-white font-mono">{u.tempPassword || 'N/A'}</span></span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button onClick={() => setUserToEdit(u)} className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-2 rounded border border-gray-700 flex items-center gap-2 transition">
                                                        <Icon.Edit className="w-4 h-4" /> EDITAR
                                                    </button>
                                                    <SafeDeleteBtn onDelete={() => deleteUser(u.id)} label="REMOVER" className="text-xs bg-red-900/10 hover:bg-red-900/30 text-red-500 px-3 py-2 rounded border border-red-900/20" />
                                                </div>
                                            </div>
                                            
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-[#1A1A1A] p-4 rounded-lg border border-[#333]">
                                                <div>
                                                    <h4 className="text-[10px] font-bold text-gray-400 uppercase mb-3 flex items-center gap-2"><Icon.Book className="w-3 h-3"/> Planos Liberados</h4>
                                                    <div className="flex flex-wrap gap-2">
                                                        {plans.map(p => {
                                                            const hasAccess = u.allowedPlans.includes(p.id);
                                                            return (
                                                                <button 
                                                                key={p.id}
                                                                onClick={() => toggleUserPlan(u, p.id)}
                                                                className={`text-[10px] px-3 py-1.5 rounded-md border transition-all ${hasAccess ? 'bg-green-500/10 border-green-500 text-green-400 font-bold shadow-[0_0_10px_rgba(34,197,94,0.1)]' : 'bg-black border-white/10 text-gray-600 hover:border-white/30 hover:text-gray-400'}`}
                                                                >
                                                                    {p.name}
                                                                </button>
                                                            )
                                                        })}
                                                    </div>
                                                </div>
                                                <div>
                                                    <h4 className="text-[10px] font-bold text-gray-400 uppercase mb-3 flex items-center gap-2"><Icon.List className="w-3 h-3"/> Turmas de Simulado</h4>
                                                    <div className="flex flex-wrap gap-2">
                                                        {classes.map(c => {
                                                            const hasAccess = u.allowedSimuladoClasses?.includes(c.id);
                                                            return (
                                                                <button 
                                                                key={c.id}
                                                                onClick={() => toggleUserClass(u, c.id)}
                                                                className={`text-[10px] px-3 py-1.5 rounded-md border transition-all ${hasAccess ? 'bg-blue-500/10 border-blue-500 text-blue-400 font-bold shadow-[0_0_10px_rgba(59,130,246,0.1)]' : 'bg-black border-white/10 text-gray-600 hover:border-white/30 hover:text-gray-400'}`}
                                                                >
                                                                    {c.name}
                                                                </button>
                                                            )
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                        </div>
                    )}

                    {view === 'SIMULADOS' && (
                        <div className="animate-fade-in w-full">
                            <div className="flex justify-between items-center mb-6 border-b border-[#333] pb-4">
                                <h2 className="text-2xl font-black uppercase text-white">Turmas de Simulado</h2>
                                <button onClick={handleCreateClass} className="bg-insanus-red hover:bg-red-600 px-6 py-3 rounded-lg font-bold text-xs text-white shadow-neon transition transform hover:scale-105">+ NOVA TURMA</button>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 w-full">
                                    {classes.map(c => (
                                        <div key={c.id} className="bg-[#121212] border border-[#333] p-6 rounded-xl flex justify-between items-center hover:border-white/20 transition group w-full">
                                            <div className="flex items-center gap-6">
                                                <div className="w-16 h-16 bg-blue-900/10 rounded-xl flex items-center justify-center border border-blue-500/30 group-hover:border-blue-500 group-hover:shadow-[0_0_15px_rgba(59,130,246,0.2)] transition-all">
                                                    <Icon.List className="w-8 h-8 text-blue-500"/>
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-xl text-white mb-1">{c.name}</h3>
                                                    <span className="text-xs text-gray-500 font-mono bg-white/5 px-2 py-1 rounded border border-white/5">{c.simulados.length} Simulados Criados</span>
                                                </div>
                                            </div>
                                            <div className="flex flex-col gap-2 min-w-[140px]">
                                                <button onClick={() => setEditingClass(c)} className="bg-white/5 hover:bg-white/10 px-6 py-2 rounded-lg text-xs font-bold text-white transition border border-white/5 hover:border-white/20 w-full">GERENCIAR</button>
                                                <SafeDeleteBtn 
                                                    onDelete={async () => { await deleteSimuladoClassFromDB(c.id); loadData(); }} 
                                                    className="flex items-center justify-center w-full gap-2 bg-red-500/5 hover:bg-red-500/10 border border-red-500/20 hover:border-red-500/50 text-red-500 hover:text-red-400 py-2 rounded-lg text-xs font-bold transition-all uppercase tracking-wide" 
                                                    label="EXCLUIR"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                    {classes.length === 0 && <div className="col-span-3 text-center text-gray-500 py-20 border border-dashed border-[#333] rounded-xl">Nenhuma turma criada.</div>}
                                </div>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="flex h-full bg-insanus-black text-white overflow-hidden relative w-full">
            {(isCreatingUser || userToEdit) && (
                <UserFormModal 
                    initialUser={userToEdit}
                    onSave={handleUserSave} 
                    onCancel={() => { setIsCreatingUser(false); setUserToEdit(null); }} 
                />
            )}

            {showEmbedModal && (
                <EmbedModal onClose={() => setShowEmbedModal(false)} />
            )}

            <aside className="w-64 bg-[#0F0F0F] border-r border-[#333] flex flex-col shrink-0 z-20">
                <div className="p-6 border-b border-[#333]">
                    <h1 className="text-xl font-black text-white tracking-tighter">ADMIN <span className="text-insanus-red">PANEL</span></h1>
                    <p className="text-[10px] font-mono text-gray-500 mt-1">v2.0.4 System</p>
                </div>
                
                <nav className="flex-1 p-4 space-y-2 overflow-y-auto custom-scrollbar">
                    <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest px-2 mb-2">Gestão Principal</p>
                    <button onClick={() => { setEditingPlan(null); setEditingClass(null); setView('PLANS'); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold uppercase transition-all ${view === 'PLANS' && !editingPlan && !editingClass ? 'bg-insanus-red text-white shadow-neon' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
                        <Icon.Book className="w-4 h-4"/> GESTÃO DE PLANOS
                    </button>
                    <button onClick={() => { setEditingPlan(null); setEditingClass(null); setView('USERS'); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold uppercase transition-all ${view === 'USERS' && !editingPlan && !editingClass ? 'bg-insanus-red text-white shadow-neon' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
                        <Icon.User className="w-4 h-4"/> ALUNOS
                    </button>
                    <button onClick={() => { setEditingPlan(null); setEditingClass(null); setView('SIMULADOS'); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold uppercase transition-all ${view === 'SIMULADOS' && !editingPlan && !editingClass ? 'bg-insanus-red text-white shadow-neon' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
                        <Icon.Code className="w-4 h-4"/> TURMAS DE SIMULADOS
                    </button>

                    <div className="my-4 border-t border-[#333]"></div>
                    <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest px-2 mb-2">Ferramentas</p>
                    <button onClick={() => setShowEmbedModal(true)} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold uppercase transition-all text-blue-400 hover:text-white hover:bg-blue-900/20 border border-transparent hover:border-blue-500/30">
                        <Icon.Share2 className="w-4 h-4"/> INCORPORAR / EMBED
                    </button>
                </nav>

                <div className="p-4 border-t border-[#333]">
                    <button onClick={onSwitchToUser} className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-[#333] text-xs font-bold text-gray-400 hover:text-white hover:bg-white/5 transition-all">
                        <Icon.Eye className="w-4 h-4"/> Ver como Aluno
                    </button>
                </div>
            </aside>

            <main className="flex-1 overflow-hidden flex flex-col relative bg-[#050505] w-full max-w-none">
                {renderContent()}
            </main>
        </div>
    );
};
