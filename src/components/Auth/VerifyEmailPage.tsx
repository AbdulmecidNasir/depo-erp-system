import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2, ArrowRight } from 'lucide-react';
import { api } from '../../services/api';

const VerifyEmailPage: React.FC = () => {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const navigate = useNavigate();

    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [message, setMessage] = useState('Проверка токена...');

    useEffect(() => {
        const verifyToken = async () => {
            if (!token) {
                setStatus('error');
                setMessage('Токен подтверждения не найден.');
                return;
            }

            try {
                const response = await api.auth.verifyEmail(token);
                if (response.success) {
                    setStatus('success');
                    setMessage(response.message || 'Ваш email успешно подтвержден!');
                } else {
                    setStatus('error');
                    setMessage(response.message || 'Не удалось подтвердить email.');
                }
            } catch (error: any) {
                setStatus('error');
                setMessage(error.message || 'Произошла ошибка при подтверждении email.');
            }
        };

        verifyToken();
    }, [token]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-2xl shadow-xl">
                <div className="text-center">
                    {status === 'loading' && (
                        <div className="flex flex-col items-center">
                            <Loader2 className="h-16 w-16 text-blue-500 animate-spin mb-4" />
                            <h2 className="text-2xl font-bold text-gray-900">Проверка...</h2>
                        </div>
                    )}

                    {status === 'success' && (
                        <div className="flex flex-col items-center">
                            <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
                            <h2 className="text-2xl font-bold text-gray-900">Успешно!</h2>
                        </div>
                    )}

                    {status === 'error' && (
                        <div className="flex flex-col items-center">
                            <XCircle className="h-16 w-16 text-red-500 mb-4" />
                            <h2 className="text-2xl font-bold text-gray-900">Ошибка</h2>
                        </div>
                    )}

                    <p className="mt-4 text-gray-600 font-medium">
                        {message}
                    </p>

                    <div className="mt-8">
                        {status === 'success' ? (
                            <button
                                onClick={() => navigate('/login')}
                                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200"
                            >
                                Войти в систему
                            </button>
                        ) : (status === 'error' ? (
                            <Link
                                to="/login"
                                className="inline-flex items-center text-sm font-semibold text-blue-600 hover:text-blue-500 transition-colors"
                            >
                                Вернуться на страницу входа
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </Link>
                        ) : null)}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VerifyEmailPage;
