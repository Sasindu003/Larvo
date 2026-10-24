import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';

// Add type definitions for Google Identity Services
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          renderButton: (parent: HTMLElement, options: any) => void;
          prompt: () => void;
        };
      };
    };
  }
}

interface GoogleAuthButtonProps {
  onSuccessRedirect?: string;
  buttonText?: 'signin_with' | 'signup_with' | 'continue_with';
}

export const GoogleAuthButton: React.FC<GoogleAuthButtonProps> = ({
  onSuccessRedirect = '/',
  buttonText = 'signin_with',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { googleLogin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // 1. Load the GIS script if not already loaded
    const scriptId = 'google-gsi-script';
    let script = document.getElementById(scriptId) as HTMLScriptElement;

    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    // 2. Initialize and render when script is loaded
    const handleScriptLoad = () => {
      const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

      if (!clientId || clientId === 'YOUR_GOOGLE_CLIENT_ID_HERE') {
        console.warn('Google Auth is disabled: VITE_GOOGLE_CLIENT_ID is missing or not configured');
        if (containerRef.current) {
          containerRef.current.innerHTML = '<div class="text-xs text-red-500 bg-red-50 p-2 rounded border border-red-200 text-center">Google Sign-in disabled<br/>(Client ID not configured)</div>';
        }
        return;
      }

      if (window.google?.accounts?.id && containerRef.current) {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: async (response: any) => {
            try {
              if (response.credential) {
                await googleLogin(response.credential);
                toast.success('Successfully authenticated with Google!');
                navigate(onSuccessRedirect);
              }
            } catch (err: any) {
              toast.error(err.message || 'Google authentication failed');
            }
          },
        });

        window.google.accounts.id.renderButton(containerRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: buttonText,
          shape: 'rectangular',
          logo_alignment: 'left',
          width: containerRef.current.offsetWidth > 250 ? containerRef.current.offsetWidth : undefined,
        });
      }
    };

    if (window.google?.accounts?.id) {
      handleScriptLoad();
    } else {
      script.addEventListener('load', handleScriptLoad);
    }

    return () => {
      script?.removeEventListener('load', handleScriptLoad);
    };
  }, [googleLogin, navigate, onSuccessRedirect, buttonText]);

  return (
    <div className="w-full">
      <div ref={containerRef} className="flex justify-center w-full min-h-[40px]">
        {/* Button renders here. Fallback text before load isn't strictly necessary as GIS is fast, 
            but the div ensures proper sizing */}
      </div>
    </div>
  );
};
