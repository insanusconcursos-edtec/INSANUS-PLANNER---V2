import React, { useState } from 'react';
import { User } from '../types';
import { ADMIN_EMAIL, ADMIN_PASS } from '../constants';
import { authenticateUserDB } from '../services/db';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Icon } from '../components/Icons';

interface LoginScreenProps {
  onLogin: (user: User) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Normalize Input
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPass = password.trim();

    try {
        // 1. Admin Login
        if (normalizedEmail === ADMIN_EMAIL.toLowerCase() && normalizedPass === ADMIN_PASS) {
          const adminId = 'admin_1'; // ID fixo para persistência dos dados de teste do admin
          
          try {
            const adminDocRef = doc(db, "users", adminId);
            const adminDoc = await getDoc(adminDocRef);

            if (adminDoc.exists()) {
                // Admin já existe no banco, carrega os dados REAIS salvos (progresso, rotina, etc)
                const savedAdmin = adminDoc.data() as User;
                console.log("Dados do Administrador carregados do DB:", savedAdmin);
                onLogin({ ...savedAdmin, isAdmin: true });
            } else {
                // Primeiro acesso do Admin: Cria perfil inicial no DB para poder salvar progresso futuro
                const defaultAdmin: User = {
                    id: adminId,
                    name: 'Administrador (Modo Teste)',
                    email: ADMIN_EMAIL,
                    cpf: '000.000.000-00',
                    level: 'avancado',
                    isAdmin: true,
                    allowedPlans: [], // Admin vê todos via lógica do Dashboard
                    allowedSimuladoClasses: [], // Inicialmente nenhuma turma, mas admin vê tudo
                    planExpirations: {},
                    planConfigs: {},
                    routine: { days: {} }, // Começa vazio para obrigar o teste de setup
                    progress: { 
                        completedGoalIds: [], 
                        completedRevisionIds: [], 
                        totalStudySeconds: 0, 
                        planStudySeconds: {} 
                    },
                    tempPassword: ADMIN_PASS
                };
                
                await setDoc(adminDocRef, defaultAdmin);
                console.log("Perfil de teste do Administrador criado no DB.");
                onLogin(defaultAdmin);
            }
          } catch (dbError) {
              console.error("Erro crítico ao acessar DB do Admin:", dbError);
              setError("Erro ao carregar perfil do administrador. Verifique o console.");
          }
          return;
        }

        // 2. Database User Check (Alunos)
        const user = await authenticateUserDB(normalizedEmail, normalizedPass);
        
        if (user) {
            onLogin(user);
        } else {
            setError('Credenciais inválidas. Tente novamente.');
        }
    } catch (e) {
        setError("Erro de conexão. Verifique sua internet.");
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="w-full h-full flex items-center justify-center relative overflow-hidden bg-black">
      {/* Dynamic Background */}
      <div className="absolute inset-0 bg-tech-grid opacity-30"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-insanus-red/10 rounded-full blur-[150px] animate-pulse"></div>

      <div className="relative z-10 w-full max-w-md p-8">
        <div className="glass p-8 rounded-2xl shadow-2xl border border-white/10 relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-insanus-red to-transparent opacity-50 group-hover:opacity-100 transition duration-500"></div>
            
            <div className="text-center mb-10">
                <h2 className="text-4xl font-black text-white tracking-tighter mb-2">INSANUS <span className="text-insanus-red">PLANNER</span></h2>
                <p className="text-xs font-mono text-gray-500 tracking-[0.3em] uppercase">Sistema de Alta Performance</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1">Identificação (E-mail)</label>
                <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-insanus-red focus:shadow-neon focus:outline-none transition-all placeholder-gray-700"
                placeholder="usuario@insanus.com"
                required
                />
            </div>

            <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1">Chave de Acesso (Senha)</label>
                <div className="relative">
                <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-insanus-red focus:shadow-neon focus:outline-none transition-all placeholder-gray-700 pr-10"
                    placeholder="••••••••"
                    required
                />
                <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-white transition"
                >
                    {showPassword ? <Icon.EyeOff className="w-5 h-5" /> : <Icon.Eye className="w-5 h-5" />}
                </button>
                </div>
            </div>

            {error && (
                <div className="p-3 bg-red-500/10 border-l-2 border-red-500 text-red-400 text-xs text-center font-mono">
                [ERRO]: {error}
                </div>
            )}

            <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-4 bg-insanus-red hover:bg-red-600 text-white font-bold py-4 rounded-lg shadow-neon transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
            >
                {isLoading ? (
                    <span className="animate-pulse">AUTENTICANDO...</span>
                ) : (
                    <>ACESSAR SISTEMA</>
                )}
            </button>
            </form>
        </div>
      </div>
    </div>
  );
};
