import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface PushNotificationState {
  isSupported: boolean;
  permission: NotificationPermission | 'default';
  isSubscribed: boolean;
  isLoading: boolean;
}

export const usePushNotifications = () => {
  const { user } = useAuth();
  const [state, setState] = useState<PushNotificationState>({
    isSupported: false,
    permission: 'default',
    isSubscribed: false,
    isLoading: true,
  });

  // Check if push notifications are supported
  const checkSupport = useCallback(() => {
    const isSupported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    setState(prev => ({ ...prev, isSupported }));
    return isSupported;
  }, []);

  // Get current permission status
  const checkPermission = useCallback(() => {
    if ('Notification' in window) {
      setState(prev => ({ ...prev, permission: Notification.permission }));
      return Notification.permission;
    }
    return 'default';
  }, []);

  // Register service worker
  const registerServiceWorker = useCallback(async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker registered:', registration);
      return registration;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      throw error;
    }
  }, []);

  // Request notification permission
  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) {
      toast.error('Push notifications are not supported in this browser');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      setState(prev => ({ ...prev, permission }));
      
      if (permission === 'granted') {
        toast.success('Push notifications enabled');
        return true;
      } else if (permission === 'denied') {
        toast.error('Push notifications were denied. Please enable them in browser settings.');
        return false;
      }
      return false;
    } catch (error) {
      console.error('Error requesting permission:', error);
      toast.error('Failed to request notification permission');
      return false;
    }
  }, []);

  // Subscribe to push notifications
  const subscribe = useCallback(async () => {
    if (!state.isSupported) {
      toast.error('Push notifications are not supported');
      return false;
    }

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      // Request permission first
      const permissionGranted = await requestPermission();
      if (!permissionGranted) {
        setState(prev => ({ ...prev, isLoading: false }));
        return false;
      }

      // Register service worker
      const registration = await registerServiceWorker();

      // Wait for service worker to be ready
      await navigator.serviceWorker.ready;

      // Check if already subscribed
      const existingSubscription = await registration.pushManager.getSubscription();
      if (existingSubscription) {
        setState(prev => ({ ...prev, isSubscribed: true, isLoading: false }));
        return true;
      }

      // For demo purposes, we'll just mark as subscribed
      // In production, you'd use VAPID keys and a push service
      setState(prev => ({ ...prev, isSubscribed: true, isLoading: false }));
      
      // Save subscription status to settings
      if (user) {
        await supabase
          .from('tracking_settings')
          .upsert({
            setting_key: 'push_notifications',
            setting_value: 'true',
            description: 'Push notifications enabled',
          }, { onConflict: 'setting_key' });
      }

      toast.success('Successfully subscribed to push notifications');
      return true;
    } catch (error) {
      console.error('Error subscribing to push:', error);
      toast.error('Failed to subscribe to push notifications');
      setState(prev => ({ ...prev, isLoading: false }));
      return false;
    }
  }, [state.isSupported, requestPermission, registerServiceWorker, user]);

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true }));

    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          await subscription.unsubscribe();
        }
      }

      setState(prev => ({ ...prev, isSubscribed: false, isLoading: false }));

      // Update settings
      if (user) {
        await supabase
          .from('tracking_settings')
          .upsert({
            setting_key: 'push_notifications',
            setting_value: 'false',
            description: 'Push notifications disabled',
          }, { onConflict: 'setting_key' });
      }

      toast.success('Unsubscribed from push notifications');
      return true;
    } catch (error) {
      console.error('Error unsubscribing:', error);
      toast.error('Failed to unsubscribe from push notifications');
      setState(prev => ({ ...prev, isLoading: false }));
      return false;
    }
  }, [user]);

  // Send a test notification
  const sendTestNotification = useCallback(async () => {
    if (!state.isSubscribed || state.permission !== 'granted') {
      toast.error('Please enable push notifications first');
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification('Test Notification', {
        body: 'Push notifications are working correctly!',
        icon: '/favicon.png',
        badge: '/favicon.png',
        tag: 'test',
      });
      toast.success('Test notification sent');
    } catch (error) {
      console.error('Error sending test notification:', error);
      toast.error('Failed to send test notification');
    }
  }, [state.isSubscribed, state.permission]);

  // Show a local notification (for in-app alerts)
  const showNotification = useCallback(async (title: string, options?: NotificationOptions) => {
    if (state.permission !== 'granted') {
      console.log('Notification permission not granted');
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(title, {
        icon: '/favicon.png',
        badge: '/favicon.png',
        ...options,
      });
    } catch (error) {
      console.error('Error showing notification:', error);
    }
  }, [state.permission]);

  // Initialize on mount
  useEffect(() => {
    const init = async () => {
      const supported = checkSupport();
      if (!supported) {
        setState(prev => ({ ...prev, isLoading: false }));
        return;
      }

      checkPermission();

      // Check if already subscribed
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          const subscription = await registration.pushManager.getSubscription();
          setState(prev => ({
            ...prev,
            isSubscribed: !!subscription || Notification.permission === 'granted',
            isLoading: false,
          }));
        } else {
          setState(prev => ({ ...prev, isLoading: false }));
        }
      } catch (error) {
        console.error('Error checking subscription:', error);
        setState(prev => ({ ...prev, isLoading: false }));
      }
    };

    init();
  }, [checkSupport, checkPermission]);

  return {
    ...state,
    subscribe,
    unsubscribe,
    sendTestNotification,
    showNotification,
    requestPermission,
  };
};
