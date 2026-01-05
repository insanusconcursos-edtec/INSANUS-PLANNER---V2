import React, { useState, useEffect, useRef } from 'react';
import { User, StudyPlan, Routine, Goal, SubGoal, UserProgress, GoalType, PlanConfig, Discipline, Subject, UserLevel, SimuladoClass, Simulado, SimuladoAttempt, ScheduledItem, EditalTopic, Cycle, CycleItem, Flashcard } from '../types';
import { Icon } from '../components/Icons';
import { WEEKDAYS, calculateGoalDuration, uuid } from '../constants';
import { fetchPlansFromDB, saveUserToDB, fetchSimuladoClassesFromDB, fetchSimuladoAttemptsFromDB, saveSimuladoAttemptToDB, fetchUsersFromDB } from '../services/db';
import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';

interface Props {
  user: User;
  onUpdateUser: (user: User) => void;
  onReturnToAdmin?: () => void;
}

// --- HELPER: PDF WATERMARK ---
const openWatermarkedPDF = async (url: string, user: User) => {
    try {
        document.body.style.cursor = 'wait';
        
        const existingPdfBytes = await fetch(url).then(res => res.arrayBuffer());
        const pdfDoc = await PDFDocument.load(existingPdfBytes);
        const helveticaFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const pages = pdfDoc.getPages();
        
        const watermarkText = `${user.name} - ${user.cpf}`;
        const watermarkSize = 10; 

        pages.forEach(page => {
            const { width, height } = page.getSize();
            const stepX = 200; 
            const stepY = 200;
            
            for (let y = 0; y < height; y += stepY) {
                const offsetX = (y / stepY) % 2 === 0 ? 0 : stepX / 2;
                for (let x = -stepX; x < width; x += stepX) {
                    page.drawText(watermarkText, {
                        x: x + offsetX,
                        y: y + 20,
                        size: watermarkSize,
                        font: helveticaFont,
                        color: rgb(0.8, 0.2, 0.2), 
                        opacity: 0.15, 
                        rotate: degrees(45),
                    });
                }
            }
        });

        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const blobUrl = URL.createObjectURL(blob);
        
        window.open(blobUrl, '_blank');
    } catch (e) {
        console.error("Erro ao gerar marca d'água", e);
        window.open(url, '_blank');
    } finally {
        document.body.style.cursor = 'default';
    }
};

// --- HELPER: DATE & TIME UTILS ---
const getTodayStr = () => {
    const d = new Date();
    const offset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - offset).toISOString().split('T')[0];
};

const formatDate = (dateStr: string) => {
    if(!dateStr) return '--/--';
    const parts = dateStr.split('-');
    return `${parts[2]}/${parts[1]}`; 
};

const formatSecondsToTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m ${s}s`;
};

const formatStopwatch = (seconds: number) => {
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
};

const getDayName = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00'); 
    const dayMap = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
    return dayMap[d.getDay()];
};

const getWeekDays = (baseDateStr: string) => {
    const date = new Date(baseDateStr + 'T12:00:00');
    const day = date.getDay(); 
    const diff = date.getDate() - day; 
    const sunday = new Date(date.setDate(diff));
    
    const week = [];
    for(let i=0; i<7; i++) {
        const next = new Date(sunday);
        next.setDate(sunday.getDate() + i);
        week.push(next.toISOString().split('T')[0]);
    }
    return week;
};

// --- COMPONENT: FLASHCARD VIEWER ---
interface FlashcardViewerProps {
    flashcards: Flashcard[];
    onClose: () => void;
}

const FlashcardViewer: React.FC<FlashcardViewerProps> = ({ flashcards, onClose }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);

    if (!flashcards || flashcards.length === 0) return null;

    const currentCard = flashcards[currentIndex];

    const nextCard = () => {
        setIsFlipped(false);
        setTimeout(() => {
            if (currentIndex < flashcards.length - 1) {
                setCurrentIndex(prev => prev + 1);
            } else {
                setCurrentIndex(0);
            }
        }, 300);
    };

    const prevCard = () => {
        setIsFlipped(false);
        setTimeout(() => {
            if (currentIndex > 0) {
                setCurrentIndex(prev => prev + 1);
            } else {
                setCurrentIndex(flashcards.length - 1);
            }
        }, 300);
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex items-center justify-center p-6 animate-fade-in">
            <div className="w-full max-w-2xl flex flex-col items-center">
                <div className="w-full flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center shadow-neon border border-blue-400/50">
                            <Icon.RefreshCw className="w-6 h-6 text-white"/>
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-white uppercase tracking-wider">Revisão Ativa</h3>
                            <p className="text-xs text-blue-400 font-bold">Card {currentIndex + 1} de {flashcards.length}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-white transition p-2 rounded-full hover:bg-white/10">
                        <Icon.LogOut className="w-6 h-6"/>
                    </button>
                </div>

                <div 
                    className="relative w-full aspect-[16/9] cursor-pointer group" 
                    onClick={() => setIsFlipped(!isFlipped)}
                    style={{ perspective: '1000px' }}
                >
                    <div 
                        className="w-full h-full relative"
                        style={{
                            transformStyle: 'preserve-3d',
                            transition: 'transform 0.6s',
                            transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
                        }}
                    >
                        {/* Front (Question) */}
                        <div 
                            className="absolute inset-0 bg-[#1E1E1E] border-2 border-blue-900/50 rounded-2xl p-8 flex flex-col justify-center items-center text-center shadow-2xl group-hover:border-blue-500/50 transition-colors"
                            style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
                        >
                            <span className="text-xs font-bold text-blue-500 uppercase tracking-widest mb-4 bg-blue-900/20 px-3 py-1 rounded-full">Pergunta</span>
                            <p className="text-2xl font-bold text-white leading-relaxed">{currentCard.question}</p>
                            <div className="absolute bottom-8 bg-blue-600/20 border border-blue-500/50 text-blue-300 px-4 py-2 rounded-lg text-xs font-bold uppercase animate-pulse flex items-center gap-2">
                                <Icon.Eye className="w-4 h-4"/> Ver Resposta
                            </div>
                        </div>

                        {/* Back (Answer) */}
                        <div 
                            className="absolute inset-0 bg-[#121212] border-2 border-green-500/50 rounded-2xl p-8 flex flex-col justify-center items-center text-center shadow-[0_0_30px_rgba(34,197,94,0.1)]"
                            style={{ 
                                backfaceVisibility: 'hidden', 
                                WebkitBackfaceVisibility: 'hidden', 
                                transform: 'rotateY(180deg)' 
                            }}
                        >
                            <span className="text-xs font-bold text-green-500 uppercase tracking-widest mb-4 bg-green-900/20 px-3 py-1 rounded-full">Resposta</span>
                            <p className="text-lg text-gray-200 leading-relaxed overflow-y-auto max-h-full custom-scrollbar w-full">{currentCard.answer}</p>
                        </div>
                    </div>
                </div>

                <div className="flex gap-4 mt-8 w-full">
                    <button onClick={(e) => { e.stopPropagation(); prevCard(); }} className="flex-1 bg-transparent border border-gray-700 hover:border-white/50 text-gray-400 hover:text-white py-4 rounded-xl font-bold text-xs uppercase transition flex items-center justify-center gap-2">
                        <Icon.ArrowUp className="w-4 h-4 -rotate-90"/> Anterior
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); nextCard(); }} className="flex-[2] bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-xl font-bold text-xs uppercase shadow-neon transition transform hover:scale-[1.02] flex items-center justify-center gap-2">
                        {currentIndex === flashcards.length - 1 ? 'Recomeçar' : 'Próximo Card'} <Icon.ArrowDown className="-rotate-90 w-4 h-4"/>
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- SIMULADO RUNNER COMPONENT ---
interface SimuladoRunnerProps {
    user: User;
    classId: string;
    simulado: Simulado;
    attempt?: SimuladoAttempt;
    allAttempts: SimuladoAttempt[];
    allUsersMap: Record<string, User>;
    onFinish: (result: SimuladoAttempt) => void;
    onBack: () => void;
}

const SimuladoRunner: React.FC<SimuladoRunnerProps> = ({ user, classId, simulado, attempt, allAttempts, allUsersMap, onFinish, onBack }) => {
    const [answers, setAnswers] = useState<Record<number, string | null>>(attempt?.answers || {});
    const [showResult, setShowResult] = useState(!!attempt);
    const [confirmFinish, setConfirmFinish] = useState(false);
    const [loadingPdf, setLoadingPdf] = useState(false);

    const handleAnswer = (q: number, val: string) => {
        if (showResult) return;
        setAnswers(prev => ({ ...prev, [q]: val }));
    };

    const handleOpenPdfSecure = async (url: string) => {
        setLoadingPdf(true);
        await openWatermarkedPDF(url, user);
        setLoadingPdf(false);
    }

    const finishSimulado = () => {
        let score = 0;
        
        for (let i = 1; i <= simulado.totalQuestions; i++) {
            const userAns = answers[i];
            const correctAns = simulado.correctAnswers[i];
            const val = simulado.questionValues[i] || 1;
            
            if (userAns && userAns === correctAns) {
                score += val;
            } else if (userAns && simulado.hasPenalty) {
                score -= val;
            }
        }
        if (score < 0) score = 0;

        const totalPoints = Object.values(simulado.questionValues).reduce((a: number, b: number) => a + b, 0) || simulado.totalQuestions;
        const percent = totalPoints > 0 ? (score / totalPoints) * 100 : 0;
        const isApproved = simulado.minTotalPercent ? percent >= simulado.minTotalPercent : percent >= 50;

        const result: SimuladoAttempt = {
            id: attempt?.id || uuid(),
            userId: user.id,
            simuladoId: simulado.id,
            classId: classId,
            date: new Date().toISOString(),
            answers,
            diagnosisReasons: {}, 
            score,
            isApproved
        };

        onFinish(result);
        setShowResult(true);
        setConfirmFinish(false);
    };

    // Calculate Ranking
    const ranking = React.useMemo(() => {
        if (!showResult) return [];
        const relevantAttempts = allAttempts.filter(a => a.simuladoId === simulado.id);
        let finalAttempts = [...relevantAttempts];
        if (attempt && !finalAttempts.some(a => a.id === attempt.id)) {
            finalAttempts.push(attempt);
        }
        const best: Record<string, SimuladoAttempt> = {};
        finalAttempts.forEach(a => {
            const existing = best[a.userId];
            if (!existing || a.score > existing.score) best[a.userId] = a;
        });

        return Object.values(best)
            .sort((a, b) => b.score - a.score)
            .map((a, index) => {
                const u = allUsersMap[a.userId];
                let displayName = u?.nickname || (u ? u.name.split(' ')[0] : 'Usuário');
                return {
                    rank: index + 1,
                    userId: a.userId,
                    name: displayName,
                    score: a.score,
                    isCurrentUser: a.userId === user.id
                };
            });
    }, [showResult, allAttempts, simulado.id, attempt, user.id, allUsersMap]);

    return (
        <div className="w-full flex flex-col animate-fade-in pb-10">
             <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#333]">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="text-gray-500 hover:text-white flex items-center gap-2 transition">
                        <Icon.ArrowUp className="-rotate-90 w-5 h-5" /> <span className="text-xs font-bold uppercase">Sair</span>
                    </button>
                    <div className="h-6 w-px bg-[#333]"></div>
                    <h2 className="font-bold uppercase text-xl text-white">{simulado.title}</h2>
                </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                <div className="bg-[#121212] p-6 rounded-xl border border-[#333] flex flex-col items-center justify-center text-center gap-4 hover:border-white/20 transition group">
                    <div className="w-12 h-12 bg-insanus-red/10 rounded-full flex items-center justify-center group-hover:scale-110 transition">
                        <Icon.Book className="w-6 h-6 text-insanus-red" />
                    </div>
                    <div>
                        <h3 className="text-white font-bold uppercase text-sm">Material do Simulado</h3>
                        <p className="text-gray-500 text-xs mt-1">Baixe o PDF para resolver as questões.</p>
                    </div>
                    {simulado.pdfUrl ? (
                        <button 
                            onClick={() => handleOpenPdfSecure(simulado.pdfUrl!)}
                            className="bg-white/5 hover:bg-white/10 text-white border border-white/10 px-6 py-2 rounded-lg text-xs font-bold uppercase transition flex items-center gap-2 shadow-lg"
                        >
                            {loadingPdf ? <Icon.RefreshCw className="w-4 h-4 animate-spin"/> : <Icon.Maximize className="w-4 h-4"/>} 
                            BAIXAR PROVA
                        </button>
                    ) : (
                        <span className="text-red-500 text-xs font-bold bg-red-900/10 px-3 py-1 rounded">PDF Indisponível</span>
                    )}
                </div>

                <div className={`bg-[#121212] p-6 rounded-xl border border-[#333] flex flex-col items-center justify-center text-center gap-4 transition group ${!showResult ? 'opacity-50 grayscale' : 'hover:border-white/20'}`}>
                    <div className="w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center group-hover:scale-110 transition">
                        <Icon.Check className="w-6 h-6 text-green-500" />
                    </div>
                    <div>
                        <h3 className="text-white font-bold uppercase text-sm">Gabarito Comentado</h3>
                        <p className="text-gray-500 text-xs mt-1">{showResult ? 'Visualize as respostas e comentários.' : 'Disponível após finalizar o simulado.'}</p>
                    </div>
                    {simulado.gabaritoPdfUrl && showResult ? (
                        <button 
                            onClick={() => handleOpenPdfSecure(simulado.gabaritoPdfUrl!)}
                            className="bg-green-600/20 hover:bg-green-600/30 text-green-500 border border-green-600/50 px-6 py-2 rounded-lg text-xs font-bold uppercase transition flex items-center gap-2 shadow-lg"
                        >
                            <Icon.Maximize className="w-4 h-4"/> ABRIR GABARITO
                        </button>
                    ) : (
                        <button disabled className="bg-black/20 text-gray-600 border border-white/5 px-6 py-2 rounded-lg text-xs font-bold uppercase cursor-not-allowed flex items-center gap-2">
                            <Icon.EyeOff className="w-4 h-4"/> {showResult ? 'GABARITO INDISPONÍVEL' : 'BLOQUEADO'}
                        </button>
                    )}
                </div>
             </div>

             {confirmFinish && (
                 <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4">
                     <div className="bg-[#121212] border border-[#333] p-8 rounded-xl max-w-sm w-full text-center shadow-neon">
                         <h3 className="text-xl font-bold text-white mb-2">Finalizar Simulado?</h3>
                         <p className="text-gray-400 text-sm mb-6">Confira se marcou todas as respostas no gabarito digital.</p>
                         <div className="flex gap-4">
                             <button onClick={() => setConfirmFinish(false)} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-lg font-bold text-xs">VOLTAR</button>
                             <button onClick={finishSimulado} className="flex-1 bg-green-600 hover:bg-green-500 text-white py-3 rounded-lg font-bold text-xs shadow-lg">CONFIRMAR</button>
                         </div>
                     </div>
                 </div>
             )}

             <div className="flex-1 flex flex-col bg-[#050505]">
                {showResult && attempt && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                         <div className={`p-6 rounded-xl border flex flex-col justify-between ${attempt.isApproved ? 'bg-green-900/10 border-green-600/50' : 'bg-red-900/10 border-red-600/50'}`}>
                             <div>
                                 <h3 className={`text-2xl font-black ${attempt.isApproved ? 'text-green-500' : 'text-red-500'}`}>{attempt.isApproved ? 'APROVADO' : 'REPROVADO'}</h3>
                                 <p className="text-sm text-gray-300 mt-2">Nota Final: <span className="font-bold text-white text-xl ml-1">{attempt.score} pontos</span></p>
                             </div>
                         </div>

                         <div className="bg-[#121212] border border-[#333] rounded-xl overflow-hidden flex flex-col">
                             <div className="bg-[#1E1E1E] p-3 border-b border-[#333] flex justify-between items-center">
                                <h4 className="text-sm font-bold text-white uppercase flex items-center gap-2"><Icon.List className="w-4 h-4 text-yellow-500"/> Ranking</h4>
                             </div>
                             <div className="flex-1 overflow-y-auto custom-scrollbar max-h-[200px]">
                                 <table className="w-full text-left border-collapse">
                                     <thead className="bg-black text-[10px] text-gray-500 font-bold uppercase sticky top-0">
                                         <tr>
                                             <th className="p-2 pl-4">Pos</th>
                                             <th className="p-2">Aluno</th>
                                             <th className="p-2 text-right pr-4">Nota</th>
                                         </tr>
                                     </thead>
                                     <tbody>
                                         {ranking.map((r) => (
                                             <tr key={r.userId} className={`border-b border-[#222] text-xs ${r.isCurrentUser ? 'bg-insanus-red/10' : ''}`}>
                                                 <td className="p-2 pl-4 font-bold text-gray-400">{r.rank}º</td>
                                                 <td className={`p-2 font-bold ${r.isCurrentUser ? 'text-insanus-red' : 'text-white'}`}>{r.name} {r.isCurrentUser && '(Você)'}</td>
                                                 <td className="p-2 text-right pr-4 font-mono font-bold text-white">{r.score}</td>
                                             </tr>
                                         ))}
                                     </tbody>
                                 </table>
                             </div>
                         </div>
                    </div>
                 )}

                 <div className="bg-[#121212] rounded-xl border border-[#333] p-6">
                    <h3 className="text-white font-bold uppercase mb-6 flex items-center gap-2"><Icon.List className="w-5 h-5 text-insanus-red"/> Gabarito Digital</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {Array.from({ length: simulado.totalQuestions }).map((_, i) => {
                            const qNum = i + 1;
                            const userAns = answers[qNum];
                            const correctAns = showResult ? simulado.correctAnswers[qNum] : null;
                            const isCorrect = showResult && userAns === correctAns;
                            
                            return (
                                <div key={qNum} className="flex flex-col gap-2 p-3 rounded bg-[#1A1A1A] border border-[#333]">
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-bold text-gray-400">Q{qNum}</span>
                                        {showResult && (
                                            <span className={`text-[10px] font-bold ${isCorrect ? 'text-green-500' : 'text-red-500'}`}>
                                                {isCorrect ? 'ACERTOU' : `GAB: ${correctAns}`}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex gap-1 justify-center">
                                        {simulado.type === 'MULTIPLA_ESCOLHA' ? (
                                            ['A','B','C','D','E'].slice(0, simulado.optionsCount).map(opt => (
                                                <button 
                                                    key={opt}
                                                    onClick={() => handleAnswer(qNum, opt)}
                                                    disabled={showResult}
                                                    className={`w-8 h-8 rounded text-[10px] font-bold transition-all ${
                                                        userAns === opt 
                                                            ? 'bg-white text-black shadow-neon' 
                                                            : 'bg-black border border-[#333] text-gray-500 hover:border-white/50'
                                                    } ${showResult && correctAns === opt ? '!bg-green-600 !text-white !border-green-600' : ''}`}
                                                >
                                                    {opt}
                                                </button>
                                            ))
                                        ) : (
                                            ['C','E'].map(opt => (
                                                <button 
                                                    key={opt}
                                                    onClick={() => handleAnswer(qNum, opt)}
                                                    disabled={showResult}
                                                    className={`flex-1 h-8 rounded text-[10px] font-bold transition-all ${
                                                        userAns === opt ? 'bg-white text-black' : 'bg-black border border-[#333] text-gray-500 hover:border-white/50'
                                                    } ${showResult && correctAns === opt ? '!bg-green-600 !text-white !border-green-600' : ''}`}
                                                >
                                                    {opt}
                                                </button>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                 </div>

                 {!showResult && (
                     <div className="mt-8">
                         <button 
                             onClick={() => setConfirmFinish(true)}
                             className="w-full bg-insanus-red hover:bg-red-700 text-white py-4 rounded-xl font-black text-sm uppercase shadow-neon transition-all transform hover:scale-[1.01] flex items-center justify-center gap-2"
                         >
                             <Icon.Check className="w-5 h-5"/> FINALIZAR E ENVIAR RESPOSTAS
                         </button>
                     </div>
                 )}
             </div>
        </div>
    );
};

const SetupWizard = ({ user, allPlans, currentPlan, onSave, onPlanAction, onUpdateUser, onSelectPlan }: { user: User, allPlans: StudyPlan[], currentPlan: StudyPlan | null, onSave: (r: Routine, l: UserLevel) => void, onPlanAction: (action: 'pause' | 'reschedule' | 'restart') => void, onUpdateUser: (u: User) => void, onSelectPlan: (id: string) => void }) => {
    const [days, setDays] = useState(user.routine?.days || {});
    const [level, setLevel] = useState<UserLevel>(user.level || 'iniciante');
    const [nickname, setNickname] = useState(user.nickname || ''); 
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [changingPass, setChangingPass] = useState(false);
    const [showRestartConfirm, setShowRestartConfirm] = useState(false);

    const handleDayChange = (key: string, val: string) => {
        setDays(prev => ({ ...prev, [key]: parseInt(val) || 0 }));
    };

    const handleSaveProfile = async () => {
        if (nickname.length > 20) return alert("Apelido muito longo (máx 20 caracteres)");
        const updatedUser = { ...user, nickname: nickname.trim() };
        onUpdateUser(updatedUser);
        await saveUserToDB(updatedUser);
        alert("Apelido atualizado!");
    };

    const handleChangePassword = async () => {
        if (!newPassword.trim() || !confirmPassword.trim()) return alert("Preencha os campos de senha.");
        if (newPassword !== confirmPassword) return alert("As senhas não coincidem.");
        if (newPassword.length < 4) return alert("A senha deve ter pelo menos 4 caracteres.");

        setChangingPass(true);
        try {
            const updatedUser = { ...user, tempPassword: newPassword };
            onUpdateUser(updatedUser);
            await saveUserToDB(updatedUser);
            alert("Senha alterada com sucesso!");
            setNewPassword('');
            setConfirmPassword('');
        } catch (e) {
            alert("Erro ao alterar senha.");
        } finally {
            setChangingPass(false);
        }
    };

    const isPlanPaused = currentPlan ? user.planConfigs?.[currentPlan.id]?.isPaused : false;

    return (
        <div className="w-full space-y-8 animate-fade-in mt-4 relative">
            {showRestartConfirm && (
                <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-[#121212] border border-red-900/50 p-8 rounded-xl max-w-sm w-full text-center shadow-neon relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-red-600"></div>
                        <Icon.Trash className="w-12 h-12 text-red-600 mx-auto mb-4"/>
                        <h3 className="text-xl font-bold text-white mb-2 uppercase">Reiniciar Plano?</h3>
                        <p className="text-gray-400 text-sm mb-6 leading-relaxed">
                            Isso apagará todo o seu progresso (metas cumpridas e revisões) deste plano específico.
                            <br/><br/>
                            <span className="text-red-500 font-bold bg-red-900/20 px-2 py-1 rounded">ESTA AÇÃO É IRREVERSÍVEL</span>
                        </p>
                        <div className="flex gap-4">
                            <button onClick={() => setShowRestartConfirm(false)} className="flex-1 bg-transparent border border-gray-700 hover:border-gray-500 text-gray-300 py-3 rounded-lg font-bold text-xs uppercase transition">Cancelar</button>
                            <button onClick={() => { onPlanAction('restart'); setShowRestartConfirm(false); }} className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 rounded-lg font-bold text-xs shadow-neon transition uppercase">Confirmar</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-[#121212] p-8 rounded-2xl border border-[#333]">
                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2 border-b border-[#333] pb-4"><Icon.Book className="w-5 h-5 text-insanus-red"/> MEUS PLANOS DISPONÍVEIS</h3>
                {allPlans.length === 0 ? (
                    <div className="text-gray-500 italic text-sm">Nenhum plano liberado para sua conta. Contate o suporte.</div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                        {allPlans.map(plan => {
                            const isActive = currentPlan?.id === plan.id;
                            const isPaused = user.planConfigs?.[plan.id]?.isPaused;
                            return (
                                <div key={plan.id} className={`relative rounded-xl border-2 overflow-hidden transition-all group flex flex-col h-full bg-[#0F0F0F] ${isActive ? 'border-insanus-red shadow-neon transform scale-[1.02]' : 'border-[#333] hover:border-gray-500'}`}>
                                    <div className="aspect-square w-full bg-gray-800 relative overflow-hidden border-b border-[#333]">
                                        {plan.coverImage ? ( <img src={plan.coverImage} alt={plan.name} className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" /> ) : ( <div className="flex items-center justify-center h-full w-full bg-gradient-to-br from-gray-800 to-black"><Icon.Image className="w-12 h-12 text-gray-600"/></div> )}
                                        <div className="absolute top-2 right-2 flex gap-1">
                                            {isActive && <span className="bg-insanus-red text-white text-[8px] font-black px-2 py-1 rounded uppercase tracking-wider shadow-sm">{isPaused ? 'PAUSADO' : 'ATIVO'}</span>}
                                        </div>
                                    </div>
                                    <div className="p-3 flex-1 flex flex-col">
                                        <div className="mb-2"><span className="text-[9px] text-gray-500 font-bold uppercase block mb-1 truncate">{(plan.category || 'GERAL').replace(/_/g, ' ')}</span><h4 className={`font-black text-sm leading-tight line-clamp-2 ${isActive ? 'text-white' : 'text-gray-300'}`}>{plan.name}</h4></div>
                                        <div className="flex items-center gap-2 mt-auto pt-2">
                                            {isActive ? <div className="w-full text-center py-2 bg-insanus-red/10 border border-insanus-red rounded text-insanus-red text-[10px] font-bold uppercase">SELECIONADO</div> : <button onClick={() => onSelectPlan(plan.id)} className="w-full py-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/30 rounded text-gray-300 hover:text-white text-[10px] font-bold uppercase transition flex items-center justify-center gap-2">ESCOLHER</button>}
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {currentPlan && (
                <div className="bg-[#121212] p-6 rounded-2xl border border-[#333] relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-insanus-red"></div>
                    <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><Icon.Edit className="w-5 h-5"/> GESTÃO DO PLANO ATUAL ({currentPlan.name})</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div className="bg-[#1E1E1E] p-4 rounded-xl border border-[#333]">
                            <h4 className="font-bold text-gray-300 text-sm mb-2">STATUS DO PLANO</h4>
                            <p className="text-xs text-gray-500 mb-4">Pausar o plano interrompe a geração de novas metas diárias.</p>
                            <button onClick={() => onPlanAction('pause')} className={`w-full py-3 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition ${isPlanPaused ? 'bg-green-600 hover:bg-green-500 text-white' : 'bg-yellow-600 hover:bg-yellow-500 text-white'}`}>
                                {isPlanPaused ? <Icon.Play className="w-4 h-4"/> : <Icon.Pause className="w-4 h-4"/>} {isPlanPaused ? 'RETOMAR PLANO' : 'PAUSAR PLANO'}
                            </button>
                        </div>
                        <div className="bg-[#1E1E1E] p-4 rounded-xl border border-[#333]">
                            <h4 className="font-bold text-gray-300 text-sm mb-2">ATRASOS E IMPREVISTOS</h4>
                            <p className="text-xs text-gray-500 mb-4">Replanejar define a data de início para HOJE.</p>
                            <button onClick={() => { if(confirm("Isso vai reorganizar todo o cronograma futuro a partir de hoje. Continuar?")) onPlanAction('reschedule'); }} className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition"><Icon.RefreshCw className="w-4 h-4"/> REPLANEJAR ATRASOS</button>
                        </div>
                        <div className="bg-red-900/10 p-4 rounded-xl border border-red-900/30 flex flex-col justify-between">
                            <div><h4 className="font-bold text-red-500 text-sm mb-2 flex items-center gap-2"><Icon.Trash className="w-4 h-4"/> ZONA DE PERIGO</h4><p className="text-xs text-red-400 mb-4">Deseja recomeçar do zero?</p></div>
                            <button onClick={() => setShowRestartConfirm(true)} className="w-full py-3 bg-transparent border border-red-600 text-red-500 hover:bg-red-600 hover:text-white rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition">REINICIAR PLANO</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-[#121212] p-8 rounded-2xl border border-[#333]">
                <div className="text-center mb-10"><Icon.Clock className="w-16 h-16 text-insanus-red mx-auto mb-4" /><h2 className="text-3xl font-black text-white uppercase tracking-tight">Configuração de Rotina</h2><p className="text-gray-400 mt-2 text-sm">Defina seu ritmo e disponibilidade.</p></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                    <div>
                        <h3 className="text-lg font-bold text-white mb-4 border-b border-[#333] pb-2 flex items-center gap-2"><Icon.User className="w-4 h-4 text-insanus-red"/> SEU NÍVEL</h3>
                        <div className="space-y-3">
                            {[{ id: 'iniciante', label: 'Iniciante', desc: 'Ritmo mais lento de leitura.' }, { id: 'intermediario', label: 'Intermediário', desc: 'Ritmo médio e constante.' }, { id: 'avancado', label: 'Avançado', desc: 'Leitura dinâmica e foco em revisão.' }].map((opt) => (
                                <div key={opt.id} onClick={() => setLevel(opt.id as UserLevel)} className={`p-3 rounded-xl border cursor-pointer transition-all ${level === opt.id ? 'bg-insanus-red/20 border-insanus-red shadow-neon' : 'bg-[#1A1A1A] border-[#333] hover:border-[#555]'}`}>
                                    <div className="flex justify-between items-center mb-1"><span className={`font-bold uppercase text-sm ${level === opt.id ? 'text-white' : 'text-gray-400'}`}>{opt.label}</span>{level === opt.id && <Icon.Check className="w-4 h-4 text-insanus-red"/>}</div>
                                    <p className="text-[10px] text-gray-500">{opt.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-white mb-4 border-b border-[#333] pb-2 flex items-center gap-2"><Icon.Calendar className="w-4 h-4 text-insanus-red"/> DISPONIBILIDADE (MIN)</h3>
                        <div className="space-y-2">
                            {WEEKDAYS.map(d => (
                                <div key={d.key} className="flex items-center justify-between bg-[#1A1A1A] p-2 px-3 rounded border border-[#333] hover:border-[#555] transition">
                                    <span className="text-xs font-bold text-gray-300 uppercase">{d.label}</span>
                                    <div className="flex items-center gap-2">
                                        <input type="number" value={days[d.key] || ''} onChange={e => handleDayChange(d.key, e.target.value)} placeholder="0" className="w-16 bg-[#050505] border border-[#333] rounded p-1 text-right text-white font-mono text-sm focus:border-insanus-red outline-none"/>
                                        <span className="text-[10px] text-gray-600">min</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                <button onClick={() => onSave({ days }, level)} className="w-full mt-10 bg-insanus-red hover:bg-red-600 text-white font-bold py-4 rounded-xl shadow-neon transition transform hover:scale-[1.01] flex items-center justify-center gap-2"><Icon.RefreshCw className="w-5 h-5"/> SALVAR ROTINA E NÍVEL</button>
            </div>

            <div className="bg-[#121212] p-8 rounded-2xl border border-[#333]">
                <h3 className="text-lg font-bold text-white mb-6 border-b border-[#333] pb-2 flex items-center gap-2"><Icon.User className="w-4 h-4 text-insanus-red"/> PERFIL E RANKING</h3>
                <div className="flex flex-col md:flex-row gap-4 items-end">
                    <div className="flex-1 w-full"><label className="text-[10px] text-gray-500 font-bold uppercase block mb-1">Apelido</label><input type="text" value={nickname} onChange={e => setNickname(e.target.value)} className="w-full bg-black p-3 rounded-lg border border-white/10 text-white text-sm focus:border-insanus-red focus:outline-none" placeholder="Apelido para o ranking" maxLength={20}/></div>
                    <button onClick={handleSaveProfile} className="bg-gray-800 hover:bg-gray-700 text-white font-bold py-3 px-6 rounded-lg border border-gray-700 transition flex items-center justify-center gap-2 shrink-0 h-[46px]">SALVAR PERFIL</button>
                </div>
            </div>

            <div className="bg-[#121212] p-8 rounded-2xl border border-[#333]">
                <h3 className="text-lg font-bold text-white mb-6 border-b border-[#333] pb-2 flex items-center gap-2"><Icon.Eye className="w-4 h-4 text-insanus-red"/> SEGURANÇA E ACESSO</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div><label className="text-[10px] text-gray-500 font-bold uppercase block mb-1">Nova Senha</label><input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full bg-black p-3 rounded-lg border border-white/10 text-white text-sm focus:border-insanus-red focus:outline-none"/></div>
                    <div><label className="text-[10px] text-gray-500 font-bold uppercase block mb-1">Confirmar Nova Senha</label><input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="w-full bg-black p-3 rounded-lg border border-white/10 text-white text-sm focus:border-insanus-red focus:outline-none"/></div>
                </div>
                <button onClick={handleChangePassword} disabled={changingPass} className="w-full mt-6 bg-gray-800 hover:bg-gray-700 text-white font-bold py-3 rounded-xl border border-gray-700 transition disabled:opacity-50">{changingPass ? 'SALVANDO...' : 'ALTERAR SENHA'}</button>
            </div>
        </div>
    );
};

const expandCycleItems = (cycle: Cycle, plan: StudyPlan): CycleItem[] => {
    const expandedItems: CycleItem[] = [];
    cycle.items.forEach(item => {
        if (item.folderId) {
            const folderDisciplines = plan.disciplines
                .filter(d => d.folderId === item.folderId)
                .sort((a, b) => a.order - b.order);
            folderDisciplines.forEach(d => {
                expandedItems.push({
                    disciplineId: d.id,
                    subjectsCount: item.subjectsCount
                });
            });
        } else if (item.disciplineId) {
            expandedItems.push(item);
        } else if (item.simuladoId) {
            expandedItems.push(item);
        }
    });
    return expandedItems;
};

const isSimuladoCompleted = (simuladoId: string, attempts: SimuladoAttempt[]) => {
    return attempts.some(a => a.simuladoId === simuladoId);
};

const generateSchedule = (plan: StudyPlan, routine: Routine, startDateStr: string, completedGoals: string[], userLevel: UserLevel, isPaused: boolean, allSimulados: Simulado[], userAttempts: SimuladoAttempt[]): Record<string, ScheduledItem[]> => {
    const schedule: Record<string, ScheduledItem[]> = {};
    if (isPaused) return {}; 
    if (!plan || !plan.cycles || plan.cycles.length === 0) return {};
    
    const hasAvailability = Object.values(routine.days || {}).some(v => v > 0);
    if (!hasAvailability) return {};

    const startDate = new Date((startDateStr || getTodayStr()) + 'T00:00:00');
    const MAX_DAYS = 90; 
    
    // Configuração do Sistema de Ciclo
    const cycleSystem = plan.cycleSystem || 'continuo';
    
    // Filas de conteúdo real
    const disciplineQueues: Record<string, Goal[]> = {};
    plan.disciplines.forEach(d => {
        const flatGoals: Goal[] = [];
        const sortedSubjects = [...d.subjects].sort((a,b) => a.order - b.order);
        sortedSubjects.forEach(s => {
             const sortedGoals = [...s.goals].sort((a,b) => a.order - b.order);
             sortedGoals.forEach(g => {
                 (g as any)._subjectName = s.name;
                 (g as any)._disciplineName = d.name;
                 flatGoals.push(g);
             });
        });
        disciplineQueues[d.id] = flatGoals;
    });

    const disciplinePointers: Record<string, number> = {};
    plan.disciplines.forEach(d => { disciplinePointers[d.id] = 0; });

    // Helper: Verifica se um ciclo inteiro foi finalizado (todas as matérias dele acabaram)
    const isCycleExhausted = (cIndex: number) => {
        const c = plan.cycles[cIndex];
        if(!c) return true;
        const items = expandCycleItems(c, plan);
        return items.every(item => {
            if(item.simuladoId) return isSimuladoCompleted(item.simuladoId, userAttempts);
            if(item.disciplineId) {
                const ptr = disciplinePointers[item.disciplineId];
                const queue = disciplineQueues[item.disciplineId];
                return ptr >= (queue ? queue.length : 0);
            }
            return true;
        });
    };

    let currentCycleIndex = 0;
    let currentItemIndex = 0;

    // Se for Contínuo, pulamos ciclos já 100% feitos no início
    if (cycleSystem === 'continuo') {
        while (currentCycleIndex < plan.cycles.length && isCycleExhausted(currentCycleIndex)) {
            currentCycleIndex++;
        }
    }

    for (let dayOffset = 0; dayOffset < MAX_DAYS; dayOffset++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + dayOffset);
        const dateStr = currentDate.toISOString().split('T')[0];
        const dayName = getDayName(dateStr);
        
        let minutesAvailable = routine.days[dayName] || 0;
        const dayItems: ScheduledItem[] = [];

        if (minutesAvailable === 0) continue;

        let itemsProcessedToday = 0;
        let safetyLoop = 0;

        while (minutesAvailable > 0 && safetyLoop < 500) {
            safetyLoop++;
            
            // Verificação de limites de ciclo
            if (currentCycleIndex >= plan.cycles.length) {
                if (cycleSystem === 'rotativo') {
                    currentCycleIndex = 0;
                } else {
                    break; // Contínuo: Acabou o plano
                }
            }

            const cycle = plan.cycles[currentCycleIndex];
            if (!cycle) break;

            const activeItems = expandCycleItems(cycle, plan);
            
            // Se chegamos ao fim dos itens do ciclo atual
            if (currentItemIndex >= activeItems.length) {
                if (cycleSystem === 'continuo') {
                    // CONTÍNUO: Só avança ciclo se o atual estiver esgotado
                    if (isCycleExhausted(currentCycleIndex)) {
                        currentCycleIndex++;
                    }
                    currentItemIndex = 0; // Reinicia itens no mesmo ciclo se não esgotou
                } else {
                    // ROTATIVO: Completou uma rodada de itens, muda de ciclo
                    currentCycleIndex++;
                    currentItemIndex = 0;
                }
                continue;
            }

            const cycleItem = activeItems[currentItemIndex];

            // 1. Processar Simulado
            if (cycleItem.simuladoId) {
                const simulado = allSimulados.find(s => s.id === cycleItem.simuladoId);
                const isCompleted = isSimuladoCompleted(cycleItem.simuladoId, userAttempts);
                if (isCompleted) {
                    currentItemIndex++;
                    continue;
                }
                if (simulado) {
                    const estDuration = simulado.totalQuestions * 3; 
                    if (itemsProcessedToday === 0 || minutesAvailable > 60) {
                        const uniqueId = `${dateStr}_SIM_${simulado.id}`;
                        dayItems.push({
                            uniqueId, 
                            date: dateStr, 
                            goalId: simulado.id, 
                            goalType: 'SIMULADO',
                            title: `SIMULADO: ${simulado.title}`,
                            disciplineName: 'AVALIAÇÃO',
                            subjectName: `${simulado.totalQuestions} Questões`,
                            duration: estDuration,
                            isRevision: false,
                            completed: false,
                            simuladoData: simulado
                        });
                        minutesAvailable = 0; 
                        itemsProcessedToday++;
                        currentItemIndex++;
                    } else {
                        minutesAvailable = 0;
                        break;
                    }
                } else {
                    currentItemIndex++;
                }
                continue;
            }

            // 2. Processar Disciplina
            if (cycleItem.disciplineId) {
                const queue = disciplineQueues[cycleItem.disciplineId];
                let pointer = disciplinePointers[cycleItem.disciplineId];

                if (!queue || pointer >= queue.length) {
                    currentItemIndex++;
                    continue;
                }

                let scheduledInThisSlot = 0;
                let lastSubName = "";
                let processedSomething = false;

                while (scheduledInThisSlot < cycleItem.subjectsCount && pointer < queue.length) {
                    const goal = queue[pointer];
                    
                    if (completedGoals.includes(goal.id)) {
                        pointer++;
                        disciplinePointers[cycleItem.disciplineId!] = pointer;
                        continue;
                    }

                    let duration = calculateGoalDuration(goal, userLevel);
                    if (duration === 0 && goal.type !== 'AULA') duration = 15;
                    if (duration === 0) duration = 30;

                    const isSameSub = lastSubName && (goal as any)._subjectName === lastSubName;

                    if (minutesAvailable >= duration || itemsProcessedToday === 0) {
                        const uniqueId = `${dateStr}_${cycle.id}_${cycleItem.disciplineId}_${goal.id}`;
                        dayItems.push({
                             uniqueId, date: dateStr, goalId: goal.id, goalType: goal.type,
                             title: goal.title, disciplineName: (goal as any)._disciplineName || "Disciplina",
                             subjectName: (goal as any)._subjectName || "Assunto", duration: duration,
                             isRevision: false, completed: false, originalGoal: goal
                        });
                        
                        if (!isSameSub) {
                            scheduledInThisSlot++;
                            lastSubName = (goal as any)._subjectName;
                        }

                        minutesAvailable -= duration;
                        itemsProcessedToday++;
                        processedSomething = true;
                        pointer++;
                        disciplinePointers[cycleItem.disciplineId!] = pointer;
                    } else {
                        minutesAvailable = 0;
                        break;
                    }
                }
                
                if (scheduledInThisSlot >= cycleItem.subjectsCount || pointer >= queue.length) {
                    currentItemIndex++;
                } else if (!processedSomething && minutesAvailable <= 0) {
                    break;
                }
            }
        }
        if (dayItems.length > 0) schedule[dateStr] = dayItems;
    }
    return schedule;
};

export const UserDashboard: React.FC<Props> = ({ user, onUpdateUser, onReturnToAdmin }) => {
  const [view, setView] = useState<'setup' | 'daily' | 'calendar' | 'edital' | 'simulados'>('daily');
  const [calendarMode, setCalendarMode] = useState<'month' | 'week'>('week');
  
  const [plans, setPlans] = useState<StudyPlan[]>([]);
  const [currentPlan, setCurrentPlan] = useState<StudyPlan | null>(null);
  const [schedule, setSchedule] = useState<Record<string, ScheduledItem[]>>({});
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [editalExpanded, setEditalExpanded] = useState<string[]>([]);
  const [editalSubGoalsExpanded, setEditalSubGoalsExpanded] = useState<string[]>([]); // New state
  
  const [pendingPlanId, setPendingPlanId] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void; } | null>(null);

  // FLASHCARDS STATE
  const [activeFlashcards, setActiveFlashcards] = useState<Flashcard[] | null>(null);

  const [activeGoalId, setActiveGoalId] = useState<string | null>(null);
  const [activeSubGoalId, setActiveSubGoalId] = useState<string | null>(null);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const timerRef = useRef<any>(null);

  const [simuladoClasses, setSimuladoClasses] = useState<SimuladoClass[]>([]);
  const [attempts, setAttempts] = useState<SimuladoAttempt[]>([]);
  const [activeSimulado, setActiveSimulado] = useState<Simulado | null>(null);
  const [allAttempts, setAllAttempts] = useState<SimuladoAttempt[]>([]);
  const [allUsersMap, setAllUsersMap] = useState<Record<string, User>>({});

  const [selectedDate, setSelectedDate] = useState(getTodayStr());

  useEffect(() => { loadData(); }, [user.id]); 
  useEffect(() => {
      if (isTimerRunning) {
          timerRef.current = setInterval(() => { setTimerSeconds(prev => prev + 1); }, 1000);
      } else { if (timerRef.current) clearInterval(timerRef.current); }
      return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isTimerRunning]);

  useEffect(() => {
    const hasRoutine = user.routine && user.routine.days && Object.values(user.routine.days).some((v: number) => v > 0);
    if (currentPlan && hasRoutine) {
        const config = user.planConfigs?.[currentPlan.id];
        const allSimulados = simuladoClasses.flatMap(sc => sc.simulados);
        const generated = generateSchedule(currentPlan, user.routine, config?.startDate || getTodayStr(), user.progress.completedGoalIds, user.level || 'iniciante', config?.isPaused || false, allSimulados, attempts);
        setSchedule(generated);
    } else { setSchedule({}); }
  }, [currentPlan, user.routine, user.progress.completedGoalIds, user.level, user.planConfigs, simuladoClasses, attempts]);

  const loadData = async () => {
      const allPlans = await fetchPlansFromDB();
      const userPlans = user.isAdmin ? allPlans : allPlans.filter(p => user.allowedPlans?.includes(p.id));
      setPlans(userPlans);
      let activePlan: StudyPlan | undefined;
      if (user.currentPlanId) activePlan = userPlans.find(p => p.id === user.currentPlanId);
      if (!activePlan && userPlans.length > 0) activePlan = userPlans[0];
      if (activePlan) setCurrentPlan(activePlan);

      const allClasses = await fetchSimuladoClassesFromDB();
      setSimuladoClasses(user.isAdmin ? allClasses : allClasses.filter(c => user.allowedSimuladoClasses?.includes(c.id) || activePlan?.linkedSimuladoClasses?.includes(c.id)));
      
      const fetchedAttempts = await fetchSimuladoAttemptsFromDB();
      setAllAttempts(fetchedAttempts);
      setAttempts(fetchedAttempts.filter(a => a.userId === user.id));

      const fetchedUsers = await fetchUsersFromDB();
      const userMap: Record<string, User> = {};
      fetchedUsers.forEach(u => userMap[u.id] = u);
      setAllUsersMap(userMap);
      
      const hasRoutine = user.routine && user.routine.days && Object.values(user.routine.days).some((v: number) => v > 0);
      if (!hasRoutine) setView('setup'); 
  };

  const executePlanSwitch = async (newPlanId: string) => {
      const targetPlan = plans.find(p => p.id === newPlanId);
      if (!targetPlan) return;
      
      const oldPlanId = currentPlan?.id;
      const newConfigs = { ...user.planConfigs };
      
      // Pause current plan
      if (oldPlanId) {
          newConfigs[oldPlanId] = { 
              ...(newConfigs[oldPlanId] || { startDate: getTodayStr() }), 
              isPaused: true 
          };
      }
      
      // Activate new plan
      if (!newConfigs[newPlanId]) {
          newConfigs[newPlanId] = { startDate: getTodayStr(), isPaused: false };
      } else {
          newConfigs[newPlanId] = { ...newConfigs[newPlanId], isPaused: false };
      }
      
      const updatedUser = { 
          ...user, 
          currentPlanId: newPlanId, 
          planConfigs: newConfigs 
      };
      
      setCurrentPlan(targetPlan);
      onUpdateUser(updatedUser);
      await saveUserToDB(updatedUser);
      
      setConfirmModal(null);
      setPendingPlanId(null);
      loadData(); 
  };

  const initiatePlanSwitch = (newPlanId: string) => { 
      if (newPlanId === currentPlan?.id) return;
      
      setPendingPlanId(newPlanId);
      setConfirmModal({
          isOpen: true,
          title: "Trocar Plano de Estudos",
          message: "Ao selecionar este novo plano, seu plano atual será pausado e todo o seu progresso será salvo. Você poderá retornar a ele a qualquer momento. Confirmar troca?",
          onConfirm: () => executePlanSwitch(newPlanId)
      });
  };

  const handleSetupSave = async (routine: Routine, level: UserLevel) => {
      const updatedUser = { ...user, routine, level };
      if (currentPlan) {
           const newConfigs = { ...updatedUser.planConfigs };
           if (!newConfigs[currentPlan.id]) newConfigs[currentPlan.id] = { startDate: getTodayStr(), isPaused: false };
           updatedUser.planConfigs = newConfigs;
           updatedUser.currentPlanId = currentPlan.id;
      }
      onUpdateUser(updatedUser);
      await saveUserToDB(updatedUser);
      setView('daily');
  };

  const handlePlanAction = async (action: 'pause' | 'reschedule' | 'restart') => {
      if (!currentPlan) return;
      const config = user.planConfigs[currentPlan.id] || { startDate: getTodayStr(), isPaused: false };
      
      if (action === 'restart') {
          // Restart logic: Defensively clear all completed goals for this user
          // FIX: Simplified to avoid filter on unknown type and directly reset the completed goals list.
          const newCompleted: string[] = [];
          const updatedUser = { ...user, progress: { ...user.progress, completedGoalIds: newCompleted }, planConfigs: { ...user.planConfigs, [currentPlan.id]: { startDate: getTodayStr(), isPaused: false } } };
          onUpdateUser(updatedUser);
          await saveUserToDB(updatedUser);
          return;
      }

      let newConfig = { ...config };
      if (action === 'pause') newConfig.isPaused = !newConfig.isPaused;
      else if (action === 'reschedule') { newConfig.startDate = getTodayStr(); newConfig.isPaused = false; }
      const updatedUser = { ...user, planConfigs: { ...user.planConfigs, [currentPlan.id]: newConfig } };
      onUpdateUser(updatedUser);
      await saveUserToDB(updatedUser);
  };

  const startTimer = (gid: string, sid?: string) => { setIsTimerRunning(true); setActiveGoalId(gid); setActiveSubGoalId(sid || null); };
  const pauseTimer = () => setIsTimerRunning(false);
  const saveStudyTime = async (comp: boolean) => { 
      const seconds = timerSeconds;
      const newTotal = (user.progress.totalStudySeconds || 0) + seconds;
      const planTotal = (user.progress.planStudySeconds?.[currentPlan?.id || ''] || 0) + seconds;
      const updatedUser = { ...user, progress: { ...user.progress, totalStudySeconds: newTotal, planStudySeconds: { ...user.progress.planStudySeconds, [currentPlan?.id||'']: planTotal } } };
      
      setIsTimerRunning(false); setActiveGoalId(null); setTimerSeconds(0); 
      if(comp && activeGoalId) {
          if(!updatedUser.progress.completedGoalIds.includes(activeGoalId)) updatedUser.progress.completedGoalIds.push(activeGoalId);
      }
      onUpdateUser(updatedUser);
      await saveUserToDB(updatedUser);
  };
  
  const toggleGoalComplete = (gid: string) => { 
      const isCompleted = user.progress.completedGoalIds.includes(gid);
      
      if (!isCompleted) {
          setConfirmModal({
              isOpen: true,
              title: "Concluir Meta?",
              message: "Deseja marcar esta meta como concluída?",
              onConfirm: () => {
                  const newCompleted = [...user.progress.completedGoalIds, gid];
                  const updatedUser = { ...user, progress: { ...user.progress, completedGoalIds: newCompleted } };
                  onUpdateUser(updatedUser);
                  saveUserToDB(updatedUser);
                  setConfirmModal(null);
              }
          });
      } else {
          const newCompleted = user.progress.completedGoalIds.filter(id => id !== gid);
          const updatedUser = { ...user, progress: { ...user.progress, completedGoalIds: newCompleted } };
          onUpdateUser(updatedUser);
          saveUserToDB(updatedUser);
      }
  };
  
  const handleSimuladoFinished = async (result: SimuladoAttempt) => { await saveSimuladoAttemptToDB(result); setAttempts(prev => [...prev, result]); setAllAttempts(prev => [...prev, result]); };
  const toggleAccordion = (uniqueId: string) => setExpandedItems((prev: string[]) => prev.includes(uniqueId) ? prev.filter(id => id !== uniqueId) : [...prev, uniqueId]);
  
  // Helper for Edital SubGoals Accordion
  const toggleEditalSubGoals = (goalId: string) => {
      setEditalSubGoalsExpanded((prev: string[]) => prev.includes(goalId) ? prev.filter(id => id !== goalId) : [...prev, goalId]);
  };

  const renderDailyView = () => {
      const daySchedule = schedule[selectedDate] || [];
      const isToday = selectedDate === getTodayStr();
      const dayName = getDayName(selectedDate);
      const todayStr = getTodayStr();

      // Find late goals from any date before today that are not completed
      const lateItems = Object.entries(schedule)
          .filter(([date]) => date < todayStr)
          .flatMap(([_, items]) => items.filter(item => !item.completed));
      
      return (
          <div className="w-full animate-fade-in space-y-6">
              {/* LATE GOALS SECTION */}
              {lateItems.length > 0 && (
                  <div className="bg-red-900/10 border border-red-500/30 rounded-2xl p-6 mb-10 shadow-[0_0_30px_rgba(255,31,31,0.05)]">
                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                          <div>
                              <h3 className="text-xl font-black text-red-500 uppercase flex items-center gap-2">
                                  <Icon.Clock className="w-5 h-5"/> Metas em Atraso
                              </h3>
                              <p className="text-xs text-gray-400 mt-1 font-bold uppercase tracking-wider">
                                  Você possui {lateItems.length} metas pendentes de dias anteriores.
                              </p>
                          </div>
                          <button 
                            onClick={() => handlePlanAction('reschedule')}
                            className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-black text-xs uppercase shadow-neon transition-all transform hover:scale-[1.02] flex items-center gap-2 shrink-0"
                          >
                            <Icon.RefreshCw className="w-4 h-4"/> REPLANEJAR ATRASOS
                          </button>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5 gap-4 opacity-90">
                          {lateItems.map((item) => {
                                const goalColor = item.goalType === 'SIMULADO' ? '#3B82F6' : (item.originalGoal?.color || '#FF1F1F');
                                const isActive = activeGoalId === item.goalId;
                                const isExpanded = expandedItems.includes(item.uniqueId);

                                return (
                                    <div key={item.uniqueId} className={`relative bg-[#0A0A0A] rounded-xl border-l-4 transition-all duration-200 overflow-hidden border border-[#333] ${isActive ? 'ring-1 ring-yellow-500/30 shadow-2xl' : ''}`} style={{ borderLeftColor: isActive ? '#EAB308' : goalColor }}>
                                        <div className="p-3 flex items-start gap-3 h-full">
                                            <div onClick={() => toggleGoalComplete(item.goalId)} className={`shrink-0 w-5 h-5 rounded-full border flex items-center justify-center cursor-pointer transition ${item.completed ? 'bg-green-500 border-green-500 text-black' : 'border-gray-600 hover:border-white'}`}>
                                                {item.completed && <Icon.Check className="w-3 h-3" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-start mb-0.5">
                                                    <span className="text-[8px] font-bold bg-white/5 px-1.5 py-0.5 rounded text-gray-500 uppercase">{item.goalType}</span>
                                                    <span className="text-[8px] font-mono text-red-500 font-bold uppercase">{formatDate(item.date)}</span>
                                                </div>
                                                <h3 className="font-bold text-sm leading-tight truncate text-white">{item.title}</h3>
                                                <div className="text-[10px] text-gray-500 mt-0.5 flex gap-1 truncate font-bold">
                                                    <span style={{ color: goalColor }} className="truncate">{item.disciplineName}</span>
                                                </div>
                                                
                                                <div className="mt-2 flex gap-1">
                                                    <button onClick={() => startTimer(item.goalId)} className="flex items-center gap-1 bg-white/5 hover:bg-white/10 px-2 py-1 rounded text-[8px] font-bold text-white transition border border-white/5">
                                                        <Icon.Play className="w-2 h-2" /> INICIAR
                                                    </button>
                                                    {item.originalGoal?.pdfUrl && item.goalType !== 'REVISAO' && (
                                                        <button onClick={() => openWatermarkedPDF(item.originalGoal!.pdfUrl!, user)} className="flex items-center gap-1 bg-white/5 hover:bg-white/10 border border-white/5 px-2 py-1 rounded text-[8px] font-bold transition text-gray-300">
                                                            <Icon.FileText className="w-2 h-2"/> PDF
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                          })}
                      </div>
                  </div>
              )}

              <div className="flex justify-between items-end border-b border-[#333] pb-4">
                  <div>
                      <h2 className="text-4xl font-black text-white uppercase tracking-tight">{isToday ? 'HOJE' : formatDate(selectedDate)}</h2>
                      <p className="text-insanus-red font-mono text-sm uppercase">{WEEKDAYS.find(w => w.key === dayName)?.label}</p>
                  </div>
                  <div className="text-right">
                      <div className="text-3xl font-black text-white">{daySchedule.length}</div>
                      <div className="text-[10px] text-gray-500 uppercase font-bold">Metas</div>
                  </div>
              </div>

              {daySchedule.length === 0 ? (
                   <div className="text-center py-20 text-gray-600 italic">Nada agendado para hoje.</div>
              ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                      {daySchedule.map((item) => {
                          const goalColor = item.goalType === 'SIMULADO' ? '#3B82F6' : (item.originalGoal?.color || '#FF1F1F');
                          const isActive = activeGoalId === item.goalId;
                          const isExpanded = expandedItems.includes(item.uniqueId);
                          
                          if (item.goalType === 'SIMULADO') {
                              return (
                                <div key={item.uniqueId} className="bg-blue-900/10 border border-blue-500 rounded-xl p-6 relative overflow-hidden group hover:bg-blue-900/20 transition-all">
                                    <div className="absolute top-0 left-0 w-2 h-full bg-blue-500"></div>
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="bg-blue-500 text-white text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider">META DE SIMULADO</span>
                                                <span className="text-blue-400 text-xs font-mono">{item.duration} min est.</span>
                                            </div>
                                            <h3 className="text-2xl font-black text-white mb-1">{item.title}</h3>
                                            <p className="text-gray-400 text-sm">{item.subjectName}</p>
                                        </div>
                                        <Icon.List className="w-10 h-10 text-blue-500 opacity-20 group-hover:opacity-50 transition-opacity"/>
                                    </div>
                                    <div className="mt-6 flex gap-4">
                                        <button 
                                            onClick={() => setActiveSimulado(item.simuladoData || null)}
                                            className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-lg font-bold text-sm uppercase shadow-[0_0_15px_rgba(37,99,235,0.4)] transition-all transform hover:scale-[1.05] flex items-center gap-2"
                                        >
                                            <Icon.Play className="w-4 h-4"/> REALIZAR SIMULADO AGORA
                                        </button>
                                    </div>
                                </div>
                              );
                          }

                          return (
                            <div key={item.uniqueId} className={`relative bg-[#121212] rounded-xl border-l-4 transition-all duration-200 overflow-hidden ${item.completed ? 'border-green-500 opacity-60' : isActive ? 'border-yellow-500 bg-yellow-900/05 z-30 ring-1 ring-yellow-500/30 scale-[1.01] shadow-2xl' : 'hover:z-20 hover:scale-[1.005] hover:bg-[#151515]'}`} style={{ borderLeftColor: item.completed ? undefined : isActive ? '#EAB308' : goalColor }}>
                                <div className="p-4 flex items-start gap-4 border border-[#333] rounded-r-xl border-l-0 h-full">
                                    <div onClick={() => toggleGoalComplete(item.goalId)} className={`shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center cursor-pointer transition ${item.completed ? 'bg-green-500 border-green-500 text-black' : 'border-gray-500 hover:border-white'}`}>
                                        {item.completed && <Icon.Check className="w-4 h-4" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="text-[10px] font-bold bg-white/10 px-2 py-0.5 rounded text-gray-300 uppercase">{item.goalType}</span>
                                            {isActive && (!activeSubGoalId || item.goalType !== 'AULA') ? <span className="text-sm font-mono font-bold text-yellow-500 animate-pulse">{formatStopwatch(timerSeconds)}</span> : <span className="text-[10px] font-mono text-gray-500">{item.duration} min</span>}
                                        </div>
                                        <h3 className={`font-bold text-lg leading-tight truncate ${item.completed ? 'line-through text-gray-500' : 'text-white'}`}>{item.title}</h3>
                                        <div className="text-xs text-gray-400 mt-1 flex gap-2 truncate">
                                            <span style={{ color: isActive ? '#EAB308' : goalColor }} className="font-bold truncate">{item.disciplineName}</span>
                                            <span>•</span>
                                            <span className="truncate">{item.subjectName}</span>
                                        </div>
                                        
                                        {!item.completed && item.goalType !== 'AULA' && (
                                            <div className="mt-4 flex gap-2">
                                                {!isActive ? (
                                                    <button onClick={() => startTimer(item.goalId)} className="flex items-center gap-2 bg-insanus-red hover:bg-red-600 px-4 py-2 rounded text-xs font-bold text-white transition shadow-neon"><Icon.Play className="w-3 h-3" /> INICIAR</button>
                                                ) : (
                                                    <>
                                                        {isTimerRunning ? <button onClick={pauseTimer} className="flex items-center gap-2 bg-yellow-600 px-4 py-2 rounded text-xs font-bold text-white"><Icon.Pause className="w-3 h-3" /> PAUSAR</button> : <button onClick={() => setIsTimerRunning(true)} className="flex items-center gap-2 bg-green-600 px-4 py-2 rounded text-xs font-bold text-white"><Icon.Play className="w-3 h-3" /> RETOMAR</button>}
                                                        <button onClick={() => saveStudyTime(false)} className="flex items-center gap-2 bg-gray-700 px-4 py-2 rounded text-xs font-bold text-white"><Icon.Check className="w-3 h-3" /> SALVAR TEMPO</button>
                                                    </>
                                                )}
                                            </div>
                                        )}
                                        
                                        {/* AULA SUBGOALS LIST */}
                                        {item.goalType === 'AULA' && item.originalGoal?.subGoals && item.originalGoal.subGoals.length > 0 && (
                                            <div className="mt-4 border-t border-[#333] pt-2">
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); toggleAccordion(item.uniqueId); }}
                                                    className="flex items-center gap-2 text-[10px] text-gray-500 font-bold uppercase hover:text-white transition w-full"
                                                >
                                                    {isExpanded ? <Icon.ChevronDown className="w-3 h-3 rotate-180"/> : <Icon.ChevronDown className="w-3 h-3"/>}
                                                    {item.originalGoal.subGoals.length} Aulas - Ver Lista
                                                </button>
                                                
                                                {isExpanded && (
                                                    <div className="mt-2 space-y-2 pl-2 border-l border-[#333]">
                                                        {item.originalGoal.subGoals.map((sub, idx) => {
                                                            const isSubActive = activeGoalId === item.goalId && activeSubGoalId === sub.id;
                                                            return (
                                                                <div key={sub.id} className={`flex items-center justify-between p-2 rounded border border-transparent hover:border-[#333] hover:bg-white/5 transition group relative overflow-hidden ${isSubActive ? 'bg-yellow-900/10 border-yellow-900/30' : ''}`}>
                                                                    <div className="flex items-center gap-2 text-xs text-gray-400 flex-1 min-w-0 mr-2">
                                                                        <span className="text-[10px] font-mono text-gray-600 w-4 shrink-0">{idx + 1}.</span>
                                                                        <span className={`truncate ${item.completed ? 'line-through opacity-50' : isSubActive ? 'text-yellow-500 font-bold' : 'text-gray-300'}`} title={sub.title}>
                                                                            {sub.title}
                                                                        </span>
                                                                        <span className="text-[9px] bg-[#1E1E1E] px-1 rounded text-gray-600 whitespace-nowrap shrink-0">{sub.duration}m</span>
                                                                        {sub.link && (
                                                                            <a href={sub.link} target="_blank" rel="noreferrer" className="text-insanus-red hover:text-white transition shrink-0">
                                                                                <Icon.Link className="w-3 h-3"/>
                                                                            </a>
                                                                        )}
                                                                    </div>
                                                                    
                                                                    {/* CONTROLS */}
                                                                    <div className="flex items-center gap-1 shrink-0">
                                                                        {isSubActive ? (
                                                                            <div className="flex items-center gap-1 bg-[#050505] p-1 rounded-lg border border-[#333] shadow-sm">
                                                                                <span className="text-yellow-500 font-mono font-bold text-xs w-[50px] text-center bg-black/50 rounded px-1 py-1 border border-white/5">
                                                                                    {formatStopwatch(timerSeconds)}
                                                                                </span>
                                                                                
                                                                                {/* Play/Pause */}
                                                                                <button 
                                                                                    onClick={(e) => { e.stopPropagation(); isTimerRunning ? pauseTimer() : setIsTimerRunning(true); }} 
                                                                                    className={`w-7 h-7 flex items-center justify-center rounded transition ${isTimerRunning ? 'bg-yellow-600 text-white' : 'bg-green-600 text-white'}`}
                                                                                    title={isTimerRunning ? "Pausar" : "Retomar"}
                                                                                >
                                                                                    {isTimerRunning ? <Icon.Pause className="w-3 h-3"/> : <Icon.Play className="w-3 h-3"/>}
                                                                                </button>

                                                                                {/* Restart */}
                                                                                <button 
                                                                                    onClick={(e) => { e.stopPropagation(); if(confirm('Reiniciar cronômetro?')) setTimerSeconds(0); }} 
                                                                                    className="w-7 h-7 flex items-center justify-center rounded bg-gray-700 hover:bg-red-600 text-white transition"
                                                                                    title="Reiniciar Tempo"
                                                                                >
                                                                                    <Icon.RefreshCw className="w-3 h-3"/>
                                                                                </button>

                                                                                {/* Save */}
                                                                                <button 
                                                                                    onClick={(e) => { e.stopPropagation(); saveStudyTime(false); }} 
                                                                                    className="w-7 h-7 flex items-center justify-center rounded bg-blue-600 hover:bg-blue-500 text-white transition"
                                                                                    title="Salvar Tempo"
                                                                                >
                                                                                    <Icon.Check className="w-3 h-3"/>
                                                                                </button>
                                                                            </div>
                                                                        ) : (
                                                                            <button 
                                                                                onClick={(e) => { e.stopPropagation(); startTimer(item.goalId, sub.id); }}
                                                                                disabled={!!activeGoalId}
                                                                                className={`px-3 py-1.5 rounded border border-white/10 transition flex items-center gap-2 text-[10px] font-bold uppercase ${!!activeGoalId ? 'opacity-20 cursor-not-allowed' : 'hover:bg-insanus-red hover:text-white text-gray-400 bg-[#1E1E1E]'}`}
                                                                                title="Iniciar Aula"
                                                                            >
                                                                                <Icon.Play className="w-3 h-3"/> Iniciar
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        <div className="mt-3 flex flex-wrap gap-2">
                                            {item.originalGoal?.pdfUrl && item.goalType !== 'REVISAO' && (
                                                <button onClick={() => openWatermarkedPDF(item.originalGoal!.pdfUrl!, user)} className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-2 rounded text-[10px] font-bold uppercase transition text-gray-300 hover:text-white">
                                                    <Icon.FileText className="w-3 h-3 text-insanus-red"/> ABRIR PDF
                                                </button>
                                            )}
                                            {item.goalType === 'REVISAO' && item.originalGoal?.flashcards && item.originalGoal.flashcards.length > 0 && (
                                                <button 
                                                    onClick={() => setActiveFlashcards(item.originalGoal!.flashcards!)}
                                                    className="flex items-center gap-2 bg-blue-600/20 hover:bg-blue-600/40 border border-blue-600/50 px-3 py-2 rounded text-[10px] font-bold uppercase transition text-blue-400 hover:text-white shadow-[0_0_10px_rgba(37,99,235,0.2)]"
                                                >
                                                    <Icon.RefreshCw className="w-3 h-3"/> REVISAR COM FLASHCARDS
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                          );
                      })}
                  </div>
              )}
          </div>
      );
  };

  const renderCalendarView = () => {
      const weekDates = getWeekDays(selectedDate);
      const generateMonthGrid = () => {
          const date = new Date(selectedDate);
          const year = date.getFullYear();
          const month = date.getMonth();
          const firstDay = new Date(year, month, 1);
          const startDay = firstDay.getDay();
          const startDate = new Date(firstDay);
          startDate.setDate(startDate.getDate() - startDay);
          const grid = [];
          for(let i=0; i<42; i++) {
               const d = new Date(startDate);
               d.setDate(d.getDate() + i);
               grid.push(d.toISOString().split('T')[0]);
          }
          return grid;
      };
  
      const monthDates = generateMonthGrid();
      const currentMonthName = new Date(selectedDate).toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
      const todayStr = getTodayStr();
  
      return (
          <div className="w-full animate-fade-in h-[calc(100vh-100px)] flex flex-col">
               <div className="flex justify-between items-center border-b border-[#333] pb-6 shrink-0">
                  <div>
                      <h2 className="text-3xl font-black text-white uppercase">CALENDÁRIO</h2>
                      <p className="text-xs text-insanus-red font-bold uppercase tracking-widest">{currentMonthName}</p>
                  </div>
                  <div className="flex items-center gap-4">
                      <div className="flex bg-[#121212] rounded-lg p-1 border border-[#333]">
                          <button onClick={() => setCalendarMode('week')} className={`px-4 py-2 text-xs font-bold rounded transition-all ${calendarMode === 'week' ? 'bg-insanus-red text-white shadow-neon' : 'text-gray-400 hover:text-white'}`}>SEMANAL</button>
                          <button onClick={() => setCalendarMode('month')} className={`px-4 py-2 text-xs font-bold rounded transition-all ${calendarMode === 'month' ? 'bg-insanus-red text-white shadow-neon' : 'text-gray-400 hover:text-white'}`}>MENSAL</button>
                      </div>
                      <div className="flex gap-1 bg-[#121212] rounded-lg border border-[#333] p-1">
                          <button onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate() - (calendarMode === 'week' ? 7 : 30)); setSelectedDate(d.toISOString().split('T')[0]); }} className="p-2 hover:bg-white/10 rounded text-white transition"><Icon.ArrowUp className="-rotate-90 w-4 h-4" /></button>
                          <button onClick={() => setSelectedDate(getTodayStr())} className="px-3 py-2 hover:bg-white/10 rounded text-[10px] font-bold text-white uppercase transition border-x border-white/5">Hoje</button>
                          <button onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate() + (calendarMode === 'week' ? 7 : 30)); setSelectedDate(d.toISOString().split('T')[0]); }} className="p-2 hover:bg-white/10 rounded text-white transition"><Icon.ArrowDown className="-rotate-90 w-4 h-4" /></button>
                      </div>
                  </div>
              </div>
  
              <div className="grid grid-cols-7 gap-2 mb-2 mt-4 text-center shrink-0">
                  {WEEKDAYS.map(d => <div key={d.key} className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{d.label.split('-')[0]}</div>)}
              </div>
  
              <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                  {calendarMode === 'week' ? (
                      <div className="grid grid-cols-7 gap-2 h-full min-h-[600px]">
                          {weekDates.map(dateStr => {
                              const items = schedule[dateStr] || [];
                              const isSelected = selectedDate === dateStr;
                              const isToday = dateStr === getTodayStr();
                              const hasLateGoals = dateStr < todayStr && items.some(i => !i.completed);
  
                              return (
                                  <div key={dateStr} onClick={() => { setSelectedDate(dateStr); setView('daily'); }} className={`rounded-xl border flex flex-col transition-all cursor-pointer group h-full bg-[#121212] ${isSelected ? 'bg-[#1E1E1E] border-insanus-red shadow-[inset_0_0_20px_rgba(255,31,31,0.1)]' : 'border-[#333] hover:border-[#555] hover:bg-[#1A1A1A]'} ${isToday ? 'ring-1 ring-insanus-red ring-offset-2 ring-offset-black' : ''} ${hasLateGoals ? 'border-red-500/50 bg-red-900/10' : ''}`}>
                                      <div className={`text-center p-3 border-b border-[#333] ${isToday ? 'bg-insanus-red text-white' : 'bg-[#1A1A1A]'} relative`}>
                                          <div className="text-2xl font-black">{dateStr.split('-')[2]}</div>
                                          {hasLateGoals && <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-500 shadow-[0_0_5px_red] animate-pulse"></div>}
                                      </div>
                                      <div className="flex-1 p-2 space-y-2 overflow-y-auto custom-scrollbar">
                                          {items.map((item, i) => {
                                              const goalColor = item.goalType === 'SIMULADO' ? '#3B82F6' : (item.originalGoal?.color || '#FF1F1F');
                                              return (
                                                  <div key={i} className={`p-3 rounded-lg border-l-4 bg-black shadow-lg hover:translate-y-[-2px] transition-all ${item.completed ? 'opacity-50 grayscale' : ''}`} style={{ borderLeftColor: goalColor, borderTop: '1px solid #333', borderRight: '1px solid #333', borderBottom: '1px solid #333' }}>
                                                      <div className="flex justify-between items-start mb-1">
                                                          <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: goalColor }}>{item.disciplineName}</span>
                                                          {item.completed && <Icon.Check className="w-3 h-3 text-green-500" />}
                                                      </div>
                                                      <div className="text-xs font-bold text-white leading-snug line-clamp-3 mb-2">{item.title}</div>
                                                      <div className="flex items-center gap-2 mt-auto">
                                                          <span className="px-1.5 py-0.5 rounded bg-white/10 text-[8px] font-mono text-gray-400">{item.duration}m</span>
                                                          <span className="text-[8px] uppercase font-bold text-gray-500">{item.goalType}</span>
                                                      </div>
                                                  </div>
                                              )
                                          })}
                                      </div>
                                  </div>
                              );
                          })}
                      </div>
                  ) : (
                      <div className="grid grid-cols-7 gap-2 h-full grid-rows-6">
                          {monthDates.map(dateStr => {
                              const items = schedule[dateStr] || [];
                              const isSelected = selectedDate === dateStr;
                              const isToday = dateStr === getTodayStr();
                              const isCurrentMonth = dateStr.slice(0, 7) === selectedDate.slice(0, 7);
                              const hasLateGoals = dateStr < todayStr && items.some(i => !i.completed);
  
                              return (
                                  <div key={dateStr} onClick={() => { setSelectedDate(dateStr); setView('daily'); }} className={`rounded-lg border p-2 flex flex-col transition-all cursor-pointer hover:bg-[#1A1A1A] min-h-[80px] ${isSelected ? 'bg-[#1E1E1E] border-insanus-red' : 'border-[#333] bg-[#121212]'} ${!isCurrentMonth ? 'opacity-30' : ''} ${hasLateGoals ? 'border-red-500/50' : ''}`}>
                                      <div className="flex justify-between items-center mb-1">
                                          <div className="flex items-center gap-1">
                                              <span className={`text-xs font-bold ${isToday ? 'text-insanus-red bg-insanus-red/10 px-1.5 rounded' : 'text-gray-400'}`}>{dateStr.split('-')[2]}</span>
                                              {hasLateGoals && <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>}
                                          </div>
                                          {items.length > 0 && <span className="text-[9px] text-gray-600 font-mono">{items.length}</span>}
                                      </div>
                                      <div className="flex-1 flex flex-col gap-1 overflow-hidden">
                                          {items.slice(0, 3).map((item, i) => (
                                              <div key={i} className="flex items-center gap-1">
                                                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${item.completed ? 'bg-green-500' : ''}`} style={{ backgroundColor: item.completed ? undefined : item.goalType === 'SIMULADO' ? '#3B82F6' : (item.originalGoal?.color || '#333') }}></div>
                                                  <div className="text-[9px] text-gray-500 truncate leading-none">{item.disciplineName}</div>
                                              </div>
                                          ))}
                                          {items.length > 3 && <div className="text-[8px] text-gray-600 text-center font-bold mt-auto">+{items.length - 3} mais</div>}
                                      </div>
                                  </div>
                              );
                          })}
                      </div>
                  )}
              </div>
          </div>
      );
  };

  const renderEditalView = () => {
      if (!currentPlan?.editalVerticalizado || currentPlan.editalVerticalizado.length === 0) {
          return (
              <div className="flex flex-col items-center justify-center h-64 text-gray-500 border border-dashed border-[#333] rounded-2xl">
                  <Icon.List className="w-12 h-12 mb-4 opacity-50"/>
                  <p>Edital Verticalizado não configurado para este plano.</p>
              </div>
          );
      }

      let totalTopics = 0;
      let completedTopics = 0;
      const ORDERED_LINKS = ['aula', 'material', 'questoes', 'leiSeca', 'resumo', 'revisao'];

      const findGoal = (goalId: string) => {
          for (const d of currentPlan.disciplines) {
              for (const s of d.subjects) {
                  const g = s.goals.find(g => g.id === goalId);
                  if (g) return g;
              }
          }
          return null;
      };

      const isTopicDone = (t: EditalTopic) => {
          const linkedGoalIds = ORDERED_LINKS.map(type => t.links[type as keyof typeof t.links]).filter(id => !!id) as string[];
          if (linkedGoalIds.length === 0) return false;
          const allGoalsDone = linkedGoalIds.every(gid => user.progress.completedGoalIds.includes(gid));
          return allGoalsDone; 
      };

      currentPlan.editalVerticalizado.forEach(disc => {
          disc.topics.forEach(topic => {
              totalTopics++;
              if (isTopicDone(topic)) completedTopics++;
          });
      });

      const percentage = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;

      const toggleEditalDisc = (id: string) => {
          setEditalExpanded((prev: string[]) => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
      };

      return (
          <div className="w-full animate-fade-in space-y-6">
              <div className="flex justify-between items-end border-b border-[#333] pb-4">
                  <div>
                      <h2 className="text-3xl font-black text-white uppercase tracking-tight">Edital Verticalizado</h2>
                      <p className="text-gray-500 text-sm">Acompanhe sua cobertura do edital.</p>
                  </div>
                  <div className="text-right">
                      <div className="text-3xl font-black text-insanus-red">{percentage}%</div>
                      <div className="text-[10px] text-gray-500 uppercase font-bold">Cobertura</div>
                  </div>
              </div>

              <div className="space-y-4">
                  {currentPlan.editalVerticalizado.map(disc => {
                      const isExp = editalExpanded.includes(disc.id);
                      const dTopics = disc.topics.length;
                      const dDone = disc.topics.filter(t => isTopicDone(t)).length;
                      const dProg = dTopics > 0 ? Math.round((dDone / dTopics) * 100) : 0;

                      return (
                          <div key={disc.id} className="bg-[#121212] rounded-xl border border-[#333] overflow-hidden">
                              <div 
                                  onClick={() => toggleEditalDisc(disc.id)}
                                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-[#1E1E1E] transition border-b border-[#333]"
                              >
                                  <div className="flex items-center gap-3">
                                      <Icon.ChevronDown className={`w-5 h-5 text-gray-500 transition-transform ${isExp ? 'rotate-180' : ''}`} />
                                      <h3 className="font-bold text-white uppercase">{disc.name}</h3>
                                  </div>
                                  <div className="flex items-center gap-4">
                                      <div className="w-32 h-2 bg-black rounded-full overflow-hidden border border-[#333]">
                                          <div className="h-full bg-insanus-red" style={{ width: `${dProg}%` }}></div>
                                      </div>
                                      <span className="text-xs font-mono text-gray-400 w-10 text-right">{dProg}%</span>
                                  </div>
                              </div>
                              
                              {isExp && (
                                  <div className="p-4 space-y-2 animate-fade-in bg-[#0F0F0F]">
                                      {disc.topics.map(topic => {
                                          const done = isTopicDone(topic);
                                          
                                          return (
                                              <div key={topic.id} className="flex flex-col gap-2 py-2 border-b border-[#333] last:border-0">
                                                  <div className="flex items-center gap-3 text-sm group">
                                                      <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${done ? 'bg-green-600 border-green-600' : 'border-gray-600'}`}>
                                                          {done && <Icon.Check className="w-3 h-3 text-black" />}
                                                      </div>
                                                      <span className={`font-bold ${done ? 'text-gray-500 line-through' : 'text-gray-200'}`}>{topic.name}</span>
                                                  </div>
                                                  <div className="flex flex-wrap gap-2 ml-7">
                                                    {ORDERED_LINKS.map(type => {
                                                        const goalId = topic.links[type as keyof typeof topic.links];
                                                        if(!goalId) return null;
                                                        const goal = findGoal(goalId as string);
                                                        if(!goal) return null;
                                                        
                                                        const isGoalDone = user.progress.completedGoalIds.includes(goal.id);

                                                        let IconComp = Icon.FileText;
                                                        if(type === 'aula') IconComp = Icon.Play;
                                                        if(type === 'questoes') IconComp = Icon.Code;
                                                        if(type === 'leiSeca') IconComp = Icon.Book;
                                                        if(type === 'resumo') IconComp = Icon.Edit;
                                                        if(type === 'revisao') IconComp = Icon.RefreshCw;
                                                        
                                                        // 0. AULA SUBGOALS (ACCORDION MODE)
                                                        if (type === 'aula' && goal.subGoals && goal.subGoals.length > 0) {
                                                            const isSubExpanded = editalSubGoalsExpanded.includes(goal.id);
                                                            return (
                                                                <div key={type} className={`flex flex-col transition-all duration-200 ${isSubExpanded ? 'w-full my-2 bg-[#151515] rounded-lg border border-[#333] p-2' : ''}`}>
                                                                    <button
                                                                        onClick={() => toggleEditalSubGoals(goal.id)}
                                                                        className={`flex items-center gap-2 px-2 py-1 rounded border text-[10px] font-bold uppercase transition hover:brightness-125 w-fit ${isGoalDone ? '!border-green-500 !bg-green-500/10 !text-green-500' : ''}`}
                                                                        style={{ borderColor: isGoalDone ? undefined : goal.color || '#333', color: isGoalDone ? undefined : goal.color || '#999' }}
                                                                    >
                                                                        <IconComp className="w-3 h-3"/>
                                                                        {goal.title} <span className="opacity-60 font-mono text-[9px] ml-1">({goal.subGoals.length} aulas)</span>
                                                                        <Icon.ChevronDown className={`w-3 h-3 transition-transform ${isSubExpanded ? 'rotate-180' : ''}`}/>
                                                                    </button>
                                                                    
                                                                    {isSubExpanded && (
                                                                        <div className="flex flex-col gap-1 mt-2 pl-2 border-l border-[#333] ml-1 animate-fade-in">
                                                                            {goal.subGoals.map((sub, idx) => (
                                                                                <a key={sub.id || idx} 
                                                                                    href={sub.link || '#'} 
                                                                                    target="_blank" 
                                                                                    rel="noreferrer" 
                                                                                    onClick={(e) => { if(!sub.link) e.preventDefault(); }}
                                                                                    className={`flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/5 text-[10px] font-bold uppercase transition group/link ${isGoalDone ? 'text-green-500/70 hover:text-green-400' : 'text-gray-400 hover:text-white'}`}
                                                                                >
                                                                                    <div className={`w-4 h-4 rounded-full bg-[#1E1E1E] flex items-center justify-center border border-[#333] transition ${isGoalDone ? 'border-green-500/50 text-green-500' : 'group-hover/link:border-insanus-red group-hover/link:text-insanus-red'}`}>
                                                                                        <Icon.Play className="w-2 h-2"/>
                                                                                    </div>
                                                                                    <span className="truncate">{sub.title}</span>
                                                                                    {sub.duration && <span className="text-[8px] bg-black px-1 rounded text-gray-600 ml-auto font-mono">{sub.duration}m</span>}
                                                                                </a>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        }

                                                        if (type === 'revisao' && goal.flashcards && goal.flashcards.length > 0) {
                                                            return (
                                                                <button key={type} 
                                                                    onClick={() => setActiveFlashcards(goal.flashcards!)}
                                                                    className={`flex items-center gap-2 px-2 py-1 rounded border text-[10px] font-bold uppercase transition hover:brightness-125 ${isGoalDone ? '!border-green-500 !bg-green-500/10 !text-green-500' : ''}`}
                                                                    style={{ borderColor: isGoalDone ? undefined : goal.color || '#333', color: isGoalDone ? undefined : goal.color || '#999' }}
                                                                >
                                                                    <IconComp className="w-3 h-3"/>
                                                                    {goal.title}
                                                                    {goal.hasRevision && <Icon.Clock className="w-3 h-3 ml-1 text-yellow-500" title="Revisão Espaçada Ativa"/>}
                                                                </button>
                                                            );
                                                        }

                                                        if (goal.pdfUrl && type !== 'aula' && type !== 'revisao') {
                                                            return (
                                                                <button key={type} 
                                                                    onClick={() => openWatermarkedPDF(goal.pdfUrl!, user)}
                                                                    className={`flex items-center gap-2 px-2 py-1 rounded border text-[10px] font-bold uppercase transition hover:brightness-125 ${isGoalDone ? '!border-green-500 !bg-green-500/10 !text-green-500' : ''}`}
                                                                    style={{ borderColor: isGoalDone ? undefined : goal.color || '#333', color: isGoalDone ? undefined : goal.color || '#999' }}
                                                                >
                                                                    <IconComp className="w-3 h-3"/>
                                                                    {goal.title}
                                                                    {goal.hasRevision && <Icon.Clock className="w-3 h-3 ml-1 text-yellow-500" title="Revisão Espaçada Ativa"/>}
                                                                </button>
                                                            );
                                                        }

                                                        return (
                                                            <a key={type} 
                                                                href={goal.link} 
                                                                target="_blank" 
                                                                rel="noreferrer" 
                                                                className={`flex items-center gap-2 px-2 py-1 rounded border text-[10px] font-bold uppercase transition hover:brightness-125 ${isGoalDone ? '!border-green-500 !bg-green-500/10 !text-green-500' : ''}`}
                                                                style={{ borderColor: isGoalDone ? undefined : goal.color || '#333', color: isGoalDone ? undefined : goal.color || '#999' }}
                                                            >
                                                                <IconComp className="w-3 h-3"/>
                                                                {goal.title}
                                                                {goal.hasRevision && <Icon.Clock className="w-3 h-3 ml-1 text-yellow-500" title="Revisão Espaçada Ativa"/>}
                                                            </a>
                                                        );
                                                    })}
                                                  </div>
                                              </div>
                                          )
                                      })}
                                  </div>
                              )}
                          </div>
                      )
                  })}
              </div>
          </div>
      );
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#050505] text-gray-200">
        {activeFlashcards && (
            <FlashcardViewer 
                flashcards={activeFlashcards} 
                onClose={() => setActiveFlashcards(null)} 
            />
        )}

        {/* CONFIRMATION MODAL */}
        {confirmModal && confirmModal.isOpen && (
            <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
                <div className="bg-[#121212] border border-[#333] p-6 rounded-xl w-full max-sm shadow-neon">
                    <h3 className="text-lg font-bold text-white mb-2">{confirmModal.title}</h3>
                    <p className="text-gray-400 text-sm mb-6">{confirmModal.message}</p>
                    <div className="flex gap-3">
                        <button onClick={() => setConfirmModal(null)} className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-2 rounded-lg text-xs font-bold transition">CANCELAR</button>
                        <button onClick={confirmModal.onConfirm} className="flex-1 bg-insanus-red hover:bg-red-600 text-white py-2 rounded-lg text-xs font-bold transition shadow-lg">CONFIRMAR</button>
                    </div>
                </div>
            </div>
        )}

        <div className="h-14 border-b border-[#333] bg-[#0F0F0F] flex items-center px-8 gap-8 shrink-0 overflow-x-auto custom-scrollbar z-20 shadow-sm">
             <div className="flex gap-6 flex-1">
                 <button onClick={() => setView('daily')} className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider py-4 border-b-2 transition-all ${view === 'daily' ? 'text-white border-insanus-red' : 'text-gray-500 border-transparent hover:text-gray-300'}`}>
                     <Icon.Check className="w-4 h-4"/> Metas de Hoje
                 </button>
                 <button onClick={() => setView('calendar')} className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider py-4 border-b-2 transition-all ${view === 'calendar' ? 'text-white border-insanus-red' : 'text-gray-500 border-transparent hover:text-gray-300'}`}>
                     <Icon.Calendar className="w-4 h-4"/> Calendário
                 </button>
                 <button onClick={() => setView('edital')} className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider py-4 border-b-2 transition-all ${view === 'edital' ? 'text-white border-insanus-red' : 'text-gray-500 border-transparent hover:text-gray-300'}`}>
                     <Icon.List className="w-4 h-4"/> Edital
                 </button>
                 <button onClick={() => setView('simulados')} className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider py-4 border-b-2 transition-all ${view === 'simulados' ? 'text-white border-insanus-red' : 'text-gray-500 border-transparent hover:text-gray-300'}`}>
                     <Icon.FileText className="w-4 h-4"/> Simulados
                 </button>
                 <button onClick={() => setView('setup')} className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider py-4 border-b-2 transition-all ${view === 'setup' ? 'text-white border-insanus-red' : 'text-gray-500 border-transparent hover:text-gray-300'}`}>
                     <Icon.Clock className="w-4 h-4"/> Configuração
                 </button>
             </div>
             <div className="flex items-center gap-4">
                 <div className="text-right hidden md:block">
                     <div className="text-[9px] text-gray-500 font-bold uppercase">Tempo Total</div>
                     <div className="text-xs font-black text-insanus-red font-mono">{formatSecondsToTime(user.progress.totalStudySeconds)}</div>
                 </div>
                 {(onReturnToAdmin || user.isAdmin) && (
                     <button onClick={onReturnToAdmin} className="text-gray-500 hover:text-white p-2 rounded-full hover:bg-white/5 transition" title="Voltar para Admin">
                         <Icon.LogOut className="w-4 h-4"/>
                     </button>
                 )}
             </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar relative bg-[#050505]">
            {activeSimulado ? (
                <SimuladoRunner 
                    user={user} 
                    classId="" 
                    simulado={activeSimulado} 
                    attempt={attempts.find(a => a.simuladoId === activeSimulado.id)}
                    allAttempts={allAttempts} 
                    allUsersMap={allUsersMap} 
                    onFinish={handleSimuladoFinished} 
                    onBack={() => setActiveSimulado(null)} 
                />
            ) : (
                <>
                    {view === 'setup' && <SetupWizard user={user} allPlans={plans} currentPlan={currentPlan} onSave={handleSetupSave} onPlanAction={handlePlanAction} onUpdateUser={onUpdateUser} onSelectPlan={initiatePlanSwitch} />}
                    {view === 'daily' && renderDailyView()}
                    {view === 'calendar' && renderCalendarView()}
                    {view === 'edital' && renderEditalView()}
                    {view === 'simulados' && (
                        <div className="w-full animate-fade-in space-y-10">
                            <h2 className="text-3xl font-black text-white mb-8 border-b border-[#333] pb-4">SIMULADOS</h2>
                            {simuladoClasses.map(sc => (
                                <div key={sc.id} className="bg-[#121212] rounded-xl p-6 border border-[#333]">
                                    <h3 className="text-xl font-black text-white mb-4">{sc.name}</h3>
                                    <div className="grid gap-4">{sc.simulados.map(sim => {
                                        const attempt = attempts.find(a => a.simuladoId === sim.id);
                                        return (
                                        <div key={sim.id} className="bg-black/40 p-4 rounded-lg flex justify-between items-center border border-[#333]">
                                            <div>
                                                <h4 className="font-bold text-white">{sim.title}</h4>
                                                {attempt && <span className={`text-[10px] font-bold ${attempt.isApproved ? 'text-green-500' : 'text-red-500'}`}>{attempt.isApproved ? 'APROVADO' : 'REPROVADO'} ({attempt.score} pts)</span>}
                                            </div>
                                            <button onClick={() => setActiveSimulado(sim)} className="bg-insanus-red px-4 py-2 rounded text-xs font-bold text-white">
                                                {attempt ? 'VER RESULTADO' : 'ACESSAR'}
                                            </button>
                                        </div>
                                    )})}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    </div>
  );
};