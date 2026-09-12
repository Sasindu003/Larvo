import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { GoogleAuthButton } from '../components/auth/GoogleAuthButton';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormValues) => {
    setIsSubmitting(true);
    try {
      await login(data.email, data.password);
      toast.success('Welcome back!');
      navigate('/');
    } catch (error: any) {
      toast.error(error.message || 'Login failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-sand-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-display font-bold text-ink-950">
          Sign in to your account
        </h2>
        <p className="mt-2 text-center text-sm text-ink-600">
          Don't have an account?{' '}
          <Link to="/register" className="font-medium text-ink-900 hover:underline">
            Create one
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-xl sm:px-10 border border-sand-200">
          <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-ink-900">
                Email address
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  {...register('email')}
                  className={`block w-full appearance-none rounded-md border px-3 py-2 placeholder-ink-400 shadow-sm focus:border-ink-500 focus:outline-none focus:ring-ink-500 sm:text-sm ${
                    errors.email ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-sand-300'
                  }`}
                />
                {errors.email && <p className="mt-2 text-sm text-red-600">{errors.email.message}</p>}
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-ink-900">
                Password
              </label>
              <div className="mt-1">
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  {...register('password')}
                  className={`block w-full appearance-none rounded-md border px-3 py-2 placeholder-ink-400 shadow-sm focus:border-ink-500 focus:outline-none focus:ring-ink-500 sm:text-sm ${
                    errors.password ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-sand-300'
                  }`}
                />
                {errors.password && <p className="mt-2 text-sm text-red-600">{errors.password.message}</p>}
              </div>
            </div>

            <div>
              <Button type="submit" variant="primary" className="w-full justify-center" disabled={isSubmitting}>
                {isSubmitting ? 'Signing in...' : 'Sign In'}
              </Button>
            </div>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-sand-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-white px-2 text-ink-500">Or continue with</span>
              </div>
            </div>

            <div className="mt-6">
              <GoogleAuthButton onSuccessRedirect="/" buttonText="signin_with" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
