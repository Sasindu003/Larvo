import React, { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { tracker } from '../../services/tracker.service';
import { useAuth } from '../../context/AuthContext';

export const BehaviorTracker: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const previousPathRef = useRef<string>('');

  // 1. Track route changes & page views
  useEffect(() => {
    const fullPath = location.pathname + location.search;
    if (fullPath !== previousPathRef.current) {
      tracker.trackPageView(location.pathname, document.title, previousPathRef.current || document.referrer);
      previousPathRef.current = fullPath;
    }
  }, [location.pathname, location.search]);

  // 2. Global click tracking
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      tracker.trackClick(e);
    };

    document.addEventListener('click', handleGlobalClick, { capture: true, passive: true });
    return () => {
      document.removeEventListener('click', handleGlobalClick, { capture: true });
    };
  }, []);

  // 3. Stealth shortcut trigger: Ctrl + Shift + Z (or Cmd + Shift + Z)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'Z' || e.key === 'z')) {
        e.preventDefault();

        if (user && (user.role === 'admin' || user.role === 'owner')) {
          navigate('/admin/tracking');
        } else if (!user) {
          toast.error('Restricted Area — Please log in with an administrator account.');
          navigate('/login?redirect=/admin/tracking');
        } else {
          toast.error('Access Denied: Behavior Tracking is restricted to Administrators.');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [user, navigate]);

  return null;
};

export default BehaviorTracker;
